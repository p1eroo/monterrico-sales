/**
 * Migración: corrige MIME type y extensión de imágenes de WhatsApp
 * que Evolution GO reportó incorrectamente (ej: image/jpeg pero el
 * contenido real es image/webp o image/avif). Convierte WebP/AVIF a
 * JPEG para compatibilidad universal y re-subé el JPEG al CDN.
 *
 * Uso (desde backend/):
 *   DRY_RUN=true npx ts-node scripts/fix-image-mimes.ts   → preview
 *   npx ts-node scripts/fix-image-mimes.ts                 → ejecutar
 */

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const DRY_RUN = process.env.DRY_RUN?.trim() === 'true';

const sharp = require('sharp');
const https = require('https');
const http = require('http');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

function isPublicUrl(ref: string): boolean {
  return /^https?:\/\//i.test(ref.trim());
}

function fetchBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode! >= 300 && res.statusCode! < 400 && res.headers.location) {
        resolve(fetchBuffer(res.headers.location));
        return;
      }
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function detectFileType(buf: Buffer): { mime: string; ext: string } | null {
  const header = buf.slice(0, 12).toString('hex').toLowerCase();
  if (header.startsWith('ffd8ff')) return { mime: 'image/jpeg', ext: 'jpg' };
  if (header.startsWith('89504e47')) return { mime: 'image/png', ext: 'png' };
  if (header.startsWith('47494638')) return { mime: 'image/gif', ext: 'gif' };
  if (header.startsWith('52494646') && buf.length >= 12 && buf.slice(8, 12).toString() === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  if (header.includes('6674797061766966')) return { mime: 'image/avif', ext: 'avif' };
  return null;
}

/** Extrae la clave S3 desde una URL pública de CDN */
function extractS3Key(url: string, bucket: string): string | null {
  const parts = url.split(bucket + '/');
  if (parts.length < 2) return null;
  return parts.slice(1).join(bucket + '/'); // path after bucket
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const prisma = app.get(PrismaService);
  const config = app.get(ConfigService);

  const s3Endpoint = config.get<string>('S3_ENDPOINT')?.trim();
  const s3AccessKey = config.get<string>('S3_ACCESS_KEY')?.trim();
  const s3SecretKey = config.get<string>('S3_SECRET_KEY')?.trim();
  const s3Bucket = config.get<string>('S3_BUCKET')?.trim();

  if (!s3Endpoint || !s3AccessKey || !s3SecretKey || !s3Bucket) {
    console.error('Faltan credenciales S3 en .env');
    await app.close();
    process.exit(1);
  }

  const s3 = new S3Client({
    endpoint: s3Endpoint,
    region: 'us-east-1',
    credentials: { accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey },
    forcePathStyle: true,
  });

  console.log(`Modo: ${DRY_RUN ? 'PREVIEW (solo lectura)' : 'EJECUTANDO'}`);
  console.log(`Bucket: ${s3Bucket}, Endpoint: ${s3Endpoint}`);
  console.log('Buscando archivos CrmFile de WhatsApp...');

  const files = await prisma.crmFile.findMany({
    where: {
      relatedEntityType: 'whatsapp-message',
      mimeType: { startsWith: 'image/' },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Encontrados ${files.length} archivos de imagen.`);

  let fixed = 0;
  let errors = 0;

  for (const file of files) {
    try {
      let bytes: Buffer | null = null;

      if (isPublicUrl(file.storageKey)) {
        bytes = await fetchBuffer(file.storageKey);
      } else {
        console.log(`  Omitiendo (no URL pública): ${file.storageKey}`);
        continue;
      }

      if (!bytes || bytes.length === 0) {
        console.log(`  Omitiendo (vacío): ${file.id}`);
        continue;
      }

      const detected = detectFileType(bytes);
      if (!detected) {
        console.log(`  No se pudo detectar tipo: ${file.id}`);
        continue;
      }

      // Si ya es JPEG y el MIME está correcto → saltar
      if (detected.mime === 'image/jpeg' && detected.mime === file.mimeType) {
        continue;
      }

      let newMimeType = file.mimeType;
      let newBytes = bytes;
      let newExt = file.originalName.split('.').pop() || 'bin';

      if (detected.mime === 'image/webp' || detected.mime === 'image/avif') {
        console.log(`  Convirtiendo ${detected.mime} → JPEG: ${file.originalName}`);
        newBytes = await sharp(bytes).jpeg({ quality: 90 }).toBuffer();
        newMimeType = 'image/jpeg';
        newExt = 'jpg';
      } else if (detected.mime !== file.mimeType) {
        console.log(`  MIME incorrecto: BD=${file.mimeType} real=${detected.mime} → ${file.originalName}`);
        newMimeType = detected.mime;
        newExt = detected.ext || file.originalName.split('.').pop() || 'bin';
      } else {
        continue;
      }

      const base = file.originalName.replace(/\.[^.]+$/, '');
      const newName = `${base}.${newExt}`;
      const s3Key = extractS3Key(file.storageKey, s3Bucket);

      if (s3Key) {
        // Re-subir al mismo key S3 con extensión correcta
        const newKey = s3Key.replace(/\.[^.]+$/, '.' + newExt);
        console.log(`  S3: ${s3Key} → ${newKey} (${newBytes.length} bytes)`);

        if (!DRY_RUN) {
          await s3.send(new PutObjectCommand({
            Bucket: s3Bucket,
            Key: newKey,
            Body: newBytes,
            ContentType: newMimeType,
          }));
        }
      }

      if (DRY_RUN) {
        console.log(`  [DRY] ${file.originalName} → ${newName} (${newMimeType})`);
        fixed++;
        continue;
      }

      // Actualizar el storageKey si la extensión S3 cambió
      const updateData: any = { mimeType: newMimeType, originalName: newName };
      if (s3Key) {
        const newKey = s3Key.replace(/\.[^.]+$/, '.' + newExt);
        updateData.storageKey = file.storageKey.replace(s3Key, newKey);
      }

      await prisma.crmFile.update({
        where: { id: file.id },
        data: updateData,
      });

      fixed++;
      console.log(`  ✓ Corregido: ${file.originalName} → ${newName}`);
    } catch (err) {
      errors++;
      console.error(`  ✗ Error con ${file.id}:`, err instanceof Error ? err.message : String(err));
    }
  }

  console.log(`\nResumen: ${fixed} corregidos, ${errors} errores, ${files.length - fixed - errors} sin cambios.`);
  await app.close();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
