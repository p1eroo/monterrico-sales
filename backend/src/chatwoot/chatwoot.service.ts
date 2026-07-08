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
  private readonly unreadCacheTtlMs = 90_000;
  private unreadCache: {
    items: ChatwootConversationListItem[];
    summary: { totalUnread: number; conversationCount: number };
    at: number;
  } | null = null;
  private unreadScanInFlight: Promise<ChatwootConversationListItem[]> | null = null;

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
    if (this.unreadScanInFlight) return this.unreadScanInFlight;

    const scan = (async () => {
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

        let pageHadUnread = false;
        for (const c of batch) {
          if ((c.unread_count ?? 0) > 0 && !seen.has(c.id)) {
            seen.add(c.id);
            unread.push(c);
            pageHadUnread = true;
          }
        }

        if (batch.length < this.convPageSize) break;
        if (page > 1 && !pageHadUnread) break;
      }

      return unread.sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0));
    })();

    this.unreadScanInFlight = scan;
    try {
      return await scan;
    } finally {
      this.unreadScanInFlight = null;
    }
  }

  private buildUnreadSummary(items: ChatwootConversationListItem[]) {
    return {
      totalUnread: items.reduce((sum, c) => sum + (c.unread_count ?? 0), 0),
      conversationCount: items.length,
    };
  }

  /** Lista completa de no leídos con cache compartida (badge + pestaña). */
  async getUnreadConversations(force = false): Promise<ChatwootConversationListItem[]> {
    if (
      !force
      && this.unreadCache
      && Date.now() - this.unreadCache.at < this.unreadCacheTtlMs
    ) {
      return this.unreadCache.items;
    }

    const items = await this.listUnreadConversations();
    this.unreadCache = {
      items,
      summary: this.buildUnreadSummary(items),
      at: Date.now(),
    };
    return items;
  }

  async getUnreadSummary(force = false): Promise<{ totalUnread: number; conversationCount: number }> {
    if (
      !force
      && this.unreadCache
      && Date.now() - this.unreadCache.at < this.unreadCacheTtlMs
    ) {
      return this.unreadCache.summary;
    }

    const items = await this.getUnreadConversations(force);
    return this.unreadCache?.summary ?? this.buildUnreadSummary(items);
  }

  invalidateUnreadCache(): void {
    this.unreadCache = null;
  }

  private normalizePhoneSuffix(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return digits.slice(-9) || digits;
  }

  private phonesMatch(stored: string | null | undefined, targetSuffix: string): boolean {
    if (!stored || !targetSuffix) return false;
    const a = stored.replace(/\D/g, '');
    const b = targetSuffix.replace(/\D/g, '');
    const as = a.slice(-9);
    const bs = b.slice(-9);
    return as === bs || a.endsWith(bs) || b.endsWith(as) || a.includes(bs) || b.includes(as);
  }

  private async addConversationsFromContact(
    contactId: number,
    phoneSuffix: string,
    addConv: (c: ChatwootConversationListItem | ChatwootConversation | null | undefined) => void,
  ): Promise<void> {
    try {
      const convs = await this.client.listContactConversations(contactId);
      const matched = phoneSuffix
        ? convs.filter((c) => this.phonesMatch(c.meta?.sender?.phone_number, phoneSuffix))
        : convs;
      (matched.length > 0 ? matched : convs).forEach(addConv);
    } catch { /* ignorar */ }
  }

  private pickBestConversation(
    items: Array<ChatwootConversationListItem | ChatwootConversation>,
    strictInbox = true,
  ): ChatwootConversationListItem | ChatwootConversation | null {
    if (items.length === 0) return null;
    const inboxId = this.client.getConfig().inboxId;
    const normalized = items.map((c) => ({
      ...c,
      last_activity_at: c.last_activity_at ?? (c as { timestamp?: number }).timestamp ?? 0,
    }));
    const filtered = strictInbox
      ? normalized.filter((c) => !c.inbox_id || Number(c.inbox_id) === inboxId)
      : normalized;
    if (filtered.length === 0 && strictInbox) {
      return this.pickBestConversation(items, false);
    }
    if (filtered.length === 0) return null;
    const active = filtered.filter((c) => c.status === 'open' || c.status === 'pending');
    const pool = active.length > 0 ? active : filtered;
    return [...pool].sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0))[0];
  }

  /** Busca la mejor conversación para un teléfono (open/pending primero, luego resolved). */
  async findConversationForPhone(
    phone: string,
    contactId?: number | null,
  ): Promise<ChatwootConversationListItem | null> {
    const phoneSuffix = this.normalizePhoneSuffix(phone);
    const digits = phone.replace(/\D/g, '');
    if (!phoneSuffix && !digits) return null;

    const inboxId = this.client.getConfig().inboxId;
    const candidates: Array<ChatwootConversationListItem | ChatwootConversation> = [];
    const seen = new Set<number>();

    const addTrusted = (c: ChatwootConversationListItem | ChatwootConversation | null | undefined) => {
      if (!c?.id || seen.has(c.id)) return;
      seen.add(c.id);
      candidates.push(c);
    };

    const addIfPhoneMatch = (c: ChatwootConversationListItem | ChatwootConversation | null | undefined) => {
      if (!c?.id || seen.has(c.id)) return;
      const senderPhone = c.meta?.sender?.phone_number;
      if (phoneSuffix && senderPhone && !this.phonesMatch(senderPhone, phoneSuffix)) return;
      seen.add(c.id);
      candidates.push(c);
    };

    if (contactId) {
      try {
        const convs = await this.client.listContactConversations(contactId);
        convs.forEach(addTrusted);
      } catch { /* ignorar */ }
    }

    const searchQueries = [
      digits,
      phoneSuffix,
      digits.slice(-9),
      phone.startsWith('+') ? phone : `+${digits}`,
    ].filter((q, i, arr) => q.length >= 3 && arr.indexOf(q) === i);

    for (const q of searchQueries) {
      try {
        let page = 1;
        let items = await this.client.searchConversations(q, page);
        while (items.length > 0) {
          items.forEach(addTrusted);
          if (items.length < this.convPageSize) break;
          page++;
          items = await this.client.searchConversations(q, page);
        }
      } catch { /* ignorar */ }
    }

    for (const q of searchQueries) {
      try {
        for (let page = 1; page <= 5; page++) {
          const batch = await this.client.listConversations({ q, page, inbox_id: inboxId });
          if (batch.length === 0) break;
          batch.forEach(addTrusted);
          if (batch.length < this.convPageSize) break;
        }
      } catch { /* ignorar */ }
    }

    if (phoneSuffix) {
      for (const status of ['open', 'resolved', 'pending', 'snoozed'] as const) {
        try {
          for (let page = 1; page <= this.maxScanPages; page++) {
            const batch = await this.client.listConversations({ status, page, inbox_id: inboxId });
            if (batch.length === 0) break;
            for (const c of batch) {
              if (this.phonesMatch(c.meta?.sender?.phone_number, phoneSuffix)) addIfPhoneMatch(c);
            }
            if (batch.length < this.convPageSize) break;
          }
        } catch { /* ignorar */ }
      }

      try {
        for (let page = 1; page <= this.maxScanPages; page++) {
          const batch = await this.client.listConversations({ page, inbox_id: inboxId });
          if (batch.length === 0) break;
          for (const c of batch) {
            if (this.phonesMatch(c.meta?.sender?.phone_number, phoneSuffix)) addIfPhoneMatch(c);
          }
          if (batch.length < this.convPageSize) break;
        }
      } catch { /* ignorar */ }
    }

    const suffix = phoneSuffix || digits.slice(-9);
    if (suffix.length >= 3) {
      try {
        const prospecto = await this.prisma.flotaProspecto.findFirst({
          where: {
            eliminadoAt: null,
            OR: [
              { celular: { endsWith: suffix } },
              { movil: { endsWith: suffix } },
            ],
          },
          select: { chatwootConversationId: true, chatwootContactId: true },
        });
        if (prospecto?.chatwootConversationId) {
          try {
            addTrusted(await this.client.getConversation(prospecto.chatwootConversationId));
          } catch { /* ignorar */ }
        }
        if (prospecto?.chatwootContactId) {
          try {
            const convs = await this.client.listContactConversations(prospecto.chatwootContactId);
            convs.forEach(addTrusted);
          } catch { /* ignorar */ }
        }
      } catch { /* ignorar */ }
    }

    const best = this.pickBestConversation(candidates);
    return best as ChatwootConversationListItem | null;
  }

  async resolveConversation(
    phone: string,
    contactId?: number,
  ): Promise<ChatwootConversationListItem | null> {
    if (contactId) {
      const convs = await this.getContactConversations(contactId);
      const best = this.pickBestConversation(convs);
      if (best) return best as ChatwootConversationListItem;
    }
    return this.findConversationForPhone(phone, contactId);
  }

  /** Historial de conversaciones de un contacto en el inbox de Flota. */
  async getContactConversations(contactId: number): Promise<ChatwootConversationListItem[]> {
    const inboxId = this.client.getConfig().inboxId;
    const convs = await this.client.listContactConversations(contactId);
    const normalized = convs.map((c) => ({
      ...c,
      last_activity_at: c.last_activity_at ?? (c as { timestamp?: number }).timestamp ?? 0,
    }));
    const filtered = normalized.filter((c) => !c.inbox_id || Number(c.inbox_id) === inboxId);
    return (filtered.length > 0 ? filtered : normalized)
      .sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0));
  }

  /** Búsqueda por prospectos en BD (nombre/teléfono) → conversaciones vinculadas en Chatwoot. */
  async searchConversations(query: string): Promise<ChatwootConversationListItem[]> {
    const q = query.trim();
    if (!q || q.length < 2) return [];

    const inboxId = this.client.getConfig().inboxId;
    const phoneSuffix = this.normalizePhoneSuffix(q);
    const digits = q.replace(/\D/g, '');
    const results: ChatwootConversationListItem[] = [];
    const seenIds = new Set<number>();
    const seenContactIds = new Set<number>();

    const addConv = (c: ChatwootConversationListItem | ChatwootConversation | null | undefined) => {
      if (!c?.id || seenIds.has(c.id)) return;
      if (c.inbox_id && Number(c.inbox_id) !== inboxId) return;
      seenIds.add(c.id);
      results.push(c as ChatwootConversationListItem);
    };

    // Búsqueda directa en Chatwoot API
    const searchQueries = [q, digits, phoneSuffix]
      .filter((term, i, arr) => term.length >= 2 && arr.indexOf(term) === i);
    for (const term of searchQueries) {
      try {
        let page = 1;
        let items = await this.client.searchConversations(term, page);
        while (items.length > 0) {
          items.forEach(addConv);
          if (items.length < this.convPageSize) break;
          page++;
          items = await this.client.searchConversations(term, page);
        }
      } catch { /* ignorar */ }
    }

    const matchConditions: Array<Record<string, unknown>> = [
      { nombreCompleto: { contains: q, mode: 'insensitive' } },
    ];
    if (digits.length >= 3) {
      matchConditions.push(
        { celular: { contains: digits } },
        { movil: { contains: digits } },
      );
    }
    if (phoneSuffix.length >= 3 && phoneSuffix !== digits) {
      matchConditions.push(
        { celular: { endsWith: phoneSuffix } },
        { movil: { endsWith: phoneSuffix } },
      );
    }

    const prospectos = await this.prisma.flotaProspecto.findMany({
      where: {
        eliminadoAt: null,
        AND: [
          { OR: matchConditions },
          {
            OR: [
              { chatwootConversationId: { not: null } },
              { chatwootContactId: { not: null } },
            ],
          },
        ],
      },
      select: {
        chatwootConversationId: true,
        chatwootContactId: true,
      },
      take: 25,
    });

    await Promise.all(prospectos.map(async (p) => {
      if (p.chatwootConversationId) {
        try {
          addConv(await this.client.getConversation(p.chatwootConversationId));
        } catch { /* ignorar */ }
      }
      if (p.chatwootContactId && !seenContactIds.has(p.chatwootContactId)) {
        seenContactIds.add(p.chatwootContactId);
        await this.addConversationsFromContact(p.chatwootContactId, phoneSuffix, addConv);
      }
    }));

    return results.sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0));
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
          const suffix = cleanPhone.slice(-9);
          const prospecto = await this.prisma.flotaProspecto.findFirst({
            where: {
              OR: [
                { celular: { endsWith: suffix } },
                { movil: { endsWith: suffix } },
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
          const suffix = cleanPhone.slice(-9);
          const queries = [cleanPhone, e164Phone, suffix];
          for (const q of queries) {
            try {
              const results = await this.searchContacts(q);
              const found = results.find((c) =>
                this.phonesMatch(c.phone_number, suffix),
              );
              if (found) { contactId = found.id; break; }
            } catch { /* ignorar */ }
          }
        }
      } else {
        throw createErr;
      }
    }

    // 2. Buscar conversación existente (open, pending o resolved)
    let conversation: ChatwootConversation | null = null;
    let foundExisting = false;
    const existingConv = await this.findConversationForPhone(data.phone, contactId);
    if (existingConv) {
      conversation = existingConv as ChatwootConversation;
      foundExisting = true;
      this.logger.log(`Conversación existente encontrada: id=${conversation.id} status=${conversation.status}`);
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

    return { conversationId: conversation.id, contactId: contactId ?? contact?.id ?? 0, isNew: !foundExisting };
  }

  async listTemplates() {
    return this.client.listTemplates();
  }

  async syncOperadorFromConversation(conversationId: number, phone?: string) {
    return this.operadorSync.syncOperadorFromConversation(conversationId, phone);
  }
}
