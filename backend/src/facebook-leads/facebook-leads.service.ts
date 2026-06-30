import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
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
      where: { connectedById: userId, active: true },
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
            status: (fbForm.status || 'active').toLowerCase(),
        },
        update: {
          name: fbForm.name,
          locale: fbForm.locale,
          status: (fbForm.status || 'active').toLowerCase(),
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

      await this.prisma.facebookForm.update({
        where: { id: form.id },
        data: {
          leadsCount: fbLeads.length,
          lastLeadAt: fbLeads.length > 0 ? new Date() : undefined,
        },
      });
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

  private extractField(fieldData: Array<{ name: string; values: string[] }>, fieldNames: string[]): string | undefined {
    for (const field of fieldData) {
      const key = field.name.toLowerCase().trim();
      if (fieldNames.some((n) => key.includes(n))) {
        const val = field.values?.[0]?.trim();
        if (val) return val;
      }
    }
    return undefined;
  }

  private buildFieldMap(fieldData: Array<{ name: string; values: string[] }>): Record<string, string> {
    const map: Record<string, string> = {};
    for (const field of fieldData) {
      const val = field.values?.[0]?.trim();
      if (val) map[field.name] = val;
    }
    return map;
  }

  async sendToComercial(leadId: string, userId: string) {
    const lead = await this.prisma.facebookLead.findUnique({
      where: { id: leadId },
      include: { form: { include: { account: true } } },
    });
    if (!lead) throw new NotFoundException('Lead no encontrado');
    if (lead.importedAsContactId) throw new ConflictException('Este lead ya fue enviado a Comercial');

    const fieldData = lead.fieldData as Array<{ name: string; values: string[] }>;
    const allFields = this.buildFieldMap(fieldData);

    const name = lead.fullName || this.extractField(fieldData, ['nombre', 'name', 'full_name']) || 'Lead Facebook';
    const telefono = lead.phone || this.extractField(fieldData, ['teléfono', 'telefono', 'celular', 'phone', 'cel']) || '';
    const correo = lead.email || this.extractField(fieldData, ['email', 'correo', 'mail', 'e-mail']) || '';
    const empresa = this.extractField(fieldData, ['empresa', 'razon_social', 'company', 'business']) || '';
    const ruc = this.extractField(fieldData, ['ruc', 'r.u.c', 'documento']) || '';

    const extras = Object.entries(allFields)
      .filter(([k]) => !['nombre', 'name', 'full_name', 'teléfono', 'telefono', 'celular', 'phone', 'cel',
        'email', 'correo', 'mail', 'e-mail', 'empresa', 'razon_social', 'company', 'business',
        'ruc', 'r.u.c', 'documento'].some((x) => k.toLowerCase().includes(x)))
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    const notes = [`Importado de Facebook · Formulario: ${lead.form.name}`, extras].filter(Boolean).join('\n\n');

    let companyId: string | undefined;
    if (empresa || ruc) {
      const existing = ruc ? await this.prisma.company.findUnique({ where: { ruc } }) : null;
      if (existing) {
        companyId = existing.id;
      } else {
        const company = await this.prisma.company.create({
          data: {
            name: empresa || `Cliente ${name}`,
            urlSlug: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ruc: ruc || undefined,
            telefono,
            correo,
            fuente: 'facebook',
            assignedTo: userId,
            facturacionEstimada: 0,
          },
        });
        companyId = company.id;
      }
    }

    const contact = await this.prisma.contact.create({
      data: {
        urlSlug: `fb-lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        telefono,
        correo,
        fuente: 'facebook',
        etapa: 'lead',
        assignedTo: userId,
        direccion: extras.slice(0, 500),
      },
    });

    if (companyId) {
      await this.prisma.companyContact.create({
        data: { companyId, contactId: contact.id, isPrimary: true },
      });
    }

    await this.prisma.facebookLead.update({
      where: { id: leadId },
      data: { importedAsContactId: contact.id, importedAt: new Date() },
    });

    this.logger.log(`Lead ${leadId} sent to Comercial as contact ${contact.id}`);
    return { contactId: contact.id };
  }

  async sendToFlota(leadId: string, userId: string) {
    const lead = await this.prisma.facebookLead.findUnique({
      where: { id: leadId },
      include: { form: { include: { account: true } } },
    });
    if (!lead) throw new NotFoundException('Lead no encontrado');
    if (lead.importedAsFlotaProspectoId) throw new ConflictException('Este lead ya fue enviado a Flota');

    const fieldData = lead.fieldData as Array<{ name: string; values: string[] }>;
    const allFields = this.buildFieldMap(fieldData);

    const nombreCompleto = lead.fullName || this.extractField(fieldData, ['nombre', 'name', 'full_name']) || 'Lead Facebook';
    const celular = lead.phone || this.extractField(fieldData, ['teléfono', 'celular', 'phone', 'cel', 'telefono']) || '';
    const distrito = this.extractField(fieldData, ['distrito', 'district', 'ubicación', 'direccion', 'dirección']) || '';
    const placa = this.extractField(fieldData, ['placa', 'patente', 'license_plate']) || '';
    const operador = this.extractField(fieldData, ['operador', 'conductor', 'driver']) || '';

    const extras = Object.entries(allFields)
      .filter(([k]) => !['nombre', 'name', 'full_name', 'teléfono', 'celular', 'phone', 'cel', 'telefono',
        'distrito', 'district', 'ubicación', 'direccion', 'dirección',
        'placa', 'patente', 'license_plate', 'operador', 'conductor', 'driver'].some((x) => k.toLowerCase().includes(x)))
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    const prospecto = await this.prisma.flotaProspecto.create({
      data: {
        nombreCompleto,
        celular,
        redSocial: 'facebook',
        distrito,
        placa,
        operador,
        observaciones: [`Importado de Facebook · Formulario: ${lead.form.name}`, extras].filter(Boolean).join('\n\n'),
        origen: 'FACEBOOK',
      },
    });

    await this.prisma.facebookLead.update({
      where: { id: leadId },
      data: { importedAsFlotaProspectoId: prospecto.id, importedAt: new Date() },
    });

    this.logger.log(`Lead ${leadId} sent to Flota as prospecto ${prospecto.id}`);
    return { flotaProspectoId: prospecto.id };
  }

  async deleteLead(leadId: string, userId: string) {
    const lead = await this.prisma.facebookLead.findUnique({
      where: { id: leadId },
      include: { form: { include: { account: true } } },
    });
    if (!lead) throw new NotFoundException('Lead no encontrado');
    if (lead.form.account.connectedById !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar este lead');
    }

    await this.prisma.facebookLead.delete({ where: { id: leadId } });

    const formCount = await this.prisma.facebookLead.count({
      where: { formId: lead.formId },
    });
    await this.prisma.facebookForm.update({
      where: { id: lead.formId },
      data: { leadsCount: formCount },
    });

    this.logger.log(`Lead ${leadId} deleted by user ${userId}`);
    return { deleted: true };
  }

  async bulkDeleteLeads(params: {
    ids?: string[];
    selectAll?: boolean;
    formId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }, userId: string) {
    const { ids, selectAll, formId, search, dateFrom, dateTo } = params;

    const forms = await this.prisma.facebookForm.findMany({
      where: { account: { connectedById: userId } },
      select: { id: true },
    });
    const ownFormIds = forms.map((f) => f.id);

    let where: Record<string, unknown> = { formId: { in: ownFormIds } };

    if (selectAll) {
      if (formId) where.formId = formId;
      if (search) {
        const s = search.trim();
        where.OR = [
          { fullName: { contains: s, mode: 'insensitive' } },
          { phone: { contains: s } },
          { email: { contains: s, mode: 'insensitive' } },
        ];
      }
      if (dateFrom) where.createdTime = { ...(where.createdTime as Record<string, unknown> || {}), gte: new Date(dateFrom) };
      if (dateTo) where.createdTime = { ...(where.createdTime as Record<string, unknown> || {}), lte: new Date(dateTo + 'T23:59:59Z') };
    } else if (ids?.length) {
      where.id = { in: ids };
    } else {
      throw new BadRequestException('Debes proporcionar ids o selectAll=true');
    }

    const leadsToDelete = await this.prisma.facebookLead.findMany({
      where,
      select: { id: true, formId: true },
    });

    if (leadsToDelete.length === 0) {
      return { deleted: 0 };
    }

    await this.prisma.facebookLead.deleteMany({ where });

    const affectedFormIds = [...new Set(leadsToDelete.map((l) => l.formId))];
    for (const formId of affectedFormIds) {
      const formCount = await this.prisma.facebookLead.count({
        where: { formId },
      });
      await this.prisma.facebookForm.update({
        where: { id: formId },
        data: { leadsCount: formCount },
      });
    }

    this.logger.log(`${leadsToDelete.length} leads deleted by user ${userId}`);
    return { deleted: leadsToDelete.length };
  }

  async getLeads(userId: string, query: { formId?: string; search?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
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
