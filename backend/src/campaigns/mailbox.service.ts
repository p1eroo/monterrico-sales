import { createHash } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  InboundEmailService,
  parseInboundAttachments,
  type InboundEmailAttachment,
} from './inbound-email.service';

export type MailboxFolder = 'inbox' | 'sent';

export type MailboxAttachment = {
  id?: string;
  filename?: string;
  contentType?: string;
  size?: number;
};

export type MailboxThreadSummary = {
  id: string;
  subject: string;
  counterpart: string;
  preview: string;
  lastAt: string;
  lastDirection: 'inbound' | 'outbound';
  inboundCount: number;
  outboundCount: number;
  hasAttachments: boolean;
};

export type MailboxMessage = {
  id: string;
  direction: 'inbound' | 'outbound';
  fromEmail: string;
  toEmails: string[];
  subject: string;
  html?: string;
  text?: string;
  at: string;
  status?: string;
  attachments: MailboxAttachment[];
};

const MAX_INLINE_EMBED_BYTES = 3 * 1024 * 1024;

function normalizeEmail(raw: string): string {
  const s = raw.trim().toLowerCase();
  const m = s.match(/<([^>]+)>/);
  return (m?.[1] ?? s).trim();
}

function normalizeSubject(raw: string): string {
  let t = (raw ?? '').trim();
  let prev = '';
  while (t !== prev) {
    prev = t;
    t = t.replace(/^(re|fw|fwd|rv|res)\s*:\s*/i, '').trim();
  }
  return t.toLowerCase() || '(sin asunto)';
}

function threadIdFor(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 24);
}

