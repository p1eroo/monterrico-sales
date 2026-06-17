import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookGraphApiService } from './facebook-graph-api.service';

interface LeadFieldMap {
  fullName?: string;
  phone?: string;
  email?: string;
}

function mapLeadFields(fieldData: Array<{ name: string; values: string[] }>): LeadFieldMap {
  const result: LeadFieldMap = {};
  for (const field of fieldData) {
    const val = field.values?.[0]?.trim();
    if (!val) continue;
    const key = field.name.toLowerCase();
    if (key.includes('nombre') || key.includes('name') || key.includes('full_name')) {
      result.fullName = val;
    } else if (key.includes('teléfono') || key.includes('telefono') || key.includes('phone') || key.includes('celular') || key.includes('cel')) {
      result.phone = val;
    } else if (key.includes('email') || key.includes('correo') || key.includes('mail')) {
      result.email = val;
    }
  }
  return result;
}

function toJsonValue(data: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
}

@Injectable()
export class FacebookLeadsService {
  private readonly logger = new Logger(FacebookLeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphApi: FacebookGraphApiService,
    private readonly config: ConfigService,
  ) {}

  async connectAccount(userId: string, dto: { pageId: string; pageName: string; pageAccessToken: string; pageTokenExpiresAt?: string; instagramId?: string }) {
    const validation = await this.graphApi.validateToken(dto.pageAccessToken);
    if (!validation.is_valid) {
      throw new BadRequestException('El token de acceso no es válido');
    }

    const existing = await this.prisma.facebookAccount.findUnique({ where: { pageId: dto.pageId } });
    if (existing) {
      return this.prisma.facebookAccount.update({
        where: { pageId: dto.pageId },
        data: {
          pageName: dto.pageName,
          pageAccessToken: dto.pageAccessToken,
          pageTokenExpiresAt: dto.pageTokenExpiresAt ? new Date(dto.pageTokenExpiresAt) : null,
          instagramId: dto.instagramId,
          connectedById: userId,
          active: true,
        },
        include: { forms: true },
      });
    }

    const account = await this.prisma.facebookAccount.create({
      data: {
        pageId: dto.pageId,
        pageName: dto.pageName,
        pageAccessToken: dto.pageAccessToken,
        pageTokenExpiresAt: dto.pageTokenExpiresAt ? new Date(dto.pageTokenExpiresAt) : null,
        instagramId: dto.instagramId,
        connectedById: userId,
      },
      include: { forms: true },
    });

    await this.syncForms(account.id);
    return this.prisma.facebookAccount.findUnique({
      where: { id: account.id },
      include: { forms: true },
    });
  }

