import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignsService } from './campaigns.service';
import { MailService } from '../mail/mail.service';

export type InboundEmailListItem = {
  id: string;
  resendEmailId: string;
  fromEmail: string;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  messageId?: string;
  attachmentCount: number;
  receivedAt: string;
};

export type InboundEmailDetail = InboundEmailListItem & {
  html?: string;
  text?: string;
  attachments: { filename?: string; contentType?: string; size?: number }[];
};

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function asIsoDate(value: unknown, fallback = new Date()): Date {
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
}

function attachmentsFromUnknown(value: unknown): Prisma.InputJsonValue {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== 'object') return {};
    const a = item as Record<string, unknown>;
    return {
      id: a.id != null ? String(a.id) : undefined,
      filename: a.filename != null ? String(a.filename) : undefined,
      contentType:
        a.content_type != null
          ? String(a.content_type)
          : a.contentType != null
            ? String(a.contentType)
            : undefined,
      contentDisposition:
        a.content_disposition != null
          ? String(a.content_disposition)
          : undefined,
      contentId: a.content_id != null ? String(a.content_id) : undefined,
      size: typeof a.size === 'number' ? a.size : undefined,
    };
  }) as Prisma.InputJsonValue;
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

@Injectable()
export class InboundEmailService {
  private readonly logger = new Logger(InboundEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly campaigns: CampaignsService,
  ) {}

