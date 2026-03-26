import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AiToolsService } from './ai-tools.service';
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
  ) {}

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
    const conv = await this.prisma.aiConversation.findUnique({
      where: { userId },
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

  /** Borra la conversación persistida y todos sus mensajes (PostgreSQL). */
  async deleteConversationForUser(userId: string): Promise<void> {
    const conv = await this.prisma.aiConversation.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!conv) return;
    await this.prisma.aiConversation.delete({ where: { id: conv.id } });
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

    const conv = await this.prisma.aiConversation.upsert({
      where: { userId: user.userId },
      create: { userId: user.userId },
      update: {},
    });

    await this.prisma.aiMessage.create({
      data: {
        conversationId: conv.id,
        role: 'user',
        content: userMessage,
      },
    });

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

    const finish = async (fullText: string) => {
      await this.prisma.aiMessage.create({
        data: {
          conversationId: conv.id,
          role: 'assistant',
          content: fullText,
          meta: { links: [], actions: [] },
        },
      });
      await this.maybePruneConversationMessages(conv.id);
      writeSse({
        done: true,
        message: fullText,
        conversationId: conv.id,
      });
      res.end();
    };

    if (!apiKey?.trim()) {
      const mock = this.mockReply(userMessage, merged, user);
      writeSse({ delta: mock.message });
      await finish(mock.message);
      return;
    }

    const system = `Eres el asistente comercial de Taxi Monterrico CRM (ventas, leads, empresas, oportunidades, tareas).
Responde en español, tono profesional y breve, en **Markdown** (negritas, listas, saltos de línea).
Contexto del usuario (JSON): ${JSON.stringify(merged)}
Usuario: ${user.name}, rol: ${user.role}.
No inventes datos de CRM concretos; orienta sobre rutas y buenas prácticas.`;

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

    await finish(fullText);
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
  ): Promise<AiChatResponse> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    const merged: ChatContextDto = {
      ...context,
      userId: context?.userId ?? user.userId,
      userRole: context?.userRole ?? user.role,
    };

    const conv = await this.prisma.aiConversation.upsert({
      where: { userId: user.userId },
      create: { userId: user.userId },
      update: {},
    });

    await this.prisma.aiMessage.create({
      data: {
        conversationId: conv.id,
        role: 'user',
        content: userMessage,
      },
    });

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
        this.logger.warn(`OpenAI falló, usando respuesta local: ${errMsg}`);
        response = this.mockReply(userMessage, merged, user);
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
    let trimmed = content.trim();
    if (trimmed.startsWith('```')) {
      const m = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (m?.[1]) trimmed = m[1].trim();
    }
    try {
      const j = JSON.parse(trimmed) as AiChatResponse;
      if (typeof j.message === 'string') {
        return {
          message: j.message,
          links: Array.isArray(j.links) ? j.links : undefined,
          actions: Array.isArray(j.actions) ? j.actions : undefined,
        };
      }
    } catch {
      /* usar texto plano */
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
    const system = `Eres el asistente comercial de Taxi Monterrico CRM (ventas, leads, empresas, oportunidades, tareas).
Responde en español, tono profesional y breve.
Contexto actual del usuario (JSON): ${JSON.stringify(context)}
Usuario: ${user.name}, rol: ${user.role}.

Puedes llamar herramientas para obtener datos reales del CRM (tareas, contactos, oportunidades y empresas asignadas al usuario). Solo devuelven datos permitidos por permisos.

Cuando tengas la respuesta final para el usuario, devuelve SOLO un objeto JSON válido (sin markdown) con esta forma exacta:
{"message":"texto principal (puedes usar **negrita** y saltos de línea \\n y listas con guiones)","links":[{"label":"texto","href":"/ruta"}],"actions":[{"id":"slug","label":"texto botón","prompt":"opcional"}]}
- links: rutas internas del CRM como /opportunities, /empresas, /contactos, /tareas
- actions: botones de ayuda rápida
- Si no hay links ni actions, omite las claves o usa arrays vacíos.`;

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

    const maxIterations = 8;
    for (let iter = 0; iter < maxIterations; iter++) {
      const roundStartedAt = Date.now();
      const body: Record<string, unknown> = {
        model,
        temperature: 0.4,
        messages,
        tools: CRM_TOOLS,
        tool_choice: 'auto',
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
