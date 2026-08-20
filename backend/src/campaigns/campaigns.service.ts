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
  resendEmailId?: string;
};

type CampaignResultRow = {
  recipientId: string;
  contactId?: string;
  name: string;
  email: string;
  status: string;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  errorMessage?: string;
  resendEmailId?: string;
};

const STATUS_RANK: Record<string, number> = {
  pendiente: 0,
  enviado: 1,
  entregado: 2,
  abierto: 3,
  clic: 4,
  fallido: 5,
  rebote: 5,
};

function resendTagValue(raw: string): string {
  const v = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 256);
  return v.length > 0 ? v : 'na';
}

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

function tagsRecipientId(tags: unknown): string | null {
  if (!tags || typeof tags !== 'object' || Array.isArray(tags)) return null;
  const rec = tags as Record<string, unknown>;
  const v = rec.recipient_id ?? rec.recipientId;
  return v != null ? String(v) : null;
}

function asResultRows(results: unknown): CampaignResultRow[] {
  if (!Array.isArray(results)) return [];
  return results.map((x) => {
    const r = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
    return {
      recipientId: String(r.recipientId ?? ''),
      contactId: r.contactId != null ? String(r.contactId) : undefined,
      name: String(r.name ?? ''),
      email: String(r.email ?? ''),
      status: String(r.status ?? 'enviado'),
      sentAt: r.sentAt != null ? String(r.sentAt) : undefined,
      deliveredAt: r.deliveredAt != null ? String(r.deliveredAt) : undefined,
      openedAt: r.openedAt != null ? String(r.openedAt) : undefined,
      clickedAt: r.clickedAt != null ? String(r.clickedAt) : undefined,
      errorMessage: r.errorMessage != null ? String(r.errorMessage) : undefined,
      resendEmailId: r.resendEmailId != null ? String(r.resendEmailId) : undefined,
    };
  });
}

function recountResults(rows: CampaignResultRow[]) {
  let deliveredCount = 0;
  let openedCount = 0;
  let clickedCount = 0;
  let failedCount = 0;
  let bounceCount = 0;
  for (const r of rows) {
    if (r.status === 'clic') {
      clickedCount += 1;
      openedCount += 1;
      deliveredCount += 1;
    } else if (r.status === 'abierto') {
      openedCount += 1;
      deliveredCount += 1;
    } else if (r.status === 'entregado' || r.status === 'enviado') {
      deliveredCount += 1;
    } else if (r.status === 'rebote') {
      bounceCount += 1;
    } else if (r.status === 'fallido') {
      failedCount += 1;
    }
  }
  return { deliveredCount, openedCount, clickedCount, failedCount, bounceCount };
}

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

/**
 * Maily/react-email centra el lienzo (align="center" + max-width 600px).
 * Eso hace que un mensaje alineado a la izquierda en el editor se vea
 * centrado en Gmail. Los CTA (botón) conservan su alineación.
 */
