import { api } from '@/lib/api';

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

export async function refreshMyWhatsappConnection(): Promise<WhatsappConnectionResponse> {
  return api('/api/whatsapp/connection/me/refresh', {
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
