import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { CrmDataScope } from '../auth/crm-data-scope.service';
import { callInteractionTypeKey } from '../activities/call-result.util';
import { findCommercialAdvisorUsers } from '../common/commercial-advisor-users.util';
import {
  applySimpleAdvisorFilter,
  parseAdvisorFilterQuery,
  type ParsedAdvisorFilter,
} from '../common/advisor-filter.util';
import {
  endOfMonthLima,
  endOfWeekSundayLima,
  formatIsoWeekLabel,
  instantToLimaParts,
  isoWeekNumberLima,
  limaDayStart,
  maxInstant,
  minInstant,
  monthKeyLima,
  parseDayEndLima,
  parseDayStartLima,
  startOfMonthLima,
  startOfWeekMondayLima,
} from '../common/crm-timezone.util';

const MAX_RANGE_DAYS = 366;
const SPARKLINE_WEEKS = 10;
const WEEKLY_CHART_MAX_WEEKS = 20;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const CARTERA_ACTIVITY_LINK_FILTER: Prisma.ActivityWhereInput = {
  OR: [
    { clienteEmpresas: { some: {} } },
    { contactosCliente: { some: {} } },
  ],
};

const TASK_ACTIVITY_FILTER = { type: 'tarea' } as const;

const ACTIVITY_TYPE_DEFINITIONS = [
  { key: 'llamadas_contacto' as const, label: 'Contacto' },
  { key: 'llamadas_no_contacto' as const, label: 'No contacto' },
  { key: 'reuniones' as const, label: 'Reuniones' },
  { key: 'correos' as const, label: 'Correos' },
];

const TASK_KIND_DEFINITIONS = [
  { key: 'llamadas' as const, label: 'Llamadas' },
  { key: 'reuniones' as const, label: 'Reuniones' },
  { key: 'correos' as const, label: 'Correos' },
];

const STATUS_LABELS: Record<string, string> = {
  activo: 'Activos',
  inactivo: 'Inactivos',
  potencial: 'Potenciales',
};

const MONTH_LABELS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

type WeekClip = {
  name: string;
  clipStart: Date;
  clipEnd: Date;
};

type WeekTarget = {
  name: string;
  weekStart: Date;
  weekEnd: Date;
};

function parseDayStart(isoDate: string): Date {
  const normalized = isoDate.trim().slice(0, 10);
  try {
    return parseDayStartLima(normalized);
  } catch {
    throw new BadRequestException('from/to debe ser YYYY-MM-DD');
  }
}

function parseDayEnd(isoDate: string): Date {
  const normalized = isoDate.trim().slice(0, 10);
  try {
    return parseDayEndLima(normalized);
  } catch {
    throw new BadRequestException('from/to debe ser YYYY-MM-DD');
  }
}

function monthKey(d: Date): string {
  return monthKeyLima(d);
}

