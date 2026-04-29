import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { EntitySyncService } from '../sync/entity-sync.service';
import { slugifyForUrl } from '../common/url-slug.util';
import { CrmConfigService } from '../crm-config/crm-config.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import type { ActivityActor } from '../activity-logs/activity-logs.types';
import { AuditDetailService } from '../audit-detail/audit-detail.service';
import { buildChangeEntries } from '../common/audit-diff.util';
import { OPPORTUNITY_FIELD_LABELS } from '../audit-detail/audit-field-labels';
import type { CrmDataScope } from '../auth/crm-data-scope.service';
import { mergeCompanyScope } from '../common/crm-data-scope-where.util';
import { NotificationsService } from '../notifications/notifications.service';
import { parseDateOnlyToUtcNoon } from '../common/parse-date-input.util';

/** Estados de pipeline derivados de la etapa (no se usa `suspendida`). */
type PipelineOpportunityStatus = 'abierta' | 'ganada' | 'perdida';

/** Select slim para listado: omite assignedTo (=user.id) */
const opportunitySelectListSlim = {
  id: true,
  urlSlug: true,
  title: true,
  amount: true,
  probability: true,
  etapa: true,
  status: true,
  priority: true,
  expectedCloseDate: true,
  createdAt: true,
  updatedAt: true,
  contacts: {
    take: 1,
    select: { contact: { select: { id: true, urlSlug: true, name: true } } },
  },
  companies: {
    select: { company: { select: { id: true, name: true } } },
  },
  user: { select: { id: true, name: true } },
} as const;

const opportunityIncludeDetail = {
  contacts: { include: { contact: true } },
  companies: { include: { company: true } },
  user: { select: { id: true, name: true } },
} as const;

