import { Injectable, Logger } from '@nestjs/common';
import { ChatwootClient } from './chatwoot.client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatwootOperadorSyncService } from './chatwoot-operador-sync.service';
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

  constructor(
    private readonly client: ChatwootClient,
    private readonly prisma: PrismaService,
    private readonly operadorSync: ChatwootOperadorSyncService,
  ) {}

  getInboxId(): number {
    return this.client.getConfig().inboxId;
  }

  private readonly convPageSize = 25;
  private readonly maxScanPages = 40;

  async listConversations(params?: {
    status?: string;
    q?: string;
    inbox_id?: number;
    page?: number;
    sort_by?: 'latest' | 'unread' | 'last_activity_at_desc';
  }): Promise<ChatwootConversationListItem[]> {
    return this.client.listConversations({
      inbox_id: params?.inbox_id ?? this.client.getConfig().inboxId,
      status: params?.status,
      q: params?.q,
      page: params?.page,
      sort_by: params?.sort_by,
    });
  }

  /** Escanea páginas de Chatwoot y devuelve solo conversaciones con mensajes no leídos. */
  async listUnreadConversations(): Promise<ChatwootConversationListItem[]> {
    const inboxId = this.client.getConfig().inboxId;
    const unread: ChatwootConversationListItem[] = [];
    const seen = new Set<number>();

    for (let page = 1; page <= this.maxScanPages; page++) {
      const batch = await this.client.listConversations({
        inbox_id: inboxId,
        page,
        sort_by: 'unread',
      });
      if (batch.length === 0) break;
      for (const c of batch) {
        if ((c.unread_count ?? 0) > 0 && !seen.has(c.id)) {
          seen.add(c.id);
          unread.push(c);
        }
      }
      if (batch.length < this.convPageSize) break;
    }

    return unread.sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0));
  }

  async getUnreadSummary(): Promise<{ totalUnread: number; conversationCount: number }> {
    const unread = await this.listUnreadConversations();
    return {
      totalUnread: unread.reduce((sum, c) => sum + (c.unread_count ?? 0), 0),
      conversationCount: unread.length,
    };
  }

  /** Búsqueda global por teléfono, nombre o contenido — no limitada a páginas cargadas. */
  async searchConversations(query: string): Promise<ChatwootConversationListItem[]> {
    const q = query.trim();
    if (!q) return [];

    const inboxId = this.client.getConfig().inboxId;
    const results: ChatwootConversationListItem[] = [];
    const seenIds = new Set<number>();

    const addConv = (c: ChatwootConversationListItem | ChatwootConversation | null | undefined) => {
      if (!c?.id || seenIds.has(c.id)) return;
      if (c.inbox_id && c.inbox_id !== inboxId) return;
      seenIds.add(c.id);
      results.push(c as ChatwootConversationListItem);
    };

    try {
      const fromSearch = await this.client.searchConversations(q);
      fromSearch.forEach(addConv);
    } catch (e) {
      this.logger.warn(`search/conversations falló: ${e instanceof Error ? e.message : e}`);
    }

    try {
      const contacts = await this.client.listContacts({ q });
      for (const contact of contacts.slice(0, 15)) {
        const convs = await this.client.listContactConversations(contact.id);
        convs.forEach(addConv);
      }
    } catch (e) {
      this.logger.warn(`contacts/search falló: ${e instanceof Error ? e.message : e}`);
    }

    const digits = q.replace(/\D/g, '');
    if (digits.length >= 7) {
      const suffix = digits.slice(-9);
      const prospecto = await this.prisma.flotaProspecto.findFirst({
        where: {
          OR: [
            { celular: { endsWith: suffix } },
            { movil: { endsWith: suffix } },
            { celular: { contains: digits } },
            { movil: { contains: digits } },
          ],
          chatwootConversationId: { not: null },
        },
        select: { chatwootConversationId: true },
      });
      if (prospecto?.chatwootConversationId) {
        try {
          const conv = await this.client.getConversation(prospecto.chatwootConversationId);
          addConv(conv);
        } catch { /* ignorar */ }
      }
    }

    const qLower = q.toLowerCase();
    if (results.length === 0) {
      try {
        const fromMessages = await this.client.listConversations({ q, page: 1, inbox_id: inboxId });
        fromMessages.forEach(addConv);
      } catch { /* ignorar */ }
    }

    return results
      .sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0));
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
    sender?: { userId: string; name: string },
  ): Promise<ChatwootMessage> {
    const message = await this.client.sendMessage(conversationId, content, 'outgoing', templateParams);
    if (sender) {
      const prospecto = await this.operadorSync.findProspectoForConversation(conversationId);
      if (prospecto) {
        await this.operadorSync.assignOnFirstOutbound({
          prospectoId: prospecto.id,
          conversationId,
          senderUserId: sender.userId,
          senderUserName: sender.name,
        });
      }
    }
    return message;
  }

  async updateConversation(
    conversationId: number,
    data: { status?: string; assignee_id?: number },
  ) {
    let result;
    if (data.assignee_id !== undefined) {
      result = await this.client.assignConversation(conversationId, data.assignee_id);
      await this.operadorSync.syncOperadorFromConversation(
        conversationId,
        undefined,
        undefined,
        data.assignee_id,
      );
    } else {
      result = await this.client.updateConversation(conversationId, data);
    }
    return result;
  }

  async searchContacts(query: string): Promise<ChatwootContact[]> {
    const result = await this.client.searchContacts(query);
    const items = (result as any)?.data?.payload ?? result?.data ?? (result as any)?.payload ?? result;
    return Array.isArray(items) ? items : [];
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

  async listContacts(page?: number, q?: string): Promise<ChatwootContact[]> {
    return this.client.listContacts({ page, q });
  }

  async initiateConversation(data: {
    name: string;
    phone: string;
    templateName?: string;
    templateCategory?: string;
    templateLanguage?: string;
    templateParams?: Record<string, unknown>;
    skipTemplate?: boolean;
    operador?: string;
  }): Promise<{ conversationId: number; contactId: number; isNew: boolean }> {
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
        // Buscar en nuestra base de datos primero (chatwootContactId)
        try {
          const prospecto = await this.prisma.flotaProspecto.findFirst({
            where: {
              OR: [
                { celular: { endsWith: cleanPhone } },
                { movil: { endsWith: cleanPhone } },
              ],
              chatwootContactId: { not: null },
            },
            select: { chatwootContactId: true },
          });
          if (prospecto?.chatwootContactId) {
            contactId = Number(prospecto.chatwootContactId);
            this.logger.log(`ID encontrado en DB: ${contactId}`);
          }
        } catch { /* ignorar */ }
        // Fallback: buscar en Chatwoot API
        if (!contactId) {
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
        }
      } else {
        throw createErr;
      }
    }

    // 2. Buscar conversación existente activa
    let conversation: ChatwootConversation | null = null;
    let foundExisting = false;
    if (contactId) {
      try {
        const existing = await this.client.listContactConversations(contactId);
        const digits = cleanPhone.replace(/\D/g, '');
        const found = existing.find((c) =>
          (c.status === 'open' || c.status === 'pending') &&
          c.meta?.sender?.phone_number?.replace(/\D/g, '') === digits,
        );
        if (found) { conversation = found as any; foundExisting = true; }
      } catch { /* ignorar */ }
    }
    // Fallback: buscar por teléfono si no tenemos contactId
    if (!conversation && !contactId) {
      try {
        let page = 1;
        let items = await this.client.listConversations({ status: 'open', page });
        const digits = cleanPhone.replace(/\D/g, '');
        while (items.length > 0) {
          const found = items.find((c) =>
            (c.status === 'open' || c.status === 'pending') &&
            c.meta?.sender?.phone_number?.replace(/\D/g, '') === digits,
          );
          if (found) { conversation = found as any; foundExisting = true; break; }
          page++;
          items = await this.client.listConversations({ status: 'open', page });
        }
      } catch { /* ignorar */ }
    }
    if (conversation) {
      this.logger.log(`Conversación existente encontrada: id=${conversation.id}`);
    }

    // 3. Si no hay conversación activa, crear una nueva
    if (!conversation) {
      this.logger.log(`Creando conversación source_id=${cleanPhone}`);
      try {
        conversation = await this.client.createConversation(cleanPhone, this.client.getConfig().inboxId);
      } catch (err) {
        // Si el contacto no tiene contact_inbox, crearlo y reintentar
        if (contactId && err instanceof Error && err.message.includes('404')) {
          this.logger.log('Creando contact_inbox y reintentando...');
          await this.client.createContactInbox(contactId);
          conversation = await this.client.createConversation(cleanPhone, this.client.getConfig().inboxId);
        } else {
          throw err;
        }
      }
      this.logger.log(`Conversación creada: id=${conversation.id}`);
    }

    // Vincular prospecto con la conversación y sincronizar operador ↔ agente
    if (conversation) {
      try {
        const prospecto = await this.prisma.flotaProspecto.findFirst({
          where: {
            OR: [
              { celular: { endsWith: cleanPhone.slice(-9) } },
              { movil: { endsWith: cleanPhone.slice(-9) } },
            ],
          },
        });
        if (prospecto) {
          await this.prisma.flotaProspecto.update({
            where: { id: prospecto.id },
            data: {
              chatwootConversationId: conversation.id,
              chatwootContactId: contactId ?? prospecto.chatwootContactId,
            },
          });
          if (data.operador) {
            await this.operadorSync.syncAssigneeFromOperador(prospecto.id, data.operador);
          }
        } else if (data.operador) {
          const agent = await this.operadorSync.findAgentForOperador(data.operador);
          if (agent) {
            await this.client.assignConversation(conversation.id, agent.id);
            this.logger.log(`Conversación asignada a agente: ${agent.name} (id=${agent.id})`);
          }
        }
      } catch (e) {
        this.logger.warn(`Error sincronizando operador/agente: ${e instanceof Error ? e.message : e}`);
      }
    }

    // 5. Enviar template a la conversación solo si no se salta
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

    return { conversationId: conversation.id, contactId: contact?.id ?? 0, isNew: !foundExisting };
  }

  async listTemplates() {
    return this.client.listTemplates();
  }

  async syncOperadorFromConversation(conversationId: number, phone?: string) {
    return this.operadorSync.syncOperadorFromConversation(conversationId, phone);
  }
}
