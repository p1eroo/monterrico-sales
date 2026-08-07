import type { AnalyticsSummary } from '@/lib/analyticsApi';
import type { WeeklyPortfolioProgressPoint } from '@/components/shared/OpportunitiesWeeklyProgressStackedChart';
import {
  isoWeekNumberLima,
  parseDayEndLima,
  parseDayStartLima,
  parseIsoWeekNumberFromLabel,
  startOfWeekMondayLima,
  weekAxisLabelLima,
} from '@/lib/crmTimezone';

export const COMPANIES_WEEKLY_PROGRESS_CHART_MAX_WEEKS = 20;
/** Mismo lookback que el dashboard backend cuando el rango es un solo día. */
export const COMPANIES_DASHBOARD_SINGLE_DAY_WEEKS = 6;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type WeeklyProgressRow = WeeklyPortfolioProgressPoint & { weekStartMs: number };

function chartRangeFromMon(summary: AnalyticsSummary): Date {
  const toD = parseDayEndLima(summary.range.to);
  const toMon = startOfWeekMondayLima(toD);
  // Empresas: siempre últimas N semanas al cierre del rango (no acotar al from del filtro).
  return new Date(
    toMon.getTime() - (COMPANIES_DASHBOARD_SINGLE_DAY_WEEKS - 1) * WEEK_MS,
  );
}

function buildCompaniesWeeklyProgressExtended(
  summary: AnalyticsSummary | null | undefined,
): WeeklyProgressRow[] {
  if (!summary?.range?.from || !summary?.range?.to) return [];

  const apiRows = summary.companiesWeeklyProgress ?? [];
  const toD = parseDayEndLima(summary.range.to);
  const fromMon = chartRangeFromMon(summary);
  const toMon = startOfWeekMondayLima(toD);

  const apiByWeek = new Map(
    apiRows.flatMap((r) => {
      const weekNum = parseIsoWeekNumberFromLabel(r.name);
      return weekNum != null ? [[weekNum, r] as const] : [];
    }),
  );

  const out: WeeklyProgressRow[] = [];
  for (let cur = new Date(fromMon.getTime()); cur.getTime() <= toMon.getTime(); ) {
    const axisName = weekAxisLabelLima(cur);
    const weekNum = isoWeekNumberLima(cur);
    const api = apiByWeek.get(weekNum);
    const row: WeeklyPortfolioProgressPoint = api
      ? {
          name: axisName,
          avance: api.avance,
          nuevoIngreso: api.nuevoIngreso,
          atraso: api.atraso,
          sinCambios: api.sinCambios,
        }
      : {
          name: axisName,
          avance: 0,
          nuevoIngreso: 0,
          atraso: 0,
          sinCambios: 0,
        };
    out.push({ ...row, weekStartMs: cur.getTime() });
    const next = new Date(cur.getTime());
    next.setTime(cur.getTime() + 7 * 24 * 60 * 60 * 1000);
    cur = next;
  }

  return out;
}

export function buildCompaniesWeeklyProgressChartData(
  summary: AnalyticsSummary | null | undefined,
  maxWeeks = COMPANIES_WEEKLY_PROGRESS_CHART_MAX_WEEKS,
): WeeklyPortfolioProgressPoint[] {
  const rows = buildCompaniesWeeklyProgressExtended(summary).map(
    ({ weekStartMs: _w, ...rest }) => rest,
  );
  if (rows.length <= maxWeeks) return rows;
  return rows.slice(-maxWeeks);
}

export function companiesWeeklyProgressChartHasData(
  data: WeeklyPortfolioProgressPoint[],
): boolean {
  return data.some(
    (row) => row.avance + row.nuevoIngreso + row.atraso + row.sinCambios > 0,
  );
}
