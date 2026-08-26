import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MetaTemplateComponent {
  type: string;
  format?: string;
  text?: string;
  buttons?: unknown[];
  example?: Record<string, unknown>;
}

export interface MetaMessageTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  parameter_format?: string;
  quality_score?: { score?: string };
  rejected_reason?: string;
  components?: MetaTemplateComponent[];
}

interface MetaPagingResponse<T> {
  data: T[];
  paging?: { cursors?: { after?: string }; next?: string };
}

export interface MetaPhoneNumberInfo {
  display_phone_number?: string;
  verified_name?: string;
  id?: string;
}

export interface MetaSendMessageResponse {
  messaging_product?: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
}

export interface MetaGraphError {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

@Injectable()
export class MetaGraphApiService {
  private readonly logger = new Logger(MetaGraphApiService.name);
  private readonly baseUrl = 'https://graph.facebook.com';

  constructor(private readonly config: ConfigService) {}

  private resolveVersion(version?: string): string {
    return version?.trim() || this.config.get<string>('FACEBOOK_GRAPH_API_VERSION', 'v22.0');
  }

  private async graphRequest<T>(
    path: string,
    accessToken: string,
    options: { method?: string; body?: unknown; version?: string } = {},
  ): Promise<T> {
    const version = this.resolveVersion(options.version);
    const url = `${this.baseUrl}/${version}${path}`;
    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${accessToken}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await res.text();
    let parsed: T & MetaGraphError = {} as T & MetaGraphError;
    try {
      parsed = JSON.parse(text) as T & MetaGraphError;
    } catch {
      this.logger.error(`Graph API invalid JSON ${res.status}: ${text.slice(0, 300)}`);
      throw new ServiceUnavailableException(`Meta API respondió ${res.status}`);
    }

    if (!res.ok) {
      const msg = parsed.error?.message ?? `Meta API respondió ${res.status}`;
      this.logger.error(`Graph API error ${res.status}: ${text.slice(0, 500)}`);
      throw new ServiceUnavailableException(msg);
    }

    return parsed;
  }

  async validateToken(accessToken: string, version?: string): Promise<{ is_valid: boolean }> {
    const appSecret = this.config.get<string>('FACEBOOK_APP_SECRET');
    const appId = this.config.get<string>('FACEBOOK_APP_ID');
    if (!appSecret || !appId) {
      return { is_valid: true };
    }
    const appToken = `${appId}|${appSecret}`;
    const v = this.resolveVersion(version);
    const url = `${this.baseUrl}/${v}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      return { is_valid: false };
    }
    const result = (await res.json()) as { data?: { is_valid?: boolean } };
    return { is_valid: result.data?.is_valid === true };
  }

  async getPhoneNumber(
    phoneNumberId: string,
    accessToken: string,
    version?: string,
  ): Promise<MetaPhoneNumberInfo> {
    return this.graphRequest<MetaPhoneNumberInfo>(
      `/${phoneNumberId}?fields=display_phone_number,verified_name`,
      accessToken,
      { version },
    );
  }

  async getMessageTemplates(
    wabaId: string,
    accessToken: string,
    version?: string,
  ): Promise<MetaMessageTemplate[]> {
    const all: MetaMessageTemplate[] = [];
    const versionStr = this.resolveVersion(version);
    const base = `${this.baseUrl}/${versionStr}`;
    let nextUrl: string | null =
      `/${wabaId}/message_templates?limit=100&fields=id,name,language,status,category,parameter_format,quality_score,rejected_reason,components`;

    while (nextUrl) {
      const fullUrl = nextUrl.startsWith('http') ? nextUrl : `${base}${nextUrl}`;
      const res = await fetch(fullUrl, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      });
      const text = await res.text();
      let parsed: MetaPagingResponse<MetaMessageTemplate> & MetaGraphError = { data: [] };
      try {
        parsed = JSON.parse(text) as MetaPagingResponse<MetaMessageTemplate> & MetaGraphError;
      } catch {
        throw new ServiceUnavailableException(`Meta API respondió ${res.status}`);
      }
      if (!res.ok) {
        throw new ServiceUnavailableException(parsed.error?.message ?? `Meta API respondió ${res.status}`);
      }
      all.push(...(parsed.data ?? []));
      nextUrl = parsed.paging?.next ?? null;
    }

    return all;
  }

  async sendTemplateMessage(
    phoneNumberId: string,
    accessToken: string,
    payload: {
      to: string;
      templateName: string;
      languageCode: string;
      components?: Array<{
        type: string;
        parameters?: Array<{
          type: string;
          text?: string;
          parameter_name?: string;
        }>;
      }>;
    },
    version?: string,
  ): Promise<MetaSendMessageResponse> {
    return this.graphRequest<MetaSendMessageResponse>(
      `/${phoneNumberId}/messages`,
      accessToken,
      {
        method: 'POST',
        version,
        body: {
          messaging_product: 'whatsapp',
          to: payload.to,
          type: 'template',
          template: {
            name: payload.templateName,
            language: { code: payload.languageCode },
            ...(payload.components?.length ? { components: payload.components } : {}),
          },
        },
      },
    );
  }
}