function monthLabelEs(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_LABELS[(m ?? 1) - 1]} ${y}`;
}

function eachMonthBetween(from: Date, to: Date): string[] {
  const keys: string[] = [];
  let cur = startOfMonthLima(from);
  const end = startOfMonthLima(to);
  while (cur.getTime() <= end.getTime()) {
    keys.push(monthKey(cur));
    const p = instantToLimaParts(cur);
    cur = limaDayStart(p.year, p.month + 1, 1);
  }
  return keys;
}

function eachWeekClipsInRange(from: Date, to: Date, maxWeeks?: number): WeekClip[] {
  const rows: WeekClip[] = [];
  let weekStart = startOfWeekMondayLima(from);
  let weekCount = 0;
  while (weekStart <= to && (maxWeeks == null || weekCount < maxWeeks)) {
    weekCount++;
    const weekEnd = endOfWeekSundayLima(weekStart);
    rows.push({
      name: formatIsoWeekLabel(isoWeekNumberLima(weekStart)),
      clipStart: maxInstant(weekStart, from),
      clipEnd: minInstant(weekEnd, to),
    });
    weekStart = new Date(weekStart.getTime() + WEEK_MS);
  }
  return rows;
}

function sparklineRange(
  weekCount: number,
  referenceTo = new Date(),
): { from: Date; to: Date; weeks: WeekClip[] } {
  const currentWeekStart = startOfWeekMondayLima(referenceTo);
  const from = new Date(
    currentWeekStart.getTime() - 7 * (weekCount - 1) * 24 * 60 * 60 * 1000,
  );
  return {
    from,
    to: referenceTo,
    weeks: eachWeekClipsInRange(from, referenceTo, weekCount),
  };
}

function weekTargetsForChartRange(
  from: Date,
  to: Date,
  maxWeeks = WEEKLY_CHART_MAX_WEEKS,
): WeekTarget[] {
  const targets: WeekTarget[] = [];
  let weekStart = startOfWeekMondayLima(from);
  while (weekStart <= to) {
    targets.push({
      name: formatIsoWeekLabel(isoWeekNumberLima(weekStart)),
      weekStart,
      weekEnd: minInstant(endOfWeekSundayLima(weekStart), to),
    });
    weekStart = new Date(weekStart.getTime() + WEEK_MS);
  }
  if (targets.length > maxWeeks) return targets.slice(-maxWeeks);
  return targets;
}

function weekNameForDate(d: Date, weeks: WeekClip[]): string | null {
  for (const w of weeks) {
    if (d.getTime() >= w.clipStart.getTime() && d.getTime() <= w.clipEnd.getTime()) {
      return w.name;
    }
  }
  return null;
}

function rolling7DayRanges(now: Date): {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
} {
  const { year, month, day } = instantToLimaParts(now);
  const from = limaDayStart(year, month, day - 6);
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = limaDayStart(year, month, day - 13);
  return { from, to: now, prevFrom, prevTo };
}

function pctChange(current: number, prev: number): string {
  if (prev === 0) {
    if (current === 0) return '0%';
    return '+100%';
  }
  const pct = ((current - prev) / prev) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${Math.round(pct)}%`;
}

function limaYmdFromInstant(d: Date): string {
  const { year, month, day } = instantToLimaParts(d);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function taskKindKeyFromRaw(
  taskKind: string | null | undefined,
): (typeof TASK_KIND_DEFINITIONS)[number]['key'] | null {
  const k = taskKind?.toLowerCase() ?? '';
  if (k === 'llamada') return 'llamadas';
  if (k === 'reunion' || k === 'reunión') return 'reuniones';
  if (k === 'correo') return 'correos';
  return null;
}

function normalizeMonthLabel(raw: string): { key: string; label: string; order: number } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const compact = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const prefixes = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ];
  const idx = prefixes.findIndex((p) => compact.startsWith(p));
  if (idx < 0) {
    return { key: compact, label: trimmed, order: 99 };
  }
  const yearMatch = compact.match(/(\d{4})/);
  const year = yearMatch ? Number(yearMatch[1]) : 0;
  return {
    key: `${year}-${String(idx + 1).padStart(2, '0')}-${prefixes[idx]}`,
    label: year ? `${MONTH_LABELS[idx]} ${year}` : MONTH_LABELS[idx],
    order: year * 12 + idx,
  };
}

type CommercialAdvisorPool = {
  commercialAdvisorIds: Set<string>;
  usernameToAdvisor: Map<string, { id: string; name: string }>;
  advisorNameById: Map<string, string>;
};

function impossibleWhere(): Prisma.ClienteEmpresaWhereInput {
  return { AND: [{ id: '__none__' }] };
}

