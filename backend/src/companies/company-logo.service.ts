import { Injectable } from '@nestjs/common';
import { S3StorageService } from '../files/s3-storage.service';
import { PrismaService } from '../prisma/prisma.service';

const LOGO_PREFIX = 'logos/';
const LOGO_BUCKET = 'crm-avatar';
const DUCKDUCKGO_URL = 'https://icons.duckduckgo.com/ip3';

async function fetchImage(url: string): Promise<{ body: Buffer; contentType: string } | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length < 100) return null;
    const contentType = response.headers.get('content-type') || 'image/png';
    return { body: buffer, contentType };
  } catch {
    return null;
  }
}

@Injectable()
export class CompanyLogoService {
  constructor(
    private readonly s3: S3StorageService,
    private readonly prisma: PrismaService,
  ) {}

  async getLogo(companyId: string): Promise<{ body: Buffer; contentType: string } | null> {
    // 1. Try S3 cache in crm-avatar bucket (por companyId, compatibilidad)
    if (this.s3.isConfigured()) {
      const cached = await this.s3.getObjectFromBucket(LOGO_BUCKET, `${LOGO_PREFIX}${companyId}.png`);
      if (cached) {
        const chunks: Buffer[] = [];
        for await (const chunk of cached.body) {
          chunks.push(chunk);
        }
        return { body: Buffer.concat(chunks), contentType: cached.contentType };
      }
    }

    // 2. Get domain de la empresa y delegar a la resolución por dominio
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { domain: true },
    });
    if (!company?.domain) return null;

    return this.getLogoByDomain(company.domain);
  }

  /**
   * Resuelve el logo de un dominio (ej. "bbva.com.pe"). Cachea en MinIO por
   * dominio para reutilizarlo entre empresas y remitentes de correo.
   */
  async getLogoByDomain(rawDomain: string): Promise<{ body: Buffer; contentType: string } | null> {
    const domain = this.extractDomain(rawDomain);
    if (!domain) return null;

    const cacheKey = `${LOGO_PREFIX}domains/${domain}.png`;

    // 1. Cache en MinIO por dominio
    if (this.s3.isConfigured()) {
      const cached = await this.s3.getObjectFromBucket(LOGO_BUCKET, cacheKey);
      if (cached) {
        const chunks: Buffer[] = [];
        for await (const chunk of cached.body) {
          chunks.push(chunk);
        }
        return { body: Buffer.concat(chunks), contentType: cached.contentType };
      }
    }

    // 2. Descargar de DuckDuckGo
    const result = await fetchImage(`${DUCKDUCKGO_URL}/${domain}.ico`);
    if (!result) return null;

    // 3. Guardar en MinIO
    try {
      await this.s3.putObjectToBucket(LOGO_BUCKET, cacheKey, result.body, result.contentType);
    } catch (err) {
      console.error('Error saving logo to Minio:', err);
    }

    return result;
  }

  private extractDomain(domain: string): string | null {
    try {
      const d = domain.startsWith('http') ? domain : `https://${domain}`;
      return new URL(d).hostname;
    } catch {
      return null;
    }
  }
}
