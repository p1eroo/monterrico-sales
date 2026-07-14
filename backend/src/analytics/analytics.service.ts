import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { CrmDataScope } from '../auth/crm-data-scope.service';
import { mergeCompanyScope } from '../common/crm-data-scope-where.util';
import { STAGE_PROBABILITY_FALLBACK } from '../crm-config/crm-config.constants';
import { CrmConfigService } from '../crm-config/crm-config.service';
import { buildEtapaStepFunction, buildNumericStepFunction } from '../import-export/company-export-weeks.util';
import { resolveLeadSourceKeyLoose } from '../crm-config/lead-source-normalize.util';
import {
  endOfMonthLima,
  endOfWeekSundayLima,
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
  isoWeekLabelFromInstant,
  formatIsoWeekLabel,
} from '../common/crm-timezone.util';
import {
  ADVISOR_OTHERS,
  ADVISOR_UNASSIGNED,
} from '../common/advisor-filter.util';
import { findCommercialAdvisorUsers } from '../common/commercial-advisor-users.util';
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
  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
  ];
  return `${months[(m ?? 1) - 1]} ${y}`;
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

/** Intersección del mes calendario Lima `ym` (YYYY-MM) con el rango de analytics. */
function clipMonthToAnalyticsRange(ym: string, from: Date, to: Date): { start: Date; end: Date } {
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
  const mStart = limaDayStart(y, m - 1, 1);
  const mEnd = endOfMonthLima(mStart);
  const start = mStart.getTime() > from.getTime() ? mStart : from;
  const end = mEnd.getTime() < to.getTime() ? mEnd : to;
  return { start, end };
}

