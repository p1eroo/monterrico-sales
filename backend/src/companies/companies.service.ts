import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { EntitySyncService } from '../sync/entity-sync.service';
import { slugifyForUrl } from '../common/url-slug.util';
import { CrmConfigService } from '../crm-config/crm-config.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import type { ActivityActor } from '../activity-logs/activity-logs.types';
import { AuditDetailService } from '../audit-detail/audit-detail.service';
import { buildChangeEntries } from '../common/audit-diff.util';
import { COMPANY_FIELD_LABELS } from '../audit-detail/audit-field-labels';
import type { CrmDataScope } from '../auth/crm-data-scope.service';
import { mergeCompanyScope } from '../common/crm-data-scope-where.util';
import {
  companyAdvisorWhere,
  parseAdvisorFilterQuery,
} from '../common/advisor-filter.util';
import { resolveLimaDayRange } from '../common/crm-timezone.util';
import {
  isUnassignedSourceSlug,
} from '../crm-config/lead-source-normalize.util';
import { formatImportedCompanyName } from '../common/import-display-name.util';
import { FactilizaService } from '../factiliza/factiliza.service';
import { normalizeClienteRecuperado } from '../common/normalize-cliente-recuperado';

/** Select slim para listado: excluye linkedin, correo, direcciones */
const companySelectListSlim = {
  id: true,
  urlSlug: true,
  name: true,
  razonSocial: true,
  ruc: true,
  telefono: true,
  domain: true,
  rubro: true,
  tipo: true,
  facturacionEstimada: true,
  fuente: true,
  clienteRecuperado: true,
  etapa: true,
  assignedTo: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Listado con contactos para agregados (preview acotado en el mapper). */
const companySelectSummary = {
  ...companySelectListSlim,
  user: { select: { id: true, name: true } },
  contacts: {
    select: {
      contact: {
        select: {
          id: true,
          urlSlug: true,
          name: true,
          correo: true,
          etapa: true,
          fuente: true,
          assignedTo: true,
          estimatedValue: true,
          clienteRecuperado: true,
          user: { select: { id: true, name: true } },
          activities: {
            select: { activity: { select: { createdAt: true } } },
          },
        },
      },
    },
  },
  activities: {
    select: { activity: { select: { createdAt: true } } },
  },
  opportunities: {
    select: {
      opportunity: {
        select: {
          id: true,
          activities: {
            select: { activity: { select: { createdAt: true } } },
          },
        },
      },
    },
  },
} as const;

type CompanySummaryDbRow = Prisma.CompanyGetPayload<{
  select: typeof companySelectSummary;
}>;

const CONTACTS_PREVIEW_MAX = 80;

/** Orden de pestañas de etapa en listado empresas (alineado con `Empresas.tsx`). */
const COMPANY_SUMMARY_TAB_ETAPAS = [
  'lead',
  'contacto',
  'reunion_agendada',
  'reunion_efectiva',
  'propuesta_economica',
  'negociacion',
  'licitacion',
  'licitacion_etapa_final',
  'cierre_ganado',
  'firma_contrato',
  'activo',
  'cierre_perdido',
  'inactivo',
] as const;

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitySync: EntitySyncService,
    private readonly crmConfig: CrmConfigService,
    private readonly activityLogs: ActivityLogsService,
    private readonly auditDetail: AuditDetailService,
    private readonly factiliza: FactilizaService,
  ) {}

  private async assertUserExists(id: string): Promise<void> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) {
      throw new BadRequestException('El usuario asignado no existe');
    }
  }

  private async allocateCompanyUrlSlug(
    nameSource: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugifyForUrl(nameSource);
    let candidate = base;
    let n = 0;
    for (;;) {
      const found = await this.prisma.company.findFirst({
        where: {
          urlSlug: candidate,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
      });
      if (!found) return candidate;
      n += 1;
      candidate = `${base}-${n}`;
    }
  }

  /** RUC normalizado a 11 dígitos o null si no aplica. */
  private normalizeCompanyRucDigits(ruc?: string | null): string | null {
    const d = (ruc ?? '').replace(/\D/g, '').trim();
    return d.length === 11 ? d : null;
  }

  /** Primera empresa con ese RUC (formato guardado o solo dígitos), la más antigua por id. */
  private async findFirstCompanyByRucDigits(
    digits: string,
  ): Promise<{ id: string; name: string; ownerName: string | null } | null> {
    const grouped = await this.prisma.$queryRaw<{ id: string; name: string; ownerName: string | null }[]>(
      Prisma.sql`
        SELECT c.id, c.name, u.name as "ownerName"
        FROM "Company" c
        LEFT JOIN "User" u ON c."assignedTo" = u.id
        WHERE c."ruc" IS NOT NULL
          AND regexp_replace(c."ruc", '[^0-9]', '', 'g') = ${digits}
        ORDER BY c.id ASC
        LIMIT 1
      `,
    );
    return grouped[0] ?? null;
  }

  /**
   * Unifica alta: mismo RUC → actualizar empresa existente (SUNAT + datos del DTO), sin crear duplicado.
   */
  private async mergeCompanyOnDuplicateRuc(
    companyId: string,
    dto: CreateCompanyDto,
  ): Promise<void> {
    const digits =
      this.normalizeCompanyRucDigits(dto.ruc) ??
      (await this.prisma.company
        .findUnique({
          where: { id: companyId },
          select: { ruc: true },
        })
        .then((r) => this.normalizeCompanyRucDigits(r?.ruc ?? null)));

    const data: Prisma.CompanyUncheckedUpdateInput = {};
    let filledRsFromSunat = false;

    if (digits) {
      try {
        const sunat = await this.factiliza.consultarRuc(digits);
        const rs = sunat.nombre_o_razon_social?.trim();
        if (rs) {
          const fmt = formatImportedCompanyName(rs);
          data.name = fmt;
          data.razonSocial = fmt;
          filledRsFromSunat = true;
        }
        if (sunat.departamento?.trim()) {
          data.departamento = sunat.departamento.trim();
        }
        if (sunat.provincia?.trim()) {
          data.provincia = sunat.provincia.trim();
        }
        if (sunat.distrito?.trim()) {
          data.distrito = sunat.distrito.trim();
        }
        const dir =
          sunat.direccion?.trim() ||
          sunat.direccion_completa?.trim() ||
          undefined;
        if (dir) data.direccion = dir;
      } catch {
        /* SUNAT opcional */
      }
    }

    if (!filledRsFromSunat && dto.razonSocial?.trim()) {
      data.razonSocial = formatImportedCompanyName(dto.razonSocial.trim());
    }
    if (dto.telefono?.trim()) data.telefono = dto.telefono.trim();
    if (dto.domain?.trim()) data.domain = dto.domain.trim();
    if (dto.rubro?.trim()) data.rubro = dto.rubro.trim();
    if (dto.tipo?.trim()) data.tipo = dto.tipo.trim();
    if (dto.linkedin?.trim()) data.linkedin = dto.linkedin.trim();
    if (dto.correo?.trim()) data.correo = dto.correo.trim();
    if (dto.distrito?.trim()) data.distrito = dto.distrito.trim();
    if (dto.provincia?.trim()) data.provincia = dto.provincia.trim();
    if (dto.departamento?.trim()) data.departamento = dto.departamento.trim();
    if (dto.direccion?.trim()) data.direccion = dto.direccion.trim();
    const crMerge = normalizeClienteRecuperado(dto.clienteRecuperado);
    if (crMerge) {
      data.clienteRecuperado = crMerge;
    }

    if (
      dto.facturacionEstimada !== undefined &&
      dto.facturacionEstimada !== null &&
      Number.isFinite(dto.facturacionEstimada) &&
      dto.facturacionEstimada > 0
    ) {
      data.facturacionEstimada = dto.facturacionEstimada;
    }
    if (dto.fuente?.trim()) {
      data.fuente = await this.crmConfig.normalizeLeadSource(dto.fuente);
    }
    if (dto.etapa?.trim()) {
      await this.crmConfig.assertEtapaAssignable(dto.etapa.trim());
      data.etapa = dto.etapa.trim();
    }
    if (dto.assignedTo !== undefined) {
      const a = dto.assignedTo?.trim() || null;
      if (a) await this.assertUserExists(a);
      data.assignedTo = a;
    }

    const rucStore = dto.ruc?.trim() || undefined;
    if (rucStore) {
      const normalizedDigits = rucStore.replace(/\D/g, '');
      data.ruc =
        normalizedDigits.length === 11 ? normalizedDigits : rucStore;
    }

    if (typeof data.name === 'string' && data.name.length > 0) {
      const before = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      });
      if (
        before &&
        before.name.trim().toLowerCase() !== data.name.trim().toLowerCase()
      ) {
        data.urlSlug = await this.allocateCompanyUrlSlug(data.name, companyId);
      }
    }

    if (Object.keys(data).length === 0) return;

    await this.prisma.company.update({
      where: { id: companyId },
      data,
    });
  }

  /**
   * Importación: aplica consulta SUNAT (Factiliza) y campos del DTO sobre una empresa ya existente con el mismo RUC.
   */
  async mergeExistingByRucPayload(
    companyId: string,
    dto: CreateCompanyDto,
  ): Promise<void> {
    await this.mergeCompanyOnDuplicateRuc(companyId, dto);
  }

  private async resolveCompanyId(param: string): Promise<string> {
    const raw = param.trim();
    if (!raw) {
      throw new NotFoundException('Empresa no encontrada');
    }
    const byId = await this.prisma.company.findUnique({
      where: { id: raw },
      select: { id: true },
    });
    if (byId) return byId.id;
    let slug = raw;
    try {
      slug = decodeURIComponent(raw);
    } catch {
      /* usar raw */
    }
    const bySlug = await this.prisma.company.findUnique({
      where: { urlSlug: slug },
      select: { id: true },
    });
    if (bySlug) return bySlug.id;
    throw new NotFoundException('Empresa no encontrada');
  }

  async create(
    dto: CreateCompanyDto,
    actor?: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const domain = dto.domain?.trim();
    if (!domain) {
      throw new BadRequestException('El dominio de la empresa es obligatorio');
    }
    const domainLower = domain.toLowerCase();

    const existingDomain = await this.prisma.company.findFirst({
      where: { domain: { equals: domainLower, mode: 'insensitive' } },
      select: { id: true, name: true, user: { select: { name: true } } },
    });
    if (existingDomain) {
      throw new BadRequestException(
        `Ya existe una empresa con el mismo dominio: ${existingDomain.name}. Por: ${existingDomain.user?.name ?? 'Sistema (Sin asignar)'}`,
      );
    }

    const name = dto.name?.trim() || domain;

    const facturacionEstimada =
      dto.facturacionEstimada !== undefined &&
      dto.facturacionEstimada !== null &&
      Number.isFinite(dto.facturacionEstimada) &&
      dto.facturacionEstimada > 0
        ? dto.facturacionEstimada
        : 0;

    const fuente = await this.crmConfig.normalizeLeadSource(
      dto.fuente?.trim() || 'base',
    );

    const etapa = dto.etapa?.trim() || 'lead';
    let assignedTo = dto.assignedTo?.trim() || null;
    if (scope && !scope.unrestricted) {
      assignedTo = scope.viewerUserId;
    } else if (assignedTo) {
      await this.assertUserExists(assignedTo);
    }
    await this.crmConfig.assertEtapaAssignable(etapa);

    const rucStore = dto.ruc?.trim() || null;
    const rucForDb =
      rucStore && rucStore.replace(/\D/g, '').length === 11
        ? rucStore.replace(/\D/g, '')
        : rucStore;

    const urlSlug = await this.allocateCompanyUrlSlug(name);
    const company = await this.prisma.company.create({
      data: {
        urlSlug,
        name,
        razonSocial: dto.razonSocial?.trim() || null,
        ruc: rucForDb,
        telefono: dto.telefono?.trim() || null,
        domain: domainLower,
        rubro: dto.rubro?.trim() || null,
        tipo: dto.tipo?.trim() || null,
        linkedin: dto.linkedin?.trim() || null,
        correo: dto.correo?.trim() || null,
        distrito: dto.distrito?.trim() || null,
        provincia: dto.provincia?.trim() || null,
        departamento: dto.departamento?.trim() || null,
        direccion: dto.direccion?.trim() || null,
        facturacionEstimada,
        fuente,
        clienteRecuperado: normalizeClienteRecuperado(dto.clienteRecuperado),
        etapa,
        assignedTo,
      },
    });

    await this.entitySync.propagateFromCompany(company.id);
    // Workaround: @prisma/adapter-pg no envía facturacionEstimada en el INSERT real
    if (facturacionEstimada > 0) {
      await this.prisma.$executeRaw`UPDATE "Company" SET "facturacionEstimada" = ${facturacionEstimada} WHERE id = ${company.id}`;
    }

    await this.activityLogs.record(actor ?? null, {
      action: 'crear',
      module: 'empresas',
      entityType: 'Empresa',
      entityId: company.id,
      entityName: company.name,
      description: `Empresa creada: ${company.name}`,
    });

    return this.findOne(company.id, scope);
  }

  async batchCheckNames(
    items: { name: string; domain?: string }[],
    scope?: CrmDataScope,
  ) {
    const domains = items.map((i) => i.domain).filter(Boolean) as string[];
    const names = items.map((i) => i.name);

    const matched: { name: string; companyId: string; matchedBy: string }[] = [];

    // 1. Buscar por dominio (case-insensitive)
    if (domains.length > 0) {
      const byDomain = await this.prisma.company.findMany({
        where: {
          OR: domains.map((d) => ({ domain: { equals: d, mode: 'insensitive' } })),
          ...(scope?.viewerUserId ? { assignedTo: scope.viewerUserId } : {}),
        },
        select: { id: true, name: true, domain: true },
      });
      for (const item of items) {
        if (!item.domain) continue;
        const found = byDomain.find((c) => (c.domain ?? '').toLowerCase() === item.domain!.toLowerCase());
        if (found) {
          matched.push({ name: item.name, companyId: found.id, matchedBy: 'domain' });
        }
      }
    }

    // 2. Para los que no se matchearon por dominio, buscar por nombre
    const alreadyMatched = new Set(matched.map((m) => m.name));
    const unmatched = names.filter((n) => !alreadyMatched.has(n));
    if (unmatched.length > 0) {
      const byName = await this.prisma.company.findMany({
        where: {
          name: { in: unmatched },
          ...(scope?.viewerUserId ? { assignedTo: scope.viewerUserId } : {}),
        },
        select: { id: true, name: true },
      });
      const byNameIds = new Set(byName.map((c) => c.name));
      for (const item of items) {
        if (alreadyMatched.has(item.name)) continue;
        if (byNameIds.has(item.name)) {
          const found = byName.find((c) => c.name === item.name)!;
          matched.push({ name: item.name, companyId: found.id, matchedBy: 'name' });
        }
      }
    }

    return { results: matched };
  }

  async findAll(
    opts?: {
      page?: number;
      limit?: number;
      search?: string;
      rubro?: string;
      tipo?: string;
      /** Excluir empresas que ya tienen vínculo `CompanyContact` con este contacto */
      excludeContactLinkId?: string;
      /** Excluir empresas que ya tienen vínculo `CompanyOpportunity` con esta oportunidad */
      excludeOpportunityLinkId?: string;
    },
    scope?: CrmDataScope,
  ) {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(5000, Math.max(1, opts?.limit ?? 25));
    const skip = (page - 1) * limit;

    const base: Prisma.CompanyWhereInput = {};
    if (opts?.search?.trim()) {
      const q = opts.search.trim();
      base.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { razonSocial: { contains: q, mode: 'insensitive' } },
        { ruc: { contains: q } },
        { domain: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (opts?.rubro?.trim()) base.rubro = opts.rubro.trim();
    if (opts?.tipo?.trim()) base.tipo = opts.tipo.trim();
    const excludeCt = opts?.excludeContactLinkId?.trim();
    if (excludeCt) {
      base.contacts = { none: { contactId: excludeCt } };
    }
    const excludeOpp = opts?.excludeOpportunityLinkId?.trim();
    if (excludeOpp) {
      base.opportunities = { none: { opportunityId: excludeOpp } };
    }

    const where = mergeCompanyScope(base, scope);

    const [rows, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: companySelectListSlim,
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        ...r,
        clienteRecuperado: normalizeClienteRecuperado(r.clienteRecuperado),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Filtros del listado summary sin la condición de etapa (búsqueda, rubro, tipo, fuente, asesor).
   */
  private async buildCompanySummaryAndParts(
    opts?: {
      search?: string;
      rubro?: string;
      tipo?: string;
      fuente?: string;
      assignedTo?: string;
      /** IDs a excluir (legacy; sin asignar / otros roles siguen visibles). */
      excludeAssignedTo?: string;
      /** CSV de asesores activos (para token __others__). */
      advisorPool?: string;
      /**
       * Filtro por última interacción (actividad) en empresa/contactos/oportunidades.
       * Valores soportados:
       * - "none": sin interacciones
       * - "7d" | "30d" | "90d" | "180d": interacciones dentro de los últimos N días
       */
      lastInteraction?: string;
      /** ISO date (YYYY-MM-DD o ISO completo). Si existe junto a `lastInteractionTo`, filtra por rango. */
      lastInteractionFrom?: string;
      /** ISO date (YYYY-MM-DD o ISO completo). Si existe junto a `lastInteractionFrom`, filtra por rango. */
      lastInteractionTo?: string;
      /** ISO date: rango de fecha de creación de la empresa. */
      createdFrom?: string;
      createdTo?: string;
    },
    scope?: CrmDataScope,
  ): Promise<Prisma.CompanyWhereInput[]> {
    const andParts: Prisma.CompanyWhereInput[] = [];

    if (opts?.search?.trim()) {
      const q = opts.search.trim();
      andParts.push({
        OR: [
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
        ],
      });
    }
    if (opts?.rubro?.trim()) {
      const rubroWhere = this.buildCompanyScalarCsvWhere('rubro', opts.rubro);
      if (rubroWhere) andParts.push(rubroWhere);
    }
    if (opts?.tipo?.trim()) {
      const tipoWhere = this.buildCompanyScalarCsvWhere('tipo', opts.tipo);
      if (tipoWhere) andParts.push(tipoWhere);
    }
    const fuenteQ = opts?.fuente?.trim();
    if (fuenteQ) {
      const fuenteWhere = await this.buildCompanyFuenteWhere(fuenteQ);
      if (fuenteWhere) andParts.push(fuenteWhere);
    }
    if (!(scope && !scope.unrestricted)) {
      const advisorClause = companyAdvisorWhere(
        parseAdvisorFilterQuery({
          assignedTo: opts?.assignedTo,
          excludeAssignedTo: opts?.excludeAssignedTo,
          advisorPool: opts?.advisorPool,
        }),
      );
      if (advisorClause) andParts.push(advisorClause);
    }

    const li = opts?.lastInteraction?.trim();
    const interactionRange = resolveLimaDayRange(
      opts?.lastInteractionFrom,
      opts?.lastInteractionTo,
    );
    const hasValidRange = !!interactionRange;

    if (li || hasValidRange) {
      const activityAny: Prisma.CompanyWhereInput = {
        OR: [
          { activities: { some: { activity: {} } } },
          { contacts: { some: { contact: { activities: { some: { activity: {} } } } } } },
          { opportunities: { some: { opportunity: { activities: { some: { activity: {} } } } } } },
        ],
      };

      if (li === 'none') {
        andParts.push({ NOT: activityAny });
      } else if (hasValidRange && interactionRange) {
        const { from, to } = interactionRange;
        andParts.push({
          OR: [
            { activities: { some: { activity: { createdAt: { gte: from, lte: to } } } } },
            {
              contacts: {
                some: {
                  contact: {
                    activities: { some: { activity: { createdAt: { gte: from, lte: to } } } },
                  },
                },
              },
            },
            {
              opportunities: {
                some: {
                  opportunity: {
                    activities: { some: { activity: { createdAt: { gte: from, lte: to } } } },
                  },
                },
              },
            },
          ],
        });
      } else {
        const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '180d': 180 };
        const days = li ? daysMap[li] : undefined;
        if (days) {
          const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          andParts.push({
            OR: [
              { activities: { some: { activity: { createdAt: { gte: cutoff } } } } },
              {
                contacts: {
                  some: {
                    contact: {
                      activities: { some: { activity: { createdAt: { gte: cutoff } } } },
                    },
                  },
                },
              },
              {
                opportunities: {
                  some: {
                    opportunity: {
                      activities: { some: { activity: { createdAt: { gte: cutoff } } } },
                    },
                  },
                },
              },
            ],
          });
        }
      }
    }

    const createdRange = resolveLimaDayRange(
      opts?.createdFrom,
      opts?.createdTo,
    );
    if (createdRange) {
      andParts.push({
        createdAt: { gte: createdRange.from, lte: createdRange.to },
      });
    }

    return andParts;
  }

  /** Filtro por etapa de la empresa (CSV); alineado con la columna `displayEtapa` del listado. */
  private buildCompanyEtapaWhere(
    raw?: string,
  ): Prisma.CompanyWhereInput | null {
    const etapas = raw?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
    if (etapas.length === 0) return null;
    if (etapas.length === 1) return { etapa: etapas[0] };
    return { etapa: { in: etapas } };
  }

  private buildCompanyScalarCsvWhere(
    field: 'rubro' | 'tipo',
    raw?: string,
  ): Prisma.CompanyWhereInput | null {
    const values = raw?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
    if (values.length === 0) return null;
    if (values.length === 1) return { [field]: values[0] };
    return { [field]: { in: values } };
  }

  private async buildCompanyFuenteWhere(
    raw: string,
  ): Promise<Prisma.CompanyWhereInput | null> {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return null;

    const wantsUnassigned = parts.some(isUnassignedSourceSlug);
    const catalogParts = parts.filter((p) => !isUnassignedSourceSlug(p));
    const orClauses: Prisma.CompanyWhereInput[] = [];

    if (wantsUnassigned) {
      orClauses.push({
        OR: [{ fuente: null }, { fuente: '' }],
      });
    }

    if (catalogParts.length > 0) {
      const normalized = await Promise.all(
        catalogParts.map(async (part) => {
          try {
            return await this.crmConfig.normalizeLeadSource(part);
          } catch {
            return part;
          }
        }),
      );
      const unique = [
        ...new Set(normalized.map((s) => s.trim()).filter(Boolean)),
      ];
      if (unique.length > 0) {
        const fuenteClause =
          unique.length === 1
            ? { equals: unique[0], mode: 'insensitive' as const }
            : { in: unique, mode: 'insensitive' as const };

        orClauses.push({
          OR: [
            { fuente: fuenteClause },
            {
              contacts: {
                some: {
                  contact: { fuente: fuenteClause },
                },
              },
            },
          ],
        });
      }
    }

    if (orClauses.length === 0) return null;
    if (orClauses.length === 1) return orClauses[0]!;
    return { OR: orClauses };
  }

  /**
   * Conteos por etapa para pestañas dinámicas (misma lógica que `findAllSummary`).
   */
  async summaryEtapaCounts(
    opts?: {
      search?: string;
      rubro?: string;
      tipo?: string;
      fuente?: string;
      assignedTo?: string;
      excludeAssignedTo?: string;
      advisorPool?: string;
      lastInteraction?: string;
      lastInteractionFrom?: string;
      lastInteractionTo?: string;
      createdFrom?: string;
      createdTo?: string;
    },
    scope?: CrmDataScope,
  ): Promise<{ counts: Record<string, number> }> {
    const andParts = await this.buildCompanySummaryAndParts(opts, scope);
    const countForEtapa = (etapaQ: string) =>
      this.prisma.company.count({
        where: mergeCompanyScope(
          {
            AND: [...andParts, { etapa: etapaQ }],
          },
          scope,
        ),
      });
    const results = await Promise.all(
      COMPANY_SUMMARY_TAB_ETAPAS.map((slug) => countForEtapa(slug)),
    );
    const counts: Record<string, number> = {};
    COMPANY_SUMMARY_TAB_ETAPAS.forEach((slug, i) => {
      counts[slug] = results[i] ?? 0;
    });
    return { counts };
  }

  /**
   * Listado paginado con agregados por empresa (sin cargar todos los contactos en el cliente).
   * Filtro por etapa: solo `company.etapa` (coincide con la columna `displayEtapa`).
   */
  async findAllSummary(
    opts?: {
      page?: number;
      limit?: number;
      search?: string;
      rubro?: string;
      tipo?: string;
      etapa?: string;
      fuente?: string;
      assignedTo?: string;
      excludeAssignedTo?: string;
      advisorPool?: string;
      lastInteraction?: string;
      lastInteractionFrom?: string;
      lastInteractionTo?: string;
      createdFrom?: string;
      createdTo?: string;
    },
    scope?: CrmDataScope,
  ) {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(5000, Math.max(1, opts?.limit ?? 25));
    const skip = (page - 1) * limit;

    const andParts = await this.buildCompanySummaryAndParts(opts, scope);
    const etapaWhere = this.buildCompanyEtapaWhere(opts?.etapa);
    if (etapaWhere) andParts.push(etapaWhere);

    const inner: Prisma.CompanyWhereInput =
      andParts.length > 0 ? { AND: andParts } : {};
    const where = mergeCompanyScope(inner, scope);

    const [rows, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: companySelectSummary,
      }),
      this.prisma.company.count({ where }),
    ]);

    const data = rows.map((row) => this.mapCompanySummaryRow(row));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private mapCompanySummaryRow(row: CompanySummaryDbRow) {
    const contacts = row.contacts.map((cc) => cc.contact);
    const { contacts: _omitContacts, user: companyUser, activities: _companyActivities, opportunities: _companyOpps, ...rest } = row;

    let clienteRecuperado: 'si' | 'no' | null = normalizeClienteRecuperado(
      rest.clienteRecuperado,
    );
    if (clienteRecuperado == null) {
      if (
        contacts.some(
          (c) => normalizeClienteRecuperado(c.clienteRecuperado) === 'si',
        )
      ) {
        clienteRecuperado = 'si';
      } else if (
        contacts.some(
          (c) => normalizeClienteRecuperado(c.clienteRecuperado) === 'no',
        )
      ) {
        clienteRecuperado = 'no';
      }
    }

    const preview = contacts
      .slice(0, CONTACTS_PREVIEW_MAX)
      .map((c) => ({ id: c.id, name: c.name, urlSlug: c.urlSlug }));

    const contactCount = contacts.length;

    const companyActivityDates = _companyActivities?.map((a) => a.activity.createdAt) ?? [];
    const contactActivityDates = contacts.flatMap((c) =>
      (c as { activities?: { activity: { createdAt: Date } }[] }).activities?.map((a) => a.activity.createdAt) ?? []
    );
    const opportunityActivityDates = _companyOpps?.flatMap((co) =>
      co.opportunity?.activities?.map((a) => a.activity.createdAt) ?? []
    ) ?? [];

    const allActivityDates = [...companyActivityDates, ...contactActivityDates, ...opportunityActivityDates];
    const lastInteractionAt = allActivityDates.length > 0
      ? new Date(Math.max(...allActivityDates.map((d) => d.getTime()))).toISOString()
      : null;

    return {
      id: rest.id,
      urlSlug: rest.urlSlug,
      name: rest.name,
      razonSocial: rest.razonSocial,
      ruc: rest.ruc,
      telefono: rest.telefono,
      domain: rest.domain,
      rubro: rest.rubro,
      tipo: rest.tipo,
      facturacionEstimada: rest.facturacionEstimada,
      fuente: rest.fuente,
      etapa: rest.etapa,
      assignedTo: rest.assignedTo,
      createdAt: rest.createdAt,
      updatedAt: rest.updatedAt,
      contactCount,
      totalEstimatedValue: rest.facturacionEstimada,
      displayEtapa: rest.etapa,
      displayFuente: rest.fuente,
      displayAdvisorUserId: rest.assignedTo ?? companyUser?.id ?? null,
      displayAdvisorName: companyUser?.name ?? null,
      clienteRecuperado,
      contactsPreview: preview,
      lastInteractionAt,
    };
  }

  /**
   * Busca empresa por RUC (11 dígitos), tolerando distintos formatos guardados en BD.
   */
  async findOneByRucParam(rucParam: string, scope?: CrmDataScope) {
    const raw = rucParam?.trim() ?? '';
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 11) {
      throw new BadRequestException('El RUC debe tener 11 dígitos');
    }

    let row = await this.prisma.company.findFirst({
      where: {
        OR: [{ ruc: digits }, { ruc: raw }],
      },
      select: { id: true },
    });

    if (!row) {
      const candidates = await this.prisma.company.findMany({
        where: {
          ruc: { contains: digits },
        },
        take: 40,
        select: { id: true, ruc: true },
      });
      const match = candidates.find(
        (c) => (c.ruc ?? '').replace(/\D/g, '') === digits,
      );
      if (match) row = { id: match.id };
    }

    if (!row) {
      throw new NotFoundException('No hay empresa con ese RUC');
    }

    // Verificar si el usuario tiene acceso o si pertenece a alguien más
    const companyWithOwner = await this.prisma.company.findUnique({
      where: { id: row.id },
      include: { user: { select: { id: true, name: true } } },
    });

    if (companyWithOwner && scope && !scope.unrestricted) {
      if (companyWithOwner.assignedTo !== scope.viewerUserId) {
        throw new BadRequestException(
          `La empresa ya se encuentra registrada. \n Por: ${companyWithOwner.user?.name ?? 'Sistema (Sin asignar)'}`,
        );
      }
    }

    return this.findOne(row.id, scope);
  }

  async findOne(idOrSlug: string, scope?: CrmDataScope) {
    const id = await this.resolveCompanyId(idOrSlug);
    const company = await this.prisma.company.findFirst({
      where: mergeCompanyScope({ id }, scope),
      include: {
        user: { select: { id: true, name: true } },
      },
    });
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }
    this.logger.log(`[findOne] company id=${company.id} facturacionEstimada: ${company.facturacionEstimada} (tipo: ${typeof company.facturacionEstimada})`);
    return {
      ...company,
      clienteRecuperado: normalizeClienteRecuperado(company.clienteRecuperado),
    };
  }

  async update(
    idOrSlug: string,
    dto: UpdateCompanyDto,
    actor: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const id = await this.resolveCompanyId(idOrSlug);
    const snapshot = await this.prisma.company.findFirst({
      where: mergeCompanyScope({ id }, scope),
      select: {
        name: true,
        razonSocial: true,
        ruc: true,
        telefono: true,
        domain: true,
        rubro: true,
        tipo: true,
        linkedin: true,
        correo: true,
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
    if (!snapshot) {
      throw new NotFoundException('Empresa no encontrada');
    }
    if (scope && !scope.unrestricted && dto.assignedTo !== undefined) {
      const next = dto.assignedTo?.trim() || null;
      if (next !== scope.viewerUserId) {
        throw new BadRequestException(
          'No tienes permiso para reasignar esta empresa',
        );
      }
    }

    const data: Record<string, string | number | null | undefined> = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('El nombre no puede estar vacío');
      }
      data.name = name;
      data.urlSlug = await this.allocateCompanyUrlSlug(name, id);
    }
    if (dto.razonSocial !== undefined) {
      data.razonSocial = dto.razonSocial?.trim() || null;
    }
    if (dto.ruc !== undefined) data.ruc = dto.ruc?.trim() || null;
    if (dto.telefono !== undefined) data.telefono = dto.telefono?.trim() || null;
    if (dto.domain !== undefined) data.domain = dto.domain?.trim() || null;
    if (dto.rubro !== undefined) data.rubro = dto.rubro?.trim() || null;
    if (dto.tipo !== undefined) data.tipo = dto.tipo?.trim() || null;
    if (dto.linkedin !== undefined) data.linkedin = dto.linkedin?.trim() || null;
    if (dto.correo !== undefined) data.correo = dto.correo?.trim() || null;
    if (dto.distrito !== undefined) data.distrito = dto.distrito?.trim() || null;
    if (dto.provincia !== undefined) data.provincia = dto.provincia?.trim() || null;
    if (dto.departamento !== undefined) {
      data.departamento = dto.departamento?.trim() || null;
    }
    if (dto.direccion !== undefined) data.direccion = dto.direccion?.trim() || null;

    if (dto.facturacionEstimada !== undefined) {
      if (
        dto.facturacionEstimada === null ||
        Number.isNaN(dto.facturacionEstimada) ||
        dto.facturacionEstimada <= 0
      ) {
        throw new BadRequestException(
          'La facturación estimada debe ser mayor que 0',
        );
      }
      data.facturacionEstimada = dto.facturacionEstimada;
    }
    if (dto.fuente !== undefined) {
      data.fuente = await this.crmConfig.normalizeLeadSource(dto.fuente);
    }
    if (dto.clienteRecuperado !== undefined) {
      data.clienteRecuperado = normalizeClienteRecuperado(dto.clienteRecuperado);
    }
    if (dto.etapa !== undefined) {
      const e = dto.etapa?.trim();
      if (!e) {
        throw new BadRequestException('La etapa no puede estar vacía');
      }
      await this.crmConfig.assertEtapaAssignable(e);
      data.etapa = e;
    }
    if (dto.assignedTo !== undefined) {
      const a = dto.assignedTo?.trim() || null;
      if (a) {
        await this.assertUserExists(a);
      }
      data.assignedTo = a;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No hay campos para actualizar');
    }

    await this.prisma.company.update({
      where: { id },
      data: data as Prisma.CompanyUpdateInput,
    });

    const touchedCommercial =
      dto.facturacionEstimada !== undefined ||
      dto.fuente !== undefined ||
      dto.clienteRecuperado !== undefined ||
      dto.etapa !== undefined ||
      dto.assignedTo !== undefined;
    if (touchedCommercial) {
      await this.entitySync.propagateFromCompany(id);
    }

    const etapaChanged =
      dto.etapa !== undefined && dto.etapa.trim() !== snapshot.etapa;
    const action = etapaChanged ? 'cambiar_etapa' : 'actualizar';
    const description = etapaChanged
      ? `Etapa de la empresa: ${snapshot.etapa} → ${dto.etapa!.trim()}`
      : 'Datos de la empresa actualizados.';

    const auditPatch: Record<string, unknown> = { ...data };
    delete auditPatch.urlSlug;
    const before = { ...snapshot } as Record<string, unknown>;
    const diffEntries = buildChangeEntries(
      before,
      auditPatch,
      COMPANY_FIELD_LABELS,
      ['urlSlug'],
    );
    const displayName =
      typeof data.name === 'string' ? data.name : snapshot.name;

    await this.auditDetail.record(actor, {
      action,
      module: 'empresas',
      entityType: 'Empresa',
      entityId: id,
      entityName: displayName,
      entries: diffEntries,
    });

    await this.activityLogs.record(actor, {
      action,
      module: 'empresas',
      entityType: 'Empresa',
      entityId: id,
      entityName: displayName,
      description,
    });

    return this.findOne(id, scope);
  }

  async remove(
    idOrSlug: string,
    actor: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const id = await this.resolveCompanyId(idOrSlug);
    const row = await this.prisma.company.findFirst({
      where: mergeCompanyScope({ id }, scope),
      select: { name: true },
    });
    if (!row) {
      throw new NotFoundException('Empresa no encontrada');
    }
    const deleted = await this.prisma.company.delete({
      where: { id },
    });
    await this.auditDetail.record(actor, {
      action: 'eliminar',
      module: 'empresas',
      entityType: 'Empresa',
      entityId: id,
      entityName: row.name,
      entries: [
        {
          fieldKey: '_registro',
          fieldLabel: 'Registro',
          oldValue: row.name,
          newValue: '(eliminado)',
        },
      ],
    });
    await this.activityLogs.record(actor, {
      action: 'eliminar',
      module: 'empresas',
      entityType: 'Empresa',
      entityId: id,
      entityName: row.name,
      description: `Empresa eliminada: ${row.name}`,
      isCritical: true,
    });
    return deleted;
  }
}