function leftAlignMailyLayout(html: string): string {
  if (!html) return html;
  return html.replace(/<table\b[^>]*>/gi, (tag) => {
    if (!/align=["']center["']/i.test(tag)) return tag;
    if (/max-width:\s*37\.5em/i.test(tag) || /text-align:\s*center/i.test(tag)) {
      return tag;
    }
    return tag.replace(/align=["']center["']/i, 'align="left"');
  });
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

function editorJsonFromMessageJson(msg: unknown): unknown {
  if (msg == null || typeof msg !== 'object') {
    return undefined;
  }
  const j = (msg as Record<string, unknown>).editorJson;
  if (j && typeof j === 'object') {
    return j;
  }
  return undefined;
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
    const editorJson = editorJsonFromMessageJson(row.messageJson);

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
        ...(editorJson != null ? { editorJson } : {}),
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
    statuses?: string[],
    channels?: string[],
  ): Promise<{
    items: CampaignSummaryItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const take = Math.min(Math.max(1, limit), 200);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * take;
    const where: Prisma.CampaignWhereInput = {};
    if (search?.trim()) {
      where.name = { contains: search.trim(), mode: 'insensitive' };
    }
    if (statuses?.length) {
      where.status = { in: statuses };
    }
    if (channels?.length) {
      where.channel = { in: channels };
    }

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
    if (isSent) {
      await this.linkResendMessages(row.id, dto.results);
      return this.findOne(row.id);
    }
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
    await this.prisma.campaign.delete({ where: { id } });
  }

  async sendCampaignEmail(
    dto: SendCampaignEmailDto,
  ): Promise<{ results: CampaignSendResultRow[] }> {
    if (!this.mail.isConfigured()) {
      throw new ServiceUnavailableException(
        'Resend no configurado. Revisa RESEND_API_KEY y RESEND_FROM.',
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
      const html = leftAlignMailyLayout(
        applyTemplate(htmlTpl, {
          name: r.name,
          email,
          company: r.company,
        }),
      );

      const sentAt = new Date().toISOString();
      try {
        const sent = await this.mail.sendHtmlEmail({
          to: email,
          subject,
          html,
          attachments: sharedAttachments,
          tags: [
            { name: 'kind', value: 'campaign' },
            { name: 'recipient_id', value: resendTagValue(r.id) },
          ],
        });
        await this.prisma.campaignEmailSendLog.create({
          data: { toEmail: toKey },
        });
        await this.prisma.campaignResendMessage.create({
          data: {
            resendEmailId: sent.id,
            toEmail: toKey,
            recipientId: r.id,
            status: 'enviado',
            sentAt: new Date(sentAt),
            subject,
            html,
            fromEmail: this.config.get<string>('RESEND_FROM')?.trim() ?? '',
          },
        });
        results.push({
          recipientId: r.id,
          contactId: r.contactId,
          name: r.name,
          email,
          status: 'entregado',
          sentAt,
          resendEmailId: sent.id,
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

  async applyResendTrackingEvent(
    type: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const resendEmailId = String(data.email_id ?? data.id ?? '').trim();
    if (!resendEmailId) return;

    const eventAt = asIsoDate(data.created_at);
    const click =
      data.click && typeof data.click === 'object'
        ? (data.click as Record<string, unknown>)
        : null;
    const clickUrl =
      click?.link != null
        ? String(click.link)
        : click?.url != null
          ? String(click.url)
          : undefined;

    let nextStatus = 'enviado';
    const patch: {
      lastEventType: string;
      lastEventAt: Date;
      status?: string;
      deliveredAt?: Date;
      openedAt?: Date;
      clickedAt?: Date;
      bouncedAt?: Date;
      failedAt?: Date;
      clickUrl?: string;
    } = { lastEventType: type, lastEventAt: eventAt };

    if (type === 'email.delivered') {
      nextStatus = 'entregado';
      patch.deliveredAt = eventAt;
    } else if (type === 'email.opened') {
      nextStatus = 'abierto';
      patch.openedAt = eventAt;
    } else if (type === 'email.clicked') {
      nextStatus = 'clic';
      patch.clickedAt = eventAt;
      if (clickUrl) patch.clickUrl = clickUrl;
    } else if (type === 'email.bounced') {
      nextStatus = 'rebote';
      patch.bouncedAt = eventAt;
    } else if (type === 'email.failed' || type === 'email.complained') {
      nextStatus = 'fallido';
      patch.failedAt = eventAt;
    } else {
      return;
    }

    const existing = await this.prisma.campaignResendMessage.findUnique({
      where: { resendEmailId },
    });
    const currentRank = STATUS_RANK[existing?.status ?? 'enviado'] ?? 0;
    const nextRank = STATUS_RANK[nextStatus] ?? 0;
    const isFailure = nextStatus === 'rebote' || nextStatus === 'fallido';
    if (isFailure || nextRank >= currentRank) {
      patch.status = nextStatus;
    }

    const row = existing
      ? await this.prisma.campaignResendMessage.update({
          where: { resendEmailId },
          data: patch,
        })
      : await this.prisma.campaignResendMessage.create({
          data: {
            resendEmailId,
            toEmail: asStringArray(data.to)[0]?.toLowerCase() ?? '',
            recipientId:
              tagsRecipientId(data.tags) ?? undefined,
            status: patch.status ?? nextStatus,
            clickUrl: patch.clickUrl,
            deliveredAt: patch.deliveredAt,
            openedAt: patch.openedAt,
            clickedAt: patch.clickedAt,
            bouncedAt: patch.bouncedAt,
            failedAt: patch.failedAt,
            lastEventType: type,
            lastEventAt: eventAt,
          },
        });

    if (row.campaignId) {
      await this.applyMessageToCampaign(row.campaignId, row);
    }
  }

  private async linkResendMessages(campaignId: string, results: unknown) {
    const rows = asResultRows(results);
    const ids = rows
      .map((r) => r.resendEmailId?.trim())
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) return;

    await this.prisma.campaignResendMessage.updateMany({
      where: { resendEmailId: { in: ids } },
      data: { campaignId },
    });

    const pending = await this.prisma.campaignResendMessage.findMany({
      where: { campaignId, lastEventType: { not: null } },
    });
    for (const msg of pending) {
      await this.applyMessageToCampaign(campaignId, msg);
    }
  }

  private async applyMessageToCampaign(
    campaignId: string,
    msg: {
      resendEmailId: string;
      recipientId: string | null;
      toEmail: string;
      status: string;
      deliveredAt: Date | null;
      openedAt: Date | null;
      clickedAt: Date | null;
      clickUrl: string | null;
    },
  ) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) return;

    const rows = asResultRows(campaign.resultsJson);
    const idx = rows.findIndex(
      (r) =>
        (msg.recipientId && r.recipientId === msg.recipientId) ||
        r.resendEmailId === msg.resendEmailId ||
        r.email.trim().toLowerCase() === msg.toEmail,
    );
    if (idx < 0) return;

    const current = rows[idx]!;
    const currentRank = STATUS_RANK[current.status] ?? 0;
    const nextRank = STATUS_RANK[msg.status] ?? 0;
    const isFailure = msg.status === 'rebote' || msg.status === 'fallido';
    if (isFailure || nextRank >= currentRank) {
      current.status = msg.status;
    }
    current.resendEmailId = msg.resendEmailId;
    if (msg.deliveredAt) current.deliveredAt = msg.deliveredAt.toISOString();
    if (msg.openedAt) current.openedAt = msg.openedAt.toISOString();
    if (msg.clickedAt) current.clickedAt = msg.clickedAt.toISOString();
    rows[idx] = current;

    const counts = recountResults(rows);
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        resultsJson: rows as unknown as Prisma.InputJsonValue,
        deliveredCount: counts.deliveredCount,
        openedCount: counts.openedCount,
        clickedCount: counts.clickedCount,
        failedCount: counts.failedCount,
        bounceCount: counts.bounceCount,
      },
    });
  }
}