type CompanyWeeklyProgressRow = {
  name: string;
  avance: number;
  nuevoIngreso: number;
  atraso: number;
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

type ActiveProspectStageRow = {
  slug: string;
  name: string;
  probability: number;
  count: number;
};

type ActiveProspectsWeekRow = {
  name: string;
  weekStart: string;
  weekEnd: string;
  total: number;
  byStage: ActiveProspectStageRow[];
};

type ActiveProspectsWeeklySnapshot = {
  weeks: ActiveProspectsWeekRow[];
  currentTotal: number;
  changePct: number | null;
};

type CompanyWeeklyStageRow = ActiveProspectsWeekRow;

type CompanyWeeklyStageSnapshot = ActiveProspectsWeeklySnapshot;

type EstimatedBillingStageRow = {
  slug: string;
  name: string;
  probability: number;
  amount: number;
};

type EstimatedBillingWeekRow = {
  name: string;
  weekStart: string;
  weekEnd: string;
  total: number;
  byStage: EstimatedBillingStageRow[];
};

type EstimatedBillingWeeklySnapshot = {
  weeks: EstimatedBillingWeekRow[];
  currentTotal: number;
  changePct: number | null;
};

type ActiveProspectsAdvisorStageRow = {
  slug: string;
  name: string;
  probability: number;
  countsByAdvisor: Record<string, number>;
};

type ActiveProspectsAdvisorWeekRow = {
  name: string;
  weekStart: string;
  weekEnd: string;
  advisors: { id: string; name: string }[];
  stages: ActiveProspectsAdvisorStageRow[];
  estimatedBillingByAdvisor: Record<string, number>;
};

type ActiveProspectsByAdvisorWeeklySnapshot = {
  weeks: ActiveProspectsAdvisorWeekRow[];
};

type AdvisorFunnelMovementMetricsRow = {
  nuevoIngreso: number;
  avance: number;
  atraso: number;
  sinCambios: number;
};

type AdvisorFunnelMovementAdvisorRow = {
  id: string;
  name: string;
  activeProspects: number;
  metrics: AdvisorFunnelMovementMetricsRow;
};

type AdvisorFunnelMovementPeriodRow = {
  fromWeekNumber: number;
  toWeekNumber: number;
  fromWeekLabel: string;
  toWeekLabel: string;
  title: string;
  advisors: AdvisorFunnelMovementAdvisorRow[];
};

type CompaniesAdvisorFunnelMovementSnapshot = {
  currentWeekLabel: string;
  periods: AdvisorFunnelMovementPeriodRow[];
};

type AdvisorFunnelMovementMetricKey =
  | 'nuevoIngreso'
  | 'avance'
  | 'atraso'
  | 'sinCambios';

type AdvisorFunnelMovementCompanyRow = {
  id: string;
  name: string;
  urlSlug: string;
  etapa: string;
  etapaLabel: string;
};

type AdvisorFunnelMovementCompaniesPage = {
  data: AdvisorFunnelMovementCompanyRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const ADVISOR_FUNNEL_METRIC_TO_CATEGORY: Record<
  AdvisorFunnelMovementMetricKey,
  'nuevo' | 'avance' | 'atraso' | 'sinCambios'
> = {
  nuevoIngreso: 'nuevo',
  avance: 'avance',
  atraso: 'atraso',
  sinCambios: 'sinCambios',
};

type CompaniesBySourceWeekRow = {
  name: string;
  weekStart: string;
  weekEnd: string;
  sources: { slug: string; value: number }[];
};

type CompaniesBySourceWeeklySnapshot = {
  weeks: CompaniesBySourceWeekRow[];
};

type ActivitiesByTypeWeeklyRow = {
  key: 'llamadas' | 'reuniones' | 'correos' | 'notas';
  label: string;
  counts: number[];
  total: number;
};

type ActivitiesByTypeWeeklySnapshot = {
  weeks: { name: string; weekStart: string; weekEnd: string }[];
  types: ActivitiesByTypeWeeklyRow[];
  maxCount: number;
};

type ActivitiesByAdvisorWeeklyRow = {
  advisorId: string;
  advisorName: string;
  llamadas: number;
  reuniones: number;
  correos: number;
  notas: number;
  total: number;
  byWeek: {
    llamadas: number;
    reuniones: number;
    correos: number;
    notas: number;
    total: number;
  }[];
};

type ActivitiesByAdvisorWeeklySnapshot = {
  weeks: { name: string; weekStart: string; weekEnd: string }[];
  advisors: ActivitiesByAdvisorWeeklyRow[];
};

type TasksByKindWeeklyRow = {
  key: 'llamadas' | 'reuniones' | 'correos' | 'whatsapp';
  label: string;
  counts: number[];
  total: number;
};

type TasksByKindWeeklySnapshot = {
  weeks: { name: string; weekStart: string; weekEnd: string }[];
  kinds: TasksByKindWeeklyRow[];
  maxCount: number;
};

type TasksByAdvisorWeeklyRow = {
  advisorId: string;
  advisorName: string;
  llamadas: number;
  reuniones: number;
  correos: number;
  whatsapp: number;
  total: number;
  byWeek: {
    llamadas: number;
    reuniones: number;
    correos: number;
    whatsapp: number;
    total: number;
  }[];
};

type TasksByAdvisorWeeklySnapshot = {
  weeks: { name: string; weekStart: string; weekEnd: string }[];
  advisors: TasksByAdvisorWeeklyRow[];
};

const ACTIVITY_TYPE_DEFINITIONS = [
  { key: 'llamadas' as const, label: 'Llamadas' },
  { key: 'reuniones' as const, label: 'Reuniones' },
  { key: 'correos' as const, label: 'Correos' },
  { key: 'notas' as const, label: 'Notas' },
];

function activityTypeKeyFromRaw(
  type: string | null | undefined,
): ActivitiesByTypeWeeklyRow['key'] | null {
  const t = type?.toLowerCase() ?? '';
  if (t === 'llamada') return 'llamadas';
  if (t === 'reunion' || t === 'reunión') return 'reuniones';
  if (t === 'correo') return 'correos';
  if (t === 'nota') return 'notas';
  return null;
}

const TASK_KIND_DEFINITIONS = [
  { key: 'llamadas' as const, label: 'Llamadas' },
  { key: 'reuniones' as const, label: 'Reuniones' },
  { key: 'correos' as const, label: 'Correos' },
  { key: 'whatsapp' as const, label: 'WhatsApp' },
];

function taskKindKeyFromRaw(
  taskKind: string | null | undefined,
): TasksByKindWeeklyRow['key'] | null {
  const k = taskKind?.toLowerCase() ?? '';
  if (k === 'llamada') return 'llamadas';
  if (k === 'reunion' || k === 'reunión') return 'reuniones';
  if (k === 'correo') return 'correos';
  if (k === 'whatsapp') return 'whatsapp';
  return null;
}

const COMPANY_WEEKLY_CHART_WEEKS = 6;
const SOURCES_WEEKLY_CHART_WEEKS = 6;
const SOURCES_DETAIL_WEEKLY_COUNT = 5;
const ACTIVITIES_HEATMAP_WEEK_COUNT = 6;
const ADVISOR_FUNNEL_MOVEMENT_WEEK_OFFSETS = [1, 3, 5, 7] as const;
const UNASSIGNED_ADVISOR_ID = '__unassigned__';
const UNASSIGNED_SOURCE_SLUG = '__sin_fuente__';
const ACTIVE_PROSPECT_MIN_PROBABILITY = 10;
const ACTIVE_PROSPECT_MAX_PROBABILITY = 100;
const ADVANCED_CONTACTS_MIN_PROBABILITY = 30;
const ADVANCED_CONTACTS_MAX_PROBABILITY = 100;
const ESTIMATED_BILLING_MIN_PROBABILITY = 10;
const ESTIMATED_BILLING_MAX_PROBABILITY = 100;
const HOT_STAGE_MIN_PROBABILITY = 70;
const HOT_STAGE_MAX_PROBABILITY = 100;
/** Etapas de cierre (85–99 %): lic. final, cierre ganado, firma, etc. */
const CLOSING_STAGE_MIN_PROBABILITY = 85;
const HOT_PROSPECTS_TOP_LIMIT = 15;

type SourceDetailStageRow = {
  slug: string;
  name: string;
  probability: number;
  count: number;
};

type SourceDetailRow = {
  slug: string;
  companyCount: number;
  estimatedBilling: number;
  stages: SourceDetailStageRow[];
  hot70Count: number;
  hot70Billing: number;
};

type SourcesDetailSnapshot = {
  week: { name: string; weekStart: string; weekEnd: string };
  sources: SourceDetailRow[];
};

type SourcesDetailWeekSnapshot = SourcesDetailSnapshot & {
  byAdvisor: Record<string, SourceDetailRow[]>;
};

type SourcesDetailWeeklySnapshot = {
  weeks: SourcesDetailWeekSnapshot[];
};

type HotProspectRow = {
  id: string;
  urlSlug: string;
  name: string;
  etapa: string;
  etapaLabel: string;
  probability: number;
  assignedToName: string | null;
  facturacionEstimada: number;
};

type HotProspectsSnapshot = {
  week: {
    name: string;
    weekStart: string;
    weekEnd: string;
  };
  totalCalientes: number;
  pipelineCaliente: number;
  enCierre: number;
  yaActivos: number;
  topProspects: HotProspectRow[];
  weeklyTrend: {
    weeks: { name: string; weekStart: string; weekEnd: string }[];
    totalCalientes: number[];
    pipelineCaliente: number[];
    enCierre: number[];
    yaActivos: number[];
  };
};

type WeekClip = {
  name: string;
  clipStart: Date;
  clipEnd: Date;
};

/** Si `maxWeeks` se omite, recorre todo el rango (reportes). Sparklines pasan un tope fijo. */
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
    weekStart = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
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

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function addLimaWeeks(monday: Date, weeks: number): Date {
  return new Date(monday.getTime() + weeks * WEEK_MS);
}

function monthRangeLima(ym: string): { start: Date; end: Date } {
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
  const start = limaDayStart(y, m - 1, 1);
  return { start, end: endOfMonthLima(start) };
}

function pctChange(cur: number, prev: number): string {
  if (prev <= 0) return cur > 0 ? '+100%' : '0%';
  const p = Math.round(((cur - prev) / prev) * 1000) / 10;
  return `${p >= 0 ? '+' : ''}${p}%`;
}

/** Últimos 7 días (incl. hoy) vs los 7 días anteriores, anclado a hora Lima. */
function rolling7DayRanges(now = new Date()): {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
} {
  const { year, month, day } = instantToLimaParts(now);
  const from = limaDayStart(year, month, day - 6);
  const to = now;
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = limaDayStart(year, month, day - 13);
  return { from, to, prevFrom, prevTo };
}

/** Últimos N meses calendario (Lima) para gráfico de metas. */
function lastNMonthClips(n: number, now = new Date()): {
  ym: string;
  clipStart: Date;
  clipEnd: Date;
  label: string;
}[] {
  const { year, month } = instantToLimaParts(now);
  const rows: { ym: string; clipStart: Date; clipEnd: Date; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const anchor = limaDayStart(year, month - i, 1);
    const ym = monthKey(anchor);
    rows.push({
      ym,
      clipStart: startOfMonthLima(anchor),
      clipEnd: endOfMonthLima(anchor),
      label: monthLabelEs(ym),
    });
  }
  return rows;
}

/** Ventana fija para sparklines KPI: últimas N semanas ancladas a `referenceTo` (fin del periodo). */
function sparklineRange(weekCount: number, referenceTo = new Date()): { from: Date; to: Date; weeks: WeekClip[] } {
  const currentWeekStart = startOfWeekMondayLima(referenceTo);
  const from = new Date(currentWeekStart.getTime() - 7 * (weekCount - 1) * 24 * 60 * 60 * 1000);
  const to = referenceTo;
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

  /** Slugs de etapa cuya probabilidad cae en [min, max] (catálogo CRM + fallback legacy). */
  private async resolveStageSlugsInProbabilityRange(
    minProbability: number,
    maxProbability: number,
  ): Promise<string[]> {
    const stages = await this.prisma.crmStage.findMany({
      where: { enabled: true },
      select: { slug: true, probability: true },
    });
    const slugs = new Set<string>();
    for (const stage of stages) {
      if (
        stage.probability >= minProbability &&
        stage.probability <= maxProbability
      ) {
        slugs.add(stage.slug);
      }
    }
    const catalogSlugs = new Set(stages.map((s) => s.slug));
    for (const [slug, probability] of Object.entries(STAGE_PROBABILITY_FALLBACK)) {
      if (catalogSlugs.has(slug)) continue;
      if (
        probability >= minProbability &&
        probability <= maxProbability
      ) {
        slugs.add(slug);
      }
    }
    return [...slugs];
  }

  private etapaInSlugsFilter(slugs: string[]): Prisma.StringFilter {
    return { in: slugs.length > 0 ? slugs : ['__none__'] };
  }

  private resolveCompanySourceSlug(
    fuente: string | null | undefined,
    leadCatalog: { slug: string; name: string }[],
  ): string {
    if (!fuente?.trim()) return UNASSIGNED_SOURCE_SLUG;
    return resolveLeadSourceKeyLoose(fuente, leadCatalog);
  }

  private buildActiveProspectStageHelpers(
    stages: {
      slug: string;
      name: string;
      probability: number;
      sortOrder: number;
    }[],
  ) {
    const stageMeta = new Map(
      stages.map((s) => [
        s.slug,
        { name: s.name, probability: s.probability, sortOrder: s.sortOrder },
      ]),
    );
    const qualifyingSlugs = new Set(
      stages
        .filter(
          (s) =>
            s.probability >= ACTIVE_PROSPECT_MIN_PROBABILITY &&
            s.probability <= ACTIVE_PROSPECT_MAX_PROBABILITY,
        )
        .map((s) => s.slug),
    );
    const getProbability = (slug: string): number => {
      const meta = stageMeta.get(slug.trim());
      if (meta) return meta.probability;
      return STAGE_PROBABILITY_FALLBACK[slug.trim()] ?? 0;
    };
    const isQualifyingSlug = (slug: string): boolean => {
      const key = slug.trim();
      if (qualifyingSlugs.has(key)) return true;
      const probability = getProbability(key);
      return (
        probability >= ACTIVE_PROSPECT_MIN_PROBABILITY &&
        probability <= ACTIVE_PROSPECT_MAX_PROBABILITY
      );
    };
    return { stageMeta, getProbability, isQualifyingSlug };
  }

  /**
   * Empresas por fuente acumuladas (1 ene → cierre de cada semana) en las últimas
   * {@link SOURCES_WEEKLY_CHART_WEEKS} semanas ISO (Lima). Etapa 10%–100% al cierre
   * de cada semana (auditoría). Incluye bucket {@link UNASSIGNED_SOURCE_SLUG}.
   */
  private async buildCompaniesBySourceWeekly(
    referenceTo: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    crmScope: CrmDataScope,
    leadCatalog: { slug: string; name: string }[],
  ): Promise<CompaniesBySourceWeeklySnapshot> {
    const anchorMonday = startOfWeekMondayLima(referenceTo);
    const weekMondays: Date[] = [];
    for (let i = SOURCES_WEEKLY_CHART_WEEKS - 1; i >= 0; i--) {
      weekMondays.push(addLimaWeeks(anchorMonday, -i));
    }

    const { year } = instantToLimaParts(referenceTo);
    const yearStart = limaDayStart(year, 0, 1);

    const portfolioWhere = mergeCompanyScope(
      {
        ...this.companyPortfolioBaseWhere(filters, unrestricted),
        createdAt: { gte: yearStart, lte: referenceTo },
      },
      crmScope,
    );

    const [stages, portfolioCompanies, auditRows] = await Promise.all([
      this.prisma.crmStage.findMany({
        where: { enabled: true },
        select: { slug: true, name: true, probability: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.company.findMany({
        where: portfolioWhere,
        select: { id: true, createdAt: true, etapa: true, fuente: true },
      }),
      this.prisma.auditChangeSet.findMany({
        where: {
          module: 'empresas',
          entityType: 'Empresa',
          createdAt: { lte: referenceTo },
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

    const { isQualifyingSlug } = this.buildActiveProspectStageHelpers(stages);
    const portfolioIds = new Set(portfolioCompanies.map((c) => c.id));

    type AuditEv = { at: Date; oldValue: string; newValue: string };
    const auditsByCompany = new Map<string, AuditEv[]>();
    for (const row of auditRows) {
      const id = row.entityId;
      if (!id || !portfolioIds.has(id)) continue;
      const et = row.entries[0];
      if (!et) continue;
      const list = auditsByCompany.get(id) ?? [];
      list.push({
        at: row.createdAt,
        oldValue: et.oldValue,
        newValue: et.newValue,
      });
      auditsByCompany.set(id, list);
    }

    const etapaAtByCompany = new Map<string, (instant: Date) => string>();
    for (const company of portfolioCompanies) {
      const audits = auditsByCompany.get(company.id) ?? [];
      etapaAtByCompany.set(
        company.id,
        buildEtapaStepFunction(company.createdAt, company.etapa, audits),
      );
    }

    const weeks: CompaniesBySourceWeekRow[] = weekMondays.map((monday) => {
      const weekEnd = minInstant(endOfWeekSundayLima(monday), referenceTo);
      const counts = new Map<string, number>();

      for (const company of portfolioCompanies) {
        if (company.createdAt < yearStart || company.createdAt > weekEnd) continue;
        const etapaFn = etapaAtByCompany.get(company.id);
        if (!etapaFn) continue;
        const etapaSlug = etapaFn(weekEnd).trim();
        if (!isQualifyingSlug(etapaSlug)) continue;
        const sourceKey = this.resolveCompanySourceSlug(
          company.fuente,
          leadCatalog,
        );
        counts.set(sourceKey, (counts.get(sourceKey) ?? 0) + 1);
      }

      const sources = [...counts.entries()]
        .map(([slug, value]) => ({ slug, value }))
        .sort((a, b) => b.value - a.value);

      return {
        name: isoWeekLabelFromInstant(monday),
        weekStart: monday.toISOString(),
        weekEnd: weekEnd.toISOString(),
        sources,
      };
    });

    return { weeks };
  }

  /**
   * Detalle por fuente para cards: últimas {@link SOURCES_DETAIL_WEEKLY_COUNT} semanas
   * ISO completas (Lima). Acumulado 1 ene → cierre de cada semana; etapa y facturación
   * al cierre (auditoría). Desglose por asesor usa `assignedTo` actual (filtro local en UI).
   */
  private async buildSourcesDetailWeekly(
    referenceTo: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    crmScope: CrmDataScope,
    leadCatalog: { slug: string; name: string }[],
    advisorPoolIds: string[],
  ): Promise<SourcesDetailWeeklySnapshot> {
    const anchorMonday = startOfWeekMondayLima(referenceTo);
    const weekTargets: { monday: Date; weekEnd: Date }[] = [];
    for (let i = 1; i <= SOURCES_DETAIL_WEEKLY_COUNT; i += 1) {
      const monday = addLimaWeeks(anchorMonday, -i);
      weekTargets.push({
        monday,
        weekEnd: minInstant(endOfWeekSundayLima(monday), referenceTo),
      });
    }

    const maxWeekEnd = weekTargets[0]?.weekEnd ?? referenceTo;
    const { year } = instantToLimaParts(referenceTo);
    const yearStart = limaDayStart(year, 0, 1);
    const advisorPool = new Set(advisorPoolIds);

    const portfolioWhere = mergeCompanyScope(
      {
        ...this.companyPortfolioBaseWhere(filters, unrestricted),
        createdAt: { gte: yearStart, lte: maxWeekEnd },
      },
      crmScope,
    );

    const [stages, portfolioCompanies, auditRows] = await Promise.all([
      this.prisma.crmStage.findMany({
        where: { enabled: true },
        select: {
          slug: true,
          name: true,
          probability: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.company.findMany({
        where: portfolioWhere,
        select: {
          id: true,
          createdAt: true,
          fuente: true,
          etapa: true,
          assignedTo: true,
          facturacionEstimada: true,
        },
      }),
      this.prisma.auditChangeSet.findMany({
        where: {
          module: 'empresas',
          entityType: 'Empresa',
          createdAt: { lte: maxWeekEnd },
          entries: {
            some: {
              fieldKey: {
                in: ['etapa', 'facturacionEstimada'],
              },
            },
          },
        },
        include: {
          entries: {
            where: {
              fieldKey: {
                in: ['etapa', 'facturacionEstimada'],
              },
            },
            select: { fieldKey: true, oldValue: true, newValue: true },
          },
        },
      }),
    ]);

    const { stageMeta, getProbability, isQualifyingSlug } =
      this.buildActiveProspectStageHelpers(stages);
    const portfolioIds = new Set(portfolioCompanies.map((c) => c.id));

    type AuditEv = { at: Date; oldValue: string; newValue: string };
    const auditsByCompanyField = new Map<string, AuditEv[]>();
    for (const row of auditRows) {
      const id = row.entityId;
      if (!id || !portfolioIds.has(id)) continue;
      for (const et of row.entries) {
        const key = `${id}:${et.fieldKey}`;
        const list = auditsByCompanyField.get(key) ?? [];
        list.push({
          at: row.createdAt,
          oldValue: et.oldValue,
          newValue: et.newValue,
        });
        auditsByCompanyField.set(key, list);
      }
    }

    const etapaAtByCompany = new Map<string, (instant: Date) => string>();
    const billingAtByCompany = new Map<string, (instant: Date) => number>();
    for (const company of portfolioCompanies) {
      const etapaAudits = auditsByCompanyField.get(`${company.id}:etapa`) ?? [];
      const billingAudits =
        auditsByCompanyField.get(`${company.id}:facturacionEstimada`) ?? [];
      const currentBilling = Number(company.facturacionEstimada) || 0;
      etapaAtByCompany.set(
        company.id,
        buildEtapaStepFunction(company.createdAt, company.etapa, etapaAudits),
      );
      billingAtByCompany.set(
        company.id,
        buildNumericStepFunction(
          company.createdAt,
          currentBilling,
          billingAudits,
        ),
      );
    }

    type SourceAcc = {
      companyCount: number;
      estimatedBilling: number;
      stages: Map<string, number>;
      hot70Count: number;
      hot70Billing: number;
    };

    const emptyAcc = (): SourceAcc => ({
      companyCount: 0,
      estimatedBilling: 0,
      stages: new Map<string, number>(),
      hot70Count: 0,
      hot70Billing: 0,
    });

    const bumpAcc = (
      acc: SourceAcc,
      etapa: string,
      billing: number,
      probability: number,
    ) => {
      acc.companyCount += 1;
      acc.estimatedBilling += billing;
      acc.stages.set(etapa, (acc.stages.get(etapa) ?? 0) + 1);
      if (
        probability >= HOT_STAGE_MIN_PROBABILITY &&
        probability <= HOT_STAGE_MAX_PROBABILITY
      ) {
        acc.hot70Count += 1;
        acc.hot70Billing += billing;
      }
    };

    const accToRows = (
      bySource: Map<string, SourceAcc>,
    ): SourceDetailRow[] =>
      [...bySource.entries()]
        .map(([slug, acc]) => ({
          slug,
          companyCount: acc.companyCount,
          estimatedBilling: acc.estimatedBilling,
          stages: [...acc.stages.entries()]
            .map(([stageSlug, count]) => {
              const meta = stageMeta.get(stageSlug);
              return {
                slug: stageSlug,
                name: meta?.name ?? stageSlug,
                probability: meta?.probability ?? getProbability(stageSlug),
                count,
              };
            })
            .sort((a, b) => {
              const oa = stageMeta.get(a.slug)?.sortOrder ?? 999_999;
              const ob = stageMeta.get(b.slug)?.sortOrder ?? 999_999;
              return oa - ob;
            }),
          hot70Count: acc.hot70Count,
          hot70Billing: acc.hot70Billing,
        }))
        .sort((a, b) => b.companyCount - a.companyCount);

    const resolveAdvisorBucket = (assignedTo: string): string => {
      const id = assignedTo.trim();
      if (!id) return ADVISOR_UNASSIGNED;
      if (advisorPool.has(id)) return id;
      return ADVISOR_OTHERS;
    };

    const weeks: SourcesDetailWeekSnapshot[] = weekTargets.map(
      ({ monday, weekEnd }) => {
        const totalBySource = new Map<string, SourceAcc>();
        const byAdvisorAcc = new Map<string, Map<string, SourceAcc>>();

        for (const company of portfolioCompanies) {
          if (company.createdAt < yearStart || company.createdAt > weekEnd) {
            continue;
          }
          const etapaFn = etapaAtByCompany.get(company.id);
          const billingFn = billingAtByCompany.get(company.id);
          if (!etapaFn || !billingFn) continue;

          const etapa = etapaFn(weekEnd).trim();
          if (!isQualifyingSlug(etapa)) continue;

          const sourceKey = this.resolveCompanySourceSlug(
            company.fuente,
            leadCatalog,
          );
          const billing = Math.max(0, billingFn(weekEnd));
          const probability = getProbability(etapa);
          const advisorKey = resolveAdvisorBucket(
            company.assignedTo?.trim() ?? '',
          );

          const totalAcc = totalBySource.get(sourceKey) ?? emptyAcc();
          bumpAcc(totalAcc, etapa, billing, probability);
          totalBySource.set(sourceKey, totalAcc);

          const advisorSources =
            byAdvisorAcc.get(advisorKey) ?? new Map<string, SourceAcc>();
          const advisorAcc = advisorSources.get(sourceKey) ?? emptyAcc();
          bumpAcc(advisorAcc, etapa, billing, probability);
          advisorSources.set(sourceKey, advisorAcc);
          byAdvisorAcc.set(advisorKey, advisorSources);
        }

        const byAdvisor: Record<string, SourceDetailRow[]> = {};
        for (const [advisorKey, sourceMap] of byAdvisorAcc.entries()) {
          byAdvisor[advisorKey] = accToRows(sourceMap);
        }

        return {
          week: {
            name: isoWeekLabelFromInstant(monday),
            weekStart: monday.toISOString(),
            weekEnd: weekEnd.toISOString(),
          },
          sources: accToRows(totalBySource),
          byAdvisor,
        };
      },
    );

    return { weeks };
  }

  /**
   * Cartera de prospectos calientes al cierre de la semana ISO anterior a `referenceTo`.
   * - Total calientes / pipeline: empresas con etapa ≥ 70 %.
   * - En cierre: etapa ≥ 85 % y menor que 100 %.
   * - Ya activos: etapa 100 %.
   * Top 15: empresas ≥ 70 % (excl. activo), por facturación estimada.
   * Sparklines: mismas métricas en las 6 semanas ISO (Lima) que terminan en esa semana.
   */
  private async buildHotProspectsSummary(
    referenceTo: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    crmScope: CrmDataScope,
  ): Promise<HotProspectsSnapshot> {
    const anchorMonday = startOfWeekMondayLima(referenceTo);
    const targetMonday = addLimaWeeks(anchorMonday, -1);
    const snapshotInstant = minInstant(
      endOfWeekSundayLima(targetMonday),
      referenceTo,
    );

    const portfolioWhere = mergeCompanyScope(
      {
        ...this.companyPortfolioBaseWhere(filters, unrestricted),
        createdAt: { lte: referenceTo },
      },
      crmScope,
    );

    const [stages, portfolioCompanies, auditRows, advisorUsers] =
      await Promise.all([
        this.prisma.crmStage.findMany({
          where: { enabled: true },
          select: { slug: true, name: true, probability: true },
        }),
        this.prisma.company.findMany({
          where: portfolioWhere,
          select: {
            id: true,
            urlSlug: true,
            name: true,
            createdAt: true,
            etapa: true,
            assignedTo: true,
            facturacionEstimada: true,
            user: { select: { id: true, name: true } },
          },
        }),
        this.prisma.auditChangeSet.findMany({
          where: {
            module: 'empresas',
            entityType: 'Empresa',
            createdAt: { lte: referenceTo },
            entries: {
              some: {
                fieldKey: {
                  in: ['etapa', 'facturacionEstimada', 'assignedTo'],
                },
              },
            },
          },
          include: {
            entries: {
              where: {
                fieldKey: {
                  in: ['etapa', 'facturacionEstimada', 'assignedTo'],
                },
              },
              select: { fieldKey: true, oldValue: true, newValue: true },
            },
          },
        }),
        findCommercialAdvisorUsers(this.prisma),
      ]);

    const stageMeta = new Map(
      stages.map((s) => [s.slug, { name: s.name, probability: s.probability }]),
    );
    const getProbability = (slug: string): number => {
      const meta = stageMeta.get(slug.trim());
      if (meta) return meta.probability;
      return STAGE_PROBABILITY_FALLBACK[slug.trim()] ?? 0;
    };
    const getStageLabel = (slug: string): string =>
      stageMeta.get(slug.trim())?.name ?? slug;

    const portfolioIds = new Set(portfolioCompanies.map((c) => c.id));
    type AuditEv = { at: Date; oldValue: string; newValue: string };
    const auditsByCompanyField = new Map<string, AuditEv[]>();
    for (const row of auditRows) {
      const id = row.entityId;
      if (!id || !portfolioIds.has(id)) continue;
      for (const et of row.entries) {
        const key = `${id}:${et.fieldKey}`;
        const list = auditsByCompanyField.get(key) ?? [];
        list.push({
          at: row.createdAt,
          oldValue: et.oldValue,
          newValue: et.newValue,
        });
        auditsByCompanyField.set(key, list);
      }
    }

    const advisorNameById = new Map(advisorUsers.map((u) => [u.id, u.name]));
    for (const company of portfolioCompanies) {
      if (company.user?.id && company.user.name) {
        advisorNameById.set(company.user.id, company.user.name);
      }
    }

    type CompanySnapshotFns = {
      id: string;
      urlSlug: string;
      name: string;
      createdAt: Date;
      etapaFn: (instant: Date) => string;
      billingFn: (instant: Date) => number;
      advisorFn: (instant: Date) => string;
    };

    const companyFns: CompanySnapshotFns[] = portfolioCompanies.map((company) => ({
      id: company.id,
      urlSlug: company.urlSlug,
      name: company.name,
      createdAt: company.createdAt,
      etapaFn: buildEtapaStepFunction(
        company.createdAt,
        company.etapa,
        auditsByCompanyField.get(`${company.id}:etapa`) ?? [],
      ),
      billingFn: buildNumericStepFunction(
        company.createdAt,
        Number(company.facturacionEstimada) || 0,
        auditsByCompanyField.get(`${company.id}:facturacionEstimada`) ?? [],
      ),
      advisorFn: buildEtapaStepFunction(
        company.createdAt,
        company.assignedTo?.trim() ?? '',
        auditsByCompanyField.get(`${company.id}:assignedTo`) ?? [],
      ),
    }));

    const aggregateAt = (instant: Date) => {
      let totalCalientes = 0;
      let pipelineCaliente = 0;
      let enCierre = 0;
      let yaActivos = 0;
      const hotRows: (HotProspectRow & { billing: number })[] = [];

      for (const company of companyFns) {
        if (company.createdAt > instant) continue;

        const etapa = company.etapaFn(instant).trim();
        const probability = getProbability(etapa);
        const billing = Math.max(0, company.billingFn(instant));

        const isHot =
          probability >= HOT_STAGE_MIN_PROBABILITY &&
          probability <= HOT_STAGE_MAX_PROBABILITY;
        if (!isHot) continue;

        totalCalientes += 1;
        pipelineCaliente += billing;

        if (probability === HOT_STAGE_MAX_PROBABILITY) {
          yaActivos += 1;
        } else if (probability >= CLOSING_STAGE_MIN_PROBABILITY) {
          enCierre += 1;
        }

        if (probability < HOT_STAGE_MAX_PROBABILITY) {
          const advisorId = company.advisorFn(instant).trim();
          hotRows.push({
            id: company.id,
            urlSlug: company.urlSlug,
            name: company.name,
            etapa,
            etapaLabel: getStageLabel(etapa),
            probability,
            assignedToName: advisorId
              ? (advisorNameById.get(advisorId) ?? null)
              : null,
            facturacionEstimada: billing,
            billing,
          });
        }
      }

      hotRows.sort((a, b) => b.billing - a.billing);
      const topProspects = hotRows
        .slice(0, HOT_PROSPECTS_TOP_LIMIT)
        .map(({ billing: _billing, ...row }) => row);

      return {
        totalCalientes,
        pipelineCaliente,
        enCierre,
        yaActivos,
        topProspects,
      };
    };

    const weekMondays: Date[] = [];
    for (let i = COMPANY_WEEKLY_CHART_WEEKS - 1; i >= 0; i--) {
      weekMondays.push(addLimaWeeks(targetMonday, -i));
    }

    const weekMeta: HotProspectsSnapshot['weeklyTrend']['weeks'] = [];
    const totalSeries: number[] = [];
    const pipelineSeries: number[] = [];
    const cierreSeries: number[] = [];
    const activosSeries: number[] = [];

    for (const monday of weekMondays) {
      const weekEnd = minInstant(endOfWeekSundayLima(monday), referenceTo);
      const agg = aggregateAt(weekEnd);
      weekMeta.push({
        name: isoWeekLabelFromInstant(monday),
        weekStart: monday.toISOString(),
        weekEnd: weekEnd.toISOString(),
      });
      totalSeries.push(agg.totalCalientes);
      pipelineSeries.push(agg.pipelineCaliente);
      cierreSeries.push(agg.enCierre);
      activosSeries.push(agg.yaActivos);
    }

    const current = aggregateAt(snapshotInstant);

    return {
      week: {
        name: isoWeekLabelFromInstant(targetMonday),
        weekStart: targetMonday.toISOString(),
        weekEnd: snapshotInstant.toISOString(),
      },
      ...current,
      weeklyTrend: {
        weeks: weekMeta,
        totalCalientes: totalSeries,
        pipelineCaliente: pipelineSeries,
        enCierre: cierreSeries,
        yaActivos: activosSeries,
      },
    };
  }

  /**
   * Por semana ISO (lun–dom UTC): nuevo ingreso, avance, atraso y sin cambios en cartera.
   * Reglas basadas en probabilidad de etapa (0 % = lead; embudo desde 10 %).
   */
  private classifyCompanyEtapaTransition(
    oldSlug: string,
    newSlug: string,
    getProb: (slug: string) => number,
  ): 'nuevo' | 'avance' | 'atraso' | 'sinCambios' | null {
    const ro = getProb(oldSlug.trim());
    const rn = getProb(newSlug.trim());
    if (ro < ACTIVE_PROSPECT_MIN_PROBABILITY && rn >= ACTIVE_PROSPECT_MIN_PROBABILITY) {
      return 'nuevo';
    }
    if (ro >= ACTIVE_PROSPECT_MIN_PROBABILITY && rn > ro) {
      return 'avance';
    }
    if (rn < ro) {
      return 'atraso';
    }
    if (ro >= ACTIVE_PROSPECT_MIN_PROBABILITY && rn === ro) {
      return 'sinCambios';
    }
    return null;
  }

  private classifyCompanyWeekMovement(
    inWeek: { oldSlug: string; newSlug: string }[],
    getProb: (slug: string) => number,
  ): 'nuevo' | 'avance' | 'atraso' | 'sinCambios' | null {
    if (inWeek.length === 0) return null;
    if (inWeek.length === 1) {
      const ev = inWeek[0]!;
      return this.classifyCompanyEtapaTransition(ev.oldSlug, ev.newSlug, getProb);
    }
    const first = inWeek[0]!;
    const last = inWeek[inWeek.length - 1]!;
    return this.classifyCompanyEtapaTransition(first.oldSlug, last.newSlug, getProb);
  }

  private classifyCompanyMovementInWeekClip(
    company: { id: string; createdAt: Date },
    clipStart: Date,
    clipEnd: Date,
    etapaFn: (instant: Date) => string,
    auditsInWeek: { oldSlug: string; newSlug: string }[],
    getProb: (slug: string) => number,
  ): 'nuevo' | 'avance' | 'atraso' | 'sinCambios' | null {
    if (company.createdAt > clipEnd) return null;

    const createdInWeek =
      company.createdAt >= clipStart && company.createdAt <= clipEnd;

    if (createdInWeek) {
      const probAtCreate = getProb(etapaFn(company.createdAt));
      if (probAtCreate >= ACTIVE_PROSPECT_MIN_PROBABILITY) return 'nuevo';
      const promoted = auditsInWeek.some(
        (e) =>
          getProb(e.oldSlug) < ACTIVE_PROSPECT_MIN_PROBABILITY &&
          getProb(e.newSlug) >= ACTIVE_PROSPECT_MIN_PROBABILITY,
      );
      if (promoted) return 'nuevo';
      return null;
    }

    if (auditsInWeek.length === 0) {
      const probEnd = getProb(etapaFn(clipEnd));
      if (probEnd >= ACTIVE_PROSPECT_MIN_PROBABILITY) return 'sinCambios';
      return null;
    }

    return this.classifyCompanyWeekMovement(auditsInWeek, getProb);
  }

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
        select: { slug: true, probability: true, sortOrder: true },
      }),
      this.prisma.company.findMany({
        where: portfolioWhere,
        select: { id: true, createdAt: true, etapa: true },
      }),
      this.prisma.auditChangeSet.findMany({
        where: {
          module: 'empresas',
          entityType: 'Empresa',
          createdAt: { lte: to },
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

    const stageInfo = new Map<string, number>();
    for (const s of stages) {
      stageInfo.set(s.slug, s.probability);
    }
    const getProb = (slug: string): number => {
      const key = slug.trim();
      if (stageInfo.has(key)) return stageInfo.get(key)!;
      return STAGE_PROBABILITY_FALLBACK[key] ?? 0;
    };

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

    const etapaAtByCompany = new Map<string, (instant: Date) => string>();
    for (const company of portfolioCompanies) {
      const audits = (auditsByCompany.get(company.id) ?? []).map((e) => ({
        at: e.at,
        oldValue: e.oldSlug,
        newValue: e.newSlug,
      }));
      etapaAtByCompany.set(
        company.id,
        buildEtapaStepFunction(company.createdAt, company.etapa, audits),
      );
    }

    const rows: CompanyWeeklyProgressRow[] = [];
    let weekStart = startOfWeekMondayLima(from);
    while (weekStart <= to) {
      const weekEnd = endOfWeekSundayLima(weekStart);
      const clipStart = maxInstant(weekStart, from);
      const clipEnd = minInstant(weekEnd, to);

      let avance = 0;
      let nuevoIngreso = 0;
      let atraso = 0;
      let sinCambios = 0;

      for (const company of portfolioCompanies) {
        const etapaFn = etapaAtByCompany.get(company.id);
        if (!etapaFn) continue;

        const inWeek = (auditsByCompany.get(company.id) ?? []).filter(
          (e) => e.at >= clipStart && e.at <= clipEnd,
        );

        const category = this.classifyCompanyMovementInWeekClip(
          company,
          clipStart,
          clipEnd,
          etapaFn,
          inWeek,
          getProb,
        );
        if (category === 'nuevo') nuevoIngreso += 1;
        else if (category === 'avance') avance += 1;
        else if (category === 'atraso') atraso += 1;
        else if (category === 'sinCambios') sinCambios += 1;
      }

      const portfolioThisWeek = portfolioCompanies.filter(
        (c) => c.createdAt <= clipEnd,
      ).length;
      if (portfolioThisWeek > 0) {
        rows.push({
          name: formatIsoWeekLabel(isoWeekNumberLima(weekStart)),
          avance,
          nuevoIngreso,
          atraso,
          sinCambios,
        });
      }

      weekStart = new Date(weekStart);
      weekStart = addLimaWeeks(weekStart, 1);
    }

    return rows;
  }

  /**
   * Movimiento del embudo por asesor en las últimas 4 parejas de semanas ISO
   * (ej. W27→W28, W25→W26, W23→W24, W21→W22 si la semana en curso es W29).
   */
  private async buildCompaniesAdvisorFunnelMovement(
    referenceTo: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    crmScope: CrmDataScope,
    advisorUsers: { id: string; name: string }[],
  ): Promise<CompaniesAdvisorFunnelMovementSnapshot> {
    const anchorMonday = startOfWeekMondayLima(referenceTo);
    const currentWeekNumber = isoWeekNumberLima(referenceTo);
    const currentWeekLabel = formatIsoWeekLabel(currentWeekNumber);

    const portfolioWhere = mergeCompanyScope(
      {
        ...this.companyPortfolioBaseWhere(filters, unrestricted),
        createdAt: { lte: referenceTo },
      },
      crmScope,
    );

    const [stages, portfolioCompanies, auditRows] = await Promise.all([
      this.prisma.crmStage.findMany({
        where: { enabled: true },
        select: { slug: true, probability: true },
      }),
      this.prisma.company.findMany({
        where: portfolioWhere,
        select: { id: true, createdAt: true, etapa: true, assignedTo: true },
      }),
      this.prisma.auditChangeSet.findMany({
        where: {
          module: 'empresas',
          entityType: 'Empresa',
          createdAt: { lte: referenceTo },
          entries: {
            some: { fieldKey: { in: ['etapa', 'assignedTo'] } },
          },
        },
        include: {
          entries: {
            where: { fieldKey: { in: ['etapa', 'assignedTo'] } },
            select: { fieldKey: true, oldValue: true, newValue: true },
          },
        },
      }),
    ]);

    const stageInfo = new Map<string, number>();
    for (const s of stages) stageInfo.set(s.slug, s.probability);
    const getProb = (slug: string): number => {
      const key = slug.trim();
      if (stageInfo.has(key)) return stageInfo.get(key)!;
      return STAGE_PROBABILITY_FALLBACK[key] ?? 0;
    };

    const portfolioIds = new Set(portfolioCompanies.map((c) => c.id));
    const advisorNameById = new Map(advisorUsers.map((u) => [u.id, u.name]));

    type EtapaAuditEv = { at: Date; oldSlug: string; newSlug: string };
    const etapaAuditsByCompany = new Map<string, EtapaAuditEv[]>();
    type FieldAuditEv = { at: Date; oldValue: string; newValue: string };
    const assignedAuditsByCompany = new Map<string, FieldAuditEv[]>();

    for (const row of auditRows) {
      const id = row.entityId;
      if (!id || !portfolioIds.has(id)) continue;
      for (const et of row.entries) {
        if (et.fieldKey === 'etapa') {
          const oldSlug = et.oldValue.trim();
          const newSlug = et.newValue.trim();
          if (!oldSlug && !newSlug) continue;
          const list = etapaAuditsByCompany.get(id) ?? [];
          list.push({ at: row.createdAt, oldSlug, newSlug });
          etapaAuditsByCompany.set(id, list);
        } else if (et.fieldKey === 'assignedTo') {
          const list = assignedAuditsByCompany.get(id) ?? [];
          list.push({
            at: row.createdAt,
            oldValue: et.oldValue,
            newValue: et.newValue,
          });
          assignedAuditsByCompany.set(id, list);
        }
      }
    }
    for (const [, list] of etapaAuditsByCompany) {
      list.sort((a, b) => a.at.getTime() - b.at.getTime());
    }
    for (const [, list] of assignedAuditsByCompany) {
      list.sort((a, b) => a.at.getTime() - b.at.getTime());
    }

    const etapaAtByCompany = new Map<string, (instant: Date) => string>();
    const advisorAtByCompany = new Map<string, (instant: Date) => string>();
    for (const company of portfolioCompanies) {
      const etapaAudits = (etapaAuditsByCompany.get(company.id) ?? []).map((e) => ({
        at: e.at,
        oldValue: e.oldSlug,
        newValue: e.newSlug,
      }));
      const advisorAudits = assignedAuditsByCompany.get(company.id) ?? [];
      const currentAdvisor = company.assignedTo?.trim() ?? '';
      etapaAtByCompany.set(
        company.id,
        buildEtapaStepFunction(company.createdAt, company.etapa, etapaAudits),
      );
      advisorAtByCompany.set(
        company.id,
        buildEtapaStepFunction(company.createdAt, currentAdvisor, advisorAudits),
      );
    }

    type MetricBucket = AdvisorFunnelMovementMetricsRow;
    const emptyMetrics = (): MetricBucket => ({
      nuevoIngreso: 0,
      avance: 0,
      atraso: 0,
      sinCambios: 0,
    });

    const advisorKeyAt = (companyId: string, instant: Date): string => {
      const fn = advisorAtByCompany.get(companyId);
      const raw = fn ? fn(instant).trim() : '';
      return raw || UNASSIGNED_ADVISOR_ID;
    };

    const portfolioAdvisorIds = new Set<string>();
    for (const company of portfolioCompanies) {
      const currentAdvisor = company.assignedTo?.trim();
      if (currentAdvisor) portfolioAdvisorIds.add(currentAdvisor);
      for (const audit of assignedAuditsByCompany.get(company.id) ?? []) {
        const oldId = audit.oldValue.trim();
        const newId = audit.newValue.trim();
        if (oldId) portfolioAdvisorIds.add(oldId);
        if (newId) portfolioAdvisorIds.add(newId);
      }
    }
    const missingAdvisorIds = [...portfolioAdvisorIds].filter(
      (id) => !advisorNameById.has(id),
    );
    if (missingAdvisorIds.length > 0) {
      const extraUsers = await this.prisma.user.findMany({
        where: { id: { in: missingAdvisorIds } },
        select: { id: true, name: true },
      });
      for (const u of extraUsers) {
        const name = u.name?.trim();
        if (name) advisorNameById.set(u.id, name);
      }
    }

    const advisorLabel = (id: string): string => {
      if (id === UNASSIGNED_ADVISOR_ID) return 'Sin asignar';
      return advisorNameById.get(id) ?? 'Asesor desconocido';
    };

    const sortAdvisorIds = (ids: Iterable<string>): string[] =>
      [...ids].sort((a, b) => {
        if (a === UNASSIGNED_ADVISOR_ID) return 1;
        if (b === UNASSIGNED_ADVISOR_ID) return -1;
        return advisorLabel(a).localeCompare(advisorLabel(b), 'es');
      });

    const buildPeriod = (weeksBack: number): AdvisorFunnelMovementPeriodRow => {
      const targetMonday = addLimaWeeks(anchorMonday, -weeksBack);
      const clipStart = targetMonday;
      const clipEnd = minInstant(endOfWeekSundayLima(targetMonday), referenceTo);
      const toWeekNumber = isoWeekNumberLima(targetMonday);
      const fromWeekNumber = toWeekNumber - 1;

      const metricsByAdvisor = new Map<string, MetricBucket>();
      const activeByAdvisor = new Map<string, number>();

      const bumpMetric = (
        advisorId: string,
        category: 'nuevo' | 'avance' | 'atraso' | 'sinCambios',
      ) => {
        const bucket = metricsByAdvisor.get(advisorId) ?? emptyMetrics();
        bucket[category === 'nuevo' ? 'nuevoIngreso' : category] += 1;
        metricsByAdvisor.set(advisorId, bucket);
      };

      for (const company of portfolioCompanies) {
        const etapaFn = etapaAtByCompany.get(company.id);
        if (!etapaFn) continue;

        const probEnd = getProb(etapaFn(clipEnd));
        if (company.createdAt <= clipEnd && probEnd >= ACTIVE_PROSPECT_MIN_PROBABILITY) {
          const advisorId = advisorKeyAt(company.id, clipEnd);
          activeByAdvisor.set(advisorId, (activeByAdvisor.get(advisorId) ?? 0) + 1);
        }

        const inWeek = (etapaAuditsByCompany.get(company.id) ?? []).filter(
          (e) => e.at >= clipStart && e.at <= clipEnd,
        );
        const category = this.classifyCompanyMovementInWeekClip(
          company,
          clipStart,
          clipEnd,
          etapaFn,
          inWeek,
          getProb,
        );
        if (!category) continue;

        bumpMetric(advisorKeyAt(company.id, clipEnd), category);
      }

      const advisorIds = new Set<string>();
      for (const id of activeByAdvisor.keys()) advisorIds.add(id);
      for (const id of metricsByAdvisor.keys()) advisorIds.add(id);

      const advisors: AdvisorFunnelMovementAdvisorRow[] = sortAdvisorIds(advisorIds)
        .map((id) => ({
          id,
          name: advisorLabel(id),
          activeProspects: activeByAdvisor.get(id) ?? 0,
          metrics: metricsByAdvisor.get(id) ?? emptyMetrics(),
        }))
        .filter(
          (row) =>
            row.activeProspects > 0 ||
            row.metrics.nuevoIngreso > 0 ||
            row.metrics.avance > 0 ||
            row.metrics.atraso > 0 ||
            row.metrics.sinCambios > 0,
        );

      return {
        fromWeekNumber,
        toWeekNumber,
        fromWeekLabel: formatIsoWeekLabel(fromWeekNumber),
        toWeekLabel: formatIsoWeekLabel(toWeekNumber),
        title: `Movimiento del funnel — Semana ${fromWeekNumber} a Semana ${toWeekNumber}`,
        advisors,
      };
    };

    const periods = ADVISOR_FUNNEL_MOVEMENT_WEEK_OFFSETS.map((weeksBack) =>
      buildPeriod(weeksBack),
    );

    return {
      currentWeekLabel,
      periods,
    };
  }

  /** Empresas de un bucket del movimiento por asesor (paginado). */
  async getAdvisorFunnelMovementCompanies(opts: {
    to?: string;
    advisorId: string;
    metric: AdvisorFunnelMovementMetricKey;
    toWeekNumber: number;
    page?: number;
    limit?: number;
    advisorIdFilter?: string;
    assignedTo?: string;
    excludeAssignedTo?: string;
    advisorPool?: string;
    source?: string;
    crmScope: CrmDataScope;
  }): Promise<AdvisorFunnelMovementCompaniesPage> {
    const metric = opts.metric;
    if (!ADVISOR_FUNNEL_METRIC_TO_CATEGORY[metric]) {
      throw new BadRequestException('metric inválida');
    }
    const targetCategory = ADVISOR_FUNNEL_METRIC_TO_CATEGORY[metric];
    const advisorId = opts.advisorId?.trim();
    if (!advisorId) {
      throw new BadRequestException('advisorId requerido');
    }
    const toWeekNumber = Number(opts.toWeekNumber);
    if (!Number.isFinite(toWeekNumber) || toWeekNumber <= 0) {
      throw new BadRequestException('toWeekNumber inválido');
    }

    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 25));
    const referenceTo = opts.to?.trim()
      ? parseDayEnd(opts.to.trim())
      : new Date();
    const unrestricted = opts.crmScope.unrestricted;
    const filters = await this.resolveScopeFilters({
      advisorId: opts.advisorIdFilter,
      assignedTo: opts.assignedTo,
      excludeAssignedTo: opts.excludeAssignedTo,
      advisorPool: opts.advisorPool,
      source: opts.source,
      unrestricted,
      viewerUserId: opts.crmScope.viewerUserId,
    });

    const anchorMonday = startOfWeekMondayLima(referenceTo);
    let weeksBack: number | null = null;
    for (const offset of ADVISOR_FUNNEL_MOVEMENT_WEEK_OFFSETS) {
      const targetMonday = addLimaWeeks(anchorMonday, -offset);
      if (isoWeekNumberLima(targetMonday) === toWeekNumber) {
        weeksBack = offset;
        break;
      }
    }
    if (weeksBack == null) {
      throw new BadRequestException('Semana no disponible en el movimiento por asesor');
    }

    const targetMonday = addLimaWeeks(anchorMonday, -weeksBack);
    const clipStart = targetMonday;
    const clipEnd = minInstant(endOfWeekSundayLima(targetMonday), referenceTo);

    const portfolioWhere = mergeCompanyScope(
      {
        ...this.companyPortfolioBaseWhere(filters, unrestricted),
        createdAt: { lte: referenceTo },
      },
      opts.crmScope,
    );

    const [stages, portfolioCompanies, auditRows] = await Promise.all([
      this.prisma.crmStage.findMany({
        where: { enabled: true },
        select: { slug: true, name: true, probability: true },
      }),
      this.prisma.company.findMany({
        where: portfolioWhere,
        select: {
          id: true,
          name: true,
          urlSlug: true,
          createdAt: true,
          etapa: true,
          assignedTo: true,
        },
      }),
      this.prisma.auditChangeSet.findMany({
        where: {
          module: 'empresas',
          entityType: 'Empresa',
          createdAt: { lte: referenceTo },
          entries: {
            some: { fieldKey: { in: ['etapa', 'assignedTo'] } },
          },
        },
        include: {
          entries: {
            where: { fieldKey: { in: ['etapa', 'assignedTo'] } },
            select: { fieldKey: true, oldValue: true, newValue: true },
          },
        },
      }),
    ]);

    const stageInfo = new Map<string, { name: string; probability: number }>();
    for (const s of stages) {
      stageInfo.set(s.slug, { name: s.name, probability: s.probability });
    }
    const getProb = (slug: string): number => {
      const key = slug.trim();
      const meta = stageInfo.get(key);
      if (meta) return meta.probability;
      return STAGE_PROBABILITY_FALLBACK[key] ?? 0;
    };
    const getStageLabel = (slug: string): string => {
      const key = slug.trim();
      return stageInfo.get(key)?.name ?? key;
    };

    const portfolioIds = new Set(portfolioCompanies.map((c) => c.id));

    type EtapaAuditEv = { at: Date; oldSlug: string; newSlug: string };
    const etapaAuditsByCompany = new Map<string, EtapaAuditEv[]>();
    type FieldAuditEv = { at: Date; oldValue: string; newValue: string };
    const assignedAuditsByCompany = new Map<string, FieldAuditEv[]>();

    for (const row of auditRows) {
      const id = row.entityId;
      if (!id || !portfolioIds.has(id)) continue;
      for (const et of row.entries) {
        if (et.fieldKey === 'etapa') {
          const oldSlug = et.oldValue.trim();
          const newSlug = et.newValue.trim();
          if (!oldSlug && !newSlug) continue;
          const list = etapaAuditsByCompany.get(id) ?? [];
          list.push({ at: row.createdAt, oldSlug, newSlug });
          etapaAuditsByCompany.set(id, list);
        } else if (et.fieldKey === 'assignedTo') {
          const list = assignedAuditsByCompany.get(id) ?? [];
          list.push({
            at: row.createdAt,
            oldValue: et.oldValue,
            newValue: et.newValue,
          });
          assignedAuditsByCompany.set(id, list);
        }
      }
    }
    for (const [, list] of etapaAuditsByCompany) {
      list.sort((a, b) => a.at.getTime() - b.at.getTime());
    }
    for (const [, list] of assignedAuditsByCompany) {
      list.sort((a, b) => a.at.getTime() - b.at.getTime());
    }

    const etapaAtByCompany = new Map<string, (instant: Date) => string>();
    const advisorAtByCompany = new Map<string, (instant: Date) => string>();
    for (const company of portfolioCompanies) {
      const etapaAudits = (etapaAuditsByCompany.get(company.id) ?? []).map((e) => ({
        at: e.at,
        oldValue: e.oldSlug,
        newValue: e.newSlug,
      }));
      const advisorAudits = assignedAuditsByCompany.get(company.id) ?? [];
      const currentAdvisor = company.assignedTo?.trim() ?? '';
      etapaAtByCompany.set(
        company.id,
        buildEtapaStepFunction(company.createdAt, company.etapa, etapaAudits),
      );
      advisorAtByCompany.set(
        company.id,
        buildEtapaStepFunction(company.createdAt, currentAdvisor, advisorAudits),
      );
    }

    const advisorKeyAt = (companyId: string, instant: Date): string => {
      const fn = advisorAtByCompany.get(companyId);
      const raw = fn ? fn(instant).trim() : '';
      return raw || UNASSIGNED_ADVISOR_ID;
    };

    const matches: AdvisorFunnelMovementCompanyRow[] = [];
    for (const company of portfolioCompanies) {
      const etapaFn = etapaAtByCompany.get(company.id);
      if (!etapaFn) continue;

      const inWeek = (etapaAuditsByCompany.get(company.id) ?? []).filter(
        (e) => e.at >= clipStart && e.at <= clipEnd,
      );
      const category = this.classifyCompanyMovementInWeekClip(
        company,
        clipStart,
        clipEnd,
        etapaFn,
        inWeek,
        getProb,
      );
      if (!category) continue;
      if (category !== targetCategory) continue;
      if (advisorKeyAt(company.id, clipEnd) !== advisorId) continue;

      const etapaSlug = etapaFn(clipEnd).trim();
      matches.push({
        id: company.id,
        name: company.name.trim() || 'Sin nombre',
        urlSlug: company.urlSlug?.trim() || company.id,
        etapa: etapaSlug,
        etapaLabel: getStageLabel(etapaSlug),
      });
    }

    matches.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const total = matches.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;

    return {
      data: matches.slice(start, start + limit),
      total,
      page: safePage,
      limit,
      totalPages,
    };
  }

  /**
   * Empresas creadas en el año en curso (1 ene Lima) en etapas con probabilidad
   * dentro del rango, al cierre de cada semana ISO (Lima).
   * Últimas {@link COMPANY_WEEKLY_CHART_WEEKS} semanas respecto a `referenceTo`.
   */
  private async buildCompanyWeeklyStageSnapshot(
    referenceTo: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    crmScope: CrmDataScope,
    minProbability: number,
    maxProbability: number,
  ): Promise<CompanyWeeklyStageSnapshot> {
    const anchorMonday = startOfWeekMondayLima(referenceTo);
    const weekMondays: Date[] = [];
    for (let i = COMPANY_WEEKLY_CHART_WEEKS - 1; i >= 0; i--) {
      const monday = addLimaWeeks(anchorMonday, -i);
      weekMondays.push(monday);
    }

    const { year } = instantToLimaParts(referenceTo);
    const yearStart = limaDayStart(year, 0, 1);

    const portfolioWhere = mergeCompanyScope(
      {
        ...this.companyPortfolioBaseWhere(filters, unrestricted),
        createdAt: { gte: yearStart, lte: referenceTo },
      },
      crmScope,
    );

    const [stages, portfolioCompanies, auditRows] = await Promise.all([
      this.prisma.crmStage.findMany({
        where: { enabled: true },
        select: { slug: true, name: true, probability: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.company.findMany({
        where: portfolioWhere,
        select: { id: true, createdAt: true, etapa: true },
      }),
      this.prisma.auditChangeSet.findMany({
        where: {
          module: 'empresas',
          entityType: 'Empresa',
          createdAt: { lte: referenceTo },
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

    const stageMeta = new Map(
      stages.map((s) => [
        s.slug,
        { name: s.name, probability: s.probability, sortOrder: s.sortOrder },
      ]),
    );
    const qualifyingSlugs = new Set(
      stages
        .filter(
          (s) =>
            s.probability >= minProbability &&
            s.probability <= maxProbability,
        )
        .map((s) => s.slug),
    );

    const getProbability = (slug: string): number => {
      const meta = stageMeta.get(slug.trim());
      if (meta) return meta.probability;
      return STAGE_PROBABILITY_FALLBACK[slug.trim()] ?? 0;
    };

    const isQualifyingSlug = (slug: string): boolean => {
      const s = slug.trim();
      if (qualifyingSlugs.has(s)) return true;
      const p = getProbability(s);
      return p >= minProbability && p <= maxProbability;
    };

    const portfolioIds = new Set(portfolioCompanies.map((c) => c.id));

    type AuditEv = { at: Date; oldValue: string; newValue: string };
    const auditsByCompany = new Map<string, AuditEv[]>();
    for (const row of auditRows) {
      const id = row.entityId;
      if (!id || !portfolioIds.has(id)) continue;
      const et = row.entries[0];
      if (!et) continue;
      const list = auditsByCompany.get(id) ?? [];
      list.push({
        at: row.createdAt,
        oldValue: et.oldValue,
        newValue: et.newValue,
      });
      auditsByCompany.set(id, list);
    }

    const etapaAtByCompany = new Map<string, (instant: Date) => string>();
    for (const company of portfolioCompanies) {
      const audits = auditsByCompany.get(company.id) ?? [];
      etapaAtByCompany.set(
        company.id,
        buildEtapaStepFunction(company.createdAt, company.etapa, audits),
      );
    }

    const weeks: CompanyWeeklyStageRow[] = weekMondays.map((monday) => {
      const weekEnd = minInstant(endOfWeekSundayLima(monday), referenceTo);
      const counts = new Map<string, number>();

      for (const company of portfolioCompanies) {
        if (company.createdAt < yearStart || company.createdAt > weekEnd) continue;
        const etapaFn = etapaAtByCompany.get(company.id);
        if (!etapaFn) continue;
        const slug = etapaFn(weekEnd).trim();
        if (!isQualifyingSlug(slug)) continue;
        counts.set(slug, (counts.get(slug) ?? 0) + 1);
      }

      const byStage: ActiveProspectStageRow[] = [...counts.entries()]
        .map(([slug, count]) => {
          const meta = stageMeta.get(slug);
          return {
            slug,
            name: meta?.name ?? slug,
            probability: meta?.probability ?? getProbability(slug),
            count,
          };
        })
        .sort((a, b) => {
          const oa = stageMeta.get(a.slug)?.sortOrder ?? 999_999;
          const ob = stageMeta.get(b.slug)?.sortOrder ?? 999_999;
          return oa - ob;
        });

      const total = byStage.reduce((sum, row) => sum + row.count, 0);

      return {
        name: isoWeekLabelFromInstant(monday),
        weekStart: monday.toISOString(),
        weekEnd: weekEnd.toISOString(),
        total,
        byStage,
      };
    });

    const currentTotal = weeks[weeks.length - 1]?.total ?? 0;
    const prevTotal = weeks[weeks.length - 2]?.total ?? 0;
    const changePct =
      weeks.length >= 2 && prevTotal > 0
        ? Math.round(((currentTotal - prevTotal) / prevTotal) * 1000) / 10
        : null;

    return { weeks, currentTotal, changePct };
  }

  private buildActiveProspectsWeekly(
    referenceTo: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    crmScope: CrmDataScope,
  ): Promise<CompanyWeeklyStageSnapshot> {
    return this.buildCompanyWeeklyStageSnapshot(
      referenceTo,
      filters,
      unrestricted,
      crmScope,
      ACTIVE_PROSPECT_MIN_PROBABILITY,
      ACTIVE_PROSPECT_MAX_PROBABILITY,
    );
  }

  private buildAdvancedContactsWeekly(
    referenceTo: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    crmScope: CrmDataScope,
  ): Promise<CompanyWeeklyStageSnapshot> {
    return this.buildCompanyWeeklyStageSnapshot(
      referenceTo,
      filters,
      unrestricted,
      crmScope,
      ADVANCED_CONTACTS_MIN_PROBABILITY,
      ADVANCED_CONTACTS_MAX_PROBABILITY,
    );
  }

  /**
   * Facturación estimada total de empresas creadas en el año en curso (1 ene Lima)
   * en etapas 10–100 % al cierre de cada semana.
   */
  private async buildEstimatedBillingWeekly(
    referenceTo: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    crmScope: CrmDataScope,
  ): Promise<EstimatedBillingWeeklySnapshot> {
    const anchorMonday = startOfWeekMondayLima(referenceTo);
    const weekMondays: Date[] = [];
    for (let i = COMPANY_WEEKLY_CHART_WEEKS - 1; i >= 0; i--) {
      const monday = addLimaWeeks(anchorMonday, -i);
      weekMondays.push(monday);
    }

    const { year } = instantToLimaParts(referenceTo);
    const yearStart = limaDayStart(year, 0, 1);

    const portfolioWhere = mergeCompanyScope(
      {
        ...this.companyPortfolioBaseWhere(filters, unrestricted),
        createdAt: { gte: yearStart, lte: referenceTo },
      },
      crmScope,
    );

    const [stages, portfolioCompanies, auditRows] = await Promise.all([
      this.prisma.crmStage.findMany({
        where: { enabled: true },
        select: { slug: true, name: true, probability: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.company.findMany({
        where: portfolioWhere,
        select: {
          id: true,
          createdAt: true,
          etapa: true,
          facturacionEstimada: true,
        },
      }),
      this.prisma.auditChangeSet.findMany({
        where: {
          module: 'empresas',
          entityType: 'Empresa',
          createdAt: { lte: referenceTo },
          entries: {
            some: { fieldKey: { in: ['etapa', 'facturacionEstimada'] } },
          },
        },
        include: {
          entries: {
            where: { fieldKey: { in: ['etapa', 'facturacionEstimada'] } },
            select: { fieldKey: true, oldValue: true, newValue: true },
          },
        },
      }),
    ]);

    const stageMeta = new Map(
      stages.map((s) => [
        s.slug,
        { name: s.name, probability: s.probability, sortOrder: s.sortOrder },
      ]),
    );

    const getProbability = (slug: string): number => {
      const meta = stageMeta.get(slug.trim());
      if (meta) return meta.probability;
      return STAGE_PROBABILITY_FALLBACK[slug.trim()] ?? 0;
    };

    const isQualifyingSlug = (slug: string): boolean => {
      const p = getProbability(slug.trim());
      return (
        p >= ESTIMATED_BILLING_MIN_PROBABILITY &&
        p <= ESTIMATED_BILLING_MAX_PROBABILITY
      );
    };

    const portfolioIds = new Set(portfolioCompanies.map((c) => c.id));

    type AuditEv = { at: Date; oldValue: string; newValue: string };
    const auditsByCompanyField = new Map<string, AuditEv[]>();
    for (const row of auditRows) {
      const id = row.entityId;
      if (!id || !portfolioIds.has(id)) continue;
      for (const et of row.entries) {
        const key = `${id}:${et.fieldKey}`;
        const list = auditsByCompanyField.get(key) ?? [];
        list.push({
          at: row.createdAt,
          oldValue: et.oldValue,
          newValue: et.newValue,
        });
        auditsByCompanyField.set(key, list);
      }
    }

    const etapaAtByCompany = new Map<string, (instant: Date) => string>();
    const billingAtByCompany = new Map<string, (instant: Date) => number>();
    for (const company of portfolioCompanies) {
      const etapaAudits = auditsByCompanyField.get(`${company.id}:etapa`) ?? [];
      const billingAudits =
        auditsByCompanyField.get(`${company.id}:facturacionEstimada`) ?? [];
      const currentBilling = Number(company.facturacionEstimada) || 0;
      etapaAtByCompany.set(
        company.id,
        buildEtapaStepFunction(company.createdAt, company.etapa, etapaAudits),
      );
      billingAtByCompany.set(
        company.id,
        buildNumericStepFunction(
          company.createdAt,
          currentBilling,
          billingAudits,
        ),
      );
    }

    const weeks: EstimatedBillingWeekRow[] = weekMondays.map((monday) => {
      const weekEnd = minInstant(endOfWeekSundayLima(monday), referenceTo);
      const amountsByStage = new Map<string, number>();
      let total = 0;

      for (const company of portfolioCompanies) {
        if (company.createdAt < yearStart || company.createdAt > weekEnd) continue;
        const etapaFn = etapaAtByCompany.get(company.id);
        const billingFn = billingAtByCompany.get(company.id);
        if (!etapaFn || !billingFn) continue;
        const slug = etapaFn(weekEnd).trim();
        if (!isQualifyingSlug(slug)) continue;
        const amount = Math.max(0, billingFn(weekEnd));
        if (amount <= 0) continue;
        total += amount;
        amountsByStage.set(slug, (amountsByStage.get(slug) ?? 0) + amount);
      }

      const byStage: EstimatedBillingStageRow[] = [...amountsByStage.entries()]
        .map(([slug, amount]) => {
          const meta = stageMeta.get(slug);
          return {
            slug,
            name: meta?.name ?? slug,
            probability: meta?.probability ?? getProbability(slug),
            amount,
          };
        })
        .sort((a, b) => {
          const oa = stageMeta.get(a.slug)?.sortOrder ?? 999_999;
          const ob = stageMeta.get(b.slug)?.sortOrder ?? 999_999;
          return oa - ob;
        });

      return {
        name: isoWeekLabelFromInstant(monday),
        weekStart: monday.toISOString(),
        weekEnd: weekEnd.toISOString(),
        total,
        byStage,
      };
    });

    const currentTotal = weeks[weeks.length - 1]?.total ?? 0;
    const prevTotal = weeks[weeks.length - 2]?.total ?? 0;
    const changePct =
      weeks.length >= 2 && prevTotal > 0
        ? Math.round(((currentTotal - prevTotal) / prevTotal) * 1000) / 10
        : null;

    return { weeks, currentTotal, changePct };
  }

  /**
   * Matriz asesor × etapa (10–100 %) y facturación estimada por asesor al cierre de cada semana.
   * Solo empresas creadas en el año en curso (1 ene Lima).
   */
  private async buildActiveProspectsByAdvisorWeekly(
    referenceTo: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    crmScope: CrmDataScope,
    advisorUsers: { id: string; name: string }[],
  ): Promise<ActiveProspectsByAdvisorWeeklySnapshot> {
    const anchorMonday = startOfWeekMondayLima(referenceTo);
    const weekMondays: Date[] = [];
    for (let i = COMPANY_WEEKLY_CHART_WEEKS - 1; i >= 0; i--) {
      const monday = addLimaWeeks(anchorMonday, -i);
      weekMondays.push(monday);
    }

    const { year } = instantToLimaParts(referenceTo);
    const yearStart = limaDayStart(year, 0, 1);

    const portfolioWhere = mergeCompanyScope(
      {
        ...this.companyPortfolioBaseWhere(filters, unrestricted),
        createdAt: { gte: yearStart, lte: referenceTo },
      },
      crmScope,
    );

    const [stages, portfolioCompanies, auditRows] = await Promise.all([
      this.prisma.crmStage.findMany({
        where: { enabled: true },
        select: { slug: true, name: true, probability: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.company.findMany({
        where: portfolioWhere,
        select: {
          id: true,
          createdAt: true,
          etapa: true,
          assignedTo: true,
          facturacionEstimada: true,
        },
      }),
      this.prisma.auditChangeSet.findMany({
        where: {
          module: 'empresas',
          entityType: 'Empresa',
          createdAt: { lte: referenceTo },
          entries: {
            some: {
              fieldKey: { in: ['etapa', 'assignedTo', 'facturacionEstimada'] },
            },
          },
        },
        include: {
          entries: {
            where: {
              fieldKey: { in: ['etapa', 'assignedTo', 'facturacionEstimada'] },
            },
            select: { fieldKey: true, oldValue: true, newValue: true },
          },
        },
      }),
    ]);

    const stageMeta = new Map(
      stages.map((s) => [
        s.slug,
        { name: s.name, probability: s.probability, sortOrder: s.sortOrder },
      ]),
    );
    const qualifyingStages = stages
      .filter(
        (s) =>
          s.probability >= ACTIVE_PROSPECT_MIN_PROBABILITY &&
          s.probability <= ACTIVE_PROSPECT_MAX_PROBABILITY,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const getProbability = (slug: string): number => {
      const meta = stageMeta.get(slug.trim());
      if (meta) return meta.probability;
      return STAGE_PROBABILITY_FALLBACK[slug.trim()] ?? 0;
    };

    const isQualifyingSlug = (slug: string): boolean => {
      const p = getProbability(slug.trim());
      return (
        p >= ACTIVE_PROSPECT_MIN_PROBABILITY &&
        p <= ACTIVE_PROSPECT_MAX_PROBABILITY
      );
    };

    const portfolioIds = new Set(portfolioCompanies.map((c) => c.id));
    const advisorNameById = new Map(advisorUsers.map((u) => [u.id, u.name]));

    type AuditEv = { at: Date; oldValue: string; newValue: string };
    const auditsByCompanyField = new Map<string, AuditEv[]>();
    for (const row of auditRows) {
      const id = row.entityId;
      if (!id || !portfolioIds.has(id)) continue;
      for (const et of row.entries) {
        const key = `${id}:${et.fieldKey}`;
        const list = auditsByCompanyField.get(key) ?? [];
        list.push({
          at: row.createdAt,
          oldValue: et.oldValue,
          newValue: et.newValue,
        });
        auditsByCompanyField.set(key, list);
      }
    }

    const etapaAtByCompany = new Map<string, (instant: Date) => string>();
    const advisorAtByCompany = new Map<string, (instant: Date) => string>();
    const billingAtByCompany = new Map<string, (instant: Date) => number>();
    for (const company of portfolioCompanies) {
      const etapaAudits = auditsByCompanyField.get(`${company.id}:etapa`) ?? [];
      const advisorAudits =
        auditsByCompanyField.get(`${company.id}:assignedTo`) ?? [];
      const billingAudits =
        auditsByCompanyField.get(`${company.id}:facturacionEstimada`) ?? [];
      const currentBilling = Number(company.facturacionEstimada) || 0;
      const currentAdvisor = company.assignedTo?.trim() ?? '';
      etapaAtByCompany.set(
        company.id,
        buildEtapaStepFunction(company.createdAt, company.etapa, etapaAudits),
      );
      advisorAtByCompany.set(
        company.id,
        buildEtapaStepFunction(company.createdAt, currentAdvisor, advisorAudits),
      );
      billingAtByCompany.set(
        company.id,
        buildNumericStepFunction(
          company.createdAt,
          currentBilling,
          billingAudits,
        ),
      );
    }

    type WeekRaw = {
      name: string;
      weekStart: string;
      weekEnd: string;
      countsBySlugAdvisor: Map<string, Map<string, number>>;
      billingByAdvisor: Map<string, number>;
      advisorIds: Set<string>;
    };

    const rawWeeks: WeekRaw[] = weekMondays.map((monday) => {
      const weekEnd = minInstant(endOfWeekSundayLima(monday), referenceTo);
      const countsBySlugAdvisor = new Map<string, Map<string, number>>();
      const billingByAdvisor = new Map<string, number>();
      const advisorIds = new Set<string>();

      for (const company of portfolioCompanies) {
        if (company.createdAt < yearStart || company.createdAt > weekEnd) continue;
        const etapaFn = etapaAtByCompany.get(company.id);
        const advisorFn = advisorAtByCompany.get(company.id);
        const billingFn = billingAtByCompany.get(company.id);
        if (!etapaFn || !advisorFn || !billingFn) continue;

        const slug = etapaFn(weekEnd).trim();
        if (!isQualifyingSlug(slug)) continue;

        const advisorId = advisorFn(weekEnd).trim() || UNASSIGNED_ADVISOR_ID;
        advisorIds.add(advisorId);

        const byAdvisor = countsBySlugAdvisor.get(slug) ?? new Map<string, number>();
        byAdvisor.set(advisorId, (byAdvisor.get(advisorId) ?? 0) + 1);
        countsBySlugAdvisor.set(slug, byAdvisor);

        const amount = Math.max(0, billingFn(weekEnd));
        if (amount > 0) {
          billingByAdvisor.set(
            advisorId,
            (billingByAdvisor.get(advisorId) ?? 0) + amount,
          );
        }
      }

      return {
        name: isoWeekLabelFromInstant(monday),
        weekStart: monday.toISOString(),
        weekEnd: weekEnd.toISOString(),
        countsBySlugAdvisor,
        billingByAdvisor,
        advisorIds,
      };
    });

    const globalAdvisorIds = new Set<string>();
    for (const w of rawWeeks) {
      for (const id of w.advisorIds) globalAdvisorIds.add(id);
    }

    const missingAdvisorIds = [...globalAdvisorIds].filter(
      (id) => id !== UNASSIGNED_ADVISOR_ID && !advisorNameById.has(id),
    );
    if (missingAdvisorIds.length > 0) {
      const extraUsers = await this.prisma.user.findMany({
        where: { id: { in: missingAdvisorIds } },
        select: { id: true, name: true },
      });
      for (const u of extraUsers) {
        const name = u.name?.trim();
        if (name) advisorNameById.set(u.id, name);
      }
    }

    const sortAdvisorIds = (ids: Iterable<string>): string[] =>
      [...ids].sort((a, b) => {
        if (a === UNASSIGNED_ADVISOR_ID) return 1;
        if (b === UNASSIGNED_ADVISOR_ID) return -1;
        const na = advisorNameById.get(a) ?? a;
        const nb = advisorNameById.get(b) ?? b;
        return na.localeCompare(nb, 'es');
      });

    const globalAdvisorOrder = sortAdvisorIds(globalAdvisorIds);

    const advisorLabel = (id: string): string => {
      if (id === UNASSIGNED_ADVISOR_ID) return 'Sin asignar';
      return advisorNameById.get(id) ?? 'Asesor desconocido';
    };

    const weeks: ActiveProspectsAdvisorWeekRow[] = rawWeeks.map((raw) => {
      const advisors = globalAdvisorOrder.map((id) => ({
        id,
        name: advisorLabel(id),
      }));

      const stageSlugs = new Set(qualifyingStages.map((s) => s.slug));
      for (const slug of raw.countsBySlugAdvisor.keys()) {
        if (isQualifyingSlug(slug)) stageSlugs.add(slug);
      }

      const orderedSlugs = [...stageSlugs].sort((a, b) => {
        const oa = stageMeta.get(a)?.sortOrder ?? 999_999;
        const ob = stageMeta.get(b)?.sortOrder ?? 999_999;
        return oa - ob;
      });

      const stages: ActiveProspectsAdvisorStageRow[] = orderedSlugs.map((slug) => {
        const byAdvisor = raw.countsBySlugAdvisor.get(slug);
        const countsByAdvisor: Record<string, number> = {};
        for (const advisorId of globalAdvisorOrder) {
          countsByAdvisor[advisorId] = byAdvisor?.get(advisorId) ?? 0;
        }
        const meta = stageMeta.get(slug);
        return {
          slug,
          name: meta?.name ?? slug,
          probability: meta?.probability ?? getProbability(slug),
          countsByAdvisor,
        };
      });

      const estimatedBillingByAdvisor: Record<string, number> = {};
      for (const advisorId of globalAdvisorOrder) {
        estimatedBillingByAdvisor[advisorId] =
          raw.billingByAdvisor.get(advisorId) ?? 0;
      }

      return {
        name: raw.name,
        weekStart: raw.weekStart,
        weekEnd: raw.weekEnd,
        advisors,
        stages,
        estimatedBillingByAdvisor,
      };
    });

    return { weeks };
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
    let weekStart = startOfWeekMondayLima(from);

    while (weekStart <= to) {
      const weekEnd = endOfWeekSundayLima(weekStart);
      const clipStart = maxInstant(weekStart, from);
      const clipEnd = minInstant(weekEnd, to);

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
          name: formatIsoWeekLabel(isoWeekNumberLima(weekStart)),
          avance,
          nuevoIngreso,
          atraso,
          sinCambios,
        });
      }

      weekStart = new Date(weekStart);
      weekStart = addLimaWeeks(weekStart, 1);
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

  /**
   * Actividades de interacción completadas por tipo y semana ISO (Lima),
   * últimas {@link ACTIVITIES_HEATMAP_WEEK_COUNT} semanas. Respeta filtro de asesor.
   */
  private async buildActivitiesByTypeWeekly(
    referenceTo: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
  ): Promise<ActivitiesByTypeWeeklySnapshot> {
    const anchorMonday = startOfWeekMondayLima(referenceTo);
    const weekTargets = Array.from({ length: ACTIVITIES_HEATMAP_WEEK_COUNT }, (_, i) => {
      const offset = ACTIVITIES_HEATMAP_WEEK_COUNT - 1 - i;
      const monday = addLimaWeeks(anchorMonday, -offset);
      return {
        name: formatIsoWeekLabel(isoWeekNumberLima(monday)),
        weekStart: monday,
        weekEnd: minInstant(endOfWeekSundayLima(monday), referenceTo),
      };
    });

    const rangeStart = weekTargets[0]?.weekStart ?? anchorMonday;
    const acts = await this.prisma.activity.findMany({
      where: this.activityWhereForAnalytics(
        {
          completedAt: { gte: rangeStart, lte: referenceTo },
        },
        filters,
        unrestricted,
      ),
      select: { completedAt: true, type: true },
    });

    const weekIndexByName = new Map(
      weekTargets.map((week, index) => [week.name, index] as const),
    );
    const countsByType = new Map<
      ActivitiesByTypeWeeklyRow['key'],
      number[]
    >(
      ACTIVITY_TYPE_DEFINITIONS.map((def) => [
        def.key,
        Array(weekTargets.length).fill(0),
      ]),
    );

    for (const act of acts) {
      if (!act.completedAt) continue;
      const typeKey = activityTypeKeyFromRaw(act.type);
      if (!typeKey) continue;

      let weekIndex: number | null = null;
      for (const week of weekTargets) {
        if (
          act.completedAt >= week.weekStart &&
          act.completedAt <= week.weekEnd
        ) {
          weekIndex = weekIndexByName.get(week.name) ?? null;
          break;
        }
      }
      if (weekIndex == null) continue;

      const row = countsByType.get(typeKey);
      if (!row) continue;
      row[weekIndex] = (row[weekIndex] ?? 0) + 1;
    }

    let maxCount = 0;
    const types: ActivitiesByTypeWeeklyRow[] = ACTIVITY_TYPE_DEFINITIONS.map(
      (def) => {
        const counts = countsByType.get(def.key) ?? Array(weekTargets.length).fill(0);
        const total = counts.reduce((sum, n) => sum + n, 0);
        for (const n of counts) maxCount = Math.max(maxCount, n);
        return {
          key: def.key,
          label: def.label,
          counts,
          total,
        };
      },
    )
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'es'));

    return {
      weeks: weekTargets.map((week) => ({
        name: week.name,
        weekStart: week.weekStart.toISOString(),
        weekEnd: week.weekEnd.toISOString(),
      })),
      types,
      maxCount,
    };
  }

  /**
   * Actividades completadas por asesor y tipo, últimas
   * {@link ACTIVITIES_HEATMAP_WEEK_COUNT} semanas ISO (Lima).
   */
  private async buildActivitiesByAdvisorWeekly(
    referenceTo: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    userRows: { id: string; name: string }[],
  ): Promise<ActivitiesByAdvisorWeeklySnapshot> {
    const anchorMonday = startOfWeekMondayLima(referenceTo);
    const weekTargets = Array.from({ length: ACTIVITIES_HEATMAP_WEEK_COUNT }, (_, i) => {
      const offset = ACTIVITIES_HEATMAP_WEEK_COUNT - 1 - i;
      const monday = addLimaWeeks(anchorMonday, -offset);
      return {
        name: formatIsoWeekLabel(isoWeekNumberLima(monday)),
        weekStart: monday,
        weekEnd: minInstant(endOfWeekSundayLima(monday), referenceTo),
      };
    });

    const rangeStart = weekTargets[0]?.weekStart ?? anchorMonday;
    const acts = await this.prisma.activity.findMany({
      where: this.activityWhereForAnalytics(
        {
          completedAt: { gte: rangeStart, lte: referenceTo },
        },
        filters,
        unrestricted,
      ),
      select: { completedAt: true, type: true, assignedTo: true },
    });

    type AdvisorCounts = {
      llamadas: number;
      reuniones: number;
      correos: number;
      notas: number;
    };

    const emptyCounts = (): AdvisorCounts => ({
      llamadas: 0,
      reuniones: 0,
      correos: 0,
      notas: 0,
    });

    const countsByAdvisor = new Map<string, AdvisorCounts[]>();

    const ensureAdvisorWeeks = (advisorId: string): AdvisorCounts[] => {
      const existing = countsByAdvisor.get(advisorId);
      if (existing) return existing;
      const rows = weekTargets.map(() => emptyCounts());
      countsByAdvisor.set(advisorId, rows);
      return rows;
    };

    for (const act of acts) {
      if (!act.completedAt) continue;
      const typeKey = activityTypeKeyFromRaw(act.type);
      if (!typeKey) continue;

      let weekIndex: number | null = null;
      for (const [index, week] of weekTargets.entries()) {
        if (
          act.completedAt >= week.weekStart &&
          act.completedAt <= week.weekEnd
        ) {
          weekIndex = index;
          break;
        }
      }
      if (weekIndex == null) continue;

      const advisorId = act.assignedTo?.trim() || UNASSIGNED_ADVISOR_ID;
      const rows = ensureAdvisorWeeks(advisorId);
      const row = rows[weekIndex] ?? emptyCounts();
      row[typeKey] = (row[typeKey] ?? 0) + 1;
      rows[weekIndex] = row;
    }

    const idToName = new Map(
      userRows.map((u) => [u.id, u.name.trim() || 'Sin nombre'] as const),
    );
    const missingNameIds = [...countsByAdvisor.keys()].filter(
      (id) => id !== UNASSIGNED_ADVISOR_ID && !idToName.has(id),
    );
    if (missingNameIds.length > 0) {
      const resolved = await this.prisma.user.findMany({
        where: { id: { in: missingNameIds } },
        select: { id: true, name: true },
      });
      for (const u of resolved) {
        idToName.set(u.id, u.name.trim() || 'Sin nombre');
      }
    }

    const resolveAdvisorName = (id: string): string => {
      if (id === UNASSIGNED_ADVISOR_ID) return 'Sin asignar';
      return idToName.get(id) ?? 'Sin nombre';
    };

    const advisors: ActivitiesByAdvisorWeeklyRow[] = [...countsByAdvisor.entries()]
      .map(([advisorId, byWeekRows]) => {
        const totals = emptyCounts();
        const byWeek = byWeekRows.map((weekRow) => {
          totals.llamadas += weekRow.llamadas;
          totals.reuniones += weekRow.reuniones;
          totals.correos += weekRow.correos;
          totals.notas += weekRow.notas;
          const weekTotal =
            weekRow.llamadas +
            weekRow.reuniones +
            weekRow.correos +
            weekRow.notas;
          return {
            llamadas: weekRow.llamadas,
            reuniones: weekRow.reuniones,
            correos: weekRow.correos,
            notas: weekRow.notas,
            total: weekTotal,
          };
        });
        const total =
          totals.llamadas +
          totals.reuniones +
          totals.correos +
          totals.notas;
        return {
          advisorId,
          advisorName: resolveAdvisorName(advisorId),
          ...totals,
          total,
          byWeek,
        };
      })
      .filter((row) => row.total > 0)
      .sort(
        (a, b) =>
          b.total - a.total ||
          a.advisorName.localeCompare(b.advisorName, 'es'),
      );

    return {
      weeks: weekTargets.map((week) => ({
        name: week.name,
        weekStart: week.weekStart.toISOString(),
        weekEnd: week.weekEnd.toISOString(),
      })),
      advisors,
    };
  }

  /**
   * Tareas completadas por tipo (taskKind) y semana ISO (Lima),
   * últimas {@link ACTIVITIES_HEATMAP_WEEK_COUNT} semanas.
   */
  private async buildTasksByKindWeekly(
    referenceTo: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
  ): Promise<TasksByKindWeeklySnapshot> {
    const anchorMonday = startOfWeekMondayLima(referenceTo);
    const weekTargets = Array.from({ length: ACTIVITIES_HEATMAP_WEEK_COUNT }, (_, i) => {
      const offset = ACTIVITIES_HEATMAP_WEEK_COUNT - 1 - i;
      const monday = addLimaWeeks(anchorMonday, -offset);
      return {
        name: formatIsoWeekLabel(isoWeekNumberLima(monday)),
        weekStart: monday,
        weekEnd: minInstant(endOfWeekSundayLima(monday), referenceTo),
      };
    });

    const rangeStart = weekTargets[0]?.weekStart ?? anchorMonday;
    const tasks = await this.prisma.activity.findMany({
      where: this.activityWhereForAnalytics(
        {
          ...TASK_ACTIVITY_FILTER,
          completedAt: { gte: rangeStart, lte: referenceTo },
        },
        filters,
        unrestricted,
      ),
      select: { completedAt: true, taskKind: true },
    });

    const weekIndexByName = new Map(
      weekTargets.map((week, index) => [week.name, index] as const),
    );
    const countsByKind = new Map<TasksByKindWeeklyRow['key'], number[]>(
      TASK_KIND_DEFINITIONS.map((def) => [
        def.key,
        Array(weekTargets.length).fill(0),
      ]),
    );

    for (const task of tasks) {
      if (!task.completedAt) continue;
      const kindKey = taskKindKeyFromRaw(task.taskKind);
      if (!kindKey) continue;

      let weekIndex: number | null = null;
      for (const week of weekTargets) {
        if (
          task.completedAt >= week.weekStart &&
          task.completedAt <= week.weekEnd
        ) {
          weekIndex = weekIndexByName.get(week.name) ?? null;
          break;
        }
      }
      if (weekIndex == null) continue;

      const row = countsByKind.get(kindKey);
      if (!row) continue;
      row[weekIndex] = (row[weekIndex] ?? 0) + 1;
    }

    let maxCount = 0;
    const kinds: TasksByKindWeeklyRow[] = TASK_KIND_DEFINITIONS.map((def) => {
      const counts = countsByKind.get(def.key) ?? Array(weekTargets.length).fill(0);
      const total = counts.reduce((sum, n) => sum + n, 0);
      for (const n of counts) maxCount = Math.max(maxCount, n);
      return {
        key: def.key,
        label: def.label,
        counts,
        total,
      };
    })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'es'));

    return {
      weeks: weekTargets.map((week) => ({
        name: week.name,
        weekStart: week.weekStart.toISOString(),
        weekEnd: week.weekEnd.toISOString(),
      })),
      kinds,
      maxCount,
    };
  }

  /**
   * Tareas completadas por asesor y tipo, últimas
   * {@link ACTIVITIES_HEATMAP_WEEK_COUNT} semanas ISO (Lima).
   */
  private async buildTasksByAdvisorWeekly(
    referenceTo: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    userRows: { id: string; name: string }[],
  ): Promise<TasksByAdvisorWeeklySnapshot> {
    const anchorMonday = startOfWeekMondayLima(referenceTo);
    const weekTargets = Array.from({ length: ACTIVITIES_HEATMAP_WEEK_COUNT }, (_, i) => {
      const offset = ACTIVITIES_HEATMAP_WEEK_COUNT - 1 - i;
      const monday = addLimaWeeks(anchorMonday, -offset);
      return {
        name: formatIsoWeekLabel(isoWeekNumberLima(monday)),
        weekStart: monday,
        weekEnd: minInstant(endOfWeekSundayLima(monday), referenceTo),
      };
    });

    const rangeStart = weekTargets[0]?.weekStart ?? anchorMonday;
    const tasks = await this.prisma.activity.findMany({
      where: this.activityWhereForAnalytics(
        {
          ...TASK_ACTIVITY_FILTER,
          completedAt: { gte: rangeStart, lte: referenceTo },
        },
        filters,
        unrestricted,
      ),
      select: { completedAt: true, taskKind: true, assignedTo: true },
    });

    type AdvisorCounts = {
      llamadas: number;
      reuniones: number;
      correos: number;
      whatsapp: number;
    };

    const emptyCounts = (): AdvisorCounts => ({
      llamadas: 0,
      reuniones: 0,
      correos: 0,
      whatsapp: 0,
    });

    const countsByAdvisor = new Map<string, AdvisorCounts[]>();

    const ensureAdvisorWeeks = (advisorId: string): AdvisorCounts[] => {
      const existing = countsByAdvisor.get(advisorId);
      if (existing) return existing;
      const rows = weekTargets.map(() => emptyCounts());
      countsByAdvisor.set(advisorId, rows);
      return rows;
    };

    for (const task of tasks) {
      if (!task.completedAt) continue;
      const kindKey = taskKindKeyFromRaw(task.taskKind);
      if (!kindKey) continue;

      let weekIndex: number | null = null;
      for (const [index, week] of weekTargets.entries()) {
        if (
          task.completedAt >= week.weekStart &&
          task.completedAt <= week.weekEnd
        ) {
          weekIndex = index;
          break;
        }
      }
      if (weekIndex == null) continue;

      const advisorId = task.assignedTo?.trim() || UNASSIGNED_ADVISOR_ID;
      const rows = ensureAdvisorWeeks(advisorId);
      const row = rows[weekIndex] ?? emptyCounts();
      row[kindKey] = (row[kindKey] ?? 0) + 1;
      rows[weekIndex] = row;
    }

    const idToName = new Map(
      userRows.map((u) => [u.id, u.name.trim() || 'Sin nombre'] as const),
    );
    const missingNameIds = [...countsByAdvisor.keys()].filter(
      (id) => id !== UNASSIGNED_ADVISOR_ID && !idToName.has(id),
    );
    if (missingNameIds.length > 0) {
      const resolved = await this.prisma.user.findMany({
        where: { id: { in: missingNameIds } },
        select: { id: true, name: true },
      });
      for (const u of resolved) {
        idToName.set(u.id, u.name.trim() || 'Sin nombre');
      }
    }

    const resolveAdvisorName = (id: string): string => {
      if (id === UNASSIGNED_ADVISOR_ID) return 'Sin asignar';
      return idToName.get(id) ?? 'Sin nombre';
    };

    const advisors: TasksByAdvisorWeeklyRow[] = [...countsByAdvisor.entries()]
      .map(([advisorId, byWeekRows]) => {
        const totals = emptyCounts();
        const byWeek = byWeekRows.map((weekRow) => {
          totals.llamadas += weekRow.llamadas;
          totals.reuniones += weekRow.reuniones;
          totals.correos += weekRow.correos;
          totals.whatsapp += weekRow.whatsapp;
          const weekTotal =
            weekRow.llamadas +
            weekRow.reuniones +
            weekRow.correos +
            weekRow.whatsapp;
          return {
            llamadas: weekRow.llamadas,
            reuniones: weekRow.reuniones,
            correos: weekRow.correos,
            whatsapp: weekRow.whatsapp,
            total: weekTotal,
          };
        });
        const total =
          totals.llamadas +
          totals.reuniones +
          totals.correos +
          totals.whatsapp;
        return {
          advisorId,
          advisorName: resolveAdvisorName(advisorId),
          ...totals,
          total,
          byWeek,
        };
      })
      .filter((row) => row.total > 0)
      .sort(
        (a, b) =>
          b.total - a.total ||
          a.advisorName.localeCompare(b.advisorName, 'es'),
      );

    return {
      weeks: weekTargets.map((week) => ({
        name: week.name,
        weekStart: week.weekStart.toISOString(),
        weekEnd: week.weekEnd.toISOString(),
      })),
      advisors,
    };
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
    const activeStageSlugs = await this.resolveStageSlugsInProbabilityRange(
      ACTIVE_PROSPECT_MIN_PROBABILITY,
      ACTIVE_PROSPECT_MAX_PROBABILITY,
    );
    const activeStageEtapaFilter = this.etapaInSlugsFilter(activeStageSlugs);

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
        where: { ...cw, etapa: activeStageEtapaFilter },
        _count: { id: true },
      }),
      this.prisma.contact.groupBy({
        by: ['etapa'],
        where: cw,
        _count: { id: true },
      }),
      opts.crmScope.unrestricted
        ? findCommercialAdvisorUsers(this.prisma, { area: opts.area })
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
        where: { ...compW, etapa: activeStageEtapaFilter },
        _count: { id: true },
      }),
      this.prisma.opportunity.groupBy({
        by: ['fuente'],
        where: {
          ...this.opportunityWhereCreatedInRange(from, to, filters, unrestricted),
          etapa: activeStageEtapaFilter,
        },
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
        const { start: mStart, end: mEnd } = monthRangeLima(ym);
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
        const { start: mStart, end: mEnd } = monthRangeLima(ym);
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
        const { start: mStart, end: mEnd } = monthRangeLima(ym);
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

    const [
      companiesWeeklyProgress,
      activeProspectsWeekly,
      advancedContactsWeekly,
      estimatedBillingWeekly,
      activeProspectsByAdvisorWeekly,
      companiesAdvisorFunnelMovement,
      companiesBySourceWeekly,
      sourcesDetailWeekly,
      hotProspects,
      activitiesByTypeWeekly,
      activitiesByAdvisorWeekly,
      tasksByKindWeekly,
      tasksByAdvisorWeekly,
    ] = await Promise.all([
      this.buildCompaniesWeeklyProgress(
        from,
        to,
        filters,
        unrestricted,
        opts.crmScope,
      ),
      this.buildActiveProspectsWeekly(
        to,
        filters,
        unrestricted,
        opts.crmScope,
      ),
      this.buildAdvancedContactsWeekly(
        to,
        filters,
        unrestricted,
        opts.crmScope,
      ),
      this.buildEstimatedBillingWeekly(
        to,
        filters,
        unrestricted,
        opts.crmScope,
      ),
      this.buildActiveProspectsByAdvisorWeekly(
        to,
        filters,
        unrestricted,
        opts.crmScope,
        userRows,
      ),
      this.buildCompaniesAdvisorFunnelMovement(
        to,
        filters,
        unrestricted,
        opts.crmScope,
        userRows,
      ),
      this.buildCompaniesBySourceWeekly(
        to,
        filters,
        unrestricted,
        opts.crmScope,
        leadCatalog,
      ),
      this.buildSourcesDetailWeekly(
        to,
        filters,
        unrestricted,
        opts.crmScope,
        leadCatalog,
        userRows.map((u) => u.id),
      ),
      this.buildHotProspectsSummary(
        to,
        filters,
        unrestricted,
        opts.crmScope,
      ),
      this.buildActivitiesByTypeWeekly(to, filters, unrestricted),
      this.buildActivitiesByAdvisorWeekly(to, filters, unrestricted, userRows),
      this.buildTasksByKindWeekly(to, filters, unrestricted),
      this.buildTasksByAdvisorWeekly(to, filters, unrestricted, userRows),
    ]);

    const sourcesDetail: SourcesDetailSnapshot = sourcesDetailWeekly.weeks[0]
      ? {
          week: sourcesDetailWeekly.weeks[0].week,
          sources: sourcesDetailWeekly.weeks[0].sources,
        }
      : {
          week: {
            name: '',
            weekStart: '',
            weekEnd: '',
          },
          sources: [],
        };

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
    const { from: sparkFrom, to: sparkTo, weeks: sparklineWeeks } = sparklineRange(sparkWeeks, to);

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
      companiesBySourceWeekly,
      sourcesDetail,
      sourcesDetailWeekly,
      hotProspects,
      funnelByStage,
      companiesByStage,
      companiesWeeklyProgress,
      activeProspectsWeekly,
      activeProspectsByAdvisorWeekly,
      companiesAdvisorFunnelMovement,
      advancedContactsWeekly,
      estimatedBillingWeekly,
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
      activitiesByTypeWeekly,
      activitiesByAdvisorWeekly,
      tasksByKindWeekly,
      tasksByAdvisorWeekly,
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
    const weekStart = startOfWeekMondayLima(now);
    const weekEnd = endOfWeekSundayLima(now);
    const monthStart = startOfMonthLima(now);
    const monthEnd = endOfMonthLima(now);

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
