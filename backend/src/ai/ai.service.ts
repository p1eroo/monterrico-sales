import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AiToolsService } from './ai-tools.service';
import { AssistantInstructionsService } from './assistant-instructions.service';
import {
  DEFAULT_INSTRUCTIONS_CHAT_TOOLS_BODY,
  DEFAULT_INSTRUCTIONS_STREAM_BODY,
  TECHNICAL_APPENDIX_CHAT_TOOLS,
  effectiveInstructionBody,
} from './assistant-instructions.defaults';
import type { ChatContextDto, ChatHistoryItemDto } from './dto/chat.dto';

export type AiChatLink = { label: string; href: string };
export type AiChatAction = {
  id: string;
  label: string;
  /** Si existe, al pulsar se envía como mensaje al asistente */
  prompt?: string;
};

export type AiChatResponse = {
  message: string;
  links?: AiChatLink[];
  actions?: AiChatAction[];
  /** Presente cuando el historial está persistido en BD */
  conversationId?: string;
};

const MAX_HISTORY_MESSAGES = 24;
const MAX_HISTORY_TOTAL_CHARS = 24_000;
const MAX_SINGLE_HISTORY_CONTENT = 8_000;

function stripMarkdownJsonFence(content: string): string {
  let trimmed = content.trim();
  if (trimmed.startsWith('```')) {
    const m = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m?.[1]) trimmed = m[1].trim();
  }
  return trimmed;
}

function normalizeJsonLikeQuotes(s: string): string {
  return s
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'");
}

