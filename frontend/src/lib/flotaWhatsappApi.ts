import { api } from '@/lib/api';
import type { WhatsappMessageItem } from '@/lib/whatsappApi';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function getAccessToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
}

export type FlotaExcelContact = {
  name: string;
  phone: string;
  contactId: string | null;
};

export type FlotaExcelPreview = {
  items: FlotaExcelContact[];
  total: number;
};

export type FlotaWhatsappConnection = {
  instanceName: string;
  evoInstanceId: string | null;
  status: string;
  isConnected: boolean;
  qrCode: string | null;
  qrText: string | null;
  pairingCode: string | null;
  qrGeneratedAt: string | null;
  qrExpiresAt: string | null;
  lastError: string | null;
};

export type FlotaWhatsappConnectionResponse = {
  canManage: boolean;
  instance: FlotaWhatsappConnection | null;
};

export type FlotaConversation = {
  id: string;
  name: string;
  phone: string;
  preview: string;
  time: string;
  direction: string;
  unread: number;
  estado?: string;
  operador?: string;
};

export type FlotaBulkResult = {
  total: number;
  enviados: number;
  fallidos: number;
  results: Array<{ contactId: string; status: string; error?: string; messageId?: string }>;
};

export async function fetchSharedConnection(): Promise<FlotaWhatsappConnectionResponse> {
  return api('/api/whatsapp/shared/connection');
}

export async function connectSharedWhatsapp(): Promise<FlotaWhatsappConnectionResponse> {
  return api('/api/whatsapp/shared/connect', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function disconnectSharedWhatsapp(): Promise<FlotaWhatsappConnectionResponse> {
  return api('/api/whatsapp/shared/disconnect', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function sendSharedTestMessage(params: {
  number: string;
  text: string;
}): Promise<{ ok: true; to: string; waMessageId: string | null }> {
  return api('/api/whatsapp/shared/test', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function fetchConversations(q?: string): Promise<FlotaConversation[]> {
  const params = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  return api(`/api/whatsapp/conversations${params}`);
}

export async function markConversationAsRead(prospectoId: string): Promise<void> {
  return api(`/api/whatsapp/flota/read/${prospectoId}`, { method: 'POST' });
}

export async function fetchMasivoProspectos(search?: string): Promise<{ id: string; nombreCompleto: string; celular: string | null; movil: string | null }[]> {
  const params = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  return api(`/flota-prospectos/masivo-list${params}`);
}

export async function fetchFlotaProspectoMessages(
  prospectoId: string,
  limit = 50,
): Promise<WhatsappMessageItem[]> {
  const res = await api<{ items: WhatsappMessageItem[] }>(
    `/api/whatsapp/flota/prospectos/${prospectoId}/messages?limit=${limit}`,
  );
  return res.items ?? [];
}

export async function sendFlotaWhatsappMessage(
  prospectoId: string,
  text: string,
  imageUrl?: string,
): Promise<{ ok: boolean; waMessageId: string | null }> {
  return api<{ ok: boolean; waMessageId: string | null }>('/api/whatsapp/flota/send', {
    method: 'POST',
    body: JSON.stringify({ prospectoId, text: text || undefined, imageUrl: imageUrl || undefined }),
  });
}

export async function uploadFlotaImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/api/whatsapp/flota/upload-image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error subiendo imagen: ${text}`);
  }
  const data = await res.json() as { url?: string };
  if (!data.url) throw new Error('No se recibió URL de la imagen');
  return data.url;
}

export async function sendBulkWhatsapp(params: {
  contactIds: string[];
  text: string;
}): Promise<FlotaBulkResult> {
  return api('/api/whatsapp/send-bulk', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function importExcelPreview(file: File): Promise<FlotaExcelPreview> {
  const token = getAccessToken();
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(
    `${API_BASE}/api/whatsapp/import-excel`,
    {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    },
  );
  const text = await res.text();
  let body: unknown = {};
  if (text) {
    try { body = JSON.parse(text) as unknown; } catch { body = { message: text }; }
  }
  if (!res.ok) {
    const err = body as { message?: string | string[]; error?: string; statusCode?: number };
    const msg = Array.isArray(err.message)
      ? err.message.join(', ')
      : typeof err.message === 'string' && err.message.length > 0
        ? err.message
        : err.error && typeof err.error === 'string'
          ? err.error
          : `Error ${res.status}: ${text.slice(0, 200)}`;
    throw new Error(msg);
  }
  return body as FlotaExcelPreview;
}
