import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { Readable } from 'node:stream';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageService } from './s3-storage.service';
import {
  MediaUploadService,
  isPublicUrl,
} from '../media/media-upload.service';

const ENTITY_TYPES = new Set([
  'contact',
  'company',
  'opportunity',
  'activity',
  'email',
  'task',
  'flota-prospecto',
]);

const COMERCIAL_ENTITY_TYPES = [
  'contact',
  'company',
  'opportunity',
  'activity',
  'email',
  'task',
] as const;

export type FilesListScope = 'comercial' | 'flota';

function safeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._\-ñÑ áéíóúÁÉÍÓÚ]+/g, '_').trim();
  return (base || 'archivo').slice(0, 200);
}

@Injectable()
export class FilesService {
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3StorageService,
    private readonly mediaUpload: MediaUploadService,
    private readonly config: ConfigService,
  ) {
    const mb = Number(
      this.config.get<string>('FILES_MAX_MB') ?? '50',
    );
    this.maxBytes = Math.min(500, Math.max(1, mb)) * 1024 * 1024;
  }

  assertStorageReady() {
    if (!this.mediaUpload.isConfigured() && !this.s3.isConfigured()) {
      throw new ServiceUnavailableException(
        'Almacenamiento no configurado: defina MEDIA_UPLOAD_URL + MEDIA_BUCKET (proxy de medios) o S3_ENDPOINT + S3_ACCESS_KEY + S3_SECRET_KEY + S3_BUCKET.',
      );
    }
  }

  private async getGrantedPermissions(userId: string): Promise<Set<string>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roleId: true },
    });
    if (!user?.roleId) {
      throw new ForbiddenException('Usuario sin rol asignado');
    }
    const authorities = await this.prisma.authority.findMany({
      where: { roleId: user.roleId },
      select: { permission: true },
    });
    return new Set(authorities.map((a) => a.permission));
  }

  /** Archivos de prospectos Flota o adjuntos WhatsApp/Chatwoot vinculados a Flota. */
  private async isFlotaFile(row: {
    entityType: string;
    relatedEntityType?: string | null;
    relatedEntityId?: string | null;
  }): Promise<boolean> {
    if (row.entityType === 'flota-prospecto') return true;
    if (row.relatedEntityType === 'chatwoot-message') return true;
    if (
      row.relatedEntityType === 'whatsapp-message' &&
      row.relatedEntityId?.trim()
    ) {
      const msg = await this.prisma.crmWhatsappMessage.findUnique({
        where: { id: row.relatedEntityId.trim() },
        select: { flotaProspectoId: true },
      });
      return !!msg?.flotaProspectoId;
    }
    return false;
  }

  private canReadFlotaFile(granted: Set<string>): boolean {
    return (
      granted.has('flota_prospectos.ver') || granted.has('flota_mensajes.ver')
    );
  }

  private canDeleteFlotaFile(granted: Set<string>): boolean {
    return (
      granted.has('flota_prospectos.editar') ||
      granted.has('flota_mensajes.editar')
    );
  }

  async assertCanListFiles(userId: string, scope?: string): Promise<void> {
    const granted = await this.getGrantedPermissions(userId);
    if (scope === 'flota') {
      if (this.canReadFlotaFile(granted)) {
        return;
      }
      throw new ForbiddenException('Permiso denegado: flota_prospectos.ver');
    }
    if (!granted.has('archivos.ver')) {
      throw new ForbiddenException('Permiso denegado: archivos.ver');
    }
  }

  async assertCanReadFile(userId: string, fileId: string): Promise<void> {
    const row = await this.prisma.crmFile.findUnique({ where: { id: fileId } });
    if (!row) {
      throw new NotFoundException('Archivo no encontrado');
    }
    const granted = await this.getGrantedPermissions(userId);
    const flota = await this.isFlotaFile(row);
    if (flota) {
      if (this.canReadFlotaFile(granted)) return;
      throw new ForbiddenException('Permiso denegado: flota_prospectos.ver');
    }
    if (!granted.has('archivos.ver')) {
      throw new ForbiddenException('Permiso denegado: archivos.ver');
    }
  }

  async assertCanDeleteFile(userId: string, fileId: string): Promise<void> {
    const row = await this.prisma.crmFile.findUnique({ where: { id: fileId } });
    if (!row) {
      throw new NotFoundException('Archivo no encontrado');
    }
    const granted = await this.getGrantedPermissions(userId);
    const flota = await this.isFlotaFile(row);
    if (flota) {
      if (this.canDeleteFlotaFile(granted)) return;
      throw new ForbiddenException('Permiso denegado: flota_prospectos.editar');
    }
    if (!granted.has('archivos.eliminar')) {
      throw new ForbiddenException('Permiso denegado: archivos.eliminar');
    }
  }

  async findAll(
    entityType?: string,
    entityId?: string,
    scope?: string,
  ) {
    const where: Record<string, unknown> = {};

    if (entityType?.trim() && entityId?.trim()) {
      where.entityType = entityType.trim();
      where.entityId = entityId.trim();
    } else if (scope === 'comercial') {
      /** Cartera comercial: contacto, empresa, oportunidad, etc. Excluye solo flota-prospecto. */
      where.entityType = { in: [...COMERCIAL_ENTITY_TYPES] };
    } else if (scope === 'flota') {
      where.OR = [
        { entityType: 'flota-prospecto' },
        { relatedEntityType: 'whatsapp-message' },
        { relatedEntityType: 'chatwoot-message' },
      ];
    }

    const rows = await this.prisma.crmFile.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapRow(r));
  }

  async create(
    uploadedById: string,
    params: {
      buffer: Buffer;
      originalName: string;
      mimeType: string;
      entityType: string;
      entityId: string;
      entityName?: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
      relatedEntityName?: string;
      authorizationHeader?: string;
    },
  ) {
    this.assertStorageReady();
    const { buffer, originalName, mimeType, entityType, entityId } = params;
    if (!ENTITY_TYPES.has(entityType)) {
      throw new BadRequestException('entityType no válido');
    }
    if (!entityId?.trim()) {
      throw new BadRequestException('entityId es obligatorio');
    }
    if (buffer.length === 0) {
      throw new BadRequestException('Archivo vacío');
    }
    if (buffer.length > this.maxBytes) {
      throw new BadRequestException(
        `El archivo supera el máximo permitido (${Math.floor(this.maxBytes / (1024 * 1024))} MB)`,
      );
    }

    let storageKey: string;

    if (this.mediaUpload.isProxyUrlConfigured()) {
      storageKey = await this.mediaUpload.uploadForEntity(
        entityType,
        buffer,
        originalName,
        mimeType,
        { authorizationHeader: params.authorizationHeader },
      );
    } else {
      const safe = safeFilename(originalName);
      storageKey = `${entityType}/${entityId.trim()}/${randomUUID()}-${safe}`;
      const prospectosBucket =
        entityType === 'flota-prospecto'
          ? this.mediaUpload.prospectosBucket()
          : undefined;
      if (prospectosBucket) {
        await this.s3.putObjectToBucket(
          prospectosBucket,
          storageKey,
          buffer,
          mimeType,
        );
      } else {
        await this.s3.putObject(storageKey, buffer, mimeType);
      }
    }

    try {
      const row = await this.prisma.crmFile.create({
        data: {
          storageKey,
          originalName: originalName.slice(0, 500),
          mimeType: mimeType.slice(0, 200),
          size: buffer.length,
          entityType,
          entityId: entityId.trim(),
          entityName: params.entityName?.trim() || null,
          relatedEntityType: params.relatedEntityType?.trim() || null,
          relatedEntityId: params.relatedEntityId?.trim() || null,
          relatedEntityName: params.relatedEntityName?.trim() || null,
          uploadedBy: uploadedById,
        },
        include: {
          user: { select: { id: true, name: true } },
        },
      });
      return this.mapRow(row);
    } catch (e) {
      if (!isPublicUrl(storageKey)) {
        await this.s3.deleteObject(storageKey).catch(() => undefined);
      }
      throw e;
    }
  }

  async remove(id: string, requesterId: string) {
    await this.assertCanDeleteFile(requesterId, id);
    const row = await this.prisma.crmFile.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Archivo no encontrado');
    }
    if (!isPublicUrl(row.storageKey)) {
      await this.s3.deleteObject(row.storageKey).catch(() => undefined);
    }
    await this.prisma.crmFile.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Transmite el binario con Content-Type y Content-Disposition desde metadatos (corrige CDNs
   * que sirven PDF u otros tipos con cabeceras incorrectas).
   */
  async openContentStream(
    id: string,
    disposition: 'inline' | 'attachment',
  ): Promise<{
    stream: Readable;
    mimeType: string;
    contentDisposition: string;
  }> {
    this.assertStorageReady();
    const row = await this.prisma.crmFile.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Archivo no encontrado');
    }
    const mimeType = row.mimeType?.trim() || 'application/octet-stream';
    const contentDisposition = this.buildContentDisposition(
      disposition,
      row.originalName,
    );

    if (isPublicUrl(row.storageKey)) {
      const res = await fetch(row.storageKey);
      if (!res.ok) {
        throw new NotFoundException(
          'No se pudo obtener el archivo desde el almacén público',
        );
      }
      if (!res.body) {
        throw new NotFoundException('Respuesta vacía del almacén');
      }
      const stream = Readable.fromWeb(
        res.body as import('stream/web').ReadableStream,
      );
      return { stream, mimeType, contentDisposition };
    }

    if (!this.s3.isConfigured()) {
      throw new ServiceUnavailableException(
        'Este archivo está en almacenamiento S3; configura S3_* para descargarlo.',
      );
    }
    const out = await this.s3.getClient().send(
      new GetObjectCommand({
        Bucket: this.s3.getBucket(),
        Key: row.storageKey,
      }),
    );
    if (!out.Body) {
      throw new NotFoundException('Archivo no encontrado en almacenamiento');
    }
    const stream = out.Body as Readable;
    return { stream, mimeType, contentDisposition };
  }

  private buildContentDisposition(
    disposition: 'inline' | 'attachment',
    filename: string,
  ): string {
    const base = filename.slice(0, 500);
    const ascii = base
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/"/g, '_')
      .replace(/[\r\n]/g, '_')
      .slice(0, 200);
    const enc = encodeURIComponent(base);
    return `${disposition}; filename="${ascii || 'archivo'}"; filename*=UTF-8''${enc}`;
  }

  async presignGet(
    id: string,
    disposition: 'inline' | 'attachment',
  ): Promise<{ url: string }> {
    this.assertStorageReady();
    const row = await this.prisma.crmFile.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Archivo no encontrado');
    }
    if (isPublicUrl(row.storageKey)) {
      return { url: row.storageKey };
    }
    if (!this.s3.isConfigured()) {
      throw new ServiceUnavailableException(
        'Este archivo está en almacenamiento S3; configura S3_* para obtener URL firmada.',
      );
    }
    const bucket = this.s3.getBucket();
    const filename = encodeURIComponent(row.originalName);
    const cd =
      disposition === 'attachment'
        ? `attachment; filename="${filename}"; filename*=UTF-8''${filename}`
        : `inline; filename="${filename}"`;
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: row.storageKey,
      ResponseContentType: row.mimeType,
      ResponseContentDisposition: cd,
    });
    const ttl = Math.min(
      86400,
      Math.max(
        60,
        Number(this.config.get<string>('FILES_PRESIGN_TTL_SEC') ?? '3600'),
      ),
    );
    const url = await getSignedUrl(this.s3.getClient(), command, {
      expiresIn: ttl,
    });
    return { url };
  }

  private mapRow(row: {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    entityType: string;
    entityId: string;
    entityName: string | null;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
    relatedEntityName: string | null;
    uploadedBy: string;
    createdAt: Date;
    user: { name: string };
  }) {
    return {
      id: row.id,
      name: row.originalName,
      size: row.size,
      mimeType: row.mimeType,
      uploadedAt: row.createdAt.toISOString(),
      uploadedBy: row.uploadedBy,
      uploadedByName: row.user.name,
      entityType: row.entityType,
      entityId: row.entityId,
      entityName: row.entityName ?? undefined,
      relatedEntityType: row.relatedEntityType ?? undefined,
      relatedEntityId: row.relatedEntityId ?? undefined,
      relatedEntityName: row.relatedEntityName ?? undefined,
    };
  }
}
