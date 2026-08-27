import { BadRequestException, Injectable } from '@nestjs/common';
import {
  activityCountKeyWithContactGoalRules,
  callGoalKindLabel,
  classifyCallGoalKind,
  type CallGoalKind,
  type CompanyContactGoalContext,
} from '../activities/call-goal-kind.util';
import {
  callInteractionTypeKey,
  callOutcomeDescriptionWhere,
  callOutcomeGroupFromResult,
  callOutcomeLabel,
  callResultDetailLabel,
  parseCallResultFromDescription,
  type CallOutcomeGroup,
} from '../activities/call-result.util';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { CrmDataScope } from '../auth/crm-data-scope.service';
import { mergeCompanyScope } from '../common/crm-data-scope-where.util';
import { loadContactGoalCompanyContext as loadContactGoalCompanyContextFromDb } from '../activities/call-goal-context';
import { STAGE_PROBABILITY_FALLBACK } from '../crm-config/crm-config.constants';
import { CrmConfigService } from '../crm-config/crm-config.service';
import { buildEtapaStepFunction, buildNumericStepFunction } from '../import-export/company-export-weeks.util';
import {
  buildAdvisorIdentityIndex,
  buildAdvisorStepFunction,
  type AdvisorIdentityIndex,
} from '../common/advisor-audit.util';
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
  /** Empresas con actividad en la semana (alta o cambio de etapa), por etapa al cierre. */
  activityTotal: number;
  activityByStage: ActiveProspectStageRow[];
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
  /** Matriz asesor × etapa solo para empresas con actividad en la semana. */
  activityStages: ActiveProspectsAdvisorStageRow[];
  activityBillingByAdvisor: Record<string, number>;
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

type ActivitiesByAdvisorDetailEntity = {
  id: string;
  name: string;
  urlSlug: string;
};

type ActivitiesByAdvisorDetailRow = {
  id: string;
  type: string;
  typeLabel: string;
  title: string;
  completedAt: string;
  callOutcome?: 'contacto' | 'no_contacto';
  callOutcomeLabel?: string;
  callResultLabel?: string;
  callGoalKind?: CallGoalKind;
  callGoalKindLabel?: string;
  companies: ActivitiesByAdvisorDetailEntity[];
  contacts: ActivitiesByAdvisorDetailEntity[];
  opportunities: { id: string; title: string; urlSlug: string }[];
};

