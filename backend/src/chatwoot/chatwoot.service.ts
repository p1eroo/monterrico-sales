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
import {
  buildTemplateProcessedParams,
  isTemplateApiSendable,
  mergeWhatsappTemplateLists,
  normalizeTemplateLanguage,
  resolveWhatsappTemplate,
  type WhatsappTemplateDefinition,
} from './whatsapp-templates.catalog';

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

  private sortUnreadList(items: ChatwootConversationListItem[]) {
    return items.sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0));
  }

  /** Recolecta no leídos vía filter API paginada (rápido). Null = no soportado. */
  private async collectUnreadViaFilter(
    inboxId: number,
    maxPages = this.maxScanPages,
  ): Promise<ChatwootConversationListItem[] | null> {
    const unread: ChatwootConversationListItem[] = [];
    const seen = new Set<number>();

    for (let page = 1; page <= maxPages; page++) {
      const batch = await this.client.filterUnreadConversations({ inbox_id: inboxId, page });
      if (batch === null) return null;
      if (batch.length === 0) break;

      for (const c of batch) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          unread.push(c);
        }
      }

      if (batch.length < this.convPageSize) break;
    }

    return this.sortUnreadList(unread);
  }

  /** Escaneo completo de páginas (fallback cuando filter API no está disponible). */
  private async scanUnreadConversations(inboxId: number): Promise<ChatwootConversationListItem[]> {
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

    return this.sortUnreadList(unread);
  }

  /** Lista completa de no leídos: filter API primero, escaneo como fallback. */
  async listUnreadConversations(): Promise<ChatwootConversationListItem[]> {
    if (this.unreadScanInFlight) return this.unreadScanInFlight;

    const scan = (async () => {
      const inboxId = this.client.getConfig().inboxId;
      const viaFilter = await this.collectUnreadViaFilter(inboxId);
      if (viaFilter !== null) return viaFilter;
      return this.scanUnreadConversations(inboxId);
    })();

    this.unreadScanInFlight = scan;
    try {
      return await scan;
    } finally {
      this.unreadScanInFlight = null;
    }
  }

  /** Una página de no leídos (filter API) o slice del escaneo completo en caché. */
  async listUnreadConversationsPage(page: number): Promise<ChatwootConversationListItem[]> {
    const inboxId = this.client.getConfig().inboxId;
    const filtered = await this.client.filterUnreadConversations({ inbox_id: inboxId, page });

    if (filtered !== null) {
      return this.sortUnreadList(filtered);
    }

    const all = await this.getUnreadConversations({ force: false });
    const start = (page - 1) * this.convPageSize;
    return all.slice(start, start + this.convPageSize);
  }

  private buildUnreadSummary(items: ChatwootConversationListItem[]) {
    return {
      totalUnread: items.reduce((sum, c) => sum + (c.unread_count ?? 0), 0),
      conversationCount: items.length,
    };
  }

  /** Lista de no leídos con cache compartida (badge + pestaña). */
  async getUnreadConversations(options?: {
    force?: boolean;
    page?: number;
  }): Promise<ChatwootConversationListItem[]> {
    const force = options?.force ?? false;
    const page = options?.page;

    if (page) {
      if (force) this.invalidateUnreadCache();
      return this.listUnreadConversationsPage(page);
    }

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
    if (force) this.invalidateUnreadCache();

    if (
      !force
      && this.unreadCache
      && Date.now() - this.unreadCache.at < this.unreadCacheTtlMs
    ) {
      return this.unreadCache.summary;
    }

    const items = await this.getUnreadConversations({ force });
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
    const as = stored.replace(/\D/g, '').slice(-9);
    const bs = targetSuffix.replace(/\D/g, '').slice(-9);
    return as.length >= 3 && bs.length >= 3 && as === bs;
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
      matched.forEach(addConv);
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

  /**
   * Resolución rápida (estilo Chatwoot UI): vínculo en BD → contacto por teléfono → historial del contacto.
   * Sin escaneo de páginas del inbox.
   */
  async findConversationForPhoneQuick(
    phone: string,
    contactId?: number | null,
  ): Promise<ChatwootConversationListItem | null> {
    const phoneSuffix = this.normalizePhoneSuffix(phone);
    const digits = phone.replace(/\D/g, '');
    if (phoneSuffix.length < 9 && digits.length < 9) return null;

    const candidates: Array<ChatwootConversationListItem | ChatwootConversation> = [];
    const seen = new Set<number>();

    const addFromContact = (c: ChatwootConversationListItem | ChatwootConversation | null | undefined) => {
      if (!c?.id || seen.has(c.id)) return;
      seen.add(c.id);
      candidates.push(c);
    };

    const addIfPhoneMatch = (c: ChatwootConversationListItem | ChatwootConversation | null | undefined) => {
      if (!c?.id || seen.has(c.id)) return;
      const senderPhone = c.meta?.sender?.phone_number;
      if (!senderPhone || !phoneSuffix || !this.phonesMatch(senderPhone, phoneSuffix)) return;
      seen.add(c.id);
      candidates.push(c);
    };

    const suffix = phoneSuffix || digits.slice(-9);
    let linkedContactId = contactId ?? null;

    if (suffix.length >= 9) {
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
            addIfPhoneMatch(await this.client.getConversation(prospecto.chatwootConversationId));
          } catch { /* ignorar */ }
        }
        if (!linkedContactId && prospecto?.chatwootContactId) {
          linkedContactId = prospecto.chatwootContactId;
        }
      } catch { /* ignorar */ }
    }

    if (linkedContactId) {
      try {
        const convs = await this.getContactConversations(linkedContactId);
        convs.forEach(addFromContact);
      } catch { /* ignorar */ }
    }

    if (candidates.length === 0 && phoneSuffix.length >= 9) {
      const contactQueries = [
        phoneSuffix,
        digits,
        phone.startsWith('+') ? phone : `+${digits}`,
      ].filter((q, i, arr) => q.length >= 9 && arr.indexOf(q) === i);

      for (const q of contactQueries) {
        try {
          const contacts = await this.searchContacts(q);
          const match = contacts.find((c) =>
            this.phonesMatch(c.phone_number, phoneSuffix),
          );
          if (!match?.id) continue;
          const convs = await this.getContactConversations(match.id);
          const pool = convs.filter((c) =>
            this.phonesMatch(c.meta?.sender?.phone_number, phoneSuffix),
          );
          pool.forEach(addFromContact);
          if (candidates.length > 0) break;
        } catch { /* ignorar */ }
      }
    }

    const best = this.pickBestConversation(candidates);
    return best as ChatwootConversationListItem | null;
  }

  /** Escaneo profundo del inbox (backfill / reconciliación; no usar en clics de UI). */
  async findConversationForPhoneDeep(
    phone: string,
    contactId?: number | null,
  ): Promise<ChatwootConversationListItem | null> {
    const phoneSuffix = this.normalizePhoneSuffix(phone);
    const digits = phone.replace(/\D/g, '');
    if (!phoneSuffix && !digits) return null;

    const inboxId = this.client.getConfig().inboxId;
    const candidates: Array<ChatwootConversationListItem | ChatwootConversation> = [];
    const seen = new Set<number>();

    const addFromContact = (c: ChatwootConversationListItem | ChatwootConversation | null | undefined) => {
      if (!c?.id || seen.has(c.id)) return;
      seen.add(c.id);
      candidates.push(c);
    };

    const addIfPhoneMatch = (c: ChatwootConversationListItem | ChatwootConversation | null | undefined) => {
      if (!c?.id || seen.has(c.id)) return;
      const senderPhone = c.meta?.sender?.phone_number;
      if (!senderPhone || !phoneSuffix || !this.phonesMatch(senderPhone, phoneSuffix)) return;
      seen.add(c.id);
      candidates.push(c);
    };

    if (contactId) {
      try {
        const convs = await this.client.listContactConversations(contactId);
        const pool = phoneSuffix
          ? convs.filter((c) =>
              this.phonesMatch(c.meta?.sender?.phone_number, phoneSuffix),
            )
          : convs;
        pool.forEach(addFromContact);
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
          items.forEach(addIfPhoneMatch);
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
          batch.forEach(addIfPhoneMatch);
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
            addIfPhoneMatch(await this.client.getConversation(prospecto.chatwootConversationId));
          } catch { /* ignorar */ }
        }
        if (prospecto?.chatwootContactId) {
          try {
            const convs = await this.client.listContactConversations(prospecto.chatwootContactId);
            const pool = phoneSuffix
              ? convs.filter((c) =>
                  this.phonesMatch(c.meta?.sender?.phone_number, phoneSuffix),
                )
              : convs;
            pool.forEach(addFromContact);
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
    options?: { deep?: boolean },
  ): Promise<ChatwootConversationListItem | null> {
    if (options?.deep) {
      return this.findConversationForPhoneDeep(phone, contactId);
    }
    return this.findConversationForPhoneQuick(phone, contactId);
  }

  /** Alias: resolución rápida por defecto. */
  async findConversationForPhone(
    phone: string,
    contactId?: number | null,
  ): Promise<ChatwootConversationListItem | null> {
    return this.findConversationForPhoneQuick(phone, contactId);
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
    let resolvedContent = content;
    let resolvedParams = templateParams;
    if (templateParams) {
      if (!isTemplateApiSendable(templateParams.name)) {
        throw new Error(
          `La plantilla "${templateParams.name}" usa WhatsApp Flow y no puede enviarse desde esta app. Envíala desde Chatwoot directamente.`,
        );
      }
      const catalog = resolveWhatsappTemplate(templateParams.name);
      const processed =
        templateParams.processed_params && Object.keys(templateParams.processed_params).length > 0
          ? templateParams.processed_params
          : catalog
            ? buildTemplateProcessedParams(catalog)
            : {};
      resolvedParams = {
        ...templateParams,
        category: templateParams.category || catalog?.category || 'UTILITY',
        language: normalizeTemplateLanguage(
          templateParams.language || catalog?.language || 'es_pe',
        ),
        processed_params: processed,
      };
      if (!resolvedContent.trim()) {
        resolvedContent = catalog?.content ?? resolvedContent;
      }
    }
    const message = await this.client.sendMessage(
      conversationId,
      resolvedContent,
      'outgoing',
      resolvedParams,
    );
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

  async createConversation(
    sourceId: string,
    message?: {
      content: string;
      template_params?: {
        name: string;
        category: string;
        language: string;
        processed_params: Record<string, unknown>;
      };
    },
    contactId?: number,
  ) {
    return this.client.createConversation(sourceId, this.client.getConfig().inboxId, {
      contactId,
      message,
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
  ) {
    return this.client.sendTemplateMessage(conversationId, content, templateParams);
  }

  async listContacts(page?: number, q?: string): Promise<ChatwootContact[]> {
    return this.client.listContacts({ page, q });
  }

  /** Busca chatwootContactId en BD del prospecto o vía API de Chatwoot. */
  private async resolveContactIdForPhone(
    cleanPhone: string,
    e164Phone: string,
  ): Promise<number | null> {
    const suffix = cleanPhone.slice(-9);
    if (suffix.length < 9) return null;

    try {
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
        const dbId = Number(prospecto.chatwootContactId);
        const contact = await this.client.getContact(dbId);
        if (contact && this.phonesMatch(contact.phone_number, suffix)) {
          return dbId;
        }
        this.logger.warn(`chatwootContactId en BD inválido para ${suffix}: ${dbId}`);
      }
    } catch { /* ignorar */ }

    const queries = [cleanPhone, e164Phone, suffix, `+${suffix}`];
    for (const q of queries) {
      if (!q || q.length < 9) continue;
      try {
        const results = await this.searchContacts(q);
        const found = results.find((c) =>
          this.phonesMatch(c.phone_number, suffix),
        );
        if (found) return found.id;
      } catch { /* ignorar */ }
    }
    return null;
  }

  /**
   * Obtiene o crea el contact_inbox en el inbox Flota y devuelve el source_id
   * que Chatwoot exige para abrir la conversación.
   */
  private async ensureContactInboxForFlota(
    contactId: number,
    preferredSourceId: string,
  ): Promise<string> {
    const inboxId = this.client.getConfig().inboxId;

    const fromContactable = async (): Promise<string | null> => {
      try {
        const items = await this.client.getContactableInboxes(contactId);
        const match = items.find((ci) => ci.inbox_id === inboxId);
        return match?.source_id?.trim() || null;
      } catch (e) {
        this.logger.warn(
          `contactable_inboxes contactId=${contactId}: ${e instanceof Error ? e.message : e}`,
        );
        return null;
      }
    };

    const existing = await fromContactable();
    if (existing) {
      this.logger.log(`contact_inbox existente: contactId=${contactId} source_id=${existing}`);
      return existing;
    }

    try {
      const created = await this.client.createContactInbox(contactId, preferredSourceId);
      const sourceId = created.source_id || preferredSourceId;
      this.logger.log(`contact_inbox creado: contactId=${contactId} source_id=${sourceId}`);
      return sourceId;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/already|taken|exist|duplicate|422|409/i.test(msg)) {
        const retry = await fromContactable();
        if (retry) return retry;
      }
      throw e;
    }
  }

  /**
   * Busca conversación existente en inbox Flota antes de crear una nueva.
   * Con contactId conocido confía en el historial del contacto (ya filtrado por inbox).
   */
  private async findExistingConversationForInitiate(
    phone: string,
    contactId: number | null,
  ): Promise<ChatwootConversationListItem | ChatwootConversation | null> {
    if (contactId) {
      const fromContact = this.pickBestConversation(await this.getContactConversations(contactId));
      if (fromContact) return fromContact;
    }
    return this.findConversationForPhoneQuick(phone, contactId);
  }

  private async createConversationForPhone(
    cleanPhone: string,
    contactId: number | null,
    e164Phone: string,
  ): Promise<{ conversation: ChatwootConversation; contactId: number | null }> {
    const inboxId = this.client.getConfig().inboxId;
    let resolvedContactId = contactId;
    let sourceId = cleanPhone;

    const tryCreate = async (sid: string, cid: number | null) =>
      this.client.createConversation(sid, inboxId, {
        contactId: cid ?? undefined,
      });

    if (resolvedContactId) {
      sourceId = await this.ensureContactInboxForFlota(resolvedContactId, cleanPhone);
    }

    try {
      const conversation = await tryCreate(sourceId, resolvedContactId);
      return { conversation, contactId: resolvedContactId };
    } catch (err) {
      if (!resolvedContactId) {
        resolvedContactId = await this.resolveContactIdForPhone(cleanPhone, e164Phone);
      }
      if (!resolvedContactId) throw err;

      this.logger.warn(
        `createConversation falló (${err instanceof Error ? err.message : err}); ` +
          `asegurando contact_inbox contactId=${resolvedContactId}`,
      );
      sourceId = await this.ensureContactInboxForFlota(resolvedContactId, cleanPhone);
      const conversation = await tryCreate(sourceId, resolvedContactId);
      return { conversation, contactId: resolvedContactId };
    }
  }

  async initiateConversation(data: {
    name: string;
    phone: string;
    contactId?: number;
    templateName?: string;
    templateCategory?: string;
    templateLanguage?: string;
    templateContent?: string;
    templateParams?: Record<string, unknown>;
    skipTemplate?: boolean;
    operador?: string;
    sender?: { userId: string; name: string };
  }): Promise<{ conversationId: number; contactId: number; isNew: boolean }> {
    this.logger.log(`initiateConversation: ${data.name} ${data.phone} contactId=${data.contactId ?? '—'} skipTemplate=${data.skipTemplate}`);

    const cleanPhone = data.phone.replace(/\D/g, '');

    // 1. Crear o buscar contacto
    const e164Phone = data.phone.startsWith('+') ? data.phone : `+${cleanPhone}`;
    let contact: ChatwootContact | null = null;
    let contactId: number | null = data.contactId ?? null;

    if (contactId) {
      this.logger.log(`Usando contactId provisto: ${contactId}`);
    } else {
      try {
        contact = await this.createContact({ name: data.name, phone_number: e164Phone });
        contactId = contact.id;
        this.logger.log(`Contacto creado: id=${contactId}`);
      } catch (createErr) {
        const msg = createErr instanceof Error ? createErr.message : '';
        if (msg.includes('already been taken')) {
          this.logger.log('Contacto ya existe, buscando ID...');
          contactId = await this.resolveContactIdForPhone(cleanPhone, e164Phone);
          if (contactId) {
            this.logger.log(`ID encontrado: ${contactId}`);
          }
        } else {
          throw createErr;
        }
      }
    }

    // 2. Buscar conversación existente en inbox Flota (historial del contacto / prospecto / teléfono)
    let conversation: ChatwootConversation | null = null;
    let foundExisting = false;
    const existingConv = await this.findExistingConversationForInitiate(data.phone, contactId);
    if (existingConv) {
      conversation = existingConv as ChatwootConversation;
      foundExisting = true;
      this.logger.log(`Conversación existente encontrada: id=${conversation.id} status=${conversation.status}`);
    }

    // 3. Si no hay conversación activa, crear una nueva (con contact_inbox si el contacto ya existía)
    if (!conversation) {
      this.logger.log(`Creando conversación source_id=${cleanPhone} contactId=${contactId ?? '—'}`);
      const created = await this.createConversationForPhone(cleanPhone, contactId, e164Phone);
      conversation = created.conversation;
      contactId = created.contactId ?? contactId;
      this.logger.log(`Conversación creada: id=${conversation.id}`);
    }

    // Vincular prospecto con la conversación
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
        }
      } catch (e) {
        this.logger.warn(`Error vinculando prospecto/conversación: ${e instanceof Error ? e.message : e}`);
      }
    }

    // 5. Enviar template a la conversación solo si no se salta
    let templateSent = false;
    if (!data.skipTemplate && data.templateName) {
      if (!isTemplateApiSendable(data.templateName)) {
        throw new Error(
          `La plantilla "${data.templateName}" usa WhatsApp Flow y no puede enviarse desde esta app. Envíala desde Chatwoot directamente.`,
        );
      }
      this.logger.log(`Enviando template a conversation ${conversation.id}`);
      try {
        const catalog = resolveWhatsappTemplate(data.templateName);
        const templateContent =
          data.templateContent?.trim() || catalog?.content || '';
        const templateCategory =
          data.templateCategory || catalog?.category || 'UTILITY';
        const templateLanguage = normalizeTemplateLanguage(
          data.templateLanguage || catalog?.language || 'es_pe',
        );
        const processedParams =
          data.templateParams && Object.keys(data.templateParams).length > 0
            ? data.templateParams
            : catalog
              ? buildTemplateProcessedParams(catalog)
              : {};
        await this.client.sendTemplateMessage(conversation.id, templateContent, {
          name: data.templateName,
          category: templateCategory,
          language: templateLanguage,
          processed_params: processedParams,
        });
        templateSent = true;
        this.logger.log(`Template enviado a conversation ${conversation.id}`);
      } catch (e) {
        this.logger.error(`Error al enviar template: ${e instanceof Error ? e.message : e}`);
        throw e;
      }
    }

    if (templateSent && data.sender) {
      const prospecto = await this.operadorSync.findProspectoForConversation(
        conversation.id,
        data.phone,
      );
      if (prospecto) {
        await this.operadorSync.assignOnFirstOutbound({
          prospectoId: prospecto.id,
          conversationId: conversation.id,
          senderUserId: data.sender.userId,
          senderUserName: data.sender.name,
        });
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
