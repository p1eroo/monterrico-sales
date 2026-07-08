import { api } from './api';

export interface ChatwootConversation {
  id: number;
  inbox_id: number;
  status: 'open' | 'resolved' | 'pending';
  meta: {
    sender: ChatwootContact;
    assignee?: { id: number; name: string; email?: string; role?: string };
  };
  last_activity_at: number;
  unread_count?: number;
  preview?: string;
  direction?: string;
  time?: string;
  /** Último mensaje de la conversación (incluido por la API) */
  messages?: Array<{
    id: number;
    content: string;
    message_type: number;
    sender: { id: number; name: string; type: string };
    created_at: number;
    attachments?: ChatwootAttachment[];
  }>;
}

export interface ChatwootContact {
  id: number;
  name: string;
  phone_number: string;
  email: string;
  thumbnail?: string;
}

export interface ChatwootMessage {
  id: number;
  content: string;
  /** 0 = incoming, 1 = outgoing, 2 = activity */
  message_type: number;
  /** "sent" | "delivered" | "read" */
  status?: string;
  sender: {
    id: number;
    name: string;
    type: 'user' | 'contact' | 'agent_bot';
  };
  created_at: number;
  attachments: ChatwootAttachment[];
  conversation_id: number;
  /** Check azul local */
  waOutboundStatus?: string | null;
}

export const CHATWOOT_MESSAGE_TYPE = {
  INCOMING: 0,
  OUTGOING: 1,
  ACTIVITY: 2,
} as const;

export interface ChatwootAttachment {
  id: number;
  message_id?: number;
  file_type: string;
  account_id?: number;
  extension?: string | null;
  /** URL del archivo en el servidor de Chatwoot */
  data_url?: string;
  file_url?: string;
  /** URL thumbnail (para imágenes) */
  thumb_url?: string;
  file_size?: number;
  width?: number;
  height?: number;
}

export interface ChatwootInbox {
  id: number;
  name: string;
  channel_type: string;
}

export interface ChatwootAgent {
  id: number;
  name: string;
  email: string;
  role: string;
}

export async function fetchConversations(params?: {
  status?: string;
  q?: string;
  inbox_id?: number;
  page?: number;
  unread_only?: boolean;
}): Promise<ChatwootConversation[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.q) search.set('q', params.q);
  if (params?.inbox_id) search.set('inbox_id', String(params.inbox_id));
  if (params?.page) search.set('page', String(params.page));
  if (params?.unread_only) search.set('unread_only', 'true');
  const qs = search.toString();
  const res = await api<{ data: ChatwootConversation[] }>(`/api/chatwoot/conversations${qs ? `?${qs}` : ''}`);
  return res.data ?? [];
}

export async function searchChatwootConversations(q: string): Promise<ChatwootConversation[]> {
  const res = await api<{ data: ChatwootConversation[] }>(
    `/api/chatwoot/conversations/search?q=${encodeURIComponent(q)}`,
    { cache: 'no-store' },
  );
  return res.data ?? [];
}

/** Coincide nombre o teléfono del remitente con el texto de búsqueda. */
export function conversationMatchesQuery(
  conversation: ChatwootConversation,
  query: string,
): boolean {
  const q = query.trim();
  if (!q) return true;
  const qLower = q.toLowerCase();
  const name = conversation.meta?.sender?.name?.toLowerCase() ?? '';
  const phone = conversation.meta?.sender?.phone_number ?? '';
  const digits = q.replace(/\D/g, '');
  if (name.includes(qLower)) return true;
  if (phone.includes(q)) return true;
  if (digits.length >= 3) {
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.includes(digits) || phoneDigits.endsWith(digits.slice(-9))) {
      return true;
    }
  }
  return false;
}

export async function fetchUnreadConversations(): Promise<ChatwootConversation[]> {
  return fetchConversations({ unread_only: true });
}

export async function fetchUnreadSummary(): Promise<{
  totalUnread: number;
  conversationCount: number;
}> {
  return api('/api/chatwoot/unread-summary');
}

export async function fetchMessages(
  conversationId: number,
  before?: number,
): Promise<ChatwootMessage[]> {
  const qs = before ? `?before=${before}` : '';
  return api(`/api/chatwoot/conversations/${conversationId}/messages${qs}`);
}

