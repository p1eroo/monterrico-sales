import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Campaign as CampaignRecord } from '../generated/prisma';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { MailService, type MailAttachmentInput } from '../mail/mail.service';
import type { CreateCampaignDto } from './dto/create-campaign.dto';
import type { SendCampaignEmailDto } from './dto/send-campaign-email.dto';
import type { UpdateCampaignDto } from './dto/update-campaign.dto';

export type CampaignSendResultRow = {
  recipientId: string;
  contactId?: string;
  name: string;
  email: string;
  status: 'entregado' | 'fallido';
  sentAt?: string;
  errorMessage?: string;
};

const DEFAULT_DELAY_MIN_MS = 2000;
const DEFAULT_DELAY_MAX_MS = 5000;
const DEFAULT_MAX_PER_RECIPIENT_HOUR = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelayMs(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(lo + Math.random() * (hi - lo + 1));
}

function applyTemplate(
  text: string,
  r: { name: string; email: string; company?: string },
): string {
  return text
    .replace(/\{\{nombre\}\}/g, r.name ?? '')
    .replace(/\{\{empresa\}\}/g, r.company ?? '')
    .replace(/\{\{email\}\}/g, r.email ?? '');
}

function buildAttachments(
  dto?: { fileName: string; mimeType?: string; contentBase64: string }[],
): MailAttachmentInput[] | undefined {
  if (!dto?.length) {
    return undefined;
  }
  const out: MailAttachmentInput[] = [];
  for (const a of dto) {
    const name = a.fileName?.trim();
    const b64 = a.contentBase64?.trim();
    if (!name || !b64) {
      continue;
    }
    try {
      const content = Buffer.from(b64, 'base64');
      if (content.length === 0) {
        continue;
      }
      out.push({
        filename: name,
        content,
        contentType: a.mimeType?.trim() || undefined,
      });
    } catch {
      throw new BadRequestException(`Adjunto inválido: ${name}`);
    }
  }
  return out.length ? out : undefined;
}

const SUBJECT_SNAPSHOT_MAX = 500;

function sliceSubject(s: string): string {
  return s.trim().slice(0, SUBJECT_SNAPSHOT_MAX);
}

function subjectFromMessageJson(msg: unknown): string {
  if (msg && typeof msg === 'object' && msg !== null && 'subject' in msg) {
    return sliceSubject(String((msg as Record<string, unknown>).subject ?? ''));
  }
  return '';
}

function bodyFromMessageJson(msg: unknown, status: string): string {
  if (msg == null || typeof msg !== 'object') {
    return '';
  }
  const b = (msg as Record<string, unknown>).body;
  if (typeof b !== 'string') {
    return '';
  }
  if (status === 'sent' && !b.trim()) {
    return '';
  }
  return b;
}

function recipientsFromResultsJson(results: unknown): unknown[] {
  if (!Array.isArray(results)) {
    return [];
  }
  return results.map((x: Record<string, unknown>) => ({
    id: String(x.recipientId ?? ''),
    name: String(x.name ?? ''),
    email: String(x.email ?? ''),
    contactId: x.contactId != null ? String(x.contactId) : undefined,
  }));
}

export type CampaignSummaryItem = {
  id: string;
  name: string;
  status: string;
  channel: string;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  failedCount: number;
  bounceCount: number;
  createdAt: string;
  sentAt?: string;
  createdByName: string;
};

