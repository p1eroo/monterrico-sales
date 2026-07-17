import { api, apiBlob } from './api';

export type GmailMessage = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  labelIds: string[];
  hasAttachments?: boolean;
};

export type GmailMessageDetail = GmailMessage & {
  to: string;
  cc?: string;
  messageId?: string;
  /** HTML o texto plano (prioriza HTML). Compatibilidad con clientes antiguos. */
  body: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
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

export type GmailThreadDetail = {
  id: string;
  subject: string;
  messages: GmailMessageDetail[];
};

export async function fetchGmailThread(threadId: string): Promise<GmailThreadDetail> {
  return api<GmailThreadDetail>(`/gmail/threads/${threadId}`);
}

export async function markGmailThreadRead(threadId: string): Promise<void> {
  await api(`/gmail/threads/${encodeURIComponent(threadId)}/read`, { method: 'POST' });
}

export async function setGmailThreadStarred(threadId: string, starred: boolean): Promise<void> {
  await api(`/gmail/threads/${encodeURIComponent(threadId)}/star`, {
    method: 'POST',
    body: JSON.stringify({ starred }),
  });
}

export async function archiveGmailThread(threadId: string): Promise<void> {
  await api(`/gmail/threads/${encodeURIComponent(threadId)}/archive`, { method: 'POST' });
}

export async function trashGmailThread(threadId: string): Promise<void> {
  await api(`/gmail/threads/${encodeURIComponent(threadId)}/trash`, { method: 'POST' });
}

export async function markGmailThreadUnread(threadId: string): Promise<void> {
  await api(`/gmail/threads/${encodeURIComponent(threadId)}/unread`, { method: 'POST' });
}

export type GmailAttachmentInput = {
  fileName: string;
  mimeType?: string;
  contentBase64: string;
};

export type SendGmailMessageOptions = {
  cc?: string;
  threadId?: string;
  inReplyTo?: string;
  attachments?: GmailAttachmentInput[];
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const i = result.indexOf('base64,');
      resolve(i >= 0 ? result.slice(i + 7) : result);
    };
    reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function filesToGmailAttachments(files: File[]): Promise<GmailAttachmentInput[]> {
  const attachments: GmailAttachmentInput[] = [];
  for (const file of files) {
    attachments.push({
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      contentBase64: await readFileAsBase64(file),
    });
  }
  return attachments;
}

export async function sendGmailMessage(
  to: string,
  subject: string,
  body: string,
  options?: SendGmailMessageOptions,
): Promise<void> {
  await api('/gmail/send', {
    method: 'POST',
    body: JSON.stringify({
      to,
      subject,
      body,
      cc: options?.cc,
      threadId: options?.threadId,
      inReplyTo: options?.inReplyTo,
      attachments: options?.attachments?.length ? options.attachments : undefined,
    }),
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

export async function downloadGmailAttachment(messageId: string, attachmentId: string, filename: string): Promise<void> {
  const blob = await apiBlob(`/gmail/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`);
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