export async function sendMessage(
  conversationId: number,
  content: string,
): Promise<ChatwootMessage> {
  return api(`/api/chatwoot/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function updateConversation(
  conversationId: number,
  data: { status?: string; assignee_id?: number },
) {
  return api(`/api/chatwoot/conversations/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** Sincroniza prospecto.operador con el agente asignado actual en Chatwoot */
export async function syncOperadorFromChatwoot(
  conversationId: number,
  phone?: string,
): Promise<{ updated: boolean; operador: string | null; prospectoId: string | null }> {
  const qs = phone ? `?phone=${encodeURIComponent(phone)}` : '';
  return api(`/api/chatwoot/conversations/${conversationId}/sync-operador${qs}`, {
    method: 'POST',
  });
}

export async function searchContacts(query: string): Promise<ChatwootContact[]> {
  return api(`/api/chatwoot/contacts?q=${encodeURIComponent(query)}`);
}

export async function createContact(data: {
  name: string;
  phone_number?: string;
  email?: string;
}): Promise<ChatwootContact> {
  return api('/api/chatwoot/contacts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateContact(
  contactId: number,
  data: { name?: string; custom_attributes?: Record<string, string> },
): Promise<unknown> {
  return api(`/api/chatwoot/contacts/${contactId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function fetchInboxes(): Promise<ChatwootInbox[]> {
  return api('/api/chatwoot/inboxes');
}

export async function fetchAgents(): Promise<ChatwootAgent[]> {
  return api('/api/chatwoot/agents');
}

export async function fetchConversation(
  id: number,
): Promise<{ meta: { sender: ChatwootContact & { custom_attributes?: Record<string, string>; additional_attributes?: Record<string, string> }; assignee?: { id: number; name: string } }; status: string }> {
  return api(`/api/chatwoot/conversations/${id}`);
}

export async function uploadAttachment(
  conversationId: number,
  file: File,
  caption?: string,
): Promise<ChatwootMessage> {
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  });
  return api(`/api/chatwoot/conversations/${conversationId}/upload`, {
    method: 'POST',
    body: JSON.stringify({ file: base64, fileName: file.name, mimeType: file.type, caption }),
  });
}

export async function markConversationAsRead(conversationId: number): Promise<void> {
  await api(`/api/chatwoot/conversations/${conversationId}/read`, { method: 'POST' });
}

export async function initiateConversation(data: {
  name: string;
  phone: string;
  templateName?: string;
  templateCategory?: string;
  templateLanguage?: string;
  templateParams?: Record<string, unknown>;
  skipTemplate?: boolean;
  operador?: string;
}): Promise<{ conversationId: number; contactId: number; isNew?: boolean }> {
  return api('/api/chatwoot/initiate-conversation', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function sendTemplateToConversation(
  conversationId: number,
  data: {
    content: string;
    template_params: {
      name: string;
      category: string;
      language: string;
      processed_params?: Record<string, unknown>;
    };
  },
): Promise<unknown> {
  return api(`/api/chatwoot/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchChatwootTemplates(): Promise<{
  name: string;
  language: string;
  category: string;
  content?: string;
}[]> {
  return api('/api/chatwoot/templates');
}

export async function fetchChatwootContacts(params?: {
  page?: number;
  q?: string;
}): Promise<ChatwootContact[]> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.q) qs.set('q', params.q);
  const qsStr = qs.toString();
  return api(`/api/chatwoot/contacts-list${qsStr ? `?${qsStr}` : ''}`);
}

export async function fetchContactConversations(contactId: number): Promise<ChatwootConversation[]> {
  const res = await api<{ data: ChatwootConversation[] }>(
    `/api/chatwoot/contacts/${contactId}/conversations`,
    { cache: 'no-store' },
  );
  return res.data ?? [];
}

export function findConversationByPhone(
  conversations: ChatwootConversation[],
  phone: string | null | undefined,
): ChatwootConversation | undefined {
  const digits = phone?.replace(/\D/g, '') ?? '';
  if (!digits) return undefined;
  const suffix = digits.slice(-9);
  return conversations.find((c) => {
    const cd = c.meta?.sender?.phone_number?.replace(/\D/g, '') ?? '';
    return cd === digits || cd.endsWith(suffix) || suffix.endsWith(cd.slice(-9));
  });
}

export function pickBestContactConversation(
  conversations: ChatwootConversation[],
): ChatwootConversation | null {
  if (conversations.length === 0) return null;
  const active = conversations.filter((c) => c.status === 'open' || c.status === 'pending');
  const pool = active.length > 0 ? active : conversations;
  return [...pool].sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0))[0];
}

/** Resuelve la conversación de un contacto: memoria → historial por contacto → búsqueda → resolve profundo. */
export async function resolveContactConversation(
  contact: ChatwootContact,
  loaded: ChatwootConversation[],
): Promise<ChatwootConversation | null> {
  const inMemory = findConversationByPhone(loaded, contact.phone_number);
  if (inMemory) return inMemory;
  const convs = await fetchContactConversations(contact.id);
  const fromContact = pickBestContactConversation(convs);
  if (fromContact) return fromContact;
  if (contact.phone_number) {
    const digits = contact.phone_number.replace(/\D/g, '');
    const suffix = digits.slice(-9);
    const searchTerms = [digits, suffix, `+${digits}`]
      .filter((q, i, arr) => q.length >= 3 && arr.indexOf(q) === i);
    for (const q of searchTerms) {
      const searchHits = await searchChatwootConversations(q);
      const fromSearch = pickBestContactConversation(searchHits);
      if (fromSearch) return fromSearch;
    }
    const qs = new URLSearchParams({
      phone: contact.phone_number,
      contact_id: String(contact.id),
    });
    const res = await api<{ data: ChatwootConversation | null }>(
      `/api/chatwoot/resolve-conversation?${qs.toString()}`,
      { cache: 'no-store' },
    );
    if (res.data) return res.data;
  }
  return null;
}

/** Abre chat de un contacto; si no hay historial resuelto, usa initiateConversation sin plantilla. */
export async function openContactChat(
  contact: ChatwootContact,
  loaded: ChatwootConversation[],
): Promise<{ conversationId: number; conversation?: ChatwootConversation | null } | null> {
  const conv = await resolveContactConversation(contact, loaded);
  if (conv) return { conversationId: conv.id, conversation: conv };
  if (!contact.phone_number) return null;
  const phone = contact.phone_number.startsWith('+')
    ? contact.phone_number
    : `+${contact.phone_number.replace(/\D/g, '')}`;
  const result = await initiateConversation({
    name: contact.name || phone,
    phone,
    skipTemplate: true,
  });
  return { conversationId: result.conversationId };
}
