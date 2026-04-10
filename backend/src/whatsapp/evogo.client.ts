import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type EvogoSendTextResult = {
  ok: boolean;
  status: number;
  raw: unknown;
  /** Si Evolution devolvió identificador útil en data */
  waMessageId?: string;
};

@Injectable()
export class EvogoClient {
  private readonly logger = new Logger(EvogoClient.name);

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    const raw =
      this.config.get<string>('EVOGO_BASE_URL')?.trim() ||
      'https://evogo.taximonterrico.com';
    return raw.replace(/\/$/, '');
  }

  /**
   * Evolution GO autentica rutas de instancia con el header `apikey`
   * igual al **token de la instancia** (no la GLOBAL_API_KEY).
   */
  async sendText(params: {
    instanceApiKey: string;
    number: string;
    text: string;
  }): Promise<EvogoSendTextResult> {
    const url = `${this.baseUrl()}/send/text`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: params.instanceApiKey,
      },
      body: JSON.stringify({
        number: params.number,
        text: params.text,
      }),
    });

    let raw: unknown = null;
    const textBody = await res.text();
    try {
      raw = textBody ? JSON.parse(textBody) : null;
    } catch {
      raw = { rawBody: textBody };
    }

    if (!res.ok) {
      this.logger.warn(`Evogo sendText HTTP ${res.status}: ${textBody.slice(0, 500)}`);
      return { ok: false, status: res.status, raw };
    }

    const waMessageId = this.tryExtractMessageId(raw);
    return { ok: true, status: res.status, raw, waMessageId };
  }

  private tryExtractMessageId(raw: unknown): string | undefined {
    const o = raw as Record<string, unknown> | null;
    const data = o?.['data'];
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      const info = d['Info'] ?? d['info'];
      if (info && typeof info === 'object') {
        const id = (info as Record<string, unknown>)['ID'] ??
          (info as Record<string, unknown>)['Id'];
        if (typeof id === 'string') return id;
      }
    }
    return undefined;
  }
}
