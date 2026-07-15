import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MediaUploadService {
  constructor(private readonly config: ConfigService) {}

  /** Proxy configurado (URL); el bucket puede indicarse por env o por argumento. */
  isProxyUrlConfigured(): boolean {
    return !!this.config.get<string>('MEDIA_UPLOAD_URL')?.trim();
  }

  isConfigured(): boolean {
    const url = this.config.get<string>('MEDIA_UPLOAD_URL')?.trim();
    const bucket = this.config.get<string>('MEDIA_BUCKET')?.trim();
    return !!(url && bucket);
  }

  /**
   * POST multipart al servicio de medios (`bucket` + `file`).
   */
  async uploadToBucket(
    bucket: string,
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    opts?: { authorizationHeader?: string },
  ): Promise<string> {
    const url = this.config.get<string>('MEDIA_UPLOAD_URL')?.trim();
    const b = bucket?.trim();
    if (!url || !b) {
      throw new ServiceUnavailableException(
        'MEDIA_UPLOAD_URL y bucket son obligatorios para subir al proxy de medios.',
      );
    }

    const explicitAuth =
      this.config.get<string>('MEDIA_UPLOAD_AUTHORIZATION')?.trim();
    const forwardUserAuth =
      this.config.get<string>('MEDIA_FORWARD_USER_AUTH') !== 'false';
    const authorization =
      explicitAuth ||
      (forwardUserAuth ? opts?.authorizationHeader?.trim() : undefined);

    const formData = new FormData();
    formData.append('bucket', b);
    const body = new Uint8Array(buffer);
    const file = new File([body], originalName || 'archivo', {
      type: mimeType || 'application/octet-stream',
    });
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (authorization) {
      headers['Authorization'] = authorization;
    }

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      headers,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new BadRequestException(
        `El servicio de medios respondió ${res.status}: ${text.slice(0, 300)}`,
      );
    }

    let parsed: { url?: unknown };
    try {
      parsed = JSON.parse(text) as { url?: unknown };
    } catch {
      throw new BadRequestException('Respuesta del servicio de medios no es JSON válido');
    }
    const publicUrl =
      typeof parsed.url === 'string' ? parsed.url.trim() : '';
    if (!publicUrl) {
      throw new BadRequestException('El servicio de medios no devolvió url');
    }
    return publicUrl;
  }

  /** Subida con MEDIA_BUCKET del entorno (adjuntos CRM comercial). */
  async uploadToMediaProxy(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    opts?: { authorizationHeader?: string },
  ): Promise<string> {
    const bucket = this.config.get<string>('MEDIA_BUCKET')?.trim();
    if (!bucket) {
      throw new ServiceUnavailableException(
        'MEDIA_BUCKET no está definido.',
      );
    }
    return this.uploadToBucket(
      bucket,
      buffer,
      originalName,
      mimeType,
      opts,
    );
  }

  /** Bucket de adjuntos Flota (prospectos, WhatsApp Flota). */
  prospectosBucket(): string | undefined {
    return this.config.get<string>('MEDIA_PROSPECTOS_BUCKET')?.trim() || undefined;
  }

  /** Subida con MEDIA_PROSPECTOS_BUCKET (adjuntos Flota). */
  async uploadToProspectosProxy(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    opts?: { authorizationHeader?: string },
  ): Promise<string> {
    const bucket = this.prospectosBucket();
    if (!bucket) {
      throw new ServiceUnavailableException(
        'MEDIA_PROSPECTOS_BUCKET no está definido.',
      );
    }
    return this.uploadToBucket(
      bucket,
      buffer,
      originalName,
      mimeType,
      opts,
    );
  }

  /** Proxy según entityType: flota-prospecto → prospectos, resto → comercial. */
  async uploadForEntity(
    entityType: string,
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    opts?: { authorizationHeader?: string },
  ): Promise<string> {
    if (entityType === 'flota-prospecto' && this.prospectosBucket()) {
      return this.uploadToProspectosProxy(
        buffer,
        originalName,
        mimeType,
        opts,
      );
    }
    return this.uploadToMediaProxy(buffer, originalName, mimeType, opts);
  }

  avatarBucket(): string {
    return (
      this.config.get<string>('MEDIA_AVATAR_BUCKET')?.trim() || 'crm-avatar'
    );
  }
}

function isPublicUrl(ref: string): boolean {
  return /^https?:\/\//i.test(ref);
}

export { isPublicUrl };