@Injectable()
export class ClienteCarteraAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(opts: {
    from?: string;
    to?: string;
    assignedTo?: string;
    excludeAssignedTo?: string;
    advisorPool?: string;
    crmScope: CrmDataScope;
    username: string;
  }) {
    const { from, to } = this.resolveRange(opts.from, opts.to);
    const advisorFilter = this.resolveAdvisorFilter(opts);
    const username = opts.username.trim().toLowerCase();

    const [empresaWhere, contactoWhere, activityWhere] = await Promise.all([
      this.buildEmpresaWhere(opts.crmScope, username, advisorFilter),
      this.buildContactoWhere(opts.crmScope, advisorFilter),
      this.buildActivityWhere(opts.crmScope, advisorFilter),
    ]);

    const spark = sparklineRange(SPARKLINE_WEEKS, to);
    const weekTargets = weekTargetsForChartRange(from, to);
    const monthKeys = eachMonthBetween(from, to);
    const roll = rolling7DayRanges(to);

    const [
      totalEmpresas,
      statusGroups,
      ingresosAgg,
      altasInRange,
      altas7d,
      altasPrev7d,
      contactosInRange,
      contactos7d,
      contactosPrev7d,
      tasksCompleted,
      tasksPending,
      tasks7d,
      tasksPrev7d,
      empresasForCharts,
      contactosForCharts,
      interactionActs,
      taskActs,
      altasWeekly,
      contactosWeekly,
      tasksWeekly,
    ] = await Promise.all([
      this.prisma.clienteEmpresa.count({ where: empresaWhere }),
      this.prisma.clienteEmpresa.groupBy({
        by: ['status'],
        where: empresaWhere,
        _count: { _all: true },
      }),
      this.prisma.clienteEmpresa.aggregate({
        where: empresaWhere,
        _sum: { ingresos: true, ingresosAnual: true },
      }),
      this.prisma.clienteEmpresa.count({
        where: { AND: [empresaWhere, { fechaAlta: { gte: from, lte: to } }] },
      }),
      this.prisma.clienteEmpresa.count({
        where: {
          AND: [empresaWhere, { fechaAlta: { gte: roll.from, lte: roll.to } }],
        },
      }),
      this.prisma.clienteEmpresa.count({
        where: {
          AND: [
            empresaWhere,
            { fechaAlta: { gte: roll.prevFrom, lte: roll.prevTo } },
          ],
        },
      }),
      this.prisma.contactoCliente.count({
        where: { AND: [contactoWhere, { createdAt: { gte: from, lte: to } }] },
      }),
      this.prisma.contactoCliente.count({
        where: {
          AND: [contactoWhere, { createdAt: { gte: roll.from, lte: roll.to } }],
        },
      }),
      this.prisma.contactoCliente.count({
        where: {
          AND: [
            contactoWhere,
            { createdAt: { gte: roll.prevFrom, lte: roll.prevTo } },
          ],
        },
      }),
      this.prisma.activity.count({
        where: {
          AND: [
            activityWhere,
            TASK_ACTIVITY_FILTER,
            { completedAt: { gte: from, lte: to } },
          ],
        },
      }),
      this.prisma.activity.count({
        where: {
          AND: [activityWhere, TASK_ACTIVITY_FILTER, { status: 'pendiente' }],
        },
      }),
      this.prisma.activity.count({
        where: {
          AND: [
            activityWhere,
            TASK_ACTIVITY_FILTER,
            { completedAt: { gte: roll.from, lte: roll.to } },
          ],
        },
      }),
      this.prisma.activity.count({
        where: {
          AND: [
            activityWhere,
            TASK_ACTIVITY_FILTER,
            { completedAt: { gte: roll.prevFrom, lte: roll.prevTo } },
          ],
        },
      }),
      this.prisma.clienteEmpresa.findMany({
        where: empresaWhere,
        select: {
          asesor: true,
          fechaAlta: true,
          ingresos: true,
          status: true,
          mes1: true,
          monto1: true,
          mes2: true,
          monto2: true,
          mes3: true,
          monto3: true,
          mes4: true,
          monto4: true,
          mes5: true,
          monto5: true,
        },
      }),
      this.prisma.contactoCliente.findMany({
        where: contactoWhere,
        select: { assignedTo: true, createdAt: true },
      }),
      this.prisma.activity.findMany({
        where: {
          AND: [
            activityWhere,
            {
              OR: [
                { type: { equals: 'llamada', mode: 'insensitive' } },
                { type: { equals: 'reunion', mode: 'insensitive' } },
                { type: { equals: 'correo', mode: 'insensitive' } },
              ],
            },
            { completedAt: { gte: from, lte: to } },
          ],
        },
        select: {
          completedAt: true,
          type: true,
          description: true,
          assignedTo: true,
        },
      }),
      this.prisma.activity.findMany({
        where: {
          AND: [
            activityWhere,
            TASK_ACTIVITY_FILTER,
            { completedAt: { gte: from, lte: to } },
          ],
        },
        select: {
          completedAt: true,
          taskKind: true,
          assignedTo: true,
        },
      }),
      this.countEmpresasWeekly(empresaWhere, spark.from, spark.to, spark.weeks),
      this.countContactosWeekly(contactoWhere, spark.from, spark.to, spark.weeks),
      this.countTasksWeekly(activityWhere, spark.from, spark.to, spark.weeks),
    ]);

    const byStatusMap = new Map(
      statusGroups.map((row) => [row.status.toLowerCase(), row._count._all]),
    );
    const byStatus = ['activo', 'inactivo', 'potencial'].map((key) => ({
      key,
      name: STATUS_LABELS[key] ?? key,
      value: byStatusMap.get(key) ?? 0,
    }));

    const advisorPool = await this.loadCommercialAdvisorPool();

    const altasByMonth = this.buildAltasByMonth(
      monthKeys,
      empresasForCharts,
      contactosForCharts,
    );
    const monthlyBilling = this.buildMonthlyBilling(empresasForCharts);
    const ingresosByAdvisor = this.buildIngresosByAdvisor(
      empresasForCharts,
      advisorPool,
    );
    const byAdvisor = this.buildAdvisorStack(
      empresasForCharts,
      contactosForCharts,
      taskActs,
      advisorPool,
    );
    const activitiesByTypeWeekly = this.buildActivitiesByTypeWeekly(
      weekTargets,
      interactionActs,
    );
    const tasksByKindWeekly = this.buildTasksByKindWeekly(weekTargets, taskActs);

    return {
      range: {
        from: limaYmdFromInstant(from),
        to: limaYmdFromInstant(to),
      },
      kpis: {
        totalEmpresas,
        empresasActivas: byStatusMap.get('activo') ?? 0,
        empresasInactivas: byStatusMap.get('inactivo') ?? 0,
        empresasPotenciales: byStatusMap.get('potencial') ?? 0,
        altasInRange,
        ingresos: ingresosAgg._sum.ingresos ?? 0,
        ingresosAnual: ingresosAgg._sum.ingresosAnual ?? 0,
        contactosCreated: contactosInRange,
        tasksCompleted,
        tasksPending,
        changes: {
          altas: pctChange(altas7d, altasPrev7d),
          contactos: pctChange(contactos7d, contactosPrev7d),
          tasks: pctChange(tasks7d, tasksPrev7d),
        },
      },
      byStatus,
      altasByMonth,
      monthlyBilling,
      ingresosByAdvisor,
      byAdvisor,
      altasWeekly,
      contactosWeekly,
      tasksWeekly,
      activitiesByTypeWeekly,
      tasksByKindWeekly,
    };
  }

  private resolveRange(fromStr?: string, toStr?: string): { from: Date; to: Date } {
    const to = toStr ? parseDayEnd(toStr) : new Date();
    const from = fromStr
      ? parseDayStart(fromStr)
      : new Date(to.getTime() - 30 * 86400000);
    if (from > to) {
      throw new BadRequestException(
        'La fecha inicial no puede ser posterior a la final',
      );
    }
    const days = (to.getTime() - from.getTime()) / 86400000;
    if (days > MAX_RANGE_DAYS) {
      throw new BadRequestException(`El rango máximo es ${MAX_RANGE_DAYS} días`);
    }
    return { from, to };
  }

  private resolveAdvisorFilter(opts: {
    assignedTo?: string;
    excludeAssignedTo?: string;
    advisorPool?: string;
    crmScope: CrmDataScope;
  }): ParsedAdvisorFilter {
    if (!opts.crmScope.unrestricted) {
      return parseAdvisorFilterQuery({
        assignedTo: opts.crmScope.viewerUserId,
      });
    }
    return parseAdvisorFilterQuery({
      assignedTo: opts.assignedTo,
      excludeAssignedTo: opts.excludeAssignedTo,
      advisorPool: opts.advisorPool,
    });
  }

  private async buildEmpresaWhere(
    scope: CrmDataScope,
    username: string,
    advisorFilter: ParsedAdvisorFilter,
  ): Promise<Prisma.ClienteEmpresaWhereInput> {
    const parts: Prisma.ClienteEmpresaWhereInput[] = [];
    if (!scope.unrestricted) {
      if (!username) return impossibleWhere();
      parts.push({ asesor: username });
    }
    const advisorClause = await this.empresaAdvisorWhere(advisorFilter);
    if (advisorClause) parts.push(advisorClause);
    if (parts.length === 0) return {};
    if (parts.length === 1) return parts[0];
    return { AND: parts };
  }

  private async empresaAdvisorWhere(
    parsed: ParsedAdvisorFilter,
  ): Promise<Prisma.ClienteEmpresaWhereInput | undefined> {
    if (parsed.unrestricted) return undefined;
    if (parsed.matchNone) return impossibleWhere();

    const userIds = [
      ...parsed.userIds,
      ...(parsed.includeOthers ? parsed.advisorPool : []),
    ];
    const usernameByUserId = await this.usernamesByUserIds(userIds);
    const selectedUsernames = parsed.userIds
      .map((id) => usernameByUserId.get(id))
      .filter((u): u is string => !!u);
    const poolUsernames = parsed.advisorPool
      .map((id) => usernameByUserId.get(id))
      .filter((u): u is string => !!u);

    const orParts: Prisma.ClienteEmpresaWhereInput[] = [];
    if (selectedUsernames.length === 1) {
      orParts.push({ asesor: selectedUsernames[0] });
    } else if (selectedUsernames.length > 1) {
      orParts.push({ asesor: { in: selectedUsernames } });
    }
    if (parsed.includeUnassigned) {
      orParts.push({ asesor: '' });
    }
    if (parsed.includeOthers) {
      const exclude = poolUsernames.length > 0 ? poolUsernames : selectedUsernames;
      if (exclude.length > 0) {
        orParts.push({
          AND: [{ asesor: { not: '' } }, { asesor: { notIn: exclude } }],
        });
      } else {
        orParts.push({ asesor: { not: '' } });
      }
    }

    if (orParts.length === 0) return impossibleWhere();
    if (orParts.length === 1) return orParts[0];
    return { OR: orParts };
  }

  private async buildContactoWhere(
    scope: CrmDataScope,
    advisorFilter: ParsedAdvisorFilter,
  ): Promise<Prisma.ContactoClienteWhereInput> {
    const w: Prisma.ContactoClienteWhereInput = {};
    if (!scope.unrestricted) {
      w.assignedTo = scope.viewerUserId;
    }
    applySimpleAdvisorFilter(w, advisorFilter);
    return w;
  }

  private async buildActivityWhere(
    scope: CrmDataScope,
    advisorFilter: ParsedAdvisorFilter,
  ): Promise<Prisma.ActivityWhereInput> {
    const w: Prisma.ActivityWhereInput = {
      AND: [CARTERA_ACTIVITY_LINK_FILTER],
    };
    if (!scope.unrestricted) {
      w.AND = [
        CARTERA_ACTIVITY_LINK_FILTER,
        { assignedTo: scope.viewerUserId },
      ];
    }
    applySimpleAdvisorFilter(w, advisorFilter);
    return w;
  }

  private async usernamesByUserIds(userIds: string[]) {
    const unique = [...new Set(userIds.filter(Boolean))];
    const map = new Map<string, string>();
    if (unique.length === 0) return map;
    const accounts = await this.prisma.account.findMany({
      where: { provider: 'credentials', userId: { in: unique } },
      select: { userId: true, providerId: true },
    });
    for (const acc of accounts) {
      map.set(acc.userId, acc.providerId.trim().toLowerCase());
    }
    return map;
  }

  private async loadCommercialAdvisorPool(): Promise<CommercialAdvisorPool> {
    const advisors = await findCommercialAdvisorUsers(this.prisma, {
      area: 'comercial',
    });
    const commercialAdvisorIds = new Set(advisors.map((a) => a.id));
    const advisorNameById = new Map(
      advisors.map((a) => [a.id, a.name.trim() || 'Sin nombre'] as const),
    );

    const accounts = await this.prisma.account.findMany({
      where: {
        provider: 'credentials',
        userId: { in: advisors.map((a) => a.id) },
      },
      select: { userId: true, providerId: true },
    });

    const usernameToAdvisor = new Map<string, { id: string; name: string }>();
    for (const acc of accounts) {
      const name = advisorNameById.get(acc.userId);
      if (!name) continue;
      const username = acc.providerId.trim().toLowerCase();
      if (!username) continue;
      usernameToAdvisor.set(username, { id: acc.userId, name });
    }

    return { commercialAdvisorIds, usernameToAdvisor, advisorNameById };
  }

  private resolveCommercialAdvisorFromUsername(
    rawUsername: string | null | undefined,
    pool: CommercialAdvisorPool,
  ): { id: string; name: string } | null {
    const username = rawUsername?.trim().toLowerCase();
    if (!username) return null;
    const advisor = pool.usernameToAdvisor.get(username);
    if (!advisor || !pool.commercialAdvisorIds.has(advisor.id)) return null;
    return advisor;
  }

  private resolveCommercialAdvisorFromUserId(
    rawUserId: string | null | undefined,
    pool: CommercialAdvisorPool,
  ): { id: string; name: string } | null {
    const userId = rawUserId?.trim();
    if (!userId || !pool.commercialAdvisorIds.has(userId)) return null;
    return {
      id: userId,
      name: pool.advisorNameById.get(userId) ?? 'Sin nombre',
    };
  }

  private async countEmpresasWeekly(
    where: Prisma.ClienteEmpresaWhereInput,
    from: Date,
    to: Date,
    weeks: WeekClip[],
  ) {
    const counts = new Map(weeks.map((w) => [w.name, 0]));
    const rows = await this.prisma.clienteEmpresa.findMany({
      where: { AND: [where, { fechaAlta: { gte: from, lte: to } }] },
      select: { fechaAlta: true },
    });
    for (const row of rows) {
      const key = weekNameForDate(row.fechaAlta, weeks);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return weeks.map((w) => ({ name: w.name, value: counts.get(w.name) ?? 0 }));
  }

  private async countContactosWeekly(
    where: Prisma.ContactoClienteWhereInput,
    from: Date,
    to: Date,
    weeks: WeekClip[],
  ) {
    const counts = new Map(weeks.map((w) => [w.name, 0]));
    const rows = await this.prisma.contactoCliente.findMany({
      where: { AND: [where, { createdAt: { gte: from, lte: to } }] },
      select: { createdAt: true },
    });
    for (const row of rows) {
      const key = weekNameForDate(row.createdAt, weeks);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return weeks.map((w) => ({ name: w.name, value: counts.get(w.name) ?? 0 }));
  }

  private async countTasksWeekly(
    where: Prisma.ActivityWhereInput,
    from: Date,
    to: Date,
    weeks: WeekClip[],
  ) {
    const counts = new Map(weeks.map((w) => [w.name, 0]));
    const rows = await this.prisma.activity.findMany({
      where: {
        AND: [
          where,
          TASK_ACTIVITY_FILTER,
          { completedAt: { gte: from, lte: to } },
        ],
      },
      select: { completedAt: true },
    });
    for (const row of rows) {
      if (!row.completedAt) continue;
      const key = weekNameForDate(row.completedAt, weeks);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return weeks.map((w) => ({ name: w.name, value: counts.get(w.name) ?? 0 }));
  }

  private buildAltasByMonth(
    monthKeys: string[],
    empresas: { fechaAlta: Date }[],
    contactos: { createdAt: Date }[],
  ) {
    const empresasByMonth = new Map(monthKeys.map((k) => [k, 0]));
    const contactosByMonth = new Map(monthKeys.map((k) => [k, 0]));
    for (const row of empresas) {
      const key = monthKey(row.fechaAlta);
      if (empresasByMonth.has(key)) {
        empresasByMonth.set(key, (empresasByMonth.get(key) ?? 0) + 1);
      }
    }
    for (const row of contactos) {
      const key = monthKey(row.createdAt);
      if (contactosByMonth.has(key)) {
        contactosByMonth.set(key, (contactosByMonth.get(key) ?? 0) + 1);
      }
    }
    return monthKeys.map((key) => ({
      name: monthLabelEs(key),
      empresas: empresasByMonth.get(key) ?? 0,
      contactos: contactosByMonth.get(key) ?? 0,
    }));
  }

  private buildMonthlyBilling(
    empresas: {
      mes1?: string | null;
      monto1?: number | null;
      mes2?: string | null;
      monto2?: number | null;
      mes3?: string | null;
      monto3?: number | null;
      mes4?: string | null;
      monto4?: number | null;
      mes5?: string | null;
      monto5?: number | null;
    }[],
  ) {
    const buckets = new Map<string, { label: string; amount: number; order: number }>();
    for (const empresa of empresas) {
      for (const i of [1, 2, 3, 4, 5] as const) {
        const raw = empresa[`mes${i}`];
        const amount = empresa[`monto${i}`] ?? 0;
        if (!raw || !amount) continue;
        const parsed = normalizeMonthLabel(raw);
        if (!parsed) continue;
        const prev = buckets.get(parsed.key);
        if (prev) {
          prev.amount += amount;
        } else {
          buckets.set(parsed.key, {
            label: parsed.label,
            amount,
            order: parsed.order,
          });
        }
      }
    }
    return [...buckets.values()]
      .sort((a, b) => a.order - b.order)
      .map((row) => ({ name: row.label, amount: row.amount }));
  }

  private buildIngresosByAdvisor(
    empresas: { asesor: string; ingresos: number }[],
    pool: CommercialAdvisorPool,
  ) {
    const buckets = new Map<
      string,
      { advisorId: string; advisorName: string; empresas: number; ingresos: number }
    >();
    for (const row of empresas) {
      const advisor = this.resolveCommercialAdvisorFromUsername(row.asesor, pool);
      if (!advisor) continue;

      const prev = buckets.get(advisor.id);
      if (prev) {
        prev.empresas += 1;
        prev.ingresos += row.ingresos ?? 0;
      } else {
        buckets.set(advisor.id, {
          advisorId: advisor.id,
          advisorName: advisor.name,
          empresas: 1,
          ingresos: row.ingresos ?? 0,
        });
      }
    }
    return [...buckets.values()].sort((a, b) => b.ingresos - a.ingresos);
  }

  private buildAdvisorStack(
    empresas: { asesor: string }[],
    contactos: { assignedTo: string | null }[],
    tasks: { assignedTo: string }[],
    pool: CommercialAdvisorPool,
  ) {
    const buckets = new Map<
      string,
      {
        advisorId: string;
        advisorName: string;
        empresas: number;
        contactos: number;
        tareas: number;
      }
    >();

    const bump = (
      advisor: { id: string; name: string },
      field: 'empresas' | 'contactos' | 'tareas',
    ) => {
      const prev = buckets.get(advisor.id);
      if (prev) {
        prev[field] += 1;
        return;
      }
      buckets.set(advisor.id, {
        advisorId: advisor.id,
        advisorName: advisor.name,
        empresas: field === 'empresas' ? 1 : 0,
        contactos: field === 'contactos' ? 1 : 0,
        tareas: field === 'tareas' ? 1 : 0,
      });
    };

    for (const row of empresas) {
      const advisor = this.resolveCommercialAdvisorFromUsername(row.asesor, pool);
      if (advisor) bump(advisor, 'empresas');
    }
    for (const row of contactos) {
      const advisor = this.resolveCommercialAdvisorFromUserId(row.assignedTo, pool);
      if (advisor) bump(advisor, 'contactos');
    }
    for (const row of tasks) {
      const advisor = this.resolveCommercialAdvisorFromUserId(row.assignedTo, pool);
      if (advisor) bump(advisor, 'tareas');
    }

    return [...buckets.values()]
      .filter((row) => row.empresas + row.contactos + row.tareas > 0)
      .sort(
        (a, b) =>
          b.empresas + b.contactos + b.tareas -
          (a.empresas + a.contactos + a.tareas),
      );
  }

  private buildActivitiesByTypeWeekly(
    weekTargets: WeekTarget[],
    acts: { completedAt: Date | null; type: string; description: string }[],
  ) {
    const weekIndexByName = new Map(
      weekTargets.map((week, index) => [week.name, index] as const),
    );
    const countsByType = new Map(
      ACTIVITY_TYPE_DEFINITIONS.map((def) => [
        def.key,
        Array(weekTargets.length).fill(0) as number[],
      ]),
    );

    for (const act of acts) {
      if (!act.completedAt) continue;
      const typeKey = callInteractionTypeKey(act.type, act.description);
      if (!typeKey) continue;
      let weekIndex: number | null = null;
      for (const week of weekTargets) {
        if (
          act.completedAt.getTime() >= week.weekStart.getTime() &&
          act.completedAt.getTime() <= week.weekEnd.getTime()
        ) {
          weekIndex = weekIndexByName.get(week.name) ?? null;
          break;
        }
      }
      if (weekIndex == null) continue;
      const row = countsByType.get(typeKey);
      if (!row) continue;
      row[weekIndex] += 1;
    }

    let maxCount = 0;
    const types = ACTIVITY_TYPE_DEFINITIONS.map((def) => {
      const counts = countsByType.get(def.key) ?? Array(weekTargets.length).fill(0);
      const total = counts.reduce((sum, n) => sum + n, 0);
      for (const n of counts) maxCount = Math.max(maxCount, n);
      return { key: def.key, label: def.label, counts, total };
    });

    return {
      weeks: weekTargets.map((week) => ({
        name: week.name,
        weekStart: limaYmdFromInstant(week.weekStart),
        weekEnd: limaYmdFromInstant(week.weekEnd),
      })),
      types,
      maxCount,
    };
  }

  private buildTasksByKindWeekly(
    weekTargets: WeekTarget[],
    tasks: { completedAt: Date | null; taskKind: string | null }[],
  ) {
    const weekIndexByName = new Map(
      weekTargets.map((week, index) => [week.name, index] as const),
    );
    const countsByKind = new Map(
      TASK_KIND_DEFINITIONS.map((def) => [
        def.key,
        Array(weekTargets.length).fill(0) as number[],
      ]),
    );

    for (const task of tasks) {
      if (!task.completedAt) continue;
      const kindKey = taskKindKeyFromRaw(task.taskKind);
      if (!kindKey) continue;
      let weekIndex: number | null = null;
      for (const week of weekTargets) {
        if (
          task.completedAt.getTime() >= week.weekStart.getTime() &&
          task.completedAt.getTime() <= week.weekEnd.getTime()
        ) {
          weekIndex = weekIndexByName.get(week.name) ?? null;
          break;
        }
      }
      if (weekIndex == null) continue;
      const row = countsByKind.get(kindKey);
      if (!row) continue;
      row[weekIndex] += 1;
    }

    let maxCount = 0;
    const kinds = TASK_KIND_DEFINITIONS.map((def) => {
      const counts = countsByKind.get(def.key) ?? Array(weekTargets.length).fill(0);
      const total = counts.reduce((sum, n) => sum + n, 0);
      for (const n of counts) maxCount = Math.max(maxCount, n);
      return { key: def.key, label: def.label, counts, total };
    });

    return {
      weeks: weekTargets.map((week) => ({
        name: week.name,
        weekStart: limaYmdFromInstant(week.weekStart),
        weekEnd: limaYmdFromInstant(week.weekEnd),
      })),
      kinds,
      maxCount,
    };
  }
}