/** Primer objeto `{...}` balanceado (respeta strings y escapes). */
function extractFirstBalancedJsonObject(s: string): string | null {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function tryParseAiChatEnvelope(s: string): AiChatResponse | null {
  for (const candidate of [s, normalizeJsonLikeQuotes(s)]) {
    try {
      const j = JSON.parse(candidate) as AiChatResponse;
      if (typeof j.message === 'string') {
        return {
          message: j.message,
          links: Array.isArray(j.links) ? j.links : undefined,
          actions: Array.isArray(j.actions) ? j.actions : undefined,
        };
      }
    } catch {
      /* siguiente intento */
    }
  }
  return null;
}

/** Evita bucles: misma tanda de tools+args que la ronda anterior → forzar respuesta en texto. */
function stableToolCallsFingerprint(
  toolCalls: Array<{
    type: string;
    function: { name: string; arguments: string };
  }>,
): string {
  const parts = toolCalls
    .filter((t) => t.type === 'function')
    .map((t) => {
      const raw = (t.function.arguments ?? '').trim() || '{}';
      let normalized = raw;
      try {
        normalized = JSON.stringify(JSON.parse(raw));
      } catch {
        /* mantener raw si no es JSON válido */
      }
      return `${t.function.name}:${normalized}`;
    })
    .sort();
  return parts.join('|');
}

const CRM_TOOLS: Record<string, unknown>[] = [
  {
    type: 'function',
    function: {
      name: 'list_my_tasks',
      description:
        'Lista tareas pendientes (no completadas) asignadas al usuario en el CRM.',
      parameters: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            enum: ['today', 'overdue', 'week'],
            description:
              'today: vencen hoy; overdue: ya vencidas; week: próximos 7 días',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'count_opportunities_by_stage',
      description:
        'Cuenta oportunidades abiertas del usuario agrupadas por etapa del pipeline.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_company_summary',
      description:
        'Resumen de una empresa asignada al usuario (solo empresas donde el usuario es el asesor asignado).',
      parameters: {
        type: 'object',
        properties: {
          companyId: {
            type: 'string',
            description: 'UUID de la empresa en el CRM',
          },
        },
        required: ['companyId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_recent_contacts',
      description:
        'Lista los contactos asignados al usuario, ordenados por última actualización.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Máximo de filas (1–25, por defecto 15)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_opportunity_summary',
      description:
        'Detalle de una oportunidad asignada al usuario (importe, etapa, fechas, contactos vinculados).',
      parameters: {
        type: 'object',
        properties: {
          opportunityId: {
            type: 'string',
            description: 'UUID de la oportunidad en el CRM',
          },
        },
        required: ['opportunityId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'count_my_contacts',
      description:
        'Cuenta los contactos asignados al usuario (requiere permiso contactos.ver).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'count_my_companies',
      description:
        'Cuenta solo las empresas donde el usuario es el asesor asignado (requiere empresas.ver). No uses esta herramienta si el usuario pide el total de todo el CRM o de todas las empresas del sistema.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'count_all_companies',
      description:
        'Cuenta todas las empresas registradas en el CRM (total global, sin filtrar por asesor). Usar cuando pregunte cuántas empresas hay en total en el sistema, “en todo el CRM”, “en general”, etc. Requiere empresas.ver (equivalente al listado con filtro de todos los asesores).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'count_my_open_opportunities',
      description:
        'Cuenta las oportunidades abiertas asignadas al usuario (requiere permiso oportunidades.ver).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'count_my_pending_tasks',
      description:
        'Cuenta las tareas pendientes (no completadas) asignadas al usuario (requiere permiso actividades.ver).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_companies_inactive_days',
      description:
        'Empresas asignadas al usuario cuyo registro no se ha actualizado en al menos N días (según updatedAt del CRM). Útil para “sin actividad”.',
      parameters: {
        type: 'object',
        properties: {
          min_days_inactive: {
            type: 'number',
            description:
              'Mínimo de días sin actualizar el registro (por defecto 12, entre 1 y 365)',
          },
          limit: {
            type: 'number',
            description: 'Máximo de empresas a devolver (1–25, por defecto 15)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_contacts_inactive_days',
      description:
        'Contactos asignados al usuario cuyo registro no se ha actualizado en al menos N días (updatedAt).',
      parameters: {
        type: 'object',
        properties: {
          min_days_inactive: {
            type: 'number',
            description:
              'Mínimo de días sin actualizar el registro (por defecto 12)',
          },
          limit: {
            type: 'number',
            description: 'Máximo de contactos a devolver (1–25)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_my_knowledge',
      description:
        'Busca en las bases de conocimiento indexadas (RAG): por similitud semántica con embeddings en PostgreSQL/pgvector cuando está configurado, y por palabras en el texto. Usar cuando la pregunta pueda estar en documentación interna.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Palabras clave o frase a buscar (mínimo 2 caracteres)',
          },
        },
        required: ['query'],
      },
    },
  },
];

type OpenAiChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: unknown;
  tool_call_id?: string;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tools: AiToolsService,
    private readonly assistantInstructions: AssistantInstructionsService,
  ) {}

  /** Compatibilidad: devuelve el hilo más reciente del usuario. */
  async getConversationForUser(userId: string): Promise<{
    conversationId: string | null;
    messages: {
      id: string;
      role: string;
      content: string;
      createdAt: Date;
      links?: AiChatLink[];
      actions?: AiChatAction[];
    }[];
  }> {
    const conv = await this.prisma.aiConversation.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 200,
        },
      },
    });
    if (!conv) {
      return { conversationId: null, messages: [] };
    }
    return this.mapConversationToClientPayload(conv);
  }

  async listConversationsForUser(userId: string): Promise<
    {
      id: string;
      title: string;
      updatedAt: string;
      messageCount: number;
    }[]
  > {
    const rows = await this.prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title?.trim() || 'Nuevo chat',
      updatedAt: r.updatedAt.toISOString(),
      messageCount: r._count.messages,
    }));
  }

  async createConversationForUser(userId: string): Promise<{
    id: string;
    title: string;
    updatedAt: string;
    messageCount: number;
  }> {
    const row = await this.prisma.aiConversation.create({
      data: { userId, title: 'Nuevo chat' },
    });
    return {
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
      messageCount: 0,
    };
  }

  async getConversationByIdForUser(
    userId: string,
    conversationId: string,
  ): Promise<{
    conversationId: string;
    messages: {
      id: string;
      role: string;
      content: string;
      createdAt: Date;
      links?: AiChatLink[];
      actions?: AiChatAction[];
    }[];
  }> {
    const conv = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 200,
        },
      },
    });
    if (!conv) {
      throw new NotFoundException('Conversación no encontrada');
    }
    return this.mapConversationToClientPayload(conv);
  }

  private mapConversationToClientPayload(conv: {
    id: string;
    messages: {
      id: string;
      role: string;
      content: string;
      createdAt: Date;
      meta: unknown;
    }[];
  }): {
    conversationId: string;
    messages: {
      id: string;
      role: string;
      content: string;
      createdAt: Date;
      links?: AiChatLink[];
      actions?: AiChatAction[];
    }[];
  } {
    return {
      conversationId: conv.id,
      messages: conv.messages.map((m) => {
        const meta = m.meta as {
          links?: AiChatLink[];
          actions?: AiChatAction[];
        } | null;
        return {
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          links: meta?.links?.length ? meta.links : undefined,
          actions: meta?.actions?.length ? meta.actions : undefined,
        };
      }),
    };
  }

  /** Borra un hilo concreto. */
  async deleteConversationByIdForUser(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    const res = await this.prisma.aiConversation.deleteMany({
      where: { id: conversationId, userId },
    });
    if (res.count === 0) return;
  }

  /**
   * Compatibilidad API antigua: borra solo el hilo más reciente
   * (comportamiento cercano al “un chat por usuario” anterior).
   */
  async deleteConversationForUser(userId: string): Promise<void> {
    const conv = await this.prisma.aiConversation.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (!conv) return;
    await this.prisma.aiConversation.delete({ where: { id: conv.id } });
  }

  private async touchConversationUpdatedAt(conversationId: string): Promise<void> {
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }

  private async maybeSetConversationTitleFromUserMessage(
    conversationId: string,
    userMessage: string,
  ): Promise<void> {
    const row = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
      select: { title: true },
    });
    if (!row) return;
    const t = (row.title ?? '').trim();
    if (t && t !== 'Nuevo chat') return;
    const preview = userMessage.replace(/\s+/g, ' ').trim().slice(0, 72);
    if (preview.length < 2) return;
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        title: `${preview}${userMessage.length > 72 ? '…' : ''}`,
        updatedAt: new Date(),
      },
    });
  }

  private async resolveConversationForChat(
    userId: string,
    conversationId: string | undefined,
  ): Promise<{ id: string }> {
    const trimmed = conversationId?.trim();
    if (trimmed) {
      const found = await this.prisma.aiConversation.findFirst({
        where: { id: trimmed, userId },
        select: { id: true },
      });
      if (!found) {
        throw new BadRequestException('Conversación no encontrada');
      }
      return found;
    }
    const latest = await this.prisma.aiConversation.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (latest) return latest;
    const created = await this.prisma.aiConversation.create({
      data: { userId, title: 'Nuevo chat' },
      select: { id: true },
    });
    return created;
  }

  /**
   * SSE: texto en vivo (markdown). No usa tools CRM (solo chat).
   * Eventos: `data: {"delta":"..."}` acumulables; cierre `data: {"done":true,"message":"...","conversationId":"..."}` o `data: {"error":"..."}`.
   */
  async streamChat(
    userMessage: string,
    context: ChatContextDto | undefined,
    user: {
      userId: string;
      username: string;
      name: string;
      role: string;
    },
    history: ChatHistoryItemDto[] | undefined,
    conversationId: string | undefined,
    res: Response,
  ): Promise<void> {
    const writeSse = (obj: object) => {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    };

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const merged: ChatContextDto = {
      ...context,
      userId: context?.userId ?? user.userId,
      userRole: context?.userRole ?? user.role,
    };

    const conv = await this.resolveConversationForChat(
      user.userId,
      conversationId,
    );

    await this.prisma.aiMessage.create({
      data: {
        conversationId: conv.id,
        role: 'user',
        content: userMessage,
      },
    });

    await this.maybeSetConversationTitleFromUserMessage(conv.id, userMessage);
    await this.touchConversationUpdatedAt(conv.id);

    const dbMessages = await this.prisma.aiMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    const priorDb = dbMessages.slice(0, -1);
    let historyForModel: ChatHistoryItemDto[] = priorDb.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    if (historyForModel.length === 0 && history?.length) {
      historyForModel = history;
    }

    const sanitizedHistory = this.sanitizeHistory(historyForModel);

    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    const model =
      this.config.get<string>('OPENAI_MODEL')?.trim() || 'gpt-4o-mini';
    const maxTokensRaw = this.config.get<string>('OPENAI_MAX_TOKENS');
    const maxTokens =
      maxTokensRaw !== undefined && maxTokensRaw !== ''
        ? Number.parseInt(maxTokensRaw, 10)
        : undefined;

    const finish = async (reply: AiChatResponse) => {
      await this.prisma.aiMessage.create({
        data: {
          conversationId: conv.id,
          role: 'assistant',
          content: reply.message,
          meta: {
            links: reply.links ?? [],
            actions: reply.actions ?? [],
          },
        },
      });
      await this.maybePruneConversationMessages(conv.id);
      await this.touchConversationUpdatedAt(conv.id);
      writeSse({
        done: true,
        message: reply.message,
        conversationId: conv.id,
        ...(reply.links?.length ? { links: reply.links } : {}),
        ...(reply.actions?.length ? { actions: reply.actions } : {}),
      });
      res.end();
    };

    if (!apiKey?.trim()) {
      const mock = this.mockReply(userMessage, merged, user);
      writeSse({ delta: mock.message });
      await finish(mock);
      return;
    }

    const inst = await this.assistantInstructions.getForPromptAssembly();
    const streamBody = effectiveInstructionBody(
      inst.instructionsStream,
      DEFAULT_INSTRUCTIONS_STREAM_BODY,
    );
    const system = `${streamBody}

Contexto del usuario (JSON): ${JSON.stringify(merged)}
Usuario: ${user.name}, rol: ${user.role}.`;

    const openaiMessages: OpenAiChatMessage[] = [
      { role: 'system', content: system },
      ...sanitizedHistory.map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: userMessage },
    ];

    const body: Record<string, unknown> = {
      model,
      temperature: 0.4,
      messages: openaiMessages,
      stream: true,
    };
    if (
      maxTokens !== undefined &&
      Number.isFinite(maxTokens) &&
      maxTokens > 0
    ) {
      body.max_tokens = maxTokens;
    }

    const startedAt = Date.now();
    this.logger.log(
      JSON.stringify({
        event: 'ai.openai.stream_start',
        model,
        userId: user.userId,
        historyTurns: sanitizedHistory.length,
      }),
    );

    let fetchRes: globalThis.Response;
    try {
      fetchRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      writeSse({ error: msg });
      res.end();
      return;
    }

    if (!fetchRes.ok) {
      const raw = await fetchRes.text();
      let detail = raw?.slice(0, 800) ?? fetchRes.statusText;
      try {
        const j = JSON.parse(raw) as { error?: { message?: string } };
        if (j?.error?.message) detail = j.error.message;
      } catch {
        /* ignore */
      }
      this.logger.warn(
        JSON.stringify({
          event: 'ai.openai.stream_http_error',
          status: fetchRes.status,
          ms: Date.now() - startedAt,
          detail,
        }),
      );
      writeSse({ error: detail });
      res.end();
      return;
    }

    const reader = fetchRes.body?.getReader();
    if (!reader) {
      writeSse({ error: 'Sin cuerpo de stream' });
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let lineBuffer = '';
    let fullText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';
        for (const line of lines) {
          const delta = this.deltaFromOpenAiSseLine(line);
          if (delta) {
            fullText += delta;
            writeSse({ delta });
          }
        }
      }
      if (lineBuffer.trim()) {
        for (const line of lineBuffer.split('\n')) {
          const delta = this.deltaFromOpenAiSseLine(line);
          if (delta) {
            fullText += delta;
            writeSse({ delta });
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      writeSse({ error: msg });
      res.end();
      return;
    }

    this.logger.log(
      JSON.stringify({
        event: 'ai.openai.stream_done',
        ms: Date.now() - startedAt,
        model,
        userId: user.userId,
        chars: fullText.length,
      }),
    );

    await finish(this.parseAiJsonContent(fullText));
  }

  /** Extrae un fragmento de texto de una línea `data: {...}` del stream de OpenAI. */
  private deltaFromOpenAiSseLine(line: string): string | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data: ')) return null;
    const payload = trimmed.slice(6);
    if (payload === '[DONE]') return null;
    try {
      const j = JSON.parse(payload) as {
        choices?: { delta?: { content?: string } }[];
      };
      const c = j.choices?.[0]?.delta?.content;
      return typeof c === 'string' && c.length > 0 ? c : null;
    } catch {
      return null;
    }
  }

  /**
   * Borra mensajes de la conversación más antiguos que N días (variable de entorno).
   * No hace nada si `AI_CHAT_RETENTION_DAYS` no está definida o es ≤ 0.
   */
  private async maybePruneConversationMessages(
    conversationId: string,
  ): Promise<void> {
    const raw = this.config.get<string>('AI_CHAT_RETENTION_DAYS')?.trim();
    if (!raw) return;
    const days = Number.parseInt(raw, 10);
    if (!Number.isFinite(days) || days <= 0) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await this.prisma.aiMessage.deleteMany({
      where: {
        conversationId,
        createdAt: { lt: cutoff },
      },
    });

    if (result.count > 0) {
      this.logger.log(
        JSON.stringify({
          event: 'ai.retention.pruned',
          conversationId,
          deleted: result.count,
          olderThanDays: days,
        }),
      );
    }
  }

  async chat(
    userMessage: string,
    context: ChatContextDto | undefined,
    user: {
      userId: string;
      username: string;
      name: string;
      role: string;
    },
    history?: ChatHistoryItemDto[],
    conversationId?: string,
  ): Promise<AiChatResponse> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    const merged: ChatContextDto = {
      ...context,
      userId: context?.userId ?? user.userId,
      userRole: context?.userRole ?? user.role,
    };

    const conv = await this.resolveConversationForChat(
      user.userId,
      conversationId,
    );

    await this.prisma.aiMessage.create({
      data: {
        conversationId: conv.id,
        role: 'user',
        content: userMessage,
      },
    });

    await this.maybeSetConversationTitleFromUserMessage(conv.id, userMessage);
    await this.touchConversationUpdatedAt(conv.id);

    const dbMessages = await this.prisma.aiMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    const priorDb = dbMessages.slice(0, -1);
    let historyForModel: ChatHistoryItemDto[] = priorDb.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    if (historyForModel.length === 0 && history?.length) {
      historyForModel = history;
    }

    const sanitizedHistory = this.sanitizeHistory(historyForModel);

    let response: AiChatResponse;

    if (apiKey?.trim()) {
      try {
        response = await this.callOpenAIWithTools(
          userMessage,
          merged,
          user,
          apiKey,
          sanitizedHistory,
        );
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        this.logger.warn(
          `OpenAI / flujo con herramientas falló, respuesta de error al cliente: ${errMsg}`,
        );
        response = this.buildOpenAiFailureResponse(
          userMessage,
          merged,
          user,
          errMsg,
        );
      }
    } else {
      response = this.mockReply(userMessage, merged, user);
    }

    await this.prisma.aiMessage.create({
      data: {
        conversationId: conv.id,
        role: 'assistant',
        content: response.message,
        meta: {
          links: response.links ?? [],
          actions: response.actions ?? [],
        },
      },
    });

    await this.maybePruneConversationMessages(conv.id);
    await this.touchConversationUpdatedAt(conv.id);

    return { ...response, conversationId: conv.id };
  }

  /** Normaliza, fusiona turnos consecutivos del mismo rol y recorta por tamaño. */
  private sanitizeHistory(
    history: ChatHistoryItemDto[] | undefined,
  ): { role: 'user' | 'assistant'; content: string }[] {
    if (!Array.isArray(history) || history.length === 0) {
      return [];
    }

    const merged: { role: 'user' | 'assistant'; content: string }[] = [];

    for (const item of history) {
      if (item?.role !== 'user' && item?.role !== 'assistant') continue;
      if (typeof item.content !== 'string') continue;
      const trimmed = item.content.trim();
      if (!trimmed) continue;

      const slice =
        trimmed.length > MAX_SINGLE_HISTORY_CONTENT
          ? `${trimmed.slice(0, MAX_SINGLE_HISTORY_CONTENT)}…`
          : trimmed;

      const last = merged[merged.length - 1];
      if (last && last.role === item.role) {
        last.content = `${last.content}\n\n${slice}`;
        if (last.content.length > MAX_SINGLE_HISTORY_CONTENT) {
          last.content = `${last.content.slice(0, MAX_SINGLE_HISTORY_CONTENT)}…`;
        }
      } else {
        merged.push({ role: item.role, content: slice });
      }
    }

    let window = merged.slice(-MAX_HISTORY_MESSAGES);

    let total = window.reduce((acc, m) => acc + m.content.length, 0);
    while (total > MAX_HISTORY_TOTAL_CHARS && window.length > 0) {
      window = window.slice(1);
      total = window.reduce((acc, m) => acc + m.content.length, 0);
    }

    return window;
  }

  private parseAiJsonContent(content: string): AiChatResponse {
    const trimmed = stripMarkdownJsonFence(content.trim());
    const direct = tryParseAiChatEnvelope(trimmed);
    if (direct) return direct;
    const extracted = extractFirstBalancedJsonObject(trimmed);
    if (extracted) {
      const fromObj = tryParseAiChatEnvelope(extracted);
      if (fromObj) return fromObj;
    }
    return { message: trimmed };
  }

  private async callOpenAIWithTools(
    userMessage: string,
    context: ChatContextDto,
    user: { userId: string; name: string; role: string },
    apiKey: string,
    history: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<AiChatResponse> {
    const inst = await this.assistantInstructions.getForPromptAssembly();
    const chatBody = effectiveInstructionBody(
      inst.instructionsChatTools,
      DEFAULT_INSTRUCTIONS_CHAT_TOOLS_BODY,
    );
    const system = `Contexto actual del usuario (JSON): ${JSON.stringify(context)}
Usuario: ${user.name}, rol: ${user.role}.

${chatBody}

${TECHNICAL_APPENDIX_CHAT_TOOLS}`;

    const model =
      this.config.get<string>('OPENAI_MODEL')?.trim() || 'gpt-4o-mini';

    const maxTokensRaw = this.config.get<string>('OPENAI_MAX_TOKENS');
    const maxTokens =
      maxTokensRaw !== undefined && maxTokensRaw !== ''
        ? Number.parseInt(maxTokensRaw, 10)
        : undefined;

    const messages: OpenAiChatMessage[] = [
      { role: 'system', content: system },
      ...history.map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: userMessage },
    ];

    const requestStartedAt = Date.now();
    this.logger.log(
      JSON.stringify({
        event: 'ai.openai.request_start',
        model,
        userId: user.userId,
        historyTurns: history.length,
      }),
    );

    let toolChoice: 'auto' | 'none' = 'auto';
    let lastToolFingerprint: string | null = null;
    const maxIterations = 12;

    for (let iter = 0; iter < maxIterations; iter++) {
      const roundStartedAt = Date.now();
      const choiceThisRound = toolChoice;
      toolChoice = 'auto';

      const body: Record<string, unknown> = {
        model,
        temperature: 0.4,
        messages,
        tools: CRM_TOOLS,
        tool_choice: choiceThisRound,
      };
      if (
        maxTokens !== undefined &&
        Number.isFinite(maxTokens) &&
        maxTokens > 0
      ) {
        body.max_tokens = maxTokens;
      }

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const raw = await res.text();
      if (!res.ok) {
        let detail = raw?.slice(0, 800) ?? res.statusText;
        try {
          const j = JSON.parse(raw) as { error?: { message?: string } };
          if (j?.error?.message) detail = j.error.message;
        } catch {
          /* texto plano */
        }
        this.logger.warn(
          JSON.stringify({
            event: 'ai.openai.http_error',
            status: res.status,
            roundMs: Date.now() - roundStartedAt,
            totalMs: Date.now() - requestStartedAt,
            iteration: iter,
            detail,
          }),
        );
        throw new Error(detail);
      }

      const completionBody = JSON.parse(raw) as {
        choices?: {
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              id: string;
              type: string;
              function: { name: string; arguments: string };
            }>;
          };
        }[];
      };
      const msg = completionBody.choices?.[0]?.message;
      if (!msg) {
        throw new Error('Respuesta vacía del modelo');
      }

      const toolCalls = msg.tool_calls;
      if (toolCalls?.length) {
        if (choiceThisRound === 'none') {
          this.logger.warn(
            JSON.stringify({
              event: 'ai.openai.tool_calls_after_force_none',
              iteration: iter,
              tools: toolCalls
                .filter((t) => t.type === 'function')
                .map((t) => t.function.name),
              userId: user.userId,
            }),
          );
          messages.push({
            role: 'assistant',
            content: msg.content ?? null,
            tool_calls: msg.tool_calls,
          });
          for (const tc of toolCalls) {
            if (tc.type !== 'function') continue;
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify({
                error:
                  'Esta ronda exige solo el JSON final de respuesta al usuario (message/links/actions). No invoques más herramientas; usa los resultados tool ya recibidos arriba.',
              }),
            });
          }
          toolChoice = 'none';
          continue;
        }

        const fp = stableToolCallsFingerprint(toolCalls);
        if (lastToolFingerprint !== null && fp === lastToolFingerprint) {
          this.logger.warn(
            JSON.stringify({
              event: 'ai.openai.tool_loop_break',
              iteration: iter,
              fingerprint: fp,
              userId: user.userId,
            }),
          );
          toolChoice = 'none';
        }
        lastToolFingerprint = fp;

        this.logger.log(
          JSON.stringify({
            event: 'ai.openai.tool_calls',
            iteration: iter,
            roundMs: Date.now() - roundStartedAt,
            tools: toolCalls
              .filter((t) => t.type === 'function')
              .map((t) => t.function.name),
            userId: user.userId,
          }),
        );
        messages.push({
          role: 'assistant',
          content: msg.content ?? null,
          tool_calls: msg.tool_calls,
        });
        for (const tc of toolCalls) {
          if (tc.type !== 'function') continue;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || '{}') as Record<
              string,
              unknown
            >;
          } catch {
            args = {};
          }
          const result = await this.tools.executeTool(
            tc.function.name,
            args,
            user.userId,
          );
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      const content = msg.content;
      if (!content?.trim()) {
        throw new Error('Respuesta vacía del modelo');
      }
      const reply = this.parseAiJsonContent(content);
      this.logger.log(
        JSON.stringify({
          event: 'ai.openai.response_ok',
          totalMs: Date.now() - requestStartedAt,
          iteration: iter,
          roundMs: Date.now() - roundStartedAt,
          model,
          userId: user.userId,
        }),
      );
      return reply;
    }

    throw new Error('Demasiadas iteraciones de herramientas');
  }

  /** Cuando falla OpenAI o el bucle de herramientas; no confundir con ausencia de API key. */
  private buildOpenAiFailureResponse(
    userMessage: string,
    context: ChatContextDto,
    user: { name: string },
    errMsg: string,
  ): AiChatResponse {
    const safePrompt =
      userMessage.length > 400 ? `${userMessage.slice(0, 400)}…` : userMessage;
    const first = user.name.split(/\s+/)[0] ?? '';
    let extra = '';
    if (
      errMsg.includes('Demasiadas iteraciones') ||
      errMsg.includes('iteraciones de herramientas')
    ) {
      extra =
        '\n\n_Sugerencia:_ prueba **Borrar chat** en el asistente y vuelve a preguntar con un hilo más corto.';
    }
    return {
      message: `${first ? `${first}, ` : ''}**no se pudo completar la respuesta con IA.**\n\n${errMsg}${extra}\n\nSi el error se repite, borra la conversación del asistente o contacta al administrador. (Tu sesión e IA están configuradas; este mensaje describe el fallo concreto del intento, no la falta de API key.)`,
      links: [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Contactos', href: '/contactos' },
        { label: 'Empresas', href: '/empresas' },
      ],
      actions: safePrompt
        ? [
            {
              id: 'retry-last',
              label: 'Reintentar la misma pregunta',
              prompt: safePrompt,
            },
          ]
        : undefined,
    };
  }

  private mockReply(
    userMessage: string,
    context: ChatContextDto,
    user: { name: string },
  ): AiChatResponse {
    const q = userMessage.toLowerCase();
    const page = context.currentPage ?? 'dashboard';

    if (/oportunidad|cerrar|pipeline|venta/.test(q)) {
      return {
        message: `Hola ${user.name.split(' ')[0] ?? ''}, para ver oportunidades próximas a cerrar abre el **Pipeline** o **Oportunidades**. Desde **${page}** puedo orientarte: filtra por etapa o fecha de cierre.`,
        links: [
          { label: 'Ver oportunidades', href: '/opportunities' },
          { label: 'Abrir pipeline', href: '/pipeline' },
        ],
        actions: [
          {
            id: 'tasks-today',
            label: '¿Qué tareas tengo hoy?',
            prompt: '¿Qué tareas tengo hoy?',
          },
        ],
      };
    }

    if (/empresa|inactiv|cliente/.test(q)) {
      return {
        message:
          'Puedes revisar **Empresas** y filtrar por actividad o último contacto. Si quieres, en el futuro el asistente podrá listar registros concretos según permisos.',
        links: [{ label: 'Ir a empresas', href: '/empresas' }],
        actions: [
          {
            id: 'opps-close',
            label: 'Oportunidades por cerrarse',
            prompt: '¿Qué oportunidades están por cerrarse?',
          },
        ],
      };
    }

    if (/tarea|hoy|pendiente/.test(q)) {
      return {
        message:
          'Abre **Tareas** para ver lo pendiente y priorizar. También puedes usar el **Calendario** para la agenda del día.',
        links: [
          { label: 'Ver tareas', href: '/tareas' },
          { label: 'Calendario', href: '/calendario' },
        ],
      };
    }

    return {
      message: `Hola 👋 Soy tu copiloto comercial. Estás en **${page}**${context.selectedEntityType ? ` (vista: ${context.selectedEntityType})` : ''}.\n\nPuedo orientarte sobre contactos, empresas, oportunidades y tareas. Configura **OPENAI_API_KEY** en el servidor para respuestas con IA completas.`,
      links: [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Contactos', href: '/contactos' },
      ],
      actions: [
        {
          id: 's1',
          label: '¿Qué oportunidades están por cerrarse?',
          prompt: '¿Qué oportunidades están por cerrarse?',
        },
        {
          id: 's2',
          label: 'Muéstrame empresas inactivas',
          prompt: 'Muéstrame empresas inactivas',
        },
        {
          id: 's3',
          label: '¿Qué tareas tengo hoy?',
          prompt: '¿Qué tareas tengo hoy?',
        },
      ],
    };
  }
}
