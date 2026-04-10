import { api } from '@/lib/api';

export type WhatsappMessageItem = {
  id: string;
  direction: string;
  body: string;
  fromWaId: string;
  toWaId: string;
  createdAt: string;
  waMessageId: string | null;
  evoInstanceName: string | null;
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
): Promise<{ id: string; direction: string; toWaId: string; waMessageId: string | null }> {
  return api(`/api/whatsapp/send`, {
    method: 'POST',
    body: JSON.stringify({ contactId, text }),
  });
}
