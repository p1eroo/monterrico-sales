import { Injectable, UnauthorizedException } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GmailService {
  private getOAuth2Client(tokens: any) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
  }

  constructor(private readonly prisma: PrismaService) {}

  private async getGmailClient(userId: string) {
    const account = await this.prisma.account.findFirst({
      where: { userId, provider: 'google' },
      select: { tokens: true },
    });
    if (!account?.tokens) {
      throw new UnauthorizedException('Google account not connected');
    }
    const auth = this.getOAuth2Client(account.tokens);
    return google.gmail({ version: 'v1', auth });
  }

  async listMessages(userId: string, opts?: { maxResults?: number; labelIds?: string[]; pageToken?: string; q?: string }) {
    const gmail = await this.getGmailClient(userId);
    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults: opts?.maxResults ?? 50,
      labelIds: opts?.labelIds,
      pageToken: opts?.pageToken,
      q: opts?.q,
    });
    const messages = res.data.messages ?? [];
    const list = await Promise.all(
      messages.map(async (m) => {
        const detail = await gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'metadata' });
        const headers = detail.data.payload?.headers ?? [];
        return {
          id: m.id,
          threadId: detail.data.threadId,
          subject: headers.find((h) => h.name === 'Subject')?.value ?? '',
          from: headers.find((h) => h.name === 'From')?.value ?? '',
          date: headers.find((h) => h.name === 'Date')?.value ?? '',
          snippet: detail.data.snippet ?? '',
          labelIds: detail.data.labelIds ?? [],
        };
      }),
    );
    return { messages: list, nextPageToken: res.data.nextPageToken ?? null, resultSizeEstimate: res.data.resultSizeEstimate ?? 0 };
  }

  async getMessage(userId: string, messageId: string) {
    const gmail = await this.getGmailClient(userId);
    const res = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    const headers = res.data.payload?.headers ?? [];
    const parts = res.data.payload?.parts ?? [];
    const attachments: any[] = [];
    const body = this.extractBody(res.data.payload);

    const extractAttachments = (parts: any[]) => {
      for (const p of parts) {
        if (p.filename && p.body?.attachmentId) {
          attachments.push({
            filename: p.filename,
            mimeType: p.mimeType,
            attachmentId: p.body.attachmentId,
            size: p.body.size,
          });
        }
        if (p.parts) extractAttachments(p.parts);
      }
    };
    extractAttachments(parts);

    return {
      id: res.data.id,
      threadId: res.data.threadId,
      subject: headers.find((h) => h.name === 'Subject')?.value ?? '',
      from: headers.find((h) => h.name === 'From')?.value ?? '',
      to: headers.find((h) => h.name === 'To')?.value ?? '',
      date: headers.find((h) => h.name === 'Date')?.value ?? '',
      cc: headers.find((h) => h.name === 'Cc')?.value ?? '',
      body: (body || res.data.snippet) ?? '',
      attachments,
      labelIds: res.data.labelIds ?? [],
    };
  }

  private extractBody(payload: any): string {
    if (!payload) return '';
    const logPrefix = `[extractBody] mimeType=${payload.mimeType} parts=${payload.parts?.length ?? 0}`;
    // Try body data directly
    if (payload.body?.data) {
      try {
        const decoded = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
        if (decoded.trim()) { console.log(`${logPrefix} found direct body data (base64url) length=${decoded.length}`); return decoded; }
      } catch {}
      try {
        const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        if (decoded.trim()) { console.log(`${logPrefix} found direct body data (base64) length=${decoded.length}`); return decoded; }
      } catch {}
    }
    // Search through parts — prefer text/html over text/plain
    if (payload.parts) {
      let plainContent = '';
      for (const [i, p] of payload.parts.entries()) {
        console.log(`${logPrefix} part[${i}] mimeType=${p.mimeType} hasData=${!!p.body?.data} dataLen=${p.body?.data?.length ?? 0}`);
        if (p.mimeType === 'text/html' && p.body?.data) {
          try {
            const decoded = Buffer.from(p.body.data, 'base64url').toString('utf-8');
            if (decoded.trim()) { console.log(`${logPrefix} found text/html in part[${i}] length=${decoded.length}`); return decoded; }
          } catch {}
          try {
            const decoded = Buffer.from(p.body.data, 'base64').toString('utf-8');
            if (decoded.trim()) { console.log(`${logPrefix} found text/html in part[${i}] (base64) length=${decoded.length}`); return decoded; }
          } catch {}
        }
        if (p.mimeType === 'text/plain' && p.body?.data) {
          try {
            const decoded = Buffer.from(p.body.data, 'base64url').toString('utf-8');
            if (decoded.trim() && !plainContent) { console.log(`${logPrefix} saving text/plain in part[${i}] length=${decoded.length}`); plainContent = decoded; }
          } catch {}
          try {
            const decoded = Buffer.from(p.body.data, 'base64').toString('utf-8');
            if (decoded.trim() && !plainContent) { console.log(`${logPrefix} saving text/plain in part[${i}] (base64) length=${decoded.length}`); plainContent = decoded; }
          } catch {}
        }
        // Recurse into nested parts
        if (p.parts) {
          const nested = this.extractBody(p);
          if (nested.trim()) { console.log(`${logPrefix} nested found content length=${nested.length}`); return nested; }
        }
      }
      if (plainContent) { console.log(`${logPrefix} falling back to text/plain length=${plainContent.length}`); return plainContent; }
    }
    console.log(`${logPrefix} no content found`);
    return '';
  }

  async sendMessage(userId: string, to: string, subject: string, bodyHtml: string, cc?: string) {
    const gmail = await this.getGmailClient(userId);
    const emailLines: string[] = [];
    emailLines.push(`From: me`);
    emailLines.push(`To: ${to}`);
    if (cc) emailLines.push(`Cc: ${cc}`);
    emailLines.push(`Subject: ${subject}`);
    emailLines.push('MIME-Version: 1.0');
    emailLines.push('Content-Type: text/html; charset=utf-8');
    emailLines.push('');
    emailLines.push(bodyHtml);
    const encoded = Buffer.from(emailLines.join('\r\n')).toString('base64url');
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
  }

  async getUserProfile(userId: string) {
    const gmail = await this.getGmailClient(userId);
    const res = await gmail.users.getProfile({ userId: 'me' });
    return res.data;
  }
}
