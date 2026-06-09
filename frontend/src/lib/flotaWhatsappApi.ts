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
  displayLineId: string | null;
  qrCode: string | null;
  qrText: string | null;
  pairingCode: string | null;
  qrGeneratedAt: string | null;
  qrExpiresAt: string | null;
  lastError: string | null;
  useForInbox: boolean;
  useForMasivo: boolean;
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
  lastSender?: string;
  llamadaCount?: number;
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

export async function fetchMasivoProspectos(search?: string, estado?: string): Promise<{ id: string; nombreCompleto: string; celular: string | null; movil: string | null; estado: string | null }[]> {
  const qs = new URLSearchParams();
  if (search?.trim()) qs.set('search', search.trim());
  if (estado) qs.set('estado', estado);
  const qsStr = qs.toString();
  return api(`/flota-prospectos/masivo-list${qsStr ? '?' + qsStr : ''}`);
}

export async function fetchFlotaProspectoMessages(
  prospectoId: string,
  limit = 50,
  before?: string,
): Promise<{ items: WhatsappMessageItem[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (before) params.set('before', before);
  const res = await api<{ items: WhatsappMessageItem[]; hasMore: boolean }>(
    `/api/whatsapp/flota/prospectos/${prospectoId}/messages?${params}`,
  );
  return res.items ? res : { items: [], hasMore: false };
}

export async function sendFlotaWhatsappMessage(
  prospectoId: string,
  text: string,
  imageUrl?: string,
  audioUrl?: string,
  documentUrl?: string,
  documentName?: string,
  documentMimeType?: string,
): Promise<{ ok: boolean; waMessageId: string | null }> {
  return api<{ ok: boolean; waMessageId: string | null }>('/api/whatsapp/flota/send', {
    method: 'POST',
    body: JSON.stringify({
      prospectoId,
      text: text || undefined,
      imageUrl: imageUrl || undefined,
      audioUrl: audioUrl || undefined,
      documentUrl: documentUrl || undefined,
      documentName: documentName || undefined,
      documentMimeType: documentMimeType || undefined,
    }),
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

export async function uploadFlotaAudio(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/api/whatsapp/flota/upload-audio`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error subiendo audio: ${text}`);
  }
  const data = await res.json() as { url?: string };
  if (!data.url) throw new Error('No se recibió URL del audio');
  return data.url;
}

export async function uploadFlotaDocument(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/api/whatsapp/flota/upload-document`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error subiendo documento: ${text}`);
  }
  const data = await res.json() as { url?: string };
  if (!data.url) throw new Error('No se recibió URL del documento');
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

export type FlotaBulkProgress = {
  jobId: string;
  total: number;
  sent: number;
  failed: number;
  currentName: string;
  currentIndex: number;
  nextDelay: number;
  finished: boolean;
  cancelled: boolean;
  paused: boolean;
};

export async function sendFlotaBulk(params: {
  prospectoIds: string[];
  text: string;
  imageUrl?: string;
}): Promise<{ jobId: string; campaignId: string }> {
  return api('/api/whatsapp/flota/send-bulk', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getFlotaBulkProgress(jobId: string): Promise<FlotaBulkProgress | null> {
  try {
    return await api<FlotaBulkProgress>(`/api/whatsapp/flota/send-bulk/${jobId}`);
  } catch {
    return null;
  }
}

export async function cancelFlotaBulk(jobId: string): Promise<void> {
  return api(`/api/whatsapp/flota/send-bulk/${jobId}`, { method: 'DELETE' });
}

export async function pauseFlotaBulk(jobId: string): Promise<void> {
  return api(`/api/whatsapp/flota/send-bulk/${jobId}/pause`, { method: 'POST' });
}

export async function resumeFlotaBulk(jobId: string): Promise<void> {
  return api(`/api/whatsapp/flota/send-bulk/${jobId}/resume`, { method: 'POST' });
}

export type FlotaInstanceDetail = FlotaWhatsappConnection & { id: string };

export async function fetchFlotaInstances(): Promise<FlotaInstanceDetail[]> {
  return api<FlotaInstanceDetail[]>('/api/whatsapp/flota/instances');
}

export async function createFlotaInstance(name: string, token?: string): Promise<{ instance: FlotaInstanceDetail }> {
  return api('/api/whatsapp/flota/instances', {
    method: 'POST',
    body: JSON.stringify({ name, token }),
  });
}

export async function connectFlotaInstance(id: string): Promise<{ instance: FlotaInstanceDetail }> {
  return api(`/api/whatsapp/flota/instances/${id}/connect`, { method: 'POST' });
}

export async function disconnectFlotaInstance(id: string): Promise<{ instance: FlotaInstanceDetail }> {
  return api(`/api/whatsapp/flota/instances/${id}/disconnect`, { method: 'POST' });
}

export async function deleteFlotaInstance(id: string): Promise<{ ok: boolean }> {
  return api(`/api/whatsapp/flota/instances/${id}`, { method: 'DELETE' });
}

export async function updateFlotaInstanceFlags(id: string, flags: { useForInbox?: boolean; useForMasivo?: boolean }): Promise<{ instance: FlotaInstanceDetail }> {
  return api(`/api/whatsapp/flota/instances/${id}/flags`, {
    method: 'PATCH',
    body: JSON.stringify(flags),
  });
}

export type FlotaBulkCampaign = {
  id: string;
  name: string;
  message: string;
  total: number;
  sent: number;
  failed: number;
  status: string;
  imageUrl: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
};

export async function listFlotaBulkCampaigns(page = 1, limit = 20): Promise<{ items: FlotaBulkCampaign[]; total: number; page: number; limit: number }> {
  return api(`/api/whatsapp/flota/bulk-campaigns?page=${page}&limit=${limit}`);
}

export async function fetchContactPhoto(prospectoId: string): Promise<{ url: string } | null> {
  try {
    return await api(`/api/whatsapp/flota/photo/${prospectoId}`);
  } catch {
    return null;
  }
}