function stripPreview(htmlOrText: string): string {
  return htmlOrText
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function replySubject(subject: string): string {
  const trimmed = subject.trim() || '(Sin asunto)';
  if (/^re:/i.test(trimmed)) return trimmed;
  return `Re: ${trimmed}`;
}

function cidKey(raw?: string): string {
  return (raw ?? '').replace(/^<|>$/g, '').trim().toLowerCase();
}

function isImageMime(mime?: string, filename?: string): boolean {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return true;
  const name = (filename ?? '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}

function publicAttachments(
  list: InboundEmailAttachment[],
): MailboxAttachment[] {
  return list
    .filter((a) => a.id || a.filename)
    .map((a) => ({
      id: a.id,
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
    }));
}

type BuiltMessage = MailboxMessage & {
  counterpart: string;
  subjectKey: string;
  messageId?: string;
  resendEmailId?: string;
};

@Injectable()
export class MailboxService {
  private readonly logger = new Logger(MailboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly inbound: InboundEmailService,
  ) {}

  async listThreads(params: {
    folder: MailboxFolder;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{
    items: MailboxThreadSummary[];
    total: number;
    page: number;
    limit: number;
    inboxCount: number;
    sentCount: number;
  }> {
    await this.inbound.refreshInbound();
    const threads = await this.buildThreads();
    const q = params.search?.trim().toLowerCase();
    const inbox = threads.filter((t) => t.inboundCount > 0);
    const sent = threads.filter((t) => t.outboundCount > 0);
    let filtered = params.folder === 'sent' ? sent : inbox;
    if (q) {
      filtered = filtered.filter(
        (t) =>
          t.subject.toLowerCase().includes(q) ||
          t.counterpart.includes(q) ||
          t.preview.toLowerCase().includes(q),
      );
    }
    const take = Math.min(Math.max(1, params.limit ?? 40), 100);
    const page = Math.max(1, params.page ?? 1);
    const skip = (page - 1) * take;
    return {
      items: filtered.slice(skip, skip + take).map(this.toSummary),
      total: filtered.length,
      page,
      limit: take,
      inboxCount: inbox.length,
      sentCount: sent.length,
    };
  }

  async getThread(id: string): Promise<{
    id: string;
    subject: string;
    counterpart: string;
    messages: MailboxMessage[];
  }> {
    const found = await this.findThread(id);
    await this.hydrateMessages(found.messages);
    return {
      id: found.id,
      subject: found.subject,
      counterpart: found.counterpart,
      messages: found.messages.map((m) => this.toPublicMessage(m)),
    };
  }

  async replyToThread(
    id: string,
    htmlBody: string,
  ): Promise<{
    id: string;
    subject: string;
    counterpart: string;
    messages: MailboxMessage[];
  }> {
    if (!this.mail.isConfigured()) {
      throw new ServiceUnavailableException(
        'Resend no configurado. Revisa RESEND_API_KEY y RESEND_FROM.',
      );
    }
    const html = htmlBody?.trim() ?? '';
    if (!stripHtml(html)) {
      throw new BadRequestException('El mensaje no puede estar vacío');
    }

    const found = await this.findThread(id);
    const inboundTarget = [...found.messages]
      .reverse()
      .find((m) => m.direction === 'inbound');
    const subjectSource = inboundTarget ?? found.messages[found.messages.length - 1];
    if (!subjectSource) {
      throw new NotFoundException('No hay un correo al que responder');
    }

    const to = inboundTarget
      ? normalizeEmail(inboundTarget.fromEmail)
      : found.counterpart;
    if (!to || !to.includes('@')) {
      throw new BadRequestException('No se pudo determinar el destinatario');
    }

    const headers: Record<string, string> = {};
    if (inboundTarget?.messageId?.trim()) {
      headers['In-Reply-To'] = inboundTarget.messageId.trim();
      const refs = found.messages
        .map((m) => m.messageId?.trim())
        .filter((v): v is string => Boolean(v));
      if (refs.length) {
        headers.References = refs.join(' ');
      }
    }

    const subject = replySubject(subjectSource.subject);
    const sent = await this.mail.sendHtmlEmail({
      to,
      subject,
      html,
      headers: Object.keys(headers).length ? headers : undefined,
      tags: [
        { name: 'kind', value: 'mailbox-reply' },
        { name: 'thread', value: id.slice(0, 256) },
      ],
    });

    await this.prisma.campaignResendMessage.create({
      data: {
        resendEmailId: sent.id,
        toEmail: to,
        status: 'enviado',
        sentAt: new Date(),
        subject,
        html,
        fromEmail: this.mail.fromAddress(),
      },
    });

    return this.getThread(id);
  }

  async downloadAttachment(
    messageId: string,
    attachmentId: string,
  ): Promise<{ data: Buffer; filename: string; mimeType: string }> {
    if (messageId.startsWith('in:')) {
      return this.inbound.downloadAttachment(messageId.slice(3), attachmentId);
    }
    if (messageId.startsWith('out:')) {
      const row = await this.prisma.campaignResendMessage.findUnique({
        where: { id: messageId.slice(4) },
      });
      if (!row?.resendEmailId) {
        throw new NotFoundException('Mensaje no encontrado');
      }
      let meta = await this.mail
        .listSentAttachments(row.resendEmailId)
        .then((list) => list.find((a) => a.id === attachmentId) ?? null)
        .catch(() => null);
      if (!meta?.downloadUrl) {
        throw new NotFoundException('Adjunto no encontrado');
      }
      const data = await this.mail.downloadFromUrl(meta.downloadUrl);
      return {
        data,
        filename: meta.filename?.trim() || 'adjunto',
        mimeType: meta.contentType?.trim() || 'application/octet-stream',
      };
    }
    throw new NotFoundException('Mensaje no encontrado');
  }

  private toSummary(
    thread: MailboxThreadSummary & { messages: MailboxMessage[] },
  ): MailboxThreadSummary {
    return {
      id: thread.id,
      subject: thread.subject,
      counterpart: thread.counterpart,
      preview: thread.preview,
      lastAt: thread.lastAt,
      lastDirection: thread.lastDirection,
      inboundCount: thread.inboundCount,
      outboundCount: thread.outboundCount,
      hasAttachments: thread.hasAttachments,
    };
  }

  private toPublicMessage(msg: BuiltMessage | MailboxMessage): MailboxMessage {
    return {
      id: msg.id,
      direction: msg.direction,
      fromEmail: msg.fromEmail,
      toEmails: msg.toEmails,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      at: msg.at,
      status: msg.status,
      attachments: msg.attachments ?? [],
    };
  }

  private async findThread(id: string) {
    const threads = await this.buildThreads();
    const found = threads.find((t) => t.id === id);
    if (!found) {
      throw new NotFoundException('Conversación no encontrada');
    }
    return found;
  }

  private async buildThreads(): Promise<
    (MailboxThreadSummary & { messages: BuiltMessage[] })[]
  > {
    const [inbound, outbound] = await Promise.all([
      this.prisma.resendInboundEmail.findMany({
        orderBy: { receivedAt: 'desc' },
        take: 300,
      }),
      this.prisma.campaignResendMessage.findMany({
        orderBy: { sentAt: 'desc' },
        take: 300,
        include: {
          campaign: { select: { subjectSnapshot: true, name: true } },
        },
      }),
    ]);

    const messages: BuiltMessage[] = [];

    for (const row of inbound) {
      const counterpart = normalizeEmail(row.fromEmail);
      const subject = row.subject?.trim() || '(Sin asunto)';
      messages.push({
        id: `in:${row.id}`,
        direction: 'inbound',
        fromEmail: row.fromEmail,
        toEmails: row.toEmails,
        subject,
        html: row.html ?? undefined,
        text: row.text ?? undefined,
        at: row.receivedAt.toISOString(),
        counterpart,
        subjectKey: normalizeSubject(subject),
        messageId: row.messageId ?? undefined,
        resendEmailId: row.resendEmailId,
        attachments: publicAttachments(parseInboundAttachments(row.attachmentsJson)),
      });
    }

    for (const row of outbound) {
      const counterpart = normalizeEmail(row.toEmail);
      const subject =
        row.subject?.trim() ||
        row.campaign?.subjectSnapshot?.trim() ||
        row.campaign?.name?.trim() ||
        '(Sin asunto)';
      messages.push({
        id: `out:${row.id}`,
        direction: 'outbound',
        fromEmail: row.fromEmail || 'Taxi Monterrico',
        toEmails: [row.toEmail],
        subject,
        html: row.html ?? undefined,
        at: row.sentAt.toISOString(),
        status: row.status,
        counterpart,
        subjectKey: normalizeSubject(subject),
        resendEmailId: row.resendEmailId,
        attachments: [],
      });
    }

    const groups = new Map<string, BuiltMessage[]>();
    for (const msg of messages) {
      const key = `${msg.counterpart}|${msg.subjectKey}`;
      const list = groups.get(key) ?? [];
      list.push(msg);
      groups.set(key, list);
    }

    const threads = [...groups.entries()].map(([key, list]) => {
      list.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      const last = list[list.length - 1]!;
      const inboundCount = list.filter((m) => m.direction === 'inbound').length;
      const outboundCount = list.filter((m) => m.direction === 'outbound').length;
      const previewSrc = last.text || last.html || last.subject;
      return {
        id: threadIdFor(key),
        subject: last.subject,
        counterpart: last.counterpart,
        preview: stripPreview(previewSrc),
        lastAt: last.at,
        lastDirection: last.direction,
        inboundCount,
        outboundCount,
        hasAttachments: list.some((m) => (m.attachments?.length ?? 0) > 0),
        messages: list,
      };
    });

    threads.sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
    );

    return threads;
  }

  private async hydrateMessages(messages: BuiltMessage[]) {
    for (const msg of messages) {
      if (msg.direction === 'inbound' && msg.id.startsWith('in:')) {
        const dbId = msg.id.slice(3);
        const row = await this.prisma.resendInboundEmail.findUnique({
          where: { id: dbId },
        });
        if (!row) continue;
        if (!(msg.html?.trim() || msg.text?.trim()) && row.resendEmailId) {
          const filled = await this.fetchInboundBody(row.resendEmailId);
          if (filled) {
            msg.html = filled.html;
            msg.text = filled.text;
          }
        }
        const stored = parseInboundAttachments(row.attachmentsJson);
        let attachments = stored;
        if (
          this.mail.isConfigured() &&
          (stored.length === 0 || stored.some((a) => !a.id))
        ) {
          try {
            const listed = await this.mail.listReceivingAttachments(
              row.resendEmailId,
            );
            if (listed.length) {
              attachments = listed.map((a) => ({
                id: a.id,
                filename: a.filename,
                contentType: a.contentType,
                contentDisposition: a.contentDisposition,
                contentId: a.contentId,
                size: a.size,
              }));
              await this.prisma.resendInboundEmail.update({
                where: { id: dbId },
                data: { attachmentsJson: attachments },
              });
            }
          } catch (err) {
            this.logger.warn(
              `Adjuntos inbound ${row.resendEmailId}: ${err instanceof Error ? err.message : err}`,
            );
          }
        }
        msg.attachments = publicAttachments(attachments);
        if (msg.html?.trim()) {
          msg.html = await this.embedCidImages(
            msg.html,
            row.resendEmailId,
            attachments,
          );
        }
        continue;
      }

      if (msg.direction === 'outbound' && msg.id.startsWith('out:')) {
        const dbId = msg.id.slice(4);
        const row = await this.prisma.campaignResendMessage.findUnique({
          where: { id: dbId },
        });
        if (!row) continue;
        if (!msg.html?.trim()) {
          if (row.html) {
            msg.html = row.html;
          } else if (row.resendEmailId) {
            const html = await this.fetchOutboundBody(row.resendEmailId);
            if (html) {
              msg.html = html;
              await this.prisma.campaignResendMessage.update({
                where: { id: dbId },
                data: { html },
              });
            }
          }
        }
      }
    }
  }

  private async embedCidImages(
    html: string,
    resendEmailId: string,
    attachments: InboundEmailAttachment[],
  ): Promise<string> {
    if (!/cid:/i.test(html) || !this.mail.isConfigured()) return html;
    const needed = attachments.filter(
      (a) => a.id && (a.contentId || isImageMime(a.contentType, a.filename)),
    );
    if (!needed.length) return html;

    let listed: Awaited<ReturnType<MailService['listReceivingAttachments']>> = [];
    try {
      listed = await this.mail.listReceivingAttachments(resendEmailId);
    } catch (err) {
      this.logger.warn(
        `CID inbound ${resendEmailId}: ${err instanceof Error ? err.message : err}`,
      );
      return html;
    }

    const cidMap = new Map<string, string>();
    for (const att of needed) {
      const meta = listed.find((a) => a.id === att.id);
      if (!meta?.downloadUrl) continue;
      if ((meta.size ?? 0) > MAX_INLINE_EMBED_BYTES) continue;
      try {
        const buf = await this.mail.downloadFromUrl(meta.downloadUrl);
        if (buf.length > MAX_INLINE_EMBED_BYTES) continue;
        const mime =
          meta.contentType?.trim() ||
          att.contentType?.trim() ||
          'image/png';
        if (!mime.startsWith('image/')) continue;
        const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
        const keys = [cidKey(att.contentId), cidKey(meta.contentId), cidKey(att.id)];
        for (const key of keys) {
          if (key) cidMap.set(key, dataUrl);
        }
      } catch (err) {
        this.logger.warn(
          `No se pudo incrustar ${att.filename ?? att.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (!cidMap.size) return html;
    return html.replace(/cid:([^"'>\s]+)/gi, (full, raw: string) => {
      const key = cidKey(decodeURIComponent(String(raw)));
      return cidMap.get(key) ?? full;
    });
  }

  private async fetchInboundBody(resendEmailId: string) {
    if (!this.mail.isConfigured()) return null;
    const { data, error } = await this.mail
      .client()
      .emails.receiving.get(resendEmailId);
    if (error || !data) return null;
    const html = typeof data.html === 'string' ? data.html : undefined;
    const text = typeof data.text === 'string' ? data.text : undefined;
    await this.prisma.resendInboundEmail.update({
      where: { resendEmailId },
      data: {
        html: html ?? undefined,
        text: text ?? undefined,
      },
    });
    return { html, text };
  }

  private async fetchOutboundBody(resendEmailId: string): Promise<string | undefined> {
    if (!this.mail.isConfigured()) return undefined;
    try {
      const { data, error } = await this.mail.client().emails.get(resendEmailId);
      if (error || !data) return undefined;
      return typeof data.html === 'string' ? data.html : undefined;
    } catch (err) {
      this.logger.warn(
        `No se pudo leer cuerpo enviado ${resendEmailId}: ${err instanceof Error ? err.message : err}`,
      );
      return undefined;
    }
  }
}
