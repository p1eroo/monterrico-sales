import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { EntitySyncService } from '../sync/entity-sync.service';
import { ClientsService } from '../clients/clients.service';
import { slugifyForUrl } from '../common/url-slug.util';
import { CrmConfigService } from '../crm-config/crm-config.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import type { ActivityActor } from '../activity-logs/activity-logs.types';
import { AuditDetailService } from '../audit-detail/audit-detail.service';
import { buildChangeEntries } from '../common/audit-diff.util';
import { COMPANY_FIELD_LABELS } from '../audit-detail/audit-field-labels';
import type { CrmDataScope } from '../auth/crm-data-scope.service';
import { mergeCompanyScope } from '../common/crm-data-scope-where.util';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitySync: EntitySyncService,
    private readonly clientsService: ClientsService,
    private readonly crmConfig: CrmConfigService,
    private readonly activityLogs: ActivityLogsService,
    private readonly auditDetail: AuditDetailService,
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
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('El nombre de la empresa es obligatorio');
    }

    const facturacionEstimada =
      dto.facturacionEstimada !== undefined &&
      dto.facturacionEstimada !== null &&
      Number.isFinite(dto.facturacionEstimada) &&
      dto.facturacionEstimada > 0
        ? dto.facturacionEstimada
        : 0;

    const fuente = dto.fuente?.trim() || 'base';

    const etapa = dto.etapa?.trim() || 'lead';
    let assignedTo = dto.assignedTo?.trim() || null;
    if (scope && !scope.unrestricted) {
      assignedTo = scope.viewerUserId;
    } else if (assignedTo) {
      await this.assertUserExists(assignedTo);
    }
    await this.crmConfig.assertEtapaAssignable(etapa);

    const dupName = await this.prisma.company.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
      },
    });
    if (dupName) {
      throw new BadRequestException(
        'Ya existe una empresa con el mismo nombre. Revisa o elige otro nombre.',
      );
    }

    const rucTrim = dto.ruc?.trim();
    if (rucTrim) {
      const dupRuc = await this.prisma.company.findFirst({
        where: { ruc: rucTrim },
      });
      if (dupRuc) {
        throw new BadRequestException(
          'Ya existe una empresa registrada con el mismo RUC.',
        );
      }
    }

    const urlSlug = await this.allocateCompanyUrlSlug(name);
    const company = await this.prisma.company.create({
      data: {
        urlSlug,
        name,
        razonSocial: dto.razonSocial?.trim() || null,
        ruc: rucTrim || null,
        telefono: dto.telefono?.trim() || null,
        domain: dto.domain?.trim() || null,
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
        clienteRecuperado: dto.clienteRecuperado?.trim() || null,
        etapa,
        assignedTo,
      },
    });

    await this.entitySync.propagateFromCompany(company.id);
    await this.clientsService.ensureClientForCierreGanado(company.id);

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

  async findAll(
    opts?: {
      page?: number;
      limit?: number;
      search?: string;
      rubro?: string;
      tipo?: string;
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
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Filtros del listado summary sin la condición de etapa (búsqueda, rubro, tipo, fuente, asesor).
   */
  private buildCompanySummaryAndParts(
    opts?: {
      search?: string;
      rubro?: string;
      tipo?: string;
      fuente?: string;
      assignedTo?: string;
    },
    scope?: CrmDataScope,
  ): Prisma.CompanyWhereInput[] {
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
    if (opts?.rubro?.trim()) andParts.push({ rubro: opts.rubro.trim() });
    if (opts?.tipo?.trim()) andParts.push({ tipo: opts.tipo.trim() });
    const fuenteQ = opts?.fuente?.trim();
    if (fuenteQ) {
      andParts.push({
        OR: [
          { fuente: fuenteQ },
          {
            contacts: {
              some: { contact: { fuente: fuenteQ } },
            },
          },
        ],
      });
    }
    const advQ =
      scope && !scope.unrestricted
        ? undefined
        : opts?.assignedTo?.trim();
    if (advQ) {
      andParts.push({
        OR: [
          { assignedTo: advQ },
          {
            contacts: {
              some: { contact: { assignedTo: advQ } },
            },
          },
        ],
      });
    }
    return andParts;
  }

  /**
   * Conteos por etapa para pestañas dinámicas (misma lógica OR empresa / contacto que `findAllSummary`).
   */
  async summaryEtapaCounts(
    opts?: {
      search?: string;
      rubro?: string;
      tipo?: string;
      fuente?: string;
      assignedTo?: string;
    },
    scope?: CrmDataScope,
  ): Promise<{ counts: Record<string, number> }> {
    const andParts = this.buildCompanySummaryAndParts(opts, scope);
    const countForEtapa = (etapaQ: string) =>
      this.prisma.company.count({
        where: mergeCompanyScope(
          {
            AND: [
              ...andParts,
              {
                OR: [
                  { etapa: etapaQ },
                  {
                    contacts: {
                      some: { contact: { etapa: etapaQ } },
                    },
                  },
                ],
              },
            ],
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
   * Filtro por etapa: empresas con al menos un contacto en esa etapa (no coincide siempre con la etapa “display” por peso).
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
    },
    scope?: CrmDataScope,
  ) {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(5000, Math.max(1, opts?.limit ?? 25));
    const skip = (page - 1) * limit;

    const andParts = this.buildCompanySummaryAndParts(opts, scope);
    const etapaQ = opts?.etapa?.trim();
    if (etapaQ) {
      andParts.push({
        OR: [
          { etapa: etapaQ },
          {
            contacts: {
              some: { contact: { etapa: etapaQ } },
            },
          },
        ],
      });
    }

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
    const { contacts: _omit, user: companyUser, ...rest } = row;

    let clienteRecuperado: 'si' | 'no' | null =
      (rest.clienteRecuperado === 'si' || rest.clienteRecuperado === 'no'
        ? rest.clienteRecuperado
        : null) as 'si' | 'no' | null;
    if (clienteRecuperado == null) {
      if (contacts.some((c) => c.clienteRecuperado === 'si')) {
        clienteRecuperado = 'si';
      } else if (contacts.some((c) => c.clienteRecuperado === 'no')) {
        clienteRecuperado = 'no';
      }
    }

    const preview = contacts
      .slice(0, CONTACTS_PREVIEW_MAX)
      .map((c) => ({ id: c.id, name: c.name, urlSlug: c.urlSlug }));

    const contactCount = contacts.length;

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
    return company;
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
      const s = dto.fuente?.trim();
      if (!s) {
        throw new BadRequestException('La fuente no puede estar vacía');
      }
      data.fuente = s;
    }
    if (dto.clienteRecuperado !== undefined) {
      data.clienteRecuperado = dto.clienteRecuperado?.trim() || null;
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

    await this.clientsService.ensureClientForCierreGanado(id);

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
