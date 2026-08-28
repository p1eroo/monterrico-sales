import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { FlotaConductorMatchService } from '../flota-prospectos/flota-conductor-match.service';
import { FacebookGraphApiService, type FacebookLeadResponse, type FacebookFormResponse } from './facebook-graph-api.service';
import { storeCompanyRucValue } from '../common/company-ruc.util';
import type { ImportComercialDto, ImportFlotaDto } from './dto/import-lead.dto';

export type ComercialEntityType = 'contacto' | 'empresa' | 'oportunidad';

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

function normalizePlatform(raw?: string | null): string | null {
  const v = raw?.trim().toLowerCase();
  if (!v) return null;
  if (v === 'facebook') return 'fb';
  if (v === 'instagram') return 'ig';
  if (v === 'audience_network') return 'an';
  if (v === 'messenger') return 'msg';
  return v;
}

function platformLabel(key: string | null): string {
  switch (key) {
    case 'fb':
      return 'Facebook';
    case 'ig':
      return 'Instagram';
    case 'an':
      return 'Audience Network';
    case 'msg':
      return 'Messenger';
    default:
      return 'Sin dato';
  }
}

function humanizeFormFieldName(name: string): string {
  const cleaned = name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return name;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function isHiddenLeadField(name: string): boolean {
  const k = name.trim().toLowerCase();
  return k === 'inbox_url' || k === 'platform' || k === 'is_organic';
}

export type LeadTableColumn = { key: string; label: string };

function questionsFromGraph(fbForm: FacebookFormResponse): LeadTableColumn[] {
  const raw = Array.isArray(fbForm.questions) ? fbForm.questions : fbForm.questions?.data;
  if (!raw?.length) return [];
  const seen = new Set<string>();
  const cols: LeadTableColumn[] = [];
  for (const q of raw) {
    const key = (q.key || q.id || '').trim();
    if (!key || isHiddenLeadField(key) || seen.has(key)) continue;
    seen.add(key);
    cols.push({ key, label: (q.label || humanizeFormFieldName(key)).trim() });
  }
  return cols;
}

function parseStoredQuestions(raw: unknown): LeadTableColumn[] {
  if (!Array.isArray(raw)) return [];
  const cols: LeadTableColumn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as { key?: unknown; label?: unknown };
    const key = typeof rec.key === 'string' ? rec.key.trim() : '';
    if (!key || isHiddenLeadField(key)) continue;
    cols.push({
      key,
      label: typeof rec.label === 'string' && rec.label.trim() ? rec.label.trim() : humanizeFormFieldName(key),
    });
  }
  return cols;
}

function columnsFromFieldData(rows: unknown[]): LeadTableColumn[] {
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    for (const field of row) {
      if (!field || typeof field !== 'object') continue;
      const name = typeof (field as { name?: unknown }).name === 'string'
        ? (field as { name: string }).name.trim()
        : '';
      if (!name || isHiddenLeadField(name) || seen.has(name)) continue;
      seen.set(name, humanizeFormFieldName(name));
    }
  }
  return [...seen.entries()].map(([key, label]) => ({ key, label }));
}

function toLeadCreateData(
  formId: string,
  fbLead: FacebookLeadResponse,
  facebookLeadId = fbLead.id,
): Prisma.FacebookLeadUncheckedCreateInput {
  const mapped = mapLeadFields(fbLead.field_data || []);
  return {
    facebookLeadId,
    formId,
    fieldData: toJsonValue(fbLead.field_data || []),
    fullName: mapped.fullName,
    phone: mapped.phone,
    email: mapped.email,
    adId: fbLead.ad_id ?? null,
    adName: fbLead.ad_name ?? null,
    platform: normalizePlatform(fbLead.platform),
    isOrganic: typeof fbLead.is_organic === 'boolean' ? fbLead.is_organic : null,
    createdTime: new Date(fbLead.created_time),
  };
}

function toJsonValue(data: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
}

function peruCelular(raw?: string | null): string {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('51') && d.length >= 11) return d.slice(-9);
  return d.slice(0, 9);
}

function pickNonEmpty<T extends Record<string, string | null | undefined>>(base: T, overlay: Partial<T>): T {
  const out = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    if (typeof v === 'string' && v.trim()) {
      (out as Record<string, string>)[k] = v.trim();
    }
  }
  return out;
}

