import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { CrmDataScope } from '../auth/crm-data-scope.service';

const MAX_RANGE_DAYS = 366;

function parseDayStart(isoDate: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new BadRequestException('from/to debe ser YYYY-MM-DD');
  }
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function parseDayEnd(isoDate: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new BadRequestException('from/to debe ser YYYY-MM-DD');
  }
  return new Date(`${isoDate}T23:59:59.999Z`);
}

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabelEs(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
  ];
  return `${months[(m ?? 1) - 1]} ${y}`;
}

function eachMonthBetween(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cur <= end) {
    keys.push(monthKey(cur));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return keys;
}

function startOfUtcWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfUtcWeekSunday(d: Date): Date {
  const s = startOfUtcWeekMonday(d);
  const e = new Date(s);
  e.setUTCDate(e.getUTCDate() + 7);
  e.setUTCMilliseconds(-1);
  return e;
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function endOfUtcMonth(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return x;
}

/** Seguimiento operativo: solo filas de tarea (modelo Activity con type=tarea + taskKind). */
const TASK_ACTIVITY_FILTER = { type: 'tarea' } as const;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveRange(fromStr?: string, toStr?: string): { from: Date; to: Date } {
    const to = toStr ? parseDayEnd(toStr) : new Date();
    const from = fromStr
      ? parseDayStart(fromStr)
      : new Date(to.getTime() - 30 * 86400000);
    if (from > to) {
      throw new BadRequestException('La fecha inicial no puede ser posterior a la final');
    }
    const days = (to.getTime() - from.getTime()) / 86400000;
    if (days > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `El rango máximo es ${MAX_RANGE_DAYS} días`,
      );
    }
    return { from, to };
  }

  private contactWhere(
    from: Date,
    to: Date,
    advisorId?: string,
    sourceSlug?: string,
  ): Prisma.ContactWhereInput {
    const w: Prisma.ContactWhereInput = {
      createdAt: { gte: from, lte: to },
    };
    if (advisorId?.trim()) {
      w.assignedTo = advisorId.trim();
    }
    if (sourceSlug && sourceSlug !== 'all') {
      w.fuente = sourceSlug.trim();
    }
    return w;
  }

  private opportunityWhereOpen(
    advisorId?: string,
  ): Prisma.OpportunityWhereInput {
    const w: Prisma.OpportunityWhereInput = { status: 'abierta' };
    if (advisorId?.trim()) {
      w.assignedTo = advisorId.trim();
    }
    return w;
  }

  private opportunityWhereWonInRange(
    from: Date,
    to: Date,
    advisorId?: string,
  ): Prisma.OpportunityWhereInput {
    const w: Prisma.OpportunityWhereInput = {
      status: 'ganada',
      updatedAt: { gte: from, lte: to },
    };
    if (advisorId?.trim()) {
      w.assignedTo = advisorId.trim();
    }
    return w;
  }

  /** Resumen principal: dashboard y reportes (misma fuente de datos). */
  async getSummary(opts: {
    from?: string;
    to?: string;
    advisorId?: string;
    source?: string;
    crmScope: CrmDataScope;
  }) {
    const { from, to } = this.resolveRange(opts.from, opts.to);
    const advisorId = opts.crmScope.unrestricted
      ? opts.advisorId?.trim() || undefined
      : opts.crmScope.viewerUserId;
    const source = opts.source?.trim() || undefined;

    const prevLen = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - prevLen);
    const prevTo = new Date(from.getTime() - 1);

    const cw = this.contactWhere(from, to, advisorId, source);
    const pw = this.contactWhere(prevFrom, prevTo, advisorId, source);

    const [
      totalContacts,
      totalContactsPrev,
      newContactsInRange,
      activeOpportunities,
      closedAgg,
      closedAggPrev,
      pipelineAgg,
      pendingActivitiesCount,
      overdueActivitiesCount,
      activitiesCompletedCount,
      sourceGroups,
      funnelGroups,
      userRows,
    ] = await Promise.all([
      this.prisma.contact.count({ where: cw }),
      this.prisma.contact.count({ where: pw }),
      this.prisma.contact.count({ where: cw }),
      this.prisma.opportunity.count({
        where: this.opportunityWhereOpen(advisorId),
      }),
      this.prisma.opportunity.aggregate({
        where: this.opportunityWhereWonInRange(from, to, advisorId),
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.opportunity.aggregate({
        where: this.opportunityWhereWonInRange(prevFrom, prevTo, advisorId),
        _sum: { amount: true },
      }),
      this.prisma.opportunity.aggregate({
        where: this.opportunityWhereOpen(advisorId),
        _sum: { amount: true },
      }),
      this.prisma.activity.count({
        where: {
          ...TASK_ACTIVITY_FILTER,
          status: 'pendiente',
          ...(advisorId ? { assignedTo: advisorId } : {}),
        },
      }),
      this.prisma.activity.count({
        where: {
          ...TASK_ACTIVITY_FILTER,
          status: 'pendiente',
          dueDate: { lt: new Date() },
          ...(advisorId ? { assignedTo: advisorId } : {}),
        },
      }),
      this.prisma.activity.count({
        where: {
          ...TASK_ACTIVITY_FILTER,
          completedAt: { gte: from, lte: to },
          ...(advisorId ? { assignedTo: advisorId } : {}),
        },
      }),
      this.prisma.contact.groupBy({
        by: ['fuente'],
        where: cw,
        _count: { id: true },
      }),
      this.prisma.contact.groupBy({
        by: ['etapa'],
        where: advisorId ? { assignedTo: advisorId } : {},
        _count: { id: true },
      }),
      opts.crmScope.unrestricted
        ? this.prisma.user.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
            take: 200,
          })
        : this.prisma.user.findMany({
            where: { id: opts.crmScope.viewerUserId },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
            take: 1,
          }),
    ]);

    const closedSalesAmount = closedAgg._sum.amount ?? 0;
    const closedSalesPrev = closedAggPrev._sum.amount ?? 0;
    const pipelineValue = pipelineAgg._sum.amount ?? 0;

    /** Conversión aproximada: oportunidades ganadas / contactos creados en el periodo */
    const conversionPct =
      totalContacts > 0
        ? Math.round(((closedAgg._count ?? 0) / totalContacts) * 1000) / 10
        : 0;

    const pctChange = (cur: number, prev: number): string => {
      if (prev <= 0) return cur > 0 ? '+100%' : '0%';
      const p = Math.round(((cur - prev) / prev) * 1000) / 10;
      return `${p >= 0 ? '+' : ''}${p}%`;
    };

    const months = eachMonthBetween(from, to);

    const monthStartDates = months.map((ym) => {
      const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
      return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    });

    /** Sin asesor: meta equipo por mes. Con asesor: solo filas CrmUserMonthlySalesTarget (mes sin fila → 0). */
    const metaByYm = new Map<string, number>();
    const advisorMetaByYm = new Map<string, number>();
    if (advisorId) {
      const userMonthRows =
        monthStartDates.length > 0
          ? await this.prisma.crmUserMonthlySalesTarget.findMany({
              where: {
                userId: advisorId,
                periodStart: { in: monthStartDates },
              },
              select: { periodStart: true, amount: true },
            })
          : [];
      for (const row of userMonthRows) {
        advisorMetaByYm.set(monthKey(row.periodStart), row.amount);
      }
    } else if (monthStartDates.length > 0) {
      const monthlyTargetRows = await this.prisma.crmMonthlySalesTarget.findMany({
        where: {
          organizationId: 'default',
          periodStart: { in: monthStartDates },
        },
        select: { periodStart: true, amount: true },
      });
      for (const row of monthlyTargetRows) {
        metaByYm.set(monthKey(row.periodStart), row.amount);
      }
    }

    const salesByMonth = await Promise.all(
      months.map(async (ym) => {
        const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
        const mStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
        const mEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
        const agg = await this.prisma.opportunity.aggregate({
          where: this.opportunityWhereWonInRange(
            mStart > from ? mStart : from,
            mEnd < to ? mEnd : to,
            advisorId,
          ),
          _sum: { amount: true },
        });
        const meta = advisorId
          ? (advisorMetaByYm.get(ym) ?? 0)
          : (metaByYm.get(ym) ?? 0);
        return {
          name: monthLabelEs(ym),
          ventas: agg._sum.amount ?? 0,
          meta,
        };
      }),
    );

    const contactsBySource = sourceGroups
      .map((g) => ({
        name: g.fuente,
        value: g._count.id,
      }))
      .sort((a, b) => b.value - a.value);

    const funnelByStage = funnelGroups
      .map((g) => ({
        name: g.etapa,
        value: g._count.id,
      }))
      .sort((a, b) => b.value - a.value);

    const contactByAdvisor = await this.prisma.contact.groupBy({
      by: ['assignedTo'],
      where: {
        ...cw,
        assignedTo: { not: null },
      },
      _count: { id: true },
    });
    const wonByAdvisor = await this.prisma.opportunity.groupBy({
      by: ['assignedTo'],
      where: this.opportunityWhereWonInRange(from, to, advisorId),
      _sum: { amount: true },
    });
    const contactMap = new Map(
      contactByAdvisor
        .filter((x) => x.assignedTo)
        .map((x) => [x.assignedTo!, x._count.id]),
    );
    const wonMap = new Map(
      wonByAdvisor
        .filter((x) => x.assignedTo)
        .map((x) => [x.assignedTo!, x._sum.amount ?? 0]),
    );
    const idToName = new Map(userRows.map((u) => [u.id, u.name] as const));
    const advisorIds = new Set<string>();
    for (const k of contactMap.keys()) advisorIds.add(k);
    for (const k of wonMap.keys()) if (k) advisorIds.add(k!);

    const performanceByAdvisor = [...advisorIds]
      .map((id) => ({
        name: idToName.get(id) ?? id.slice(0, 8),
        leads: contactMap.get(id) ?? 0,
        ventas: wonMap.get(id) ?? 0,
      }))
      .filter((r) => r.leads > 0 || r.ventas > 0)
      .sort((a, b) => b.ventas - a.ventas)
      .slice(0, 20);

    const pendingActivities = await this.prisma.activity.findMany({
      where: {
        ...TASK_ACTIVITY_FILTER,
        status: 'pendiente',
        ...(advisorId ? { assignedTo: advisorId } : {}),
      },
      orderBy: { dueDate: 'asc' },
      take: 15,
      include: {
        contacts: {
          take: 1,
          include: { contact: { select: { name: true } } },
        },
      },
    });

    const pendingActivitiesDto = pendingActivities.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      taskKind: a.taskKind,
      status:
        a.dueDate < new Date() && a.status === 'pendiente' ? 'vencida' : a.status,
      dueDate: a.dueDate.toISOString(),
      contactName: a.contacts[0]?.contact?.name ?? '—',
    }));

    /** Serie mensual: contactos creados por mes en el rango */
    const contactsByMonthMap = new Map<string, { leads: number; nuevos: number }>();
    for (const ym of months) {
      contactsByMonthMap.set(ym, { leads: 0, nuevos: 0 });
    }
    const contactsInRange = await this.prisma.contact.findMany({
      where: cw,
      select: { createdAt: true },
    });
    for (const c of contactsInRange) {
      const key = monthKey(c.createdAt);
      const row = contactsByMonthMap.get(key);
      if (row) {
        row.leads += 1;
        row.nuevos += 1;
      }
    }
    const contactsByPeriod = months.map((ym) => ({
      name: monthLabelEs(ym),
      leads: contactsByMonthMap.get(ym)?.leads ?? 0,
      nuevos: contactsByMonthMap.get(ym)?.nuevos ?? 0,
    }));

    /** Conversión por mes (oportunidades ganadas en mes / contactos creados en mes) */
    const conversionByMonth = await Promise.all(
      months.map(async (ym) => {
        const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
        const mStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
        const mEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
        const cFrom = mStart > from ? mStart : from;
        const cTo = mEnd < to ? mEnd : to;
        const [cc, wo] = await Promise.all([
          this.prisma.contact.count({
            where: this.contactWhere(cFrom, cTo, advisorId, source),
          }),
          this.prisma.opportunity.count({
            where: this.opportunityWhereWonInRange(cFrom, cTo, advisorId),
          }),
        ]);
        const tasa = cc > 0 ? Math.round((wo / cc) * 1000) / 10 : 0;
        return { name: monthLabelEs(ym), tasa };
      }),
    );

    /** Actividades por tipo y mes (completadas) */
    const activitiesByTypeMonth: Record<
      string,
      { llamadas: number; reuniones: number; correos: number }
    > = {};
    for (const ym of months) {
      activitiesByTypeMonth[ym] = { llamadas: 0, reuniones: 0, correos: 0 };
    }
    const actsDone = await this.prisma.activity.findMany({
      where: {
        completedAt: { gte: from, lte: to },
        ...(advisorId ? { assignedTo: advisorId } : {}),
      },
      select: { completedAt: true, type: true },
    });
    for (const a of actsDone) {
      if (!a.completedAt) continue;
      const key = monthKey(a.completedAt);
      if (!activitiesByTypeMonth[key]) continue;
      const t = a.type?.toLowerCase() ?? '';
      if (t === 'llamada') activitiesByTypeMonth[key].llamadas += 1;
      else if (t === 'reunion' || t === 'reunión') {
        activitiesByTypeMonth[key].reuniones += 1;
      } else if (t === 'correo') activitiesByTypeMonth[key].correos += 1;
    }
    const activitiesByTypeData = months.map((ym) => ({
      name: monthLabelEs(ym),
      ...activitiesByTypeMonth[ym],
    }));

    /** Oportunidades abiertas por etapa (conteo + suma de montos) */
    const oppsByStage = await this.prisma.opportunity.groupBy({
      by: ['etapa'],
      where: {
        status: 'abierta',
        ...(advisorId ? { assignedTo: advisorId } : {}),
      },
      _count: { id: true },
      _sum: { amount: true },
    });
    const opportunitiesByStageData = oppsByStage.map((g) => ({
      name: g.etapa,
      count: g._count.id,
      value: g._sum.amount ?? 0,
    }));

    const followUpsByMonth = await Promise.all(
      months.map(async (ym) => {
        const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
        const mStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
        const mEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
        const cFrom = mStart > from ? mStart : from;
        const cTo = mEnd < to ? mEnd : to;
        const adv = advisorId ? { assignedTo: advisorId } : {};
        const [completados, pendientes] = await Promise.all([
          this.prisma.activity.count({
            where: {
              ...TASK_ACTIVITY_FILTER,
              completedAt: { gte: cFrom, lte: cTo },
              ...adv,
            },
          }),
          this.prisma.activity.count({
            where: {
              ...TASK_ACTIVITY_FILTER,
              status: 'pendiente',
              dueDate: { gte: cFrom, lte: cTo },
              ...adv,
            },
          }),
        ]);
        return {
          name: monthLabelEs(ym),
          completados,
          pendientes,
        };
      }),
    );

    return {
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      kpis: {
        totalContacts,
        totalContactsPrev,
        newContactsInRange,
        activeOpportunities,
        closedSalesAmount,
        closedSalesPrev,
        conversionPct,
        pendingActivities: pendingActivitiesCount,
        overdueFollowUps: overdueActivitiesCount,
        pipelineValue,
        activitiesCompleted: activitiesCompletedCount,
        changes: {
          contacts: pctChange(totalContacts, totalContactsPrev),
          sales: pctChange(closedSalesAmount, closedSalesPrev),
        },
      },
      salesByMonth,
      contactsBySource,
      funnelByStage,
      performanceByAdvisor,
      pendingActivities: pendingActivitiesDto,
      contactsByPeriod,
      conversionByMonth,
      activitiesByTypeData,
      opportunitiesByStageData,
      followUpsByMonth,
    };
  }

  /** Montos cerrados (ganadas) para metas: semana ISO actual y mes calendario UTC. */
  async getGoalProgress(
    userId: string,
    advisorFilter: string | undefined,
    crmScope: CrmDataScope,
  ) {
    const now = new Date();
    const weekStart = startOfUtcWeekMonday(now);
    const weekEnd = endOfUtcWeekSunday(now);
    const monthStart = startOfUtcMonth(now);
    const monthEnd = endOfUtcMonth(now);

    const restrictTeam = !crmScope.unrestricted;
    const targetUserId = restrictTeam
      ? userId
      : advisorFilter?.trim() || userId;

    const [teamWeek, teamMonth, myWeek, myMonth] = await Promise.all([
      this.prisma.opportunity.aggregate({
        where: {
          status: 'ganada',
          updatedAt: { gte: weekStart, lte: weekEnd },
          ...(restrictTeam ? { assignedTo: userId } : {}),
        },
        _sum: { amount: true },
      }),
      this.prisma.opportunity.aggregate({
        where: {
          status: 'ganada',
          updatedAt: { gte: monthStart, lte: monthEnd },
          ...(restrictTeam ? { assignedTo: userId } : {}),
        },
        _sum: { amount: true },
      }),
      this.prisma.opportunity.aggregate({
        where: {
          status: 'ganada',
          updatedAt: { gte: weekStart, lte: weekEnd },
          assignedTo: targetUserId,
        },
        _sum: { amount: true },
      }),
      this.prisma.opportunity.aggregate({
        where: {
          status: 'ganada',
          updatedAt: { gte: monthStart, lte: monthEnd },
          assignedTo: targetUserId,
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString(),
      teamWeeklyClosed: teamWeek._sum.amount ?? 0,
      teamMonthlyClosed: teamMonth._sum.amount ?? 0,
      myWeeklyClosed: myWeek._sum.amount ?? 0,
      myMonthlyClosed: myMonth._sum.amount ?? 0,
    };
  }
}
