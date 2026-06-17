import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface FacebookFormResponse {
  id: string;
  name: string;
  locale?: string;
  status?: string;
}

interface FacebookLeadResponse {
  id: string;
  created_time: string;
  ad_id?: string;
  ad_name?: string;
  field_data: Array<{ name: string; values: string[] }>;
}

interface FacebookFormsListResponse {
  data: FacebookFormResponse[];
  paging?: { cursors?: { before?: string; after?: string }; next?: string };
}

interface FacebookLeadsListResponse {
  data: FacebookLeadResponse[];
  paging?: { cursors?: { before?: string; after?: string }; next?: string };
}

@Injectable()
export class FacebookGraphApiService {
  private readonly logger = new Logger(FacebookGraphApiService.name);
  private readonly baseUrl = 'https://graph.facebook.com';

  constructor(private readonly config: ConfigService) {}

  private getApiVersion(): string {
    return this.config.get<string>('FACEBOOK_GRAPH_API_VERSION', 'v22.0');
  }

  private async fetchFromGraph<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Graph API error ${res.status}: ${text.slice(0, 500)}`);
      throw new ServiceUnavailableException(`Facebook API responded ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  async validateToken(inputToken: string): Promise<{ is_valid: boolean; expires_at?: number; data_access_expires_at?: number }> {
    const appSecret = this.config.get<string>('FACEBOOK_APP_SECRET');
    const appId = this.config.get<string>('FACEBOOK_APP_ID');
    if (!appSecret || !appId) {
      throw new ServiceUnavailableException('FACEBOOK_APP_ID y FACEBOOK_APP_SECRET requeridos');
    }
    const appToken = `${appId}|${appSecret}`;
    const version = this.getApiVersion();
    const url = `${this.baseUrl}/${version}/debug_token?input_token=${encodeURIComponent(inputToken)}&access_token=${encodeURIComponent(appToken)}`;
    const result = await this.fetchFromGraph<{ data: { is_valid: boolean; expires_at?: number; data_access_expires_at?: number } }>(url);
    return result.data;
  }

  async getPageForms(pageId: string, accessToken: string): Promise<FacebookFormResponse[]> {
    const version = this.getApiVersion();
    const url = `${this.baseUrl}/${version}/${pageId}/leadgen_forms?access_token=${encodeURIComponent(accessToken)}&fields=id,name,locale,status`;
    const result = await this.fetchFromGraph<FacebookFormsListResponse>(url);
    return result.data || [];
  }

  async getFormLeads(formId: string, accessToken: string, since?: string): Promise<FacebookLeadResponse[]> {
    const version = this.getApiVersion();
    let url = `${this.baseUrl}/${version}/${formId}/leads?access_token=${encodeURIComponent(accessToken)}&fields=id,created_time,ad_id,ad_name,field_data`;
    if (since) {
      url += `&since=${since}`;
    }
    const allLeads: FacebookLeadResponse[] = [];
    let nextUrl: string | undefined = url;
    while (nextUrl) {
      const result = await this.fetchFromGraph<FacebookLeadsListResponse>(nextUrl);
      if (result.data) allLeads.push(...result.data);
      nextUrl = result.paging?.next;
    }
    return allLeads;
  }

  async getLeadDetails(leadgenId: string, accessToken: string): Promise<FacebookLeadResponse> {
    const version = this.getApiVersion();
    const url = `${this.baseUrl}/${version}/${leadgenId}?access_token=${encodeURIComponent(accessToken)}&fields=id,created_time,ad_id,ad_name,field_data`;
    return this.fetchFromGraph<FacebookLeadResponse>(url);
  }
}
