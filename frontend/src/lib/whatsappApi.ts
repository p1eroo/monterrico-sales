import { api, apiBlob } from '@/lib/api';

export type WhatsappConnectionInstance = {
  id: string;
  instanceName: string;
  evoInstanceId: string | null;
  displayLineId: string | null;
  status: string;
  isConnected: boolean;
  qrCode: string | null;
  qrText: string | null;
  pairingCode: string | null;
  qrGeneratedAt: string | null;
  qrExpiresAt: string | null;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WhatsappConnectionResponse = {
  canManage: boolean;
  instance: WhatsappConnectionInstance | null;
};

export type WhatsappMessageItem = {
  id: string;
  direction: string;
  body: string;
  fromWaId: string;
  toWaId: string;
  createdAt: string;
  waMessageId: string | null;
  evoInstanceName: string | null;
  /** Solo salientes: sent | delivered | read (webhook Receipt / MESSAGES_UPDATE). */
  waOutboundStatus?: string | null;
  attachments?: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    mediaType: 'image' | 'video' | 'audio' | 'document' | 'file';
    url: string | null;
    downloadUrl?: string | null;
  }[];
};

export type WhatsappSocketPayload =
  | { type: 'message'; contactId: string; item: WhatsappMessageItem }
  | {
      type: 'status';
      contactId: string;
      id: string;
      waOutboundStatus: string;
    };

export async function fetchWhatsappMessages(
  contactId: string,
  limit = 50,
): Promise<WhatsappMessageItem[]> {
  const q = new URLSearchParams({ contactId, limit: String(limit) });
  const res = await api<{ items: WhatsappMessageItem[] }>(
    `/api/whatsapp/messages?${q.toString()}`,
  );
  return res.items ?? [];
}

export async function sendWhatsappMessage(
  contactId: string,
  text: string,
): Promise<{
  id: string;
  direction: string;
  toWaId: string;
  waMessageId: string | null;
  waOutboundStatus?: string | null;
}> {
  return api(`/api/whatsapp/send`, {
    method: 'POST',
    body: JSON.stringify({ contactId, text }),
  });
}

export async function fetchMyWhatsappConnection(): Promise<WhatsappConnectionResponse> {
  return api('/api/whatsapp/connection/me');
}

export async function connectMyWhatsapp(): Promise<WhatsappConnectionResponse> {
  return api('/api/whatsapp/connection/me/connect', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function disconnectMyWhatsapp(): Promise<WhatsappConnectionResponse> {
  return api('/api/whatsapp/connection/me/disconnect', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function sendMyWhatsappTestMessage(params: {
  number: string;
  text: string;
}): Promise<{ ok: true; to: string; waMessageId: string | null }> {
  return api('/api/whatsapp/connection/me/test-message', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function downloadWhatsappAttachment(params: {
  id: string;
  name: string;
  url?: string | null;
}): Promise<void> {
  let blob: Blob;
  if (params.id && !params.id.startsWith('payload:')) {
    blob = await apiBlob(
      `/files/${encodeURIComponent(params.id)}/content?disposition=attachment`,
    );
  } else if (params.url) {
    const res = await fetch(params.url);
    if (!res.ok) {
      throw new Error(`No se pudo descargar el archivo (${res.status})`);
    }
    blob = await res.blob();
  } else {
    throw new Error('Archivo no disponible para descarga');
  }

  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = params.name || 'archivo';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
}
