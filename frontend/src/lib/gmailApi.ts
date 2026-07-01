import { api } from './api';

export type GmailMessage = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  labelIds: string[];
};

export type GmailMessageDetail = GmailMessage & {
  to: string;
  cc?: string;
  body: string;
  attachments: {
    filename: string;
    mimeType: string;
    attachmentId: string;
    size: number;
  }[];
};

export type GmailListResponse = {
  messages: GmailMessage[];
  nextPageToken: string | null;
  resultSizeEstimate: number;
};

export async function fetchGmailMessages(maxResults?: number, pageToken?: string, labelIds?: string[], q?: string): Promise<GmailListResponse> {
  const params = new URLSearchParams();
  if (maxResults) params.set('maxResults', String(maxResults));
  if (pageToken) params.set('pageToken', pageToken);
  if (labelIds) params.set('labelIds', labelIds.join(','));
  if (q) params.set('q', q);
  const qs = params.toString();
  return api<GmailListResponse>(`/gmail/messages${qs ? `?${qs}` : ''}`);
}

export async function fetchGmailMessage(id: string): Promise<GmailMessageDetail> {
  return api<GmailMessageDetail>(`/gmail/messages/${id}`);
}

export async function sendGmailMessage(to: string, subject: string, body: string, cc?: string): Promise<void> {
  await api('/gmail/send', {
    method: 'POST',
    body: JSON.stringify({ to, subject, body, cc }),
  });
}

export async function fetchGmailProfile(): Promise<{ emailAddress: string; messagesTotal: number }> {
  return api('/gmail/profile');
}

export async function linkEmailToCRM(to: string, subject: string): Promise<{ linked: { email: string; contactId?: string; companyId?: string; opportunityId?: string }[] }> {
  return api('/gmail/link', {
    method: 'POST',
    body: JSON.stringify({ to, subject }),
  });
}
