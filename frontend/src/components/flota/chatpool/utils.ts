import { API_BASE } from '@/lib/api';
import type { Conversation, Message } from './types';

export function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins}min`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

export function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Etiqueta corta para cita en header del chat (fecha + hora si aplica). */
export function formatCitaHeaderLabel(iso: string): string {
  const raw = iso.trim();
  if (!raw) return '';

  // Solo fecha (YYYY-MM-DD): evitar corrimiento por UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';

  const hasTime =
    date.getHours() !== 0 ||
    date.getMinutes() !== 0 ||
    date.getSeconds() !== 0;

  const datePart = date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  if (!hasTime) return datePart;

  const timePart = date.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${datePart} · ${timePart}`;
}

export function formatDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);

  const dateKey = (d: Date) => d.toLocaleDateString('es-PE');
  if (dateKey(date) === dateKey(today)) return 'Hoy';
  if (dateKey(date) === dateKey(yesterday)) return 'Ayer';
  return date.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const WA_CONVERSATION_PREFIX = 'wa-';

export function phoneKey(phone?: string | null): string {
  return (phone ?? '').replace(/\D/g, '').slice(-9);
}

export function isWaConversationId(id: string): boolean {
  return id.startsWith(WA_CONVERSATION_PREFIX);
}

export function phoneFromWaConversationId(id: string): string {
  return id.startsWith(WA_CONVERSATION_PREFIX) ? id.slice(WA_CONVERSATION_PREFIX.length) : id;
}

export function waConversationId(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-9);
  return `${WA_CONVERSATION_PREFIX}${digits}`;
}

export function conversationPhoneKey(conversation: { contact: { phone?: string | null }; id: string }): string {
  const fromPhone = phoneKey(conversation.contact.phone);
  if (fromPhone.length >= 8) return fromPhone;
  if (isWaConversationId(conversation.id)) return phoneFromWaConversationId(conversation.id);
  return fromPhone;
}

/** Si existe prospecto CRM para el mismo teléfono, usar su id en lugar de wa-. */
export function resolveCanonicalConversationId(
  conversations: { id: string; contact: { phone?: string | null }; prospectoActivo?: boolean }[],
  id: string,
): string {
  const conv = conversations.find((c) => c.id === id);
  const key = conv ? conversationPhoneKey(conv) : isWaConversationId(id) ? phoneFromWaConversationId(id) : '';
  if (key.length < 8) return id;

  const prospecto = conversations.find(
    (c) =>
      !isWaConversationId(c.id) &&
      c.prospectoActivo !== false &&
      conversationPhoneKey(c) === key,
  );
  if (prospecto && isWaConversationId(id)) return prospecto.id;
  return id;
}

/** Resuelve la conversación visible para un id activo (directo o por teléfono). */
export function findConversationInList(
  conversations: Conversation[],
  activeId: string | null,
): Conversation | null {
  if (!activeId) return null;
  const direct = conversations.find((c) => c.id === activeId);
  if (direct) return direct;

  const key = isWaConversationId(activeId) ? phoneFromWaConversationId(activeId) : '';
  if (key.length < 8) return null;
  return conversations.find((c) => conversationPhoneKey(c) === key) ?? null;
}

export function getMessagesForConversation(
  conversations: { id: string; contact: { phone?: string | null } }[],
  messages: Record<string, Message[]>,
  conversationId: string | null,
): Message[] {
  if (!conversationId) return [];

  const conv = conversations.find((c) => c.id === conversationId);
  const key = conv ? conversationPhoneKey(conv) : isWaConversationId(conversationId) ? phoneFromWaConversationId(conversationId) : '';

  const bucketIds = new Set<string>([conversationId]);
  if (key.length >= 8) {
    for (const c of conversations) {
      if (conversationPhoneKey(c) === key) bucketIds.add(c.id);
    }
    bucketIds.add(waConversationId(key));
  }

  const map = new Map<string, Message>();
  for (const bid of bucketIds) {
    for (const msg of messages[bid] ?? []) {
      map.set(msg.id, msg);
    }
  }
  return [...map.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export function getConductorCodigo(
  phone: string | null | undefined,
  codigos: Record<string, string>,
): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/\D/g, '').replace(/^51/, '');
  return codigos[normalized] ?? null;
}

export function resolveAttachmentUrl(url?: string | null): string {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  return `${API_BASE}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

export type ConversationAttachment = {
  id: string;
  name: string;
  mimeType?: string;
  size?: number;
  url: string;
  mediaType: Message['contentType'];
  messageId: string;
  createdAt: Date;
};

export function collectConversationAttachments(messages: Message[]): {
  images: ConversationAttachment[];
  files: ConversationAttachment[];
} {
  const images: ConversationAttachment[] = [];
  const files: ConversationAttachment[] = [];

  for (const msg of messages) {
    if (msg.contentType === 'text' || msg.contentType === 'sticker' || msg.contentType === 'location') continue;
    const url = resolveAttachmentUrl(msg.fileUrl ?? msg.attachmentUrl);
    if (!url) continue;
    const item: ConversationAttachment = {
      id: msg.attachmentId ?? msg.id,
      name: msg.fileName ?? msg.content,
      mimeType: msg.mimeType,
      size: msg.fileSize,
      url,
      mediaType: msg.contentType,
      messageId: msg.id,
      createdAt: msg.createdAt,
    };
    if (msg.contentType === 'image') images.push(item);
    else files.push(item);
  }

  return { images, files };
}
