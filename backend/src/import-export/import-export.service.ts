import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import { CompaniesService } from '../companies/companies.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import {
  parseCsv,
  stringifyCsvRow,
  buildHeaderIndex,
  rowGet,
} from '../common/csv.util';
import {
  formatImportedCompanyName,
  formatImportedPersonName,
} from '../common/import-display-name.util';
import { inferCompanyDomainFromContactEmail } from '../common/email-domain.util';
import { Prisma } from '../generated/prisma';
import type { CreateContactDto } from '../contacts/dto/create-contact.dto';
import type { CreateCompanyDto } from '../companies/dto/create-company.dto';
import type { CreateOpportunityDto } from '../opportunities/dto/create-opportunity.dto';
import { FactilizaService } from '../factiliza/factiliza.service';
import { CrmConfigService } from '../crm-config/crm-config.service';
import { EntitySyncService } from '../sync/entity-sync.service';
import type { CrmDataScope } from '../auth/crm-data-scope.service';
import { mergeCompanyScope } from '../common/crm-data-scope-where.util';
import {
  applySimpleAdvisorFilter,
  companyAdvisorWhere,
  parseAdvisorFilterQuery,
} from '../common/advisor-filter.util';
import { normalizeClienteRecuperadoForCsv } from '../common/normalize-cliente-recuperado';
import { STAGE_PROBABILITY_FALLBACK } from '../crm-config/crm-config.constants';
import {
  buildEtapaStepFunction,
  buildIsoWeekExportColumns,
} from './company-export-weeks.util';

const MAX_IMPORT_ROWS = 1500;
const MAX_COMPANY_IMPORT_ROWS = 5000;
const UTF8_BOM = '\uFEFF';

export type BulkImportRowError = { row: number; message: string; name?: string };

function importRowErr(row: number, message: string, name?: string): BulkImportRowError {
  const trimmed = name?.trim();
  return trimmed ? { row, message, name: trimmed } : { row, message };
}

export type BulkImportResultDto = {
  totalRows: number;
  created: number;
  skipped: number;
  errors: BulkImportRowError[];
};

export type ImportProgressCallback = (progress: {
  processedRows: number;
  created: number;
  skipped: number;
  errorCount: number;
}) => void | Promise<void>;

export type ContactImportPreviewRowDto = {
  row: number;
  nombre: string;
  telefono: string;
  correo: string;
  fuente: string;
  etapa: string;
  valorEstimado: number;
  empresaNombre: string;
  empresaRuc: string;
  empresaResumen: string;
  ok: boolean;
  error?: string;
  /** Encabezado original del CSV → valor de celda (vacío como string vacío). */
  csvColumns: Record<string, string>;
};

export type ContactImportPreviewResultDto = {
  totalRows: number;
  skipped: number;
  rows: ContactImportPreviewRowDto[];
  okCount: number;
  errorCount: number;
};

export type CompanyImportPreviewRowDto = {
  row: number;
  empresaNombre: string;
  empresaRuc: string;
  empresaResumen: string;
  contactoVista: string;
  etapa: string;
  facturacionEstimada: number;
  ok: boolean;
  error?: string;
  /** Encabezado original del CSV → valor de celda (vacío como string vacío). */
  csvColumns: Record<string, string>;
};

export type CompanyImportPreviewResultDto = {
  totalRows: number;
  skipped: number;
  rows: CompanyImportPreviewRowDto[];
  okCount: number;
  errorCount: number;
};

/** Plantilla / export contactos: sin ids (los genera el sistema). Empresa por nombre + RUC. */
const CONTACT_HEADERS = [
  'nombre',
  'telefono_1',
  'telefono_2',
  'telefono_3',
  'celular_1',
  'celular_2',
  'correo',
  'fuente',
  'cargo',
  'etapa',
  'valor_estimado',
  'asignado_a',
  'departamento',
  'provincia',
  'distrito',
  'direccion',
  'cliente_recuperado',
  'empresa_nombre',
  'empresa_ruc',
] as const;

const CONTACT_TEMPLATE_HEADERS = [
  'nombre',
  'telefono',
  'correo',
  'fuente',
  'cargo',
  'etapa',
  'valor_estimado',
  'asignado_a',
  'departamento',
  'provincia',
  'distrito',
  'direccion',
  'cliente_recuperado',
  'domain',
  'empresa_nombre',
  'empresa_ruc',
] as const;

/** Plantilla / import empresa: sin id; contacto opcional por fila (mismo patrón que import contactos). */
const COMPANY_HEADERS = [
  'nombre',
  'razon_social',
  'ruc',
  'telefono_1',
  'telefono_2',
  'telefono_3',
  'celular_1',
  'celular_2',
  'domain',
  'rubro',
  'tipo',
  'correo',
  'linkedin',
  'distrito',
  'provincia',
  'departamento',
  'direccion',
  'facturacion_estimada',
  'fuente',
  'cliente_recuperado',
  'etapa',
  'asignado_a',
  'contacto_nombre',
  'contacto_telefono_1',
  'contacto_telefono_2',
  'contacto_telefono_3',
  'contacto_celular_1',
  'contacto_celular_2',
  'contacto_correo',
  'contacto_cargo',
  'contacto_departamento',
  'contacto_provincia',
  'contacto_distrito',
  'contacto_direccion',
  'contacto_cliente_recuperado',
] as const;

const COMPANY_TEMPLATE_HEADERS = [
  'nombre',
  'razon_social',
  'ruc',
  'telefono_1',
  'domain',
  'rubro',
  'tipo',
  'correo',
  'distrito',
  'provincia',
  'departamento',
  'direccion',
  'facturacion_estimada',
  'fuente',
  'cliente_recuperado',
  'etapa',
  'asignado_a',
  'contacto_nombre',
  'contacto_telefono',
  'contacto_correo',
  'contacto_cargo',
] as const;

const OPPORTUNITY_HEADERS = [
  'id',
  'titulo',
  'monto',
  'etapa',
  'estado',
  'prioridad',
  'probabilidad',
  'fecha_cierre_esperado',
  'asignado_a',
  'contacto_id',
  'empresa_id',
  'contacto_correo',
  'empresa_ruc',
  'fuente',
] as const;

