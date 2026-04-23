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

const TASK_KINDS = new Set(['llamada', 'reunion', 'correo', 'whatsapp']);

const activityInclude = {
  user: { select: { id: true, name: true } },
  contacts: { include: { contact: { select: { id: true, name: true } } } },
  companies: { include: { company: { select: { id: true, name: true } } } },
  opportunities: {
    include: {
      opportunity: { select: { id: true, title: true } },
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
  dueDate: true,
  startDate: true,
  startTime: true,
  completedAt: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
  contacts: { include: { contact: { select: { id: true, name: true } } } },
  companies: { include: { company: { select: { id: true, name: true } } } },
  opportunities: {
    include: { opportunity: { select: { id: true, title: true } } },
  },
} as const;

type ActivityRowForHistoryLog = {
  title: string;
  type: string;
  taskKind: string | null;
  contacts: { contact: { id: string } }[];
  companies: { company: { id: string } }[];
  opportunities: { opportunity: { id: string } }[];
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
    const d = new Date(s.trim());
    return Number.isNaN(d.getTime()) ? null : d;
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
    if (
      contactIds.length === 0 &&
      companyIds.length === 0 &&
      opportunityIds.length === 0
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
    await Promise.all(tasks);
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
    const completedAt = this.parseDate(dto.completedAt);
    const status = dto.status?.trim() || 'pendiente';
    const contactId = dto.contactId?.trim();
    const companyId = dto.companyId?.trim();
    const opportunityId = dto.opportunityId?.trim();
    if (!contactId && !companyId && !opportunityId) {
      throw new BadRequestException(
        'Debe vincularse a al menos un contacto, empresa u oportunidad',
      );
    }
    if (contactId) {
      const c = await this.prisma.contact.findUnique({
        where: { id: contactId },
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
    if (companyId) {
      const c = await this.prisma.company.findFirst({
        where: mergeCompanyScope({ id: companyId }, scope),
      });
      if (!c) {
        throw new BadRequestException('La empresa indicada no existe');
      }
    }
    if (opportunityId) {
      const o = await this.prisma.opportunity.findUnique({
        where: { id: opportunityId },
      });
      if (!o) {
        throw new BadRequestException('La oportunidad indicada no existe');
      }
      if (
        scope &&
        !scope.unrestricted &&
        o.assignedTo !== scope.viewerUserId
      ) {
        throw new BadRequestException('La oportunidad indicada no existe');
      }
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          type,
          taskKind,
          title,
          description: dto.description?.trim() ?? '',
          assignedTo,
          status,
          dueDate,
          startDate,
          startTime: dto.startTime?.trim() || null,
          completedAt,
        },
      });
      if (contactId) {
        await tx.contactActivity.create({
          data: { contactId, activityId: activity.id },
        });
      }
      if (companyId) {
        await tx.companyActivity.create({
          data: { companyId, activityId: activity.id },
        });
      }
      if (opportunityId) {
        await tx.opportunityActivity.create({
          data: { opportunityId, activityId: activity.id },
        });
      }
      return tx.activity.findUniqueOrThrow({
        where: { id: activity.id },
        include: activityInclude,
      });
    });
    await this.recordActivityOnLinkedEntities(actor ?? null, 'crear', row);
    return row;
  }

  async findAll(
    opts?: {
      page?: number;
      limit?: number;
      type?: string;
      status?: string;
      assignedTo?: string;
    },
    scope?: CrmDataScope,
  ) {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(5000, Math.max(1, opts?.limit ?? 25));
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityWhereInput = {};
    if (opts?.type?.trim()) where.type = opts.type.trim();
    if (opts?.status?.trim()) where.status = opts.status.trim();
    if (scope && !scope.unrestricted) {
      where.assignedTo = scope.viewerUserId;
    } else if (opts?.assignedTo?.trim()) {
      where.assignedTo = opts.assignedTo.trim();
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
      if (scope && !scope.unrestricted) {
        throw new BadRequestException(
          'No tienes permiso para reasignar esta actividad',
        );
      }
      const a = dto.assignedTo?.trim();
      if (a) {
        const u = await this.prisma.user.findUnique({ where: { id: a } });
        if (!u) throw new BadRequestException('El usuario asignado no existe');
      }
      data.assignedTo = a || undefined;
    }
    if (dto.status !== undefined) {
      const s = dto.status?.trim();
      if (s) data.status = s;
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
    if ('completedAt' in dto && dto.completedAt !== undefined) {
      data.completedAt = this.parseDate(String(dto.completedAt));
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No hay campos para actualizar');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.activity.update({
        where: { id },
        data: data as Prisma.ActivityUpdateInput,
      });
    });

    const row = await this.findOne(id, scope);
    const st = String(row.status ?? '').toLowerCase();
    if (row.completedAt || st === 'completada' || st === 'completado') {
      await this.notifications.removeOverdueNotificationsForActivity(id);
    }

    await this.recordActivityOnLinkedEntities(
      actor ?? null,
      'actualizar',
      row,
    );
    return row;
  }

  async remove(
    id: string,
    scope?: CrmDataScope,
    actor?: ActivityActor,
  ) {
    const row = await this.findOne(id, scope);
    await this.notifications.removeOverdueNotificationsForActivity(id);
    await this.recordActivityOnLinkedEntities(actor ?? null, 'eliminar', row);
    return this.prisma.activity.delete({
      where: { id },
    });
  }
}