type ActivitiesByAdvisorDetailsPage = {
  data: ActivitiesByAdvisorDetailRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  advisorName: string;
  weekLabel: string;
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
  key:
    | 'llamadas_contacto'
    | 'llamadas_seguimiento'
    | 'llamadas_no_contacto'
    | 'reuniones'
    | 'correos';
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
  llamadasContacto: number;
  llamadasSeguimiento: number;
  llamadasNoContacto: number;
  reuniones: number;
  correos: number;
  notas: number;
  total: number;
  byWeek: {
    llamadas: number;
    llamadasContacto: number;
    llamadasSeguimiento: number;
    llamadasNoContacto: number;
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
  key: 'llamadas' | 'reuniones' | 'correos';
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
  { key: 'llamadas_contacto' as const, label: 'Contacto' },
  { key: 'llamadas_seguimiento' as const, label: 'Seguimiento' },
  { key: 'llamadas_no_contacto' as const, label: 'No contacto' },
  { key: 'reuniones' as const, label: 'Reuniones' },
  { key: 'correos' as const, label: 'Correos' },
];

function activityTypeKeyFromRaw(
  type: string | null | undefined,
  description?: string | null,
): ActivitiesByTypeWeeklyRow['key'] | null {
  return callInteractionTypeKey(type, description);
}

function activityTypeDisplayLabel(type: string | null | undefined): string {
  const t = type?.toLowerCase().trim() ?? '';
  if (t === 'llamada') return 'Llamada';
  if (t === 'reunion' || t === 'reunión') return 'Reunión';
  if (t === 'correo') return 'Correo';
  return type?.trim() || 'Actividad';
}

const INTERACTION_ACTIVITY_TYPE_FILTER: Prisma.ActivityWhereInput = {
  OR: [
    { type: { equals: 'llamada', mode: 'insensitive' } },
    { type: { equals: 'reunion', mode: 'insensitive' } },
    { type: { equals: 'correo', mode: 'insensitive' } },
  ],
};

function parseAdvisorDetailActivityType(raw?: string): string | undefined {
  const value = raw?.trim().toLowerCase();
  if (!value || value === 'all') return undefined;
  if (value === 'reunión') return 'reunion';
  return value;
}

function parseAdvisorDetailCallOutcome(raw?: string): CallOutcomeGroup | undefined {
  const value = raw?.trim().toLowerCase();
  if (value === 'contacto' || value === 'no_contacto') return value;
  return undefined;
}

function parseAdvisorDetailCallGoalKind(raw?: string): CallGoalKind | undefined {
  const value = raw?.trim().toLowerCase();
  if (value === 'meta' || value === 'seguimiento' || value === 'no_contacto') {
    return value;
  }
  return undefined;
}

function advisorDetailCallFilters(
  activityType: string | undefined,
  callOutcome: CallOutcomeGroup | undefined,
  field: 'type' | 'taskKind',
): Prisma.ActivityWhereInput {
  const filters: Prisma.ActivityWhereInput[] = [];
  if (callOutcome) {
    filters.push(callOutcomeDescriptionWhere(callOutcome));
    if (!activityType) {
      filters.push({
        [field]: { equals: 'llamada', mode: 'insensitive' },
      });
    }
  }
  if (filters.length === 0) return {};
  if (filters.length === 1) return filters[0];
  return { AND: filters };
}

/** Cartera Clientes (ClienteEmpresa): no alimenta dashboard ni reportes comerciales. */
const EXCLUDE_CLIENTE_CARTERA_ACTIVITY_FILTER: Prisma.ActivityWhereInput = {
  clienteEmpresas: { none: {} },
};

const TASK_KIND_DEFINITIONS = [
  { key: 'llamadas' as const, label: 'Llamadas' },
  { key: 'reuniones' as const, label: 'Reuniones' },
  { key: 'correos' as const, label: 'Correos' },
];

function taskKindKeyFromRaw(
  taskKind: string | null | undefined,
): TasksByKindWeeklyRow['key'] | null {
  const k = taskKind?.toLowerCase() ?? '';
  if (k === 'llamada') return 'llamadas';
  if (k === 'reunion' || k === 'reunión') return 'reuniones';
  if (k === 'correo') return 'correos';
  return null;
}

function taskKindDisplayLabel(taskKind: string | null | undefined): string {
  const k = taskKind?.toLowerCase().trim() ?? '';
  if (k === 'llamada') return 'Tarea · Llamada';
  if (k === 'reunion' || k === 'reunión') return 'Tarea · Reunión';
  if (k === 'correo') return 'Tarea · Correo';
  return 'Tarea';
}

const TASK_KIND_ANALYTICS_FILTER: Prisma.ActivityWhereInput = {
  OR: [
    { taskKind: { equals: 'llamada', mode: 'insensitive' } },
    { taskKind: { equals: 'reunion', mode: 'insensitive' } },
    { taskKind: { equals: 'correo', mode: 'insensitive' } },
  ],
};

const COMPANY_WEEKLY_CHART_WEEKS = 6;
/** Tope de días en gráficos diarios del dashboard (actividades / tareas). */
const DAILY_CHART_MAX_DAYS = 31;
/** Tope de semanas en gráficos semanales (empresas, actividades, tareas) cuando el rango es largo. */
const WEEKLY_CHART_MAX_WEEKS = 20;
const SOURCES_WEEKLY_CHART_WEEKS = 6;
const SOURCES_DETAIL_WEEKLY_COUNT = 5;
/** Semanas consecutivas hacia atrás, incluyendo la actual (W33→W34, W32→W33, …). */
const ADVISOR_FUNNEL_MOVEMENT_WEEK_OFFSETS = Array.from(
  { length: COMPANY_WEEKLY_CHART_WEEKS },
  (_, index) => index,
);
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

type WeekTarget = {
  name: string;
  weekStart: Date;
  weekEnd: Date;
};

/** Semanas ISO (Lima) dentro del rango del filtro. Si hay más que `maxWeeks`, toma las más recientes. */
function weekTargetsForChartRange(
  from: Date,
  to: Date,
  maxWeeks: number = WEEKLY_CHART_MAX_WEEKS,
): WeekTarget[] {
  const targets: WeekTarget[] = [];
  let weekStart = startOfWeekMondayLima(from);
  while (weekStart <= to) {
    targets.push({
      name: formatIsoWeekLabel(isoWeekNumberLima(weekStart)),
      weekStart,
      weekEnd: minInstant(endOfWeekSundayLima(weekStart), to),
    });
    weekStart = addLimaWeeks(weekStart, 1);
  }
  if (targets.length > maxWeeks) {
    return targets.slice(-maxWeeks);
  }
  return targets;
}

const LIMA_DAY_LABEL_MONTHS = [
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
] as const;

function limaYmdFromInstant(d: Date): string {
  const { year, month, day } = instantToLimaParts(d);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addLimaDays(dayStart: Date, days: number): Date {
  const { year, month, day } = instantToLimaParts(dayStart);
  return limaDayStart(year, month, day + days);
}

function formatDayLabelLima(dayStart: Date): string {
  const { month, day } = instantToLimaParts(dayStart);
  return `${String(day).padStart(2, '0')} ${LIMA_DAY_LABEL_MONTHS[month]}`;
}

/** Días calendario (Lima) dentro del rango del filtro. */
function dayTargetsForChartRange(
  from: Date,
  to: Date,
  maxDays: number = DAILY_CHART_MAX_DAYS,
): WeekTarget[] {
  const targets: WeekTarget[] = [];
  const fromParts = instantToLimaParts(from);
  const toParts = instantToLimaParts(to);
  let cur = limaDayStart(fromParts.year, fromParts.month, fromParts.day);
  const end = limaDayStart(toParts.year, toParts.month, toParts.day);

  while (cur.getTime() <= end.getTime()) {
    const ymd = limaYmdFromInstant(cur);
    targets.push({
      name: formatDayLabelLima(cur),
      weekStart: cur,
      weekEnd: parseDayEndLima(ymd),
    });
    cur = addLimaDays(cur, 1);
  }
  if (targets.length > maxDays) {
    return targets.slice(-maxDays);
  }
  return targets;
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

/** Resultado semanal de leads/contactados del panel Marketing (flota + comercial). */
export type MarketingLeadsByWeek = {
  weeks: { date: string; leads: number; contactados: number }[];
};

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

  private async loadAdvisorIdentityIndex(): Promise<AdvisorIdentityIndex> {
    const users = await this.prisma.user.findMany({
      select: { id: true, name: true },
    });
    return buildAdvisorIdentityIndex(users);
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
   * ISO (Lima), incluyendo la actual recortada a `referenceTo`. Acumulado 1 ene →
   * cierre de cada semana; etapa y facturación al cierre (auditoría). Desglose por
   * asesor usa `assignedTo` actual (filtro local en UI).
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
    for (let i = 0; i < SOURCES_DETAIL_WEEKLY_COUNT; i += 1) {
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
   * Cartera de prospectos calientes al cierre de la semana ISO de `referenceTo`
   * (si es la semana en curso, recorta a hoy).
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
    const targetMonday = startOfWeekMondayLima(referenceTo);
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

    const [stages, portfolioCompanies, auditRows, advisorUsers, advisorIndex] =
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
        this.loadAdvisorIdentityIndex(),
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

    const advisorNameById = new Map(advisorIndex.nameById);
    for (const u of advisorUsers) {
      const name = u.name?.trim();
      if (name) advisorNameById.set(u.id, name);
    }
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
      advisorFn: buildAdvisorStepFunction(
        company.createdAt,
        company.assignedTo?.trim() ?? '',
        auditsByCompanyField.get(`${company.id}:assignedTo`) ?? [],
        advisorIndex,
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

  /** Empresa creada o con cambio de etapa dentro del rango semanal. */
  private companyHadStageActivityInWeek(
    company: { createdAt: Date },
    clipStart: Date,
    clipEnd: Date,
    etapaAudits: { at: Date }[],
  ): boolean {
    if (company.createdAt >= clipStart && company.createdAt <= clipEnd) return true;
    return etapaAudits.some((e) => e.at >= clipStart && e.at <= clipEnd);
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

  /** Etapa histórica de empresas vinculadas a llamadas (reglas de meta de contacto). */
  private loadContactGoalCompanyContext(
    companyIds: string[],
    referenceTo: Date,
  ) {
    return loadContactGoalCompanyContextFromDb(
      this.prisma,
      companyIds,
      referenceTo,
    );
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
   * Movimiento del embudo por asesor: parejas consecutivas de semanas ISO
   * (ej. W33→W34 actual, W32→W33, …; 6 periodos, la más vieja se omite).
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

    const [stages, portfolioCompanies, auditRows, advisorIndex] = await Promise.all([
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
      this.loadAdvisorIdentityIndex(),
    ]);

    const stageInfo = new Map<string, number>();
    for (const s of stages) stageInfo.set(s.slug, s.probability);
    const getProb = (slug: string): number => {
      const key = slug.trim();
      if (stageInfo.has(key)) return stageInfo.get(key)!;
      return STAGE_PROBABILITY_FALLBACK[key] ?? 0;
    };

    const portfolioIds = new Set(portfolioCompanies.map((c) => c.id));
    const advisorNameById = new Map(advisorIndex.nameById);
    for (const u of advisorUsers) {
      const name = u.name?.trim();
      if (name) advisorNameById.set(u.id, name);
    }

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
        buildAdvisorStepFunction(
          company.createdAt,
          currentAdvisor,
          advisorAudits,
          advisorIndex,
        ),
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

    const [stages, portfolioCompanies, auditRows, advisorIndex] = await Promise.all([
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
      this.loadAdvisorIdentityIndex(),
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
        buildAdvisorStepFunction(
          company.createdAt,
          currentAdvisor,
          advisorAudits,
          advisorIndex,
        ),
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

  /** Detalle de actividades completadas por asesor y semana (llamada, reunión, correo). */
  async getActivitiesByAdvisorDetails(opts: {
    advisorId: string;
    weekStart: string;
    weekEnd: string;
    from?: string;
    to?: string;
    assignedTo?: string;
    excludeAssignedTo?: string;
    advisorPool?: string;
    source?: string;
    activityType?: string;
    callOutcome?: string;
    callGoalKind?: string;
    contactGoalRules?: boolean;
    page?: number;
    limit?: number;
    crmScope: CrmDataScope;
  }): Promise<ActivitiesByAdvisorDetailsPage> {
    const advisorId = opts.advisorId?.trim();
    if (!advisorId) {
      throw new BadRequestException('advisorId requerido');
    }

    const weekStartRaw = opts.weekStart?.trim();
    const weekEndRaw = opts.weekEnd?.trim();
    if (!weekStartRaw || !weekEndRaw) {
      throw new BadRequestException('weekStart y weekEnd requeridos');
    }
    const weekStart = new Date(weekStartRaw);
    const weekEnd = new Date(weekEndRaw);
    if (
      Number.isNaN(weekStart.getTime()) ||
      Number.isNaN(weekEnd.getTime())
    ) {
      throw new BadRequestException('weekStart/weekEnd inválidos');
    }

    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 25));
    const unrestricted = opts.crmScope.unrestricted;
    const filters = await this.resolveScopeFilters({
      assignedTo: opts.assignedTo,
      excludeAssignedTo: opts.excludeAssignedTo,
      advisorPool: opts.advisorPool,
      source: opts.source,
      unrestricted,
      viewerUserId: opts.crmScope.viewerUserId,
    });

    const activityType = parseAdvisorDetailActivityType(opts.activityType);
    const callOutcome = parseAdvisorDetailCallOutcome(opts.callOutcome);
    const callGoalKind = parseAdvisorDetailCallGoalKind(opts.callGoalKind);
    const contactGoalRules = opts.contactGoalRules === true;

    const where = this.activityWhereForAnalytics(
      {
        ...(activityType
          ? { type: { equals: activityType, mode: 'insensitive' } }
          : INTERACTION_ACTIVITY_TYPE_FILTER),
        completedAt: { gte: weekStart, lte: weekEnd },
        ...(advisorId === UNASSIGNED_ADVISOR_ID
          ? { assignedTo: '' }
          : { assignedTo: advisorId }),
        ...(contactGoalRules
          ? {}
          : advisorDetailCallFilters(activityType, callOutcome, 'type')),
      },
      filters,
      unrestricted,
    );

    const detailSelect = {
      id: true,
      type: true,
      title: true,
      description: true,
      completedAt: true,
      companies: {
        include: {
          company: { select: { id: true, name: true, urlSlug: true } },
        },
      },
      contacts: {
        include: {
          contact: { select: { id: true, name: true, urlSlug: true } },
        },
      },
      opportunities: {
        include: {
          opportunity: { select: { id: true, title: true, urlSlug: true } },
        },
      },
    } as const;

    const advisorUserPromise =
      advisorId === UNASSIGNED_ADVISOR_ID
        ? Promise.resolve(null)
        : this.prisma.user.findUnique({
            where: { id: advisorId },
            select: { name: true },
          });

    const advisorNameFromUser = (
      advisorUser: { name: string | null } | null,
    ): string =>
      advisorId === UNASSIGNED_ADVISOR_ID
        ? 'Sin asignar'
        : advisorUser?.name?.trim() || 'Sin nombre';

    const weekLabel = formatIsoWeekLabel(isoWeekNumberLima(weekStart));

    const matchesCallGoalFilter = (
      row: ActivitiesByAdvisorDetailRow,
    ): boolean => {
      if (callGoalKind) return row.callGoalKind === callGoalKind;
      if (callOutcome === 'contacto') {
        return row.callGoalKind === 'meta' || row.callGoalKind === 'seguimiento';
      }
      if (callOutcome === 'no_contacto') {
        return row.callGoalKind === 'no_contacto';
      }
      return true;
    };

    if (!contactGoalRules) {
      const [total, pageRows, advisorUser] = await Promise.all([
        this.prisma.activity.count({ where }),
        this.prisma.activity.findMany({
          where,
          orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
          select: detailSelect,
        }),
        advisorUserPromise,
      ]);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, totalPages);
      return {
        data: pageRows.map((row) => this.mapActivitiesByAdvisorDetailRow(row)),
        total,
        page: safePage,
        limit,
        totalPages,
        advisorName: advisorNameFromUser(advisorUser),
        weekLabel,
      };
    }

    const needsInMemoryCallFilter = Boolean(
      callGoalKind || callOutcome,
    );

    if (needsInMemoryCallFilter) {
      const [allRows, advisorUser] = await Promise.all([
        this.prisma.activity.findMany({
          where,
          orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
          select: detailSelect,
        }),
        advisorUserPromise,
      ]);
      const contactGoalCtx = await this.loadContactGoalCompanyContext(
        allRows.flatMap((row) => row.companies.map(({ company }) => company.id)),
        weekEnd,
      );
      const filtered = allRows
        .map((row) => this.mapActivitiesByAdvisorDetailRow(row, contactGoalCtx))
        .filter(matchesCallGoalFilter);
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * limit;
      return {
        data: filtered.slice(start, start + limit),
        total,
        page: safePage,
        limit,
        totalPages,
        advisorName: advisorNameFromUser(advisorUser),
        weekLabel,
      };
    }

    const [total, pageRows, advisorUser] = await Promise.all([
      this.prisma.activity.count({ where }),
      this.prisma.activity.findMany({
        where,
        orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: detailSelect,
      }),
      advisorUserPromise,
    ]);
    const contactGoalCtx = await this.loadContactGoalCompanyContext(
      pageRows.flatMap((row) => row.companies.map(({ company }) => company.id)),
      weekEnd,
    );
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    return {
      data: pageRows.map((row) =>
        this.mapActivitiesByAdvisorDetailRow(row, contactGoalCtx),
      ),
      total,
      page: safePage,
      limit,
      totalPages,
      advisorName: advisorNameFromUser(advisorUser),
      weekLabel,
    };
  }

  private mapActivitiesByAdvisorDetailRow(
    row: {
      id: string;
      type: string;
      title: string;
      description: string | null;
      completedAt: Date | null;
      companies: {
        company: { id: string; name: string; urlSlug: string | null };
      }[];
      contacts: {
        contact: { id: string; name: string; urlSlug: string | null };
      }[];
      opportunities: {
        opportunity: { id: string; title: string; urlSlug: string | null };
      }[];
    },
    contactGoalCtx?: {
      getProb: (slug: string) => number;
      byCompanyId: Map<string, CompanyContactGoalContext>;
    } | null,
  ): ActivitiesByAdvisorDetailRow {
    const typeKey = row.type?.toLowerCase().trim() ?? '';
    const parsedResult =
      typeKey === 'llamada'
        ? parseCallResultFromDescription(row.description)
        : null;
    const callOutcome =
      typeKey === 'llamada'
        ? callOutcomeGroupFromResult(parsedResult)
        : undefined;

    let callGoalKind: CallGoalKind | undefined;
    if (typeKey === 'llamada' && contactGoalCtx && row.completedAt) {
      const companies = row.companies
        .map(({ company }) => contactGoalCtx.byCompanyId.get(company.id))
        .filter((company): company is CompanyContactGoalContext => Boolean(company));
      callGoalKind = classifyCallGoalKind(
        row.completedAt,
        parsedResult,
        companies,
        contactGoalCtx.getProb,
        ACTIVE_PROSPECT_MIN_PROBABILITY,
      );
    }

    return {
      id: row.id,
      type: row.type,
      typeLabel: activityTypeDisplayLabel(row.type),
      title: row.title.trim() || row.type,
      completedAt: row.completedAt?.toISOString() ?? '',
      ...(callOutcome
        ? {
            callOutcome,
            callOutcomeLabel: callOutcomeLabel(callOutcome),
            callResultLabel: callResultDetailLabel(parsedResult) ?? undefined,
          }
        : {}),
      ...(callGoalKind
        ? {
            callGoalKind,
            callGoalKindLabel: callGoalKindLabel(callGoalKind),
          }
        : {}),
      companies: row.companies.map(({ company }) => ({
        id: company.id,
        name: company.name.trim() || 'Sin nombre',
        urlSlug: company.urlSlug?.trim() || company.id,
      })),
      contacts: row.contacts.map(({ contact }) => ({
        id: contact.id,
        name: contact.name.trim() || 'Sin nombre',
        urlSlug: contact.urlSlug?.trim() || contact.id,
      })),
      opportunities: row.opportunities.map(({ opportunity }) => ({
        id: opportunity.id,
        title: opportunity.title.trim() || 'Sin título',
        urlSlug: opportunity.urlSlug?.trim() || opportunity.id,
      })),
    };
  }

  /** Detalle de tareas completadas por asesor y semana (llamada, reunión, correo). */
  async getTasksByAdvisorDetails(opts: {
    advisorId: string;
    weekStart: string;
    weekEnd: string;
    from?: string;
    to?: string;
    assignedTo?: string;
    excludeAssignedTo?: string;
    advisorPool?: string;
    source?: string;
    activityType?: string;
    callOutcome?: string;
    page?: number;
    limit?: number;
    crmScope: CrmDataScope;
  }): Promise<ActivitiesByAdvisorDetailsPage> {
    const advisorId = opts.advisorId?.trim();
    if (!advisorId) {
      throw new BadRequestException('advisorId requerido');
    }

    const weekStartRaw = opts.weekStart?.trim();
    const weekEndRaw = opts.weekEnd?.trim();
    if (!weekStartRaw || !weekEndRaw) {
      throw new BadRequestException('weekStart y weekEnd requeridos');
    }
    const weekStart = new Date(weekStartRaw);
    const weekEnd = new Date(weekEndRaw);
    if (
      Number.isNaN(weekStart.getTime()) ||
      Number.isNaN(weekEnd.getTime())
    ) {
      throw new BadRequestException('weekStart/weekEnd inválidos');
    }

    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 25));
    const unrestricted = opts.crmScope.unrestricted;
    const filters = await this.resolveScopeFilters({
      assignedTo: opts.assignedTo,
      excludeAssignedTo: opts.excludeAssignedTo,
      advisorPool: opts.advisorPool,
      source: opts.source,
      unrestricted,
      viewerUserId: opts.crmScope.viewerUserId,
    });

    const taskKind = parseAdvisorDetailActivityType(opts.activityType);
    const callOutcome = parseAdvisorDetailCallOutcome(opts.callOutcome);

    const where = this.activityWhereForAnalytics(
      {
        ...TASK_ACTIVITY_FILTER,
        ...(taskKind
          ? { taskKind: { equals: taskKind, mode: 'insensitive' } }
          : TASK_KIND_ANALYTICS_FILTER),
        completedAt: { gte: weekStart, lte: weekEnd },
        ...(advisorId === UNASSIGNED_ADVISOR_ID
          ? { assignedTo: '' }
          : { assignedTo: advisorId }),
        ...advisorDetailCallFilters(taskKind, callOutcome, 'taskKind'),
      },
      filters,
      unrestricted,
    );

    const [total, rows, advisorUser] = await Promise.all([
      this.prisma.activity.count({ where }),
      this.prisma.activity.findMany({
        where,
        orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          taskKind: true,
          title: true,
          completedAt: true,
          companies: {
            include: {
              company: { select: { id: true, name: true, urlSlug: true } },
            },
          },
          contacts: {
            include: {
              contact: { select: { id: true, name: true, urlSlug: true } },
            },
          },
          opportunities: {
            include: {
              opportunity: { select: { id: true, title: true, urlSlug: true } },
            },
          },
        },
      }),
      advisorId === UNASSIGNED_ADVISOR_ID
        ? Promise.resolve(null)
        : this.prisma.user.findUnique({
            where: { id: advisorId },
            select: { name: true },
          }),
    ]);

    const advisorName =
      advisorId === UNASSIGNED_ADVISOR_ID
        ? 'Sin asignar'
        : advisorUser?.name?.trim() || 'Sin nombre';
    const weekLabel = formatIsoWeekLabel(isoWeekNumberLima(weekStart));

    const data: ActivitiesByAdvisorDetailRow[] = rows.map((row) => ({
      id: row.id,
      type: row.taskKind ?? row.type,
      typeLabel: taskKindDisplayLabel(row.taskKind),
      title: row.title.trim() || taskKindDisplayLabel(row.taskKind),
      completedAt: row.completedAt?.toISOString() ?? '',
      companies: row.companies.map(({ company }) => ({
        id: company.id,
        name: company.name.trim() || 'Sin nombre',
        urlSlug: company.urlSlug?.trim() || company.id,
      })),
      contacts: row.contacts.map(({ contact }) => ({
        id: contact.id,
        name: contact.name.trim() || 'Sin nombre',
        urlSlug: contact.urlSlug?.trim() || contact.id,
      })),
      opportunities: row.opportunities.map(({ opportunity }) => ({
        id: opportunity.id,
        title: opportunity.title.trim() || 'Sin título',
        urlSlug: opportunity.urlSlug?.trim() || opportunity.id,
      })),
    }));

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);

    return {
      data,
      total,
      page: safePage,
      limit,
      totalPages,
      advisorName,
      weekLabel,
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
      const clipStart = monday;
      const counts = new Map<string, number>();
      const activityCounts = new Map<string, number>();

      for (const company of portfolioCompanies) {
        if (company.createdAt < yearStart || company.createdAt > weekEnd) continue;
        const etapaFn = etapaAtByCompany.get(company.id);
        if (!etapaFn) continue;
        const slug = etapaFn(weekEnd).trim();
        if (!isQualifyingSlug(slug)) continue;
        counts.set(slug, (counts.get(slug) ?? 0) + 1);

        const etapaAudits = auditsByCompany.get(company.id) ?? [];
        if (
          this.companyHadStageActivityInWeek(
            company,
            clipStart,
            weekEnd,
            etapaAudits,
          )
        ) {
          activityCounts.set(slug, (activityCounts.get(slug) ?? 0) + 1);
        }
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

      const activityByStage: ActiveProspectStageRow[] = [...activityCounts.entries()]
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
      const activityTotal = activityByStage.reduce((sum, row) => sum + row.count, 0);

      return {
        name: isoWeekLabelFromInstant(monday),
        weekStart: monday.toISOString(),
        weekEnd: weekEnd.toISOString(),
        total,
        byStage,
        activityTotal,
        activityByStage,
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

    const [stages, portfolioCompanies, auditRows, advisorIndex] = await Promise.all([
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
      this.loadAdvisorIdentityIndex(),
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
    const advisorNameById = new Map(advisorIndex.nameById);
    for (const u of advisorUsers) {
      const name = u.name?.trim();
      if (name) advisorNameById.set(u.id, name);
    }

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
        buildAdvisorStepFunction(
          company.createdAt,
          currentAdvisor,
          advisorAudits,
          advisorIndex,
        ),
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
      activityCountsBySlugAdvisor: Map<string, Map<string, number>>;
      activityBillingByAdvisor: Map<string, number>;
      activityAdvisorIds: Set<string>;
    };

    const rawWeeks: WeekRaw[] = weekMondays.map((monday) => {
      const weekEnd = minInstant(endOfWeekSundayLima(monday), referenceTo);
      const clipStart = monday;
      const countsBySlugAdvisor = new Map<string, Map<string, number>>();
      const billingByAdvisor = new Map<string, number>();
      const advisorIds = new Set<string>();
      const activityCountsBySlugAdvisor = new Map<string, Map<string, number>>();
      const activityBillingByAdvisor = new Map<string, number>();
      const activityAdvisorIds = new Set<string>();

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

        const etapaAudits = auditsByCompanyField.get(`${company.id}:etapa`) ?? [];
        if (
          !this.companyHadStageActivityInWeek(
            company,
            clipStart,
            weekEnd,
            etapaAudits,
          )
        ) {
          continue;
        }

        activityAdvisorIds.add(advisorId);
        const activityByAdvisor =
          activityCountsBySlugAdvisor.get(slug) ?? new Map<string, number>();
        activityByAdvisor.set(advisorId, (activityByAdvisor.get(advisorId) ?? 0) + 1);
        activityCountsBySlugAdvisor.set(slug, activityByAdvisor);

        if (amount > 0) {
          activityBillingByAdvisor.set(
            advisorId,
            (activityBillingByAdvisor.get(advisorId) ?? 0) + amount,
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
        activityCountsBySlugAdvisor,
        activityBillingByAdvisor,
        activityAdvisorIds,
      };
    });

    const globalAdvisorIds = new Set<string>();
    for (const w of rawWeeks) {
      for (const id of w.advisorIds) globalAdvisorIds.add(id);
      for (const id of w.activityAdvisorIds) globalAdvisorIds.add(id);
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
      for (const slug of raw.activityCountsBySlugAdvisor.keys()) {
        if (isQualifyingSlug(slug)) stageSlugs.add(slug);
      }

      const orderedSlugs = [...stageSlugs].sort((a, b) => {
        const oa = stageMeta.get(a)?.sortOrder ?? 999_999;
        const ob = stageMeta.get(b)?.sortOrder ?? 999_999;
        return oa - ob;
      });

      const buildStageRows = (
        countsMap: Map<string, Map<string, number>>,
      ): ActiveProspectsAdvisorStageRow[] =>
        orderedSlugs.map((slug) => {
          const byAdvisor = countsMap.get(slug);
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

      const stages = buildStageRows(raw.countsBySlugAdvisor);
      const activityStages = buildStageRows(raw.activityCountsBySlugAdvisor);

      const estimatedBillingByAdvisor: Record<string, number> = {};
      const activityBillingByAdvisor: Record<string, number> = {};
      for (const advisorId of globalAdvisorOrder) {
        estimatedBillingByAdvisor[advisorId] =
          raw.billingByAdvisor.get(advisorId) ?? 0;
        activityBillingByAdvisor[advisorId] =
          raw.activityBillingByAdvisor.get(advisorId) ?? 0;
      }

      return {
        name: raw.name,
        weekStart: raw.weekStart,
        weekEnd: raw.weekEnd,
        advisors,
        stages,
        estimatedBillingByAdvisor,
        activityStages,
        activityBillingByAdvisor,
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
   * dentro del rango del filtro de fechas. Respeta filtro de asesor.
   */
  private async buildActivitiesByTypeWeekly(
    from: Date,
    to: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    periodTargets?: WeekTarget[],
    useContactGoalRules = false,
  ): Promise<ActivitiesByTypeWeeklySnapshot> {
    const weekTargets = periodTargets ?? weekTargetsForChartRange(from, to);

    const acts = await this.prisma.activity.findMany({
      where: this.activityWhereForAnalytics(
        {
          completedAt: { gte: from, lte: to },
        },
        filters,
        unrestricted,
      ),
      select: {
        completedAt: true,
        type: true,
        description: true,
        ...(useContactGoalRules
          ? { companies: { select: { companyId: true } } }
          : {}),
      },
    });

    let contactGoalCtx: {
      getProb: (slug: string) => number;
      byCompanyId: Map<string, CompanyContactGoalContext>;
    } | null = null;
    if (useContactGoalRules) {
      const companyIds = acts.flatMap((act) =>
        'companies' in act
          ? act.companies.map((link) => link.companyId)
          : [],
      );
      contactGoalCtx = await this.loadContactGoalCompanyContext(companyIds, to);
    }

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
      const typeKey = useContactGoalRules
        ? activityCountKeyWithContactGoalRules(
            act.type,
            act.description,
            act.completedAt,
            'companies' in act
              ? act.companies.map((link) => link.companyId)
              : [],
            contactGoalCtx!.byCompanyId,
            contactGoalCtx!.getProb,
            ACTIVE_PROSPECT_MIN_PROBABILITY,
          )
        : activityTypeKeyFromRaw(act.type, act.description);
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
   * Actividades completadas por asesor y tipo, dentro del rango del filtro (Lima).
   */
  private async buildActivitiesByAdvisorWeekly(
    from: Date,
    to: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    userRows: { id: string; name: string }[],
    periodTargets?: WeekTarget[],
    useContactGoalRules = false,
  ): Promise<ActivitiesByAdvisorWeeklySnapshot> {
    const weekTargets = periodTargets ?? weekTargetsForChartRange(from, to);

    const acts = await this.prisma.activity.findMany({
      where: this.activityWhereForAnalytics(
        {
          completedAt: { gte: from, lte: to },
        },
        filters,
        unrestricted,
      ),
      select: {
        completedAt: true,
        type: true,
        description: true,
        assignedTo: true,
        ...(useContactGoalRules
          ? { companies: { select: { companyId: true } } }
          : {}),
      },
    });

    let contactGoalCtx: {
      getProb: (slug: string) => number;
      byCompanyId: Map<string, CompanyContactGoalContext>;
    } | null = null;
    if (useContactGoalRules) {
      const companyIds = acts.flatMap((act) =>
        'companies' in act
          ? act.companies.map((link) => link.companyId)
          : [],
      );
      contactGoalCtx = await this.loadContactGoalCompanyContext(companyIds, to);
    }

    type AdvisorCounts = {
      llamadasContacto: number;
      llamadasSeguimiento: number;
      llamadasNoContacto: number;
      reuniones: number;
      correos: number;
      notas: number;
    };

    const emptyCounts = (): AdvisorCounts => ({
      llamadasContacto: 0,
      llamadasSeguimiento: 0,
      llamadasNoContacto: 0,
      reuniones: 0,
      correos: 0,
      notas: 0,
    });

    const incrementAdvisorCount = (
      row: AdvisorCounts,
      typeKey: ActivitiesByTypeWeeklyRow['key'],
    ) => {
      if (typeKey === 'llamadas_contacto') {
        row.llamadasContacto += 1;
      } else if (typeKey === 'llamadas_seguimiento') {
        row.llamadasSeguimiento += 1;
      } else if (typeKey === 'llamadas_no_contacto') {
        row.llamadasNoContacto += 1;
      } else if (typeKey === 'reuniones') {
        row.reuniones += 1;
      } else if (typeKey === 'correos') {
        row.correos += 1;
      }
    };

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
      const typeKey = useContactGoalRules
        ? activityCountKeyWithContactGoalRules(
            act.type,
            act.description,
            act.completedAt,
            'companies' in act
              ? act.companies.map((link) => link.companyId)
              : [],
            contactGoalCtx!.byCompanyId,
            contactGoalCtx!.getProb,
            ACTIVE_PROSPECT_MIN_PROBABILITY,
          )
        : activityTypeKeyFromRaw(act.type, act.description);
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
      incrementAdvisorCount(row, typeKey);
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
          totals.llamadasContacto += weekRow.llamadasContacto;
          totals.llamadasSeguimiento += weekRow.llamadasSeguimiento;
          totals.llamadasNoContacto += weekRow.llamadasNoContacto;
          totals.reuniones += weekRow.reuniones;
          totals.correos += weekRow.correos;
          totals.notas += weekRow.notas;
          const weekLlamadas =
            weekRow.llamadasContacto +
            weekRow.llamadasSeguimiento +
            weekRow.llamadasNoContacto;
          const weekTotal =
            weekLlamadas + weekRow.reuniones + weekRow.correos + weekRow.notas;
          return {
            llamadas: weekLlamadas,
            llamadasContacto: weekRow.llamadasContacto,
            llamadasSeguimiento: weekRow.llamadasSeguimiento,
            llamadasNoContacto: weekRow.llamadasNoContacto,
            reuniones: weekRow.reuniones,
            correos: weekRow.correos,
            notas: weekRow.notas,
            total: weekTotal,
          };
        });
        const llamadas =
          totals.llamadasContacto +
          totals.llamadasSeguimiento +
          totals.llamadasNoContacto;
        const total = llamadas + totals.reuniones + totals.correos + totals.notas;
        return {
          advisorId,
          advisorName: resolveAdvisorName(advisorId),
          llamadas,
          llamadasContacto: totals.llamadasContacto,
          llamadasSeguimiento: totals.llamadasSeguimiento,
          llamadasNoContacto: totals.llamadasNoContacto,
          reuniones: totals.reuniones,
          correos: totals.correos,
          notas: totals.notas,
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
   * dentro del rango del filtro de fechas.
   */
  private async buildTasksByKindWeekly(
    from: Date,
    to: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    periodTargets?: WeekTarget[],
  ): Promise<TasksByKindWeeklySnapshot> {
    const weekTargets = periodTargets ?? weekTargetsForChartRange(from, to);

    const tasks = await this.prisma.activity.findMany({
      where: this.activityWhereForAnalytics(
        {
          ...TASK_ACTIVITY_FILTER,
          completedAt: { gte: from, lte: to },
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
   * Tareas completadas por asesor y tipo, dentro del rango del filtro (Lima).
   */
  private async buildTasksByAdvisorWeekly(
    from: Date,
    to: Date,
    filters: AnalyticsScopeFilters,
    unrestricted: boolean,
    userRows: { id: string; name: string }[],
  ): Promise<TasksByAdvisorWeeklySnapshot> {
    const weekTargets = weekTargetsForChartRange(from, to);

    const tasks = await this.prisma.activity.findMany({
      where: this.activityWhereForAnalytics(
        {
          ...TASK_ACTIVITY_FILTER,
          completedAt: { gte: from, lte: to },
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
    const w: Prisma.ActivityWhereInput = {
      AND: [base, EXCLUDE_CLIENTE_CARTERA_ACTIVITY_FILTER],
    };
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
    /** day = buckets diarios en actividades/tareas (dashboard operativo). */
    chartGranularity?: 'day' | 'week';
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
          etapa: activeStageEtapaFilter,
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

    /** Actividades por tipo y mes (completadas; sin notas) */
    const activitiesByTypeMonth: Record<
      string,
      { llamadas: number; reuniones: number; correos: number }
    > = {};
    for (const ym of months) {
      activitiesByTypeMonth[ym] = { llamadas: 0, reuniones: 0, correos: 0 };
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
    }
    const activitiesByTypeData = months.map((ym) => ({
      name: monthLabelEs(ym),
      ...activitiesByTypeMonth[ym],
    }));

    /** Oportunidades abiertas por etapa (10%–100%), conteo + suma de montos */
    const oppsByStage = await this.prisma.opportunity.groupBy({
      by: ['etapa'],
      where: {
        ...this.opportunityWhereOpen(filters, unrestricted, from, to),
        etapa: activeStageEtapaFilter,
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

    const isSingleDayRange =
      Boolean(opts.from?.trim()) &&
      Boolean(opts.to?.trim()) &&
      opts.from!.trim() === opts.to!.trim();
    const companiesWeeklyFrom = isSingleDayRange
      ? addLimaWeeks(
          startOfWeekMondayLima(to),
          -(COMPANY_WEEKLY_CHART_WEEKS - 1),
        )
      : from;

    const chartPeriodTargets =
      opts.chartGranularity === 'day'
        ? dayTargetsForChartRange(from, to)
        : undefined;
    const useContactGoalRules = opts.chartGranularity === 'day';

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
        companiesWeeklyFrom,
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
      this.buildActivitiesByTypeWeekly(
        from,
        to,
        filters,
        unrestricted,
        chartPeriodTargets,
        useContactGoalRules,
      ),
      this.buildActivitiesByAdvisorWeekly(
        from,
        to,
        filters,
        unrestricted,
        userRows,
        chartPeriodTargets,
        useContactGoalRules,
      ),
      this.buildTasksByKindWeekly(from, to, filters, unrestricted, chartPeriodTargets),
      this.buildTasksByAdvisorWeekly(from, to, filters, unrestricted, userRows),
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

  // ─── Marketing: leads y contactados semanales (flota + comercial) ───

  private limaYmd(d: Date): string {
    const p = instantToLimaParts(d);
    return `${p.year}-${String(p.month + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  }

  /** Primera fecha (YYYY-MM-DD) en que el historial del contacto llegó a etapa con probabilidad >= 10. */
  private firstContactadoDate(
    rawHistory: unknown,
    probFor: (slug: string) => number,
  ): string | null {
    const entries = Array.isArray(rawHistory)
      ? (rawHistory as { etapa?: string; fecha?: string }[])
      : [];
    let best: string | null = null;
    for (const e of entries) {
      if (!e?.etapa || !e?.fecha) continue;
      if (probFor(e.etapa) >= 10) {
        if (best === null || e.fecha < best) best = e.fecha;
      }
    }
    return best;
  }

  /**
   * Leads y contactados por semana (últimas N semanas, hora Lima).
   * - Leads flota: registrados en la ventana con redSocial de marketing.
   * - Contactados flota: primer mensaje WhatsApp saliente del prospecto.
   * - Leads comercial: contactos creados en la ventana con fuente Marketing.
   * - Contactados comercial: primera entrada del historial de etapas con probabilidad >= 10%.
   */
  async getMarketingLeadsByWeek(weeks = 8): Promise<MarketingLeadsByWeek> {
    const n = Math.min(52, Math.max(1, Math.floor(weeks || 8)));
    const WEEK_MS = 7 * 86400000;
    const toMon = startOfWeekMondayLima(new Date());
    const fromMon = new Date(toMon.getTime() - (n - 1) * WEEK_MS);
    const toEnd = endOfWeekSundayLima(new Date());

    const buckets = new Map<string, { leads: number; contactados: number }>();
    const bucketOrder: string[] = [];
    for (
      let cur = new Date(fromMon.getTime());
      cur.getTime() <= toMon.getTime();
      cur = new Date(cur.getTime() + WEEK_MS)
    ) {
      const key = this.limaYmd(cur);
      buckets.set(key, { leads: 0, contactados: 0 });
      bucketOrder.push(key);
    }

    const stages = await this.prisma.crmStage.findMany({
      select: { slug: true, probability: true },
    });
    const probBySlug = new Map<string, number>(
      stages.map((s) => [s.slug, s.probability]),
    );
    const probFor = (slug: string): number =>
      probBySlug.get(slug) ?? STAGE_PROBABILITY_FALLBACK[slug] ?? 0;

    const KEYWORDS = [
      'marketing',
      'facebook',
      'fb',
      'form',
      'live',
      'tik tok',
      'instagram',
      'tiktok',
    ];

    const flotaLeads = await this.prisma.flotaProspecto.findMany({
      where: {
        eliminadoAt: null,
        fechaRegistro: { gte: fromMon, lte: toEnd },
        OR: KEYWORDS.map((k) => ({
          redSocial: { contains: k, mode: 'insensitive' },
        })),
      },
      select: { id: true, fechaRegistro: true },
    });
    for (const p of flotaLeads) {
      if (!p.fechaRegistro) continue;
      const key = this.limaYmd(p.fechaRegistro);
      if (buckets.has(key)) buckets.get(key)!.leads += 1;
    }

    if (flotaLeads.length > 0) {
      const msgs = await this.prisma.crmWhatsappMessage.findMany({
        where: {
          direction: 'outbound',
          flotaProspectoId: { in: flotaLeads.map((p) => p.id) },
        },
        orderBy: { createdAt: 'asc' },
        select: { flotaProspectoId: true, createdAt: true },
        distinct: ['flotaProspectoId'],
      });
      for (const m of msgs) {
        const key = this.limaYmd(m.createdAt);
        if (buckets.has(key)) buckets.get(key)!.contactados += 1;
      }
    }

    const comercial = await this.prisma.contact.findMany({
      where: {
        fuente: { equals: 'marketing', mode: 'insensitive' },
        OR: [
          { createdAt: { gte: fromMon, lte: toEnd } },
          { updatedAt: { gte: fromMon, lte: toEnd } },
        ],
      },
      select: { id: true, createdAt: true, etapa: true, etapaHistory: true },
    });

    for (const c of comercial) {
      const key = this.limaYmd(c.createdAt);
      if (buckets.has(key)) buckets.get(key)!.leads += 1;
    }

    for (const c of comercial) {
      const fecha = this.firstContactadoDate(c.etapaHistory, probFor);
      if (fecha && buckets.has(fecha)) buckets.get(fecha)!.contactados += 1;
    }

    return {
      weeks: bucketOrder.map((date) => ({
        date,
        leads: buckets.get(date)!.leads,
        contactados: buckets.get(date)!.contactados,
      })),
    };
  }
}
