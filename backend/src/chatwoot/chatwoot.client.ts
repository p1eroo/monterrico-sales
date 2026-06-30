import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ChatwootConfig,
  ChatwootConversation,
  ChatwootMessage,
  ChatwootContact,
  ChatwootInbox,
  ChatwootAgent,
  ChatwootConversationListItem,
  ChatwootCreateContactResponse,
} from './chatwoot.types';

@Injectable()
export class ChatwootClient {
  private config: ChatwootConfig;

  constructor(private configService: ConfigService) {
    this.config = {
      baseUrl: this.configService.get<string>('CHATWOOT_BASE_URL')!,
      accountId: this.configService.get<number>('CHATWOOT_ACCOUNT_ID')!,
      apiToken: this.configService.get<string>('CHATWOOT_API_TOKEN')!,
      inboxId: this.configService.get<number>('CHATWOOT_INBOX_ID')!,
    };
  }

  private apiUrl(path: string): string {
    return `${this.config.baseUrl}/api/v1/accounts/${this.config.accountId}${path}`;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'api_access_token': this.config.apiToken,
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.apiUrl(path), {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Chatwoot API error ${res.status}: ${text.slice(0, 200)}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  getConfig(): ChatwootConfig {
    return this.config;
  }

  async listConversations(params?: {
    status?: string;
    q?: string;
    inbox_id?: number;
    page?: number;
  }): Promise<ChatwootConversationListItem[]> {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.q) search.set('q', params.q);
    if (params?.inbox_id) search.set('inbox_id', String(params.inbox_id));
    if (params?.page) search.set('page', String(params.page));
    search.set('sort_by', 'latest');
    const raw = await this.request<any>(
      'GET',
      `/conversations?${search.toString()}`,
    );
    // Chatwoot API puede devolver varias estructuras:
    // { data: { payload: [...], meta: {...} } }  ← conversaciones
    // { data: [...], meta: {...} }
    // { payload: [...], meta: {...} }
    // o directamente un array
    if (Array.isArray(raw)) return raw as ChatwootConversationListItem[];
    // Caso común: { data: { payload: [...], meta: {...} } }
    if (raw?.data?.payload && Array.isArray(raw.data.payload)) return raw.data.payload as ChatwootConversationListItem[];
    if (raw?.data && Array.isArray(raw.data)) return raw.data as ChatwootConversationListItem[];
    if (raw?.payload && Array.isArray(raw.payload)) return raw.payload as ChatwootConversationListItem[];
    return [];
  }

  async getConversation(id: number): Promise<ChatwootConversation> {
    return this.request('GET', `/conversations/${id}`);
  }

  async listMessages(
    conversationId: number,
    before?: number,
  ): Promise<ChatwootMessage[]> {
    const search = before ? `?before=${before}` : '';
    const raw = await this.request<any>(
      'GET',
      `/conversations/${conversationId}/messages${search}`,
    );
    // Chatwoot puede devolver { data: [...], meta: {...} }, { payload: [...] }, o directamente un array
    if (Array.isArray(raw)) return raw as ChatwootMessage[];
    if (raw?.data && Array.isArray(raw.data)) return raw.data as ChatwootMessage[];
    if (raw?.payload && Array.isArray(raw.payload)) return raw.payload as ChatwootMessage[];
    return [];
  }

  async sendMessage(
    conversationId: number,
    content: string,
    messageType: 'outgoing' | 'incoming' = 'outgoing',
  ): Promise<ChatwootMessage> {
    return this.request('POST', `/conversations/${conversationId}/messages`, {
      content,
      message_type: messageType,
    });
  }

  async sendTemplateMessage(
    conversationId: number,
    content: string,
    templateParams: {
      name: string;
      category: string;
      language: string;
      processed_params: Record<string, unknown>;
    },
  ): Promise<ChatwootMessage> {
    return this.request('POST', `/conversations/${conversationId}/messages`, {
      content,
      message_type: 'outgoing',
      template_params: templateParams,
    });
  }

  async createConversation(
    sourceId: string,
    inboxId: number,
    message?: {
      content: string;
      template_params?: {
        name: string;
        category: string;
        language: string;
        processed_params: Record<string, unknown>;
      };
    },
  ): Promise<ChatwootConversation> {
    const body: Record<string, unknown> = {
      source_id: sourceId,
      inbox_id: inboxId,
    };
    if (message) {
      body.message = message;
    }
    return this.request('POST', '/conversations', body);
  }

  async sendAttachment(
    conversationId: number,
    fileUrl: string,
    fileType: string,
  ): Promise<ChatwootMessage> {
    return this.request('POST', `/conversations/${conversationId}/messages`, {
      content: '',
      message_type: 'outgoing',
      attachments: [{ file_url: fileUrl, file_type: fileType }],
    });
  }

  async uploadAttachment(
    conversationId: number,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    caption: string,
  ): Promise<ChatwootMessage> {
    const boundary = `----FormBoundary${Date.now()}`;
    let body = '';
    // attachments[]
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="attachments[]"; filename="${fileName}"\r\n`;
    body += `Content-Type: ${mimeType}\r\n\r\n`;
    body += fileBuffer.toString('binary');
    body += `\r\n--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="message_type"\r\n\r\n`;
    body += `outgoing\r\n`;
    if (caption) {
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="content"\r\n\r\n`;
      body += `${caption}\r\n`;
    }
    body += `--${boundary}--\r\n`;

    const url = this.apiUrl(`/conversations/${conversationId}/messages`);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'api_access_token': this.config.apiToken,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: Buffer.from(body, 'binary'),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Chatwoot upload error ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<ChatwootMessage>;
  }

