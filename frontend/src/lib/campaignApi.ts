import { api } from './api';
import type {
  Campaign,
  CampaignAttachment,
  CampaignListItem,
  CampaignRecipient,
  CampaignRecipientResult,
} from '@/types';

export type SendCampaignEmailApiRecipient = {
  id: string;
  email: string;
  name: string;
  company?: string;
  contactId?: string;
};

export type SendCampaignEmailResponse = {
  results: {
    recipientId: string;
    contactId?: string;
    name: string;
    email: string;
    status: 'entregado' | 'fallido';
    sentAt?: string;
    errorMessage?: string;
  }[];
};

/** Extrae base64 de un data URL o devuelve la cadena si ya es base64 puro */
export function attachmentDataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf('base64,');
  if (i >= 0) return dataUrl.slice(i + 7);
  return dataUrl;
}

export async function sendCampaignEmailApi(params: {
  campaignName?: string;
  subject: string;
  htmlBody: string;
  recipients: SendCampaignEmailApiRecipient[];
  attachments?: CampaignAttachment[];
}): Promise<SendCampaignEmailResponse> {
  const attachments = params.attachments?.map((a) => ({
    fileName: a.fileName,
    mimeType: a.mimeType,
    contentBase64: attachmentDataUrlToBase64(a.dataUrl),
  }));

  return api<SendCampaignEmailResponse>('/campaigns/send-email', {
    method: 'POST',
    body: JSON.stringify({
      campaignName: params.campaignName,
      subject: params.subject,
      htmlBody: params.htmlBody,
      recipients: params.recipients,
      attachments: attachments?.length ? attachments : undefined,
    }),
  });
}

function parseCampaignDetail(raw: Record<string, unknown>): Campaign {
  return {
    id: String(raw.id),
    name: String(raw.name),
    status: raw.status as Campaign['status'],
    channel: raw.channel as Campaign['channel'],
    message: (raw.message ?? {}) as Campaign['message'],
    recipients: (Array.isArray(raw.recipients)
      ? raw.recipients
      : []) as CampaignRecipient[],
    results: Array.isArray(raw.results)
      ? (raw.results as CampaignRecipientResult[])
      : undefined,
    sentCount: typeof raw.sentCount === 'number' ? raw.sentCount : undefined,
    deliveredCount:
      typeof raw.deliveredCount === 'number' ? raw.deliveredCount : undefined,
    openedCount: typeof raw.openedCount === 'number' ? raw.openedCount : undefined,
    clickedCount:
      typeof raw.clickedCount === 'number' ? raw.clickedCount : undefined,
    failedCount: typeof raw.failedCount === 'number' ? raw.failedCount : undefined,
    bounceCount: typeof raw.bounceCount === 'number' ? raw.bounceCount : undefined,
    recipientCount:
      typeof raw.recipientCount === 'number' ? raw.recipientCount : undefined,
    createdAt:
      typeof raw.createdAt === 'string'
        ? raw.createdAt
        : String(raw.createdAt ?? ''),
    sentAt: typeof raw.sentAt === 'string' ? raw.sentAt : undefined,
    createdBy: String(raw.createdBy ?? ''),
    createdByName: String(raw.createdByName ?? ''),
    relatedContactIds: Array.isArray(raw.relatedContactIds)
      ? (raw.relatedContactIds as string[])
      : undefined,
    relatedCompanyIds: Array.isArray(raw.relatedCompanyIds)
      ? (raw.relatedCompanyIds as string[])
      : undefined,
    relatedOpportunityIds: Array.isArray(raw.relatedOpportunityIds)
      ? (raw.relatedOpportunityIds as string[])
      : undefined,
    subjectSnapshot:
      typeof raw.subjectSnapshot === 'string' ? raw.subjectSnapshot : undefined,
  };
}

const SUBJECT_SNAPSHOT_MAX = 500;

/** Solo para status `sent`: métricas, resultados, asunto; sin cuerpo ni lista de destinatarios en BD. */
export function buildSentCampaignPersistPayload(c: Campaign) {
  const fromSubject = (c.message.subject ?? '').trim();
  const subject = (
    fromSubject ||
    (c.channel !== 'email' ? `Campaña ${c.channel}` : '') ||
    c.name.trim() ||
    'Campaña enviada'
  ).slice(0, SUBJECT_SNAPSHOT_MAX);
  return {
    name: c.name,
    status: c.status,
    channel: c.channel,
    subjectSnapshot: subject,
    message: {
      channel: c.channel,
      subject,
      body: '',
      variables: [] as string[],
      attachments: [] as Array<{
        id: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
      }>,
    },
    recipients: [] as CampaignRecipient[],
    results: c.results,
    sentCount: c.sentCount,
    deliveredCount: c.deliveredCount,
    openedCount: c.openedCount,
    clickedCount: c.clickedCount,
    failedCount: c.failedCount,
    bounceCount: c.bounceCount,
    relatedContactIds: c.relatedContactIds,
    sentAt: c.sentAt,
  };
}

/** Payload para borradores (mensaje y destinatarios completos en BD). */
export function buildCreateCampaignPayload(c: Campaign) {
  return {
    name: c.name,
    status: c.status,
    channel: c.channel,
    message: {
      ...c.message,
      attachments: c.message.attachments?.map(
        ({ id, fileName, mimeType, sizeBytes }) => ({
          id,
          fileName,
          mimeType,
          sizeBytes,
        }),
      ),
    },
    recipients: c.recipients,
    results: c.results,
    sentCount: c.sentCount,
    deliveredCount: c.deliveredCount,
    openedCount: c.openedCount,
    clickedCount: c.clickedCount,
    failedCount: c.failedCount,
    bounceCount: c.bounceCount,
    relatedContactIds: c.relatedContactIds,
    sentAt: c.sentAt,
  };
}

export type CampaignListPage = {
  items: CampaignListItem[];
  total: number;
  page: number;
  limit: number;
};

export async function listCampaignSummariesApi(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<CampaignListPage> {
  const q = new URLSearchParams();
  if (params?.page != null) q.set('page', String(params.page));
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.search?.trim()) q.set('search', params.search.trim());
  const qs = q.toString();
  return api<CampaignListPage>(`/campaigns${qs ? `?${qs}` : ''}`);
}

export async function getCampaignApi(id: string): Promise<Campaign> {
  const raw = await api<Record<string, unknown>>(
    `/campaigns/${encodeURIComponent(id)}`,
  );
  return parseCampaignDetail(raw);
}

export type CampaignCreatePayload =
  | ReturnType<typeof buildCreateCampaignPayload>
  | ReturnType<typeof buildSentCampaignPersistPayload>;

export async function createCampaignApi(
  payload: CampaignCreatePayload,
): Promise<Campaign> {
  const raw = await api<Record<string, unknown>>('/campaigns', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return parseCampaignDetail(raw);
}

export async function updateCampaignApi(
  id: string,
  payload: ReturnType<typeof buildCreateCampaignPayload>,
): Promise<Campaign> {
  const raw = await api<Record<string, unknown>>(
    `/campaigns/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return parseCampaignDetail(raw);
}

export async function deleteCampaignApi(id: string): Promise<void> {
  await api<unknown>(`/campaigns/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
