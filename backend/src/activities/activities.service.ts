import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import type { CrmDataScope } from '../auth/crm-data-scope.service';
import { mergeCompanyScope } from '../common/crm-data-scope-where.util';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import type { ActivityActor } from '../activity-logs/activity-logs.types';
import {
  parseDateFilterEndLima,
  parseDateFilterStartLima,
  parseDayStartLima,
} from '../common/crm-timezone.util';
import { loadContactGoalCompanyContext } from './call-goal-context';
import {
  explainCallGoalKind,
  type CallGoalExplanation,
} from './call-goal-kind.util';
import { parseCallResultFromDescription } from './call-result.util';

const TASK_KINDS = new Set(['llamada', 'reunion', 'correo', 'whatsapp']);
const YMD_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const activityInclude = {
  user: { select: { id: true, name: true } },
  contacts: { include: { contact: { select: { id: true, name: true, telefono: true } } } },
  companies: { include: { company: { select: { id: true, name: true } } } },
  opportunities: {
    include: {
      opportunity: { select: { id: true, title: true } },
    },
  },
  clienteEmpresas: {
    include: {
      clienteEmpresa: { select: { id: true, empresa: true } },
    },
  },
  contactosCliente: {
    include: {
      contactoCliente: {
        select: { id: true, nombres: true, apellidos: true },
      },
    },
  },
} as const;

/** Select slim para listado: omite assignedTo (=user.id) */
const activitySelectListSlim = {
  id: true,
  type: true,
  taskKind: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  startDate: true,
  startTime: true,
  completedAt: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
  contacts: { include: { contact: { select: { id: true, name: true, telefono: true } } } },
  companies: { include: { company: { select: { id: true, name: true } } } },
  opportunities: {
    include: { opportunity: { select: { id: true, title: true } } },
  },
  clienteEmpresas: {
    include: { clienteEmpresa: { select: { id: true, empresa: true } } },
  },
  contactosCliente: {
    include: {
      contactoCliente: {
        select: { id: true, nombres: true, apellidos: true },
      },
    },
  },
} as const;

type ActivityRowForHistoryLog = {
  title: string;
  type: string;
  taskKind: string | null;
  contacts: { contact: { id: string } }[];
  companies: { company: { id: string } }[];
  opportunities: { opportunity: { id: string } }[];
  clienteEmpresas: { clienteEmpresa: { id: string } }[];
  contactosCliente: { contactoCliente: { id: string; nombres: string; apellidos: string | null } }[];
};

