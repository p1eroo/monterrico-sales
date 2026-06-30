import { Injectable, Logger } from '@nestjs/common';
import { ChatwootClient } from './chatwoot.client';
import type {
  ChatwootConversation,
  ChatwootConversationListItem,
  ChatwootMessage,
  ChatwootContact,
  ChatwootInbox,
  ChatwootAgent,
} from './chatwoot.types';

@Injectable()
export class ChatwootService {
  private readonly logger = new Logger(ChatwootService.name);

  constructor(private readonly client: ChatwootClient) {}

  getInboxId(): number {
    return this.client.getConfig().inboxId;
  }

  async listConversations(params?: {
    status?: string;
    q?: string;
    inbox_id?: number;
    page?: number;
  }): Promise<ChatwootConversationListItem[]> {
    return this.client.listConversations({
      inbox_id: params?.inbox_id ?? this.client.getConfig().inboxId,
      status: params?.status,
      q: params?.q,
      page: params?.page,
    });
  }

  async listMessages(
    conversationId: number,
    before?: number,
  ): Promise<ChatwootMessage[]> {
    return this.client.listMessages(conversationId, before);
  }

  async sendMessage(
    conversationId: number,
    content: string,
    templateParams?: {
      name: string;
      category: string;
      language: string;
      processed_params: Record<string, unknown>;
    },
  ): Promise<ChatwootMessage> {
    return this.client.sendMessage(conversationId, content, 'outgoing', templateParams);
  }

  async updateConversation(
    conversationId: number,
    data: { status?: string; assignee_id?: number },
  ) {
    if (data.assignee_id !== undefined) {
      return this.client.assignConversation(conversationId, data.assignee_id);
    }
    return this.client.updateConversation(conversationId, data);
  }

  async searchContacts(query: string): Promise<ChatwootContact[]> {
    const result = await this.client.searchContacts(query);
    return result.data ?? [];
  }



  async createContact(data: {
    name: string;
    phone_number?: string;
    email?: string;
  }): Promise<ChatwootContact> {
    const result = await this.client.createContact(data);
    return result.payload.contact;
  }

  async listInboxes(): Promise<ChatwootInbox[]> {
    return this.client.listInboxes();
  }

  async listAgents(): Promise<ChatwootAgent[]> {
    return this.client.listAgents();
  }

  async config() {
    return this.client.getConfig();
  }

  async createConversation(sourceId: string, message?: {
    content: string;
    template_params?: {
      name: string;
      category: string;
      language: string;
      processed_params: Record<string, unknown>;
    };
  }) {
    return this.client.createConversation(sourceId, this.client.getConfig().inboxId, message);
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
  ) {
    return this.client.sendTemplateMessage(conversationId, content, templateParams);
  }

  async initiateConversation(data: {
    name: string;
    phone: string;
    templateName?: string;
    templateCategory?: string;
    templateLanguage?: string;
    templateParams?: Record<string, unknown>;
    skipTemplate?: boolean;
  }): Promise<{ conversationId: number; contactId: number }> {
    this.logger.log(`initiateConversation: ${data.name} ${data.phone} skipTemplate=${data.skipTemplate}`);

    const cleanPhone = data.phone.replace(/\D/g, '');

    // 1. Crear o buscar contacto
    const e164Phone = data.phone.startsWith('+') ? data.phone : `+${cleanPhone}`;
    let contact: ChatwootContact | null = null;
    let contactId: number | null = null;
    try {
      contact = await this.createContact({ name: data.name, phone_number: e164Phone });
      contactId = contact.id;
      this.logger.log(`Contacto creado: id=${contactId}`);
    } catch (createErr) {
      const msg = createErr instanceof Error ? createErr.message : '';
      if (msg.includes('already been taken')) {
        this.logger.log('Contacto ya existe, buscando ID...');
        const queries = [cleanPhone, e164Phone, cleanPhone.slice(-9)];
        for (const q of queries) {
          try {
            const results = await this.searchContacts(q);
            const found = results.find((c) =>
              c.phone_number?.replace(/\D/g, '') === cleanPhone ||
              c.phone_number?.replace(/\D/g, '') === `51${cleanPhone.slice(-9)}`,
            );
            if (found) { contactId = found.id; break; }
          } catch { /* ignorar */ }
        }
      } else {
        throw createErr;
      }
    }

    // 2. Buscar conversación existente activa para este contacto
    let conversation: ChatwootConversation | null = null;
    async function findConversationByPhone(phone: string): Promise<ChatwootConversation | null> {
      const digits = phone.replace(/\D/g, '');
      const searchIn = (items: { meta?: { sender?: { phone_number?: string } }; status: string; id: number }[]) =>
        items.find((c) =>
          (c.status === 'open' || c.status === 'pending') &&
          c.meta?.sender?.phone_number?.replace(/\D/g, '') === digits,
        ) ?? null;
      // A) Por contacto directo
      if (contactId) {
        try {
          const existing = await this.client.listContactConversations(contactId);
          const found = searchIn(existing);
          if (found) return found as any;
        } catch { /* ignorar */ }
      }
      // B) Lista global de abiertas
      try {
        const all = await this.client.listConversations({ status: 'open' });
        const found = searchIn(all);
        if (found) return found as any;
      } catch { /* ignorar */ }
      // C) Búsqueda por query
      try {
        const byQ = await this.client.listConversations({ q: phone });
        const found = searchIn(byQ);
        if (found) return found as any;
      } catch { /* ignorar */ }
      return null;
    }
    conversation = await findConversationByPhone(cleanPhone);
    if (conversation) {
      this.logger.log(`Conversación existente encontrada: id=${conversation.id}`);
    }

    // 3. Si no hay conversación activa, crear una nueva
    if (!conversation) {
      this.logger.log(`Creando conversación source_id=${cleanPhone}`);
      conversation = await this.client.createConversation(cleanPhone, this.client.getConfig().inboxId);
      this.logger.log(`Conversación creada: id=${conversation.id}`);
    }

    // 3. Enviar template a la conversación solo si no se salta
    if (!data.skipTemplate && data.templateName && data.templateCategory) {
      this.logger.log(`Enviando template a conversation ${conversation.id}`);
      try {
        const templateContent = 'Hola estimado(a), reciba un cordial saludo de parte de Taxi Monterrico.\n\nHemos observado su interés en formar parte de nuestra flota. \n¿usted cuenta con vehiculo particular o tiene permiso de la ATU?';
        await this.client.sendTemplateMessage(conversation.id, templateContent, {
          name: data.templateName,
          category: data.templateCategory,
          language: data.templateLanguage ?? 'es_PE',
          processed_params: data.templateParams ?? {},
        });
        this.logger.log(`Template enviado a conversation ${conversation.id}`);
      } catch (e) {
        this.logger.error(`Error al enviar template: ${e instanceof Error ? e.message : e}`);
        throw e;
      }
    }

    return { conversationId: conversation.id, contactId: contact?.id ?? 0 };
  }

  async listTemplates() {
    return this.client.listTemplates();
  }
}