  async handleWebhook(
    rawPayload: string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ ok: true; type: string }> {
    let event: unknown;
    try {
      event = this.mail.verifyWebhook({
        payload: rawPayload,
        headers: {
          id: headerValue(headers, 'svix-id'),
          timestamp: headerValue(headers, 'svix-timestamp'),
          signature: headerValue(headers, 'svix-signature'),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Webhook Resend inválido: ${msg}`);
      throw new BadRequestException('Webhook Resend inválido');
    }

    const parsed =
      event && typeof event === 'object'
        ? (event as { type?: string; data?: Record<string, unknown> })
        : {};
    const type = parsed.type ?? 'unknown';

    if (type === 'email.received') {
      const data = parsed.data ?? {};
      const resendEmailId = String(data.email_id ?? data.id ?? '').trim();
      if (!resendEmailId) {
        throw new BadRequestException('email.received sin email_id');
      }
      await this.upsertFromResend({
        resendEmailId,
        fromEmail: String(data.from ?? ''),
        toEmails: asStringArray(data.to),
        ccEmails: asStringArray(data.cc),
        subject: String(data.subject ?? ''),
        messageId:
          data.message_id != null ? String(data.message_id) : undefined,
        attachments: data.attachments,
        receivedAt: asIsoDate(data.created_at),
      });
      await this.ensureBody(resendEmailId);
    } else if (
      type === 'email.opened' ||
      type === 'email.clicked' ||
      type === 'email.delivered' ||
      type === 'email.bounced' ||
      type === 'email.failed' ||
      type === 'email.complained'
    ) {
      await this.campaigns.applyResendTrackingEvent(type, parsed.data ?? {});
    } else {
      this.logger.log(`Webhook Resend ignorado: ${type}`);
    }

    return { ok: true, type };
  }

  async refreshInbound(): Promise<void> {
    await this.syncFromResend().catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Sync inbound Resend omitido: ${msg}`);
    });
  }

  async findPage(
    page = 1,
    limit = 50,
    search?: string,
  ): Promise<{
    items: InboundEmailListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.syncFromResend().catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Sync inbound Resend omitido: ${msg}`);
    });

    const take = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * take;
    const q = search?.trim();
    const where = q
      ? {
          OR: [
            { subject: { contains: q, mode: 'insensitive' as const } },
            { fromEmail: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, rows] = await Promise.all([
      this.prisma.resendInboundEmail.count({ where }),
      this.prisma.resendInboundEmail.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      total,
      page: safePage,
      limit: take,
      items: rows.map((row) => this.toListItem(row)),
    };
  }

  async findOne(id: string): Promise<InboundEmailDetail> {
    const row = await this.prisma.resendInboundEmail.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Correo no encontrado');
    }
    const withBody = await this.ensureBody(row.resendEmailId);
    return this.toDetail(withBody ?? row);
  }

  private async syncFromResend(): Promise<void> {
    if (!this.mail.isConfigured()) return;
    const { data, error } = await this.mail.client().emails.receiving.list({
      limit: 50,
    });
    if (error) {
      throw new Error(error.message || JSON.stringify(error));
    }
    const list = data?.data ?? [];
    for (const item of list) {
      await this.upsertFromResend({
        resendEmailId: String(item.id),
        fromEmail: String(item.from ?? ''),
        toEmails: asStringArray(item.to),
        ccEmails: asStringArray(item.cc),
        subject: String(item.subject ?? ''),
        messageId:
          item.message_id != null ? String(item.message_id) : undefined,
        attachments: item.attachments,
        receivedAt: asIsoDate(item.created_at),
      });
    }
  }

  private async upsertFromResend(params: {
    resendEmailId: string;
    fromEmail: string;
    toEmails: string[];
    ccEmails: string[];
    subject: string;
    messageId?: string;
    attachments: unknown;
    receivedAt: Date;
  }) {
    const attachmentsJson = attachmentsFromUnknown(params.attachments);
    await this.prisma.resendInboundEmail.upsert({
      where: { resendEmailId: params.resendEmailId },
      create: {
        resendEmailId: params.resendEmailId,
        fromEmail: params.fromEmail || '(sin remitente)',
        toEmails: params.toEmails,
        ccEmails: params.ccEmails,
        subject: params.subject,
        messageId: params.messageId,
        attachmentsJson,
        receivedAt: params.receivedAt,
      },
      update: {
        fromEmail: params.fromEmail || undefined,
        toEmails: params.toEmails,
        ccEmails: params.ccEmails,
        subject: params.subject,
        messageId: params.messageId,
        attachmentsJson,
        receivedAt: params.receivedAt,
      },
    });
  }

  private async ensureBody(resendEmailId: string) {
    const row = await this.prisma.resendInboundEmail.findUnique({
      where: { resendEmailId },
    });
    if (!row) return null;
    if ((row.html && row.html.trim()) || (row.text && row.text.trim())) {
      return row;
    }
    if (!this.mail.isConfigured()) return row;

    const { data, error } = await this.mail
      .client()
      .emails.receiving.get(resendEmailId);
    if (error || !data) {
      const msg = error?.message || 'sin cuerpo';
      this.logger.warn(`No se pudo leer cuerpo inbound ${resendEmailId}: ${msg}`);
      return row;
    }

    return this.prisma.resendInboundEmail.update({
      where: { resendEmailId },
      data: {
        html: typeof data.html === 'string' ? data.html : row.html,
        text: typeof data.text === 'string' ? data.text : row.text,
        subject: data.subject?.trim() ? data.subject : row.subject,
        fromEmail: data.from?.trim() ? data.from : row.fromEmail,
        toEmails: asStringArray(data.to).length ? asStringArray(data.to) : row.toEmails,
      },
    });
  }

  private attachmentCount(json: unknown): number {
    return Array.isArray(json) ? json.length : 0;
  }

  private toListItem(row: {
    id: string;
    resendEmailId: string;
    fromEmail: string;
    toEmails: string[];
    ccEmails: string[];
    subject: string;
    messageId: string | null;
    attachmentsJson: unknown;
    receivedAt: Date;
  }): InboundEmailListItem {
    return {
      id: row.id,
      resendEmailId: row.resendEmailId,
      fromEmail: row.fromEmail,
      toEmails: row.toEmails,
      ccEmails: row.ccEmails,
      subject: row.subject,
      messageId: row.messageId ?? undefined,
      attachmentCount: this.attachmentCount(row.attachmentsJson),
      receivedAt: row.receivedAt.toISOString(),
    };
  }

  private toDetail(row: {
    id: string;
    resendEmailId: string;
    fromEmail: string;
    toEmails: string[];
    ccEmails: string[];
    subject: string;
    html: string | null;
    text: string | null;
    messageId: string | null;
    attachmentsJson: unknown;
    receivedAt: Date;
  }): InboundEmailDetail {
    const attachments = Array.isArray(row.attachmentsJson)
      ? row.attachmentsJson.map((a) => {
          const rec = a && typeof a === 'object' ? (a as Record<string, unknown>) : {};
          return {
            filename: rec.filename != null ? String(rec.filename) : undefined,
            contentType:
              rec.contentType != null ? String(rec.contentType) : undefined,
            size: typeof rec.size === 'number' ? rec.size : undefined,
          };
        })
      : [];
    return {
      ...this.toListItem(row),
      html: row.html ?? undefined,
      text: row.text ?? undefined,
      attachments,
    };
  }
}
