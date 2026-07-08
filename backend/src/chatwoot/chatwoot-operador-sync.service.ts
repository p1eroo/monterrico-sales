import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatwootClient } from './chatwoot.client';
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

@Injectable()
export class ChatwootOperadorSyncService {
  private readonly logger = new Logger(ChatwootOperadorSyncService.name);
  private operadoresCache: OperadorUser[] | null = null;
  private operadoresCacheAt = 0;
  private readonly cacheTtlMs = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: ChatwootClient,
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
  ): { assignee?: { id: number; name: string } } | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const r = raw as Record<string, unknown>;
    const payload = (r.payload ?? r.data ?? raw) as { meta?: { assignee?: { id: number; name: string } } };
    return payload?.meta;
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

  async findProspectoForConversation(
    conversationId: number,
    phone?: string,
  ) {
    let prospecto = await this.prisma.flotaProspecto.findFirst({
      where: { chatwootConversationId: conversationId },
    });
    if (!prospecto && phone) {
      const cleaned = phone.replace(/\D/g, '').slice(-9);
      if (cleaned) {
        prospecto = await this.prisma.flotaProspecto.findFirst({
          where: {
            OR: [
              { celular: { endsWith: cleaned } },
              { movil: { endsWith: cleaned } },
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

    const fixingInvalid = this.isInvalidOperadorName(existing.operador, ops);
    const asignadoAt = fixingInvalid && existing.asignadoAt
      ? existing.asignadoAt
      : limaDate();

    await this.prisma.flotaProspecto.update({
      where: { id: prospectoId },
      data: { operador: canonicalOperador, asignadoAt },
    });

    this.logger.log(`Operador sincronizado prospecto ${prospectoId}: ${existing.operador ?? '—'} → ${canonicalOperador}`);
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
    const prospecto = await this.findProspectoForConversation(conversationId, phone);
    if (!prospecto) {
      return { updated: false, operador: null, prospectoId: null };
    }

    let resolvedAssignee = assignee;
    let resolvedAssigneeId = assigneeId ?? assignee?.id;

    if (!resolvedAssignee?.name && !resolvedAssigneeId) {
      try {
        const conversation = await this.client.getConversation(conversationId);
        resolvedAssignee = this.extractConversationMeta(conversation)?.assignee;
        resolvedAssigneeId = resolvedAssignee?.id;
      } catch (e) {
        this.logger.warn(`No se pudo leer conversación ${conversationId}: ${e instanceof Error ? e.message : e}`);
      }
    }

    const result = await this.syncOperadorFromAssignee(
      prospecto.id,
      resolvedAssignee,
      resolvedAssigneeId,
    );

    if (!prospecto.chatwootConversationId) {
      await this.prisma.flotaProspecto.update({
        where: { id: prospecto.id },
        data: { chatwootConversationId: conversationId },
      });
    }

    return { ...result, prospectoId: prospecto.id };
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
          await this.syncOperadorFromAssignee(params.prospectoId, assignee, assignee.id);
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
    return { assigned: true, operador: canonicalOperador };
  }
}