@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitySync: EntitySyncService,
    private readonly crmConfig: CrmConfigService,
    private readonly activityLogs: ActivityLogsService,
    private readonly auditDetail: AuditDetailService,
    private readonly notifications: NotificationsService,
  ) {}

  private async probabilityForEtapa(
    etapa: string,
    explicit?: number,
  ): Promise<number> {
    if (explicit !== undefined && Number.isFinite(explicit)) {
      return Math.round(explicit);
    }
    return this.crmConfig.resolveOpportunityProbability(etapa);
  }

  private normalizePriority(raw?: string): string {
    const p = raw?.trim().toLowerCase();
    if (p === 'baja' || p === 'media' || p === 'alta') {
      return p;
    }
    return 'media';
  }

  /** Deriva estado comercial solo a partir de la etapa (abierta | ganada | perdida). */
  private statusFromEtapa(etapa: string): PipelineOpportunityStatus {
    /** Solo `activo` (100 % en catálogo) → ganada; no cierre_ganado ni firma_contrato. */
    if (etapa === 'activo') {
      return 'ganada';
    }
    if (['cierre_perdido', 'inactivo'].includes(etapa)) {
      return 'perdida';
    }
    return 'abierta';
  }

  /** PATCH explícito de `status` sin cambiar etapa: solo abierta | ganada | perdida. */
  private normalizeManualStatus(raw: string): PipelineOpportunityStatus {
    const s = raw.trim().toLowerCase();
    if (s === 'ganada' || s === 'perdida' || s === 'abierta') {
      return s;
    }
    return 'abierta';
  }

  private async assertUserExists(id: string): Promise<void> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) {
      throw new BadRequestException('El usuario asignado no existe');
    }
  }

  /** Misma empresa: no dos oportunidades con el mismo título (sin distinguir mayúsculas). */
  private async assertNoDuplicateTitleForCompany(
    companyId: string,
    title: string,
    excludeOpportunityId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const db = tx ?? this.prisma;
    const dup = await db.opportunity.findFirst({
      where: {
        ...(excludeOpportunityId ? { id: { not: excludeOpportunityId } } : {}),
        title: { equals: title, mode: 'insensitive' },
        companies: { some: { companyId } },
      },
      select: { id: true },
    });
    if (dup) {
      throw new BadRequestException(
        'Ya existe una oportunidad con este nombre vinculada a la empresa. Elige otro nombre o abre la oportunidad existente.',
      );
    }
  }

  private async allocateOpportunityUrlSlugTx(
    tx: Prisma.TransactionClient,
    title: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugifyForUrl(title);
    let candidate = base;
    let n = 0;
    for (;;) {
      const found = await tx.opportunity.findFirst({
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

  private async allocateOpportunityUrlSlug(
    title: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugifyForUrl(title);
    let candidate = base;
    let n = 0;
    for (;;) {
      const found = await this.prisma.opportunity.findFirst({
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

  private async resolveOpportunityId(param: string): Promise<string> {
    const raw = param.trim();
    if (!raw) {
      throw new NotFoundException('Oportunidad no encontrada');
    }
    const byId = await this.prisma.opportunity.findUnique({
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
    const bySlug = await this.prisma.opportunity.findUnique({
      where: { urlSlug: slug },
      select: { id: true },
    });
    if (bySlug) return bySlug.id;
    throw new NotFoundException('Oportunidad no encontrada');
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
    dto: CreateOpportunityDto,
    actor?: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const title = dto.title?.trim();
    if (!title) {
      throw new BadRequestException('El título es obligatorio');
    }
    if (dto.amount === undefined || dto.amount === null || Number.isNaN(dto.amount)) {
      throw new BadRequestException('El monto es obligatorio');
    }
    if (dto.amount <= 0) {
      throw new BadRequestException(
        'El monto estimado es obligatorio y debe ser mayor que 0',
      );
    }
    const etapa = dto.etapa?.trim();
    if (!etapa) {
      throw new BadRequestException('La etapa es obligatoria');
    }
    await this.crmConfig.assertEtapaAssignable(etapa);

    let assignedTo = dto.assignedTo?.trim() || null;
    if (scope && !scope.unrestricted) {
      assignedTo = scope.viewerUserId;
    } else if (assignedTo) {
      await this.assertUserExists(assignedTo);
    }

    if (dto.contactId?.trim()) {
      const c = await this.prisma.contact.findUnique({
        where: { id: dto.contactId.trim() },
      });
      if (!c) {
        throw new BadRequestException('El contacto indicado no existe');
      }
      if (
        scope &&
        !scope.unrestricted &&
        c.assignedTo !== scope.viewerUserId
      ) {
        throw new BadRequestException('El contacto indicado no existe');
      }
    }

    if (dto.companyId?.trim()) {
      const cid = dto.companyId.trim();
      const comp = await this.prisma.company.findFirst({
        where: mergeCompanyScope({ id: cid }, scope),
      });
      if (!comp) {
        throw new BadRequestException('La empresa indicada no existe');
      }
    }

    const contactId = dto.contactId?.trim();
    const companyId = dto.companyId?.trim();

    const probability = await this.probabilityForEtapa(etapa, dto.probability);
    const priority = this.normalizePriority(dto.priority);
    const status = this.statusFromEtapa(etapa);
    const expectedCloseDate =
      dto.expectedCloseDate?.trim() != null && dto.expectedCloseDate.trim() !== ''
        ? parseDateOnlyToUtcNoon(dto.expectedCloseDate.trim())
        : null;
    if (expectedCloseDate && Number.isNaN(expectedCloseDate.getTime())) {
      throw new BadRequestException('Fecha de cierre inválida');
    }

    if (contactId && companyId) {
      const existing = await this.prisma.opportunity.findFirst({
        where: {
          AND: [
            { contacts: { some: { contactId } } },
            { companies: { some: { companyId } } },
          ],
        },
      });
      if (existing) {
        /**
         * Si ya existe una oportunidad para la misma pareja contacto+empresa (import u otro flujo),
         * el POST del wizard debe fusionar título, slug, monto, etapa, fecha, etc., no devolverla sin tocar.
         */
        await this.assertNoDuplicateTitleForCompany(
          companyId,
          title,
          existing.id,
        );
        const urlSlug = await this.allocateOpportunityUrlSlug(title, existing.id);
        await this.prisma.opportunity.update({
          where: { id: existing.id },
          data: {
            title,
            urlSlug,
            amount: dto.amount,
            probability,
            etapa,
            status,
            priority,
            expectedCloseDate,
            assignedTo,
          },
        });
        await this.entitySync.propagateFromOpportunityAllCompanies(existing.id);
        return this.findOne(existing.id, scope);
      }
    }

    const created = await this.prisma.$transaction(
      async (tx) => {
        if (companyId) {
          await this.assertNoDuplicateTitleForCompany(
            companyId,
            title,
            undefined,
            tx,
          );
        }
        const urlSlug = await this.allocateOpportunityUrlSlugTx(tx, title);
        const opp = await tx.opportunity.create({
          data: {
            urlSlug,
            title,
            amount: dto.amount,
            probability,
            etapa,
            status,
            priority,
            expectedCloseDate,
            assignedTo,
          },
        });

        if (contactId) {
          await tx.contactOpportunity.create({
            data: { contactId, opportunityId: opp.id },
          });
        }
        if (companyId) {
          await tx.companyOpportunity.create({
            data: { companyId, opportunityId: opp.id },
          });
        }

        return tx.opportunity.findUniqueOrThrow({
          where: { id: opp.id },
          include: opportunityIncludeDetail,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      },
    );

    await this.entitySync.propagateFromOpportunityAllCompanies(created.id);

    await this.activityLogs.record(actor ?? null, {
      action: 'crear',
      module: 'oportunidades',
      entityType: 'Oportunidad',
      entityId: created.id,
      entityName: created.title,
      description: `Oportunidad creada: ${created.title}`,
    });

    if (status === 'ganada' && assignedTo) {
      await this.notifications.notifyOpportunityWon({
        userId: assignedTo,
        opportunityId: created.id,
        title: created.title,
        amount: created.amount,
      });
    }

    return created;
  }

  async findAll(
    opts?: {
      page?: number;
      limit?: number;
      search?: string;
      etapa?: string;
      status?: string;
      assignedTo?: string;
    },
    scope?: CrmDataScope,
  ) {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(5000, Math.max(1, opts?.limit ?? 25));
    const skip = (page - 1) * limit;

    const where: Prisma.OpportunityWhereInput = {};
    if (opts?.search?.trim()) {
      const q = opts.search.trim();
      where.title = { contains: q, mode: 'insensitive' };
    }
    if (opts?.etapa?.trim()) where.etapa = opts.etapa.trim();
    if (opts?.status?.trim()) where.status = opts.status.trim();
    if (scope && !scope.unrestricted) {
      where.assignedTo = scope.viewerUserId;
    } else if (opts?.assignedTo?.trim()) {
      where.assignedTo = opts.assignedTo.trim();
    }

    const [rows, total] = await Promise.all([
      this.prisma.opportunity.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: opportunitySelectListSlim,
      }),
      this.prisma.opportunity.count({ where }),
    ]);

    return {
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(idOrSlug: string, scope?: CrmDataScope) {
    const id = await this.resolveOpportunityId(idOrSlug);
    const opp = await this.prisma.opportunity.findUnique({
      where: { id },
      include: opportunityIncludeDetail,
    });
    if (!opp) {
      throw new NotFoundException('Oportunidad no encontrada');
    }
    if (
      scope &&
      !scope.unrestricted &&
      opp.assignedTo !== scope.viewerUserId
    ) {
      throw new NotFoundException('Oportunidad no encontrada');
    }
    return opp;
  }

  async update(
    idOrSlug: string,
    dto: UpdateOpportunityDto,
    actor: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const id = await this.resolveOpportunityId(idOrSlug);
    const primaryLink = await this.prisma.contactOpportunity.findFirst({
      where: { opportunityId: id },
      select: { contactId: true },
    });
    const snapshot = await this.prisma.opportunity.findUnique({
      where: { id },
      select: {
        title: true,
        amount: true,
        probability: true,
        etapa: true,
        status: true,
        priority: true,
        expectedCloseDate: true,
        assignedTo: true,
      },
    });
    if (!snapshot) {
      throw new NotFoundException('Oportunidad no encontrada');
    }
    if (
      scope &&
      !scope.unrestricted &&
      snapshot.assignedTo !== scope.viewerUserId
    ) {
      throw new NotFoundException('Oportunidad no encontrada');
    }
    if (scope && !scope.unrestricted && dto.assignedTo !== undefined) {
      const next = dto.assignedTo?.trim() || null;
      if (next !== scope.viewerUserId) {
        throw new BadRequestException(
          'No tienes permiso para reasignar esta oportunidad',
        );
      }
    }

    const before: Record<string, unknown> = {
      ...snapshot,
      primaryContactId: primaryLink?.contactId ?? '',
    };

    const data: Record<string, string | number | Date | null | undefined> = {};

    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) {
        throw new BadRequestException('El título no puede estar vacío');
      }
      const companyLinks = await this.prisma.companyOpportunity.findMany({
        where: { opportunityId: id },
        select: { companyId: true },
      });
      for (const { companyId } of companyLinks) {
        await this.assertNoDuplicateTitleForCompany(companyId, title, id);
      }
      data.title = title;
      data.urlSlug = await this.allocateOpportunityUrlSlug(title, id);
    }
    if (dto.amount !== undefined) {
      if (dto.amount < 0) {
        throw new BadRequestException('El monto no puede ser negativo');
      }
      data.amount = dto.amount;
    }
    if (dto.etapa !== undefined) {
      const etapa = dto.etapa.trim();
      if (!etapa) {
        throw new BadRequestException('La etapa no puede estar vacía');
      }
      await this.crmConfig.assertEtapaAssignable(etapa);
      data.etapa = etapa;
      if (dto.probability === undefined) {
        data.probability = await this.probabilityForEtapa(etapa);
      }
      data.status = this.statusFromEtapa(etapa);
    }
    if (dto.probability !== undefined) {
      data.probability = Math.round(dto.probability);
    }
    if (dto.status !== undefined && dto.etapa === undefined) {
      data.status = this.normalizeManualStatus(dto.status);
    }
    if (dto.expectedCloseDate !== undefined) {
      if (
        dto.expectedCloseDate === null ||
        (typeof dto.expectedCloseDate === 'string' && dto.expectedCloseDate.trim() === '')
      ) {
        data.expectedCloseDate = null;
      } else if (typeof dto.expectedCloseDate === 'string') {
        const d = parseDateOnlyToUtcNoon(dto.expectedCloseDate.trim());
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('Fecha de cierre inválida');
        }
        data.expectedCloseDate = d;
      }
    }
    if (dto.assignedTo !== undefined) {
      const assignedTo = dto.assignedTo?.trim() || null;
      if (assignedTo) {
        await this.assertUserExists(assignedTo);
      }
      data.assignedTo = assignedTo;
    }
    if (dto.priority !== undefined) {
      data.priority = this.normalizePriority(dto.priority);
    }

    const hasContactLinkUpdate = dto.contactId !== undefined;
    const hasCompanyLinkUpdate = dto.companyId !== undefined;

    if (
      Object.keys(data).length === 0 &&
      !hasContactLinkUpdate &&
      !hasCompanyLinkUpdate
    ) {
      throw new BadRequestException('No hay campos para actualizar');
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.opportunity.update({
        where: { id },
        data: data as Prisma.OpportunityUpdateInput,
      });
    }

    if (hasContactLinkUpdate) {
      const raw = dto.contactId;
      if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
        await this.prisma.contactOpportunity.deleteMany({
          where: { opportunityId: id },
        });
      } else {
        if (typeof raw !== 'string') {
          throw new BadRequestException('contactId debe ser un string');
        }
        const cid = raw.trim();
        const c = await this.prisma.contact.findUnique({ where: { id: cid } });
        if (!c) {
          throw new BadRequestException('El contacto no existe');
        }
        if (
          scope &&
          !scope.unrestricted &&
          c.assignedTo !== scope.viewerUserId
        ) {
          throw new BadRequestException('El contacto no existe');
        }
        await this.prisma.$transaction(async (tx) => {
          await tx.contactOpportunity.deleteMany({
            where: { opportunityId: id },
          });
          await tx.contactOpportunity.create({
            data: { contactId: cid, opportunityId: id },
          });
        });
      }
    }

    if (hasCompanyLinkUpdate) {
      const rawCo = dto.companyId;
      if (
        rawCo !== null &&
        typeof rawCo === 'string' &&
        rawCo.trim() !== ''
      ) {
        const companyIdTrim = rawCo.trim();
        const comp = await this.prisma.company.findFirst({
          where: mergeCompanyScope({ id: companyIdTrim }, scope),
          select: { id: true, name: true },
        });
        if (!comp) {
          throw new BadRequestException('La empresa indicada no existe');
        }
        await this.assertNoDuplicateTitleForCompany(
          comp.id,
          snapshot.title,
          id,
        );
        const existingLink = await this.prisma.companyOpportunity.findUnique({
          where: {
            companyId_opportunityId: {
              companyId: comp.id,
              opportunityId: id,
            },
          },
        });
        if (!existingLink) {
          await this.prisma.companyOpportunity.create({
            data: { companyId: comp.id, opportunityId: id },
          });
          await this.entitySync.propagateFromCompany(comp.id);
          await this.entitySync.propagateFromOpportunityAllCompanies(id);
        }
      }
    }

    const touchedCommercial =
      dto.amount !== undefined ||
      dto.etapa !== undefined ||
      dto.assignedTo !== undefined;
    if (touchedCommercial) {
      await this.entitySync.propagateFromOpportunityAllCompanies(id);
    }

    const auditPatch: Record<string, unknown> = { ...data };
    delete auditPatch.urlSlug;
    let diffEntries = buildChangeEntries(
      before,
      auditPatch,
      OPPORTUNITY_FIELD_LABELS,
      ['urlSlug'],
    );

    if (hasContactLinkUpdate) {
      const raw = dto.contactId;
      const oldPrimary = (primaryLink?.contactId ?? '') as string;
      let newPrimary = oldPrimary;
      if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
        newPrimary = '';
      } else if (typeof raw === 'string') {
        newPrimary = raw.trim();
      }
      if (oldPrimary !== newPrimary) {
        diffEntries = [
          ...diffEntries,
          {
            fieldKey: 'primaryContactId',
            fieldLabel: OPPORTUNITY_FIELD_LABELS.primaryContactId,
            oldValue: oldPrimary,
            newValue: newPrimary,
          },
        ];
      }
    }

    const etapaChanged =
      dto.etapa !== undefined && dto.etapa.trim() !== snapshot.etapa;
    const assigneeChanged =
      dto.assignedTo !== undefined &&
      (dto.assignedTo?.trim() || null) !== (snapshot.assignedTo ?? null);

    let action = 'actualizar';
    let description = 'Oportunidad actualizada.';
    if (etapaChanged) {
      action = 'cambiar_etapa';
      description = `Etapa de la oportunidad: ${snapshot.etapa} → ${dto.etapa!.trim()}`;
    } else if (
      assigneeChanged &&
      dto.title === undefined &&
      dto.amount === undefined &&
      dto.probability === undefined &&
      dto.status === undefined &&
      dto.expectedCloseDate === undefined &&
      dto.priority === undefined &&
      dto.contactId === undefined &&
      !hasCompanyLinkUpdate
    ) {
      action = 'asignar';
      description = 'Asesor de la oportunidad actualizado.';
    } else if (
      dto.contactId !== undefined &&
      hasCompanyLinkUpdate &&
      dto.companyId !== null &&
      typeof dto.companyId === 'string' &&
      dto.companyId.trim() !== '' &&
      dto.contactId !== null &&
      !(typeof dto.contactId === 'string' && dto.contactId.trim() === '')
    ) {
      description = 'Se vincularon contacto y empresa a la oportunidad.';
    } else if (dto.contactId !== undefined) {
      description =
        dto.contactId === null ||
        (typeof dto.contactId === 'string' && dto.contactId.trim() === '')
          ? 'Se desvinculó el contacto principal de la oportunidad.'
          : 'Se actualizó el contacto vinculado a la oportunidad.';
    } else if (
      hasCompanyLinkUpdate &&
      dto.companyId !== null &&
      typeof dto.companyId === 'string' &&
      dto.companyId.trim() !== ''
    ) {
      description = 'Se vinculó una empresa a la oportunidad.';
    }

    const displayTitle =
      typeof data.title === 'string' ? data.title : snapshot.title;

    await this.auditDetail.record(actor, {
      action,
      module: 'oportunidades',
      entityType: 'Oportunidad',
      entityId: id,
      entityName: displayTitle,
      entries: diffEntries,
    });

    await this.activityLogs.record(actor, {
      action,
      module: 'oportunidades',
      entityType: 'Oportunidad',
      entityId: id,
      entityName: displayTitle,
      description,
    });

    let nextStatus: PipelineOpportunityStatus =
      snapshot.status as PipelineOpportunityStatus;
    if (dto.etapa !== undefined) {
      nextStatus = this.statusFromEtapa(dto.etapa.trim());
    } else if (dto.status !== undefined) {
      nextStatus = this.normalizeManualStatus(dto.status);
    }
    const prevWon = snapshot.status === 'ganada';
    const nextWon = nextStatus === 'ganada';
    const assigneeForNotify =
      dto.assignedTo !== undefined
        ? dto.assignedTo?.trim() || null
        : snapshot.assignedTo;
    if (!prevWon && nextWon && assigneeForNotify) {
      const fresh = await this.prisma.opportunity.findUnique({
        where: { id },
        select: { title: true, amount: true },
      });
      if (fresh) {
        await this.notifications.notifyOpportunityWon({
          userId: assigneeForNotify,
          opportunityId: id,
          title: fresh.title,
          amount: fresh.amount,
        });
      }
    }

    return this.findOne(id, scope);
  }

  async unlinkCompanyFromOpportunity(
    opportunityIdOrSlug: string,
    companyIdOrSlug: string,
    actor: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const opportunityId = await this.resolveOpportunityId(opportunityIdOrSlug);
    const oppRow = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { title: true, assignedTo: true },
    });
    if (!oppRow) {
      throw new NotFoundException('Oportunidad no encontrada');
    }

    const companyIdResolved = await this.resolveCompanyId(companyIdOrSlug);
    const companyBasic = await this.prisma.company.findUnique({
      where: { id: companyIdResolved },
      select: { id: true, name: true },
    });
    if (!companyBasic) {
      throw new NotFoundException('Empresa no encontrada');
    }

    if (scope && !scope.unrestricted) {
      const canSeeOpp = oppRow.assignedTo === scope.viewerUserId;
      const companyScoped = await this.prisma.company.findFirst({
        where: mergeCompanyScope({ id: companyIdResolved }, scope),
        select: { id: true },
      });
      if (!canSeeOpp && !companyScoped) {
        throw new NotFoundException('Oportunidad no encontrada');
      }
    }

    const deleted = await this.prisma.companyOpportunity.deleteMany({
      where: {
        companyId: companyBasic.id,
        opportunityId,
      },
    });
    if (deleted.count === 0) {
      throw new BadRequestException(
        'La oportunidad no está vinculada a esta empresa',
      );
    }

    await this.entitySync.propagateFromCompany(companyBasic.id);
    await this.entitySync.propagateFromOpportunityAllCompanies(opportunityId);

    await this.activityLogs.record(actor, {
      action: 'actualizar',
      module: 'empresas',
      entityType: 'Empresa',
      entityId: companyBasic.id,
      entityName: companyBasic.name,
      description: `Oportunidad "${oppRow.title}" desvinculada de la empresa`,
    });
    await this.activityLogs.record(actor, {
      action: 'actualizar',
      module: 'oportunidades',
      entityType: 'Oportunidad',
      entityId: opportunityId,
      entityName: oppRow.title,
      description: `Desvinculada de la empresa "${companyBasic.name}"`,
    });

    const fresh = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: opportunityIncludeDetail,
    });
    if (!fresh) {
      throw new NotFoundException('Oportunidad no encontrada');
    }
    return fresh;
  }

  async remove(
    idOrSlug: string,
    actor: ActivityActor,
    scope?: CrmDataScope,
  ) {
    const id = await this.resolveOpportunityId(idOrSlug);
    const row = await this.prisma.opportunity.findUnique({
      where: { id },
      select: { title: true, assignedTo: true },
    });
    if (!row) {
      throw new NotFoundException('Oportunidad no encontrada');
    }
    if (
      scope &&
      !scope.unrestricted &&
      row.assignedTo !== scope.viewerUserId
    ) {
      throw new NotFoundException('Oportunidad no encontrada');
    }
    const deleted = await this.prisma.opportunity.delete({
      where: { id },
    });
    await this.auditDetail.record(actor, {
      action: 'eliminar',
      module: 'oportunidades',
      entityType: 'Oportunidad',
      entityId: id,
      entityName: row.title,
      entries: [
        {
          fieldKey: '_registro',
          fieldLabel: 'Registro',
          oldValue: row.title,
          newValue: '(eliminado)',
        },
      ],
    });
    await this.activityLogs.record(actor, {
      action: 'eliminar',
      module: 'oportunidades',
      entityType: 'Oportunidad',
      entityId: id,
      entityName: row.title,
      description: `Oportunidad eliminada: ${row.title}`,
      isCritical: true,
    });
    return deleted;
  }
}