/** Vínculos de una tarea asignada al asesor: omiten re-validación de cartera al completar. */
type AssignedTaskLinkTrust = {
  clienteEmpresaIds: Set<string>;
  contactoClienteIds: Set<string>;
  contactIds: Set<string>;
  companyIds: Set<string>;
  opportunityIds: Set<string>;
};

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  private parseDate(s: string | null | undefined): Date | null {
    if (!s || typeof s !== 'string') return null;
    const t = s.trim();
    if (YMD_ONLY.test(t)) {
      try {
        return parseDayStartLima(t);
      } catch {
        return null;
      }
    }
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private isCompletedStatus(status: string | null | undefined): boolean {
    const s = (status ?? '').trim().toLowerCase();
    return s === 'completada' || s === 'completado';
  }

  /**
   * Reportes agrupan por `completedAt` (semanas Lima). Si el cliente manda solo
   * YYYY-MM-DD al completar, usamos el instante actual — alineado con historial
   * (ActivityLog.createdAt) y sin leer tablas extra.
   */
  private resolveCompletedAt(
    raw: string | null | undefined,
    status: string,
    now = new Date(),
  ): Date | null {
    if (!this.isCompletedStatus(status)) {
      return raw?.trim() ? this.parseDate(raw) : null;
    }
    if (!raw?.trim()) return now;
    if (YMD_ONLY.test(raw.trim())) return now;
    return this.parseDate(raw);
  }

  private normalizePriority(raw: string | null | undefined): string {
    const p = (raw ?? 'media').trim().toLowerCase();
    if (p === 'alta' || p === 'media' || p === 'baja') return p;
    return 'media';
  }

  private normalizeTaskKind(
    value: string | null | undefined,
  ): 'llamada' | 'reunion' | 'correo' | 'whatsapp' | null {
    if (!value?.trim()) return null;
    const k = value.trim().toLowerCase();
    return TASK_KINDS.has(k)
      ? (k as 'llamada' | 'reunion' | 'correo' | 'whatsapp')
      : null;
  }

  /** Solo las tareas usan taskKind; llamada/reunion/correo/nota son actividades reales. */
  private resolveTypeAndTaskKind(dto: {
    type?: string;
    taskKind?: string;
  }): { type: string; taskKind: string | null } {
    const type = dto.type?.trim() ?? '';
    const taskKind = this.normalizeTaskKind(dto.taskKind);
    if (type === 'tarea') {
      if (!taskKind) {
        throw new BadRequestException(
          'Las tareas requieren taskKind: llamada, reunion, correo o whatsapp',
        );
      }
      return { type, taskKind };
    }
    if (taskKind) {
      throw new BadRequestException(
        'taskKind solo se usa cuando type es tarea',
      );
    }
    return { type, taskKind: null };
  }

  private activityLogKindPhrase(
    type: string,
    taskKind: string | null | undefined,
  ): string {
    const t = (type ?? '').trim().toLowerCase();
    if (t === 'tarea') {
      const k = taskKind ? String(taskKind).trim().toLowerCase() : '';
      return k ? `tarea (${k})` : 'tarea';
    }
    return t ? `actividad (${t})` : 'actividad';
  }

  private historyDescriptionFor(
    action: 'crear' | 'actualizar' | 'eliminar',
    row: ActivityRowForHistoryLog,
  ): string {
    const phrase = this.activityLogKindPhrase(row.type, row.taskKind);
    const title = row.title ?? '';
    if (action === 'crear') {
      return `Se creó una ${phrase}: «${title}».`;
    }
    if (action === 'actualizar') {
      return `Se actualizó la ${phrase}: «${title}».`;
    }
    return `Se eliminó la ${phrase}: «${title}».`;
  }

  private async recordActivityOnLinkedEntities(
    actor: ActivityActor | null,
    action: 'crear' | 'actualizar' | 'eliminar',
    row: ActivityRowForHistoryLog,
  ): Promise<void> {
    const contactIds = [...new Set(row.contacts.map((c) => c.contact.id))];
    const companyIds = [...new Set(row.companies.map((c) => c.company.id))];
    const opportunityIds = [
      ...new Set(row.opportunities.map((o) => o.opportunity.id)),
    ];
    const clienteEmpresaIds = [
      ...new Set(row.clienteEmpresas.map((c) => c.clienteEmpresa.id)),
    ];
    const contactoClienteIds = [
      ...new Set(row.contactosCliente.map((c) => c.contactoCliente.id)),
    ];
    if (
      contactIds.length === 0 &&
      companyIds.length === 0 &&
      opportunityIds.length === 0 &&
      clienteEmpresaIds.length === 0 &&
      contactoClienteIds.length === 0
    ) {
      return;
    }
    const description = this.historyDescriptionFor(action, row);
    const tasks: Promise<void>[] = [];
    for (const entityId of contactIds) {
      tasks.push(
        this.activityLogs.record(actor, {
          action,
          module: 'actividades',
          entityType: 'Contacto',
          entityId,
          entityName: row.title,
          description,
        }),
      );
    }
    for (const entityId of companyIds) {
      tasks.push(
        this.activityLogs.record(actor, {
          action,
          module: 'actividades',
          entityType: 'Empresa',
          entityId,
          entityName: row.title,
          description,
        }),
      );
    }
    for (const entityId of opportunityIds) {
      tasks.push(
        this.activityLogs.record(actor, {
          action,
          module: 'actividades',
          entityType: 'Oportunidad',
          entityId,
          entityName: row.title,
          description,
        }),
      );
    }
    for (const entityId of clienteEmpresaIds) {
      tasks.push(
        this.activityLogs.record(actor, {
          action,
          module: 'actividades',
          entityType: 'ClienteEmpresa',
          entityId,
          entityName: row.title,
          description,
        }),
      );
    }
    for (const link of row.contactosCliente) {
      const cc = link.contactoCliente;
      const name = [cc.nombres, cc.apellidos].filter(Boolean).join(' ').trim() || row.title;
      tasks.push(
        this.activityLogs.record(actor, {
          action,
          module: 'actividades',
          entityType: 'ContactoCliente',
          entityId: cc.id,
          entityName: name,
          description,
        }),
      );
    }
    await Promise.all(tasks);
  }

  private async assertContactoClienteAccess(
    contactoClienteId: string,
    scope?: CrmDataScope,
    options?: { skipScopeCheck?: boolean },
  ) {
    const row = await this.prisma.contactoCliente.findUnique({
      where: { id: contactoClienteId },
    });
    if (!row) {
      throw new BadRequestException('El contacto cliente indicado no existe');
    }
    if (options?.skipScopeCheck) return row;
    if (scope && !scope.unrestricted) {
      if (row.assignedTo !== scope.viewerUserId) {
        throw new BadRequestException('El contacto cliente indicado no existe');
      }
    }
    return row;
  }

  private async assertClienteEmpresaAccess(
    clienteEmpresaId: string,
    scope?: CrmDataScope,
    username?: string,
    options?: { skipScopeCheck?: boolean },
  ) {
    const row = await this.prisma.clienteEmpresa.findUnique({
      where: { id: clienteEmpresaId },
    });
    if (!row) {
      throw new BadRequestException('La empresa cliente indicada no existe');
    }
    if (options?.skipScopeCheck) return row;
    if (scope && !scope.unrestricted) {
      const agente = username?.trim().toLowerCase() ?? '';
      if (!agente || row.asesor !== agente) {
        throw new BadRequestException('La empresa cliente indicada no existe');
      }
    }
    return row;
  }

  private trimLinkId(value: string | null | undefined): string | undefined {
    if (value == null) return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private mergeLinkIds(
    single?: string | null,
    many?: string[] | null,
  ): string[] {
    const ids = new Set<string>();
    for (const raw of many ?? []) {
      const id = this.trimLinkId(raw);
      if (id) ids.add(id);
    }
    const one = this.trimLinkId(single);
    if (one) ids.add(one);
    return [...ids];
  }

  private hasLinkFields(dto: UpdateActivityDto): boolean {
    return (
      'contactId' in dto ||
      'companyId' in dto ||
      'opportunityId' in dto ||
      'clienteEmpresaId' in dto ||
      'contactoClienteId' in dto ||
      'contactIds' in dto ||
      'companyIds' in dto ||
      'opportunityIds' in dto ||
      'clienteEmpresaIds' in dto ||
      'contactoClienteIds' in dto
    );
  }

  private linkIdsAreSubset(requested: string[], allowed: Set<string>): boolean {
    return requested.every((id) => allowed.has(id));
  }

  private collectLinkIdsFromRaw(raw: {
    contactId?: string | null;
    companyId?: string | null;
    opportunityId?: string | null;
    clienteEmpresaId?: string | null;
    contactoClienteId?: string | null;
    contactIds?: string[] | null;
    companyIds?: string[] | null;
    opportunityIds?: string[] | null;
    clienteEmpresaIds?: string[] | null;
    contactoClienteIds?: string[] | null;
  }) {
    return {
      contactIds: this.mergeLinkIds(raw.contactId, raw.contactIds),
      companyIds: this.mergeLinkIds(raw.companyId, raw.companyIds),
      opportunityIds: this.mergeLinkIds(raw.opportunityId, raw.opportunityIds),
      clienteEmpresaIds: this.mergeLinkIds(
        raw.clienteEmpresaId,
        raw.clienteEmpresaIds,
      ),
      contactoClienteIds: this.mergeLinkIds(
        raw.contactoClienteId,
        raw.contactoClienteIds,
      ),
    };
  }

  /**
   * Completar tarea asignada al asesor: hereda vínculos de la tarea sin re-validar agenteSync.
   * Solo aplica si los IDs solicitados son subconjunto de los de la tarea.
   */
  private async resolveLinkTrustFromAssignedTask(
    sourceTaskId: string,
    scope: CrmDataScope,
    raw: {
      contactId?: string | null;
      companyId?: string | null;
      opportunityId?: string | null;
      clienteEmpresaId?: string | null;
      contactoClienteId?: string | null;
      contactIds?: string[] | null;
      companyIds?: string[] | null;
      opportunityIds?: string[] | null;
      clienteEmpresaIds?: string[] | null;
      contactoClienteIds?: string[] | null;
    },
  ): Promise<AssignedTaskLinkTrust | null> {
    const task = await this.prisma.activity.findUnique({
      where: { id: sourceTaskId },
      include: {
        contacts: { select: { contactId: true } },
        companies: { select: { companyId: true } },
        opportunities: { select: { opportunityId: true } },
        clienteEmpresas: { select: { clienteEmpresaId: true } },
        contactosCliente: { select: { contactoClienteId: true } },
      },
    });
    if (!task || task.type !== 'tarea' || task.assignedTo !== scope.viewerUserId) {
      return null;
    }

    const requested = this.collectLinkIdsFromRaw(raw);
    const trust: AssignedTaskLinkTrust = {
      contactIds: new Set(task.contacts.map((c) => c.contactId)),
      companyIds: new Set(task.companies.map((c) => c.companyId)),
      opportunityIds: new Set(task.opportunities.map((o) => o.opportunityId)),
      clienteEmpresaIds: new Set(
        task.clienteEmpresas.map((c) => c.clienteEmpresaId),
      ),
      contactoClienteIds: new Set(
        task.contactosCliente.map((c) => c.contactoClienteId),
      ),
    };

    if (
      !this.linkIdsAreSubset(requested.contactIds, trust.contactIds) ||
      !this.linkIdsAreSubset(requested.companyIds, trust.companyIds) ||
      !this.linkIdsAreSubset(requested.opportunityIds, trust.opportunityIds) ||
      !this.linkIdsAreSubset(requested.clienteEmpresaIds, trust.clienteEmpresaIds) ||
      !this.linkIdsAreSubset(requested.contactoClienteIds, trust.contactoClienteIds)
    ) {
      return null;
    }

    return trust;
  }

  /**
   * Tarea vinculada tras actividad: hereda vínculos de la actividad del asesor sin re-validar agenteSync.
   */
  private async resolveLinkTrustFromAssignedActivity(
    sourceActivityId: string,
    scope: CrmDataScope,
    raw: {
      contactId?: string | null;
      companyId?: string | null;
      opportunityId?: string | null;
      clienteEmpresaId?: string | null;
      contactoClienteId?: string | null;
      contactIds?: string[] | null;
      companyIds?: string[] | null;
      opportunityIds?: string[] | null;
      clienteEmpresaIds?: string[] | null;
      contactoClienteIds?: string[] | null;
    },
  ): Promise<AssignedTaskLinkTrust | null> {
    const activity = await this.prisma.activity.findUnique({
      where: { id: sourceActivityId },
      include: {
        contacts: { select: { contactId: true } },
        companies: { select: { companyId: true } },
        opportunities: { select: { opportunityId: true } },
        clienteEmpresas: { select: { clienteEmpresaId: true } },
        contactosCliente: { select: { contactoClienteId: true } },
      },
    });
    if (!activity || activity.assignedTo !== scope.viewerUserId) {
      return null;
    }

    const requested = this.collectLinkIdsFromRaw(raw);
    const trust: AssignedTaskLinkTrust = {
      contactIds: new Set(activity.contacts.map((c) => c.contactId)),
      companyIds: new Set(activity.companies.map((c) => c.companyId)),
      opportunityIds: new Set(activity.opportunities.map((o) => o.opportunityId)),
      clienteEmpresaIds: new Set(
        activity.clienteEmpresas.map((c) => c.clienteEmpresaId),
      ),
      contactoClienteIds: new Set(
        activity.contactosCliente.map((c) => c.contactoClienteId),
      ),
    };

    if (
      !this.linkIdsAreSubset(requested.contactIds, trust.contactIds) ||
      !this.linkIdsAreSubset(requested.companyIds, trust.companyIds) ||
      !this.linkIdsAreSubset(requested.opportunityIds, trust.opportunityIds) ||
      !this.linkIdsAreSubset(requested.clienteEmpresaIds, trust.clienteEmpresaIds) ||
      !this.linkIdsAreSubset(requested.contactoClienteIds, trust.contactoClienteIds)
    ) {
      return null;
    }

    return trust;
  }

  private async resolveActivityLinks(
    raw: {
      contactId?: string | null;
      companyId?: string | null;
      opportunityId?: string | null;
      clienteEmpresaId?: string | null;
      contactoClienteId?: string | null;
      contactIds?: string[] | null;
      companyIds?: string[] | null;
      opportunityIds?: string[] | null;
      clienteEmpresaIds?: string[] | null;
      contactoClienteIds?: string[] | null;
    },
    scope?: CrmDataScope,
    actor?: ActivityActor,
    options?: { autoLink?: boolean; assignedTaskLinkTrust?: AssignedTaskLinkTrust | null },
  ) {
    const autoLink = options?.autoLink !== false;
    const linkTrust = options?.assignedTaskLinkTrust ?? null;
    let contactIds = this.mergeLinkIds(raw.contactId, raw.contactIds);
    let companyIds = this.mergeLinkIds(raw.companyId, raw.companyIds);
    let opportunityIds = this.mergeLinkIds(raw.opportunityId, raw.opportunityIds);
    const clienteEmpresaIds = this.mergeLinkIds(
      raw.clienteEmpresaId,
      raw.clienteEmpresaIds,
    );
    const contactoClienteIds = this.mergeLinkIds(
      raw.contactoClienteId,
      raw.contactoClienteIds,
    );

    const hasExplicitArrays =
      (raw.contactIds?.length ?? 0) > 0 ||
      (raw.companyIds?.length ?? 0) > 0 ||
      (raw.opportunityIds?.length ?? 0) > 0 ||
      (raw.clienteEmpresaIds?.length ?? 0) > 0 ||
      (raw.contactoClienteIds?.length ?? 0) > 0;

    if (autoLink && !hasExplicitArrays) {
      if (opportunityIds.length === 1 && companyIds.length === 0) {
        const co = await this.prisma.companyOpportunity.findFirst({
          where: { opportunityId: opportunityIds[0] },
          select: { companyId: true },
        });
        if (co) companyIds = [co.companyId];
      }
      if (opportunityIds.length === 1 && contactIds.length === 0) {
        const co = await this.prisma.contactOpportunity.findFirst({
          where: { opportunityId: opportunityIds[0] },
          select: { contactId: true },
        });
        if (co) contactIds = [co.contactId];
      }
      if (companyIds.length === 1 && opportunityIds.length === 0) {
        const co = await this.prisma.companyOpportunity.findFirst({
          where: { companyId: companyIds[0] },
          orderBy: { opportunity: { createdAt: 'desc' } },
          select: { opportunityId: true },
        });
        if (co) opportunityIds = [co.opportunityId];
      }
    }

    if (
      contactIds.length === 0 &&
      companyIds.length === 0 &&
      opportunityIds.length === 0 &&
      clienteEmpresaIds.length === 0 &&
      contactoClienteIds.length === 0
    ) {
      throw new BadRequestException(
        'Debe vincularse a al menos un contacto, empresa, oportunidad, empresa cliente o contacto cliente',
      );
    }

    for (const contactId of contactIds) {
      const c = await this.prisma.contact.findUnique({ where: { id: contactId } });
      if (!c) {
        throw new BadRequestException('El contacto indicado no existe');
      }
      if (
        scope &&
        !scope.unrestricted &&
        !linkTrust?.contactIds.has(contactId) &&
        c.assignedTo !== scope.viewerUserId
      ) {
        throw new BadRequestException('El contacto indicado no existe');
      }
    }
    for (const companyId of companyIds) {
      const c = linkTrust?.companyIds.has(companyId)
        ? await this.prisma.company.findUnique({ where: { id: companyId } })
        : await this.prisma.company.findFirst({
            where: mergeCompanyScope({ id: companyId }, scope),
          });
      if (!c) {
        throw new BadRequestException('La empresa indicada no existe');
      }
    }
    for (const opportunityId of opportunityIds) {
      const o = await this.prisma.opportunity.findUnique({
        where: { id: opportunityId },
      });
      if (!o) {
        throw new BadRequestException('La oportunidad indicada no existe');
      }
      if (
        scope &&
        !scope.unrestricted &&
        !linkTrust?.opportunityIds.has(opportunityId) &&
        o.assignedTo !== scope.viewerUserId
      ) {
        throw new BadRequestException('La oportunidad indicada no existe');
      }
    }
    for (const clienteEmpresaId of clienteEmpresaIds) {
      await this.assertClienteEmpresaAccess(
        clienteEmpresaId,
        scope,
        actor?.username,
        { skipScopeCheck: linkTrust?.clienteEmpresaIds.has(clienteEmpresaId) },
      );
    }
    for (const contactoClienteId of contactoClienteIds) {
      await this.assertContactoClienteAccess(contactoClienteId, scope, {
        skipScopeCheck: linkTrust?.contactoClienteIds.has(contactoClienteId),
      });
    }

    return { contactIds, companyIds, opportunityIds, clienteEmpresaIds, contactoClienteIds };
  }

  private async syncActivityLinks(
    tx: Prisma.TransactionClient,
    activityId: string,
    links: Awaited<ReturnType<ActivitiesService['resolveActivityLinks']>>,
  ) {
    await tx.contactActivity.deleteMany({ where: { activityId } });
    await tx.companyActivity.deleteMany({ where: { activityId } });
    await tx.opportunityActivity.deleteMany({ where: { activityId } });
    await tx.clienteEmpresaActivity.deleteMany({ where: { activityId } });
    await tx.contactoClienteActivity.deleteMany({ where: { activityId } });

    for (const contactId of links.contactIds) {
      await tx.contactActivity.create({ data: { contactId, activityId } });
    }
    for (const companyId of links.companyIds) {
      await tx.companyActivity.create({ data: { companyId, activityId } });
    }
    for (const opportunityId of links.opportunityIds) {
      await tx.opportunityActivity.create({
        data: { opportunityId, activityId },
      });
    }
    for (const clienteEmpresaId of links.clienteEmpresaIds) {
      await tx.clienteEmpresaActivity.create({
        data: { clienteEmpresaId, activityId },
      });
    }
    for (const contactoClienteId of links.contactoClienteIds) {
      await tx.contactoClienteActivity.create({
        data: { contactoClienteId, activityId },
      });
    }
  }

  async create(
    dto: CreateActivityDto,
    scope?: CrmDataScope,
    actor?: ActivityActor,
  ) {
    const { type, taskKind } = this.resolveTypeAndTaskKind(dto);
    if (!type) {
      throw new BadRequestException('El tipo es obligatorio');
    }
    const title = dto.title?.trim();
    if (!title) {
      throw new BadRequestException('El título es obligatorio');
    }
    let assignedTo = dto.assignedTo?.trim();
    if (scope && !scope.unrestricted) {
      assignedTo = scope.viewerUserId;
    }
    if (!assignedTo) {
      throw new BadRequestException('El asignado es obligatorio');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: assignedTo },
    });
    if (!user) {
      throw new BadRequestException('El usuario asignado no existe');
    }
    const dueDate = this.parseDate(dto.dueDate);
    if (!dueDate) {
      throw new BadRequestException('La fecha de vencimiento es obligatoria');
    }
    const startDate = this.parseDate(dto.startDate);
    const status = dto.status?.trim() || 'pendiente';
    const completedAt = this.resolveCompletedAt(dto.completedAt, status);
    const priority = this.normalizePriority(dto.priority);

    const linkRaw = {
      contactId: dto.contactId,
      companyId: dto.companyId,
      opportunityId: dto.opportunityId,
      clienteEmpresaId: dto.clienteEmpresaId,
      contactoClienteId: dto.contactoClienteId,
      contactIds: dto.contactIds,
      companyIds: dto.companyIds,
      opportunityIds: dto.opportunityIds,
      clienteEmpresaIds: dto.clienteEmpresaIds,
      contactoClienteIds: dto.contactoClienteIds,
    };

    let assignedTaskLinkTrust: AssignedTaskLinkTrust | null = null;
    const sourceTaskId = dto.sourceTaskId?.trim();
    const sourceActivityId = dto.sourceActivityId?.trim();
    if (scope && !scope.unrestricted) {
      if (sourceTaskId) {
        assignedTaskLinkTrust = await this.resolveLinkTrustFromAssignedTask(
          sourceTaskId,
          scope,
          linkRaw,
        );
      }
      if (!assignedTaskLinkTrust && sourceActivityId) {
        assignedTaskLinkTrust = await this.resolveLinkTrustFromAssignedActivity(
          sourceActivityId,
          scope,
          linkRaw,
        );
      }
    }

    const links = await this.resolveActivityLinks(
      linkRaw,
      scope,
      actor,
      { autoLink: true, assignedTaskLinkTrust },
    );

    const row = await this.prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          type,
          taskKind,
          title,
          description: dto.description?.trim() ?? '',
          assignedTo,
          status,
          priority,
          dueDate,
          startDate,
          startTime: dto.startTime?.trim() || null,
          completedAt,
        },
      });
      await this.syncActivityLinks(tx, activity.id, links);
      return tx.activity.findUniqueOrThrow({
        where: { id: activity.id },
        include: activityInclude,
      });
    });
    void this.recordActivityOnLinkedEntities(actor ?? null, 'crear', row).catch(
      () => undefined,
    );
    const callGoal = await this.explainCreatedCallGoal(row).catch(() => null);
    return callGoal ? { ...row, callGoal } : row;
  }

  private async explainCreatedCallGoal(row: {
    type: string;
    status: string;
    description: string | null;
    completedAt: Date | null;
    companies: { company: { id: string } | null }[];
  }): Promise<CallGoalExplanation | null> {
    if (row.type.toLowerCase().trim() !== 'llamada') return null;
    if (row.status.toLowerCase().trim() !== 'completada') return null;
    const completedAt = row.completedAt ?? new Date();
    const companyIds = row.companies
      .map((link) => link.company?.id)
      .filter((id): id is string => Boolean(id));
    const { getProb, byCompanyId } = await loadContactGoalCompanyContext(
      this.prisma,
      companyIds,
      completedAt,
    );
    const companies = companyIds
      .map((id) => byCompanyId.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    return explainCallGoalKind(
      completedAt,
      parseCallResultFromDescription(row.description),
      companies,
      getProb,
    );
  }

  async findAll(
    opts?: {
      page?: number;
      limit?: number;
      type?: string;
      status?: string;
      assignedTo?: string;
      from?: string;
      to?: string;
      linkedToClienteEmpresa?: string;
      linkedToClienteCartera?: boolean;
      linkedToCompanyId?: string;
      linkedToContactId?: string;
      linkedToOpportunityId?: string;
      linkedToContactoCliente?: string;
      excludeType?: string;
    },
    scope?: CrmDataScope,
  ) {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(5000, Math.max(1, opts?.limit ?? 25));
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityWhereInput = {};
    if (opts?.type?.trim()) where.type = opts.type.trim();
    else if (opts?.excludeType?.trim()) where.type = { not: opts.excludeType.trim() };
    if (opts?.status?.trim()) where.status = opts.status.trim();
    if (opts?.from?.trim() || opts?.to?.trim()) {
      where.completedAt = {};
      if (opts.from?.trim()) {
        where.completedAt.gte =
          parseDateFilterStartLima(opts.from.trim()) ?? undefined;
      }
      if (opts.to?.trim()) {
        where.completedAt.lte =
          parseDateFilterEndLima(opts.to.trim()) ?? undefined;
      }
    }
    if (scope && !scope.unrestricted) {
      where.assignedTo = scope.viewerUserId;
    } else if (opts?.assignedTo?.trim()) {
      where.assignedTo = opts.assignedTo.trim();
    }
    const linkFilters: Prisma.ActivityWhereInput[] = [];
    const companyId = opts?.linkedToCompanyId?.trim();
    if (companyId) {
      linkFilters.push({
        OR: [
          { companies: { some: { companyId } } },
          {
            contacts: {
              some: { contact: { companies: { some: { companyId } } } },
            },
          },
        ],
      });
    }
    const contactId = opts?.linkedToContactId?.trim();
    if (contactId) {
      linkFilters.push({ contacts: { some: { contactId } } });
    }
    const opportunityId = opts?.linkedToOpportunityId?.trim();
    if (opportunityId) {
      linkFilters.push({ opportunities: { some: { opportunityId } } });
    }
    if (opts?.linkedToClienteEmpresa?.trim()) {
      linkFilters.push({
        clienteEmpresas: {
          some: { clienteEmpresaId: opts.linkedToClienteEmpresa.trim() },
        },
      });
    }
    if (opts?.linkedToContactoCliente?.trim()) {
      linkFilters.push({
        contactosCliente: {
          some: { contactoClienteId: opts.linkedToContactoCliente.trim() },
        },
      });
    }
    if (opts?.linkedToClienteCartera) {
      linkFilters.push({
        OR: [
          { clienteEmpresas: { some: {} } },
          { contactosCliente: { some: {} } },
        ],
      });
    }
    if (linkFilters.length === 1) {
      Object.assign(where, linkFilters[0]);
    } else if (linkFilters.length > 1) {
      where.AND = linkFilters;
    }

    const [rows, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: activitySelectListSlim,
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, scope?: CrmDataScope) {
    const row = await this.prisma.activity.findUnique({
      where: { id },
      include: activityInclude,
    });
    if (!row) {
      throw new NotFoundException('Actividad no encontrada');
    }
    if (
      scope &&
      !scope.unrestricted &&
      row.assignedTo !== scope.viewerUserId
    ) {
      throw new NotFoundException('Actividad no encontrada');
    }
    return row;
  }

  async update(
    id: string,
    dto: UpdateActivityDto,
    scope?: CrmDataScope,
    actor?: ActivityActor,
  ) {
    await this.findOne(id, scope);
    const existingRow = await this.prisma.activity.findUnique({
      where: { id },
    });
    if (!existingRow) {
      throw new NotFoundException('Actividad no encontrada');
    }

    const data: Record<string, unknown> = {};
    if (dto.type !== undefined || dto.taskKind !== undefined) {
      let nextType =
        dto.type !== undefined ? dto.type.trim() : existingRow.type;
      let nextTk =
        dto.taskKind !== undefined
          ? this.normalizeTaskKind(dto.taskKind)
          : this.normalizeTaskKind(existingRow.taskKind);

      if (nextType === 'tarea') {
        if (!nextTk) {
          throw new BadRequestException(
            'Las tareas requieren taskKind: llamada, reunion, correo o whatsapp',
          );
        }
        data.type = 'tarea';
        data.taskKind = nextTk;
      } else {
        data.type = nextType;
        data.taskKind = null;
      }
    }
    if (dto.title !== undefined) {
      const t = dto.title?.trim();
      if (!t) throw new BadRequestException('El título no puede estar vacío');
      data.title = t;
    }
    if (dto.description !== undefined) {
      data.description = dto.description?.trim() ?? '';
    }
    if (dto.assignedTo !== undefined) {
      const a = dto.assignedTo?.trim() || '';
      const current = existingRow.assignedTo ?? '';
      if (a !== current) {
        if (scope && !scope.unrestricted) {
          throw new BadRequestException(
            'No tienes permiso para reasignar esta actividad',
          );
        }
        if (a) {
          const u = await this.prisma.user.findUnique({ where: { id: a } });
          if (!u) throw new BadRequestException('El usuario asignado no existe');
        }
        data.assignedTo = a || undefined;
      }
    }
    if (dto.status !== undefined) {
      const s = dto.status?.trim();
      if (s) data.status = s;
    }
    if (dto.priority !== undefined) {
      data.priority = this.normalizePriority(dto.priority);
    }
    if (dto.dueDate !== undefined) {
      const d = this.parseDate(dto.dueDate);
      if (d) data.dueDate = d;
    }
    if (dto.startDate !== undefined) {
      data.startDate = this.parseDate(dto.startDate);
    }
    if (dto.startTime !== undefined) {
      data.startTime = dto.startTime?.trim() || null;
    }
    const nextStatus =
      dto.status !== undefined
        ? String(data.status ?? dto.status).trim()
        : existingRow.status;

    if ('completedAt' in dto && dto.completedAt !== undefined) {
      const raw = String(dto.completedAt);
      if (!raw.trim()) {
        data.completedAt = null;
      } else {
        data.completedAt = this.resolveCompletedAt(raw, nextStatus);
      }
    } else if (
      dto.status !== undefined &&
      this.isCompletedStatus(nextStatus) &&
      !this.isCompletedStatus(existingRow.status) &&
      !existingRow.completedAt
    ) {
      data.completedAt = new Date();
    }

    const linkUpdate = this.hasLinkFields(dto);
    let resolvedLinks: Awaited<
      ReturnType<ActivitiesService['resolveActivityLinks']>
    > | null = null;
    if (linkUpdate) {
      resolvedLinks = await this.resolveActivityLinks(
        {
          contactId: dto.contactId,
          companyId: dto.companyId,
          opportunityId: dto.opportunityId,
          clienteEmpresaId: dto.clienteEmpresaId,
          contactoClienteId: dto.contactoClienteId,
          contactIds: dto.contactIds,
          companyIds: dto.companyIds,
          opportunityIds: dto.opportunityIds,
          clienteEmpresaIds: dto.clienteEmpresaIds,
          contactoClienteIds: dto.contactoClienteIds,
        },
        scope,
        actor,
        { autoLink: false },
      );
    }

    if (Object.keys(data).length === 0 && !linkUpdate) {
      throw new BadRequestException('No hay campos para actualizar');
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.activity.update({
          where: { id },
          data: data as Prisma.ActivityUpdateInput,
        });
      }
      if (linkUpdate && resolvedLinks) {
        await this.syncActivityLinks(tx, id, resolvedLinks);
      }
    });

    const row = await this.findOne(id, scope);
    const st = String(row.status ?? '').toLowerCase();
    if (row.completedAt || st === 'completada' || st === 'completado') {
      await this.notifications.removeOverdueNotificationsForActivity(id);
    }

    void this.recordActivityOnLinkedEntities(
      actor ?? null,
      'actualizar',
      row,
    ).catch(() => undefined);
    return row;
  }

  async remove(
    id: string,
    scope?: CrmDataScope,
    actor?: ActivityActor,
  ) {
    const row = await this.findOne(id, scope);
    await this.notifications.removeOverdueNotificationsForActivity(id);
    void this.recordActivityOnLinkedEntities(actor ?? null, 'eliminar', row).catch(
      () => undefined,
    );
    return this.prisma.activity.delete({
      where: { id },
    });
  }
}