  async getAccounts(userId: string) {
    return this.prisma.facebookAccount.findMany({
      where: { connectedById: userId },
      include: {
        forms: {
          where: { status: 'active' },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async disconnectAccount(accountId: string, userId: string) {
    const account = await this.prisma.facebookAccount.findFirst({
      where: { id: accountId, connectedById: userId },
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');
    await this.prisma.facebookAccount.update({
      where: { id: accountId },
      data: { active: false },
    });
    return { disconnected: true };
  }

  async syncForms(accountId: string) {
    const account = await this.prisma.facebookAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    const fbForms = await this.graphApi.getPageForms(account.pageId, account.pageAccessToken);

    for (const fbForm of fbForms) {
      await this.prisma.facebookForm.upsert({
        where: { facebookFormId: fbForm.id },
        create: {
          facebookFormId: fbForm.id,
          name: fbForm.name,
          pageId: account.pageId,
          accountId: account.id,
          locale: fbForm.locale,
          status: fbForm.status || 'active',
        },
        update: {
          name: fbForm.name,
          locale: fbForm.locale,
          status: fbForm.status || 'active',
        },
      });
    }

    await this.prisma.facebookAccount.update({
      where: { id: accountId },
      data: { lastSyncedAt: new Date() },
    });

    return this.prisma.facebookForm.findMany({
      where: { accountId },
      orderBy: { name: 'asc' },
    });
  }

  async syncLeads(accountId: string, formId?: string) {
    const account = await this.prisma.facebookAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Cuenta no encontrada');
    if (!account.active) throw new BadRequestException('La cuenta está desconectada');

    const forms = formId
      ? [await this.prisma.facebookForm.findUnique({ where: { id: formId } })].filter(Boolean)
      : await this.prisma.facebookForm.findMany({ where: { accountId, status: 'active' } });

    if (!forms.length) throw new NotFoundException('No hay formularios activos');

    let totalImported = 0;

    for (const form of forms) {
      if (!form) continue;

      const lastLead = await this.prisma.facebookLead.findFirst({
        where: { formId: form.id },
        orderBy: { createdTime: 'desc' },
        select: { createdTime: true },
      });

      const since = lastLead ? Math.floor(lastLead.createdTime.getTime() / 1000).toString() : undefined;

      const fbLeads = await this.graphApi.getFormLeads(form.facebookFormId, account.pageAccessToken, since);

      for (const fbLead of fbLeads) {
        const existing = await this.prisma.facebookLead.findUnique({
          where: { facebookLeadId: fbLead.id },
        });
        if (existing) continue;

        const mapped = mapLeadFields(fbLead.field_data);

        await this.prisma.facebookLead.create({
          data: {
            facebookLeadId: fbLead.id,
            formId: form.id,
            fieldData: toJsonValue(fbLead.field_data),
            fullName: mapped.fullName,
            phone: mapped.phone,
            email: mapped.email,
            adId: fbLead.ad_id,
            adName: fbLead.ad_name,
            createdTime: new Date(fbLead.created_time),
          },
        });
        totalImported++;
      }

      if (fbLeads.length > 0) {
        await this.prisma.facebookForm.update({
          where: { id: form.id },
          data: {
            leadsCount: { increment: fbLeads.length },
            lastLeadAt: new Date(),
          },
        });
      }
    }

    await this.prisma.facebookAccount.update({
      where: { id: accountId },
      data: { lastSyncedAt: new Date() },
    });

    return { imported: totalImported };
  }

  async importWebhookLead(leadgenId: string, pageId: string) {
    const account = await this.prisma.facebookAccount.findFirst({
      where: { pageId, active: true },
    });
    if (!account) {
      this.logger.warn(`No active account for page ${pageId}, skipping lead ${leadgenId}`);
      return;
    }

    const existing = await this.prisma.facebookLead.findUnique({
      where: { facebookLeadId: leadgenId },
    });
    if (existing) return;

    let fbLead;
    try {
      fbLead = await this.graphApi.getLeadDetails(leadgenId, account.pageAccessToken);
    } catch (err) {
      this.logger.error(`Failed to fetch lead details for ${leadgenId}: ${err}`);
      return;
    }

    const fbFormId = fbLead.id?.includes('?') ? fbLead.id.split('?')[0] : undefined;
    const form = await this.prisma.facebookForm.findFirst({
      where: { facebookFormId: fbFormId || '' },
    });
    if (!form) {
      this.logger.warn(`Form ${fbFormId} not found for lead ${leadgenId}, syncing forms first`);
      const forms = await this.graphApi.getPageForms(account.pageId, account.pageAccessToken);
      for (const f of forms) {
        await this.prisma.facebookForm.upsert({
          where: { facebookFormId: f.id },
          create: {
            facebookFormId: f.id,
            name: f.name,
            pageId: account.pageId,
            accountId: account.id,
            locale: f.locale,
            status: f.status || 'active',
          },
          update: { name: f.name, locale: f.locale, status: f.status || 'active' },
        });
      }
      return this.importWebhookLead(leadgenId, pageId);
    }

    const mapped = mapLeadFields(fbLead.field_data);

    await this.prisma.facebookLead.create({
      data: {
        facebookLeadId: leadgenId,
        formId: form.id,
        fieldData: toJsonValue(fbLead.field_data),
        fullName: mapped.fullName,
        phone: mapped.phone,
        email: mapped.email,
        adId: fbLead.ad_id,
        adName: fbLead.ad_name,
        createdTime: new Date(fbLead.created_time),
      },
    });

    await this.prisma.facebookForm.update({
      where: { id: form.id },
      data: { leadsCount: { increment: 1 }, lastLeadAt: new Date() },
    });

    this.logger.log(`Imported lead ${leadgenId} from form ${form.name}`);
  }

  async getLeads(userId: string, query: { formId?: string; search?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    const forms = await this.prisma.facebookForm.findMany({
      where: { account: { connectedById: userId } },
      select: { id: true },
    });
    const formIds = forms.map((f) => f.id);
    if (formIds.length === 0) return { data: [], total: 0, page, limit };

    where.formId = query.formId ? query.formId : { in: formIds };

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { fullName: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
        { email: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (query.dateFrom) {
      where.createdTime = { ...(where.createdTime as Record<string, unknown> || {}), gte: new Date(query.dateFrom) };
    }
    if (query.dateTo) {
      where.createdTime = { ...(where.createdTime as Record<string, unknown> || {}), lte: new Date(query.dateTo + 'T23:59:59Z') };
    }

    const [data, total] = await Promise.all([
      this.prisma.facebookLead.findMany({
        where,
        include: { form: { select: { id: true, name: true, facebookFormId: true } } },
        orderBy: { createdTime: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.facebookLead.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getStats(userId: string) {
    const forms = await this.prisma.facebookForm.findMany({
      where: { account: { connectedById: userId } },
      select: { id: true },
    });
    const formIds = forms.map((f) => f.id);

    if (formIds.length === 0) {
      return { total: 0, today: 0, lastSync: null, formsCount: 0, byForm: [] };
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [total, today, lastAccount] = await Promise.all([
      this.prisma.facebookLead.count({ where: { formId: { in: formIds } } }),
      this.prisma.facebookLead.count({ where: { formId: { in: formIds }, createdTime: { gte: todayStart } } }),
      this.prisma.facebookAccount.findFirst({
        where: { connectedById: userId },
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true },
      }),
    ]);

    const byForm = await this.prisma.facebookForm.findMany({
      where: { id: { in: formIds } },
      select: { id: true, name: true, leadsCount: true },
      orderBy: { leadsCount: 'desc' },
    });

    return {
      total,
      today,
      lastSync: lastAccount?.lastSyncedAt || null,
      formsCount: formIds.length,
      byForm,
    };
  }

  async getFormsList(userId: string) {
    return this.prisma.facebookForm.findMany({
      where: { account: { connectedById: userId, active: true } },
      include: { account: { select: { id: true, pageName: true, lastSyncedAt: true } } },
      orderBy: { name: 'asc' },
    });
  }
}
