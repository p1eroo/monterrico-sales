import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { CrmDataScope } from '../auth/crm-data-scope.service';
import { mergeCompanyScope } from '../common/crm-data-scope-where.util';
import { CrmConfigService } from '../crm-config/crm-config.service';
import { resolveLeadSourceKeyLoose } from '../crm-config/lead-source-normalize.util';
import {
  type AnalyticsScopeFilters,
  applyAdvisorFilter,
  applyCompanyAdvisorFilter,
  applyActivityAdvisorFilter,
  applySourceFilter,
  advisorWhereFromFilters,
  performanceGroupByWhere,
  singleAdvisorIdForMeta,
} from './analytics-filter.util';

const MAX_RANGE_DAYS = 366;
/** Solo para listados de asesores (nombres); el filtrado de métricas usa `assignedTo`. */
const ADVISOR_ROLE_SLUG = 'asesor';

function parseDayStart(isoDate: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new BadRequestException('from/to debe ser YYYY-MM-DD');
  }
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 5, 0, 0, 0));
}

function parseDayEnd(isoDate: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new BadRequestException('from/to debe ser YYYY-MM-DD');
  }
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, 4, 59, 59, 999));
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
  while (cur.getTime() <= end.getTime()) {
    keys.push(monthKey(cur));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return keys;
}

/** Intersección del mes calendario `ym` (YYYY-MM) con el rango de analytics. */
function clipMonthToAnalyticsRange(ym: string, from: Date, to: Date): { start: Date; end: Date } {
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
  const mStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const mEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  const start = mStart.getTime() > from.getTime() ? mStart : from;
  const end = mEnd.getTime() < to.getTime() ? mEnd : to;
  return { start, end };
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

function maxUtcDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

function minUtcDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

/** Semana ISO (1–53) a partir de un instante UTC (algoritmo jueves). */
function isoWeekNumberUtc(d: Date): number {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil((x.getTime() - yearStart.getTime() + 86400000) / 86400000 / 7);
}

type CompanyWeeklyProgressRow = {
  name: string;
  avance: number;
  nuevoIngreso: number;
  retroceso: number;
  sinCambios: number;
};

type OpportunityWeeklyProgressRow = {
  name: string;
  avance: number;
  nuevoIngreso: number;
  atraso: number;
  sinCambios: number;
};

type WeeklyMetricRow = {
  name: string;
  value: number;
};

type WeekClip = {
  name: string;
  clipStart: Date;
  clipEnd: Date;
};

/** Si `maxWeeks` se omite, recorre todo el rango (reportes). Sparklines pasan un tope fijo. */
function eachWeekClipsInRange(from: Date, to: Date, maxWeeks?: number): WeekClip[] {
  const rows: WeekClip[] = [];
  let weekStart = startOfUtcWeekMonday(from);
  let weekCount = 0;
  while (weekStart <= to && (maxWeeks == null || weekCount < maxWeeks)) {
    weekCount++;
    const weekEnd = endOfUtcWeekSunday(weekStart);
    rows.push({
      name: String(isoWeekNumberUtc(weekStart)),
      clipStart: maxUtcDate(weekStart, from),
      clipEnd: minUtcDate(weekEnd, to),
    });
    weekStart = new Date(weekStart);
    weekStart.setUTCDate(weekStart.getUTCDate() + 7);
  }
  return rows;
}

const DASHBOARD_SPARKLINE_WEEKS = 8;
const REPORTS_SPARKLINE_WEEKS = 10;
const GOALS_MONTHLY_CHART = 6;

type GoalChartPoint = {
  name: string;
  meta: number;
  avance: number;
};

function pctChange(cur: number, prev: number): string {
  if (prev <= 0) return cur > 0 ? '+100%' : '0%';
  const p = Math.round(((cur - prev) / prev) * 1000) / 10;
  return `${p >= 0 ? '+' : ''}${p}%`;
}

/** Inicio del día calendario en Lima (UTC-5), coherente con parseDayStart. */
function limaDayStartFromUtcParts(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d, 5, 0, 0, 0));
}

/** Últimos 7 días (incl. hoy) vs los 7 días anteriores, anclado a hora Lima. */
function rolling7DayRanges(now = new Date()): {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
} {
  const limaNow = new Date(now.getTime() - 5 * 3600000);
  const y = limaNow.getUTCFullYear();
  const m = limaNow.getUTCMonth();
  const d = limaNow.getUTCDate();

  const from = limaDayStartFromUtcParts(y, m, d - 6);
  const to = now;
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = limaDayStartFromUtcParts(y, m, d - 13);

  return { from, to, prevFrom, prevTo };
}

/** Últimos N meses calendario (Lima) para gráfico de metas. */
function lastNMonthClips(n: number, now = new Date()): {
  ym: string;
  clipStart: Date;
  clipEnd: Date;
  label: string;
}[] {
  const lima = new Date(now.getTime() - 5 * 3600000);
  const rows: { ym: string; clipStart: Date; clipEnd: Date; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const anchor = new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth() - i, 1));
    const ym = monthKey(anchor);
    rows.push({
      ym,
      clipStart: startOfUtcMonth(anchor),
      clipEnd: endOfUtcMonth(anchor),
      label: monthLabelEs(ym),
    });
  }
  return rows;
}

/** Ventana fija para sparklines KPI: últimas N semanas incluyendo la actual (anclada a hoy). */
function sparklineRange(weekCount: number, now = new Date()): { from: Date; to: Date; weeks: WeekClip[] } {
  const currentWeekStart = startOfUtcWeekMonday(now);
  const from = new Date(currentWeekStart);
  from.setUTCDate(from.getUTCDate() - 7 * (weekCount - 1));
  const to = now;
  const weeks = eachWeekClipsInRange(from, to, weekCount);
  return { from, to, weeks };
}

