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
  private agentsCache: { data: ChatwootAgent[]; timestamp: number } | null = null;
  private readonly AGENTS_CACHE_TTL = 5 * 60 * 1000;

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

  private extractConversationList(raw: unknown): ChatwootConversationListItem[] {
    if (Array.isArray(raw)) return raw as ChatwootConversationListItem[];
    const r = raw as Record<string, unknown>;
    if (r?.data && typeof r.data === 'object') {
      const data = r.data as Record<string, unknown>;
      if (Array.isArray(data.payload)) return data.payload as ChatwootConversationListItem[];
      if (Array.isArray(data)) return data as ChatwootConversationListItem[];
    }
    if (Array.isArray(r?.payload)) return r.payload as ChatwootConversationListItem[];
    return [];
  }

  async listConversations(params?: {
    status?: string;
    q?: string;
    inbox_id?: number;
    page?: number;
    sort_by?: 'latest' | 'unread' | 'last_activity_at_desc';
  }): Promise<ChatwootConversationListItem[]> {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.q) search.set('q', params.q);
    if (params?.inbox_id) search.set('inbox_id', String(params.inbox_id));
    if (params?.page) search.set('page', String(params.page));
    search.set('sort_by', params?.sort_by ?? 'latest');
    const raw = await this.request<unknown>(
      'GET',
      `/conversations?${search.toString()}`,
    );
    return this.extractConversationList(raw);
  }

  async searchConversations(q: string, page = 1): Promise<ChatwootConversationListItem[]> {
    try {
      const raw = await this.request<unknown>(
        'GET',
        `/search/conversations?q=${encodeURIComponent(q)}&page=${page}`,
      );
      return this.extractConversationList(raw);
    } catch {
      return [];
    }
  }

  async getConversation(id: number): Promise<ChatwootConversation> {
    return this.request('GET', `/conversations/${id}`);
  }

  async listContactConversations(contactId: number): Promise<ChatwootConversationListItem[]> {
    const raw = await this.request<any>('GET', `/contacts/${contactId}/conversations`);
    if (Array.isArray(raw)) return raw as ChatwootConversationListItem[];
    if (raw?.data?.payload && Array.isArray(raw.data.payload)) return raw.data.payload as ChatwootConversationListItem[];
    if (raw?.payload && Array.isArray(raw.payload)) return raw.payload as ChatwootConversationListItem[];
    return [];
  }

  async listContacts(params?: {
    page?: number;
    q?: string;
  }): Promise<ChatwootContact[]> {
    const extract = (items: any[]) => {
      if (!Array.isArray(items)) return null;
      return items.map((c: any) => ({
        id: c.id,
        name: c.name,
        phone_number: c.phone_number,
        email: c.email,
        thumbnail: c.thumbnail,
        identifier: c.identifier ?? '',
        additional_attributes: c.additional_attributes ?? {},
        custom_attributes: c.custom_attributes ?? {},
      })) as unknown as ChatwootContact[];
    };
    // Si hay búsqueda, usar endpoint de search
    if (params?.q) {
      const raw = await this.request<any>('GET', `/contacts/search?q=${encodeURIComponent(params.q)}`);
      return extract(raw?.data?.payload) ?? extract(raw?.data) ?? extract(raw?.payload) ?? extract(raw) ?? [];
    }
    // Listado normal con paginación
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    const raw = await this.request<any>('GET', `/contacts?${search.toString()}`);
    return extract(raw?.payload) ?? extract(raw?.data) ?? extract(raw) ?? [];
  }

  async createContactInbox(contactId: number): Promise<void> {
    await this.request('POST', `/contacts/${contactId}/inboxes`, {
      inbox_id: this.config.inboxId,
    });
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
    templateParams?: {
      name: string;
      category: string;
      language: string;
      processed_params: Record<string, unknown>;
    },
  ): Promise<ChatwootMessage> {
    const body: Record<string, unknown> = {
      content,
      message_type: messageType,
    };
    if (templateParams) {
      body.template_params = templateParams;
    }
    return this.request('POST', `/conversations/${conversationId}/messages`, body);
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
    if (this.agentsCache && Date.now() - this.agentsCache.timestamp < this.AGENTS_CACHE_TTL) {
      return this.agentsCache.data;
    }
    const data = await this.request<ChatwootAgent[]>('GET', '/agents');
    this.agentsCache = { data, timestamp: Date.now() };
    return data;
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

  async listTemplates(): Promise<{ name: string; language: string; category: string; content?: string }[]> {
    const inboxId = this.config.inboxId;
    const routes = [
      `/inboxes/${inboxId}/whatsapp_templates`,
      `/inboxes/${inboxId}/whatsapp_templates?page=1`,
      `/inboxes/${inboxId}/message_templates`,
      `/inboxes/${inboxId}/templates`,
      `/whatsapp/${inboxId}/templates`,
    ];
    const fallbackContent = 'Hola estimado(a), reciba un cordial saludo de parte de Taxi Monterrico.\n\nHemos observado su interés en formar parte de nuestra flota. \n¿usted cuenta con vehiculo particular o tiene permiso de la ATU?';
    for (const route of routes) {
      try {
        const raw = await this.request<any>('GET', route);
        const extract = (items: any[]) => {
          if (!Array.isArray(items) || items.length === 0) return null;
          return items.map((t: any) => {
            // Extraer texto del body desde components
            const bodyComponent = t.components?.find((c: any) => c.type === 'BODY');
            return {
              name: t.name ?? t.id ?? '',
              language: t.language ?? t.locale ?? '',
              category: t.category ?? '',
              content: bodyComponent?.text ?? bodyComponent?.content ?? fallbackContent,
            };
          });
        };
        let result =
          extract(raw?.data?.payload) ??
          extract(raw?.data?.data) ??
          extract(raw?.data) ??
          extract(raw?.payload) ??
          extract(raw);
        if (result && result.length > 0) return result;
      } catch {
        // probar siguiente ruta
      }
    }
    return [];
  }
}
