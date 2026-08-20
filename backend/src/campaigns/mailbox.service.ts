import { createHash } from 'crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { InboundEmailService } from './inbound-email.service';

export type MailboxFolder = 'inbox' | 'sent';

export type MailboxThreadSummary = {
  id: string;
  subject: string;
  counterpart: string;
  preview: string;
  lastAt: string;
  lastDirection: 'inbound' | 'outbound';
  inboundCount: number;
  outboundCount: number;
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
};

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

type BuiltMessage = MailboxMessage & { counterpart: string; subjectKey: string };

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
      items: filtered.slice(skip, skip + take),
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
    const threads = await this.buildThreads();
    const found = threads.find((t) => t.id === id);
    if (!found) {
      throw new NotFoundException('Conversación no encontrada');
    }
    await this.hydrateMessages(found.messages);
    return {
      id: found.id,
      subject: found.subject,
      counterpart: found.counterpart,
      messages: found.messages,
    };
  }

  private async buildThreads(): Promise<
    (MailboxThreadSummary & { messages: MailboxMessage[] })[]
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
      const subject =
        row.subject?.trim() || '(Sin asunto)';
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
        messages: list.map(
          ({ counterpart: _c, subjectKey: _s, ...msg }) => msg,
        ),
      };
    });

    threads.sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
    );

    return threads;
  }

  private async hydrateMessages(messages: MailboxMessage[]) {
    for (const msg of messages) {
      if (msg.html?.trim() || msg.text?.trim()) continue;
      if (msg.direction === 'inbound' && msg.id.startsWith('in:')) {
        const dbId = msg.id.slice(3);
        const row = await this.prisma.resendInboundEmail.findUnique({
          where: { id: dbId },
        });
        if (row?.resendEmailId) {
          const filled = await this.fetchInboundBody(row.resendEmailId);
          if (filled) {
            msg.html = filled.html;
            msg.text = filled.text;
          }
        }
      }
      if (msg.direction === 'outbound' && msg.id.startsWith('out:')) {
        const dbId = msg.id.slice(4);
        const row = await this.prisma.campaignResendMessage.findUnique({
          where: { id: dbId },
        });
        if (row?.html) {
          msg.html = row.html;
        } else if (row?.resendEmailId) {
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
