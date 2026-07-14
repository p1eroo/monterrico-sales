import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CreateCompanyDto } from '../companies/dto/create-company.dto';
import { EntitySyncService } from '../sync/entity-sync.service';
import { slugifyForUrl } from '../common/url-slug.util';
import { CrmConfigService } from '../crm-config/crm-config.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import type { ActivityActor } from '../activity-logs/activity-logs.types';
import { AuditDetailService } from '../audit-detail/audit-detail.service';
import { buildChangeEntries } from '../common/audit-diff.util';
import { CONTACT_FIELD_LABELS } from '../audit-detail/audit-field-labels';
import type { CrmDataScope } from '../auth/crm-data-scope.service';
import { mergeCompanyScope } from '../common/crm-data-scope-where.util';
import {
  applySimpleAdvisorFilter,
  parseAdvisorFilterQuery,
} from '../common/advisor-filter.util';
import { resolveLimaDayRange } from '../common/crm-timezone.util';
import { isUnassignedSourceSlug } from '../crm-config/lead-source-normalize.util';
import { NotificationsService } from '../notifications/notifications.service';
import { normalizeContactCargo } from './contact-cargo.util';
import { normalizeClienteRecuperado } from '../common/normalize-cliente-recuperado';

/** Orden de pestañas de etapa en listado contactos (alineado con Empresas). */
const CONTACT_TAB_ETAPAS = [
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

const contactIncludeList = {
  companies: { include: { company: true } },
  user: { select: { id: true, name: true } },
} as const;

/** Select explícito para listado: solo campos necesarios (sin etapaHistory, doc, direcciones).
 *  Omite redundancias: companyId (=company.id), assignedTo (=user.id) */
const contactSelectListSlim = {
  id: true,
  urlSlug: true,
  name: true,
  cargo: true,
  telefono: true,
  correo: true,
  fuente: true,
  etapa: true,
  estimatedValue: true,
  clienteRecuperado: true,
  createdAt: true,
  updatedAt: true,
  companies: {
    select: {
      id: true,
      isPrimary: true,
      company: {
        select: {
          id: true,
          urlSlug: true,
          name: true,
          activities: { select: { activity: { select: { createdAt: true } } } },
        },
      },
    },
  },
  user: { select: { id: true, name: true } },
  activities: { select: { activity: { select: { createdAt: true } } } },
  opportunities: {
    select: {
      opportunity: {
        select: {
          activities: { select: { activity: { select: { createdAt: true } } } },
        },
      },
    },
  },
} as const;

const contactIncludeDetail = {
  companies: { include: { company: true } },
  user: { select: { id: true, name: true } },
  contacts: {
    include: {
      linked: {
        include: {
          companies: { include: { company: true } },
        },
      },
    },
  },
  linkedBy: {
    include: {
      contact: {
        include: {
          companies: { include: { company: true } },
        },
      },
    },
  },
  opportunities: {
    include: {
      opportunity: {
        include: {
          user: { select: { id: true, name: true } },
          contacts: {
            take: 1,
            include: { contact: { select: { id: true, name: true } } },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitySync: EntitySyncService,
    private readonly crmConfig: CrmConfigService,
    private readonly activityLogs: ActivityLogsService,
    private readonly auditDetail: AuditDetailService,
    private readonly notifications: NotificationsService,
  ) {}

  private async assertUserExists(id: string): Promise<void> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) {
      throw new BadRequestException('El usuario asignado no existe');
    }
  }

  /** Alta de empresa dentro de una transacción (sin propagate; el contacto vinculado lo dispara después). */
  private async allocateContactUrlSlugTx(
    tx: Prisma.TransactionClient,
    nameSource: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugifyForUrl(nameSource);
    let candidate = base;
    let n = 0;
    for (;;) {
      const found = await tx.contact.findFirst({
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

  private async allocateCompanyUrlSlugTx(
    tx: Prisma.TransactionClient,
    nameSource: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugifyForUrl(nameSource);
    let candidate = base;
    let n = 0;
    for (;;) {
      const found = await tx.company.findFirst({
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

  private async allocateContactUrlSlug(
    nameSource: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugifyForUrl(nameSource);
    let candidate = base;
    let n = 0;
    for (;;) {
      const found = await this.prisma.contact.findFirst({
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

  private async resolveContactId(param: string): Promise<string> {
    const raw = param.trim();
    if (!raw) {
      throw new NotFoundException('Contacto no encontrado');
    }
    const byId = await this.prisma.contact.findUnique({
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
    const bySlug = await this.prisma.contact.findUnique({
      where: { urlSlug: slug },
      select: { id: true },
    });
    if (bySlug) return bySlug.id;
    throw new NotFoundException('Contacto no encontrado');
  }

  private async createCompanyInTx(
    tx: Prisma.TransactionClient,
    dto: CreateCompanyDto,
  ): Promise<{ id: string; name: string }> {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('El nombre de la empresa es obligatorio');
    }
    this.logger.log(`[createCompanyInTx] facturacionEstimada recibido: ${dto.facturacionEstimada} (tipo: ${typeof dto.facturacionEstimada})`);
    if (
      dto.facturacionEstimada === undefined ||
      dto.facturacionEstimada === null ||
      Number.isNaN(dto.facturacionEstimada) ||
      dto.facturacionEstimada <= 0
    ) {
      throw new BadRequestException(
        'La facturación estimada es obligatoria y debe ser mayor que 0',
      );
    }
    const fuente = await this.crmConfig.normalizeLeadSource(dto.fuente ?? '');
    const etapa = dto.etapa?.trim() || 'lead';
    const assignedTo = dto.assignedTo?.trim() || null;
    await this.crmConfig.assertEtapaAssignable(etapa);

    const rucTrim = dto.ruc?.trim();
    if (rucTrim) {
      const digits = rucTrim.replace(/\D/g, '');
      if (digits.length === 11) {
        const byDigits = await tx.$queryRaw<{ id: string; name: string }[]>(
          Prisma.sql`
            SELECT id, name FROM "Company"
            WHERE "ruc" IS NOT NULL
              AND regexp_replace("ruc", '[^0-9]', '', 'g') = ${digits}
            ORDER BY id ASC
            LIMIT 1
          `,
        );
        const row = byDigits[0];
        if (row) {
          return { id: row.id, name: row.name };
        }
      }
      const dupRuc = await tx.company.findFirst({
        where: { ruc: rucTrim },
        select: { id: true, name: true },
      });
      if (dupRuc) {
        return { id: dupRuc.id, name: dupRuc.name };
      }
    }

    // Verificar por dominio (case-insensitive) — evita duplicados por dominio
    const domainTrim = dto.domain?.trim();
    if (domainTrim) {
      const dupDomain = await tx.company.findFirst({
        where: { domain: { equals: domainTrim, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (dupDomain) {
        return { id: dupDomain.id, name: dupDomain.name };
      }
    }

    const dupName = await tx.company.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
      },
    });
    if (dupName) {
      throw new BadRequestException(
        'Ya existe una empresa con el mismo nombre. Revisa o elige otro nombre.',
      );
    }

    const companyUrlSlug = await this.allocateCompanyUrlSlugTx(tx, name);
    const company = await tx.company.create({
      data: {
        urlSlug: companyUrlSlug,
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
        facturacionEstimada: dto.facturacionEstimada,
        fuente,
        clienteRecuperado: normalizeClienteRecuperado(dto.clienteRecuperado),
        etapa,
        assignedTo,
      },
    });
    this.logger.log(`[createCompanyInTx] facturacionEstimada guardado: ${company.facturacionEstimada} (tipo: ${typeof company.facturacionEstimada}) en company id=${company.id}`);
    // Workaround: @prisma/adapter-pg no envía facturacionEstimada en el INSERT real,
    // forzamos el valor con un UPDATE directo
    await tx.$executeRaw`UPDATE "Company" SET "facturacionEstimada" = ${dto.facturacionEstimada} WHERE id = ${company.id}`;
    this.logger.log(`[createCompanyInTx] facturacionEstimada forzado vía raw a ${dto.facturacionEstimada}`);
    return { id: company.id, name: company.name };
  }

  async create(
    dto: CreateContactDto,
    actor?: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('El nombre es obligatorio');
    }
    const telefono = dto.telefono?.trim() || '-';
    const correo = dto.correo?.trim() ?? '';
    const fuente = await this.crmConfig.normalizeLeadSource(
      dto.fuente?.trim() || 'base',
    );
    const estimatedValue =
      dto.estimatedValue !== undefined &&
      dto.estimatedValue !== null &&
      Number.isFinite(dto.estimatedValue) &&
      dto.estimatedValue > 0
        ? dto.estimatedValue
        : 0;

    let assignedTo = dto.assignedTo?.trim() || null;
    if (scope && !scope.unrestricted) {
      assignedTo = scope.viewerUserId;
    } else if (assignedTo) {
      await this.assertUserExists(assignedTo);
    }

    const requestedCompanyId = dto.companyId?.trim();
    if (requestedCompanyId && dto.newCompany) {
      throw new BadRequestException(
        'No puedes enviar companyId y newCompany a la vez',
      );
    }

    if (requestedCompanyId) {
      const comp = await this.prisma.company.findFirst({
        where: mergeCompanyScope({ id: requestedCompanyId }, scope),
      });
      if (!comp) {
        throw new BadRequestException('La empresa indicada no existe');
      }
    }

    let newCompanyPayload = dto.newCompany;
    if (dto.newCompany && scope && !scope.unrestricted) {
      newCompanyPayload = {
        ...dto.newCompany,
        assignedTo: scope.viewerUserId,
      };
    } else if (dto.newCompany) {
      const ncAssigned = dto.newCompany.assignedTo?.trim();
      if (ncAssigned) {
        await this.assertUserExists(ncAssigned);
      }
    }

    const etapa = dto.etapa?.trim() || 'lead';
    const today = new Date().toISOString().slice(0, 10);
    let etapaHistory: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
    if (dto.etapaHistory !== undefined && dto.etapaHistory !== null) {
      etapaHistory = dto.etapaHistory as Prisma.InputJsonValue;
    } else {
      etapaHistory = [{ etapa, fecha: today }] as unknown as Prisma.InputJsonValue;
    }

    await this.crmConfig.assertEtapaAssignable(etapa);

    const { contact: row, effectiveCompanyId } = await this.prisma.$transaction(
      async (tx) => {
        let effectiveCompanyId: string | null = requestedCompanyId || null;
        if (newCompanyPayload) {
          this.logger.log(`[create] newCompanyPayload: ${JSON.stringify(newCompanyPayload)}`);
          const comp = await this.createCompanyInTx(tx, newCompanyPayload);
          effectiveCompanyId = comp.id;
        }

        const contactUrlSlug = await this.allocateContactUrlSlugTx(tx, name);
        const created = await tx.contact.create({
          data: {
            urlSlug: contactUrlSlug,
            name,
            telefono,
            correo,
            fuente,
            cargo: normalizeContactCargo(dto.cargo) ?? null,
            etapa,
            assignedTo,
            estimatedValue,
            departamento: dto.departamento?.trim() || null,
            provincia: dto.provincia?.trim() || null,
            distrito: dto.distrito?.trim() || null,
            direccion: dto.direccion?.trim() || null,
            clienteRecuperado: normalizeClienteRecuperado(dto.clienteRecuperado),
            etapaHistory,
          },
        });

        if (effectiveCompanyId) {
          await tx.companyContact.create({
            data: {
              contactId: created.id,
              companyId: effectiveCompanyId,
              isPrimary: true,
            },
          });
        }

        return { contact: created, effectiveCompanyId };
      },
    );

    if (effectiveCompanyId) {
      await this.entitySync.propagateFromContact(effectiveCompanyId, row.id);
    }

    await this.activityLogs.record(actor ?? null, {
      action: 'crear',
      module: 'contactos',
      entityType: 'Contacto',
      entityId: row.id,
      entityName: row.name,
      description: `Contacto creado: ${row.name}`,
    });

    if (assignedTo) {
      let companyName: string | null = null;
      if (effectiveCompanyId) {
        const co = await this.prisma.company.findUnique({
          where: { id: effectiveCompanyId },
          select: { name: true },
        });
        companyName = co?.name ?? null;
      }
      await this.notifications.notifyNewContact({
        userId: assignedTo,
        contactId: row.id,
        contactName: row.name,
        companyName,
      });
    }

    return this.findOne(row.id, scope);
  }

  private async contactListWhere(
    opts?: {
      search?: string;
      etapa?: string;
      fuente?: string;
      assignedTo?: string;
      /** IDs a excluir (legacy; sin asignar / otros roles siguen visibles). */
      excludeAssignedTo?: string;
      /** CSV de asesores activos (para token __others__). */
      advisorPool?: string;
      linkedToCompanyId?: string;
      excludeCompanyLinkId?: string;
      excludeOpportunityLinkId?: string;
      /** "none" | "7d" | "30d" | "90d" | "180d" */
      lastInteraction?: string;
      lastInteractionFrom?: string;
      lastInteractionTo?: string;
      createdFrom?: string;
      createdTo?: string;
    },
    scope?: CrmDataScope,
  ): Promise<Prisma.ContactWhereInput> {
    const where: Prisma.ContactWhereInput = {};
    const linkedCo = opts?.linkedToCompanyId?.trim();
    const excludeCo = opts?.excludeCompanyLinkId?.trim();
    if (linkedCo) {
      where.companies = { some: { companyId: linkedCo } };
    } else if (excludeCo) {
      where.companies = { none: { companyId: excludeCo } };
    }
    const excludeOpp = opts?.excludeOpportunityLinkId?.trim();
    if (excludeOpp) {
      where.opportunities = { none: { opportunityId: excludeOpp } };
    }
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
    if (opts?.etapa?.trim()) {
      const etapas = opts.etapa.split(',').map((s) => s.trim()).filter(Boolean);
      if (etapas.length > 1) {
        where.etapa = { in: etapas };
      } else if (etapas.length === 1) {
        where.etapa = etapas[0];
      }
    }
    if (opts?.fuente?.trim()) {
      const fuentes = opts.fuente.split(',').map((s) => s.trim()).filter(Boolean);
      const wantsUnassigned = fuentes.some(isUnassignedSourceSlug);
      const catalogFuentes = fuentes.filter((f) => !isUnassignedSourceSlug(f));
      const orParts: Prisma.ContactWhereInput[] = [];

      if (wantsUnassigned) {
        orParts.push({ fuente: '' });
      }

      if (catalogFuentes.length > 0) {
        const normalized = await Promise.all(
          catalogFuentes.map((f) => this.crmConfig.normalizeLeadSource(f)),
        );
        const unique = [...new Set(normalized.filter(Boolean))];
        if (unique.length > 1) {
          orParts.push({ fuente: { in: unique, mode: 'insensitive' } });
        } else if (unique.length === 1) {
          orParts.push({ fuente: { equals: unique[0], mode: 'insensitive' } });
        }
      }

      if (orParts.length > 0) {
        const existingAnd = Array.isArray(where.AND)
          ? where.AND
          : where.AND
            ? [where.AND]
            : [];
        const clause =
          orParts.length === 1 ? orParts[0]! : { OR: orParts };
        where.AND = [...existingAnd, clause];
      }
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

    const createdRange = resolveLimaDayRange(
      opts?.createdFrom,
      opts?.createdTo,
    );
    if (createdRange) {
      const pushAnd = (clause: Prisma.ContactWhereInput) => {
        if (where.AND) {
          where.AND = Array.isArray(where.AND)
            ? [...where.AND, clause]
            : [where.AND, clause];
        } else {
          where.AND = [clause];
        }
      };
      pushAnd({
        createdAt: { gte: createdRange.from, lte: createdRange.to },
      });
    }

    const li = opts?.lastInteraction?.trim();
    const interactionRange = resolveLimaDayRange(
      opts?.lastInteractionFrom,
      opts?.lastInteractionTo,
    );
    const hasValidRange = !!interactionRange;

    if (li || hasValidRange) {
      const activityAny: Prisma.ContactWhereInput = {
        OR: [
          { activities: { some: { activity: {} } } },
          {
            companies: {
              some: {
                company: { activities: { some: { activity: {} } } },
              },
            },
          },
          {
            opportunities: {
              some: {
                opportunity: { activities: { some: { activity: {} } } },
              },
            },
          },
        ],
      };

      const pushAnd = (clause: Prisma.ContactWhereInput) => {
        if (where.AND) {
          where.AND = Array.isArray(where.AND)
            ? [...where.AND, clause]
            : [where.AND, clause];
        } else {
          where.AND = [clause];
        }
      };

      if (li === 'none') {
        pushAnd({ NOT: activityAny });
      } else if (hasValidRange && interactionRange) {
        const { from, to } = interactionRange;
        pushAnd({
          OR: [
            {
              activities: {
                some: { activity: { createdAt: { gte: from, lte: to } } },
              },
            },
            {
              companies: {
                some: {
                  company: {
                    activities: {
                      some: { activity: { createdAt: { gte: from, lte: to } } },
                    },
                  },
                },
              },
            },
            {
              opportunities: {
                some: {
                  opportunity: {
                    activities: {
                      some: { activity: { createdAt: { gte: from, lte: to } } },
                    },
                  },
                },
              },
            },
          ],
        });
      } else {
        const daysMap: Record<string, number> = {
          '7d': 7,
          '30d': 30,
          '90d': 90,
          '180d': 180,
        };
        const days = li ? daysMap[li] : undefined;
        if (days) {
          const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          pushAnd({
            OR: [
              {
                activities: {
                  some: { activity: { createdAt: { gte: cutoff } } },
                },
              },
              {
                companies: {
                  some: {
                    company: {
                      activities: {
                        some: { activity: { createdAt: { gte: cutoff } } },
                      },
                    },
                  },
                },
              },
              {
                opportunities: {
                  some: {
                    opportunity: {
                      activities: {
                        some: { activity: { createdAt: { gte: cutoff } } },
                      },
                    },
                  },
                },
              },
            ],
          });
        }
      }
    }

    return where;
  }

  /**
   * Conteos por etapa para pestañas (mismos filtros que GET /contacts salvo etapa).
   */
  async etapaTabCounts(
    opts?: {
      search?: string;
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
    const results = await Promise.all(
      CONTACT_TAB_ETAPAS.map(async (slug) => {
        const where = await this.contactListWhere(
          { ...opts, etapa: slug },
          scope,
        );
        return this.prisma.contact.count({ where });
      }),
    );
    const counts: Record<string, number> = {};
    CONTACT_TAB_ETAPAS.forEach((slug, i) => {
      counts[slug] = results[i] ?? 0;
    });
    return { counts };
  }

  async findAll(
    opts?: {
      page?: number;
      limit?: number;
      search?: string;
      etapa?: string;
      fuente?: string;
      assignedTo?: string;
      excludeAssignedTo?: string;
      advisorPool?: string;
      linkedToCompanyId?: string;
      excludeCompanyLinkId?: string;
      excludeOpportunityLinkId?: string;
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

    const where = await this.contactListWhere(opts, scope);

    const [rows, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: contactSelectListSlim,
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      data: rows.map((r) => {
        const contactActivityDates = (r as any).activities?.map((a: any) => a.activity.createdAt) ?? [];
        const companyActivityDates = (r as any).companies?.flatMap((c: any) =>
          c.company?.activities?.map((a: any) => a.activity.createdAt) ?? []
        ) ?? [];
        const opportunityActivityDates = (r as any).opportunities?.flatMap((o: any) =>
          o.opportunity?.activities?.map((a: any) => a.activity.createdAt) ?? []
        ) ?? [];

        const allDates = [...contactActivityDates, ...companyActivityDates, ...opportunityActivityDates];
        const lastInteractionAt = allDates.length > 0
          ? new Date(Math.max(...allDates.map((d: Date) => d.getTime()))).toISOString()
          : null;

        return {
          ...r,
          clienteRecuperado: normalizeClienteRecuperado(r.clienteRecuperado),
          lastInteractionAt,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(idOrSlug: string, scope?: CrmDataScope) {
    const id = await this.resolveContactId(idOrSlug);
    const row = await this.prisma.contact.findUnique({
      where: { id },
      include: contactIncludeDetail,
    });
    if (!row) {
      throw new NotFoundException('Contacto no encontrado');
    }
    if (
      scope &&
      !scope.unrestricted &&
      row.assignedTo !== scope.viewerUserId
    ) {
      throw new NotFoundException('Contacto no encontrado');
    }
    return {
      ...row,
      clienteRecuperado: normalizeClienteRecuperado(row.clienteRecuperado),
    };
  }

  async update(
    idOrSlug: string,
    dto: UpdateContactDto,
    actor: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const id = await this.resolveContactId(idOrSlug);
    const snapshot = await this.prisma.contact.findUnique({
      where: { id },
      select: {
        name: true,
        telefono: true,
        correo: true,
        fuente: true,
        cargo: true,
        etapa: true,
        assignedTo: true,
        estimatedValue: true,
        departamento: true,
        provincia: true,
        distrito: true,
        direccion: true,
        clienteRecuperado: true,
        etapaHistory: true,
      },
    });
    if (!snapshot) {
      throw new NotFoundException('Contacto no encontrado');
    }
    if (
      scope &&
      !scope.unrestricted &&
      snapshot.assignedTo !== scope.viewerUserId
    ) {
      throw new NotFoundException('Contacto no encontrado');
    }
    if (scope && !scope.unrestricted && dto.assignedTo !== undefined) {
      const next = dto.assignedTo?.trim() || null;
      if (next !== scope.viewerUserId) {
        throw new BadRequestException(
          'No tienes permiso para reasignar este contacto',
        );
      }
    }

    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('El nombre no puede estar vacío');
      }
      data.name = name;
      data.urlSlug = await this.allocateContactUrlSlug(name, id);
    }
    if (dto.telefono !== undefined) {
      const telefono = dto.telefono.trim();
      if (!telefono) {
        throw new BadRequestException('El teléfono no puede estar vacío');
      }
      data.telefono = telefono;
    }
    if (dto.correo !== undefined) {
      const correo = dto.correo.trim();
      if (!correo) {
        throw new BadRequestException('El correo no puede estar vacío');
      }
      data.correo = correo;
    }
    if (dto.fuente !== undefined) {
      data.fuente = await this.crmConfig.normalizeLeadSource(dto.fuente);
    }
    if (dto.cargo !== undefined) {
      data.cargo = normalizeContactCargo(dto.cargo) ?? null;
    }
    if (dto.etapa !== undefined) {
      const etapa = dto.etapa.trim();
      if (!etapa) {
        throw new BadRequestException('La etapa no puede estar vacía');
      }
      await this.crmConfig.assertEtapaAssignable(etapa);
      data.etapa = etapa;
    }
    if (dto.assignedTo !== undefined) {
      const assignedTo = dto.assignedTo?.trim() || null;
      if (assignedTo) {
        await this.assertUserExists(assignedTo);
      }
      data.assignedTo = assignedTo;
    }
    if (dto.estimatedValue !== undefined) {
      if (
        dto.estimatedValue === null ||
        Number.isNaN(dto.estimatedValue) ||
        dto.estimatedValue <= 0
      ) {
        throw new BadRequestException(
          'El valor estimado debe ser mayor que 0',
        );
      }
      data.estimatedValue = dto.estimatedValue;
    }
    if (dto.departamento !== undefined) {
      data.departamento = dto.departamento?.trim() || null;
    }
    if (dto.provincia !== undefined) {
      data.provincia = dto.provincia?.trim() || null;
    }
    if (dto.distrito !== undefined) data.distrito = dto.distrito?.trim() || null;
    if (dto.direccion !== undefined) {
      data.direccion = dto.direccion?.trim() || null;
    }
    if (dto.clienteRecuperado !== undefined) {
      data.clienteRecuperado = normalizeClienteRecuperado(dto.clienteRecuperado);
    }
    if (dto.etapaHistory !== undefined) {
      data.etapaHistory =
        dto.etapaHistory === null
          ? Prisma.JsonNull
          : (dto.etapaHistory as Prisma.InputJsonValue);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No hay campos para actualizar');
    }

    await this.prisma.contact.update({
      where: { id },
      data: data as Prisma.ContactUpdateInput,
    });

    const links = await this.prisma.companyContact.findMany({
      where: { contactId: id },
      select: { companyId: true },
    });
    for (const { companyId } of links) {
      await this.entitySync.propagateFromContact(companyId, id);
    }

    const etapaChanged =
      dto.etapa !== undefined && dto.etapa.trim() !== snapshot.etapa;
    const action = etapaChanged ? 'cambiar_etapa' : 'actualizar';
    const description = etapaChanged
      ? `Etapa del contacto: ${snapshot.etapa} → ${dto.etapa!.trim()}`
      : 'Datos del contacto actualizados.';

    const auditPatch: Record<string, unknown> = { ...data };
    delete auditPatch.urlSlug;
    const before = { ...snapshot } as Record<string, unknown>;
    const diffEntries = buildChangeEntries(
      before,
      auditPatch,
      CONTACT_FIELD_LABELS,
      ['urlSlug'],
    );

    const displayName =
      typeof data.name === 'string' ? data.name : snapshot.name;

    await this.auditDetail.record(actor, {
      action,
      module: 'contactos',
      entityType: 'Contacto',
      entityId: id,
      entityName: displayName,
      entries: diffEntries,
    });

    await this.activityLogs.record(actor, {
      action,
      module: 'contactos',
      entityType: 'Contacto',
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
    const id = await this.resolveContactId(idOrSlug);
    const row = await this.prisma.contact.findUnique({
      where: { id },
      select: { name: true, assignedTo: true },
    });
    if (!row) {
      throw new NotFoundException('Contacto no encontrado');
    }
    if (
      scope &&
      !scope.unrestricted &&
      row.assignedTo !== scope.viewerUserId
    ) {
      throw new NotFoundException('Contacto no encontrado');
    }
    const deleted = await this.prisma.contact.delete({
      where: { id },
    });
    await this.auditDetail.record(actor, {
      action: 'eliminar',
      module: 'contactos',
      entityType: 'Contacto',
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
      module: 'contactos',
      entityType: 'Contacto',
      entityId: id,
      entityName: row.name,
      description: `Contacto eliminado: ${row.name}`,
      isCritical: true,
    });
    return deleted;
  }

  async addCompany(
    contactIdOrSlug: string,
    companyId: string,
    isPrimary = false,
    actor?: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const contactId = await this.resolveContactId(contactIdOrSlug);
    await this.findOne(contactId, scope);
    const company = await this.prisma.company.findFirst({
      where: mergeCompanyScope({ id: companyId }, scope),
    });
    if (!company) {
      throw new BadRequestException('La empresa no existe');
    }
    const existing = await this.prisma.companyContact.findUnique({
      where: {
        companyId_contactId: { companyId, contactId },
      },
    });
    if (existing) {
      throw new BadRequestException('El contacto ya está vinculado a esta empresa');
    }
    await this.prisma.companyContact.create({
      data: { contactId, companyId, isPrimary },
    });
    await this.entitySync.propagateFromContact(companyId, contactId);
    if (actor) {
      const contactRow = await this.prisma.contact.findUnique({
        where: { id: contactId },
        select: { name: true },
      });
      await this.activityLogs.record(actor, {
        action: 'actualizar',
        module: 'contactos',
        entityType: 'Contacto',
        entityId: contactId,
        entityName: contactRow?.name,
        description: `Empresa vinculada al contacto: ${company.name}`,
      });
    }
    return this.findOne(contactId, scope);
  }

  async removeCompany(
    contactIdOrSlug: string,
    companyId: string,
    actor?: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const contactId = await this.resolveContactId(contactIdOrSlug);
    await this.findOne(contactId, scope);
    const deleted = await this.prisma.companyContact.deleteMany({
      where: { contactId, companyId },
    });
    if (deleted.count === 0) {
      throw new BadRequestException('El vínculo no existe');
    }
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    if (actor) {
      const contactRow = await this.prisma.contact.findUnique({
        where: { id: contactId },
        select: { name: true },
      });
      await this.activityLogs.record(actor, {
        action: 'actualizar',
        module: 'contactos',
        entityType: 'Contacto',
        entityId: contactId,
        entityName: contactRow?.name,
        description: `Se quitó la vinculación con la empresa ${
          company?.name ?? companyId
        }`,
      });
    }
    return this.findOne(contactId, scope);
  }

  async addLinkedContact(
    contactIdOrSlug: string,
    linkedContactId: string,
    actor?: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const contactId = await this.resolveContactId(contactIdOrSlug);
    if (contactId === linkedContactId) {
      throw new BadRequestException('Un contacto no puede vincularse consigo mismo');
    }
    await this.findOne(contactId, scope);
    const linked = await this.prisma.contact.findUnique({
      where: { id: linkedContactId },
    });
    if (!linked) {
      throw new BadRequestException('El contacto a vincular no existe');
    }
    if (
      scope &&
      !scope.unrestricted &&
      linked.assignedTo !== scope.viewerUserId
    ) {
      throw new BadRequestException('El contacto a vincular no existe');
    }
    const existing = await this.prisma.contactContact.findUnique({
      where: {
        contactId_linkedId: { contactId, linkedId: linkedContactId },
      },
    });
    if (existing) {
      throw new BadRequestException('Los contactos ya están vinculados');
    }
    await this.prisma.contactContact.create({
      data: { contactId, linkedId: linkedContactId },
    });
    if (actor) {
      const contactRow = await this.prisma.contact.findUnique({
        where: { id: contactId },
        select: { name: true },
      });
      await this.activityLogs.record(actor, {
        action: 'actualizar',
        module: 'contactos',
        entityType: 'Contacto',
        entityId: contactId,
        entityName: contactRow?.name,
        description: `Contacto vinculado: ${linked.name}`,
      });
    }
    return this.findOne(contactId, scope);
  }

  async removeLinkedContact(
    contactIdOrSlug: string,
    linkedId: string,
    actor?: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const contactId = await this.resolveContactId(contactIdOrSlug);
    await this.findOne(contactId, scope);
    const deleted = await this.prisma.contactContact.deleteMany({
      where: { contactId, linkedId },
    });
    if (deleted.count === 0) {
      throw new BadRequestException('El vínculo no existe');
    }
    const other = await this.prisma.contact.findUnique({
      where: { id: linkedId },
      select: { name: true },
    });
    if (actor) {
      const contactRow = await this.prisma.contact.findUnique({
        where: { id: contactId },
        select: { name: true },
      });
      await this.activityLogs.record(actor, {
        action: 'actualizar',
        module: 'contactos',
        entityType: 'Contacto',
        entityId: contactId,
        entityName: contactRow?.name,
        description: `Se eliminó el vínculo con el contacto ${
          other?.name ?? linkedId
        }`,
      });
    }
    return this.findOne(contactId, scope);
  }
}
