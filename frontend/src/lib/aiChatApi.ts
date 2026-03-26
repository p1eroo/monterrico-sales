import { API_BASE, api } from '@/lib/api';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export type AiChatLink = { label: string; href: string };
export type AiChatAction = {
  id: string;
  label: string;
  prompt?: string;
};

export type AiChatResponse = {
  message: string;
  links?: AiChatLink[];
  actions?: AiChatAction[];
  conversationId?: string;
};

export type AiConversationMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  links?: AiChatLink[];
  actions?: AiChatAction[];
};

export type AiConversationResponse = {
  conversationId: string | null;
  messages: AiConversationMessage[];
};

export type AiChatRequestContext = {
  userId: string;
  currentPage: string;
  userRole: string;
  selectedEntityType?: string;
  selectedEntityId?: string;
};

export type AiChatHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

export async function postAiChat(
  message: string,
  context: AiChatRequestContext,
  history?: AiChatHistoryItem[],
): Promise<AiChatResponse> {
  return api<AiChatResponse>('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      context,
      ...(history && history.length > 0 ? { history } : {}),
    }),
  });
}

/** Historial persistido en servidor (PostgreSQL). */
export async function fetchAiConversation(): Promise<AiConversationResponse> {
  return api<AiConversationResponse>('/api/ai/conversation');
}

/** Elimina la conversación en servidor (mensajes incluidos). Idempotente. */
export async function deleteAiConversation(): Promise<void> {
  await api<Record<string, never>>('/api/ai/conversation', {
    method: 'DELETE',
  });
}

export type StreamAiChatCallbacks = {
  onDelta: (delta: string) => void;
  onDone: (payload: { message: string; conversationId?: string }) => void;
  onError: (message: string) => void;
};

/**
 * Respuesta en vivo (SSE). Sin tools CRM: solo texto/markdown.
 * Activar en UI con `VITE_AI_CHAT_STREAM=true`.
 */
export async function streamAiChat(
  message: string,
  context: AiChatRequestContext,
  history: AiChatHistoryItem[] | undefined,
  callbacks: StreamAiChatCallbacks,
): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/api/ai/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      context,
      ...(history && history.length > 0 ? { history } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText;
    try {
      const j = JSON.parse(text) as { message?: string };
      if (typeof j.message === 'string') msg = j.message;
    } catch {
      if (text) msg = text.slice(0, 300);
    }
    callbacks.onError(msg);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError('Sin respuesta del servidor');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  const processLine = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data: ')) return false;
    const jsonStr = trimmed.slice(6);
    try {
      const j = JSON.parse(jsonStr) as {
        delta?: string;
        done?: boolean;
        message?: string;
        conversationId?: string;
        error?: string;
      };
      if (typeof j.error === 'string' && j.error.length > 0) {
        callbacks.onError(j.error);
        return true;
      }
      if (typeof j.delta === 'string' && j.delta.length > 0) {
        callbacks.onDelta(j.delta);
      }
      if (j.done === true && typeof j.message === 'string') {
        callbacks.onDone({
          message: j.message,
          conversationId: j.conversationId,
        });
        return true;
      }
    } catch {
      /* chunk inválido */
    }
    return false;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of block.split('\n')) {
          if (processLine(line)) return;
        }
      }
    }

    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        if (processLine(line)) return;
      }
    }
  } catch (e) {
    callbacks.onError(
      e instanceof Error ? e.message : 'Error al leer el stream',
    );
  }
}
