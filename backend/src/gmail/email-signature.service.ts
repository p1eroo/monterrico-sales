import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3StorageService } from '../files/s3-storage.service';
import { MediaUploadService } from '../media/media-upload.service';

const SIGNATURE_PREFIX = 'email-signatures/';
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const IMAGE_MIME_RE = /^image\/(jpeg|png|webp|gif)$/i;

const SIGNATURE_IMAGE_PLACEHOLDER = '__CRM_SIGNATURE_IMAGE__';

type SignatureMeta = {
  html: string;
  imageExt?: string;
  imageUrl?: string;
  updatedAt: string;
};

@Injectable()
export class EmailSignatureService {
  private readonly bucket: string;

  constructor(
    private readonly s3: S3StorageService,
    private readonly mediaUpload: MediaUploadService,
    private readonly config: ConfigService,
  ) {
    this.bucket =
      this.config.get<string>('MEDIA_AVATAR_BUCKET')?.trim() || 'crm-avatar';
  }

  private metaKey(userId: string): string {
    return `${SIGNATURE_PREFIX}${userId}/meta.json`;
  }

  private imageKey(userId: string, ext: string): string {
    return `${SIGNATURE_PREFIX}${userId}/image.${ext}`;
  }

  private assertStorageReady(): void {
    if (!this.s3.isConfigured() && !this.mediaUpload.isProxyUrlConfigured()) {
      throw new ServiceUnavailableException(
        'Almacenamiento no configurado: defina S3_* o MEDIA_UPLOAD_URL para guardar firmas.',
      );
    }
  }

  private extFromMime(mimeType: string): string {
    const m = (mimeType || '').toLowerCase();
    if (m.includes('png')) return 'png';
    if (m.includes('webp')) return 'webp';
    if (m.includes('gif')) return 'gif';
    return 'jpg';
  }

  private mimeFromExt(ext?: string): string {
    switch ((ext || '').toLowerCase()) {
      case 'gif':
        return 'image/gif';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      default:
        return 'image/png';
    }
  }

  private normalizeSignatureHtml(html: string): string {
    return html.replace(
      /<img\b([^>]*?)\bsrc=["'][^"']*["']([^>]*)>/gi,
      `<img$1src="${SIGNATURE_IMAGE_PLACEHOLDER}"$2>`,
    );
  }

  private async readMeta(userId: string): Promise<SignatureMeta | null> {
    if (!this.s3.isConfigured()) return null;
    const obj = await this.s3.getObjectFromBucket(
      this.bucket,
      this.metaKey(userId),
    );
    if (!obj) return null;
    const chunks: Buffer[] = [];
    for await (const chunk of obj.body) {
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as SignatureMeta;
    } catch {
      return null;
    }
  }

  private async writeMeta(
    userId: string,
    html: string,
    imageExt?: string,
  ): Promise<string> {
    if (!this.s3.isConfigured()) {
      throw new ServiceUnavailableException(
        'MinIO/S3 es necesario para persistir la firma (meta.json).',
      );
    }
    const trimmed = html.trim();
    const existing = await this.readMeta(userId);
    const payload: SignatureMeta = {
      html: trimmed,
      imageExt: imageExt ?? existing?.imageExt,
      updatedAt: new Date().toISOString(),
    };
    await this.s3.putObjectToBucket(
      this.bucket,
      this.metaKey(userId),
      Buffer.from(JSON.stringify(payload), 'utf8'),
      'application/json',
    );
    return trimmed;
  }

  private async readStoredImage(
    userId: string,
    ext?: string,
  ): Promise<{ mimeType: string; content: Buffer } | null> {
    if (!this.s3.isConfigured()) return null;
    const extensions = ext
      ? [ext]
      : ['gif', 'png', 'jpg', 'jpeg', 'webp'];
    for (const candidate of extensions) {
      const obj = await this.s3.getObjectFromBucket(
        this.bucket,
        this.imageKey(userId, candidate === 'jpeg' ? 'jpg' : candidate),
      );
      if (!obj) continue;
      const chunks: Buffer[] = [];
      for await (const chunk of obj.body) {
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks);
      if (!content.length) continue;
      const mimeType =
        obj.contentType && !obj.contentType.includes('avif')
          ? obj.contentType
          : this.mimeFromExt(ext ?? candidate);
      return { mimeType, content };
    }
    return null;
  }