  async updateConversation(
    conversationId: number,
    data: { status?: string },
  ): Promise<ChatwootConversation> {
    return this.request('PATCH', `/conversations/${conversationId}`, data);
  }

  async assignConversation(
    conversationId: number,
    assigneeId: number,
  ): Promise<{ id: number; name: string }> {
    return this.request('POST', `/conversations/${conversationId}/assignments`, {
      assignee_id: assigneeId,
    });
  }

  async toggleTyping(conversationId: number, typing: boolean): Promise<void> {
    return this.request(
      'POST',
      `/conversations/${conversationId}/toggle_typing`,
      { typing_status: typing ? 'on' : 'off' },
    );
  }

  async searchContacts(query: string): Promise<{ data: ChatwootContact[]; meta?: unknown }> {
    return this.request('GET', `/contacts/search?q=${encodeURIComponent(query)}`);
  }

  async createContact(data: {
    name: string;
    phone_number?: string;
    email?: string;
  }): Promise<ChatwootCreateContactResponse> {
    return this.request('POST', '/contacts', {
      inbox_id: this.config.inboxId,
      name: data.name,
      phone_number: data.phone_number,
      email: data.email,
    });
  }

  async updateContact(
    contactId: number,
    data: { name?: string; phone_number?: string; email?: string; custom_attributes?: Record<string, string> },
  ): Promise<{ payload: { contact: ChatwootContact } }> {
    return this.request('PUT', `/contacts/${contactId}`, data);
  }

  async listInboxes(): Promise<ChatwootInbox[]> {
    return this.request('GET', '/inboxes');
  }

  async listAgents(): Promise<ChatwootAgent[]> {
    return this.request('GET', '/agents');
  }

  async markAsRead(conversationId: number): Promise<void> {
    await this.request('POST', `/conversations/${conversationId}/update_last_seen`);
  }

  async getConversationAttachments(
    conversationId: number,
  ): Promise<Array<{ id: number; message_id: number; file_type: string; data_url?: string; thumb_url?: string }>> {
    const raw = await this.request<any>(
      'GET',
      `/conversations/${conversationId}/attachments`,
    );
    if (raw?.payload && Array.isArray(raw.payload)) return raw.payload;
    if (Array.isArray(raw)) return raw;
    return [];
  }

  async fetchMedia(url: string): Promise<{ buffer: Buffer; contentType: string }> {
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseUrl}${url}`;
    // Rails Active Storage devuelve 302 redirect a /rails/active_storage/disk/...
    // Seguimos los redirects manualmente para mantener el api_access_token
    let currentUrl = fullUrl;
    for (let i = 0; i < 5; i++) {
      const res = await fetch(currentUrl, {
        headers: this.headers(),
        redirect: 'manual',
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) throw new Error(`Chatwoot media redirect without location`);
        currentUrl = location.startsWith('http') ? location : `${this.config.baseUrl}${location}`;
        continue;
      }
      if (!res.ok) throw new Error(`Chatwoot media fetch error ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get('content-type') || 'application/octet-stream';
      return { buffer, contentType };
    }
    throw new Error('Chatwoot media fetch: too many redirects');
  }

  async listTemplates(): Promise<{ name: string; language: string; category: string }[]> {
    const inboxId = this.config.inboxId;
    // Intentar múltiples rutas posibles que Chatwoot pueda usar
    const routes = [
      `/inboxes/${inboxId}/whatsapp_templates`,
      `/whatsapp/${inboxId}/templates`,
    ];
    for (const route of routes) {
      try {
        const raw = await this.request<any>('GET', route);
        // Intentar extraer templates de diferentes formatos de respuesta
        const items = raw?.data ?? raw?.payload ?? raw ?? [];
        if (Array.isArray(items) && items.length > 0) {
          return items.map((t: any) => ({
            name: t.name ?? t.id ?? '',
            language: t.language ?? t.locale ?? '',
            category: t.category ?? '',
          }));
        }
        if (items?.length > 0) return items;
      } catch {
        // ruta no existe, probar siguiente
      }
    }
    return [];
  }
}
