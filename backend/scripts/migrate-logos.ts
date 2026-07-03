/**
 * Migración: mueve logos de empresas de crm-adjuntos/logos/ a crm-avatar/logos/.
 *
 * Uso (desde backend/):
 *   npx ts-node scripts/migrate-logos.ts
 */

import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const ENDPOINT = process.env.S3_ENDPOINT || 'https://cdn.3w.pe';
const ACCESS_KEY = process.env.S3_ACCESS_KEY || 'XNvRTom8GjubfqipSMAG';
const SECRET_KEY = process.env.S3_SECRET_KEY || 'Z3ILm23fo8w2cJUZ8PmpdcRhLVxVHrmV7FQgAlZK';
const FROM_BUCKET = 'crm-adjuntos';
const TO_BUCKET = 'crm-avatar';
const PREFIX = 'logos/';

async function migrate() {
  const client = new S3Client({
    endpoint: ENDPOINT,
    region: 'us-east-1',
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
    forcePathStyle: true,
  });

  console.log(`Listando ${FROM_BUCKET}/${PREFIX}...`);
  const list = await client.send(new ListObjectsV2Command({ Bucket: FROM_BUCKET, Prefix: PREFIX }));
  const items = list.Contents ?? [];

  if (items.length === 0) {
    console.log('No se encontraron logos para migrar.');
    return;
  }

  console.log(`Encontrados ${items.length} archivo(s). Migrando a ${TO_BUCKET}/${PREFIX}...`);

  for (const obj of items) {
    if (!obj.Key) continue;
    console.log(`  Copiando ${obj.Key}...`);
    await client.send(new CopyObjectCommand({
      Bucket: TO_BUCKET,
      CopySource: `/${FROM_BUCKET}/${obj.Key}`,
      Key: obj.Key,
    }));
    await client.send(new DeleteObjectCommand({ Bucket: FROM_BUCKET, Key: obj.Key }));
    console.log(`  ✅ ${obj.Key} migrado`);
  }

  console.log('Migración completada.');
}

migrate().catch((err) => {
  console.error('Error durante la migración:', err);
  process.exit(1);
});