function parseOptionalInt(raw?: string | null): number | null {
  if (!raw?.trim()) return null;
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function fbSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function alreadyImportedComercial(lead: {
  importedAsContactId: string | null;
  importedAsCompanyId: string | null;
  importedAsOpportunityId: string | null;
}) {
  return !!(lead.importedAsContactId || lead.importedAsCompanyId || lead.importedAsOpportunityId);
}

function domainFromEmail(email?: string | null): string {
  const at = email?.split('@')[1]?.trim().toLowerCase();
  if (!at) return '';
  const personal = new Set([
    'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.es',
    'icloud.com', 'live.com', 'msn.com', 'proton.me', 'protonmail.com',
  ]);
  return personal.has(at) ? '' : at;
}

function parseAmount(raw?: string | null): number {
  if (!raw?.trim()) return NaN;
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!cleaned) return NaN;
  const n = cleaned.includes(',') && !cleaned.includes('.')
    ? Number(cleaned.replace(',', '.'))
    : Number(cleaned.replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function plusDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseComercialEntity(raw?: string | null): ComercialEntityType {
  if (raw === 'empresa' || raw === 'oportunidad') return raw;
  return 'contacto';
}

@Injectable()
export class FacebookLeadsService {
  private readonly logger = new Logger(FacebookLeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphApi: FacebookGraphApiService,
    private readonly config: ConfigService,
    private readonly conductorMatch: FlotaConductorMatchService,
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

  async getAccounts(_userId?: string) {
    return this.prisma.facebookAccount.findMany({
      where: { active: true },
      include: {
        forms: {
          where: { status: 'active' },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async disconnectAccount(accountId: string, _userId: string) {
    const account = await this.prisma.facebookAccount.findFirst({
      where: { id: accountId, active: true },
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
    const syncedIds = fbForms.map((f) => f.id);

    for (const fbForm of fbForms) {
      await this.upsertFacebookForm(account.id, account.pageId, fbForm);
    }

    let removedForms = 0;
    if (syncedIds.length > 0) {
      const removed = await this.prisma.facebookForm.deleteMany({
        where: {
          accountId,
          facebookFormId: { notIn: syncedIds },
        },
      });
      removedForms = removed.count;
      if (removedForms > 0) {
        this.logger.log(
          `Removed ${removedForms} obsolete form(s) and their leads for account ${accountId}`,
        );
      }
    }

    await this.prisma.facebookAccount.update({
      where: { id: accountId },
      data: { lastSyncedAt: new Date() },
    });

    const forms = await this.prisma.facebookForm.findMany({
      where: { accountId },
      orderBy: { name: 'asc' },
    });

    return { forms, removedForms };
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

      const missingPlatform = await this.prisma.facebookLead.count({
        where: { formId: form.id, OR: [{ platform: null }, { platform: '' }] },
      });

      const since =
        missingPlatform > 0 || !lastLead
          ? undefined
          : Math.floor(lastLead.createdTime.getTime() / 1000).toString();

      const fbLeads = await this.graphApi.getFormLeads(form.facebookFormId, account.pageAccessToken, since);

      for (const fbLead of fbLeads) {
        const created = await this.upsertLead(toLeadCreateData(form.id, fbLead));
        if (created) totalImported++;
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

    let fbLead;
    try {
      fbLead = await this.graphApi.getLeadDetails(leadgenId, account.pageAccessToken);
    } catch (err) {
      this.logger.error(`Failed to fetch lead details for ${leadgenId}: ${err}`);
      return;
    }

    const fbFormId = fbLead.form_id;
    const form = await this.prisma.facebookForm.findFirst({
      where: { facebookFormId: fbFormId || '' },
    });
    if (!form) {
      this.logger.warn(`Form ${fbFormId} not found for lead ${leadgenId}, syncing forms first`);
      const forms = await this.graphApi.getPageForms(account.pageId, account.pageAccessToken);
      for (const f of forms) {
        await this.upsertFacebookForm(account.id, account.pageId, f);
      }
      return this.importWebhookLead(leadgenId, pageId);
    }

    const created = await this.upsertLead(toLeadCreateData(form.id, fbLead, leadgenId));
    if (!created) return;

    await this.prisma.facebookForm.update({
      where: { id: form.id },
      data: { leadsCount: { increment: 1 }, lastLeadAt: new Date() },
    });

    this.logger.log(`Imported lead ${leadgenId} from form ${form.name}`);
  }

  private async upsertFacebookForm(accountId: string, pageId: string, fbForm: FacebookFormResponse) {
    const questions = questionsFromGraph(fbForm);
    await this.prisma.facebookForm.upsert({
      where: { facebookFormId: fbForm.id },
      create: {
        facebookFormId: fbForm.id,
        name: fbForm.name,
        pageId,
        accountId,
        locale: fbForm.locale,
        status: (fbForm.status || 'active').toLowerCase(),
        ...(questions.length ? { questions: toJsonValue(questions) } : {}),
      },
      update: {
        name: fbForm.name,
        locale: fbForm.locale,
        status: (fbForm.status || 'active').toLowerCase(),
        ...(questions.length ? { questions: toJsonValue(questions) } : {}),
      },
    });
  }

  private async resolveLeadColumns(formId: string): Promise<LeadTableColumn[]> {
    const [form, sample] = await Promise.all([
      this.prisma.facebookForm.findUnique({
        where: { id: formId },
        select: { questions: true },
      }),
      this.prisma.facebookLead.findMany({
        where: { formId },
        take: 100,
        orderBy: { createdTime: 'desc' },
        select: { fieldData: true },
      }),
    ]);
    const stored = parseStoredQuestions(form?.questions);
    const fromData = columnsFromFieldData(sample.map((row) => row.fieldData));
    if (!fromData.length) return stored;
    const labelByKey = new Map(stored.map((c) => [c.key, c.label]));
    const seen = new Set<string>();
    const out: LeadTableColumn[] = [];
    for (const col of fromData) {
      if (seen.has(col.key)) continue;
      seen.add(col.key);
      out.push({ key: col.key, label: labelByKey.get(col.key) || col.label });
    }
    for (const col of stored) {
      if (seen.has(col.key)) continue;
      seen.add(col.key);
      out.push(col);
    }
    return out;
  }

  private async upsertLead(data: Prisma.FacebookLeadUncheckedCreateInput): Promise<boolean> {
    try {
      await this.prisma.facebookLead.create({ data });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        await this.prisma.facebookLead.update({
          where: { facebookLeadId: String(data.facebookLeadId) },
          data: {
            platform: data.platform,
            isOrganic: data.isOrganic,
            adId: data.adId,
            adName: data.adName,
          },
        });
        return false;
      }
      throw e;
    }
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

  async previewImport(leadId: string, target: 'flota' | 'comercial', entity?: string) {
    const lead = await this.getLeadForImport(leadId);
    if (target === 'flota') {
      const heuristic = this.heuristicFlota(lead);
      const ai = await this.aiExtract(lead, 'flota');
      return pickNonEmpty(heuristic, ai);
    }
    const kind = parseComercialEntity(entity);
    if (kind === 'empresa') {
      const heuristic = this.heuristicEmpresa(lead);
      const ai = await this.aiExtract(lead, 'empresa');
      return pickNonEmpty(heuristic, ai);
    }
    if (kind === 'oportunidad') {
      const heuristic = this.heuristicOportunidad(lead);
      const ai = await this.aiExtract(lead, 'oportunidad');
      return pickNonEmpty(heuristic, ai);
    }
    const heuristic = this.heuristicComercial(lead);
    const ai = await this.aiExtract(lead, 'contacto');
    return pickNonEmpty(heuristic, ai);
  }

  async sendToComercial(leadId: string, userId: string, dto: ImportComercialDto) {
    const lead = await this.getLeadForImport(leadId);
    if (alreadyImportedComercial(lead)) {
      throw new ConflictException('Este lead ya fue enviado a Comercial');
    }

    const kind = parseComercialEntity(dto.entityType);
    if (kind === 'empresa') return this.sendComercialEmpresa(leadId, userId, dto);
    if (kind === 'oportunidad') return this.sendComercialOportunidad(leadId, userId, dto);
    return this.sendComercialContacto(leadId, userId, dto);
  }

  private async sendComercialContacto(leadId: string, userId: string, dto: ImportComercialDto) {
    const name = (dto.name || dto.contactName || '').trim();
    if (!name) throw new BadRequestException('El nombre es requerido');

    const telefono = dto.telefono?.trim() || '';
    const correo = dto.correo?.trim() || '';
    const cargo = dto.cargo?.trim() || undefined;
    const notes = dto.notes?.trim() || '';

    const contact = await this.prisma.contact.create({
      data: {
        urlSlug: fbSlug('fb-lead'),
        name,
        telefono,
        correo,
        cargo,
        fuente: 'facebook',
        etapa: 'lead',
        assignedTo: userId,
        direccion: notes.slice(0, 500) || undefined,
      },
    });

    await this.prisma.facebookLead.update({
      where: { id: leadId },
      data: { importedAsContactId: contact.id, importedAt: new Date() },
    });

    this.logger.log(`Lead ${leadId} sent to Comercial as contact ${contact.id}`);
    return { entityType: 'contacto' as const, contactId: contact.id };
  }

  private async sendComercialEmpresa(leadId: string, userId: string, dto: ImportComercialDto) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('El nombre de la empresa es requerido');

    const domain = dto.dominio?.trim().toLowerCase() || null;
    if (domain) {
      const existingDomain = await this.prisma.company.findFirst({
        where: { domain: { equals: domain, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (existingDomain) {
        throw new BadRequestException(`Ya existe una empresa con el mismo dominio: ${existingDomain.name}`);
      }
    }

    const notes = dto.notes?.trim() || '';
    const company = await this.prisma.company.create({
      data: {
        urlSlug: fbSlug('fb-emp'),
        name,
        ruc: storeCompanyRucValue(dto.ruc),
        telefono: dto.telefono?.trim() || null,
        correo: dto.correo?.trim() || null,
        domain,
        distrito: dto.distrito?.trim() || null,
        direccion: notes.slice(0, 500) || null,
        facturacionEstimada: 0,
        fuente: 'facebook',
        etapa: 'lead',
        assignedTo: userId,
      },
    });

    await this.prisma.facebookLead.update({
      where: { id: leadId },
      data: { importedAsCompanyId: company.id, importedAt: new Date() },
    });

    this.logger.log(`Lead ${leadId} sent to Comercial as company ${company.id}`);
    return { entityType: 'empresa' as const, companyId: company.id };
  }

  private async sendComercialOportunidad(leadId: string, userId: string, dto: ImportComercialDto) {
    const title = dto.title?.trim();
    if (!title) throw new BadRequestException('El título de la oportunidad es requerido');

    const amount = parseAmount(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor que 0');
    }

    const contactName = (dto.contactName || dto.name || '').trim();
    if (!contactName) throw new BadRequestException('El nombre del contacto es requerido');

    const etapa = dto.etapa?.trim() || 'lead';
    const closeRaw = dto.expectedCloseDate?.trim() || plusDaysIso(30);
    const expectedCloseDate = new Date(`${closeRaw}T12:00:00.000Z`);
    if (Number.isNaN(expectedCloseDate.getTime())) {
      throw new BadRequestException('Fecha de cierre inválida');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.create({
        data: {
          urlSlug: fbSlug('fb-lead'),
          name: contactName,
          telefono: dto.telefono?.trim() || '',
          correo: dto.correo?.trim() || '',
          fuente: 'facebook',
          etapa: 'lead',
          assignedTo: userId,
        },
      });

      const opportunity = await tx.opportunity.create({
        data: {
          urlSlug: fbSlug('fb-opp'),
          title,
          amount,
          probability: 0,
          etapa,
          status: 'abierta',
          priority: 'media',
          expectedCloseDate,
          assignedTo: userId,
          fuente: 'facebook',
        },
      });

      await tx.contactOpportunity.create({
        data: { contactId: contact.id, opportunityId: opportunity.id },
      });

      await tx.facebookLead.update({
        where: { id: leadId },
        data: {
          importedAsContactId: contact.id,
          importedAsOpportunityId: opportunity.id,
          importedAt: new Date(),
        },
      });

      return { contactId: contact.id, opportunityId: opportunity.id };
    });

    this.logger.log(`Lead ${leadId} sent to Comercial as opportunity ${result.opportunityId}`);
    return { entityType: 'oportunidad' as const, ...result };
  }

  async sendToFlota(leadId: string, userId: string, dto: ImportFlotaDto) {
    const lead = await this.getLeadForImport(leadId);
    if (lead.importedAsFlotaProspectoId) throw new ConflictException('Este lead ya fue enviado a Flota');

    const nombreCompleto = dto.nombreCompleto.trim();
    const celular = peruCelular(dto.celular);
    if (!nombreCompleto || !celular) {
      throw new BadRequestException('Nombre y celular son requeridos');
    }

    const prospecto = await this.prisma.flotaProspecto.create({
      data: {
        nombreCompleto,
        celular,
        redSocial: dto.redSocial?.trim() || 'Facebook',
        distrito: dto.distrito?.trim() || null,
        ciudad: dto.ciudad?.trim() || null,
        operador: dto.operador?.trim() || null,
        modalidad: dto.modalidad?.trim() || null,
        edad: parseOptionalInt(dto.edad),
        anioVehiculo: parseOptionalInt(dto.anioVehiculo),
        placa: dto.placa?.trim().toUpperCase() || null,
        observaciones: dto.observaciones?.trim() || null,
        origen: 'FACEBOOK',
        estado: 'Nuevo',
      },
    });

    await this.prisma.facebookLead.update({
      where: { id: leadId },
      data: { importedAsFlotaProspectoId: prospecto.id, importedAt: new Date() },
    });

    await this.conductorMatch.afiliarSiConductor(prospecto);

    this.logger.log(`Lead ${leadId} sent to Flota as prospecto ${prospecto.id} by ${userId}`);
    return { flotaProspectoId: prospecto.id };
  }

  private async getLeadForImport(leadId: string) {
    const lead = await this.prisma.facebookLead.findUnique({
      where: { id: leadId },
      include: { form: { include: { account: true } } },
    });
    if (!lead) throw new NotFoundException('Lead no encontrado');
    return lead;
  }

  private leadAnswersText(lead: {
    fullName: string | null;
    phone: string | null;
    email: string | null;
    adName: string | null;
    platform: string | null;
    form: { name: string };
    fieldData: unknown;
  }): string {
    const fields = Array.isArray(lead.fieldData)
      ? (lead.fieldData as Array<{ name: string; values: string[] }>)
      : [];
    const answers = fields
      .map((f) => `${f.name}: ${(f.values || []).join(', ')}`)
      .join('\n');
    return [
      `Formulario: ${lead.form.name}`,
      `Nombre: ${lead.fullName || ''}`,
      `Teléfono: ${lead.phone || ''}`,
      `Email: ${lead.email || ''}`,
      `Anuncio: ${lead.adName || ''}`,
      `Plataforma: ${lead.platform || ''}`,
      answers,
    ].join('\n');
  }

  private heuristicFlota(lead: {
    fullName: string | null;
    phone: string | null;
    platform: string | null;
    form: { name: string };
    fieldData: unknown;
  }): Record<string, string> {
    const fieldData = (Array.isArray(lead.fieldData) ? lead.fieldData : []) as Array<{ name: string; values: string[] }>;
    const redSocial = lead.platform === 'ig' ? 'Instagram' : 'Facebook';
    return {
      nombreCompleto: lead.fullName || this.extractField(fieldData, ['nombre', 'name', 'full_name']) || '',
      celular: peruCelular(lead.phone || this.extractField(fieldData, ['teléfono', 'celular', 'phone', 'cel', 'telefono'])),
      edad: this.extractField(fieldData, ['edad', 'años', 'age']) || '',
      placa: (this.extractField(fieldData, ['placa', 'patente', 'license_plate']) || '').toUpperCase(),
      anioVehiculo: this.extractField(fieldData, ['año', 'anio', 'year', 'modelo']) || '',
      redSocial,
      operador: this.extractField(fieldData, ['operador']) || '',
      modalidad: this.extractField(fieldData, ['modalidad', 'atu', 'setare']) || '',
      ciudad: this.extractField(fieldData, ['ciudad', 'city', 'lima', 'arequipa']) || '',
      distrito: this.extractField(fieldData, ['distrito', 'district', 'lince']) || '',
      observaciones: '',
    };
  }

  private heuristicComercial(lead: {
    fullName: string | null;
    phone: string | null;
    email: string | null;
    form: { name: string };
    fieldData: unknown;
  }): Record<string, string> {
    const fieldData = (Array.isArray(lead.fieldData) ? lead.fieldData : []) as Array<{ name: string; values: string[] }>;
    return {
      name: lead.fullName || this.extractField(fieldData, ['nombre', 'name', 'full_name']) || '',
      telefono: lead.phone || this.extractField(fieldData, ['teléfono', 'telefono', 'celular', 'phone', 'cel']) || '',
      correo: lead.email || this.extractField(fieldData, ['email', 'correo', 'mail']) || '',
      cargo: this.extractField(fieldData, ['cargo', 'puesto', 'job', 'title']) || '',
      notes: '',
    };
  }

  private heuristicEmpresa(lead: {
    fullName: string | null;
    phone: string | null;
    email: string | null;
    form: { name: string };
    fieldData: unknown;
  }): Record<string, string> {
    const fieldData = (Array.isArray(lead.fieldData) ? lead.fieldData : []) as Array<{ name: string; values: string[] }>;
    const correo = lead.email || this.extractField(fieldData, ['email', 'correo', 'mail']) || '';
    return {
      name: this.extractField(fieldData, ['empresa', 'company', 'negocio', 'razon']) || lead.fullName || '',
      ruc: this.extractField(fieldData, ['ruc']) || '',
      telefono: lead.phone || this.extractField(fieldData, ['teléfono', 'telefono', 'celular', 'phone', 'cel']) || '',
      correo,
      dominio: this.extractField(fieldData, ['dominio', 'domain', 'web', 'website', 'sitio']) || domainFromEmail(correo),
      distrito: this.extractField(fieldData, ['distrito', 'district']) || '',
      notes: '',
    };
  }

  private heuristicOportunidad(lead: {
    fullName: string | null;
    phone: string | null;
    email: string | null;
    adName: string | null;
    form: { name: string };
    fieldData: unknown;
  }): Record<string, string> {
    const fieldData = (Array.isArray(lead.fieldData) ? lead.fieldData : []) as Array<{ name: string; values: string[] }>;
    const contactName = lead.fullName || this.extractField(fieldData, ['nombre', 'name', 'full_name']) || '';
    const title = lead.adName?.trim()
      || (contactName ? `Lead Facebook · ${contactName}` : '')
      || lead.form.name;
    return {
      title,
      amount: this.extractField(fieldData, ['monto', 'presupuesto', 'amount', 'valor', 'facturacion']) || '',
      etapa: 'lead',
      expectedCloseDate: plusDaysIso(30),
      contactName,
      telefono: lead.phone || this.extractField(fieldData, ['teléfono', 'telefono', 'celular', 'phone', 'cel']) || '',
      correo: lead.email || this.extractField(fieldData, ['email', 'correo', 'mail']) || '',
    };
  }

  private async aiExtract(lead: {
    fullName: string | null;
    phone: string | null;
    email: string | null;
    adName: string | null;
    platform: string | null;
    form: { name: string };
    fieldData: unknown;
  }, target: 'flota' | 'contacto' | 'empresa' | 'oportunidad'): Promise<Record<string, string>> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) return {};

    const schemas: Record<typeof target, string> = {
      flota: `{
  "nombreCompleto": string,
  "celular": string (9 dígitos Perú, sin +51),
  "edad": string,
  "placa": string,
  "anioVehiculo": string,
  "redSocial": "Facebook" | "Instagram" | "",
  "operador": string,
  "modalidad": "ATU" | "PARTICULAR" | "SETARE" | "",
  "ciudad": "Lima" | "Arequipa" | "",
  "distrito": string
}`,
      contacto: `{
  "name": string,
  "telefono": string,
  "correo": string,
  "cargo": string
}`,
      empresa: `{
  "name": string (nombre comercial o razón social),
  "ruc": string,
  "telefono": string,
  "correo": string,
  "dominio": string (sin https://),
  "distrito": string
}`,
      oportunidad: `{
  "title": string,
  "amount": string (solo número, sin moneda),
  "etapa": "lead",
  "expectedCloseDate": string (YYYY-MM-DD),
  "contactName": string,
  "telefono": string,
  "correo": string
}`,
    };

    const labels: Record<typeof target, string> = {
      flota: 'un prospecto de Flota (conductores/taxistas)',
      contacto: 'un contacto comercial',
      empresa: 'una empresa comercial',
      oportunidad: 'una oportunidad comercial (y su contacto)',
    };

    const prompt = `Eres un asistente del CRM Monterrico. Extrae datos de un lead de Facebook Lead Ads para ${labels[target]}.
Devuelve SOLO JSON con estas claves (string vacío si no hay dato):
${schemas[target]}

Datos del lead:
${this.leadAnswersText(lead)}`;

    try {
      const model = this.config.get<string>('OPENAI_MODEL')?.trim() || 'gpt-4o-mini';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 700,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        this.logger.warn(`OpenAI extract HTTP ${res.status}: ${text.slice(0, 300)}`);
        return {};
      }
      const parsed = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
      const content = parsed.choices?.[0]?.message?.content?.trim();
      if (!content) return {};
      const json = JSON.parse(content) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(json)) {
        if (v == null) continue;
        out[k] = String(v).trim();
      }
      if (out.celular) out.celular = peruCelular(out.celular);
      delete out.notes;
      delete out.observaciones;
      return out;
    } catch (e) {
      this.logger.warn(`OpenAI extract falló: ${e instanceof Error ? e.message : e}`);
      return {};
    }
  }

  async deleteLead(leadId: string, userId: string) {
    const lead = await this.prisma.facebookLead.findUnique({
      where: { id: leadId },
      include: { form: { include: { account: true } } },
    });
    if (!lead) throw new NotFoundException('Lead no encontrado');
    if (!lead.form.account.active) {
      throw new ForbiddenException('La cuenta de Facebook de este lead está desconectada');
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

  private async resolveBulkLeadWhere(
    userId: string,
    params: {
      ids?: string[];
      selectAll?: boolean;
      formId?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const { ids, selectAll, formId, search, dateFrom, dateTo } = params;

    const forms = await this.prisma.facebookForm.findMany({
      where: { account: { active: true }, status: 'active' },
      select: { id: true },
    });
    const ownFormIds = forms.map((f) => f.id);

    const where: Record<string, unknown> = { formId: { in: ownFormIds } };

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
      if (dateFrom) {
        where.createdTime = {
          ...((where.createdTime as Record<string, unknown>) || {}),
          gte: new Date(dateFrom),
        };
      }
      if (dateTo) {
        where.createdTime = {
          ...((where.createdTime as Record<string, unknown>) || {}),
          lte: new Date(dateTo + 'T23:59:59Z'),
        };
      }
    } else if (ids?.length) {
      where.id = { in: ids };
    } else {
      throw new BadRequestException('Debes proporcionar ids o selectAll=true');
    }

    return where;
  }

  async bulkPreview(
    params: {
      ids?: string[];
      selectAll?: boolean;
      formId?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      target: 'flota' | 'comercial';
      entity?: 'contacto' | 'empresa';
    },
    userId: string,
  ) {
    const target = params.target === 'comercial' ? 'comercial' : 'flota';
    const entity = params.entity === 'empresa' ? 'empresa' : 'contacto';
    const where = await this.resolveBulkLeadWhere(userId, params);
    const MAX = 500;
    const leads = await this.prisma.facebookLead.findMany({
      where,
      include: { form: { select: { id: true, name: true, facebookFormId: true } } },
      orderBy: { createdTime: 'desc' },
      take: MAX + 1,
    });
    const truncated = leads.length > MAX;
    const slice = truncated ? leads.slice(0, MAX) : leads;
    const columns =
      target === 'flota'
        ? [
            { key: 'nombreCompleto', label: 'Nombre' },
            { key: 'celular', label: 'Celular' },
            { key: 'redSocial', label: 'Red social' },
            { key: 'ciudad', label: 'Ciudad' },
            { key: 'distrito', label: 'Distrito' },
          ]
        : entity === 'empresa'
          ? [
              { key: 'name', label: 'Empresa' },
              { key: 'telefono', label: 'Teléfono' },
              { key: 'correo', label: 'Correo' },
              { key: 'ruc', label: 'RUC' },
              { key: 'dominio', label: 'Dominio' },
            ]
          : [
              { key: 'name', label: 'Nombre' },
              { key: 'telefono', label: 'Teléfono' },
              { key: 'correo', label: 'Correo' },
              { key: 'cargo', label: 'Cargo' },
            ];

    const rows = slice.map((lead, i) => {
      const mapped =
        target === 'flota'
          ? this.heuristicFlota(lead)
          : entity === 'empresa'
            ? this.heuristicEmpresa(lead)
            : this.heuristicComercial(lead);
      const already =
        target === 'flota'
          ? !!lead.importedAsFlotaProspectoId
          : alreadyImportedComercial(lead);
      let error: string | undefined;
      if (already) {
        error =
          target === 'flota'
            ? 'Ya fue enviado a Flota'
            : 'Ya fue enviado a Comercial';
      } else if (target === 'flota') {
        if (!mapped.nombreCompleto?.trim() || !mapped.celular?.trim()) {
          error = 'Faltan nombre o celular';
        }
      } else if (!mapped.name?.trim()) {
        error =
          entity === 'empresa'
            ? 'Falta el nombre de la empresa'
            : 'Falta el nombre';
      }
      return {
        leadId: lead.id,
        row: i + 1,
        ok: !error,
        error,
        columns: mapped,
      };
    });

    const okCount = rows.filter((r) => r.ok).length;
    return {
      target,
      entity: target === 'comercial' ? entity : undefined,
      columns,
      rows,
      totalRows: rows.length,
      okCount,
      errorCount: rows.length - okCount,
      truncated,
    };
  }

  async bulkSend(
    params: {
      ids?: string[];
      selectAll?: boolean;
      formId?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      target: 'flota' | 'comercial';
      entity?: 'contacto' | 'empresa';
    },
    userId: string,
  ) {
    const preview = await this.bulkPreview(params, userId);
    let sent = 0;
    let skipped = 0;
    const errors: { leadId: string; error: string }[] = [];

    for (const row of preview.rows) {
      if (!row.ok) {
        skipped += 1;
        continue;
      }
      try {
        if (preview.target === 'flota') {
          await this.sendToFlota(row.leadId, userId, {
            nombreCompleto: row.columns.nombreCompleto || '',
            celular: row.columns.celular || '',
            redSocial: row.columns.redSocial,
            ciudad: row.columns.ciudad,
            distrito: row.columns.distrito,
            operador: row.columns.operador,
            modalidad: row.columns.modalidad,
            edad: row.columns.edad,
            anioVehiculo: row.columns.anioVehiculo,
            placa: row.columns.placa,
          });
        } else {
          await this.sendToComercial(row.leadId, userId, {
            entityType: preview.entity === 'empresa' ? 'empresa' : 'contacto',
            name: row.columns.name,
            telefono: row.columns.telefono,
            correo: row.columns.correo,
            cargo: row.columns.cargo,
            ruc: row.columns.ruc,
            dominio: row.columns.dominio,
            distrito: row.columns.distrito,
          });
        }
        sent += 1;
      } catch (err) {
        errors.push({
          leadId: row.leadId,
          error: err instanceof Error ? err.message : 'Error al importar',
        });
      }
    }

    return {
      sent,
      skipped,
      failed: errors.length,
      errors,
      truncated: preview.truncated,
    };
  }

  async bulkDeleteLeads(params: {
    ids?: string[];
    selectAll?: boolean;
    formId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }, userId: string) {
    const where = await this.resolveBulkLeadWhere(userId, params);

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
      where: { account: { active: true }, status: 'active' },
      select: { id: true },
    });
    const formIds = forms.map((f) => f.id);
    if (formIds.length === 0) return { data: [], total: 0, page, limit, columns: [] };

    if (query.formId) {
      if (!formIds.includes(query.formId)) {
        return { data: [], total: 0, page, limit, columns: [] };
      }
      where.formId = query.formId;
    } else {
      where.formId = { in: formIds };
    }

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

    const [data, total, columns] = await Promise.all([
      this.prisma.facebookLead.findMany({
        where,
        include: { form: { select: { id: true, name: true, facebookFormId: true } } },
        orderBy: { createdTime: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.facebookLead.count({ where }),
      query.formId ? this.resolveLeadColumns(query.formId) : Promise.resolve([] as LeadTableColumn[]),
    ]);

    return { data, total, page, limit, columns };
  }

  async getStats(userId: string) {
    const userForms = await this.prisma.facebookForm.findMany({
      where: { account: { active: true }, status: 'active' },
      select: { id: true, name: true, leadsCount: true },
    });
    const formIds = userForms.map((f) => f.id);

    if (formIds.length === 0) {
      return {
        total: 0,
        today: 0,
        lastSync: null,
        formsCount: 0,
        byForm: [],
        byPlatform: [],
      };
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [total, today, lastAccount, byPlatformGroups] = await Promise.all([
      this.prisma.facebookLead.count({ where: { formId: { in: formIds } } }),
      this.prisma.facebookLead.count({
        where: { formId: { in: formIds }, createdTime: { gte: todayStart } },
      }),
      this.prisma.facebookAccount.findFirst({
        where: { active: true },
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true },
      }),
      this.prisma.facebookLead.groupBy({
        by: ['platform'],
        where: { formId: { in: formIds } },
        _count: { _all: true },
      }),
    ]);

    const byForm = [...userForms].sort((a, b) => b.leadsCount - a.leadsCount);

    const byPlatform = byPlatformGroups
      .map((g) => ({
        key: g.platform || 'unknown',
        name: platformLabel(g.platform),
        value: g._count._all,
      }))
      .filter((g) => g.value > 0)
      .sort((a, b) => b.value - a.value);

    return {
      total,
      today,
      lastSync: lastAccount?.lastSyncedAt || null,
      formsCount: formIds.length,
      byForm,
      byPlatform,
    };
  }

  async getFormsList(_userId?: string) {
    return this.prisma.facebookForm.findMany({
      where: { account: { active: true } },
      include: { account: { select: { id: true, pageName: true, lastSyncedAt: true } } },
      orderBy: { name: 'asc' },
    });
  }
}
