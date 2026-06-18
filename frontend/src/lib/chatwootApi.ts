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
  /** Último mensaje de la conversación (incluido por la API) */
  messages?: Array<{
    id: number;
    content: string;
    message_type: number;
    sender: { id: number; name: string; type: string };
    created_at: number;
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
  sender: {
    id: number;
    name: string;
    type: 'user' | 'contact' | 'agent_bot';
  };
  created_at: number;
  attachments: ChatwootAttachment[];
  conversation_id: number;
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
}): Promise<ChatwootConversation[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.q) search.set('q', params.q);
  if (params?.inbox_id) search.set('inbox_id', String(params.inbox_id));
  if (params?.page) search.set('page', String(params.page));
  const qs = search.toString();
  const res = await api<{ data: ChatwootConversation[] }>(`/api/chatwoot/conversations${qs ? `?${qs}` : ''}`);
  return res.data ?? [];
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
  data: { custom_attributes?: Record<string, string> },
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