  /** Fallback al enviar correo: lee la imagen desde MinIO si la URL externa falla. */
  async resolveStoredImage(
    userId: string,
    _src: string,
  ): Promise<{ mimeType: string; content: Buffer } | null> {
    const meta = await this.readMeta(userId);
    return this.readStoredImage(userId, meta?.imageExt);
  }

  async openStoredImageStream(
    userId: string,
  ): Promise<{ stream: import('stream').Readable; mimeType: string } | null> {
    if (!this.s3.isConfigured()) return null;
    const meta = await this.readMeta(userId);
    const ext = meta?.imageExt;
    const extensions = ext
      ? [ext]
      : ['gif', 'png', 'jpg', 'jpeg', 'webp'];
    for (const candidate of extensions) {
      const key = this.imageKey(userId, candidate === 'jpeg' ? 'jpg' : candidate);
      const obj = await this.s3.getObjectFromBucket(this.bucket, key);
      if (obj?.body) {
        const mimeType =
          obj.contentType && !obj.contentType.includes('avif')
            ? obj.contentType
            : this.mimeFromExt(meta?.imageExt ?? candidate);
        return { stream: obj.body, mimeType };
      }
    }
    return null;
  }

  async getSignature(userId: string): Promise<{ html: string | null }> {
    const meta = await this.readMeta(userId);
    const html = meta?.html?.trim() || null;
    return { html: html ? this.normalizeSignatureHtml(html) : null };
  }

  async saveSignature(userId: string, html: string): Promise<{ html: string }> {
    this.assertStorageReady();
    const saved = await this.writeMeta(userId, this.normalizeSignatureHtml(html));
    return { html: saved };
  }

  async deleteSignature(userId: string): Promise<{ ok: true }> {
    this.assertStorageReady();
    await this.writeMeta(userId, '');
    return { ok: true };
  }

  async uploadSignatureImage(
    userId: string,
    buffer: Buffer,
    mimeType: string,
    originalName: string,
    authorizationHeader?: string,
  ): Promise<{ html: string; imageUrl?: string }> {
    this.assertStorageReady();
    if (!buffer.length) {
      throw new BadRequestException('Imagen vacía');
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException('La imagen supera el máximo de 6 MB');
    }
    if (!IMAGE_MIME_RE.test(mimeType || '')) {
      throw new BadRequestException(
        'Solo se permiten imágenes JPEG, PNG, WebP o GIF',
      );
    }

    const ext = this.extFromMime(mimeType);
    const safeFileName = `firma.${ext}`;

    if (this.s3.isConfigured()) {
      await this.s3.putObjectToBucket(
        this.bucket,
        this.imageKey(userId, ext),
        buffer,
        mimeType,
      );
    }

    let previewUrl: string | undefined;
    if (this.mediaUpload.isProxyUrlConfigured()) {
      previewUrl = await this.mediaUpload.uploadToBucket(
        this.bucket,
        buffer,
        safeFileName,
        mimeType,
        { authorizationHeader },
      );
    }

    const src = SIGNATURE_IMAGE_PLACEHOLDER;
    const imgHtml = `<img src="${src}" alt="Firma" style="max-height:120px;height:auto;" />`;

    const existing = (await this.readMeta(userId))?.html?.trim() ?? '';
    const html = existing ? `${existing}<br>${imgHtml}` : imgHtml;

    if (!this.s3.isConfigured()) {
      throw new ServiceUnavailableException(
        'MinIO/S3 es necesario para guardar la imagen de firma.',
      );
    }
    const trimmed = this.normalizeSignatureHtml(html.trim());
    const payload: SignatureMeta = {
      html: trimmed,
      imageExt: ext,
      imageUrl: previewUrl,
      updatedAt: new Date().toISOString(),
    };
    await this.s3.putObjectToBucket(
      this.bucket,
      this.metaKey(userId),
      Buffer.from(JSON.stringify(payload), 'utf8'),
      'application/json',
    );
    return { html: trimmed, imageUrl: previewUrl };
  }
}
