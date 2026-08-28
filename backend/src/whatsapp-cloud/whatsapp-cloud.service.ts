import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import {
  MetaGraphApiService,
  type MetaMessageTemplate,
  type MetaPhoneNumberInfo,
  type MetaTemplateComponent,
} from './meta-graph-api.service';
import type { ConnectWhatsAppCloudDto } from './dto/connect-account.dto';
import type { CreateWhatsAppCampaignDto } from './dto/create-campaign.dto';
import { estimateWhatsAppCampaignCost } from './whatsapp-pricing';

const PLACEHOLDER_RE = /\{\{([a-z][a-z0-9_]*|\d+)\}\}/gi;

function mapCategory(raw: string): string {
  const v = raw.toUpperCase();
  if (v === 'MARKETING') return 'marketing';
  if (v === 'AUTHENTICATION') return 'authentication';
  return 'utility';
}

function mapStatus(raw: string): string {
  const v = raw.toUpperCase();
  if (v === 'APPROVED') return 'approved';
  if (v === 'REJECTED') return 'rejected';
  return 'pending';
}

function mapQuality(raw?: string): string {
  const v = raw?.toUpperCase();
  if (v === 'GREEN' || v === 'HIGH') return 'alta';
  if (v === 'RED' || v === 'LOW') return 'baja';
  return 'media';
}

function extractPlaceholders(...texts: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(PLACEHOLDER_RE)) {
      const key = match[1];
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    }
  }
  return out;
}

function parseTemplateFromMeta(meta: MetaMessageTemplate) {
  const components = meta.components ?? [];
  const headerComp = components.find((c) => c.type === 'HEADER');
  const bodyComp = components.find((c) => c.type === 'BODY');
  const footerComp = components.find((c) => c.type === 'FOOTER');
  const buttonsComp = components.find((c) => c.type === 'BUTTONS');

  const headerMedia =
    headerComp?.format && headerComp.format !== 'TEXT'
      ? headerComp.format.toLowerCase()
      : 'none';

  const sampleFromExample = (comp?: MetaTemplateComponent): string[] => {
    const example = comp?.example;
    if (!example) return [];
    const bodyText = example.body_text as string[][] | undefined;
    if (bodyText?.[0]) return bodyText[0];
    const headerText = example.header_text as string[] | undefined;
    if (headerText) return headerText;
    const named = example.body_text_named_params as Array<{ param_name?: string }> | undefined;
    if (named) return named.map((p) => p.param_name ?? '').filter(Boolean);
    return [];
  };

  const body = bodyComp?.text ?? '';
  const header = headerComp?.format === 'TEXT' ? headerComp.text : undefined;
  const placeholders = extractPlaceholders(header, body);
  const sampleVariables = sampleFromExample(bodyComp);
  const resolvedSamples = sampleVariables.length > 0 ? sampleVariables : placeholders;

  const buttons = Array.isArray(buttonsComp?.buttons)
    ? (buttonsComp.buttons as Array<Record<string, string>>).map((btn) => {
        const type = (btn.type ?? '').toUpperCase();
        if (type === 'URL') {
          return { type: 'url', text: btn.text ?? '', url: btn.url ?? '' };
        }
        if (type === 'PHONE_NUMBER') {
          return { type: 'phone', text: btn.text ?? '', phone: btn.phone_number ?? '' };
        }
        return { type: 'quick_reply', text: btn.text ?? '' };
      })
    : [];

  const parameterFormat =
    meta.parameter_format?.toLowerCase() === 'named' ? 'named' : 'positional';

  return {
    metaTemplateId: meta.id,
    name: meta.name,
    language: meta.language,
    category: mapCategory(meta.category),
    status: mapStatus(meta.status),
    header: header ?? null,
    body,
    footer: footerComp?.text ?? null,
    headerMedia: headerMedia === 'none' ? null : headerMedia,
    parameterFormat,
    sampleVariables: resolvedSamples,
    qualityRating: mapQuality(meta.quality_score?.score),
    rejectionReason: meta.rejected_reason ?? null,
    buttons,
    components: components as unknown as Prisma.InputJsonValue,
  };
}

