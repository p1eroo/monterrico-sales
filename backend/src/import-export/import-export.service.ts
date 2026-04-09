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

const MAX_IMPORT_ROWS = 1500;
const MAX_COMPANY_IMPORT_ROWS = 5000;
const UTF8_BOM = '\uFEFF';

export type BulkImportRowError = { row: number; message: string };

export type BulkImportResultDto = {
  totalRows: number;
  created: number;
  skipped: number;
  errors: BulkImportRowError[];
};

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
  'doc_tipo',
  'doc_numero',
  'departamento',
  'provincia',
  'distrito',
  'direccion',
  'cliente_recuperado',
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
  'contacto_doc_tipo',
  'contacto_doc_numero',
  'contacto_departamento',
  'contacto_provincia',
  'contacto_distrito',
  'contacto_direccion',
  'contacto_cliente_recuperado',
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

  /** `cliente_recuperado` en CSV: sí/no y alias → `si` | `no`; valor desconocido → omitir. */
  private normalizeClienteRecuperadoCsv(
    raw: string | undefined,
  ): 'si' | 'no' | undefined {
    if (raw == null || !String(raw).trim()) return undefined;
    const n = String(raw)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (['si', 's', 'yes', 'y', '1', 'true', 'verdadero'].includes(n)) {
      return 'si';
    }
    if (['no', 'n', '0', 'false', 'falso', 'falsa'].includes(n)) {
      return 'no';
    }
    return undefined;
  }

  /** 8 dígitos y tipo vacío o claramente DNI → consulta RENIEC vía Factiliza. */
  private looksLikeDniForFactiliza(docType: string, docDigits: string): boolean {
    if (docDigits.length !== 8) return false;
    const dt = docType
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (dt === '') return true;
    if (dt === 'dni' || dt === 'd.n.i.' || dt === 'd.n.i') return true;
    if (dt === '1' || dt === '01') return true;
    if (
      dt.includes('doc') &&
      dt.includes('nacional') &&
      dt.includes('identidad')
    ) {
      return true;
    }
    if (/^dni\b/.test(dt)) return true;
    return false;
  }

  /** Tipo de documento explícito CEE / carné de extranjería → API Factiliza CEE. */
  private looksLikeCeeForFactiliza(docType: string): boolean {
    const dt = docType
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (!dt) return false;
    if (dt.includes('cee')) return true;
    if (dt.includes('carnet') && dt.includes('extranj')) return true;
    if (dt.includes('extranjeria')) return true;
    if (dt === 'ce' || dt === '2' || dt === '02') return true;
    return false;
  }

  /** Correo mínimamente válido para usar como nombre de contacto (solo si no hay nombre ni doc). */
  private looksLikeEmailForContactImport(s: string): boolean {
    const t = s.trim();
    if (t.length < 5 || !t.includes('@')) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
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

  /**
   * Desempate de duplicados en import: si hay DNI de 8 dígitos, la clave es el documento;
   * si no, el nombre normalizado.
   */
  private contactImportRowDedupeKey(
    displayName: string,
    docDigitsRaw: string,
  ): string {
    const d = docDigitsRaw.replace(/\D/g, '');
    if (d.length === 8) return `dni:${d}`;
    return this.foldContactImportKey(displayName);
  }

  private pickCsvOrApiField(csv?: string, api?: string): string | undefined {
    const c = csv?.trim();
    if (c) return c;
    const a = api?.trim();
    return a || undefined;
  }

  private readCsvFields(
    row: string[],
    headerIndex: Map<string, number>,
    headers: string[],
  ): string[] {
    return headers
      .map((header) => rowGet(row, headerIndex, [header]).trim())
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

  /**
   * Consult Factiliza: DNI (RENIEC) o CEE. El nombre del CSV tiene prioridad sobre la API.
   * Ubicación (DNI): CSV si viene; si no, API.
   */
  private async enrichContactFromFactilizaByDocument(params: {
    nameFromCsv: string;
    telefono: string;
    correo: string;
    docType?: string;
    docNumber?: string;
    departamento?: string;
    provincia?: string;
    distrito?: string;
    direccion?: string;
  }): Promise<{
    name: string;
    telefono: string;
    correo: string;
    docType?: string;
    docNumber?: string;
    departamento?: string;
    provincia?: string;
    distrito?: string;
    direccion?: string;
  }> {
    const docDigits = (params.docNumber ?? '').replace(/\D/g, '').trim();
    const docTypeStr = params.docType ?? '';

    const docRawTrim = params.docNumber?.trim() ?? '';
    const base = {
      name: params.nameFromCsv.trim(),
      telefono: params.telefono,
      correo: params.correo,
      docType: params.docType?.trim() || undefined,
      docNumber: docDigits || docRawTrim || undefined,
      departamento: params.departamento?.trim() || undefined,
      provincia: params.provincia?.trim() || undefined,
      distrito: params.distrito?.trim() || undefined,
      direccion: params.direccion?.trim() || undefined,
    };

    if (this.looksLikeDniForFactiliza(docTypeStr, docDigits)) {
      const csvName = params.nameFromCsv.trim();
      if (csvName) {
        return {
          name: formatImportedPersonName(csvName),
          telefono: params.telefono,
          correo: params.correo,
          docType: params.docType?.trim() || 'DNI',
          docNumber: docDigits,
          departamento: params.departamento?.trim() || undefined,
          provincia: params.provincia?.trim() || undefined,
          distrito: params.distrito?.trim() || undefined,
          direccion: params.direccion?.trim() || undefined,
        };
      }
      try {
        const data = await this.factiliza.consultarDni(docDigits);
        const apiFullName = (
          data.nombre_completo ||
          [data.nombres, data.apellido_paterno, data.apellido_materno]
            .filter(Boolean)
            .join(' ')
        ).trim();
        const name = params.nameFromCsv.trim() || apiFullName;

        return {
          name: formatImportedPersonName(name),
          telefono: params.telefono,
          correo: params.correo,
          docType: params.docType?.trim() || 'DNI',
          docNumber: docDigits,
          departamento: this.pickCsvOrApiField(
            params.departamento,
            data.departamento,
          ),
          provincia: this.pickCsvOrApiField(params.provincia, data.provincia),
          distrito: this.pickCsvOrApiField(params.distrito, data.distrito),
          direccion: this.pickCsvOrApiField(
            params.direccion,
            data.direccion ?? data.direccion_completa,
          ),
        };
      } catch {
        return {
          ...base,
          name: formatImportedPersonName(base.name),
          docNumber: docDigits || base.docNumber,
        };
      }
    }

    if (this.looksLikeCeeForFactiliza(docTypeStr) && docRawTrim) {
      const csvNameCee = params.nameFromCsv.trim();
      if (csvNameCee) {
        return {
          name: formatImportedPersonName(csvNameCee),
          telefono: params.telefono,
          correo: params.correo,
          docType: params.docType?.trim() || 'CEE',
          docNumber: docRawTrim,
          departamento: params.departamento?.trim() || undefined,
          provincia: params.provincia?.trim() || undefined,
          distrito: params.distrito?.trim() || undefined,
          direccion: params.direccion?.trim() || undefined,
        };
      }
      try {
        const data = await this.factiliza.consultarCee(docRawTrim);
        const apiFullName = (
          data.nombre_completo ||
          [data.nombres, data.apellido_paterno, data.apellido_materno]
            .filter(Boolean)
            .join(' ')
        ).trim();
        const name = params.nameFromCsv.trim() || apiFullName;

        return {
          name: formatImportedPersonName(name),
          telefono: params.telefono,
          correo: params.correo,
          docType: params.docType?.trim() || 'CEE',
          docNumber: docRawTrim,
          departamento: base.departamento,
          provincia: base.provincia,
          distrito: base.distrito,
          direccion: base.direccion,
        };
      } catch {
        return {
          ...base,
          name: formatImportedPersonName(base.name),
          docNumber: docRawTrim,
        };
      }
    }

    return {
      ...base,
      name: formatImportedPersonName(base.name),
    };
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

  /** Contacto ya enlazado a la empresa (por DNI/CEE o nombre). */
  private async findContactIdForCompanyImport(
    nombreCsv: string,
    companyId: string,
    docNumberStored: string | undefined,
    docDigits: string,
  ): Promise<string | null> {
    if (docNumberStored?.trim()) {
      const dn = docNumberStored.trim();
      const byDoc = await this.prisma.contact.findFirst({
        where: {
          OR: [{ docNumber: dn }, { docNumber: docDigits || dn }],
          companies: { some: { companyId } },
        },
        select: { id: true },
      });
      if (byDoc) return byDoc.id;
    }
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
    return UTF8_BOM + stringifyCsvRow([...CONTACT_HEADERS]);
  }

  async contactsExportCsv(): Promise<string> {
    const rows = await this.prisma.contact.findMany({
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
        docType: true,
        docNumber: true,
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
    for (const c of rows) {
      const emp = c.companies[0]?.company;
      lines.push(
        stringifyCsvRow([
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
          c.docType ?? '',
          c.docNumber ?? '',
          c.departamento ?? '',
          c.provincia ?? '',
          c.distrito ?? '',
          c.direccion ?? '',
          c.clienteRecuperado ?? '',
          emp?.name ?? '',
          emp?.ruc ?? '',
        ]),
      );
    }
    return UTF8_BOM + lines.join('\n');
  }

  /**
   * Mapa RUC normalizado (solo dígitos) → empresa.
   * Una sola consulta index-friendly vía regexp_replace en PostgreSQL.
   */
  private async companiesByNormalizedRucDigitsMap(
    digitsList: string[],
  ): Promise<Map<string, { id: string; name: string; ruc: string | null }>> {
    const uniq = [...new Set(digitsList.filter((d) => d.length > 0))];
    const out = new Map<
      string,
      { id: string; name: string; ruc: string | null }
    >();
    if (uniq.length === 0) return out;
    const found = await this.prisma.$queryRaw<
      { id: string; name: string; ruc: string | null }[]
    >(Prisma.sql`
      SELECT id, name, ruc
      FROM "Company"
      WHERE "ruc" IS NOT NULL
        AND regexp_replace("ruc", '[^0-9]', '', 'g') IN (${Prisma.join(
          uniq.map((d) => Prisma.sql`${d}`),
        )})
    `);
    for (const row of found) {
      const k = (row.ruc ?? '').replace(/\D/g, '');
      if (k && !out.has(k)) out.set(k, row);
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
      out[label] = (dataRow[i] ?? '').trim();
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
      docProbe?: string;
    }>,
  ): Promise<
    (companyId: string, nameForExistCheck: string, docProbe?: string) => boolean
  > {
    const companyIds = [...new Set(checks.map((c) => c.companyId))];
    const doc8s = new Set<string>();
    const namesToQuery = new Set<string>();
    for (const c of checks) {
      const d = (c.docProbe ?? '').replace(/\D/g, '');
      if (d.length === 8) doc8s.add(d);
      const t = c.nameForExistCheck.trim();
      if (t) namesToQuery.add(t);
    }
    const docHits = new Set<string>();
    const nameHits = new Set<string>();
    if (companyIds.length > 0 && doc8s.size > 0) {
      const rows = await this.prisma.contact.findMany({
        where: {
          docNumber: { in: [...doc8s] },
          companies: {
            some: { isPrimary: true, companyId: { in: companyIds } },
          },
        },
        select: {
          docNumber: true,
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
        if (!cid || !r.docNumber) continue;
        const rd = r.docNumber.replace(/\D/g, '');
        if (rd.length === 8) docHits.add(`${cid}\t${rd}`);
      }
    }
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
    return (companyId: string, nameForExistCheck: string, docProbe?: string) => {
      const d = (docProbe ?? '').replace(/\D/g, '');
      if (d.length === 8 && docHits.has(`${companyId}\t${d}`)) return true;
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
    docDigitsRaw?: string,
  ): Promise<boolean> {
    if (companyDedupeKey?.startsWith('__new__')) {
      return false;
    }
    const d = (docDigitsRaw ?? '').replace(/\D/g, '').trim();
    if (d.length === 8) {
      if (companyDedupeKey) {
        const hitDoc = await this.prisma.contact.findFirst({
          where: {
            docNumber: { equals: d },
            companies: {
              some: { isPrimary: true, companyId: companyDedupeKey },
            },
          },
          select: { id: true },
        });
        if (hitDoc) return true;
      } else {
        const hitDoc = await this.prisma.contact.findFirst({
          where: {
            docNumber: { equals: d },
            companies: { none: {} },
          },
          select: { id: true },
        });
        if (hitDoc) return true;
      }
    }

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

  /** Si la celda de asesor va vacía, asigna al usuario que ejecuta el import. */
  private assigneeFromCsvOrImporter(
    csvCell: string | undefined,
    importingUserId: string,
  ): string {
    const t = csvCell?.trim();
    return t || importingUserId;
  }

  /**
   * Resuelve vínculo de empresa para import de contactos (por `empresa_nombre` / `empresa_ruc`).
   * - RUC: si existe en BD, reutiliza; si viene nombre distinto, actualiza solo `name` (salvo `dryRun`).
   * - RUC del CSV no registrado pero nombre coincide con una empresa: vincula el contacto a esa empresa (no crea duplicado).
   * - Tras consultar SUNAT (solo import real): si el nombre definitivo ya existe, vincula en lugar de crear.
   * - Sin RUC: igual que antes (por nombre o nueva empresa).
   */
  private async resolveContactImportCompany(params: {
    empresaNombre: string;
    empresaRuc: string;
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
    const dryRun = params.dryRun === true;
    const cr = params.contactClienteRecuperado;

    if (!nombre && !rucRaw) {
      return {
        ok: true,
        empresaResumen: 'Sin empresa',
        dedupeCompanyKey: null,
      };
    }

    if (rucRaw) {
      const found = await this.findCompanyByRucInput(rucRaw);
      if (found) {
        const willRename =
          !!nombre && nombre.toLowerCase() !== found.name.toLowerCase();
        if (willRename && !dryRun) {
          await this.prisma.company.update({
            where: { id: found.id },
            data: { name: formatImportedCompanyName(nombre) },
          });
        }
        let resumen = `Existente: ${found.name}`;
        if (willRename) {
          resumen += dryRun
            ? ` · se actualizará el nombre a «${nombre}»`
            : ' · nombre actualizado';
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
      name: formatImportedCompanyName(nombre),
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
        'El archivo CSV debe incluir encabezados y al menos una fila de datos',
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
      const nombreRaw = rowGet(row, headerIndex, ['nombre', 'name']);
      const docTypePv = rowGet(row, headerIndex, ['doc_tipo', 'tipodoc']);
      const docNumberPv = rowGet(row, headerIndex, [
        'doc_numero',
        'numerodoc',
      ]);
      const docDigitsPv = docNumberPv.replace(/\D/g, '');
      const telefonoRaw = this.readContactPhoneImportField(row, headerIndex);
      const correoRaw = rowGet(row, headerIndex, ['correo', 'email']);
      const fuenteRaw = rowGet(row, headerIndex, ['fuente', 'source']);
      const nombreCsv = nombreRaw.trim();
      const telefono = telefonoRaw.trim() || '-';
      const correo = correoRaw.trim();
      const fuente = fuenteRaw.trim() || 'base';
      const empresaNombre = rowGet(row, headerIndex, [
        'empresa_nombre',
        'nombre_empresa',
        'company_name',
        'empresa',
      ]);
      const empresaRuc = rowGet(row, headerIndex, [
        'empresa_ruc',
        'ruc_empresa',
        'company_ruc',
      ]);
      const empresaNombreT = empresaNombre.trim();
      const empresaNombrePreview = empresaNombreT
        ? formatImportedCompanyName(empresaNombreT)
        : '';
      const empresaRucT = empresaRuc.trim();
      const empresaPreview = this.previewEmpresaLabel(empresaNombre, empresaRuc);
      const puedeNombreReniec =
        !nombreCsv &&
        this.looksLikeDniForFactiliza(docTypePv, docDigitsPv);
      if (!nombreCsv && !puedeNombreReniec) {
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
          error:
            'Falta nombre (o doc_numero con DNI de 8 dígitos para completar el nombre vía RENIEC al importar)',
          csvColumns,
        });
        continue;
      }
      const nombreVistaPrevia = nombreCsv
        ? formatImportedPersonName(nombreCsv)
        : docDigitsPv
          ? `${docDigitsPv} (SUNAT)`
          : '';
      const nombre = nombreVistaPrevia;
      const valorRaw = rowGet(row, headerIndex, [
        'valor_estimado',
        'estimatedvalue',
        'valor',
        'monto_estimado',
      ]);
      const estimatedValue = Number.parseFloat(valorRaw.replace(',', '.'));
      if (!Number.isFinite(estimatedValue) || estimatedValue <= 0) {
        out.push({
          row: excelRow,
          nombre,
          telefono,
          correo,
          fuente,
          etapa: rowGet(row, headerIndex, ['etapa', 'stage']) || 'lead',
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
      const legacyEmpresaId = rowGet(row, headerIndex, [
        'empresa_id',
        'companyid',
        'company_id',
      ]);
      const etapaRaw =
        rowGet(row, headerIndex, ['etapa', 'stage']) ||
        rowGet(row, headerIndex, [
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
      const clienteRecNorm = this.normalizeClienteRecuperadoCsv(
        rowGet(row, headerIndex, [
          'cliente_recuperado',
          'cliente recuperado',
          'recuperado',
        ]),
      );
      const assignedRow =
        rowGet(row, headerIndex, ['asignado_a', 'assignedto', 'usuario_id']) ||
        undefined;

      let empresaResumen = empresaPreview;
      let dedupeCompanyKey: string | null = null;
      if (empresaNombreT || empresaRucT) {
        const resolved = await this.resolveContactImportCompany({
          empresaNombre,
          empresaRuc,
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

      const rowContactCompanyKey = `${this.contactImportRowDedupeKey(nombreCsv, docNumberPv)}|${dedupeCompanyKey ?? '__none__'}`;
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
          docDigitsPv,
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
  ): Promise<BulkImportResultDto> {
    const rows = parseCsv(csvText);
    if (rows.length < 2) {
      throw new BadRequestException(
        'El archivo CSV debe incluir encabezados y al menos una fila de datos',
      );
    }
    const headerIndex = buildHeaderIndex(rows[0]!);
    const errors: BulkImportRowError[] = [];
    let created = 0;
    let skipped = 0;
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
      if (row.every((c) => !(c ?? '').trim())) {
        skipped += 1;
        continue;
      }
      const nombreRaw = rowGet(row, headerIndex, ['nombre', 'name']);
      const docTypeRow = rowGet(row, headerIndex, ['doc_tipo', 'tipodoc']);
      const docNumberRow = rowGet(row, headerIndex, [
        'doc_numero',
        'numerodoc',
      ]);
      const departamentoRow = rowGet(row, headerIndex, ['departamento']);
      const provinciaRow = rowGet(row, headerIndex, ['provincia']);
      const distritoRow = rowGet(row, headerIndex, ['distrito']);
      const direccionRow = rowGet(row, headerIndex, ['direccion']);
      const nombreCsv = nombreRaw.trim();
      const docDigitsEarly = docNumberRow.replace(/\D/g, '');
      if (
        !nombreCsv &&
        !this.looksLikeDniForFactiliza(docTypeRow, docDigitsEarly)
      ) {
        errors.push({
          row: excelRow,
          message:
            'Falta nombre (o doc_numero con DNI de 8 dígitos para consultar RENIEC)',
        });
        continue;
      }
      const telefonoRaw = this.readContactPhoneImportField(row, headerIndex);
      const correoRaw = rowGet(row, headerIndex, ['correo', 'email']);
      const fuenteRaw = rowGet(row, headerIndex, ['fuente', 'source']);
      const telefono = telefonoRaw.trim() || '-';
      const correo = correoRaw.trim();
      const fuente = fuenteRaw.trim() || 'base';
      const valorRaw = rowGet(row, headerIndex, [
        'valor_estimado',
        'estimatedvalue',
        'valor',
        'monto_estimado',
      ]);
      const estimatedValue = Number.parseFloat(valorRaw.replace(',', '.'));
      if (!Number.isFinite(estimatedValue) || estimatedValue <= 0) {
        errors.push({
          row: excelRow,
          message: 'valor_estimado debe ser un número mayor que 0',
        });
        continue;
      }
      const empresaNombre = rowGet(row, headerIndex, [
        'empresa_nombre',
        'nombre_empresa',
        'company_name',
        'empresa',
      ]);
      const empresaRuc = rowGet(row, headerIndex, [
        'empresa_ruc',
        'ruc_empresa',
        'company_ruc',
      ]);
      const legacyEmpresaId = rowGet(row, headerIndex, [
        'empresa_id',
        'companyid',
        'company_id',
      ]);
      const etapaRaw =
        rowGet(row, headerIndex, ['etapa', 'stage']) ||
        rowGet(row, headerIndex, [
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
        errors.push({ row: excelRow, message: etapaResolved.message });
        continue;
      }
      const etapaRow = etapaResolved.slug;
      const clienteRecNorm = this.normalizeClienteRecuperadoCsv(
        rowGet(row, headerIndex, [
          'cliente_recuperado',
          'cliente recuperado',
          'recuperado',
        ]),
      );
      const assignedRow =
        rowGet(row, headerIndex, ['asignado_a', 'assignedto', 'usuario_id']) ||
        undefined;
      const assignedTo = this.assigneeFromCsvOrImporter(
        assignedRow,
        importingUserId,
      );

      const merged = await this.enrichContactFromFactilizaByDocument({
        nameFromCsv: nombreCsv,
        telefono,
        correo,
        docType: docTypeRow || undefined,
        docNumber: docNumberRow || undefined,
        departamento: departamentoRow || undefined,
        provincia: provinciaRow || undefined,
        distrito: distritoRow || undefined,
        direccion: direccionRow || undefined,
      });
      if (!merged.name.trim()) {
        errors.push({
          row: excelRow,
          message:
            'No se pudo obtener el nombre (indícalo en el CSV o verifica el DNI y Factiliza/RENIEC)',
        });
        continue;
      }
      const nombre = merged.name.trim();
      const docDigitsMerged = (merged.docNumber ?? '').replace(/\D/g, '');

      let companyId: string | undefined;
      let newCompany: CreateCompanyDto | undefined;
      let dedupeCompanyKey: string | null = null;

      if (empresaNombre.trim() || empresaRuc.trim()) {
        const resolved = await this.resolveContactImportCompany({
          empresaNombre,
          empresaRuc,
          contactFuente: fuente,
          contactEtapa: etapaRow,
          contactEstimatedValue: estimatedValue,
          contactAssignedTo: assignedTo,
          contactClienteRecuperado: clienteRecNorm,
        });
        if (!resolved.ok) {
          errors.push({ row: excelRow, message: resolved.message });
          continue;
        }
        companyId = resolved.companyId;
        newCompany = resolved.newCompany;
        dedupeCompanyKey = resolved.dedupeCompanyKey;
      } else if (legacyEmpresaId.trim()) {
        const comp = await this.prisma.company.findUnique({
          where: { id: legacyEmpresaId.trim() },
          select: { id: true },
        });
        if (!comp) {
          errors.push({
            row: excelRow,
            message: 'empresa_id no existe en el sistema',
          });
          continue;
        }
        companyId = comp.id;
        dedupeCompanyKey = comp.id;
      }

      const rowContactCompanyKey = `${this.contactImportRowDedupeKey(nombre, merged.docNumber ?? docNumberRow)}|${dedupeCompanyKey ?? '__none__'}`;
      const dupFileRow = fileContactCompanyFirstRow.get(rowContactCompanyKey);
      if (dupFileRow !== undefined) {
        errors.push({
          row: excelRow,
          message: `Duplicado en el archivo respecto a la fila ${dupFileRow} (mismo nombre o DNI y misma empresa).`,
        });
        continue;
      }
      if (
        await this.contactAlreadyExistsForImport(
          nombreCsv,
          dedupeCompanyKey,
          docDigitsMerged,
        )
      ) {
        errors.push({
          row: excelRow,
          message:
            'Ya existe un contacto con el mismo nombre o DNI vinculado a esta empresa. Elimina la fila duplicada o corrige los datos.',
        });
        continue;
      }
      fileContactCompanyFirstRow.set(rowContactCompanyKey, excelRow);

      if (newCompany) {
        const inferredDomain = inferCompanyDomainFromContactEmail(merged.correo);
        if (inferredDomain && !newCompany.domain?.trim()) {
          newCompany = { ...newCompany, domain: inferredDomain };
        }
      }

      const dto: CreateContactDto = {
        name: nombre,
        telefono: merged.telefono,
        correo: merged.correo,
        fuente,
        cargo: rowGet(row, headerIndex, ['cargo']) || undefined,
        etapa: etapaRow,
        estimatedValue,
        assignedTo,
        docType: merged.docType,
        docNumber: merged.docNumber,
        departamento: merged.departamento,
        provincia: merged.provincia,
        distrito: merged.distrito,
        direccion: merged.direccion,
        ...(clienteRecNorm
          ? { clienteRecuperado: clienteRecNorm }
          : {}),
        companyId,
        newCompany,
      };
      try {
        await this.contactsService.create(dto);
        created += 1;
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : 'Error al crear el contacto';
        errors.push({ row: excelRow, message: msg });
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
    return UTF8_BOM + stringifyCsvRow([...COMPANY_HEADERS]);
  }

  async companiesExportCsv(): Promise<string> {
    const list = await this.prisma.company.findMany({
      take: 10_000,
      orderBy: { updatedAt: 'desc' },
      select: {
        name: true,
        razonSocial: true,
        ruc: true,
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
        contacts: {
          where: { isPrimary: true },
          take: 1,
          select: {
            contact: {
              select: {
                name: true,
                telefono: true,
                correo: true,
                cargo: true,
                docType: true,
                docNumber: true,
                departamento: true,
                provincia: true,
                distrito: true,
                direccion: true,
                clienteRecuperado: true,
              },
            },
          },
        },
      },
    });
    const lines: string[] = [stringifyCsvRow([...COMPANY_HEADERS])];
    for (const c of list) {
      const p = c.contacts[0]?.contact;
      lines.push(
        stringifyCsvRow([
          c.name,
          c.razonSocial ?? '',
          c.ruc ?? '',
          c.telefono ?? '',
          '',
          '',
          '',
          '',
          c.domain ?? '',
          c.rubro ?? '',
          c.tipo ?? '',
          c.correo ?? '',
          c.linkedin ?? '',
          c.distrito ?? '',
          c.provincia ?? '',
          c.departamento ?? '',
          c.direccion ?? '',
          String(c.facturacionEstimada),
          c.fuente ?? '',
          c.clienteRecuperado ?? '',
          c.etapa,
          c.assignedTo ?? '',
          p?.name ?? '',
          p?.telefono ?? '',
          '',
          '',
          '',
          '',
          p?.correo ?? '',
          p?.cargo ?? '',
          p?.docType ?? '',
          p?.docNumber ?? '',
          p?.departamento ?? '',
          p?.provincia ?? '',
          p?.distrito ?? '',
          p?.direccion ?? '',
          p?.clienteRecuperado ?? '',
        ]),
      );
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
        'El archivo CSV debe incluir encabezados y al menos una fila de datos',
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
          rucRaw: string;
          rucDigits: string;
          facturacionEstimada: number;
          etapaSlug: string;
          puedeContacto: boolean;
          contactoNombreCsv: string;
          contactoDocTipo: string;
          contactoDocNum: string;
          contactoCorreoPreview: string;
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

      const nombreEmpresa = rowGet(row, headerIndex, ['nombre', 'name']);
      const razonRowPreview = rowGet(
        row,
        headerIndex,
        ['razon_social', 'razonsocial'],
      ).trim();
      const factRaw = rowGet(row, headerIndex, [
        'facturacion_estimada',
        'facturacion',
        'facturación_estimada',
      ]);
      const facturacionParsed = Number.parseFloat(factRaw.replace(',', '.'));
      const facturacionEstimada =
        Number.isFinite(facturacionParsed) && facturacionParsed > 0
          ? facturacionParsed
          : 0;
      const rucRaw = rowGet(row, headerIndex, ['ruc']).trim();
      const rucDigits = rucRaw.replace(/\D/g, '');
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
            etapa: rowGet(row, headerIndex, ['etapa', 'stage']) || 'lead',
            facturacionEstimada,
            ok: false,
            error,
            csvColumns,
          },
        });
      };
      if (!effectiveCompanyName && !rucRaw) {
        pushErr('Indica nombre, razón social o RUC');
        continue;
      }

      const etapaRaw =
        rowGet(row, headerIndex, ['etapa', 'stage']) ||
        rowGet(row, headerIndex, [
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

      const contactoNombreCsv = rowGet(row, headerIndex, [
        'contacto_nombre',
        'nombre_contacto',
      ]).trim();
      const contactoDocTipo = rowGet(row, headerIndex, ['contacto_doc_tipo']);
      const contactoDocNum = rowGet(row, headerIndex, [
        'contacto_doc_numero',
        'contacto_doc',
      ]);
      const contactoCorreoPreview = rowGet(row, headerIndex, [
        'contacto_correo',
        'contacto_email',
      ]).trim();
      const docDigitsEarly = contactoDocNum.replace(/\D/g, '');
      const hasDocForFactiliza =
        this.looksLikeDniForFactiliza(contactoDocTipo, docDigitsEarly) ||
        (this.looksLikeCeeForFactiliza(contactoDocTipo) &&
          !!contactoDocNum.trim());
      const puedeContactoDesdeCorreoSolo =
        this.looksLikeEmailForContactImport(contactoCorreoPreview) &&
        !contactoNombreCsv &&
        !hasDocForFactiliza;
      const puedeNombreDoc =
        !!contactoNombreCsv ||
        hasDocForFactiliza ||
        puedeContactoDesdeCorreoSolo;

      segments.push({
        kind: 'work',
        excelRow,
        csvColumns,
        effectiveCompanyName,
        razonRowPreview,
        rucRaw,
        rucDigits,
        facturacionEstimada,
        etapaSlug,
        puedeContacto: puedeNombreDoc,
        contactoNombreCsv,
        contactoDocTipo,
        contactoDocNum,
        contactoCorreoPreview,
      });
    }

    const workItems = segments.filter((s): s is Extract<PreviewSeg, { kind: 'work' }> => s.kind === 'work');
    const uniqRucDigits = [
      ...new Set(
        workItems.map((w) => w.rucDigits).filter((d) => d.length > 0),
      ),
    ];
    const uniqNames = [
      ...new Set(
        workItems
          .map((w) => w.effectiveCompanyName.trim())
          .filter((n) => n.length > 0),
      ),
    ];
    const [byRucDigits, byNameFold] = await Promise.all([
      this.companiesByNormalizedRucDigitsMap(uniqRucDigits),
      this.companiesByFoldedNameMap(uniqNames),
    ]);

    const out: CompanyImportPreviewRowDto[] = [];
    const fileCompanyContactDup = new Map<string, number>();
    const existSuffixes: Array<{
      at: number;
      companyId: string;
      nameForExistCheck: string;
      docProbe?: string;
    }> = [];

    for (const seg of segments) {
      if (seg.kind === 'row') {
        out.push(seg.row);
        continue;
      }
      const w = seg;
      const existingRuc =
        w.rucDigits.length > 0 ? (byRucDigits.get(w.rucDigits) ?? null) : null;
      const existingName =
        existingRuc || !w.effectiveCompanyName
          ? null
          : (byNameFold.get(this.foldContactImportKey(w.effectiveCompanyName)) ??
            null);

      let empresaResumen: string;
      let companyId: string | null = null;
      let companyKeyForDup: string;

      if (existingRuc) {
        companyId = existingRuc.id;
        empresaResumen = `Existente (RUC): ${existingRuc.name}`;
        companyKeyForDup = existingRuc.id;
      } else if (existingName) {
        companyId = existingName.id;
        empresaResumen = `Existente (nombre): ${existingName.name}`;
        companyKeyForDup = existingName.id;
      } else {
        const rd = w.rucDigits;
        const provisionalName =
          w.effectiveCompanyName || `Empresa RUC ${rd || w.rucRaw}`;
        companyKeyForDup = `__new__:${rd || 'sin-ruc'}:${this.foldContactImportKey(
          w.effectiveCompanyName || provisionalName,
        )}`;
        const omitirSunatPreview = this.companyImportHasUsableIdentityFields(
          w.effectiveCompanyName,
          w.razonRowPreview || undefined,
        );
        empresaResumen = w.rucRaw
          ? omitirSunatPreview
            ? (w.effectiveCompanyName &&
                !this.isCompanyImportPlaceholderName(w.effectiveCompanyName)
                ? w.effectiveCompanyName
                : w.razonRowPreview) || provisionalName
            : `${rd || w.rucRaw.trim()} (SUNAT)`
          : provisionalName;
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
        contactoDocTipo: w.contactoDocTipo,
        contactoDocNum: w.contactoDocNum,
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
        w.contactoDocNum,
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
          docProbe:
            surf.docDigits.length === 8 ? surf.docDigits : surf.docStored,
        });
      }
    }

    if (existSuffixes.length > 0) {
      const lookup = await this.buildCompanyImportPreviewContactExistenceLookup(
        existSuffixes.map((s) => ({
          companyId: s.companyId,
          nameForExistCheck: s.nameForExistCheck,
          docProbe: s.docProbe,
        })),
      );
      for (const s of existSuffixes) {
        if (
          lookup(s.companyId, s.nameForExistCheck, s.docProbe) &&
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
    contactoDocTipo: string;
    contactoDocNum: string;
    contactoCorreo?: string;
  }): {
    contactoVista: string;
    nameForExistCheck: string;
    docDigits: string;
    docStored?: string;
    error?: string;
  } {
    const docRaw = params.contactoDocNum.trim();
    const docDigits = docRaw.replace(/\D/g, '');
    const ncsv = params.contactoNombreCsv.trim();
    const correo = (params.contactoCorreo ?? '').trim();

    if (this.looksLikeDniForFactiliza(params.contactoDocTipo, docDigits)) {
      if (!ncsv) {
        return {
          contactoVista: `${docDigits} (SUNAT)`,
          nameForExistCheck: '',
          docDigits,
          docStored: docDigits,
        };
      }
      const nameFmt = formatImportedPersonName(ncsv);
      return {
        contactoVista: nameFmt,
        nameForExistCheck: nameFmt,
        docDigits,
        docStored: docDigits,
      };
    }
    if (this.looksLikeCeeForFactiliza(params.contactoDocTipo) && docRaw) {
      if (!ncsv) {
        const docShow =
          docRaw.replace(/\s+/g, '').trim() || docRaw.trim();
        return {
          contactoVista: `${docShow} (SUNAT)`,
          nameForExistCheck: '',
          docDigits: '',
          docStored: docRaw,
        };
      }
      const nameFmtCee = formatImportedPersonName(ncsv);
      return {
        contactoVista: nameFmtCee,
        nameForExistCheck: nameFmtCee,
        docDigits: '',
        docStored: docRaw,
      };
    }
    if (!ncsv) {
      if (this.looksLikeEmailForContactImport(correo)) {
        return {
          contactoVista: correo,
          nameForExistCheck: correo,
          docDigits: '',
        };
      }
      return {
        contactoVista: '',
        nameForExistCheck: '',
        docDigits: '',
        error:
          'Contacto: falta nombre o documento inválido (DNI/CEE) para completar datos',
      };
    }
    const nameFmtFinal = formatImportedPersonName(ncsv);
    return {
      contactoVista: nameFmtFinal,
      nameForExistCheck: nameFmtFinal,
      docDigits,
      docStored: docRaw || undefined,
    };
  }

  async importCompanies(
    csvText: string,
    importingUserId: string,
  ): Promise<BulkImportResultDto> {
    const rows = parseCsv(csvText);
    if (rows.length < 2) {
      throw new BadRequestException(
        'El archivo CSV debe incluir encabezados y al menos una fila de datos',
      );
    }
    const headerIndex = buildHeaderIndex(rows[0]!);
    const errors: BulkImportRowError[] = [];
    let created = 0;
    let skipped = 0;
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
      if (row.every((c) => !(c ?? '').trim())) {
        skipped += 1;
        continue;
      }

      const nombreEmpresa = rowGet(row, headerIndex, ['nombre', 'name']);
      const razonRow = rowGet(
        row,
        headerIndex,
        ['razon_social', 'razonsocial'],
      ).trim();
      const fuente = rowGet(row, headerIndex, ['fuente', 'source']);
      const normalizedFuente = fuente.trim() || 'base';
      const rucRaw = rowGet(row, headerIndex, ['ruc']).trim();
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
      const facturacionParsed = Number.parseFloat(factRaw.replace(',', '.'));
      const facturacionEstimada =
        Number.isFinite(facturacionParsed) && facturacionParsed > 0
          ? facturacionParsed
          : 0;
      if (!effectiveCompanyName && !rucRaw) {
        errors.push({
          row: excelRow,
          message: 'Indica nombre, razón social o RUC',
        });
        continue;
      }

      const etapaRaw =
        rowGet(row, headerIndex, ['etapa', 'stage']) ||
        rowGet(row, headerIndex, [
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
        errors.push({ row: excelRow, message: etapaResolved.message });
        continue;
      }
      const etapaSlug = etapaResolved.slug;

      const clienteRecNorm = this.normalizeClienteRecuperadoCsv(
        rowGet(row, headerIndex, [
          'cliente_recuperado',
          'cliente recuperado',
          'recuperado',
        ]),
      );

      const assignedRow =
        rowGet(row, headerIndex, [
          'asignado_a',
          'assignedto',
          'usuario_id',
        ]) || undefined;
      const assignedTo = this.assigneeFromCsvOrImporter(
        assignedRow,
        importingUserId,
      );

      let companyId: string;
      try {
        const existingRuc =
          rucRaw ? await this.findCompanyByRucInput(rucRaw) : null;
        const existingName =
          existingRuc || !effectiveCompanyName
            ? null
            : await this.findCompanyByNameInsensitive(effectiveCompanyName);

        if (existingRuc) {
          companyId = existingRuc.id;
        } else if (existingName) {
          companyId = existingName.id;
        } else {
          const rucDigits = rucRaw.replace(/\D/g, '');
          const nameForCreate =
            effectiveCompanyName || `Empresa RUC ${rucDigits || rucRaw}`;
          const companyTelefono =
            this.readCompanyPhoneImportField(row, headerIndex) || undefined;
          let dto: CreateCompanyDto = {
            name: formatImportedCompanyName(nameForCreate),
            razonSocial: razonRow
              ? formatImportedCompanyName(razonRow)
              : undefined,
            ruc: rucRaw || undefined,
            telefono: companyTelefono,
            domain: rowGet(row, headerIndex, ['domain', 'dominio']) || undefined,
            rubro: rowGet(row, headerIndex, ['rubro']) || undefined,
            tipo: rowGet(row, headerIndex, ['tipo']) || undefined,
            correo: rowGet(row, headerIndex, ['correo', 'email']) || undefined,
            linkedin: rowGet(row, headerIndex, ['linkedin']) || undefined,
            distrito: rowGet(row, headerIndex, ['distrito']) || undefined,
            provincia: rowGet(row, headerIndex, ['provincia']) || undefined,
            departamento:
              rowGet(row, headerIndex, ['departamento']) || undefined,
            direccion: rowGet(row, headerIndex, ['direccion']) || undefined,
            facturacionEstimada,
            fuente: normalizedFuente,
            ...(clienteRecNorm
              ? { clienteRecuperado: clienteRecNorm }
              : {}),
            etapa: etapaSlug,
            assignedTo,
          };
          dto = await this.enrichCompanyDtoFromRuc(dto);
          const createdCo = await this.companiesService.create(dto);
          companyId = createdCo.id;
        }
      } catch (e: unknown) {
        errors.push({
          row: excelRow,
          message:
            e instanceof Error ? e.message : 'Error al crear o resolver empresa',
        });
        continue;
      }

      const contactoNombreCsv = rowGet(row, headerIndex, [
        'contacto_nombre',
        'nombre_contacto',
      ]).trim();
      const contactoDocTipo = rowGet(row, headerIndex, ['contacto_doc_tipo']);
      const contactoDocNum = rowGet(row, headerIndex, [
        'contacto_doc_numero',
        'contacto_doc',
      ]);
      const contactoCorreo = rowGet(
        row,
        headerIndex,
        ['contacto_correo', 'contacto_email'],
      ).trim();
      const docDigitsEarly = contactoDocNum.replace(/\D/g, '');
      const hasDocForFactiliza =
        this.looksLikeDniForFactiliza(contactoDocTipo, docDigitsEarly) ||
        (this.looksLikeCeeForFactiliza(contactoDocTipo) &&
          !!contactoDocNum.trim());
      const puedeContactoDesdeCorreoSolo =
        this.looksLikeEmailForContactImport(contactoCorreo) &&
        !contactoNombreCsv &&
        !hasDocForFactiliza;
      const puedeNombreDoc =
        !!contactoNombreCsv ||
        hasDocForFactiliza ||
        puedeContactoDesdeCorreoSolo;

      if (!puedeNombreDoc) {
        created += 1;
        continue;
      }

      const contactoTel =
        this.readCompanyContactPhoneImportField(row, headerIndex) || '-';
      const contactFuente = normalizedFuente;

      const merged = await this.enrichContactFromFactilizaByDocument({
        nameFromCsv: contactoNombreCsv,
        telefono: contactoTel,
        correo: contactoCorreo,
        docType: contactoDocTipo || undefined,
        docNumber: contactoDocNum || undefined,
        departamento:
          rowGet(row, headerIndex, ['contacto_departamento']) || undefined,
        provincia:
          rowGet(row, headerIndex, ['contacto_provincia']) || undefined,
        distrito:
          rowGet(row, headerIndex, ['contacto_distrito']) || undefined,
        direccion:
          rowGet(row, headerIndex, ['contacto_direccion']) || undefined,
      });

      let mergedContact = merged;
      if (puedeContactoDesdeCorreoSolo && !mergedContact.name.trim()) {
        mergedContact = {
          ...mergedContact,
          name: contactoCorreo.trim(),
        };
      }

      if (!mergedContact.name.trim()) {
        errors.push({
          row: excelRow,
          message:
            'Contacto: falta nombre o documento inválido (DNI/CEE) para completar datos',
        });
        continue;
      }

      const contactoClienteRec = this.normalizeClienteRecuperadoCsv(
        rowGet(row, headerIndex, ['contacto_cliente_recuperado']),
      );

      const docDigitsMerged = (mergedContact.docNumber ?? '').replace(/\D/g, '');

      const existingContactId = await this.findContactIdForCompanyImport(
        mergedContact.name.trim(),
        companyId,
        mergedContact.docNumber,
        docDigitsMerged,
      );

      try {
        if (existingContactId) {
          await this.ensureCompanyContactLinkForImport(
            existingContactId,
            companyId,
          );
          const co = await this.prisma.company.findUnique({
            where: { id: companyId },
            select: { name: true },
          });
          const expectedClose = new Date();
          expectedClose.setDate(expectedClose.getDate() + 30);
          await this.entitySync.ensureOpportunityForContactCompany(
            existingContactId,
            companyId,
            {
              title: co?.name?.trim() || 'Oportunidad',
              amount: facturacionEstimada,
              etapa: etapaSlug,
              assignedTo,
              expectedCloseDate: expectedClose,
            },
          );
          await this.entitySync.propagateFromContact(
            companyId,
            existingContactId,
          );
        } else {
          await this.contactsService.create({
            name: mergedContact.name.trim(),
            telefono: mergedContact.telefono,
            correo: mergedContact.correo,
            fuente: contactFuente,
            cargo: rowGet(row, headerIndex, ['contacto_cargo']) || undefined,
            etapa: etapaSlug,
            estimatedValue: facturacionEstimada,
            assignedTo,
            docType: mergedContact.docType,
            docNumber: mergedContact.docNumber,
            departamento: mergedContact.departamento,
            provincia: mergedContact.provincia,
            distrito: mergedContact.distrito,
            direccion: mergedContact.direccion,
            ...(contactoClienteRec
              ? { clienteRecuperado: contactoClienteRec }
              : {}),
            companyId,
          });
        }
        created += 1;
      } catch (e: unknown) {
        errors.push({
          row: excelRow,
          message:
            e instanceof Error
              ? e.message
              : 'Error al crear o vincular contacto',
        });
      }
    }

    return { totalRows: dataRows, created, skipped, errors };
  }

  opportunitiesTemplateCsv(): string {
    return UTF8_BOM + stringifyCsvRow([...OPPORTUNITY_HEADERS]);
  }

  async opportunitiesExportCsv(): Promise<string> {
    const list = await this.prisma.opportunity.findMany({
      take: 10_000,
      orderBy: { updatedAt: 'desc' },
      include: {
        contacts: {
          take: 1,
          select: { contact: { select: { id: true, correo: true } } },
        },
        companies: {
          take: 1,
          select: { company: { select: { id: true, ruc: true } } },
        },
      },
    });
    const lines: string[] = [stringifyCsvRow([...OPPORTUNITY_HEADERS])];
    for (const o of list) {
      const c = o.contacts[0]?.contact;
      const co = o.companies[0]?.company;
      lines.push(
        stringifyCsvRow([
          o.id,
          o.title,
          String(o.amount),
          o.etapa,
          o.status,
          o.priority,
          String(o.probability),
          o.expectedCloseDate
            ? o.expectedCloseDate.toISOString().slice(0, 10)
            : '',
          o.assignedTo ?? '',
          c?.id ?? '',
          co?.id ?? '',
          c?.correo ?? '',
          co?.ruc ?? '',
        ]),
      );
    }
    return UTF8_BOM + lines.join('\n');
  }

  async importOpportunities(
    csvText: string,
    importingUserId: string,
  ): Promise<BulkImportResultDto> {
    const rows = parseCsv(csvText);
    if (rows.length < 2) {
      throw new BadRequestException(
        'El archivo CSV debe incluir encabezados y al menos una fila de datos',
      );
    }
    const headerIndex = buildHeaderIndex(rows[0]!);
    const errors: BulkImportRowError[] = [];
    let created = 0;
    let skipped = 0;
    const dataRows = rows.length - 1;
    if (dataRows > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `Máximo ${MAX_IMPORT_ROWS} filas de datos por archivo`,
      );
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      const excelRow = i + 1;
      if (row.every((c) => !(c ?? '').trim())) {
        skipped += 1;
        continue;
      }
      const titulo = rowGet(row, headerIndex, ['titulo', 'title']);
      const montoRaw = rowGet(row, headerIndex, ['monto', 'amount']);
      const etapa = rowGet(row, headerIndex, ['etapa', 'stage']);
      if (!titulo || !etapa) {
        errors.push({
          row: excelRow,
          message: 'Faltan titulo o etapa',
        });
        continue;
      }
      const amount = Number.parseFloat(montoRaw.replace(',', '.'));
      if (!Number.isFinite(amount) || amount <= 0) {
        errors.push({
          row: excelRow,
          message: 'monto debe ser un número mayor que 0',
        });
        continue;
      }
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
          errors.push({
            row: excelRow,
            message: `No se encontró contacto con correo ${contactCorreo}`,
          });
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
          errors.push({
            row: excelRow,
            message: `No se encontró empresa con RUC ${companyRuc}`,
          });
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
      const dto: CreateOpportunityDto = {
        title: titulo,
        amount,
        etapa,
        priority:
          rowGet(row, headerIndex, ['prioridad', 'priority']) || undefined,
        probability,
        expectedCloseDate: fecha || undefined,
        assignedTo: this.assigneeFromCsvOrImporter(assignedCsv, importingUserId),
        contactId,
        companyId: resolvedCompanyId,
      };
      try {
        await this.opportunitiesService.create(dto);
        created += 1;
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : 'Error al crear la oportunidad';
        errors.push({ row: excelRow, message: msg });
      }
    }

    return { totalRows: dataRows, created, skipped, errors };
  }
}
