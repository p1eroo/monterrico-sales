import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatwootClient } from './chatwoot.client';
import { FlotaProspectosGateway } from '../flota-prospectos/flota-prospectos.gateway';
import type { ChatwootAgent } from './chatwoot.types';

export interface OperadorUser {
  id: string;
  name: string;
  username: string;
}

function limaDate(): Date {
  const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  return new Date(dateStr + 'T00:00:00.000Z');
}

function limaDateFromUnix(unixSeconds: number): Date {
  const d = new Date(unixSeconds * 1000);
  const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  return new Date(dateStr + 'T00:00:00.000Z');
}

@Injectable()
export class ChatwootOperadorSyncService {
  private readonly logger = new Logger(ChatwootOperadorSyncService.name);
  private operadoresCache: OperadorUser[] | null = null;
  private operadoresCacheAt = 0;
  private readonly cacheTtlMs = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: ChatwootClient,
    private readonly prospectosGateway: FlotaProspectosGateway,
  ) {}

  async listOperadores(): Promise<OperadorUser[]> {
    if (this.operadoresCache && Date.now() - this.operadoresCacheAt < this.cacheTtlMs) {
      return this.operadoresCache;
    }
    const rows = await this.prisma.user.findMany({
      where: {
        status: 'activo',
        role: { slug: 'operador' },
      },
      include: {
        accounts: { select: { provider: true, providerId: true } },
      },
    });
    this.operadoresCache = rows.map((r) => {
      const cred = r.accounts.find((a) => a.provider === 'credentials');
      return {
        id: r.id,
        name: r.name,
        username: cred?.providerId ?? '',
      };
    });
    this.operadoresCacheAt = Date.now();
    return this.operadoresCache;
  }

  /** Resuelve un nombre crudo al nombre canónico de un operador activo, o null si no aplica. */
  resolveOperadorName(
    value: string | null | undefined,
    operadores?: OperadorUser[],
  ): string | null {
    if (!value?.trim()) return null;
    const ops = operadores ?? this.operadoresCache ?? [];
    const v = value.trim().toLowerCase();

    let match = ops.find((op) => op.username?.toLowerCase() === v);
    if (match) return match.name;

    match = ops.find((op) => op.name.toLowerCase() === v);
    if (match) return match.name;

    const firstNameMatches = ops.filter((op) => {
      const first = op.name.toLowerCase().split(' ')[0];
      return first === v;
    });
    if (firstNameMatches.length === 1) return firstNameMatches[0].name;

    if (v.length >= 3) {
      const partial = ops.filter((op) => {
        const u = op.username?.toLowerCase();
        return u && (u.startsWith(v) || v.startsWith(u));
      });
      if (partial.length === 1) return partial[0].name;
    }

    const fragmentMatch = ops.filter((op) => {
      const opLower = op.name.toLowerCase();
      const opParts = opLower.split(/\s+/).filter(Boolean);
      const opNorm = opLower.replace(/\s+/g, '');
      const vNorm = v.replace(/\s+/g, '');
      return (
        opNorm.startsWith(vNorm) || vNorm.startsWith(opNorm)
        || opNorm.includes(vNorm) || vNorm.includes(opNorm)
        || opParts.some((p) => v.length >= 3 && v.includes(p))
        || opParts.some((p) => p.length >= 3 && p.includes(v))
      );
    });
    if (fragmentMatch.length === 1) return fragmentMatch[0].name;

    return null;
  }

  /** true si el nombre no corresponde a un operador activo (ej. "Soporte"). */
  isInvalidOperadorName(
    value: string | null | undefined,
    operadores?: OperadorUser[],
  ): boolean {
    if (!value?.trim()) return false;
    return !this.resolveOperadorName(value, operadores);
  }

  private extractConversationMeta(
    raw: unknown,
  ): {
    assignee?: { id: number; name: string };
    sender?: { id?: number; phone_number?: string; name?: string };
  } | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const r = raw as Record<string, unknown>;
    const payload = (r.payload ?? r.data ?? raw) as {
      meta?: {
        assignee?: { id: number; name: string };
        sender?: { id?: number; phone_number?: string; name?: string };
      };
      contact_inbox?: { source_id?: string };
    };
    return payload?.meta
      ? {
          ...payload.meta,
          sender: payload.meta.sender ?? (
            payload.contact_inbox?.source_id
              ? { phone_number: payload.contact_inbox.source_id }
              : undefined
          ),
        }
      : undefined;
  }

  /** Teléfono del contacto desde payload Chatwoot (webhook o API). */
  extractPhoneFromConversation(raw: unknown): string | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const r = raw as Record<string, unknown>;
    const payload = (r.payload ?? r.data ?? raw) as {
      meta?: { sender?: { phone_number?: string } };
      contact_inbox?: { source_id?: string };
    };
    const phone = payload?.meta?.sender?.phone_number
      ?? payload?.contact_inbox?.source_id;
    return phone?.trim() || undefined;
  }

  operadoresAreSame(
    a: string | null | undefined,
    b: string | null | undefined,
    operadores?: OperadorUser[],
  ): boolean {
    const ops = operadores ?? this.operadoresCache ?? [];
    const canonA = a?.trim() ? this.resolveOperadorName(a, ops) ?? a.trim() : null;
    const canonB = b?.trim() ? this.resolveOperadorName(b, ops) ?? b.trim() : null;
    if (!canonA && !canonB) return true;
    if (!canonA || !canonB) return false;
    return canonA.toLowerCase() === canonB.toLowerCase();
  }

  async findAgentForOperador(
    operadorName: string,
    agents?: ChatwootAgent[],
  ): Promise<ChatwootAgent | null> {
    const ops = await this.listOperadores();
    const canonical = this.resolveOperadorName(operadorName, ops);
    if (!canonical) return null;

    const agentList = agents ?? await this.client.listAgents();
    return agentList.find((agent) => {
      const agentCanon = this.resolveOperadorName(agent.name, ops);
      return (
        agentCanon?.toLowerCase() === canonical.toLowerCase()
        || agent.name.toLowerCase().trim() === canonical.toLowerCase().trim()
      );
    }) ?? null;
  }

  /**
   * Fecha de asignación desde mensaje de actividad Chatwoot
   * (ej. "Asignado a Paul Medrano por Soporte").
   */
  private async inferAsignadoAtFromChatwoot(
    conversationId: number,
    canonicalOperador: string,
  ): Promise<Date | null> {
    const operadorLower = canonicalOperador.toLowerCase().trim();
    const firstName = operadorLower.split(/\s+/)[0] ?? '';
    let before: number | undefined;
    let bestTs: number | null = null;

    try {
      for (let i = 0; i < 12; i++) {
        const batch = await this.client.listMessages(conversationId, before);
        if (!batch.length) break;

        for (const msg of batch) {
          const mt = msg.message_type;
          if (mt !== 2) continue;
          const content = String(msg.content ?? '').toLowerCase();
          if (!content.includes('asignado')) continue;
          const matches = content.includes(operadorLower)
            || (firstName.length >= 3 && content.includes(firstName));
          if (!matches) continue;
          const ts = typeof msg.created_at === 'number' ? msg.created_at : null;
          if (ts != null && (bestTs === null || ts > bestTs)) bestTs = ts;
        }

        if (batch.length < 15) break;
        before = Math.min(...batch.map((m) => m.id));
      }
    } catch (e) {
      this.logger.warn(
        `No se pudo inferir asignadoAt conv ${conversationId}: ${e instanceof Error ? e.message : e}`,
      );
      return null;
    }

    return bestTs != null ? limaDateFromUnix(bestTs) : null;
  }

  private async resolveAsignadoAt(
    conversationId: number | undefined,
    canonicalOperador: string,
    existing: { operador: string | null; asignadoAt: Date | null },
    ops: OperadorUser[],
  ): Promise<Date> {
    const fixingInvalid = this.isInvalidOperadorName(existing.operador, ops);
    if (fixingInvalid && existing.asignadoAt) {
      return existing.asignadoAt;
    }

    if (conversationId) {
      const inferred = await this.inferAsignadoAtFromChatwoot(conversationId, canonicalOperador);
      if (inferred) return inferred;
    }

    return limaDate();
  }

  async findProspectoForConversation(
    conversationId: number,
    phone?: string,
  ) {
    let prospecto = await this.prisma.flotaProspecto.findFirst({
      where: { chatwootConversationId: conversationId, eliminadoAt: null },
    });
    if (!prospecto && phone) {
      const cleaned = phone.replace(/\D/g, '').slice(-9);
      if (cleaned) {
        prospecto = await this.prisma.flotaProspecto.findFirst({
          where: {
            eliminadoAt: null,
            OR: [
              { celular: { endsWith: cleaned } },
              { movil: { endsWith: cleaned } },
              { celular: { contains: cleaned } },
              { movil: { contains: cleaned } },
            ],
          },
        });
      }
    }
    return prospecto;
  }

  /**
   * Chatwoot assignee → prospecto.operador
   * Solo escribe si el assignee corresponde a un operador real del sistema.
   */
  async syncOperadorFromAssignee(
    prospectoId: string,
    assignee: { id?: number; name?: string } | null | undefined,
    assigneeId?: number,
    conversationId?: number,
  ): Promise<{ updated: boolean; operador: string | null }> {
    const ops = await this.listOperadores();
    let canonicalOperador: string | null = null;

    if (assignee?.name) {
      canonicalOperador = this.resolveOperadorName(assignee.name, ops);
    } else if (assigneeId) {
      try {
        const agents = await this.client.listAgents();
        const agent = agents.find((a) => a.id === assigneeId);
        if (agent) canonicalOperador = this.resolveOperadorName(agent.name, ops);
      } catch (e) {
        this.logger.warn(`No se pudo resolver agente ${assigneeId}: ${e instanceof Error ? e.message : e}`);
      }
    }

    if (!canonicalOperador) {
      return { updated: false, operador: null };
    }

    const existing = await this.prisma.flotaProspecto.findUnique({
      where: { id: prospectoId },
      select: { operador: true, asignadoAt: true },
    });
    if (!existing) return { updated: false, operador: null };

    if (this.operadoresAreSame(existing.operador, canonicalOperador, ops)) {
      return { updated: false, operador: canonicalOperador };
    }

    const asignadoAt = await this.resolveAsignadoAt(
      conversationId,
      canonicalOperador,
      existing,
      ops,
    );

    await this.prisma.flotaProspecto.update({
      where: { id: prospectoId },
      data: { operador: canonicalOperador, asignadoAt },
    });

    this.logger.log(`Operador sincronizado prospecto ${prospectoId}: ${existing.operador ?? '—'} → ${canonicalOperador}`);
    this.prospectosGateway.emitChange('operador_assigned', prospectoId);
    return { updated: true, operador: canonicalOperador };
  }

  /** prospecto.operador → Chatwoot assignee */
  async syncAssigneeFromOperador(
    prospectoId: string,
    operadorName: string | null | undefined,
  ): Promise<void> {
    const prospecto = await this.prisma.flotaProspecto.findUnique({
      where: { id: prospectoId },
      select: { chatwootConversationId: true, operador: true },
    });
    if (!prospecto?.chatwootConversationId) return;

    const val = operadorName?.trim() || null;
    if (!val) return;

    try {
      const agent = await this.findAgentForOperador(val);
      if (!agent) {
        this.logger.warn(`Sin agente Chatwoot para operador "${val}" (prospecto ${prospectoId})`);
        return;
      }

      const conversation = await this.client.getConversation(prospecto.chatwootConversationId);
      const currentAssigneeId = this.extractConversationMeta(conversation)?.assignee?.id;
      if (currentAssigneeId === agent.id) return;

      await this.client.assignConversation(prospecto.chatwootConversationId, agent.id);
      this.logger.log(`Chatwoot conv ${prospecto.chatwootConversationId} asignada a ${agent.name}`);
    } catch (e) {
      this.logger.warn(`Error sincronizando assignee Chatwoot: ${e instanceof Error ? e.message : e}`);
    }
  }

  async syncOperadorFromConversation(
    conversationId: number,
    phone?: string,
    assignee?: { id?: number; name?: string } | null,
    assigneeId?: number,
  ): Promise<{ updated: boolean; operador: string | null; prospectoId: string | null }> {
    let resolvedPhone = phone?.trim() || undefined;
    let resolvedAssignee = assignee;
    let resolvedAssigneeId = assigneeId ?? assignee?.id;
    let contactId: number | undefined;

    if (!resolvedPhone || (!resolvedAssignee?.name && !resolvedAssigneeId)) {
      try {
        const conversation = await this.client.getConversation(conversationId);
        const meta = this.extractConversationMeta(conversation);
        if (!resolvedPhone) {
          resolvedPhone = this.extractPhoneFromConversation(conversation);
        }
        if (!resolvedAssignee?.name && !resolvedAssigneeId) {
          resolvedAssignee = meta?.assignee;
          resolvedAssigneeId = resolvedAssignee?.id;
        }
        contactId = meta?.sender?.id;
      } catch (e) {
        this.logger.warn(`No se pudo leer conversación ${conversationId}: ${e instanceof Error ? e.message : e}`);
      }
    }

    let prospecto = await this.findProspectoForConversation(conversationId, resolvedPhone);
    if (!prospecto) {
      this.logger.warn(
        `Sync operador: sin prospecto para conv ${conversationId} (tel: ${resolvedPhone ?? '—'})`,
      );
      return { updated: false, operador: null, prospectoId: null };
    }

    const result = await this.syncOperadorFromAssignee(
      prospecto.id,
      resolvedAssignee,
      resolvedAssigneeId,
      conversationId,
    );

    const linkData: { chatwootConversationId?: number; chatwootContactId?: number } = {};
    if (!prospecto.chatwootConversationId) {
      linkData.chatwootConversationId = conversationId;
    }
    if (contactId && !prospecto.chatwootContactId) {
      linkData.chatwootContactId = contactId;
    }
    if (Object.keys(linkData).length > 0) {
      await this.prisma.flotaProspecto.update({
        where: { id: prospecto.id },
        data: linkData,
      });
    }

    return { ...result, prospectoId: prospecto.id };
  }

  /** Prospectos con operador vacío o con valor que no corresponde a un operador activo. */
  prospectoNeedsOperadorReconcile(
    operador: string | null | undefined,
    operadores?: OperadorUser[],
  ): boolean {
    if (!operador?.trim()) return true;
    return this.isInvalidOperadorName(operador, operadores);
  }

  /**
   * Reconcilia operador CRM ← assignee Chatwoot (backfill y cron).
   * Fase 1: prospectos vinculados sin operador válido.
   * Fase 2: conversaciones del inbox con assignee.
   */
  async reconcileOperadoresFromChatwoot(options?: {
    dryRun?: boolean;
    maxConversations?: number;
  }): Promise<{
    prospectsChecked: number;
    conversationsChecked: number;
    updated: number;
    noProspecto: number;
    noAssignee: number;
    noOperadorMatch: number;
    alreadyOk: number;
    errors: number;
  }> {
    const dryRun = options?.dryRun ?? false;
    const maxConversations = options?.maxConversations ?? 10_000;
    const ops = await this.listOperadores();
    const stats = {
      prospectsChecked: 0,
      conversationsChecked: 0,
      updated: 0,
      noProspecto: 0,
      noAssignee: 0,
      noOperadorMatch: 0,
      alreadyOk: 0,
      errors: 0,
    };

    const prospects = await this.prisma.flotaProspecto.findMany({
      where: {
        eliminadoAt: null,
        chatwootConversationId: { not: null },
      },
      select: {
        id: true,
        nombreCompleto: true,
        celular: true,
        operador: true,
        chatwootConversationId: true,
      },
    });

    for (const p of prospects) {
      stats.prospectsChecked++;
      if (!this.prospectoNeedsOperadorReconcile(p.operador, ops)) {
        stats.alreadyOk++;
        continue;
      }
      if (!p.chatwootConversationId) continue;
      if (dryRun) continue;
      try {
        const result = await this.syncOperadorFromConversation(
          p.chatwootConversationId,
          p.celular ?? undefined,
        );
        if (result.updated) stats.updated++;
        else if (!result.operador) stats.noOperadorMatch++;
      } catch (e) {
        stats.errors++;
        this.logger.warn(
          `Reconcile prospecto ${p.id}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    const inboxId = this.client.getConfig().inboxId;
    let page = 1;
    let convProcessed = 0;

    while (convProcessed < maxConversations) {
      let convs: Awaited<ReturnType<ChatwootClient['listConversations']>>;
      try {
        convs = await this.client.listConversations({
          inbox_id: inboxId,
          status: 'all',
          page,
        });
      } catch (e) {
        stats.errors++;
        this.logger.warn(`Reconcile listConversations p${page}: ${e instanceof Error ? e.message : e}`);
        break;
      }

      if (!convs.length) break;

      for (const conv of convs) {
        if (convProcessed >= maxConversations) break;
        convProcessed++;
        stats.conversationsChecked++;

        if (!conv.meta?.assignee?.id) {
          stats.noAssignee++;
          continue;
        }

        if (dryRun) continue;

        try {
          const result = await this.syncOperadorFromConversation(
            conv.id,
            conv.meta?.sender?.phone_number,
            conv.meta.assignee,
            conv.meta.assignee.id,
          );
          if (result.updated) stats.updated++;
          else if (!result.prospectoId) stats.noProspecto++;
          else if (!result.operador) stats.noOperadorMatch++;
          else stats.alreadyOk++;
        } catch (e) {
          stats.errors++;
          if (stats.errors <= 20) {
            this.logger.warn(`Reconcile conv ${conv.id}: ${e instanceof Error ? e.message : e}`);
          }
        }
      }

      if (convs.length < 25) break;
      page++;
    }

    return stats;
  }

  /**
   * Auto-asigna prospecto y conversación al operador que envía el primer mensaje outbound,
   * solo si el prospecto no tiene operador válido y Chatwoot no tiene otro operador asignado.
   */
  async assignOnFirstOutbound(params: {
    prospectoId: string;
    conversationId: number;
    senderAgentId?: number;
    senderAgentName?: string;
    senderUserId?: string;
    senderUserName?: string;
  }): Promise<{ assigned: boolean; operador: string | null }> {
    const ops = await this.listOperadores();
    const existing = await this.prisma.flotaProspecto.findUnique({
      where: { id: params.prospectoId },
      select: { operador: true },
    });
    if (!existing) return { assigned: false, operador: null };

    const currentOperador = this.resolveOperadorName(existing.operador, ops);
    if (currentOperador) {
      return { assigned: false, operador: currentOperador };
    }

    let canonicalOperador: string | null = null;

    if (params.senderUserId || params.senderUserName) {
      if (params.senderUserId) {
        const user = await this.prisma.user.findUnique({
          where: { id: params.senderUserId },
          select: { name: true, role: { select: { slug: true } } },
        });
        if (user?.role?.slug === 'operador' && user.name) {
          canonicalOperador = this.resolveOperadorName(user.name, ops);
        }
      }
      if (!canonicalOperador && params.senderUserName) {
        canonicalOperador = this.resolveOperadorName(params.senderUserName, ops);
      }
    }

    if (!canonicalOperador && params.senderAgentName) {
      canonicalOperador = this.resolveOperadorName(params.senderAgentName, ops);
    }
    if (!canonicalOperador && params.senderAgentId) {
      try {
        const agents = await this.client.listAgents();
        const agent = agents.find((a) => a.id === params.senderAgentId);
        if (agent) canonicalOperador = this.resolveOperadorName(agent.name, ops);
      } catch (e) {
        this.logger.warn(`No se pudo resolver agente ${params.senderAgentId}: ${e instanceof Error ? e.message : e}`);
      }
    }

    if (!canonicalOperador) return { assigned: false, operador: null };

    let currentAssigneeId: number | undefined;
    try {
      const conversation = await this.client.getConversation(params.conversationId);
      const assignee = this.extractConversationMeta(conversation)?.assignee;
      currentAssigneeId = assignee?.id;
      if (assignee?.name) {
        const assigneeOperador = this.resolveOperadorName(assignee.name, ops);
        if (assigneeOperador && !this.operadoresAreSame(assigneeOperador, canonicalOperador, ops)) {
          await this.syncOperadorFromAssignee(
            params.prospectoId,
            assignee,
            assignee.id,
            params.conversationId,
          );
          return { assigned: false, operador: assigneeOperador };
        }
      }
    } catch (e) {
      this.logger.warn(`No se pudo leer conversación ${params.conversationId}: ${e instanceof Error ? e.message : e}`);
    }

    await this.prisma.flotaProspecto.update({
      where: { id: params.prospectoId },
      data: {
        operador: canonicalOperador,
        asignadoAt: limaDate(),
        chatwootConversationId: params.conversationId,
      },
    });

    const agent = await this.findAgentForOperador(canonicalOperador);
    if (agent && currentAssigneeId !== agent.id) {
      try {
        await this.client.assignConversation(params.conversationId, agent.id);
        this.logger.log(
          `Auto-asignado conv ${params.conversationId} → ${agent.name} (primer mensaje outbound)`,
        );
      } catch (e) {
        this.logger.warn(`Error asignando Chatwoot en primer mensaje: ${e instanceof Error ? e.message : e}`);
      }
    }

    this.logger.log(`Operador auto-asignado prospecto ${params.prospectoId}: ${canonicalOperador}`);
    this.prospectosGateway.emitChange('operador_assigned', params.prospectoId);
    return { assigned: true, operador: canonicalOperador };
  }
}