export function normalizePeruPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('51')) return digits;
  if (digits.length === 9 && digits.startsWith('9')) return `51${digits}`;
  if (digits.length === 10 && digits.startsWith('0')) return `51${digits.slice(1)}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

type RecipientRow = {
  phone: string;
  name?: string | null;
  company?: string | null;
  source?: string | null;
};

function valueForField(
  recipient: RecipientRow,
  field: string,
): string {
  switch (field) {
    case 'name':
      return recipient.name?.trim() || 'Cliente';
    case 'company':
      return recipient.company?.trim() || '';
    case 'phone':
      return recipient.phone;
    case 'form':
      return recipient.company?.trim() || '';
    default:
      return '';
  }
}

function buildTemplateComponents(
  template: {
    header: string | null;
    body: string;
    parameterFormat: string | null;
  },
  variableMapping: Record<string, string>,
  recipient: RecipientRow,
): Array<{
  type: string;
  parameters?: Array<{ type: string; text?: string; parameter_name?: string }>;
}> {
  const components: Array<{
    type: string;
    parameters?: Array<{ type: string; text?: string; parameter_name?: string }>;
  }> = [];

  const isNamed = template.parameterFormat === 'named';

  const headerPlaceholders = extractPlaceholders(template.header ?? undefined);
  if (headerPlaceholders.length > 0) {
    components.push({
      type: 'header',
      parameters: headerPlaceholders.map((key) => {
        const field = variableMapping[key] ?? 'name';
        const text = valueForField(recipient, field);
        return isNamed
          ? { type: 'text', parameter_name: key, text }
          : { type: 'text', text };
      }),
    });
  }

  const bodyPlaceholders = extractPlaceholders(template.body);
  if (bodyPlaceholders.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyPlaceholders.map((key) => {
        const field = variableMapping[key] ?? 'name';
        const text = valueForField(recipient, field);
        return isNamed
          ? { type: 'text', parameter_name: key, text }
          : { type: 'text', text };
      }),
    });
  }

  return components;
}

@Injectable()
export class WhatsappCloudService {
  private readonly logger = new Logger(WhatsappCloudService.name);
  private readonly sendingCampaigns = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly meta: MetaGraphApiService,
  ) {}

  /**
   * Valida credenciales llamando a Meta directamente (no debug_token).
   * Funciona con tokens de System User aunque pertenezcan a otra app distinta a FACEBOOK_APP_ID.
   */
  private async validateWhatsAppCredentials(input: {
    accessToken: string;
    phoneNumberId?: string;
    wabaId?: string;
    graphApiVersion?: string;
  }): Promise<MetaPhoneNumberInfo | null> {
    try {
      let phoneInfo: MetaPhoneNumberInfo | null = null;
      if (input.phoneNumberId) {
        phoneInfo = await this.meta.getPhoneNumber(
          input.phoneNumberId,
          input.accessToken,
          input.graphApiVersion,
        );
      }
      if (input.wabaId) {
        await this.meta.getMessageTemplates(
          input.wabaId,
          input.accessToken,
          input.graphApiVersion,
        );
      }
      return phoneInfo;
    } catch (err) {
      const message =
        err instanceof ServiceUnavailableException
          ? err.message
          : 'No se pudo validar las credenciales con Meta';
      throw new BadRequestException(message);
    }
  }

  private toPublicAccount(
    account: Prisma.WhatsAppCloudAccountGetPayload<{ include: { templates: true } }> | Prisma.WhatsAppCloudAccountGetPayload<object>,
    templateStats?: { total: number; approved: number; marketing: number; utility: number },
  ) {
    const templates = 'templates' in account ? account.templates : [];
    const stats = templateStats ?? {
      total: templates.length,
      approved: templates.filter((t) => t.status === 'approved').length,
      marketing: templates.filter((t) => t.category === 'marketing').length,
      utility: templates.filter((t) => t.category === 'utility').length,
    };

    return {
      id: account.id,
      displayName: account.displayName,
      wabaId: account.wabaId,
      phoneNumberId: account.phoneNumberId,
      displayPhoneNumber: account.displayPhoneNumber,
      verifiedName: account.verifiedName,
      isDefault: account.isDefault,
      active: account.active,
      templateCount: stats.total,
      approvedCount: stats.approved,
      marketingCount: stats.marketing,
      utilityCount: stats.utility,
      lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
      graphApiVersion: account.graphApiVersion,
      hasToken: Boolean(account.accessToken),
    };
  }

  private toPublicTemplate(template: Prisma.WhatsAppCloudTemplateGetPayload<object>) {
    return {
      id: template.id,
      name: template.name,
      category: template.category,
      language: template.language,
      header: template.header ?? undefined,
      body: template.body,
      footer: template.footer ?? undefined,
      headerMedia: template.headerMedia ?? undefined,
      parameterFormat: template.parameterFormat ?? undefined,
      sampleVariables: Array.isArray(template.sampleVariables)
        ? (template.sampleVariables as string[])
        : [],
      status: template.status,
      qualityRating: template.qualityRating ?? 'media',
      buttons: Array.isArray(template.buttons) ? template.buttons : [],
      createdAt: template.createdAt.toISOString().slice(0, 10),
      rejectionReason: template.rejectionReason ?? undefined,
    };
  }

  async connectAccount(userId: string, dto: ConnectWhatsAppCloudDto) {
    const wabaId = dto.wabaId.trim();
    const phoneNumberId = dto.phoneNumberId.trim();
    const accessToken = dto.accessToken.trim();
    const graphApiVersion = dto.graphApiVersion?.trim() || 'v22.0';

    if (!wabaId || !phoneNumberId || !accessToken) {
      throw new BadRequestException('WABA ID, Phone Number ID y token son obligatorios');
    }

    const validation = await this.validateWhatsAppCredentials({
      accessToken,
      phoneNumberId,
      wabaId,
      graphApiVersion,
    });
    const phoneInfo = validation ?? {};

    if (dto.setAsDefault) {
      await this.prisma.whatsAppCloudAccount.updateMany({
        where: { active: true },
        data: { isDefault: false },
      });
    }

    const existing = await this.prisma.whatsAppCloudAccount.findUnique({ where: { wabaId } });
    const accountData = {
      displayName: dto.displayName.trim(),
      phoneNumberId,
      displayPhoneNumber: phoneInfo.display_phone_number ?? null,
      verifiedName: phoneInfo.verified_name ?? dto.displayName.trim(),
      accessToken,
      graphApiVersion,
      connectedById: userId,
      isDefault: dto.setAsDefault ?? false,
      active: true,
    };

    let account;
    if (existing) {
      account = await this.prisma.whatsAppCloudAccount.update({
        where: { wabaId },
        data: accountData,
      });
    } else {
      const count = await this.prisma.whatsAppCloudAccount.count({
        where: { active: true },
      });
      account = await this.prisma.whatsAppCloudAccount.create({
        data: {
          wabaId,
          ...accountData,
          isDefault: dto.setAsDefault ?? count === 0,
        },
      });
    }

    await this.syncTemplates(account.id);
    const refreshed = await this.prisma.whatsAppCloudAccount.findUnique({
      where: { id: account.id },
      include: { templates: true },
    });
    if (!refreshed) throw new NotFoundException('Cuenta no encontrada');
    return this.toPublicAccount(refreshed);
  }

  async getAccounts(_userId?: string) {
    const accounts = await this.prisma.whatsAppCloudAccount.findMany({
      where: { active: true },
      include: { templates: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return accounts.map((a) => this.toPublicAccount(a));
  }

  async disconnectAccount(id: string, _userId: string) {
    const account = await this.prisma.whatsAppCloudAccount.findFirst({
      where: { id, active: true },
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');
    await this.prisma.whatsAppCloudAccount.update({
      where: { id },
      data: { active: false, isDefault: false },
    });
    if (account.isDefault) {
      const next = await this.prisma.whatsAppCloudAccount.findFirst({
        where: { active: true },
        orderBy: { createdAt: 'asc' },
      });
      if (next) {
        await this.prisma.whatsAppCloudAccount.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
    return { disconnected: true };
  }

  async updateToken(id: string, userId: string, accessToken: string) {
    const token = accessToken.trim();
    if (!token) throw new BadRequestException('Ingresa el token');
    const account = await this.prisma.whatsAppCloudAccount.findFirst({
      where: { id, active: true },
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');
    await this.validateWhatsAppCredentials({
      accessToken: token,
      phoneNumberId: account.phoneNumberId,
      wabaId: account.wabaId,
      graphApiVersion: account.graphApiVersion,
    });
    await this.prisma.whatsAppCloudAccount.update({
      where: { id },
      data: { accessToken: token },
    });
    return { updated: true };
  }

  async setDefaultAccount(id: string, userId: string) {
    const account = await this.prisma.whatsAppCloudAccount.findFirst({
      where: { id, active: true },
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');
    await this.prisma.whatsAppCloudAccount.updateMany({
      where: { active: true },
      data: { isDefault: false },
    });
    await this.prisma.whatsAppCloudAccount.update({
      where: { id },
      data: { isDefault: true },
    });
    return this.getAccounts(userId);
  }

  async testConnection(dto: Pick<ConnectWhatsAppCloudDto, 'wabaId' | 'accessToken' | 'graphApiVersion'>) {
    const accessToken = dto.accessToken.trim();
    const wabaId = dto.wabaId.trim();
    if (!accessToken || !wabaId) {
      throw new BadRequestException('WABA ID y token son obligatorios');
    }
    try {
      const templates = await this.meta.getMessageTemplates(wabaId, accessToken, dto.graphApiVersion);
      const approved = templates.filter((t) => t.status === 'APPROVED').length;
      return { ok: true as const, templateCount: templates.length, approvedCount: approved };
    } catch (err) {
      const message =
        err instanceof ServiceUnavailableException
          ? err.message
          : 'No se pudo conectar con Meta';
      throw new BadRequestException(message);
    }
  }

  async testAccountConnection(id: string, _userId: string) {
    const account = await this.prisma.whatsAppCloudAccount.findFirst({
      where: { id, active: true },
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');
    const templates = await this.meta.getMessageTemplates(
      account.wabaId,
      account.accessToken,
      account.graphApiVersion,
    );
    const approved = templates.filter((t) => t.status === 'APPROVED').length;
    return { ok: true as const, templateCount: templates.length, approvedCount: approved };
  }

  async syncTemplates(accountId: string) {
    const account = await this.prisma.whatsAppCloudAccount.findFirst({
      where: { id: accountId, active: true },
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    const metaTemplates = await this.meta.getMessageTemplates(
      account.wabaId,
      account.accessToken,
      account.graphApiVersion,
    );

    const now = new Date();
    for (const meta of metaTemplates) {
      const parsed = parseTemplateFromMeta(meta);
      await this.prisma.whatsAppCloudTemplate.upsert({
        where: {
          accountId_name_language: {
            accountId: account.id,
            name: parsed.name,
            language: parsed.language,
          },
        },
        create: {
          ...parsed,
          sampleVariables: parsed.sampleVariables,
          buttons: parsed.buttons,
          accountId: account.id,
          lastSyncedAt: now,
        },
        update: {
          ...parsed,
          sampleVariables: parsed.sampleVariables,
          buttons: parsed.buttons,
          lastSyncedAt: now,
        },
      });
    }

    await this.prisma.whatsAppCloudAccount.update({
      where: { id: account.id },
      data: { lastSyncedAt: now },
    });

    return this.getTemplates(accountId);
  }

  async getTemplates(accountId: string) {
    const templates = await this.prisma.whatsAppCloudTemplate.findMany({
      where: { accountId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
    return templates.map((t) => this.toPublicTemplate(t));
  }

  async createCampaign(userId: string, userName: string, dto: CreateWhatsAppCampaignDto) {
    const account = await this.prisma.whatsAppCloudAccount.findFirst({
      where: { id: dto.accountId, active: true },
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    const template = await this.prisma.whatsAppCloudTemplate.findFirst({
      where: { id: dto.templateId, accountId: account.id },
    });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    if (template.status !== 'approved') {
      throw new BadRequestException('Solo se pueden enviar plantillas aprobadas');
    }

    const recipients = dto.recipients
      .map((r) => {
        const phone = normalizePeruPhone(r.phone);
        if (!phone) return null;
        return {
          phone,
          name: r.name?.trim() || null,
          company: r.company?.trim() || null,
          source: r.source?.trim() || 'excel',
          flotaProspectoId: r.flotaProspectoId?.trim() || null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (recipients.length === 0) {
      throw new BadRequestException('No hay destinatarios con teléfono válido');
    }

    const campaign = await this.prisma.whatsAppBulkCampaign.create({
      data: {
        name: dto.name?.trim() || `Envío ${new Date().toLocaleString('es-PE')}`,
        accountId: account.id,
        templateId: template.id,
        variableMapping: dto.variableMapping,
        status: 'draft',
        total: recipients.length,
        createdById: userId,
        createdByName: userName,
        recipients: {
          create: recipients,
        },
      },
      include: { recipients: true, template: true, account: true },
    });

    return this.toPublicCampaign(campaign);
  }

  async startSendCampaign(campaignId: string, userId: string) {
    const campaign = await this.prisma.whatsAppBulkCampaign.findFirst({
      where: { id: campaignId, createdById: userId },
      include: { account: true, template: true },
    });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    if (campaign.status === 'sending') {
      return this.toPublicCampaign(
        await this.prisma.whatsAppBulkCampaign.findUniqueOrThrow({
          where: { id: campaignId },
          include: { recipients: true, template: true, account: true },
        }),
      );
    }
    if (campaign.status === 'sent') {
      return this.toPublicCampaign(
        await this.prisma.whatsAppBulkCampaign.findUniqueOrThrow({
          where: { id: campaignId },
          include: { recipients: true, template: true, account: true },
        }),
      );
    }

    await this.prisma.whatsAppBulkCampaign.update({
      where: { id: campaignId },
      data: { status: 'sending', startedAt: new Date(), sent: 0, failed: 0 },
    });

    if (!this.sendingCampaigns.has(campaignId)) {
      this.sendingCampaigns.add(campaignId);
      void this.processCampaign(campaignId).finally(() => {
        this.sendingCampaigns.delete(campaignId);
      });
    }

    return this.getCampaign(campaignId, userId);
  }

  private async processCampaign(campaignId: string) {
    const campaign = await this.prisma.whatsAppBulkCampaign.findUnique({
      where: { id: campaignId },
      include: { account: true, template: true },
    });
    if (!campaign) return;

    const variableMapping = campaign.variableMapping as Record<string, string>;
    const pending = await this.prisma.whatsAppBulkRecipient.findMany({
      where: { campaignId, status: 'pending' },
      orderBy: { id: 'asc' },
    });

    const flotaByPhone = await this.resolveFlotaProspectIdsByPhone(
      pending.filter((r) => !r.flotaProspectoId).map((r) => r.phone),
    );

    let sent = campaign.sent;
    let failed = campaign.failed;

    for (const recipient of pending) {
      try {
        const components = buildTemplateComponents(
          {
            header: campaign.template.header,
            body: campaign.template.body,
            parameterFormat: campaign.template.parameterFormat,
          },
          variableMapping,
          recipient,
        );

        const result = await this.meta.sendTemplateMessage(
          campaign.account.phoneNumberId,
          campaign.account.accessToken,
          {
            to: recipient.phone,
            templateName: campaign.template.name,
            languageCode: campaign.template.language,
            components: components.length > 0 ? components : undefined,
          },
          campaign.account.graphApiVersion,
        );

        const wamid = result.messages?.[0]?.id ?? null;
        await this.prisma.whatsAppBulkRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'sent',
            metaMessageId: wamid,
            sentAt: new Date(),
            error: null,
          },
        });
        sent += 1;

        const flotaProspectoId =
          recipient.flotaProspectoId ??
          flotaByPhone.get(recipient.phone.slice(-9)) ??
          null;
        if (flotaProspectoId) {
          await this.markFlotaProspectoContacted({
            flotaProspectoId,
            campaign,
            recipientPhone: recipient.phone,
            wamid,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al enviar';
        await this.prisma.whatsAppBulkRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'failed',
            error: message,
            sentAt: new Date(),
          },
        });
        failed += 1;
      }

      await this.prisma.whatsAppBulkCampaign.update({
        where: { id: campaignId },
        data: { sent, failed },
      });

      await new Promise((r) => setTimeout(r, 80));
    }

    await this.prisma.whatsAppBulkCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'sent',
        sent,
        failed,
        completedAt: new Date(),
      },
    });
  }

  /**
   * "Contactado" en Flota = hay al menos un CrmWhatsappMessage outbound.
   * El envío masivo Meta no pasaba por Evolution; registramos el saliente aquí.
   */
  private async markFlotaProspectoContacted(params: {
    flotaProspectoId: string;
    campaign: {
      id: string;
      createdById: string;
      account: {
        phoneNumberId: string;
        displayName: string;
        displayPhoneNumber: string | null;
      };
      template: { name: string };
    };
    recipientPhone: string;
    wamid: string | null;
  }) {
    const { flotaProspectoId, campaign, recipientPhone, wamid } = params;
    try {
      const exists = await this.prisma.flotaProspecto.findFirst({
        where: { id: flotaProspectoId, eliminadoAt: null },
        select: { id: true },
      });
      if (!exists) return;

      await this.prisma.crmWhatsappMessage.create({
        data: {
          direction: 'outbound',
          evoInstanceId: `meta-cloud:${campaign.account.phoneNumberId}`,
          evoInstanceName: campaign.account.displayName,
          waMessageId: wamid,
          fromWaId: (
            campaign.account.displayPhoneNumber?.replace(/\D/g, '') ||
            campaign.account.phoneNumberId
          ).slice(0, 32),
          toWaId: recipientPhone,
          body: `[Plantilla Meta] ${campaign.template.name}`,
          flotaProspectoId,
          createdByUserId: campaign.createdById,
          waOutboundStatus: 'sent',
          payloadJson: {
            channel: 'meta-cloud',
            campaignId: campaign.id,
            templateName: campaign.template.name,
          },
        },
      });
    } catch (err) {
      this.logger.warn(
        `No se pudo marcar contactado flota=${flotaProspectoId} campaign=${campaign.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** Mapa last-9-dígitos → id de FlotaProspecto (para Excel u omitidos sin id). */
  private async resolveFlotaProspectIdsByPhone(phones: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const last9List = [
      ...new Set(
        phones
          .map((p) => p.replace(/\D/g, '').slice(-9))
          .filter((d) => d.length === 9),
      ),
    ];
    if (last9List.length === 0) return map;

    // Chunk para no saturar el ANY() con listas enormes
    const chunkSize = 2000;
    for (let i = 0; i < last9List.length; i += chunkSize) {
      const chunk = last9List.slice(i, i + chunkSize);
      const rows = await this.prisma.$queryRaw<
        { id: string; celular: string | null; movil: string | null }[]
      >`
        SELECT id, celular, movil
        FROM "FlotaProspecto"
        WHERE "eliminadoAt" IS NULL
          AND (
            (celular IS NOT NULL AND right(regexp_replace(celular, '\\D', '', 'g'), 9) = ANY(${chunk}::text[]))
            OR (movil IS NOT NULL AND right(regexp_replace(movil, '\\D', '', 'g'), 9) = ANY(${chunk}::text[]))
          )
      `;
      for (const row of rows) {
        for (const raw of [row.celular, row.movil]) {
          if (!raw) continue;
          const key = raw.replace(/\D/g, '').slice(-9);
          if (key.length === 9 && !map.has(key)) map.set(key, row.id);
        }
      }
    }
    return map;
  }

  async getCampaign(campaignId: string, userId: string) {
    const campaign = await this.prisma.whatsAppBulkCampaign.findFirst({
      where: { id: campaignId, createdById: userId },
      include: { recipients: true, template: true, account: true },
    });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    return this.toPublicCampaign(campaign);
  }

  async listCampaigns(userId: string, accountId?: string) {
    const campaigns = await this.prisma.whatsAppBulkCampaign.findMany({
      where: {
        createdById: userId,
        status: { not: 'draft' },
        ...(accountId ? { accountId } : {}),
      },
      include: { template: { select: { name: true, category: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      total: c.total,
      sent: c.sent,
      failed: c.failed,
      createdAt: c.createdAt.toISOString(),
      completedAt: c.completedAt?.toISOString() ?? null,
      startedAt: c.startedAt?.toISOString() ?? null,
      templateName: c.template.name,
      templateCategory: c.template.category,
      accountId: c.accountId,
      estimatedCost: estimateWhatsAppCampaignCost(c.sent, c.template.category),
    }));
  }

  private toPublicCampaign(
    campaign: Prisma.WhatsAppBulkCampaignGetPayload<{
      include: { recipients: true; template: true; account: true };
    }>,
  ) {
    const estimatedCost = estimateWhatsAppCampaignCost(campaign.sent, campaign.template.category);

    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      total: campaign.total,
      sent: campaign.sent,
      failed: campaign.failed,
      startedAt: campaign.startedAt?.toISOString() ?? null,
      completedAt: campaign.completedAt?.toISOString() ?? null,
      createdAt: campaign.createdAt.toISOString(),
      accountId: campaign.accountId,
      templateId: campaign.templateId,
      templateName: campaign.template.name,
      templateCategory: campaign.template.category,
      estimatedCost,
      variableMapping: campaign.variableMapping as Record<string, string>,
      recipients: campaign.recipients.map((r) => ({
        id: r.id,
        phone: r.phone,
        name: r.name,
        company: r.company,
        source: r.source,
        status: r.status,
        metaMessageId: r.metaMessageId,
        error: r.error,
        sentAt: r.sentAt?.toISOString() ?? null,
      })),
    };
  }
}