@Injectable()
export class ImportExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contactsService: ContactsService,
    private readonly companiesService: CompaniesService,
    private readonly opportunitiesService: OpportunitiesService,
    private readonly factiliza: FactilizaService,
    private readonly crmConfig: CrmConfigService,
    private readonly entitySync: EntitySyncService,
  ) {}

  countImportDataRows(csvText: string): number {
    const rows = parseCsv(csvText);
    if (rows.length < 2) return 0;
    return rows.length - 1;
  }

  /** Correo mínimamente válido para usar como nombre de contacto (solo si no hay nombre ni doc). */
  private looksLikeEmailForContactImport(s: string): boolean {
    const t = s.trim();
    if (t.length < 5 || !t.includes('@')) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
  }

  private isCompanyImportPlaceholderContactName(s: string | undefined): boolean {
    const t = (s ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return t === 'central telefonica';
  }

  private companyImportEffectiveContactName(params: {
    contactoNombreCsv: string;
    contactoCorreo?: string;
    contactoCargo?: string;
  }): string {
    const nombre = params.contactoNombreCsv.trim();
    if (!this.isCompanyImportPlaceholderContactName(nombre)) {
      return nombre;
    }
    const correo = (params.contactoCorreo ?? '').trim();
    if (this.looksLikeEmailForContactImport(correo)) {
      return correo;
    }
    const cargo = (params.contactoCargo ?? '').trim();
    return cargo;
  }

  private isCompanyImportPlaceholderName(s: string | undefined): boolean {
    const t = s?.trim() ?? '';
    return !t || /^empresa ruc /i.test(t);
  }

  /**
   * Nombre o razón social ya aportados en CSV (no placeholder): no hace falta consultar SUNAT.
   */
  private companyImportHasUsableIdentityFields(
    name: string,
    razonSocial?: string,
  ): boolean {
    const n = name?.trim();
    const rz = razonSocial?.trim();
    return (
      (!!n && !this.isCompanyImportPlaceholderName(n)) ||
      (!!rz && !this.isCompanyImportPlaceholderName(rz))
    );
  }

  private companyImportHasUsableIdentity(dto: CreateCompanyDto): boolean {
    return this.companyImportHasUsableIdentityFields(
      dto.name ?? '',
      dto.razonSocial,
    );
  }

  /**
   * En import de empresas, `razon_social` puede suplir a `nombre` si este viene vacío.
   * Si ambos faltan, usa el fallback dado (p. ej. "Empresa RUC ...").
   */
  private companyImportEffectiveName(
    name: string | undefined,
    razonSocial?: string,
    fallback?: string,
  ): string {
    const n = name?.trim();
    if (n) return n;
    const rz = razonSocial?.trim();
    if (rz) return rz;
    return fallback?.trim() ?? '';
  }

  private contactImportRowDedupeKey(displayName: string): string {
    if (!displayName?.trim()) return '';
    return this.foldContactImportKey(displayName);
  }

  private pickCsvOrApiField(csv?: string, api?: string): string | undefined {
    const c = csv?.trim();
    if (c) return c;
    const a = api?.trim();
    return a || undefined;
  }

  /**
   * En plantillas operativas a veces escriben `0` para representar “sin dato”.
   * Lo tratamos como vacío solo en campos de texto/opcionales del import.
   */
  private normalizeImportTextCell(raw: string | undefined): string {
    const value = raw?.trim() ?? '';
    return value === '0' ? '' : value;
  }

  private rowGetImportText(
    row: string[],
    headerIndex: Map<string, number>,
    aliases: string[],
  ): string {
    return this.normalizeImportTextCell(rowGet(row, headerIndex, aliases));
  }

  private normalizeImportNumberSeparator(
    value: string,
    decimalSep: ',' | '.',
  ): string {
    const removeThousands = decimalSep === ',' ? /\./g : /,/g;
    const working = value.replace(removeThousands, '');
    const parts = working.split(decimalSep);
    if (parts.length === 1) return working;
    const decimal = parts.pop() ?? '';
    if (decimal.length > 0 && decimal.length <= 2) {
      return `${parts.join('')}.${decimal}`;
    }
    return [...parts, decimal].join('');
  }

  private parseImportNumericCell(raw: string | undefined): number | null {
    const input = raw?.trim();
    if (!input) return null;
    const sign = input.startsWith('-') ? -1 : 1;
    let cleaned = input
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, '')
      .replace(/^s\/?/i, '')
      .replace(/^us\$?/i, '')
      .replace(/^usd/i, '')
      .replace(/^pen/i, '')
      .replace(/[^0-9,.\-]/g, '')
      .replace(/-/g, '');
    if (!cleaned) return null;
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma >= 0 && lastDot >= 0) {
      cleaned = this.normalizeImportNumberSeparator(
        cleaned,
        lastComma > lastDot ? ',' : '.',
      );
    } else if (lastComma >= 0) {
      cleaned = this.normalizeImportNumberSeparator(cleaned, ',');
    } else if (lastDot >= 0) {
      cleaned = this.normalizeImportNumberSeparator(cleaned, '.');
    }
    const parsed = Number.parseFloat(`${sign < 0 ? '-' : ''}${cleaned}`);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private readCsvFields(
    row: string[],
    headerIndex: Map<string, number>,
    headers: string[],
  ): string[] {
    return headers
      .map((header) => this.rowGetImportText(row, headerIndex, [header]))
      .filter(Boolean);
  }

  private joinImportPhoneParts(
    fixedPhones: string[],
    mobilePhones: string[],
  ): string {
    const uniqueValues = (values: string[]) => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const value of values) {
        const trimmed = value.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(trimmed);
      }
      return out;
    };

    const fixed = uniqueValues(fixedPhones);
    const mobile = uniqueValues(mobilePhones);

    if (fixed.length && mobile.length) {
      return `Tel: ${fixed.join(' / ')} | Cel: ${mobile.join(' / ')}`;
    }
    if (mobile.length) {
      return `Cel: ${mobile.join(' / ')}`;
    }
    if (fixed.length) {
      return fixed.join(' / ');
    }
    return '';
  }

  private parseStoredCompanyPhoneField(value?: string): {
    fixedPhones: string[];
    mobilePhones: string[];
  } {
    const raw = value?.trim() ?? '';
    if (!raw) return { fixedPhones: [], mobilePhones: [] };

    const splitValues = (text: string) =>
      text
        .split('/')
        .map((part) => part.trim())
        .filter(Boolean);

    const segments = raw
      .split('|')
      .map((segment) => segment.trim())
      .filter(Boolean);

    const fixedPhones: string[] = [];
    const mobilePhones: string[] = [];

    if (segments.length === 0) {
      return { fixedPhones: splitValues(raw), mobilePhones: [] };
    }

    for (const segment of segments) {
      if (/^tel:/i.test(segment)) {
        fixedPhones.push(...splitValues(segment.replace(/^tel:\s*/i, '')));
        continue;
      }
      if (/^cel:/i.test(segment)) {
        mobilePhones.push(...splitValues(segment.replace(/^cel:\s*/i, '')));
        continue;
      }
      fixedPhones.push(...splitValues(segment));
    }

    return { fixedPhones, mobilePhones };
  }

  private mergeCompanyPhoneImportField(
    currentValue?: string,
    incomingValue?: string,
  ): string | undefined {
    const current = this.parseStoredCompanyPhoneField(currentValue);
    const incoming = this.parseStoredCompanyPhoneField(incomingValue);
    const merged = this.joinImportPhoneParts(
      [...current.fixedPhones, ...incoming.fixedPhones],
      [...current.mobilePhones, ...incoming.mobilePhones],
    );
    return merged || undefined;
  }

  private async mergeCompanyPhoneForImport(
    companyId: string,
    incomingValue?: string,
  ): Promise<void> {
    const incoming = incomingValue?.trim();
    if (!incoming) return;

    const current = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { telefono: true },
    });
    if (!current) return;

    const merged = this.mergeCompanyPhoneImportField(
      current.telefono ?? undefined,
      incoming,
    );
    if (!merged || merged === (current.telefono?.trim() || undefined)) return;

    await this.prisma.company.update({
      where: { id: companyId },
      data: { telefono: merged },
    });
  }

  private async updateExistingCompanyFromImport(
    companyId: string,
    params: {
      telefono?: string;
      domain?: string;
      rubro?: string;
      tipo?: string;
      correo?: string;
      linkedin?: string;
      distrito?: string;
      provincia?: string;
      departamento?: string;
      direccion?: string;
      facturacionEstimada?: number;
      setFacturacionEstimada?: boolean;
      fuente?: string;
      clienteRecuperado?: 'si' | 'no';
      etapa?: string;
      assignedTo?: string;
    },
  ): Promise<boolean> {
    const current = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        telefono: true,
        domain: true,
        rubro: true,
        tipo: true,
        correo: true,
        linkedin: true,
        distrito: true,
        provincia: true,
        departamento: true,
        direccion: true,
        facturacionEstimada: true,
        fuente: true,
        clienteRecuperado: true,
        etapa: true,
        assignedTo: true,
      },
    });
    if (!current) return false;

    const data: Prisma.CompanyUncheckedUpdateInput = {};

    const mergedPhone = this.mergeCompanyPhoneImportField(
      current.telefono ?? undefined,
      params.telefono,
    );
    if (mergedPhone && mergedPhone !== (current.telefono?.trim() || undefined)) {
      data.telefono = mergedPhone;
    }

    const maybeSetTrimmed = (
      key:
        | 'domain'
        | 'rubro'
        | 'tipo'
        | 'correo'
        | 'linkedin'
        | 'distrito'
        | 'provincia'
        | 'departamento'
        | 'direccion'
        | 'fuente'
        | 'etapa',
      incoming?: string,
    ) => {
      const next = incoming?.trim();
      if (!next) return;
      const prev = current[key]?.trim();
      if (prev !== next) {
        data[key] = next;
      }
    };

    maybeSetTrimmed('domain', params.domain);
    maybeSetTrimmed('rubro', params.rubro);
    maybeSetTrimmed('tipo', params.tipo);
    maybeSetTrimmed('correo', params.correo);
    maybeSetTrimmed('linkedin', params.linkedin);
    maybeSetTrimmed('distrito', params.distrito);
    maybeSetTrimmed('provincia', params.provincia);
    maybeSetTrimmed('departamento', params.departamento);
    maybeSetTrimmed('direccion', params.direccion);
    maybeSetTrimmed('fuente', params.fuente);
    maybeSetTrimmed('etapa', params.etapa);

    if (
      params.setFacturacionEstimada &&
      params.facturacionEstimada != null &&
      Number.isFinite(params.facturacionEstimada) &&
      current.facturacionEstimada !== params.facturacionEstimada
    ) {
      data.facturacionEstimada = params.facturacionEstimada;
    }

    if (
      params.clienteRecuperado &&
      current.clienteRecuperado !== params.clienteRecuperado
    ) {
      data.clienteRecuperado = params.clienteRecuperado;
    }

    const nextAssignedTo = params.assignedTo?.trim();
    if (nextAssignedTo && current.assignedTo !== nextAssignedTo) {
      data.assignedTo = nextAssignedTo;
    }

    if (Object.keys(data).length === 0) return false;

    await this.prisma.company.update({
      where: { id: companyId },
      data,
    });
    await this.entitySync.propagateFromCompany(companyId);
    return true;
  }

  private readContactPhoneImportField(
    row: string[],
    headerIndex: Map<string, number>,
  ): string {
    return this.joinImportPhoneParts(
      this.readCsvFields(row, headerIndex, [
        'telefono_1',
        'telefono_2',
        'telefono_3',
      ]),
      this.readCsvFields(row, headerIndex, ['celular_1', 'celular_2']),
    );
  }

  private readCompanyPhoneImportField(
    row: string[],
    headerIndex: Map<string, number>,
  ): string {
    return this.joinImportPhoneParts(
      this.readCsvFields(row, headerIndex, [
        'telefono_1',
        'telefono_2',
        'telefono_3',
      ]),
      this.readCsvFields(row, headerIndex, ['celular_1', 'celular_2']),
    );
  }

  private readCompanyContactPhoneImportField(
    row: string[],
    headerIndex: Map<string, number>,
  ): string {
    return this.joinImportPhoneParts(
      this.readCsvFields(row, headerIndex, [
        'contacto_telefono_1',
        'contacto_telefono_2',
        'contacto_telefono_3',
      ]),
      this.readCsvFields(row, headerIndex, [
        'contacto_celular_1',
        'contacto_celular_2',
      ]),
    );
  }

  /** Vincula contacto a empresa si aún no lo está; solo un contacto primario por empresa. */
  private async ensureCompanyContactLinkForImport(
    contactId: string,
    companyId: string,
  ): Promise<void> {
    const exists = await this.prisma.companyContact.findFirst({
      where: { contactId, companyId },
      select: { id: true },
    });
    if (exists) return;

    const hasPrimary = await this.prisma.companyContact.findFirst({
      where: { companyId, isPrimary: true },
      select: { id: true },
    });

    await this.prisma.companyContact.create({
      data: {
        contactId,
        companyId,
        isPrimary: !hasPrimary,
      },
    });
  }

  /** Contacto ya enlazado a la empresa (por nombre). */
  private async findContactIdForCompanyImport(
    nombreCsv: string,
    companyId: string,
  ): Promise<string | null> {
    const nameTry = nombreCsv.trim();
    if (nameTry) {
      const byName = await this.prisma.contact.findFirst({
        where: {
          name: { equals: nameTry, mode: 'insensitive' },
          companies: { some: { companyId } },
        },
        select: { id: true },
      });
      if (byName) return byName.id;
    }
    return null;
  }

  /** Enriquece alta de empresa desde Factiliza (SUNAT vía API) si hay token; no falla el import si no. */
  private async enrichCompanyDtoFromRuc(
    dto: CreateCompanyDto,
  ): Promise<CreateCompanyDto> {
    const ruc = dto.ruc?.replace(/\D/g, '').trim();
    if (!ruc || ruc.length !== 11) {
      return dto;
    }
    if (this.companyImportHasUsableIdentity(dto)) {
      const n = this.companyImportEffectiveName(dto.name, dto.razonSocial);
      const rz = dto.razonSocial?.trim();
      return {
        ...dto,
        ruc,
        name: n ? formatImportedCompanyName(n) : dto.name,
        razonSocial: rz ? formatImportedCompanyName(rz) : dto.razonSocial,
      };
    }
    try {
      const data = await this.factiliza.consultarRuc(ruc);
      const rs = data.nombre_o_razon_social?.trim();
      const placeholderName = this.isCompanyImportPlaceholderName(dto.name);
      const nameRaw =
        dto.name?.trim() && !placeholderName
          ? dto.name.trim()
          : rs || dto.name || '';
      const razonRaw = dto.razonSocial?.trim() || rs || undefined;
      return {
        ...dto,
        ruc,
        name: nameRaw ? formatImportedCompanyName(nameRaw) : nameRaw,
        razonSocial: razonRaw
          ? formatImportedCompanyName(razonRaw)
          : undefined,
        departamento: dto.departamento?.trim() || data.departamento || undefined,
        provincia: dto.provincia?.trim() || data.provincia || undefined,
        distrito: dto.distrito?.trim() || data.distrito || undefined,
        direccion:
          dto.direccion?.trim() ||
          data.direccion ||
          data.direccion_completa ||
          undefined,
      };
    } catch {
      const n = dto.name?.trim();
      const rz = dto.razonSocial?.trim();
      return {
        ...dto,
        ruc,
        name: n ? formatImportedCompanyName(n) : dto.name,
        razonSocial: rz ? formatImportedCompanyName(rz) : dto.razonSocial,
      };
    }
  }

  contactsTemplateCsv(): string {
    return UTF8_BOM + stringifyCsvRow([...CONTACT_TEMPLATE_HEADERS]);
  }

  async contactsExportCsv(
    scope?: CrmDataScope,
    opts?: {
      search?: string;
      etapa?: string;
      fuente?: string;
      assignedTo?: string;
      excludeAssignedTo?: string;
      advisorPool?: string;
      columns?: string;
    },
  ): Promise<string> {
    const where: Prisma.ContactWhereInput = {};
    if (opts?.search?.trim()) {
      const q = opts.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { correo: { contains: q, mode: 'insensitive' } },
        { telefono: { contains: q } },
        { cargo: { contains: q, mode: 'insensitive' } },
        {
          companies: {
            some: {
              company: {
                name: { contains: q, mode: 'insensitive' },
              },
            },
          },
        },
      ];
    }
    if (opts?.etapa?.trim()) where.etapa = opts.etapa.trim();
    if (opts?.fuente?.trim()) {
      const canon = await this.crmConfig.normalizeLeadSource(opts.fuente);
      where.fuente = { equals: canon, mode: 'insensitive' };
    }
    if (scope && !scope.unrestricted) {
      where.assignedTo = scope.viewerUserId;
    } else {
      applySimpleAdvisorFilter(
        where,
        parseAdvisorFilterQuery({
          assignedTo: opts?.assignedTo,
          excludeAssignedTo: opts?.excludeAssignedTo,
          advisorPool: opts?.advisorPool,
        }),
      );
    }
    const rows = await this.prisma.contact.findMany({
      where,
      take: 10_000,
      orderBy: { updatedAt: 'desc' },
      select: {
        name: true,
        telefono: true,
        correo: true,
        fuente: true,
        cargo: true,
        etapa: true,
        estimatedValue: true,
        assignedTo: true,
        departamento: true,
        provincia: true,
        distrito: true,
        direccion: true,
        clienteRecuperado: true,
        companies: {
          where: { isPrimary: true },
          take: 1,
          select: { company: { select: { name: true, ruc: true } } },
        },
      },
    });
    const lines: string[] = [stringifyCsvRow([...CONTACT_HEADERS])];
    
    // Mapear columnas visibles si se especifica
    const allowedHeaders = opts?.columns
      ? new Set(opts.columns.split(',').map((c) => c.trim()).filter(Boolean))
      : null;
    const headerIndexes = allowedHeaders
      ? CONTACT_HEADERS.map((h, i) => (allowedHeaders.has(h) ? i : -1)).filter((i) => i >= 0)
      : CONTACT_HEADERS.map((_, i) => i);
    
    if (allowedHeaders) {
      const filteredHeaders = headerIndexes.map((i) => CONTACT_HEADERS[i]);
      lines[0] = stringifyCsvRow(filteredHeaders);
    }
    
    for (const c of rows) {
      const emp = c.companies[0]?.company;
      const row = [
        c.name,
        c.telefono,
        '',
        '',
        '',
        '',
        c.correo,
        c.fuente,
        c.cargo ?? '',
        c.etapa,
        String(c.estimatedValue),
        c.assignedTo ?? '',
        c.departamento ?? '',
        c.provincia ?? '',
        c.distrito ?? '',
        c.direccion ?? '',
        c.clienteRecuperado ?? '',
        emp?.name ?? '',
        emp?.ruc ?? '',
      ];
      const filteredRow = headerIndexes.map((i) => row[i]);
      lines.push(stringifyCsvRow(allowedHeaders ? filteredRow : row));
    }
    return UTF8_BOM + lines.join('\n');
  }

  /**
   * Mapa RUC normalizado (solo dígitos) → empresas candidatas.
   * Una sola consulta index-friendly vía regexp_replace en PostgreSQL.
   */
  private async companiesByNormalizedRucDigitsGroupedMap(
    digitsList: string[],
  ): Promise<
    Map<
      string,
      Array<{
        id: string;
        name: string;
        razonSocial: string | null;
        ruc: string | null;
      }>
    >
  > {
    const uniq = [...new Set(digitsList.filter((d) => d.length > 0))];
    const out = new Map<
      string,
      Array<{
        id: string;
        name: string;
        razonSocial: string | null;
        ruc: string | null;
      }>
    >();
    if (uniq.length === 0) return out;
    const found = await this.prisma.$queryRaw<
      { id: string; name: string; razonSocial: string | null; ruc: string | null }[]
    >(Prisma.sql`
      SELECT id, name, "razonSocial", ruc
      FROM "Company"
      WHERE "ruc" IS NOT NULL
        AND regexp_replace("ruc", '[^0-9]', '', 'g') IN (${Prisma.join(
          uniq.map((d) => Prisma.sql`${d}`),
        )})
    `);
    for (const row of found) {
      const k = (row.ruc ?? '').replace(/\D/g, '');
      if (!k) continue;
      const bucket = out.get(k) ?? [];
      bucket.push(row);
      out.set(k, bucket);
    }
    return out;
  }

  private async companiesByDomainMap(
    domains: string[],
  ): Promise<Map<string, { id: string; name: string }>> {
    const uniq = [...new Set(domains.filter((d) => d.length > 0).map((d) => d.toLowerCase()))];
    const out = new Map<string, { id: string; name: string }>();
    if (uniq.length === 0) return out;
    const found = await this.prisma.company.findMany({
      where: { domain: { in: uniq, mode: 'insensitive' } },
      select: { id: true, name: true, domain: true },
    });
    for (const row of found) {
      const k = (row.domain ?? '').toLowerCase();
      if (!k) continue;
      out.set(k, { id: row.id, name: row.name });
    }
    return out;
  }

  /**
   * Mantiene la API previa (primer match por RUC) para otros flujos que aún la usan.
   */
  private async companiesByNormalizedRucDigitsMap(
    digitsList: string[],
  ): Promise<Map<string, { id: string; name: string; ruc: string | null }>> {
    const grouped = await this.companiesByNormalizedRucDigitsGroupedMap(digitsList);
    const out = new Map<string, { id: string; name: string; ruc: string | null }>();
    for (const [digits, rows] of grouped) {
      const first = rows[0];
      if (first) {
        out.set(digits, { id: first.id, name: first.name, ruc: first.ruc });
      }
    }
    return out;
  }

  /** Busca empresa por RUC tal cual o solo dígitos (coincide con registros existentes). */
  private async findCompanyByRucInput(rucRaw: string) {
    const trimmed = rucRaw.trim();
    if (!trimmed) return null;
    const digits = trimmed.replace(/\D/g, '');
    const or: Prisma.CompanyWhereInput[] = [{ ruc: trimmed }];
    if (digits && digits !== trimmed) {
      or.push({ ruc: digits });
    }
    const first = await this.prisma.company.findFirst({
      where: { OR: or },
      select: { id: true, name: true, ruc: true },
    });
    if (first) return first;
    if (!digits) return null;
    const m = await this.companiesByNormalizedRucDigitsMap([digits]);
    return m.get(digits) ?? null;
  }

  /**
   * Etiqueta en vista previa: si hay RUC en el CSV, solo el número; si no, solo el nombre;
   * si no hay ninguno, «Sin empresa». (Evita textos largos tipo SUNAT / borrador de empresa.)
   */
  private previewEmpresaLabel(empresaNombre: string, empresaRuc: string): string {
    const n = empresaNombre.trim();
    const r = empresaRuc.trim();
    if (!r && !n) return 'Sin empresa';
    const rucNorm = r ? r.replace(/\D/g, '') || r : '';
    if (rucNorm) return rucNorm;
    return n;
  }

  /** Mapa ordenado de columnas del archivo para la vista previa (etiqueta legible → valor). */
  private buildCompanyImportPreviewCsvColumns(
    headerRow: string[],
    dataRow: string[],
  ): Record<string, string> {
    const seen = new Map<string, number>();
    const out: Record<string, string> = {};
    for (let i = 0; i < headerRow.length; i++) {
      const raw = headerRow[i]?.trim() ?? '';
      let label = raw || `Columna ${i + 1}`;
      const n = (seen.get(label) ?? 0) + 1;
      seen.set(label, n);
      if (n > 1) label = `${label} (${n})`;
      out[label] = this.normalizeImportTextCell(dataRow[i]);
    }
    return out;
  }

  private async findCompanyByNameInsensitive(nombre: string) {
    const n = nombre.trim();
    if (!n) return null;
    return this.prisma.company.findFirst({
      where: {
        OR: [
          { name: { equals: n, mode: 'insensitive' } },
          { razonSocial: { equals: n, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, ruc: true },
    });
  }

  private companyMatchesImportName(
    company: { name: string; razonSocial?: string | null },
    nombre: string,
  ): boolean {
    const folded = this.foldContactImportKey(nombre);
    if (!folded) return false;
    if (this.foldContactImportKey(company.name) === folded) return true;
    return !!company.razonSocial &&
      this.foldContactImportKey(company.razonSocial) === folded;
  }

  private pickCompanyForImportByRucAndNames(
    companies: Array<{
      id: string;
      name: string;
      razonSocial?: string | null;
      ruc: string | null;
    }>,
    nombres: Array<string | undefined>,
  ) {
    if (companies.length === 0) return null;
    const canonical = [...companies].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    )[0]!;
    for (const nombre of nombres) {
      const nameTrim = (nombre ?? '').trim();
      if (!nameTrim) continue;
      const hit = companies.find((c) =>
        this.companyMatchesImportName(c, nameTrim),
      );
      if (hit) return hit;
    }
    return canonical;
  }

  private async findCompaniesByRucInputAll(rucRaw: string) {
    const trimmed = rucRaw.trim();
    if (!trimmed) return [];
    const digits = trimmed.replace(/\D/g, '');
    const or: Prisma.CompanyWhereInput[] = [{ ruc: trimmed }];
    if (digits && digits !== trimmed) {
      or.push({ ruc: digits });
    }
    const exact = await this.prisma.company.findMany({
      where: { OR: or },
      select: { id: true, name: true, razonSocial: true, ruc: true },
    });
    if (!digits) return exact;
    const grouped = await this.companiesByNormalizedRucDigitsGroupedMap([digits]);
    const byId = new Map(exact.map((row) => [row.id, row]));
    for (const row of grouped.get(digits) ?? []) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
    return [...byId.values()];
  }

  private async companiesByFoldedNameMap(
    names: string[],
  ): Promise<Map<string, { id: string; name: string; ruc: string | null }>> {
    const uniq = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    const out = new Map<
      string,
      { id: string; name: string; ruc: string | null }
    >();
    const CHUNK = 40;
    for (let i = 0; i < uniq.length; i += CHUNK) {
      const chunk = uniq.slice(i, i + CHUNK);
      const found = await this.prisma.company.findMany({
        where: {
          OR: chunk.flatMap((n) => [
            { name: { equals: n, mode: 'insensitive' } },
            { razonSocial: { equals: n, mode: 'insensitive' } },
          ]),
        },
        select: { id: true, name: true, ruc: true, razonSocial: true },
      });
      for (const c of found) {
        const k1 = this.foldContactImportKey(c.name);
        if (!out.has(k1)) out.set(k1, c);
        if (c.razonSocial) {
          const k2 = this.foldContactImportKey(c.razonSocial);
          if (!out.has(k2)) out.set(k2, c);
        }
      }
    }
    return out;
  }

  /**
   * Misma semántica que `contactAlreadyExistsForImport`, pero precargada para la vista previa.
   */
  private async buildCompanyImportPreviewContactExistenceLookup(
    checks: Array<{
      companyId: string;
      nameForExistCheck: string;
    }>,
  ): Promise<
    (companyId: string, nameForExistCheck: string) => boolean
  > {
    const companyIds = [...new Set(checks.map((c) => c.companyId))];
    const namesToQuery = new Set<string>();
    for (const c of checks) {
      const t = c.nameForExistCheck.trim();
      if (t) namesToQuery.add(t);
    }
    const nameHits = new Set<string>();
    if (companyIds.length > 0 && namesToQuery.size > 0) {
      const nameArr = [...namesToQuery];
      const CHUNK = 25;
      for (let i = 0; i < nameArr.length; i += CHUNK) {
        const chunk = nameArr.slice(i, i + CHUNK);
        const rows = await this.prisma.contact.findMany({
          where: {
            companies: {
              some: { isPrimary: true, companyId: { in: companyIds } },
            },
            OR: chunk.map((n) => ({
              name: { equals: n, mode: 'insensitive' },
            })),
          },
          select: {
            name: true,
            companies: {
              where: { isPrimary: true },
              take: 1,
              select: { companyId: true },
            },
          },
        });
        for (const r of rows) {
          const cid = r.companies[0]?.companyId;
          if (!cid) continue;
          nameHits.add(`${cid}\t${this.foldContactImportKey(r.name)}`);
        }
      }
    }
    return (companyId: string, nameForExistCheck: string) => {
      const t = nameForExistCheck.trim();
      if (t && nameHits.has(`${companyId}\t${this.foldContactImportKey(t)}`))
        return true;
      return false;
    };
  }

  /** Clave estable para deduplicar contacto+empresa en import (nombre de contacto usa fold aparte). */
  private foldContactImportKey(s: string): string {
    return s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private buildNewCompanyDedupeKey(dto: CreateCompanyDto): string {
    const d = (dto.ruc ?? '').replace(/\D/g, '');
    const name = this.foldContactImportKey(dto.name ?? '');
    return `__new__:${d || 'sin-ruc'}:${name || 'sin-nombre'}`;
  }

  /**
   * Ya existe contacto con el mismo nombre o mismo DNI (8 dígitos) y misma empresa primaria
   * (o sin empresa en BD).
   */
  private async contactAlreadyExistsForImport(
    contactName: string,
    companyDedupeKey: string | null,
  ): Promise<boolean> {
    if (companyDedupeKey?.startsWith('__new__')) return false;

    const trimmed = contactName.trim();
    if (!trimmed) return false;

    if (companyDedupeKey) {
      const hit = await this.prisma.contact.findFirst({
        where: {
          name: { equals: trimmed, mode: 'insensitive' },
          companies: { some: { isPrimary: true, companyId: companyDedupeKey } },
        },
        select: { id: true },
      });
      return !!hit;
    }
    const hit = await this.prisma.contact.findFirst({
      where: {
        name: { equals: trimmed, mode: 'insensitive' },
        companies: { none: {} },
      },
      select: { id: true },
    });
    return !!hit;
  }

  /**
   * Acepta `userId`, username (`Account.providerId`) o nombre visible del usuario.
   * Si la celda viene vacía, asigna al usuario que ejecuta el import.
   */
  private async assigneeFromCsvOrImporter(
    csvCell: string | undefined,
    importingUserId: string,
  ): Promise<string> {
    const t = csvCell?.trim();
    if (!t) return importingUserId;

    const byId = await this.prisma.user.findUnique({
      where: { id: t },
      select: { id: true },
    });
    if (byId) return byId.id;

    const byUsername = await this.prisma.account.findFirst({
      where: {
        provider: 'credentials',
        providerId: { equals: t.toLowerCase(), mode: 'insensitive' },
      },
      select: { userId: true },
    });
    if (byUsername?.userId) return byUsername.userId;

    const byName = await this.prisma.user.findFirst({
      where: {
        name: { equals: t, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (byName) return byName.id;

    throw new BadRequestException(
      `Asesor no encontrado: «${t}». Usa userId, username o nombre completo.`,
    );
  }

  /**
   * Resuelve vínculo de empresa para import de contactos (por `empresa_nombre` / `empresa_ruc`).
   * - RUC: si existe en BD, reutiliza la misma empresa; un nombre distinto en el CSV no renombra la empresa (mismo RUC).
   * - RUC del CSV no registrado pero nombre coincide con una empresa: vincula el contacto a esa empresa (no crea duplicado).
   * - Tras consultar SUNAT (solo import real): si el nombre definitivo ya existe, vincula en lugar de crear.
   * - Sin RUC: igual que antes (por nombre o nueva empresa).
   */
  private async resolveContactImportCompany(params: {
    empresaNombre: string;
    empresaRuc: string;
    empresaDomain?: string;
    contactFuente: string;
    contactEtapa: string;
    contactEstimatedValue: number;
    contactAssignedTo: string | undefined;
    contactClienteRecuperado?: 'si' | 'no';
    dryRun?: boolean;
  }): Promise<
    | {
        ok: true;
        companyId?: string;
        newCompany?: CreateCompanyDto;
        empresaResumen: string;
        dedupeCompanyKey: string | null;
      }
    | { ok: false; message: string }
  > {
    const nombre = params.empresaNombre.trim();
    const rucRaw = params.empresaRuc.trim();
    const domain = params.empresaDomain?.trim().toLowerCase() || '';
    const dryRun = params.dryRun === true;
    const cr = params.contactClienteRecuperado;

    if (!nombre && !rucRaw && !domain) {
      return {
        ok: true,
        empresaResumen: 'Sin empresa',
        dedupeCompanyKey: null,
      };
    }

    if (rucRaw) {
      const found = await this.findCompanyByRucInput(rucRaw);
      if (found) {
        let resumen = `Existente: ${found.name}`;
        if (
          nombre &&
          nombre.toLowerCase() !== found.name.toLowerCase()
        ) {
          resumen += dryRun
            ? ` · mismo RUC: no se renombra la empresa; el nombre «${nombre}» queda como referencia de la fila`
            : ` · mismo RUC: empresa sin renombrar (nombre CSV «${nombre}»)`;
        }
        return {
          ok: true,
          companyId: found.id,
          empresaResumen: resumen,
          dedupeCompanyKey: found.id,
        };
      }

      if (nombre) {
        const byNameRucMismatch = await this.findCompanyByNameInsensitive(
          nombre,
        );
        if (byNameRucMismatch) {
          return {
            ok: true,
            companyId: byNameRucMismatch.id,
            empresaResumen: `Existente por nombre: «${byNameRucMismatch.name}» (el RUC del CSV no está registrado; se vincula el contacto a esta empresa)`,
            dedupeCompanyKey: byNameRucMismatch.id,
          };
        }
      }

      if (domain) {
        const byDomain = await this.prisma.company.findFirst({
          where: { domain: { equals: domain, mode: 'insensitive' } },
          select: { id: true, name: true },
        });
        if (byDomain) {
          return {
            ok: true,
            companyId: byDomain.id,
            empresaResumen: `Existente por dominio: ${byDomain.name}`,
            dedupeCompanyKey: byDomain.id,
          };
        }
      }

      const digits = rucRaw.replace(/\D/g, '');
      const newName = nombre || `Empresa RUC ${digits || rucRaw}`;
      const dupPlaceholder = await this.findCompanyByNameInsensitive(newName);
      if (dupPlaceholder) {
        return {
          ok: true,
          companyId: dupPlaceholder.id,
          empresaResumen: `Existente por nombre: «${dupPlaceholder.name}» (se vincula el contacto)`,
          dedupeCompanyKey: dupPlaceholder.id,
        };
      }

      const draft: CreateCompanyDto = {
        name: formatImportedCompanyName(newName),
        ruc: digits || rucRaw,
        domain: domain || undefined,
        facturacionEstimada: params.contactEstimatedValue,
        fuente: params.contactFuente,
        etapa: params.contactEtapa,
        assignedTo: params.contactAssignedTo,
        ...(cr ? { clienteRecuperado: cr } : {}),
      };
      if (dryRun) {
        return {
          ok: true,
          newCompany: draft,
          empresaResumen: this.previewEmpresaLabel(
            params.empresaNombre,
            params.empresaRuc,
          ),
          dedupeCompanyKey: this.buildNewCompanyDedupeKey(draft),
        };
      }

      let newCompany = await this.enrichCompanyDtoFromRuc(draft);
      const finalName = newCompany.name?.trim();
      if (finalName) {
        const dupAfterEnrich =
          await this.findCompanyByNameInsensitive(finalName);
        if (dupAfterEnrich) {
          return {
            ok: true,
            companyId: dupAfterEnrich.id,
            empresaResumen: `Existente por nombre: «${dupAfterEnrich.name}» (coincide con el nombre obtenido del RUC; se vincula el contacto)`,
            dedupeCompanyKey: dupAfterEnrich.id,
          };
        }
      }
      const rucForDedup = newCompany.ruc?.trim();
      if (rucForDedup) {
        const dupRucAfter = await this.findCompanyByRucInput(rucForDedup);
        if (dupRucAfter) {
          return {
            ok: true,
            companyId: dupRucAfter.id,
            empresaResumen: `Existente: ${dupRucAfter.name}`,
            dedupeCompanyKey: dupRucAfter.id,
          };
        }
      }

      return {
        ok: true,
        newCompany,
        empresaResumen: `Nueva empresa · ${newCompany.name}`,
        dedupeCompanyKey: this.buildNewCompanyDedupeKey(newCompany),
      };
    }

    if (domain) {
      const byDomain = await this.prisma.company.findFirst({
        where: { domain: { equals: domain, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (byDomain) {
        return {
          ok: true,
          companyId: byDomain.id,
          empresaResumen: `Existente por dominio: ${byDomain.name}`,
          dedupeCompanyKey: byDomain.id,
        };
      }
    }

    const byName = await this.findCompanyByNameInsensitive(nombre);
    if (byName) {
      return {
        ok: true,
        companyId: byName.id,
        empresaResumen: `Existente por nombre: ${byName.name}`,
        dedupeCompanyKey: byName.id,
      };
    }
    const onlyNameCo: CreateCompanyDto = {
      name: formatImportedCompanyName(nombre || domain),
      domain: domain || undefined,
      facturacionEstimada: params.contactEstimatedValue,
      fuente: params.contactFuente,
      etapa: params.contactEtapa,
      assignedTo: params.contactAssignedTo,
      ...(cr ? { clienteRecuperado: cr } : {}),
    };
    return {
      ok: true,
      newCompany: onlyNameCo,
      empresaResumen: `Nueva empresa · ${onlyNameCo.name}`,
      dedupeCompanyKey: this.buildNewCompanyDedupeKey(onlyNameCo),
    };
  }

  /** Vista previa: no escribe en BD ni llama a Factiliza por fila nueva. */
  async previewContactsImport(csvText: string): Promise<ContactImportPreviewResultDto> {
    const rows = parseCsv(csvText);
    if (rows.length < 2) {
      throw new BadRequestException(
        'El archivo debe incluir encabezados y al menos una fila de datos',
      );
    }
    const headerIndex = buildHeaderIndex(rows[0]!);
    const dataRows = rows.length - 1;
    if (dataRows > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `Máximo ${MAX_IMPORT_ROWS} filas de datos por archivo`,
      );
    }
    const stages = await this.crmConfig.listEnabledStagesForImport();
    const out: ContactImportPreviewRowDto[] = [];
    const fileContactCompanyFirstRow = new Map<string, number>();
    let skipped = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      const excelRow = i + 1;
      if (row.every((c) => !(c ?? '').trim())) {
        skipped += 1;
        continue;
      }
      const csvColumns = this.buildCompanyImportPreviewCsvColumns(rows[0]!, row);
      const nombreRaw = this.rowGetImportText(row, headerIndex, ['nombre', 'name']);
      const telefonoRaw = this.readContactPhoneImportField(row, headerIndex);
      const correoRaw = this.rowGetImportText(row, headerIndex, ['correo', 'email']);
      const fuenteRaw = this.rowGetImportText(row, headerIndex, ['fuente', 'source']);
      const nombreCsv = nombreRaw.trim();
      const telefono = telefonoRaw.trim() || '-';
      const correo = correoRaw.trim();
      const fuente = fuenteRaw.trim() || 'base';
      const empresaNombre = this.rowGetImportText(row, headerIndex, [
        'empresa_nombre',
        'nombre_empresa',
        'company_name',
        'empresa',
      ]);
      const empresaRuc = this.rowGetImportText(row, headerIndex, [
        'empresa_ruc',
        'ruc_empresa',
        'company_ruc',
      ]);
      const empresaDomain = this.rowGetImportText(row, headerIndex, ['domain', 'dominio']);
      const empresaNombreT = empresaNombre.trim();
      const empresaNombrePreview = empresaNombreT
        ? formatImportedCompanyName(empresaNombreT)
        : '';
      const empresaRucT = empresaRuc.trim();
      const empresaPreview = this.previewEmpresaLabel(empresaNombre, empresaRuc);
      if (!nombreCsv) {
        out.push({
          row: excelRow,
          nombre: '',
          telefono,
          correo,
          fuente,
          etapa: 'lead',
          valorEstimado: 0,
          empresaNombre: empresaNombrePreview,
          empresaRuc: empresaRucT,
          empresaResumen: empresaPreview,
          ok: false,
          error: 'Falta nombre del contacto',
          csvColumns,
        });
        continue;
      }
      const nombre = formatImportedPersonName(nombreCsv);
      const valorRaw = rowGet(row, headerIndex, [
        'valor_estimado',
        'estimatedvalue',
        'valor',
        'monto_estimado',
      ]);
      const estimatedValueRaw = this.parseImportNumericCell(valorRaw);
      if (
        estimatedValueRaw == null ||
        !Number.isFinite(estimatedValueRaw) ||
        estimatedValueRaw <= 0
      ) {
        out.push({
          row: excelRow,
          nombre,
          telefono,
          correo,
          fuente,
          etapa: this.rowGetImportText(row, headerIndex, ['etapa', 'stage']) || 'lead',
          valorEstimado: 0,
          empresaNombre: empresaNombrePreview,
          empresaRuc: empresaRucT,
          empresaResumen: empresaPreview,
          ok: false,
          error: 'valor_estimado debe ser un número mayor que 0',
          csvColumns,
        });
        continue;
      }
      const estimatedValue = estimatedValueRaw;
      const legacyEmpresaId = this.rowGetImportText(row, headerIndex, [
        'empresa_id',
        'companyid',
        'company_id',
      ]);
      const etapaRaw =
        this.rowGetImportText(row, headerIndex, ['etapa', 'stage']) ||
        this.rowGetImportText(row, headerIndex, [
          'probabilidad',
          'probability',
          'porcentaje',
          'porcentaje_etapa',
        ]);
      const etapaResolved = this.crmConfig.resolveEtapaSlugFromCsvCell(
        stages,
        etapaRaw,
      );
      if (!etapaResolved.ok) {
        out.push({
          row: excelRow,
          nombre,
          telefono,
          correo,
          fuente,
          etapa: etapaRaw || 'lead',
          valorEstimado: estimatedValue,
          empresaNombre: empresaNombrePreview,
          empresaRuc: empresaRucT,
          empresaResumen: empresaPreview,
          ok: false,
          error: etapaResolved.message,
          csvColumns,
        });
        continue;
      }
      const etapaRow = etapaResolved.slug;
      const clienteRecNorm = normalizeClienteRecuperadoForCsv(
        rowGet(row, headerIndex, [
          'cliente_recuperado',
          'cliente recuperado',
          'recuperado',
        ]),
      );
      const assignedRow =
        this.rowGetImportText(row, headerIndex, ['asignado_a', 'assignedto', 'usuario_id']) ||
        undefined;

      let empresaResumen = empresaPreview;
      let dedupeCompanyKey: string | null = null;
      if (empresaNombreT || empresaRucT || empresaDomain.trim()) {
        const resolved = await this.resolveContactImportCompany({
          empresaNombre,
          empresaRuc,
          empresaDomain,
          contactFuente: fuente,
          contactEtapa: etapaRow,
          contactEstimatedValue: estimatedValue,
          contactAssignedTo: assignedRow,
          contactClienteRecuperado: clienteRecNorm,
          dryRun: true,
        });
        if (!resolved.ok) {
          out.push({
            row: excelRow,
            nombre,
            telefono,
            correo,
            fuente,
            etapa: etapaRow,
            valorEstimado: estimatedValue,
            empresaNombre: empresaNombrePreview,
            empresaRuc: empresaRucT,
            empresaResumen: empresaPreview,
            ok: false,
            error: resolved.message,
            csvColumns,
          });
          continue;
        }
        empresaResumen = resolved.empresaResumen;
        dedupeCompanyKey = resolved.dedupeCompanyKey;
      } else if (legacyEmpresaId.trim()) {
        const comp = await this.prisma.company.findUnique({
          where: { id: legacyEmpresaId.trim() },
          select: { id: true, name: true },
        });
        if (!comp) {
          out.push({
            row: excelRow,
            nombre,
            telefono,
            correo,
            fuente,
            etapa: etapaRow,
            valorEstimado: estimatedValue,
            empresaNombre: empresaNombrePreview,
            empresaRuc: empresaRucT,
            empresaResumen: empresaPreview,
            ok: false,
            error: 'empresa_id no existe en el sistema',
            csvColumns,
          });
          continue;
        }
        empresaResumen = comp.name;
        dedupeCompanyKey = comp.id;
      }

      const rowContactCompanyKey = `${this.contactImportRowDedupeKey(nombreCsv)}|${dedupeCompanyKey ?? '__none__'}`;
      const dupFileRow = fileContactCompanyFirstRow.get(rowContactCompanyKey);
      if (dupFileRow !== undefined) {
        out.push({
          row: excelRow,
          nombre,
          telefono,
          correo,
          fuente,
          etapa: etapaRow,
          valorEstimado: estimatedValue,
          empresaNombre: empresaNombrePreview,
          empresaRuc: empresaRucT,
          empresaResumen,
          ok: false,
          error: `Duplicado en el archivo respecto a la fila ${dupFileRow} (mismo nombre o DNI y misma empresa).`,
          csvColumns,
        });
        continue;
      }
      if (
        await this.contactAlreadyExistsForImport(
          nombreCsv,
          dedupeCompanyKey,
        )
      ) {
        out.push({
          row: excelRow,
          nombre,
          telefono,
          correo,
          fuente,
          etapa: etapaRow,
          valorEstimado: estimatedValue,
          empresaNombre: empresaNombrePreview,
          empresaRuc: empresaRucT,
          empresaResumen,
          ok: false,
          error:
            'Ya existe un contacto con el mismo nombre o DNI vinculado a esta empresa. Elimina la fila duplicada o corrige los datos.',
          csvColumns,
        });
        continue;
      }
      fileContactCompanyFirstRow.set(rowContactCompanyKey, excelRow);
      out.push({
        row: excelRow,
        nombre,
        telefono,
        correo,
        fuente,
        etapa: etapaRow,
        valorEstimado: estimatedValue,
        empresaNombre: empresaNombrePreview,
        empresaRuc: empresaRucT,
        empresaResumen,
        ok: true,
        csvColumns,
      });
    }
    const okCount = out.filter((r) => r.ok).length;
    const errorCount = out.filter((r) => !r.ok).length;
    return {
      totalRows: dataRows,
      skipped,
      rows: out,
      okCount,
      errorCount,
    };
  }

  async importContacts(
    csvText: string,
    importingUserId: string,
    scope?: CrmDataScope,
    onProgress?: ImportProgressCallback,
  ): Promise<BulkImportResultDto> {
    const rows = parseCsv(csvText);
    if (rows.length < 2) {
      throw new BadRequestException(
        'El archivo debe incluir encabezados y al menos una fila de datos',
      );
    }
    const headerIndex = buildHeaderIndex(rows[0]!);
    const errors: BulkImportRowError[] = [];
    let created = 0;
    let skipped = 0;
    let processedRows = 0;
    const dataRows = rows.length - 1;
    if (dataRows > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `Máximo ${MAX_IMPORT_ROWS} filas de datos por archivo`,
      );
    }

    const stages = await this.crmConfig.listEnabledStagesForImport();
    const fileContactCompanyFirstRow = new Map<string, number>();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      const excelRow = i + 1;
      try {
        if (row.every((c) => !(c ?? '').trim())) {
          skipped += 1;
          continue;
        }
        const nombreRaw = this.rowGetImportText(row, headerIndex, ['nombre', 'name']);
        const departamentoRow = this.rowGetImportText(row, headerIndex, ['departamento']);
        const provinciaRow = this.rowGetImportText(row, headerIndex, ['provincia']);
        const distritoRow = this.rowGetImportText(row, headerIndex, ['distrito']);
        const direccionRow = this.rowGetImportText(row, headerIndex, ['direccion']);
        const nombreCsv = nombreRaw.trim();
        if (!nombreCsv) {
          errors.push(
            importRowErr(
              excelRow,
              'Falta nombre del contacto',
              undefined,
            ),
          );
          continue;
        }
        const telefonoRaw = this.readContactPhoneImportField(row, headerIndex);
        const correoRaw = this.rowGetImportText(row, headerIndex, ['correo', 'email']);
        const fuenteRaw = this.rowGetImportText(row, headerIndex, ['fuente', 'source']);
        const telefono = telefonoRaw.trim() || '-';
        const correo = correoRaw.trim();
        const fuente = fuenteRaw.trim() || 'base';
        const valorRaw = rowGet(row, headerIndex, [
          'valor_estimado',
          'estimatedvalue',
          'valor',
          'monto_estimado',
        ]);
        const estimatedValueRaw = this.parseImportNumericCell(valorRaw);
        if (
          estimatedValueRaw == null ||
          !Number.isFinite(estimatedValueRaw) ||
          estimatedValueRaw <= 0
        ) {
          errors.push(
            importRowErr(
              excelRow,
              'valor_estimado debe ser un número mayor que 0',
              nombreCsv || correo || undefined,
            ),
          );
          continue;
        }
        const estimatedValue = estimatedValueRaw;
        const empresaNombre = this.rowGetImportText(row, headerIndex, [
          'empresa_nombre',
          'nombre_empresa',
          'company_name',
          'empresa',
        ]);
        const empresaRuc = this.rowGetImportText(row, headerIndex, [
          'empresa_ruc',
          'ruc_empresa',
          'company_ruc',
        ]);
        const empresaDomain = this.rowGetImportText(row, headerIndex, ['domain', 'dominio']);
        const legacyEmpresaId = this.rowGetImportText(row, headerIndex, [
          'empresa_id',
          'companyid',
          'company_id',
        ]);
        const etapaRaw =
          this.rowGetImportText(row, headerIndex, ['etapa', 'stage']) ||
          this.rowGetImportText(row, headerIndex, [
            'probabilidad',
            'probability',
            'porcentaje',
            'porcentaje_etapa',
          ]);
        const etapaResolved = this.crmConfig.resolveEtapaSlugFromCsvCell(
          stages,
          etapaRaw,
        );
        if (!etapaResolved.ok) {
          errors.push(
            importRowErr(excelRow, etapaResolved.message, nombreCsv || correo || undefined),
          );
          continue;
        }
        const etapaRow = etapaResolved.slug;
        const clienteRecNorm = normalizeClienteRecuperadoForCsv(
          rowGet(row, headerIndex, [
            'cliente_recuperado',
            'cliente recuperado',
            'recuperado',
          ]),
        );
        const assignedRow =
          this.rowGetImportText(row, headerIndex, [
            'asignado_a',
            'assignedto',
            'usuario_id',
          ]) || undefined;
        const assignedTo =
          scope && !scope.unrestricted
            ? importingUserId
            : await this.assigneeFromCsvOrImporter(assignedRow, importingUserId);

        const nombre = formatImportedPersonName(nombreCsv);

        let companyId: string | undefined;
        let newCompany: CreateCompanyDto | undefined;
        let dedupeCompanyKey: string | null = null;

        if (empresaNombre.trim() || empresaRuc.trim() || empresaDomain.trim()) {
          const resolved = await this.resolveContactImportCompany({
            empresaNombre,
            empresaRuc,
            empresaDomain,
            contactFuente: fuente,
            contactEtapa: etapaRow,
            contactEstimatedValue: estimatedValue,
            contactAssignedTo: assignedTo,
            contactClienteRecuperado: clienteRecNorm,
          });
          if (!resolved.ok) {
            errors.push(
              importRowErr(
                excelRow,
                resolved.message,
                [nombre, empresaNombre.trim()].filter(Boolean).join(' · ') || nombre,
              ),
            );
            continue;
          }
          companyId = resolved.companyId;
          newCompany = resolved.newCompany;
          dedupeCompanyKey = resolved.dedupeCompanyKey;
        } else if (legacyEmpresaId.trim()) {
          const comp = await this.prisma.company.findFirst({
            where: mergeCompanyScope({ id: legacyEmpresaId.trim() }, scope),
            select: { id: true },
          });
          if (!comp) {
            errors.push(
              importRowErr(
                excelRow,
                'empresa_id no existe en el sistema',
                nombre || nombreCsv || undefined,
              ),
            );
            continue;
          }
          companyId = comp.id;
          dedupeCompanyKey = comp.id;
        }

        const rowContactCompanyKey = `${this.contactImportRowDedupeKey(nombre)}|${dedupeCompanyKey ?? '__none__'}`;
        const dupFileRow = fileContactCompanyFirstRow.get(rowContactCompanyKey);
        if (dupFileRow !== undefined) {
          errors.push(
            importRowErr(
              excelRow,
              `Duplicado en el archivo respecto a la fila ${dupFileRow} (mismo nombre o DNI y misma empresa).`,
              nombre,
            ),
          );
          continue;
        }
        if (
          await this.contactAlreadyExistsForImport(
            nombreCsv,
            dedupeCompanyKey,
          )
        ) {
          errors.push(
            importRowErr(
              excelRow,
              'Ya existe un contacto con el mismo nombre o DNI vinculado a esta empresa. Elimina la fila duplicada o corrige los datos.',
              nombre,
            ),
          );
          continue;
        }
        fileContactCompanyFirstRow.set(rowContactCompanyKey, excelRow);

        if (newCompany) {
          const inferredDomain = inferCompanyDomainFromContactEmail(correo);
          if (inferredDomain && !newCompany.domain?.trim()) {
            newCompany = { ...newCompany, domain: inferredDomain };
          }
        }

        const dto: CreateContactDto = {
          name: nombre,
          telefono,
          correo,
          fuente,
          cargo: this.rowGetImportText(row, headerIndex, ['cargo']) || undefined,
          etapa: etapaRow,
          estimatedValue,
          assignedTo,
          departamento: departamentoRow?.trim() || undefined,
          provincia: provinciaRow?.trim() || undefined,
          distrito: distritoRow?.trim() || undefined,
          direccion: direccionRow?.trim() || undefined,
          ...(clienteRecNorm
            ? { clienteRecuperado: clienteRecNorm }
            : {}),
          companyId,
          newCompany,
        };
        try {
          await this.contactsService.create(dto, undefined, scope);
          created += 1;
        } catch (e: unknown) {
          const msg =
            e instanceof Error ? e.message : 'Error al crear el contacto';
          errors.push(importRowErr(excelRow, msg, nombre));
        }
      } finally {
        processedRows += 1;
        if (onProgress) {
          await onProgress({
            processedRows,
            created,
            skipped,
            errorCount: errors.length,
          });
        }
      }
    }

    return {
      totalRows: dataRows,
      created,
      skipped,
      errors,
    };
  }

  companiesTemplateCsv(): string {
    return UTF8_BOM + stringifyCsvRow([...COMPANY_TEMPLATE_HEADERS]);
  }

  /**
   * Export comercial (CSV): fecha de ingreso, empresa, origen, asesor y
   * columnas por semana ISO con cabecera en español (`Semana N`, o `Semana N (AAAA)`
   * si el rango cruza años ISO). Cada celda es porcentaje con sufijo `%` (p. ej. `40%`);
   * semanas anteriores al alta o sin dato se exportan como `0%`.
   * La reconstrucción de etapa usa auditoría de `etapa`; sin historial, etapa constante.
   * La plantilla de importación sigue usando {@link COMPANY_HEADERS}.
   */
  async companiesExportCsv(
    scope?: CrmDataScope,
    opts?: {
      search?: string;
      rubro?: string;
      tipo?: string;
      etapa?: string;
      fuente?: string;
      assignedTo?: string;
      excludeAssignedTo?: string;
      advisorPool?: string;
      lastInteractionFrom?: string;
      lastInteractionTo?: string;
    },
  ): Promise<string> {
    const where: Prisma.CompanyWhereInput = {};
    if (opts?.search?.trim()) {
      const q = opts.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { razonSocial: { contains: q, mode: 'insensitive' } },
        { ruc: { contains: q } },
        { domain: { contains: q, mode: 'insensitive' } },
        {
          contacts: {
            some: {
              contact: {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { correo: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
    }
    if (opts?.rubro?.trim()) where.rubro = opts.rubro.trim();
    if (opts?.tipo?.trim()) where.tipo = opts.tipo.trim();
    if (opts?.fuente?.trim()) {
      const fuenteQ = await this.crmConfig.normalizeLeadSource(opts.fuente).catch(() => opts.fuente!.trim());
      where.fuente = { equals: fuenteQ, mode: 'insensitive' };
    }
    if (opts?.etapa?.trim()) where.etapa = opts.etapa.trim();
    if (!(scope && !scope.unrestricted)) {
      const advisorClause = companyAdvisorWhere(
        parseAdvisorFilterQuery({
          assignedTo: opts?.assignedTo,
          excludeAssignedTo: opts?.excludeAssignedTo,
          advisorPool: opts?.advisorPool,
        }),
      );
      if (advisorClause) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
          advisorClause,
        ];
      }
    }
    const list = await this.prisma.company.findMany({
      where: mergeCompanyScope(where, scope),
      take: 10_000,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        fuente: true,
        etapa: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    });

    const now = new Date();
    const minCreatedTs =
      list.length === 0
        ? now.getTime()
        : Math.min(...list.map((c) => c.createdAt.getTime()));
    const weekCols = buildIsoWeekExportColumns(new Date(minCreatedTs), now);

    const baseHeaders = [
      'Fecha de Ingreso',
      'Empresa / Cliente',
      'Origen',
      'Asesor',
    ];
    const headers = [...baseHeaders, ...weekCols.map((w) => w.key)];

    const [stages, leadSources] = await Promise.all([
      this.prisma.crmStage.findMany({
        select: { slug: true, probability: true },
      }),
      this.prisma.crmLeadSource.findMany({
        select: { slug: true, name: true },
      }),
    ]);

    const probBySlug = new Map<string, number>();
    for (const s of stages) {
      probBySlug.set(
        s.slug.trim().toLowerCase(),
        Math.round(Number(s.probability) || 0),
      );
    }
    const sourceLabel = new Map<string, string>();
    for (const s of leadSources) {
      sourceLabel.set(s.slug.trim().toLowerCase(), s.name.trim());
    }

    const resolveProb = (slugRaw: string): number => {
      const slug = slugRaw.trim().toLowerCase();
      const p = probBySlug.get(slug);
      if (p !== undefined) return p;
      return STAGE_PROBABILITY_FALLBACK[slug] ?? 0;
    };

    const companyIds = list.map((c) => c.id);
    const auditRows =
      companyIds.length === 0
        ? []
        : await this.prisma.auditChangeSet.findMany({
            where: {
              module: 'empresas',
              entityType: 'Empresa',
              entityId: { in: companyIds },
              entries: { some: { fieldKey: 'etapa' } },
            },
            orderBy: { createdAt: 'asc' },
            select: {
              entityId: true,
              createdAt: true,
              entries: {
                where: { fieldKey: 'etapa' },
                take: 1,
                select: { oldValue: true, newValue: true },
              },
            },
          });

    const auditsByCompany = new Map<
      string,
      { at: Date; oldValue: string; newValue: string }[]
    >();
    for (const r of auditRows) {
      const ent = r.entries[0];
      if (!ent || !r.entityId) continue;
      const arr = auditsByCompany.get(r.entityId) ?? [];
      arr.push({
        at: r.createdAt,
        oldValue: ent.oldValue,
        newValue: ent.newValue,
      });
      auditsByCompany.set(r.entityId, arr);
    }
    for (const arr of auditsByCompany.values()) {
      arr.sort((a, b) => a.at.getTime() - b.at.getTime());
    }

    const fuenteLabel = (slug: string | null | undefined): string => {
      if (!slug?.trim()) return '';
      const key = slug.trim().toLowerCase();
      return sourceLabel.get(key) ?? slug.trim();
    };

    /** Fecha de ingreso en día/mes/año (misma referencia UTC que antes con ISO). */
    const ingresoStr = (d: Date) => {
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = String(d.getUTCFullYear());
      return `${dd}/${mm}/${yyyy}`;
    };

    const lines: string[] = [stringifyCsvRow(headers)];
    for (const c of list) {
      const audits = auditsByCompany.get(c.id) ?? [];
      const etapaAt = buildEtapaStepFunction(c.createdAt, c.etapa, audits);
      const row: string[] = [
        ingresoStr(c.createdAt),
        c.name,
        fuenteLabel(c.fuente),
        c.user?.name ?? '',
      ];
      const createdMs = c.createdAt.getTime();
      for (const col of weekCols) {
        if (col.weekEnd.getTime() < createdMs) {
          row.push('0%');
        } else {
          const p = resolveProb(etapaAt(col.weekEnd));
          row.push(`${p}%`);
        }
      }
      lines.push(stringifyCsvRow(row));
    }
    return UTF8_BOM + lines.join('\n');
  }

  /** Vista previa import empresas (sin Factiliza ni escritura en BD). */
  async previewCompaniesImport(
    csvText: string,
  ): Promise<CompanyImportPreviewResultDto> {
    const rows = parseCsv(csvText);
    if (rows.length < 2) {
      throw new BadRequestException(
        'El archivo debe incluir encabezados y al menos una fila de datos',
      );
    }
    const headerRow = rows[0]!;
    const headerIndex = buildHeaderIndex(headerRow);
    const dataRows = rows.length - 1;
    if (dataRows > MAX_COMPANY_IMPORT_ROWS) {
      throw new BadRequestException(
        `Máximo ${MAX_COMPANY_IMPORT_ROWS} filas de datos por archivo`,
      );
    }
    const stagesCompanies = await this.crmConfig.listEnabledStagesForImport();
    let skipped = 0;

    type PreviewSeg =
      | { kind: 'row'; row: CompanyImportPreviewRowDto }
      | {
          kind: 'work';
          excelRow: number;
          csvColumns: Record<string, string>;
          effectiveCompanyName: string;
          razonRowPreview: string;
          domain: string;
          rucRaw: string;
          rucDigits: string;
          facturacionEstimada: number;
          etapaSlug: string;
          puedeContacto: boolean;
          contactoNombreCsv: string;
          contactoCorreoPreview: string;
          contactoCargoPreview: string;
        };

    const segments: PreviewSeg[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      const excelRow = i + 1;
      if (row.every((c) => !(c ?? '').trim())) {
        skipped += 1;
        continue;
      }

      const csvColumns = this.buildCompanyImportPreviewCsvColumns(headerRow, row);

      const nombreEmpresa = this.rowGetImportText(row, headerIndex, ['nombre', 'name']);
      const razonRowPreview = this.rowGetImportText(
        row,
        headerIndex,
        ['razon_social', 'razonsocial'],
      ).trim();
      const factRaw = rowGet(row, headerIndex, [
        'facturacion_estimada',
        'facturacion',
        'facturación_estimada',
      ]);
      const facturacionParsed = this.parseImportNumericCell(factRaw);
      const facturacionEstimada =
        facturacionParsed != null &&
        Number.isFinite(facturacionParsed) &&
        facturacionParsed > 0
          ? facturacionParsed
          : 0;
      const rucRaw = this.rowGetImportText(row, headerIndex, ['ruc']).trim();
      const rucDigits = rucRaw.replace(/\D/g, '');
      const domain = this.rowGetImportText(row, headerIndex, ['domain', 'dominio']).trim().toLowerCase();
      const nombreEmpresaTrim = nombreEmpresa.trim();
      const effectiveCompanyName = this.companyImportEffectiveName(
        nombreEmpresaTrim,
        razonRowPreview,
      );

      const pushErr = (error: string) => {
        segments.push({
          kind: 'row',
          row: {
            row: excelRow,
            empresaNombre: effectiveCompanyName,
            empresaRuc: rucRaw,
            empresaResumen: '—',
            contactoVista: '—',
            etapa: this.rowGetImportText(row, headerIndex, ['etapa', 'stage']) || 'lead',
            facturacionEstimada,
            ok: false,
            error,
            csvColumns,
          },
        });
      };
      if (!domain) {
        pushErr('El dominio es obligatorio');
        continue;
      }

      const etapaRaw =
        this.rowGetImportText(row, headerIndex, ['etapa', 'stage']) ||
        this.rowGetImportText(row, headerIndex, [
          'probabilidad',
          'probability',
          'porcentaje',
          'porcentaje_etapa',
        ]);
      const etapaResolved = this.crmConfig.resolveEtapaSlugFromCsvCell(
        stagesCompanies,
        etapaRaw,
      );
      if (!etapaResolved.ok) {
        pushErr(etapaResolved.message);
        continue;
      }
      const etapaSlug = etapaResolved.slug;

      const contactoNombreCsv = this.rowGetImportText(row, headerIndex, [
        'contacto_nombre',
        'nombre_contacto',
      ]).trim();
      const contactoCorreoPreview = this.rowGetImportText(row, headerIndex, [
        'contacto_correo',
        'contacto_email',
      ]).trim();
      const contactoCargoPreview = this.rowGetImportText(row, headerIndex, [
        'contacto_cargo',
      ]).trim();
      const contactoNombreEfectivo = this.companyImportEffectiveContactName({
        contactoNombreCsv,
        contactoCorreo: contactoCorreoPreview,
        contactoCargo: contactoCargoPreview,
      });
      const puedeContactoDesdeCorreoSolo =
        this.looksLikeEmailForContactImport(contactoCorreoPreview) &&
        !contactoNombreCsv;
      const puedeNombreDoc =
        !!contactoNombreEfectivo || puedeContactoDesdeCorreoSolo;

      segments.push({
        kind: 'work',
        excelRow,
        csvColumns,
        effectiveCompanyName,
        razonRowPreview,
        domain,
        rucRaw,
        rucDigits,
        facturacionEstimada,
        etapaSlug,
        puedeContacto: puedeNombreDoc,
        contactoNombreCsv: contactoNombreEfectivo,
        contactoCorreoPreview,
        contactoCargoPreview,
      });
    }

    const workItems = segments.filter((s): s is Extract<PreviewSeg, { kind: 'work' }> => s.kind === 'work');
    const uniqDomains = [...new Set(workItems.map((w) => w.domain).filter((d) => d.length > 0))];
    const byDomain = uniqDomains.length > 0
      ? await this.companiesByDomainMap(uniqDomains)
      : new Map<string, { id: string; name: string }>();

    const out: CompanyImportPreviewRowDto[] = [];
    const fileCompanyContactDup = new Map<string, number>();
    const existSuffixes: Array<{
      at: number;
      companyId: string;
      nameForExistCheck: string;
    }> = [];

    for (const seg of segments) {
      if (seg.kind === 'row') {
        out.push(seg.row);
        continue;
      }
      const w = seg;
      const existingDomain = w.domain ? (byDomain.get(w.domain) ?? null) : null;

      let empresaResumen: string;
      let companyId: string | null = null;
      let companyKeyForDup: string;

      if (existingDomain) {
        companyId = existingDomain.id;
        empresaResumen = `Existente: ${existingDomain.name}`;
        companyKeyForDup = existingDomain.id;
      } else {
        const name = w.effectiveCompanyName || w.domain;
        companyKeyForDup = `__new__:${w.domain}`;
        empresaResumen = name || w.domain;
      }

      if (!w.puedeContacto) {
        out.push({
          row: w.excelRow,
          empresaNombre: w.effectiveCompanyName,
          empresaRuc: w.rucRaw,
          empresaResumen,
          contactoVista: '—',
          etapa: w.etapaSlug,
          facturacionEstimada: w.facturacionEstimada,
          ok: true,
          csvColumns: w.csvColumns,
        });
        continue;
      }

      const surf = this.previewCompanyImportContactSurface({
        contactoNombreCsv: w.contactoNombreCsv,
        contactoCorreo: w.contactoCorreoPreview,
      });
      if (surf.error) {
        out.push({
          row: w.excelRow,
          empresaNombre: w.effectiveCompanyName,
          empresaRuc: w.rucRaw,
          empresaResumen,
          contactoVista: surf.contactoVista || '—',
          etapa: w.etapaSlug,
          facturacionEstimada: w.facturacionEstimada,
          ok: false,
          error: surf.error,
          csvColumns: w.csvColumns,
        });
        continue;
      }

      const dupRowKey = `${companyKeyForDup}|${this.contactImportRowDedupeKey(
        surf.nameForExistCheck || w.contactoNombreCsv,
      )}`;
      const dupFile = fileCompanyContactDup.get(dupRowKey);
      if (dupFile !== undefined) {
        out.push({
          row: w.excelRow,
          empresaNombre: w.effectiveCompanyName,
          empresaRuc: w.rucRaw,
          empresaResumen,
          contactoVista: surf.contactoVista,
          etapa: w.etapaSlug,
          facturacionEstimada: w.facturacionEstimada,
          ok: false,
          error: `Duplicado en el archivo respecto a la fila ${dupFile} (misma empresa y mismo contacto).`,
          csvColumns: w.csvColumns,
        });
        continue;
      }
      fileCompanyContactDup.set(dupRowKey, w.excelRow);

      out.push({
        row: w.excelRow,
        empresaNombre: w.effectiveCompanyName,
        empresaRuc: w.rucRaw,
        empresaResumen,
        contactoVista: surf.contactoVista,
        etapa: w.etapaSlug,
        facturacionEstimada: w.facturacionEstimada,
        ok: true,
        csvColumns: w.csvColumns,
      });
      if (companyId) {
        existSuffixes.push({
          at: out.length - 1,
          companyId,
          nameForExistCheck: surf.nameForExistCheck,
        });
      }
    }

    if (existSuffixes.length > 0) {
      const lookup = await this.buildCompanyImportPreviewContactExistenceLookup(
        existSuffixes.map((s) => ({
          companyId: s.companyId,
          nameForExistCheck: s.nameForExistCheck,
        })),
      );
      for (const s of existSuffixes) {
        if (
          lookup(s.companyId, s.nameForExistCheck) &&
          out[s.at]
        ) {
          out[s.at]!.empresaResumen +=
            ' · contacto ya vinculado: se reforzará vínculo/oportunidad al importar';
        }
      }
    }

    const okCount = out.filter((r) => r.ok).length;
    const errorCount = out.filter((r) => !r.ok).length;
    return {
      totalRows: dataRows,
      skipped,
      rows: out,
      okCount,
      errorCount,
    };
  }

  private previewCompanyImportContactSurface(params: {
    contactoNombreCsv: string;
    contactoCorreo?: string;
    contactoCargo?: string;
  }): {
    contactoVista: string;
    nameForExistCheck: string;
    error?: string;
  } {
    const ncsv = params.contactoNombreCsv.trim();
    const correo = (params.contactoCorreo ?? '').trim();
    const cargo = (params.contactoCargo ?? '').trim();

    if (!ncsv) {
      if (this.looksLikeEmailForContactImport(correo)) {
        return {
          contactoVista: correo,
          nameForExistCheck: correo,
        };
      }
      if (cargo) {
        return {
          contactoVista: cargo,
          nameForExistCheck: cargo,
        };
      }
      return {
        contactoVista: '',
        nameForExistCheck: '',
        error: 'Contacto: falta nombre',
      };
    }
    const nameFmtFinal = formatImportedPersonName(ncsv);
    return {
      contactoVista: nameFmtFinal,
      nameForExistCheck: nameFmtFinal,
    };
  }

  async importCompanies(
    csvText: string,
    importingUserId: string,
    scope?: CrmDataScope,
    onProgress?: ImportProgressCallback,
  ): Promise<BulkImportResultDto> {
    const rows = parseCsv(csvText);
    if (rows.length < 2) {
      throw new BadRequestException(
        'El archivo debe incluir encabezados y al menos una fila de datos',
      );
    }
    const headerIndex = buildHeaderIndex(rows[0]!);
    const errors: BulkImportRowError[] = [];
    let created = 0;
    let skipped = 0;
    let processedRows = 0;
    const dataRows = rows.length - 1;
    if (dataRows > MAX_COMPANY_IMPORT_ROWS) {
      throw new BadRequestException(
        `Máximo ${MAX_COMPANY_IMPORT_ROWS} filas de datos por archivo`,
      );
    }

    const stagesCompanies = await this.crmConfig.listEnabledStagesForImport();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      const excelRow = i + 1;
      try {
      if (row.every((c) => !(c ?? '').trim())) {
        skipped += 1;
        continue;
      }

      const nombreEmpresa = this.rowGetImportText(row, headerIndex, ['nombre', 'name']);
      const razonRow = this.rowGetImportText(
        row,
        headerIndex,
        ['razon_social', 'razonsocial'],
      ).trim();
      const fuente = this.rowGetImportText(row, headerIndex, ['fuente', 'source']);
      const normalizedFuente = fuente.trim() || 'base';
      const rucRaw = this.rowGetImportText(row, headerIndex, ['ruc']).trim();
      const domain = this.rowGetImportText(row, headerIndex, ['domain', 'dominio']).trim().toLowerCase();
      const nombreEmpresaTrim = nombreEmpresa.trim();
      const effectiveCompanyName = this.companyImportEffectiveName(
        nombreEmpresaTrim,
        razonRow,
      );
      const factRaw = rowGet(row, headerIndex, [
        'facturacion_estimada',
        'facturacion',
        'facturación_estimada',
      ]);
      const facturacionParsed = this.parseImportNumericCell(factRaw);
      const facturacionEstimada =
        facturacionParsed != null &&
        Number.isFinite(facturacionParsed) &&
        facturacionParsed > 0
          ? facturacionParsed
          : 0;
      if (!domain) {
        errors.push(
          importRowErr(excelRow, 'El dominio es obligatorio', undefined),
        );
        continue;
      }

      const companyImportRowLabel =
        [effectiveCompanyName, razonRow, rucRaw].filter((s) => (s ?? '').trim()).join(' · ') ||
        undefined;

      const etapaRaw =
        this.rowGetImportText(row, headerIndex, ['etapa', 'stage']) ||
        this.rowGetImportText(row, headerIndex, [
          'probabilidad',
          'probability',
          'porcentaje',
          'porcentaje_etapa',
        ]);
      const etapaResolved = this.crmConfig.resolveEtapaSlugFromCsvCell(
        stagesCompanies,
        etapaRaw,
      );
      if (!etapaResolved.ok) {
        errors.push(
          importRowErr(excelRow, etapaResolved.message, companyImportRowLabel),
        );
        continue;
      }
      const etapaSlug = etapaResolved.slug;

      const clienteRecNorm = normalizeClienteRecuperadoForCsv(
        rowGet(row, headerIndex, [
          'cliente_recuperado',
          'cliente recuperado',
          'recuperado',
        ]),
      );

      const assignedRow =
        this.rowGetImportText(row, headerIndex, [
          'asignado_a',
          'assignedto',
          'usuario_id',
        ]) || undefined;
      const assignedTo =
        scope && !scope.unrestricted
          ? importingUserId
          : await this.assigneeFromCsvOrImporter(assignedRow, importingUserId);
      const companyTelefono =
        this.readCompanyPhoneImportField(row, headerIndex) || undefined;
      const companyImportUpdate = {
        telefono: companyTelefono,
        domain: this.rowGetImportText(row, headerIndex, ['domain', 'dominio']) || undefined,
        rubro: this.rowGetImportText(row, headerIndex, ['rubro']) || undefined,
        tipo: this.rowGetImportText(row, headerIndex, ['tipo']) || undefined,
        correo: this.rowGetImportText(row, headerIndex, ['correo', 'email']) || undefined,
        linkedin: this.rowGetImportText(row, headerIndex, ['linkedin']) || undefined,
        distrito: this.rowGetImportText(row, headerIndex, ['distrito']) || undefined,
        provincia: this.rowGetImportText(row, headerIndex, ['provincia']) || undefined,
        departamento:
          this.rowGetImportText(row, headerIndex, ['departamento']) || undefined,
        direccion: this.rowGetImportText(row, headerIndex, ['direccion']) || undefined,
        facturacionEstimada: facturacionParsed ?? undefined,
        setFacturacionEstimada:
          !!factRaw.trim() &&
          facturacionParsed != null &&
          Number.isFinite(facturacionParsed) &&
          facturacionParsed >= 0,
        fuente: normalizedFuente,
        ...(clienteRecNorm ? { clienteRecuperado: clienteRecNorm } : {}),
        etapa: etapaSlug,
        assignedTo,
      } satisfies Parameters<
        ImportExportService['updateExistingCompanyFromImport']
      >[1];

      let companyId: string;
      try {
        const existingDomain = domain
          ? await this.prisma.company.findFirst({
              where: { domain: { equals: domain, mode: 'insensitive' } },
              select: { id: true, name: true, domain: true },
            })
          : null;

        if (existingDomain) {
          companyId = existingDomain.id;
          await this.updateExistingCompanyFromImport(
            companyId,
            companyImportUpdate,
          );
        } else {
          const nameForCreate = effectiveCompanyName || domain;
          let dto: CreateCompanyDto = {
            name: formatImportedCompanyName(nameForCreate),
            razonSocial: razonRow
              ? formatImportedCompanyName(razonRow)
              : undefined,
            ruc: rucRaw || undefined,
            telefono: companyImportUpdate.telefono,
            domain,
            rubro: companyImportUpdate.rubro,
            tipo: companyImportUpdate.tipo,
            correo: companyImportUpdate.correo,
            linkedin: companyImportUpdate.linkedin,
            distrito: companyImportUpdate.distrito,
            provincia: companyImportUpdate.provincia,
            departamento: companyImportUpdate.departamento,
            direccion: companyImportUpdate.direccion,
            facturacionEstimada,
            fuente: companyImportUpdate.fuente,
            ...(clienteRecNorm
              ? { clienteRecuperado: clienteRecNorm }
              : {}),
            etapa: companyImportUpdate.etapa,
            assignedTo: companyImportUpdate.assignedTo,
          };
          const createdCo = await this.companiesService.create(
            dto,
            undefined,
            scope,
          );
          companyId = createdCo.id;
        }
      } catch (e: unknown) {
        errors.push(
          importRowErr(
            excelRow,
            e instanceof Error ? e.message : 'Error al crear o resolver empresa',
            companyImportRowLabel,
          ),
        );
        continue;
      }

      if (scope && !scope.unrestricted) {
        const inScope = await this.prisma.company.findFirst({
          where: mergeCompanyScope({ id: companyId }, scope),
          select: { id: true },
        });
        if (!inScope) {
          errors.push(
            importRowErr(
              excelRow,
              'La empresa no está disponible para tu usuario',
              companyImportRowLabel,
            ),
          );
          continue;
        }
      }

      try {
      const companyForOpportunity = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      });
      const existingOpportunityId = await this.prisma.companyOpportunity.findFirst({
        where: { companyId },
        orderBy: { opportunity: { createdAt: 'asc' } },
        select: { opportunityId: true },
      });
      const opportunityId = existingOpportunityId
        ? existingOpportunityId.opportunityId
        : await this.entitySync.ensureOpportunityForCompany(
            companyId,
            {
              title: effectiveCompanyName.trim()
                ? formatImportedCompanyName(effectiveCompanyName.trim())
                : companyForOpportunity?.name?.trim() || 'Oportunidad',
              amount: facturacionEstimada,
              etapa: etapaSlug,
              assignedTo,
              expectedCloseDate: null,
            },
          );

      const contactoNombreCsv = this.rowGetImportText(row, headerIndex, [
        'contacto_nombre',
        'nombre_contacto',
      ]).trim();
      const contactoCorreo = this.rowGetImportText(
        row,
        headerIndex,
        ['contacto_correo', 'contacto_email'],
      ).trim();
      const contactoCargoCsv = this.rowGetImportText(row, headerIndex, [
        'contacto_cargo',
      ]).trim();
      const contactoNombreEfectivo = this.companyImportEffectiveContactName({
        contactoNombreCsv,
        contactoCorreo,
        contactoCargo: contactoCargoCsv,
      });
      const puedeContactoDesdeCorreoSolo =
        this.looksLikeEmailForContactImport(contactoCorreo) &&
        !contactoNombreCsv;
      const puedeNombreDoc =
        !!contactoNombreEfectivo || puedeContactoDesdeCorreoSolo;

      if (!puedeNombreDoc) {
        created += 1;
        continue;
      }

      const contactoTel =
        this.readCompanyContactPhoneImportField(row, headerIndex) || '-';
      const contactFuente = normalizedFuente;

      const contactoDepartamento =
        this.rowGetImportText(row, headerIndex, ['contacto_departamento']) || undefined;
      const contactoProvincia =
        this.rowGetImportText(row, headerIndex, ['contacto_provincia']) || undefined;
      const contactoDistrito =
        this.rowGetImportText(row, headerIndex, ['contacto_distrito']) || undefined;
      const contactoDireccion =
        this.rowGetImportText(row, headerIndex, ['contacto_direccion']) || undefined;

      let contactName = contactoNombreEfectivo;
      if (puedeContactoDesdeCorreoSolo && !contactName.trim()) {
        contactName = contactoCorreo.trim();
      }

      if (!contactName.trim()) {
        errors.push(
          importRowErr(
            excelRow,
            'Contacto: falta nombre',
            companyForOpportunity?.name?.trim() || companyImportRowLabel,
          ),
        );
        continue;
      }

      const contactoClienteRec = normalizeClienteRecuperadoForCsv(
        this.rowGetImportText(row, headerIndex, ['contacto_cliente_recuperado']),
      );

      const existingContactId = await this.findContactIdForCompanyImport(
        contactName.trim(),
        companyId,
      );

      try {
        if (existingContactId) {
          await this.ensureCompanyContactLinkForImport(
            existingContactId,
            companyId,
          );
          await this.entitySync.ensureContactLinkedToOpportunity(
            existingContactId,
            opportunityId,
          );
          await this.entitySync.propagateFromContact(
            companyId,
            existingContactId,
          );
        } else {
          const createdContact = await this.contactsService.create(
            {
              name: contactName.trim(),
              telefono: contactoTel,
              correo: contactoCorreo,
              fuente: contactFuente,
              cargo: this.rowGetImportText(row, headerIndex, ['contacto_cargo']) || undefined,
              etapa: etapaSlug,
              estimatedValue: facturacionEstimada,
              assignedTo,
              departamento: contactoDepartamento,
              provincia: contactoProvincia,
              distrito: contactoDistrito,
              direccion: contactoDireccion,
              ...(contactoClienteRec
                ? { clienteRecuperado: contactoClienteRec }
                : {}),
              companyId,
            },
            undefined,
            scope,
          );
          await this.entitySync.ensureContactLinkedToOpportunity(
            createdContact.id,
            opportunityId,
          );
        }
        created += 1;
      } catch (e: unknown) {
        errors.push(
          importRowErr(
            excelRow,
            e instanceof Error ? e.message : 'Error al crear o vincular contacto',
            [
              contactName.trim(),
              companyForOpportunity?.name?.trim(),
            ]
              .filter(Boolean)
              .join(' · ') || companyImportRowLabel,
          ),
        );
      }
      } catch (e: unknown) {
        errors.push(
          importRowErr(
            excelRow,
            e instanceof Error
              ? e.message
              : 'Error al asegurar oportunidad o procesar la fila',
            companyImportRowLabel,
          ),
        );
      }
      } finally {
        processedRows += 1;
        if (onProgress) {
          await onProgress({
            processedRows,
            created,
            skipped,
            errorCount: errors.length,
          });
        }
      }
    }

    return { totalRows: dataRows, created, skipped, errors };
  }

  opportunitiesTemplateCsv(): string {
    return UTF8_BOM + stringifyCsvRow([...OPPORTUNITY_HEADERS]);
  }

  async opportunitiesExportCsv(
    scope?: CrmDataScope,
    opts?: {
      search?: string;
      etapa?: string;
      status?: string;
      assignedTo?: string;
      excludeAssignedTo?: string;
      advisorPool?: string;
    },
  ): Promise<string> {
    const where: Prisma.OpportunityWhereInput = {};
    if (opts?.search?.trim()) {
      const q = opts.search.trim();
      where.title = { contains: q, mode: 'insensitive' };
    }
    if (opts?.etapa?.trim()) where.etapa = opts.etapa.trim();
    if (opts?.status?.trim()) where.status = opts.status.trim();
    if (scope && !scope.unrestricted) {
      where.assignedTo = scope.viewerUserId;
    } else {
      applySimpleAdvisorFilter(
        where,
        parseAdvisorFilterQuery({
          assignedTo: opts?.assignedTo,
          excludeAssignedTo: opts?.excludeAssignedTo,
          advisorPool: opts?.advisorPool,
        }),
      );
    }
    const list = await this.prisma.opportunity.findMany({
      where,
      take: 10_000,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        fuente: true,
        etapa: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    });

    const now = new Date();
    const minCreatedTs =
      list.length === 0
        ? now.getTime()
        : Math.min(...list.map((o) => o.createdAt.getTime()));
    const weekCols = buildIsoWeekExportColumns(new Date(minCreatedTs), now);

    const baseHeaders = [
      'Fecha de Ingreso',
      'Oportunidad',
      'Origen',
      'Asesor',
    ];
    const headers = [...baseHeaders, ...weekCols.map((w) => w.key)];

    const [stages, leadSources] = await Promise.all([
      this.prisma.crmStage.findMany({
        select: { slug: true, probability: true },
      }),
      this.prisma.crmLeadSource.findMany({
        select: { slug: true, name: true },
      }),
    ]);

    const probBySlug = new Map<string, number>();
    for (const s of stages) {
      probBySlug.set(s.slug.trim().toLowerCase(), Math.round(Number(s.probability) || 0));
    }
    const sourceLabel = new Map<string, string>();
    for (const s of leadSources) {
      sourceLabel.set(s.slug.trim().toLowerCase(), s.name.trim());
    }

    const resolveProb = (slugRaw: string): number => {
      const slug = slugRaw.trim().toLowerCase();
      const p = probBySlug.get(slug);
      if (p !== undefined) return p;
      return STAGE_PROBABILITY_FALLBACK[slug] ?? 0;
    };

    const oppIds = list.map((o) => o.id);
    const auditRows =
      oppIds.length === 0
        ? []
        : await this.prisma.auditChangeSet.findMany({
            where: {
              module: 'oportunidades',
              entityType: 'Oportunidad',
              entityId: { in: oppIds },
              entries: { some: { fieldKey: 'etapa' } },
            },
            orderBy: { createdAt: 'asc' },
            select: {
              entityId: true,
              createdAt: true,
              entries: {
                where: { fieldKey: 'etapa' },
                take: 1,
                select: { oldValue: true, newValue: true },
              },
            },
          });

    const auditsByOpp = new Map<string, { at: Date; oldValue: string; newValue: string }[]>();
    for (const r of auditRows) {
      const ent = r.entries[0];
      if (!ent || !r.entityId) continue;
      const arr = auditsByOpp.get(r.entityId) ?? [];
      arr.push({ at: r.createdAt, oldValue: ent.oldValue, newValue: ent.newValue });
      auditsByOpp.set(r.entityId, arr);
    }
    for (const arr of auditsByOpp.values()) {
      arr.sort((a, b) => a.at.getTime() - b.at.getTime());
    }

    const fuenteLabel = (slug: string | null | undefined): string => {
      if (!slug?.trim()) return '';
      const key = slug.trim().toLowerCase();
      return sourceLabel.get(key) ?? slug.trim();
    };

    const ingresoStr = (d: Date) => {
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = String(d.getUTCFullYear());
      return `${dd}/${mm}/${yyyy}`;
    };

    const lines: string[] = [stringifyCsvRow(headers)];
    for (const o of list) {
      const audits = auditsByOpp.get(o.id) ?? [];
      const etapaAt = buildEtapaStepFunction(o.createdAt, o.etapa, audits);
      const row: string[] = [
        ingresoStr(o.createdAt),
        o.title,
        fuenteLabel(o.fuente),
        o.user?.name ?? '',
      ];
      const createdMs = o.createdAt.getTime();
      for (const col of weekCols) {
        if (col.weekEnd.getTime() < createdMs) {
          row.push('0%');
        } else {
          const p = resolveProb(etapaAt(col.weekEnd));
          row.push(`${p}%`);
        }
      }
      lines.push(stringifyCsvRow(row));
    }
    return UTF8_BOM + lines.join('\n');
  }

  async importOpportunities(
    csvText: string,
    importingUserId: string,
    scope?: CrmDataScope,
    onProgress?: ImportProgressCallback,
  ): Promise<BulkImportResultDto> {
    const rows = parseCsv(csvText);
    if (rows.length < 2) {
      throw new BadRequestException(
        'El archivo debe incluir encabezados y al menos una fila de datos',
      );
    }
    const headerIndex = buildHeaderIndex(rows[0]!);
    const errors: BulkImportRowError[] = [];
    let created = 0;
    let skipped = 0;
    let processedRows = 0;
    const dataRows = rows.length - 1;
    if (dataRows > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `Máximo ${MAX_IMPORT_ROWS} filas de datos por archivo`,
      );
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      const excelRow = i + 1;
      try {
      if (row.every((c) => !(c ?? '').trim())) {
        skipped += 1;
        continue;
      }
      const titulo = rowGet(row, headerIndex, ['titulo', 'title']);
      const montoRaw = rowGet(row, headerIndex, ['monto', 'amount']);
      const etapa = rowGet(row, headerIndex, ['etapa', 'stage']);
      if (!titulo || !etapa) {
        errors.push(
          importRowErr(
            excelRow,
            'Faltan titulo o etapa',
            titulo || undefined,
          ),
        );
        continue;
      }
      const amountRaw = this.parseImportNumericCell(montoRaw);
      if (
        amountRaw == null ||
        !Number.isFinite(amountRaw) ||
        amountRaw <= 0
      ) {
        errors.push(
          importRowErr(
            excelRow,
            'monto debe ser un número mayor que 0',
            titulo,
          ),
        );
        continue;
      }
      const amount = amountRaw;
      let contactId =
        rowGet(row, headerIndex, ['contacto_id', 'contactid']) || undefined;
      const companyId =
        rowGet(row, headerIndex, ['empresa_id', 'companyid']) || undefined;
      const contactCorreo = rowGet(row, headerIndex, [
        'contacto_correo',
        'correo_contacto',
      ]);
      const companyRuc = rowGet(row, headerIndex, ['empresa_ruc', 'ruc_empresa']);

      if (!contactId && contactCorreo) {
        const found = await this.prisma.contact.findFirst({
          where: {
            correo: { equals: contactCorreo.trim(), mode: 'insensitive' },
          },
          select: { id: true },
        });
        contactId = found?.id;
        if (!contactId) {
          errors.push(
            importRowErr(
              excelRow,
              `No se encontró contacto con correo ${contactCorreo}`,
              titulo,
            ),
          );
          continue;
        }
      }
      let resolvedCompanyId = companyId || undefined;
      if (!resolvedCompanyId && companyRuc) {
        const comp = await this.prisma.company.findFirst({
          where: { ruc: companyRuc.trim() },
          select: { id: true },
        });
        resolvedCompanyId = comp?.id;
        if (!resolvedCompanyId) {
          errors.push(
            importRowErr(
              excelRow,
              `No se encontró empresa con RUC ${companyRuc}`,
              titulo,
            ),
          );
          continue;
        }
      }
      const fecha = rowGet(row, headerIndex, [
        'fecha_cierre_esperado',
        'expected_close',
        'fecha_cierre',
      ]);
      const probRaw = rowGet(row, headerIndex, ['probabilidad', 'probability']);
      let probability: number | undefined;
      if (probRaw !== '') {
        const p = Number.parseInt(probRaw, 10);
        if (Number.isFinite(p)) probability = p;
      }
      const assignedCsv =
        rowGet(row, headerIndex, [
          'asignado_a',
          'assignedto',
          'usuario_id',
        ]) || undefined;
      const fuenteCsv =
        rowGet(row, headerIndex, ['fuente', 'source']) || undefined;
      const dto: CreateOpportunityDto = {
        title: titulo,
        amount,
        etapa,
        priority:
          rowGet(row, headerIndex, ['prioridad', 'priority']) || undefined,
        probability,
        expectedCloseDate: fecha || undefined,
        assignedTo: await this.assigneeFromCsvOrImporter(
          assignedCsv,
          importingUserId,
        ),
        contactId,
        companyId: resolvedCompanyId,
        fuente: fuenteCsv?.trim() ? fuenteCsv.trim() : undefined,
      };
      try {
        await this.opportunitiesService.create(dto, undefined, scope);
        created += 1;
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : 'Error al crear la oportunidad';
        errors.push(importRowErr(excelRow, msg, titulo));
      }
      } finally {
        processedRows += 1;
        if (onProgress) {
          await onProgress({
            processedRows,
            created,
            skipped,
            errorCount: errors.length,
          });
        }
      }
    }

    return { totalRows: dataRows, created, skipped, errors };
  }
}