function weekNameForDate(d: Date, weeks: WeekClip[]): string | null {
  for (const w of weeks) {
    if (d.getTime() >= w.clipStart.getTime() && d.getTime() <= w.clipEnd.getTime()) {
      return w.name;
    }
  }
  return null;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly crmConfig: CrmConfigService,
  ) {}

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

  private async resolveScopeFilters(opts: {
    advisorId?: string;
    assignedTo?: string;
    excludeAssignedTo?: string;
    advisorPool?: string;
    source?: string;
    unrestricted: boolean;
    viewerUserId: string;
  }): Promise<AnalyticsScopeFilters> {
    let assignedTo: string | undefined;
    let excludeAssignedTo: string | undefined;
    let advisorPool: string | undefined;

    if (!opts.unrestricted) {
      assignedTo = opts.viewerUserId;
    } else if (opts.assignedTo?.trim() || opts.excludeAssignedTo?.trim()) {
      assignedTo = opts.assignedTo?.trim() || undefined;
      excludeAssignedTo = opts.excludeAssignedTo?.trim() || undefined;
      advisorPool = opts.advisorPool?.trim() || undefined;
    } else if (opts.advisorId?.trim()) {
      assignedTo = opts.advisorId.trim();
    }

    const sources: string[] = [];
    const rawSource = opts.source?.trim();
    if (rawSource && rawSource !== 'all') {
      const unique = [
        ...new Set(
          rawSource
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ];
      for (const part of unique) {
        try {
          sources.push(await this.crmConfig.normalizeLeadSource(part));
        } catch {
          sources.push(part);
        }
      }
    }

    return { assignedTo, excludeAssignedTo, advisorPool, sources };
  }

  private contactWhere(
    from: Date,
    to: Date,
    filters: AnalyticsScopeFilters,
    _unrestricted: boolean,
  ): Prisma.ContactWhereInput {
    const w: Prisma.ContactWhereInput = {
      createdAt: { gte: from, lte: to },
    };
    applyAdvisorFilter(w, filters);
    applySourceFilter(w, filters.sources);
    return w;
  }

  private async fetchRolling7DayChangeInputs(
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
  ): Promise<{
    contacts7d: number;
    contactsPrev7d: number;
    opportunities7d: number;
    opportunitiesPrev7d: number;
    sales7d: number;
    salesPrev7d: number;
  }> {
    const { from, to, prevFrom, prevTo } = rolling7DayRanges();
    const [
      contacts7d,
      contactsPrev7d,
      opportunities7d,
      opportunitiesPrev7d,
      closedAgg7d,
      closedAggPrev7d,
    ] = await Promise.all([
      this.prisma.contact.count({
        where: this.contactWhere(from, to, filters, unrestricted),
      }),
      this.prisma.contact.count({
        where: this.contactWhere(prevFrom, prevTo, filters, unrestricted),
      }),
      this.prisma.opportunity.count({
        where: this.opportunityWhereOpen(filters, unrestricted, from, to),
      }),
      this.prisma.opportunity.count({
        where: this.opportunityWhereOpen(filters, unrestricted, prevFrom, prevTo),
      }),
      this.prisma.opportunity.aggregate({
        where: this.opportunityWhereWonInRange(from, to, filters, unrestricted),
        _sum: { amount: true },
      }),
      this.prisma.opportunity.aggregate({
        where: this.opportunityWhereWonInRange(prevFrom, prevTo, filters, unrestricted),
        _sum: { amount: true },
      }),
    ]);
    return {
      contacts7d,
      contactsPrev7d,
      opportunities7d,
      opportunitiesPrev7d,
      sales7d: closedAgg7d._sum.amount ?? 0,
      salesPrev7d: closedAggPrev7d._sum.amount ?? 0,
    };
  }

  private companyPortfolioBaseWhere(
    filters: AnalyticsScopeFilters,
    _unrestricted: boolean,
  ): Prisma.CompanyWhereInput {
    const w: Prisma.CompanyWhereInput = {};
    applyCompanyAdvisorFilter(w, filters);
    applySourceFilter(w, filters.sources);
    return w;
  }

  private companyWhere(
    from: Date,
    to: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
  ): Prisma.CompanyWhereInput {
    return {
      ...this.companyPortfolioBaseWhere(filters, unrestricted),
      createdAt: { gte: from, lte: to },
    };
  }

  /**
   * Por semana ISO (lun–dom UTC): nuevas en la semana, avance/retroceso de etapa
   * (desde auditoría) y empresas sin movimiento, sobre la cartera filtrada.
   */
  private async buildCompaniesWeeklyProgress(
    from: Date,
    to: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    crmScope: CrmDataScope,
  ): Promise<CompanyWeeklyProgressRow[]> {
    const portfolioWhere = mergeCompanyScope(
      {
        ...this.companyPortfolioBaseWhere(filters, unrestricted),
        createdAt: { lte: to },
      },
      crmScope,
    );

    const [stages, portfolioCompanies, auditRows] = await Promise.all([
      this.prisma.crmStage.findMany({
        where: { enabled: true },
        select: { slug: true, sortOrder: true },
      }),
      this.prisma.company.findMany({
        where: portfolioWhere,
        select: { id: true, createdAt: true },
      }),
      this.prisma.auditChangeSet.findMany({
        where: {
          module: 'empresas',
          entityType: 'Empresa',
          createdAt: { gte: from, lte: to },
          entries: { some: { fieldKey: 'etapa' } },
        },
        include: {
          entries: {
            where: { fieldKey: 'etapa' },
            select: { oldValue: true, newValue: true },
          },
        },
      }),
    ]);

    const order = new Map(stages.map((s) => [s.slug, s.sortOrder]));
    const rank = (slug: string) => order.get(slug.trim()) ?? 999_999;

    const portfolioIds = new Set(portfolioCompanies.map((c) => c.id));

    type AuditEv = { at: Date; oldSlug: string; newSlug: string };
    const auditsByCompany = new Map<string, AuditEv[]>();
    for (const row of auditRows) {
      const id = row.entityId;
      if (!id || !portfolioIds.has(id)) continue;
      const et = row.entries[0];
      if (!et) continue;
      const oldSlug = et.oldValue.trim();
      const newSlug = et.newValue.trim();
      if (!oldSlug && !newSlug) continue;
      const list = auditsByCompany.get(id) ?? [];
      list.push({ at: row.createdAt, oldSlug, newSlug });
      auditsByCompany.set(id, list);
    }
    for (const [, list] of auditsByCompany) {
      list.sort((a, b) => a.at.getTime() - b.at.getTime());
    }

    const rows: CompanyWeeklyProgressRow[] = [];
    let weekStart = startOfUtcWeekMonday(from);
    while (weekStart <= to) {
      const weekEnd = endOfUtcWeekSunday(weekStart);
      const clipStart = maxUtcDate(weekStart, from);
      const clipEnd = minUtcDate(weekEnd, to);

      const subset = portfolioCompanies.filter((c) => c.createdAt <= weekEnd);
      const total = subset.length;
      const subsetIds = new Set(subset.map((c) => c.id));

      const nuevoIds = new Set(
        subset
          .filter((c) => c.createdAt >= clipStart && c.createdAt <= clipEnd)
          .map((c) => c.id),
      );
      const nuevoIngreso = nuevoIds.size;

      const latestInWeek = new Map<string, AuditEv>();
      for (const [cid, evs] of auditsByCompany) {
        if (!subsetIds.has(cid) || nuevoIds.has(cid)) continue;
        const inWeek = evs.filter((e) => e.at >= clipStart && e.at <= clipEnd);
        if (inWeek.length === 0) continue;
        const last = inWeek[inWeek.length - 1]!;
        latestInWeek.set(cid, last);
      }

      let avance = 0;
      let retroceso = 0;
      let neutralMoves = 0;
      for (const ev of latestInWeek.values()) {
        const ro = rank(ev.oldSlug);
        const rn = rank(ev.newSlug);
        if (rn > ro) avance += 1;
        else if (rn < ro) retroceso += 1;
        else neutralMoves += 1;
      }

      const sinCambios = Math.max(
        0,
        total - nuevoIngreso - avance - retroceso - neutralMoves,
      );

      rows.push({
        name: String(isoWeekNumberUtc(weekStart)),
        avance,
        nuevoIngreso,
        retroceso,
        sinCambios,
      });

      weekStart = new Date(weekStart);
      weekStart.setUTCDate(weekStart.getUTCDate() + 7);
    }

    return rows;
  }

  private opportunityPortfolioBaseWhere(
    filters: AnalyticsScopeFilters,
    _unrestricted: boolean,
  ): Prisma.OpportunityWhereInput {
    const w: Prisma.OpportunityWhereInput = {};
    applyAdvisorFilter(w, filters);
    applySourceFilter(w, filters.sources);
    return w;
  }

  private async buildOpportunitiesWeeklyProgress(
    from: Date,
    to: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    crmScope: CrmDataScope,
  ): Promise<OpportunityWeeklyProgressRow[]> {
    console.log('[DEBUG] buildOpportunitiesWeeklyProgress called:', { from: from.toISOString(), to: to.toISOString() });
    const portfolioWhere: Prisma.OpportunityWhereInput = {
      ...this.opportunityPortfolioBaseWhere(filters, unrestricted),
      // Solo oportunidades relevantes (no perdidas, no inactivas)
      status: { in: ['abierta', 'ganada', 'cerrada'] },
    };

    const [stages, portfolioOpportunities] = await Promise.all([
      this.prisma.crmStage.findMany({
        where: { enabled: true },
        select: { slug: true, probability: true, sortOrder: true },
      }),
      this.prisma.opportunity.findMany({
        where: portfolioWhere,
        select: { id: true, createdAt: true, assignedTo: true },
      }),
    ]);

    // Obtener IDs de oportunidades del portfolio
    const portfolioOppIds = new Set(portfolioOpportunities.map((o) => o.id));

    // Traer auditoría solo de las oportunidades en el portfolio, dentro del rango de fechas
    const auditRows = await this.prisma.auditChangeSet.findMany({
      where: {
        module: 'oportunidades',
        entityType: 'Oportunidad',
        entityId: { in: [...portfolioOppIds] },
        createdAt: { gte: from, lte: to },
        entries: { some: { fieldKey: 'etapa' } },
      },
      include: {
        entries: {
          where: { fieldKey: 'etapa' },
          select: { oldValue: true, newValue: true },
        },
      },
    });

    console.log('[DEBUG] Found:', {
      stagesCount: stages.length,
      opportunitiesCount: portfolioOpportunities.length,
      auditRowsCount: auditRows.length,
    });

    // Debug: muestra algunos IDs de auditoría
    if (auditRows.length > 0) {
      console.log('[DEBUG] Sample audit entityIds:', auditRows.slice(0, 3).map((r) => r.entityId));
      console.log('[DEBUG] Sample opportunity IDs:', portfolioOpportunities.slice(0, 3).map((o) => o.id));
    }

    const stageInfo = new Map<string, { probability: number; sortOrder: number }>();
    for (const s of stages) {
      stageInfo.set(s.slug, { probability: s.probability, sortOrder: s.sortOrder });
    }

    const getStageProbability = (slug: string): number => {
      const info = stageInfo.get(slug.trim());
      return info?.probability ?? 0;
    };

    const portfolioIds = new Set(portfolioOpportunities.map((o) => o.id));

    type AuditEv = { at: Date; oldSlug: string; newSlug: string };
    const auditsByOpp = new Map<string, AuditEv[]>();
    for (const row of auditRows) {
      const id = row.entityId;
      if (!id) continue;
      const et = row.entries[0];
      if (!et) continue;
      const oldSlug = et.oldValue.trim();
      const newSlug = et.newValue.trim();
      if (!oldSlug && !newSlug) continue;
      console.log('[DEBUG] Audit entry:', { entityId: id, oldSlug, newSlug, date: row.createdAt });
      const list = auditsByOpp.get(id) ?? [];
      list.push({ at: row.createdAt, oldSlug, newSlug });
      auditsByOpp.set(id, list);
    }
    for (const [, list] of auditsByOpp) {
      list.sort((a, b) => a.at.getTime() - b.at.getTime());
    }

    console.log('[DEBUG] auditsByOpp:', auditsByOpp.size);

    const rows: OpportunityWeeklyProgressRow[] = [];
    let weekStart = startOfUtcWeekMonday(from);

    while (weekStart <= to) {
      const weekEnd = endOfUtcWeekSunday(weekStart);
      const clipStart = maxUtcDate(weekStart, from);
      const clipEnd = minUtcDate(weekEnd, to);

      // Nuevo ingreso: oportunidades creadas en esta semana
      const nuevoIds = new Set(
        portfolioOpportunities
          .filter((o) => o.createdAt >= clipStart && o.createdAt <= clipEnd)
          .map((o) => o.id),
      );
      const nuevoIngreso = nuevoIds.size;

      // Busca TODOS los cambios de etapa en esta semana
      let avance = 0;
      let atraso = 0;
      let neutralMoves = 0;
      let cambiosEnSemana = 0;

      for (const [oid, evs] of auditsByOpp) {
        const inWeek = evs.filter((e) => e.at >= clipStart && e.at <= clipEnd);
        if (inWeek.length === 0) continue;

        cambiosEnSemana += inWeek.length;

        if (inWeek.length === 1) {
          // Un solo cambio
          const ev = inWeek[0]!;
          const ro = getStageProbability(ev.oldSlug);
          const rn = getStageProbability(ev.newSlug);
          if (rn > ro) avance += 1;
          else if (rn < ro) atraso += 1;
          else neutralMoves += 1;
        } else {
          // Múltiples cambios: comparar primer y último
          const firstEv = inWeek[0]!;
          const lastEv = inWeek[inWeek.length - 1]!;
          const firstProb = getStageProbability(firstEv.oldSlug);
          const lastProb = getStageProbability(lastEv.newSlug);
          if (lastProb > firstProb) {
            // Sumar los avances intermedios también
            for (let i = 0; i < inWeek.length - 1; i++) {
              const curr = getStageProbability(inWeek[i]!.newSlug);
              const next = getStageProbability(inWeek[i + 1]!.newSlug);
              if (next > curr) avance += 1;
              else if (next < curr) atraso += 1;
              else neutralMoves += 1;
            }
          } else if (lastProb < firstProb) {
            for (let i = 0; i < inWeek.length - 1; i++) {
              const curr = getStageProbability(inWeek[i]!.newSlug);
              const next = getStageProbability(inWeek[i + 1]!.newSlug);
              if (next > curr) avance += 1;
              else if (next < curr) atraso += 1;
              else neutralMoves += 1;
            }
          } else {
            // Mismo nivel final que inicial = no cuenta
            neutralMoves += 1;
          }
        }
      }

      // Oportunidades que ya existían en la cartera al final de esta semana
      const portfolioThisWeek = portfolioOpportunities.filter(
        (o) => o.createdAt <= clipEnd,
      ).length;

      // Sin cambios = oportunidades que existían esta semana y no tuvieron ningún movimiento
      const movedThisWeek = nuevoIngreso + avance + atraso + neutralMoves;
      const sinCambios = Math.max(0, portfolioThisWeek - movedThisWeek);

      // Incluir la semana si hay alguna oportunidad en cartera (aunque todo sea sinCambios)
      if (portfolioThisWeek > 0) {
        rows.push({
          name: String(isoWeekNumberUtc(weekStart)),
          avance,
          nuevoIngreso,
          atraso,
          sinCambios,
        });
      }

      weekStart = new Date(weekStart);
      weekStart.setUTCDate(weekStart.getUTCDate() + 7);
    }

    console.log('[DEBUG] buildOpportunitiesWeeklyProgress result:', rows);
    return rows;
  }

  private async buildContactsWeekly(
    from: Date,
    to: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    weeks?: WeekClip[],
  ): Promise<WeeklyMetricRow[]> {
    const weekClips = weeks ?? eachWeekClipsInRange(from, to);
    const counts = new Map<string, number>(weekClips.map((w) => [w.name, 0]));
    const contacts = await this.prisma.contact.findMany({
      where: this.contactWhere(from, to, filters, unrestricted),
      select: { createdAt: true },
    });
    for (const c of contacts) {
      const key = weekNameForDate(c.createdAt, weekClips);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return weekClips.map((w) => ({ name: w.name, value: counts.get(w.name) ?? 0 }));
  }

  private async buildSalesWeekly(
    from: Date,
    to: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    weeks?: WeekClip[],
  ): Promise<WeeklyMetricRow[]> {
    const weekClips = weeks ?? eachWeekClipsInRange(from, to);
    const totals = new Map<string, number>(weekClips.map((w) => [w.name, 0]));
    const won = await this.prisma.opportunity.findMany({
      where: this.opportunityWhereWonInRange(from, to, filters, unrestricted),
      select: { updatedAt: true, amount: true },
    });
    for (const o of won) {
      const key = weekNameForDate(o.updatedAt, weekClips);
      if (key) totals.set(key, (totals.get(key) ?? 0) + (o.amount ?? 0));
    }
    return weekClips.map((w) => ({ name: w.name, value: totals.get(w.name) ?? 0 }));
  }

  private async buildWonOpportunitiesWeekly(
    from: Date,
    to: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    weeks?: WeekClip[],
  ): Promise<WeeklyMetricRow[]> {
    const weekClips = weeks ?? eachWeekClipsInRange(from, to);
    const counts = new Map<string, number>(weekClips.map((w) => [w.name, 0]));
    const won = await this.prisma.opportunity.findMany({
      where: this.opportunityWhereWonInRange(from, to, filters, unrestricted),
      select: { updatedAt: true },
    });
    for (const o of won) {
      const key = weekNameForDate(o.updatedAt, weekClips);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return weekClips.map((w) => ({ name: w.name, value: counts.get(w.name) ?? 0 }));
  }

  private async buildActivitiesCompletedWeekly(
    from: Date,
    to: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    weeks?: WeekClip[],
  ): Promise<WeeklyMetricRow[]> {
    const weekClips = weeks ?? eachWeekClipsInRange(from, to);
    const counts = new Map<string, number>(weekClips.map((w) => [w.name, 0]));
    const acts = await this.prisma.activity.findMany({
      where: this.activityWhereForAnalytics(
        {
          ...TASK_ACTIVITY_FILTER,
          completedAt: { gte: from, lte: to },
        },
        filters,
        unrestricted,
      ),
      select: { completedAt: true },
    });
    for (const a of acts) {
      if (!a.completedAt) continue;
      const key = weekNameForDate(a.completedAt, weekClips);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return weekClips.map((w) => ({ name: w.name, value: counts.get(w.name) ?? 0 }));
  }

  private opportunityWhereOpen(
    filters: AnalyticsScopeFilters,
    _unrestricted: boolean,
    from?: Date,
    to?: Date,
  ): Prisma.OpportunityWhereInput {
    const w: Prisma.OpportunityWhereInput = {
      status: 'abierta',
    };
    if (from && to) {
      w.createdAt = { gte: from, lte: to };
    }
    applyAdvisorFilter(w, filters);
    return w;
  }

  private opportunityWhereWonInRange(
    from: Date,
    to: Date,
    filters: AnalyticsScopeFilters,
    _unrestricted: boolean,
  ): Prisma.OpportunityWhereInput {
    const w: Prisma.OpportunityWhereInput = {
      status: 'ganada',
      etapa: 'activo',
      updatedAt: { gte: from, lte: to },
    };
    applyAdvisorFilter(w, filters);
    return w;
  }

  private opportunityWhereCreatedInRange(
    from: Date,
    to: Date,
    filters: AnalyticsScopeFilters,
    _unrestricted: boolean,
  ): Prisma.OpportunityWhereInput {
    const w: Prisma.OpportunityWhereInput = {
      createdAt: { gte: from, lte: to },
    };
    applyAdvisorFilter(w, filters);
    applySourceFilter(w, filters.sources);
    return w;
  }

  private activityWhereForAnalytics(
    base: Prisma.ActivityWhereInput,
    filters: AnalyticsScopeFilters,
    _unrestricted: boolean,
  ): Prisma.ActivityWhereInput {
    const w: Prisma.ActivityWhereInput = { ...base };
    applyActivityAdvisorFilter(w, filters);
    return w;
  }

  /** Resumen principal: dashboard y reportes (misma fuente de datos). */
  async getSummary(opts: {
    from?: string;
    to?: string;
    advisorId?: string;
    assignedTo?: string;
    excludeAssignedTo?: string;
    advisorPool?: string;
    source?: string;
    area?: string;
    crmScope: CrmDataScope;
    /** Semanas para series sparkline KPI; dashboard 8, reportes 10. */
    sparklineWeeks?: number;
  }) {
    const { from, to } = this.resolveRange(opts.from, opts.to);
    console.log('[DEBUG-BACKEND] getSummary range:', { from: from.toISOString(), to: to.toISOString() });
    const unrestricted = opts.crmScope.unrestricted;
    const filters = await this.resolveScopeFilters({
      advisorId: opts.advisorId,
      assignedTo: opts.assignedTo,
      excludeAssignedTo: opts.excludeAssignedTo,
      advisorPool: opts.advisorPool,
      source: opts.source,
      unrestricted,
      viewerUserId: opts.crmScope.viewerUserId,
    });
    const metaAdvisorId = singleAdvisorIdForMeta(filters);

    const cw = this.contactWhere(from, to, filters, unrestricted);
    const compW = mergeCompanyScope(
      this.companyWhere(from, to, filters, unrestricted),
      opts.crmScope,
    );

    const [
      totalContacts,
      newContactsInRange,
      activeOpportunities,
      closedAgg,
      pipelineAgg,
      pendingActivitiesCount,
      overdueActivitiesCount,
      activitiesCompletedCount,
      sourceGroups,
      funnelGroups,
      userRows,
      companyStageGroups,
      totalOppsCreated,
      companySourceGroups,
      opportunitySourceGroups,
      rolling7,
    ] = await Promise.all([
      this.prisma.contact.count({ where: cw }),
      this.prisma.contact.count({ where: cw }),
      this.prisma.opportunity.count({
        where: this.opportunityWhereOpen(filters, unrestricted, from, to),
      }),
      this.prisma.opportunity.aggregate({
        where: this.opportunityWhereWonInRange(from, to, filters, unrestricted),
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.opportunity.aggregate({
        where: this.opportunityWhereOpen(filters, unrestricted, from, to),
        _sum: { amount: true },
      }),
      this.prisma.activity.count({
        where: this.activityWhereForAnalytics(
          {
            ...TASK_ACTIVITY_FILTER,
            status: 'pendiente',
          },
          filters,
          unrestricted,
        ),
      }),
      this.prisma.activity.count({
        where: this.activityWhereForAnalytics(
          {
            ...TASK_ACTIVITY_FILTER,
            status: 'pendiente',
            dueDate: { lt: new Date() },
          },
          filters,
          unrestricted,
        ),
      }),
      this.prisma.activity.count({
        where: this.activityWhereForAnalytics(
          {
            ...TASK_ACTIVITY_FILTER,
            completedAt: { gte: from, lte: to },
          },
          filters,
          unrestricted,
        ),
      }),
      this.prisma.contact.groupBy({
        by: ['fuente'],
        where: cw,
        _count: { id: true },
      }),
      this.prisma.contact.groupBy({
        by: ['etapa'],
        where: cw,
        _count: { id: true },
      }),
      opts.crmScope.unrestricted
        ? this.prisma.user.findMany({
            where: {
              role: { slug: ADVISOR_ROLE_SLUG },
              ...(opts.area ? { allowedAreas: { has: opts.area } } : {}),
            },
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
      this.prisma.company.groupBy({
        by: ['etapa'],
        where: compW,
        _count: { id: true },
      }),
      this.prisma.opportunity.count({
        where: {
          createdAt: { gte: from, lte: to },
          ...advisorWhereFromFilters(filters),
        },
      }),
      this.prisma.company.groupBy({
        by: ['fuente'],
        where: compW,
        _count: { id: true },
      }),
      this.prisma.opportunity.groupBy({
        by: ['fuente'],
        where: this.opportunityWhereCreatedInRange(from, to, filters, unrestricted),
        _count: { id: true },
      }),
      this.fetchRolling7DayChangeInputs(filters, unrestricted),
    ]);

    const closedSalesAmount = closedAgg._sum.amount ?? 0;
    const closedSalesPrev = rolling7.salesPrev7d;
    const totalContactsPrev = rolling7.contactsPrev7d;
    const pipelineValue = pipelineAgg._sum.amount ?? 0;

    /** Oportunidades ganadas en el periodo (status = 'ganada') */
    const conversionPct = closedAgg._count ?? 0;

    const months = eachMonthBetween(from, to);

    const monthStartDates = months.map((ym) => {
      const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
      return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    });

    /** Sin asesor: meta equipo por mes. Con asesor: solo filas CrmUserMonthlySalesTarget (mes sin fila → 0). */
    const metaByYm = new Map<string, number>();
    const advisorMetaByYm = new Map<string, number>();
    if (metaAdvisorId) {
      const userMonthRows =
        monthStartDates.length > 0
          ? await this.prisma.crmUserMonthlySalesTarget.findMany({
              where: {
                userId: metaAdvisorId,
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

    const wonOppRowsForMonthBreakdown = await this.prisma.opportunity.findMany({
      where: this.opportunityWhereWonInRange(from, to, filters, unrestricted),
      select: {
        id: true,
        title: true,
        amount: true,
        updatedAt: true,
        companies: {
          take: 1,
          select: { company: { select: { name: true } } },
        },
      },
      orderBy: { amount: 'desc' },
    });

    const WON_OPP_PER_MONTH_MAX = 50;
    const wonOppByMonth = new Map<
      string,
      { id: string; title: string; amount: number; companyName: string | null }[]
    >();
    for (const ym of months) {
      wonOppByMonth.set(ym, []);
    }
    for (const o of wonOppRowsForMonthBreakdown) {
      for (const ym of months) {
        const { start, end } = clipMonthToAnalyticsRange(ym, from, to);
        if (o.updatedAt >= start && o.updatedAt <= end) {
          wonOppByMonth.get(ym)!.push({
            id: o.id,
            title: o.title,
            amount: o.amount,
            companyName: o.companies[0]?.company.name ?? null,
          });
          break;
        }
      }
    }
    for (const ym of months) {
      const sorted = (wonOppByMonth.get(ym) ?? [])
        .sort((a, b) => b.amount - a.amount)
        .slice(0, WON_OPP_PER_MONTH_MAX);
      wonOppByMonth.set(ym, sorted);
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
            filters,
            unrestricted,
          ),
          _sum: { amount: true },
        });
        const meta = metaAdvisorId
          ? (advisorMetaByYm.get(ym) ?? 0)
          : (metaByYm.get(ym) ?? 0);
        return {
          name: monthLabelEs(ym),
          ventas: agg._sum.amount ?? 0,
          meta,
          oportunidadesGanadas: wonOppByMonth.get(ym) ?? [],
        };
      }),
    );

    const leadCatalog = await this.prisma.crmLeadSource.findMany({
      where: { enabled: true },
      select: { slug: true, name: true },
    });
    const mergedBySource = new Map<string, number>();
    for (const g of sourceGroups) {
      const k = resolveLeadSourceKeyLoose(g.fuente, leadCatalog);
      mergedBySource.set(k, (mergedBySource.get(k) ?? 0) + g._count.id);
    }
    const contactsBySource = [...mergedBySource.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const mergedByOpportunitySource = new Map<string, number>();
    for (const g of opportunitySourceGroups) {
      if (!g.fuente) continue;
      const k = resolveLeadSourceKeyLoose(g.fuente, leadCatalog);
      mergedByOpportunitySource.set(k, (mergedByOpportunitySource.get(k) ?? 0) + g._count.id);
    }
    const opportunitiesBySource = [...mergedByOpportunitySource.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const funnelByStage = funnelGroups
      .map((g) => ({
        name: g.etapa,
        value: g._count.id,
      }))
      .sort((a, b) => b.value - a.value);

    const companiesByStage = companyStageGroups.map((g) => ({
      name: g.etapa,
      value: g._count.id,
    }));

    const mergedByCompanySource = new Map<string, number>();
    for (const g of companySourceGroups) {
      if (!g.fuente) continue;
      const k = resolveLeadSourceKeyLoose(g.fuente, leadCatalog);
      mergedByCompanySource.set(k, (mergedByCompanySource.get(k) ?? 0) + g._count.id);
    }
    const companiesBySource = [...mergedByCompanySource.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const opportunitiesByStage = await this.prisma.opportunity.groupBy({
      by: ['etapa'],
      where: (() => {
        const w: Prisma.OpportunityWhereInput = {
          createdAt: { gte: from, lte: to },
        };
        applyAdvisorFilter(w, filters);
        return w;
      })(),
      _count: { id: true },
    });
    const opportunitiesByStageData2 = opportunitiesByStage
      .map((g) => ({
        name: g.etapa,
        count: g._count.id,
      }))
      .sort((a, b) => b.count - a.count);

    const groupByWhere = performanceGroupByWhere(from, to, filters);

    const oppCountByAdvisor = await this.prisma.opportunity.groupBy({
      by: ['assignedTo'],
      where: groupByWhere as Prisma.OpportunityWhereInput,
      _count: { id: true },
    });
    const contactCountByAdvisor = await this.prisma.contact.groupBy({
      by: ['assignedTo'],
      where: groupByWhere,
      _count: { id: true },
    });
    const companyCountByAdvisor = await this.prisma.company.groupBy({
      by: ['assignedTo'],
      where: groupByWhere as Prisma.CompanyWhereInput,
      _count: { id: true },
    });
    const oppCountMap = new Map(
      oppCountByAdvisor
        .filter((x) => x.assignedTo)
        .map((x) => [x.assignedTo!, x._count.id]),
    );
    const contactCountMap = new Map(
      contactCountByAdvisor
        .filter((x) => x.assignedTo)
        .map((x) => [x.assignedTo!, x._count.id]),
    );
    const companyCountMap = new Map(
      companyCountByAdvisor
        .filter((x) => x.assignedTo)
        .map((x) => [x.assignedTo!, x._count.id]),
    );
    const idToName = new Map(
      userRows.map((u) => [u.id, u.name.trim() || 'Sin nombre'] as const),
    );
    const advisorIds = new Set<string>();
    for (const k of oppCountMap.keys()) advisorIds.add(k);
    for (const k of contactCountMap.keys()) if (k) advisorIds.add(k!);
    for (const k of companyCountMap.keys()) if (k) advisorIds.add(k!);

    const missingNameIds = [...advisorIds].filter((id) => !idToName.has(id));
    if (missingNameIds.length > 0) {
      const resolved = await this.prisma.user.findMany({
        where: { id: { in: missingNameIds } },
        select: { id: true, name: true },
      });
      for (const u of resolved) {
        idToName.set(u.id, u.name.trim() || 'Sin nombre');
      }
    }

    const performanceByAdvisor = [...advisorIds]
      .map((id) => ({
        name: idToName.get(id) ?? 'Usuario no encontrado',
        oportunidades: oppCountMap.get(id) ?? 0,
        contactos: contactCountMap.get(id) ?? 0,
        empresas: companyCountMap.get(id) ?? 0,
      }))
      .filter((r) => r.oportunidades > 0 || r.contactos > 0 || r.empresas > 0)
      .sort((a, b) => b.oportunidades - a.oportunidades)
      .slice(0, 20);

    const pendingActivities = await this.prisma.activity.findMany({
      where: this.activityWhereForAnalytics(
        {
          ...TASK_ACTIVITY_FILTER,
          status: 'pendiente',
        },
        filters,
        unrestricted,
      ),
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

    /** Serie mensual: contactos y oportunidades creados por mes en el rango */
    const contactsByMonthMap = new Map<string, number>();
    const oppsByMonthMap = new Map<string, number>();
    for (const ym of months) {
      contactsByMonthMap.set(ym, 0);
      oppsByMonthMap.set(ym, 0);
    }
    const contactsInRange = await this.prisma.contact.findMany({
      where: cw,
      select: { createdAt: true },
    });
    for (const c of contactsInRange) {
      const key = monthKey(c.createdAt);
      if (contactsByMonthMap.has(key)) {
        contactsByMonthMap.set(key, (contactsByMonthMap.get(key) ?? 0) + 1);
      }
    }
    const oppsInRange = await this.prisma.opportunity.findMany({
      where: this.opportunityWhereCreatedInRange(from, to, filters, unrestricted),
      select: { createdAt: true },
    });
    for (const o of oppsInRange) {
      const key = monthKey(o.createdAt);
      if (oppsByMonthMap.has(key)) {
        oppsByMonthMap.set(key, (oppsByMonthMap.get(key) ?? 0) + 1);
      }
    }
    const contactsVsOpportunitiesByMonth = months.map((ym) => ({
      name: monthLabelEs(ym),
      contactos: contactsByMonthMap.get(ym) ?? 0,
      oportunidades: oppsByMonthMap.get(ym) ?? 0,
    }));

    /** Conversión por mes (oportunidades ganadas en el mes) */
    const conversionByMonth = await Promise.all(
      months.map(async (ym) => {
        const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
        const mStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
        const mEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
        const cFrom = mStart > from ? mStart : from;
        const cTo = mEnd < to ? mEnd : to;
        const ganadas = await this.prisma.opportunity.count({
          where: this.opportunityWhereWonInRange(cFrom, cTo, filters, unrestricted),
        });
        return { name: monthLabelEs(ym), tasa: ganadas };
      }),
    );

    /** Actividades por tipo y mes (completadas) */
    const activitiesByTypeMonth: Record<
      string,
      { llamadas: number; reuniones: number; correos: number; notas: number }
    > = {};
    for (const ym of months) {
      activitiesByTypeMonth[ym] = { llamadas: 0, reuniones: 0, correos: 0, notas: 0 };
    }
    const actsDone = await this.prisma.activity.findMany({
      where: this.activityWhereForAnalytics(
        { completedAt: { gte: from, lte: to } },
        filters,
        unrestricted,
      ),
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
      else if (t === 'nota') activitiesByTypeMonth[key].notas += 1;
    }
    const activitiesByTypeData = months.map((ym) => ({
      name: monthLabelEs(ym),
      ...activitiesByTypeMonth[ym],
    }));

    /** Oportunidades abiertas por etapa (conteo + suma de montos) */
    const oppsByStage = await this.prisma.opportunity.groupBy({
      by: ['etapa'],
      where: this.opportunityWhereOpen(filters, unrestricted, from, to),
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
        const [completados, pendientes] = await Promise.all([
          this.prisma.activity.count({
            where: this.activityWhereForAnalytics(
              {
                ...TASK_ACTIVITY_FILTER,
                completedAt: { gte: cFrom, lte: cTo },
              },
              filters,
              unrestricted,
            ),
          }),
          this.prisma.activity.count({
            where: this.activityWhereForAnalytics(
              {
                ...TASK_ACTIVITY_FILTER,
                status: 'pendiente',
                dueDate: { gte: cFrom, lte: cTo },
              },
              filters,
              unrestricted,
            ),
          }),
        ]);
        return {
          name: monthLabelEs(ym),
          completados,
          pendientes,
        };
      }),
    );

    const companiesWeeklyProgress = await this.buildCompaniesWeeklyProgress(
      from,
      to,
      filters,
      unrestricted,
      opts.crmScope,
    );

    const opportunitiesWeeklyProgress = await this.buildOpportunitiesWeeklyProgress(
      from,
      to,
      filters,
      unrestricted,
      opts.crmScope,
    );

    const sparkWeeks =
      opts.sparklineWeeks === REPORTS_SPARKLINE_WEEKS
        ? REPORTS_SPARKLINE_WEEKS
        : DASHBOARD_SPARKLINE_WEEKS;
    const { from: sparkFrom, to: sparkTo, weeks: sparklineWeeks } = sparklineRange(sparkWeeks);

    const [contactsWeekly, salesWeekly, wonOpportunitiesWeekly, activitiesCompletedWeekly, opportunitiesWeeklySparklineProgress] = await Promise.all([
      this.buildContactsWeekly(
        sparkFrom,
        sparkTo,
        filters,
        unrestricted,
        sparklineWeeks,
      ),
      this.buildSalesWeekly(sparkFrom, sparkTo, filters, unrestricted, sparklineWeeks),
      this.buildWonOpportunitiesWeekly(sparkFrom, sparkTo, filters, unrestricted, sparklineWeeks),
      this.buildActivitiesCompletedWeekly(sparkFrom, sparkTo, filters, unrestricted, sparklineWeeks),
      this.buildOpportunitiesWeeklyProgress(
        sparkFrom,
        sparkTo,
        filters,
        unrestricted,
        opts.crmScope,
      ),
    ]);

    const oppSparkByWeek = new Map(
      opportunitiesWeeklySparklineProgress.map((row) => [row.name, row.avance + row.nuevoIngreso]),
    );
    const opportunitiesWeeklySparkline = sparklineWeeks.map((w) => ({
      name: w.name,
      value: oppSparkByWeek.get(w.name) ?? 0,
    }));

    /** Contactos con/sin interacción en el periodo */
    const contactPortfolioWhere = this.contactWhere(from, to, filters, unrestricted);
    const contactIds = await this.prisma.contact.findMany({
      where: contactPortfolioWhere,
      select: { id: true },
    });
    const contactIdSet = new Set(contactIds.map((c) => c.id));

    const [activityContacts, auditContacts] = await Promise.all([
      this.prisma.contactActivity.findMany({
        where: {
          contactId: { in: [...contactIdSet] },
          activity: { createdAt: { gte: from, lte: to } },
        },
        select: { contactId: true },
        distinct: ['contactId'],
      }),
      this.prisma.auditChangeSet.findMany({
        where: {
          module: 'contactos',
          entityType: 'Contacto',
          entityId: { in: [...contactIdSet] },
          createdAt: { gte: from, lte: to },
        },
        select: { entityId: true },
        distinct: ['entityId'],
      }),
    ]);
    const withInteraction = new Set<string>();
    for (const a of activityContacts) withInteraction.add(a.contactId);
    for (const a of auditContacts) if (a.entityId) withInteraction.add(a.entityId);
    const withInteractionCount = withInteraction.size;
    const withoutInteractionCount = Math.max(0, contactIdSet.size - withInteractionCount);
    const opportunitiesInteraction = {
      withInteraction: withInteractionCount,
      withoutInteraction: withoutInteractionCount,
    };

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
          contacts: pctChange(rolling7.contacts7d, rolling7.contactsPrev7d),
          opportunities: pctChange(rolling7.opportunities7d, rolling7.opportunitiesPrev7d),
          sales: pctChange(rolling7.sales7d, rolling7.salesPrev7d),
        },
      },
      salesByMonth,
      contactsBySource,
      opportunitiesBySource,
      companiesBySource,
      funnelByStage,
      companiesByStage,
      companiesWeeklyProgress,
      opportunitiesWeeklyProgress,
      contactsWeekly,
      salesWeekly,
      wonOpportunitiesWeekly,
      activitiesCompletedWeekly,
      opportunitiesWeeklySparkline,
      performanceByAdvisor,
      pendingActivities: pendingActivitiesDto,
      contactsVsOpportunitiesByMonth,
      conversionByMonth,
      activitiesByTypeData,
      opportunitiesByStageData,
      opportunitiesByStage: opportunitiesByStageData2,
      followUpsByMonth,
      opportunitiesInteraction,
    };
  }

  private async resolveWeeklyGoalAmount(teamScope: boolean, userId: string): Promise<number> {
    if (teamScope) {
      const org = await this.prisma.crmOrganizationProfile.findUnique({ where: { id: 'default' } });
      return org?.globalWeeklyGoal ?? 0;
    }
    const goal = await this.prisma.crmUserSalesGoal.findUnique({
      where: { userId },
      select: { weeklyTarget: true },
    });
    return goal?.weeklyTarget ?? 0;
  }

  private async resolveMonthlyGoalsByYm(
    teamScope: boolean,
    userId: string,
    monthStarts: Date[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (monthStarts.length === 0) return map;
    if (teamScope) {
      const rows = await this.prisma.crmMonthlySalesTarget.findMany({
        where: {
          organizationId: 'default',
          periodStart: { in: monthStarts },
        },
        select: { periodStart: true, amount: true },
      });
      for (const row of rows) {
        map.set(monthKey(row.periodStart), row.amount);
      }
    } else {
      const rows = await this.prisma.crmUserMonthlySalesTarget.findMany({
        where: {
          userId,
          periodStart: { in: monthStarts },
        },
        select: { periodStart: true, amount: true },
      });
      for (const row of rows) {
        map.set(monthKey(row.periodStart), row.amount);
      }
    }
    return map;
  }

  private wonOppsPortfolioFilter(
    teamScope: boolean,
    userId: string,
  ): Prisma.OpportunityWhereInput {
    return teamScope ? {} : { assignedTo: userId };
  }

  private async buildGoalsWeeklyChart(
    teamScope: boolean,
    userId: string,
  ): Promise<GoalChartPoint[]> {
    const { from, to, weeks } = sparklineRange(DASHBOARD_SPARKLINE_WEEKS);
    const weeklyGoal = await this.resolveWeeklyGoalAmount(teamScope, userId);
    const portfolio = this.wonOppsPortfolioFilter(teamScope, userId);
    const totals = new Map<string, number>(weeks.map((w) => [w.name, 0]));
    const won = await this.prisma.opportunity.findMany({
      where: {
        status: 'ganada',
        updatedAt: { gte: from, lte: to },
        ...portfolio,
      },
      select: { updatedAt: true, amount: true },
    });
    for (const o of won) {
      const key = weekNameForDate(o.updatedAt, weeks);
      if (key) totals.set(key, (totals.get(key) ?? 0) + (o.amount ?? 0));
    }
    return weeks.map((w) => ({
      name: `S${w.name}`,
      meta: weeklyGoal,
      avance: totals.get(w.name) ?? 0,
    }));
  }

  private async buildGoalsMonthlyChart(
    teamScope: boolean,
    userId: string,
  ): Promise<GoalChartPoint[]> {
    const months = lastNMonthClips(GOALS_MONTHLY_CHART);
    const monthStarts = months.map((m) => m.clipStart);
    const metaByYm = await this.resolveMonthlyGoalsByYm(teamScope, userId, monthStarts);
    const portfolio = this.wonOppsPortfolioFilter(teamScope, userId);
    const rangeFrom = months[0]?.clipStart ?? new Date();
    const rangeTo = months[months.length - 1]?.clipEnd ?? new Date();
    const won = await this.prisma.opportunity.findMany({
      where: {
        status: 'ganada',
        updatedAt: { gte: rangeFrom, lte: rangeTo },
        ...portfolio,
      },
      select: { updatedAt: true, amount: true },
    });
    const totals = new Map<string, number>(months.map((m) => [m.ym, 0]));
    for (const o of won) {
      for (const m of months) {
        if (o.updatedAt >= m.clipStart && o.updatedAt <= m.clipEnd) {
          totals.set(m.ym, (totals.get(m.ym) ?? 0) + (o.amount ?? 0));
          break;
        }
      }
    }
    return months.map((m) => ({
      name: m.label,
      meta: metaByYm.get(m.ym) ?? 0,
      avance: totals.get(m.ym) ?? 0,
    }));
  }

  /** Montos cerrados (ganadas) para metas: semana ISO actual y mes calendario UTC. */
  async getGoalProgress(
    viewerUserId: string,
    advisorId: string | undefined,
    crmScope: CrmDataScope,
    area?: string,
  ) {
    const isUnrestricted = crmScope.unrestricted;
    const targetAdvisorId = isUnrestricted
      ? advisorId?.trim() || undefined
      : viewerUserId;

    const now = new Date();
    const weekStart = startOfUtcWeekMonday(now);
    const weekEnd = endOfUtcWeekSunday(now);
    const monthStart = startOfUtcMonth(now);
    const monthEnd = endOfUtcMonth(now);

    const portfolio = isUnrestricted ? {} : { assignedTo: viewerUserId };
    const myPortfolio = {};
    const teamScope = isUnrestricted;
    const chartUserId = viewerUserId;

    const [teamWeek, teamMonth, myWeek, myMonth, weeklyChart, monthlyChart] = await Promise.all([
      this.prisma.opportunity.aggregate({
        where: {
          status: 'ganada',
          updatedAt: { gte: weekStart, lte: weekEnd },
          ...portfolio,
        },
        _sum: { amount: true },
      }),
      this.prisma.opportunity.aggregate({
        where: {
          status: 'ganada',
          updatedAt: { gte: monthStart, lte: monthEnd },
          ...portfolio,
        },
        _sum: { amount: true },
      }),
      this.prisma.opportunity.aggregate({
        where: {
          status: 'ganada',
          updatedAt: { gte: weekStart, lte: weekEnd },
          assignedTo: targetAdvisorId,
          ...myPortfolio,
        },
        _sum: { amount: true },
      }),
      this.prisma.opportunity.aggregate({
        where: {
          status: 'ganada',
          updatedAt: { gte: monthStart, lte: monthEnd },
          assignedTo: targetAdvisorId,
          ...myPortfolio,
        },
        _sum: { amount: true },
      }),
      this.buildGoalsWeeklyChart(teamScope, chartUserId),
      this.buildGoalsMonthlyChart(teamScope, chartUserId),
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
      weeklyChart,
      monthlyChart,
    };
  }

  /** KPIs rápidos (sin charts) para carga priorizada. */
  async getKPIs(opts: {
    from?: string;
    to?: string;
    advisorId?: string;
    assignedTo?: string;
    excludeAssignedTo?: string;
    advisorPool?: string;
    source?: string;
    area?: string;
    crmScope: CrmDataScope;
  }) {
    const { from, to } = this.resolveRange(opts.from, opts.to);
    const unrestricted = opts.crmScope.unrestricted;
    const filters = await this.resolveScopeFilters({
      advisorId: opts.advisorId,
      assignedTo: opts.assignedTo,
      excludeAssignedTo: opts.excludeAssignedTo,
      advisorPool: opts.advisorPool,
      source: opts.source,
      unrestricted,
      viewerUserId: opts.crmScope.viewerUserId,
    });

    const cw = this.contactWhere(from, to, filters, unrestricted);

    const [
      totalContacts,
      newContactsInRange,
      activeOpportunities,
      closedAgg,
      pipelineAgg,
      pendingActivitiesCount,
      overdueActivitiesCount,
      activitiesCompletedCount,
      totalOppsCreated,
      rolling7,
    ] = await Promise.all([
      this.prisma.contact.count({ where: cw }),
      this.prisma.contact.count({ where: cw }),
      this.prisma.opportunity.count({
        where: this.opportunityWhereOpen(filters, unrestricted, from, to),
      }),
      this.prisma.opportunity.aggregate({
        where: this.opportunityWhereWonInRange(from, to, filters, unrestricted),
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.opportunity.aggregate({
        where: this.opportunityWhereOpen(filters, unrestricted, from, to),
        _sum: { amount: true },
      }),
      this.prisma.activity.count({
        where: this.activityWhereForAnalytics(
          { ...TASK_ACTIVITY_FILTER, status: 'pendiente' },
          filters,
          unrestricted,
        ),
      }),
      this.prisma.activity.count({
        where: this.activityWhereForAnalytics(
          { ...TASK_ACTIVITY_FILTER, status: 'pendiente', dueDate: { lt: new Date() } },
          filters,
          unrestricted,
        ),
      }),
      this.prisma.activity.count({
        where: this.activityWhereForAnalytics(
          { ...TASK_ACTIVITY_FILTER, completedAt: { gte: from, lte: to } },
          filters,
          unrestricted,
        ),
      }),
      this.prisma.opportunity.count({
        where: {
          createdAt: { gte: from, lte: to },
          ...advisorWhereFromFilters(filters),
        },
      }),
      this.fetchRolling7DayChangeInputs(filters, unrestricted),
    ]);

    const closedSalesAmount = closedAgg._sum.amount ?? 0;
    const closedSalesPrev = rolling7.salesPrev7d;
    const totalContactsPrev = rolling7.contactsPrev7d;
    const pipelineValue = pipelineAgg._sum.amount ?? 0;

    const conversionPct = closedAgg._count ?? 0;

    return {
      range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
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
        contacts: pctChange(rolling7.contacts7d, rolling7.contactsPrev7d),
        opportunities: pctChange(rolling7.opportunities7d, rolling7.opportunitiesPrev7d),
        sales: pctChange(rolling7.sales7d, rolling7.salesPrev7d),
      },
    };
  }
}