@Injectable()
export class CampaignsService {
  constructor(
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private toFullPayload(row: CampaignRecord) {
    const resultsRaw = row.resultsJson ?? [];
    const storedRec = row.recipientsJson;
    const hasRecipients = Array.isArray(storedRec) && storedRec.length > 0;
    const recipients = hasRecipients
      ? storedRec
      : row.status === 'sent'
        ? recipientsFromResultsJson(resultsRaw)
        : Array.isArray(storedRec)
          ? storedRec
          : [];

    const subject =
      (row.subjectSnapshot ?? '').trim() ||
      subjectFromMessageJson(row.messageJson);
    const body = bodyFromMessageJson(row.messageJson, row.status);

    return {
      id: row.id,
      name: row.name,
      status: row.status,
      channel: row.channel,
      message: {
        channel: row.channel,
        subject: subject || undefined,
        body,
        variables: [] as string[],
        attachments: [] as unknown[],
      },
      subjectSnapshot: row.subjectSnapshot ?? undefined,
      recipients,
      results: resultsRaw,
      recipientCount: row.recipientCount,
      sentCount: row.sentCount,
      deliveredCount: row.deliveredCount,
      openedCount: row.openedCount,
      clickedCount: row.clickedCount,
      failedCount: row.failedCount,
      bounceCount: row.bounceCount,
      createdAt: row.createdAt.toISOString().slice(0, 10),
      sentAt: row.sentAt?.toISOString(),
      createdBy: row.createdById,
      createdByName: row.createdByName,
      relatedContactIds: row.relatedContactIds,
    };
  }

  async findSummariesPage(
    page = 1,
    limit = 50,
    search?: string,
  ): Promise<{
    items: CampaignSummaryItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const take = Math.min(Math.max(1, limit), 200);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * take;
    const where = search?.trim()
      ? { name: { contains: search.trim(), mode: 'insensitive' as const } }
      : {};

    const [total, rows] = await Promise.all([
      this.prisma.campaign.count({ where }),
      this.prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          name: true,
          status: true,
          channel: true,
          recipientCount: true,
          sentCount: true,
          deliveredCount: true,
          openedCount: true,
          clickedCount: true,
          failedCount: true,
          bounceCount: true,
          createdAt: true,
          sentAt: true,
          createdByName: true,
        },
      }),
    ]);

    return {
      total,
      page: safePage,
      limit: take,
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        channel: row.channel,
        recipientCount: row.recipientCount,
        sentCount: row.sentCount,
        deliveredCount: row.deliveredCount,
        openedCount: row.openedCount,
        clickedCount: row.clickedCount,
        failedCount: row.failedCount,
        bounceCount: row.bounceCount,
        createdAt: row.createdAt.toISOString().slice(0, 10),
        sentAt: row.sentAt?.toISOString(),
        createdByName: row.createdByName,
      })),
    };
  }

  async findOne(id: string) {
    const row = await this.prisma.campaign.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Campaña no encontrada');
    }
    return this.toFullPayload(row);
  }

  async create(dto: CreateCampaignDto, userId: string, userName: string) {
    if (dto.status === 'scheduled') {
      throw new BadRequestException('El envío programado no está disponible');
    }
    const isDraft = dto.status === 'draft';
    const isSent = dto.status === 'sent';

    const rawName = (dto.name ?? '').trim();
    const name =
      rawName ||
      (isDraft
        ? 'Borrador sin nombre'
        : isSent
          ? 'Campaña sin nombre'
          : '');
    if (!name) {
      throw new BadRequestException('El nombre de la campaña es obligatorio');
    }

    const recipients = Array.isArray(dto.recipients) ? dto.recipients : [];
    const resultsArr = Array.isArray(dto.results) ? dto.results : [];

    if (isSent) {
      const n =
        dto.sentCount ?? resultsArr.length;
      if (n === 0) {
        throw new BadRequestException('Sin resultados de envío que registrar');
      }
      const subj =
        sliceSubject(dto.subjectSnapshot ?? '') ||
        subjectFromMessageJson(dto.message);
      if (!subj) {
        throw new BadRequestException('Indica el asunto de la campaña');
      }
    } else {
      if (!dto.message || typeof dto.message !== 'object') {
        throw new BadRequestException('Mensaje inválido');
      }
      if (recipients.length === 0 && !isDraft) {
        throw new BadRequestException('Debe haber al menos un destinatario');
      }
    }

    const sentCount =
      dto.sentCount ?? (isSent ? resultsArr.length : recipients.length);

    const messageJsonForDb = isSent
      ? ({ channel: dto.channel } as Prisma.InputJsonValue)
      : (dto.message as Prisma.InputJsonValue);

    const recipientsJsonForDb = isSent
      ? ([] as Prisma.InputJsonValue)
      : (recipients as Prisma.InputJsonValue);

    const subjectSnapshotForDb = isSent
      ? sliceSubject(dto.subjectSnapshot ?? '') ||
        subjectFromMessageJson(dto.message)
      : null;

    const recipientCountForDb = isSent
      ? (dto.sentCount ?? resultsArr.length)
      : recipients.length;

    const row = await this.prisma.campaign.create({
      data: {
        name,
        status: dto.status,
        channel: dto.channel,
        messageJson: messageJsonForDb,
        recipientsJson: recipientsJsonForDb,
        subjectSnapshot: subjectSnapshotForDb,
        resultsJson: (dto.results ?? []) as Prisma.InputJsonValue,
        recipientCount: recipientCountForDb,
        sentCount,
        deliveredCount: dto.deliveredCount ?? 0,
        openedCount: dto.openedCount ?? 0,
        clickedCount: dto.clickedCount ?? 0,
        failedCount: dto.failedCount ?? 0,
        bounceCount: dto.bounceCount ?? 0,
        relatedContactIds: dto.relatedContactIds ?? [],
        sentAt: dto.sentAt ? new Date(dto.sentAt) : null,
        createdById: userId,
        createdByName: userName,
      },
    });
    return this.toFullPayload(row);
  }

  async update(id: string, dto: UpdateCampaignDto, userId: string) {
    const row = await this.prisma.campaign.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Campaña no encontrada');
    }
    if (row.createdById !== userId) {
      throw new ForbiddenException('No puedes editar esta campaña');
    }
    if (row.status !== 'draft') {
      throw new BadRequestException('Solo se pueden editar borradores');
    }

    if (dto.status === 'scheduled') {
      throw new BadRequestException('El envío programado no está disponible');
    }

    const recipientsSource =
      dto.recipients !== undefined ? dto.recipients : row.recipientsJson;
    const recArr = Array.isArray(recipientsSource) ? recipientsSource : [];

    const data: Prisma.CampaignUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = (dto.name ?? '').trim() || row.name;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.channel !== undefined) {
      data.channel = dto.channel;
    }
    if (dto.message !== undefined) {
      data.messageJson = dto.message as Prisma.InputJsonValue;
    }
    if (dto.recipients !== undefined) {
      data.recipientsJson = dto.recipients as Prisma.InputJsonValue;
      data.recipientCount = recArr.length;
    }
    if (dto.results !== undefined) {
      data.resultsJson = dto.results as Prisma.InputJsonValue;
    }
    if (dto.sentCount !== undefined) {
      data.sentCount = dto.sentCount;
    }
    if (dto.deliveredCount !== undefined) {
      data.deliveredCount = dto.deliveredCount;
    }
    if (dto.openedCount !== undefined) {
      data.openedCount = dto.openedCount;
    }
    if (dto.clickedCount !== undefined) {
      data.clickedCount = dto.clickedCount;
    }
    if (dto.failedCount !== undefined) {
      data.failedCount = dto.failedCount;
    }
    if (dto.bounceCount !== undefined) {
      data.bounceCount = dto.bounceCount;
    }
    if (dto.relatedContactIds !== undefined) {
      data.relatedContactIds = dto.relatedContactIds;
    }
    if (dto.sentAt !== undefined) {
      data.sentAt = dto.sentAt ? new Date(dto.sentAt) : null;
    }
    if (dto.subjectSnapshot !== undefined) {
      data.subjectSnapshot =
        dto.subjectSnapshot === null || dto.subjectSnapshot === ''
          ? null
          : sliceSubject(dto.subjectSnapshot);
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data,
    });
    return this.toFullPayload(updated);
  }

  async remove(id: string, userId: string) {
    const row = await this.prisma.campaign.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Campaña no encontrada');
    }
    if (row.createdById !== userId) {
      throw new ForbiddenException('No puedes eliminar esta campaña');
    }
    if (!['draft', 'cancelled'].includes(row.status)) {
      throw new BadRequestException('Solo se pueden eliminar borradores o canceladas');
    }
    await this.prisma.campaign.delete({ where: { id } });
  }

  async sendCampaignEmail(
    dto: SendCampaignEmailDto,
  ): Promise<{ results: CampaignSendResultRow[] }> {
    if (!this.mail.isSmtpConfigured()) {
      throw new ServiceUnavailableException(
        'SMTP no configurado. Revisa SMTP_HOST, SMTP_USER y SMTP_PASS.',
      );
    }
    if (!dto.recipients?.length) {
      throw new BadRequestException('Debe haber al menos un destinatario');
    }
    const subjectTpl = (dto.subject ?? '').trim();
    const htmlTpl = dto.htmlBody ?? '';
    if (!subjectTpl) {
      throw new BadRequestException('El asunto es obligatorio');
    }
    if (!htmlTpl.trim()) {
      throw new BadRequestException('El cuerpo del mensaje está vacío');
    }

    const delayMin = Math.max(
      0,
      Number.parseInt(
        this.config.get<string>('CAMPAIGN_EMAIL_DELAY_MIN_MS') ?? '',
        10,
      ) || DEFAULT_DELAY_MIN_MS,
    );
    const delayMax = Math.max(
      delayMin,
      Number.parseInt(
        this.config.get<string>('CAMPAIGN_EMAIL_DELAY_MAX_MS') ?? '',
        10,
      ) || DEFAULT_DELAY_MAX_MS,
    );
    const maxPerHour = Math.max(
      1,
      Number.parseInt(
        this.config.get<string>('CAMPAIGN_EMAIL_MAX_PER_RECIPIENT_HOUR') ?? '',
        10,
      ) || DEFAULT_MAX_PER_RECIPIENT_HOUR,
    );

    const sharedAttachments = buildAttachments(dto.attachments);
    const results: CampaignSendResultRow[] = [];
    const list = dto.recipients;
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const email = r.email?.trim();
      if (!email) {
        results.push({
          recipientId: r.id,
          contactId: r.contactId,
          name: r.name ?? '',
          email: r.email ?? '',
          status: 'fallido',
          errorMessage: 'Email vacío',
        });
        if (i < list.length - 1) {
          await sleep(randomDelayMs(delayMin, delayMax));
        }
        continue;
      }

      const toKey = email.toLowerCase();

      const recentCount = await this.prisma.campaignEmailSendLog.count({
        where: {
          toEmail: toKey,
          sentAt: { gte: hourAgo },
        },
      });

      if (recentCount >= maxPerHour) {
        const sentAt = new Date().toISOString();
        results.push({
          recipientId: r.id,
          contactId: r.contactId,
          name: r.name,
          email,
          status: 'fallido',
          sentAt,
          errorMessage: `Límite anti-spam: máximo ${maxPerHour} envíos por hora a este correo. Reintenta más tarde.`,
        });
        if (i < list.length - 1) {
          await sleep(randomDelayMs(delayMin, delayMax));
        }
        continue;
      }

      const subject = applyTemplate(subjectTpl, {
        name: r.name,
        email,
        company: r.company,
      });
      const html = applyTemplate(htmlTpl, {
        name: r.name,
        email,
        company: r.company,
      });

      const sentAt = new Date().toISOString();
      try {
        await this.mail.sendHtmlEmail({
          to: email,
          subject,
          html,
          attachments: sharedAttachments,
        });
        await this.prisma.campaignEmailSendLog.create({
          data: { toEmail: toKey },
        });
        results.push({
          recipientId: r.id,
          contactId: r.contactId,
          name: r.name,
          email,
          status: 'entregado',
          sentAt,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          recipientId: r.id,
          contactId: r.contactId,
          name: r.name,
          email,
          status: 'fallido',
          sentAt,
          errorMessage: msg,
        });
      }

      if (i < list.length - 1) {
        await sleep(randomDelayMs(delayMin, delayMax));
      }
    }

    return { results };
  }
}
