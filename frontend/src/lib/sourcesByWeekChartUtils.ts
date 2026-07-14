import type { AnalyticsSummary } from '@/lib/analyticsApi';
import type { SourcesByWeekStackedChartData } from '@/components/shared/SourcesByEntityMixedChart';
import {
  formatWeekRangeLima,
  weekAxisLabelFromWeekRow,
  weekTooltipHeading,
} from '@/lib/crmTimezone';
import { getSourceLabelFromCatalog } from '@/store/crmConfigStore';
import type { CrmConfigBundle } from '@/store/crmConfigStore';

export const UNASSIGNED_SOURCE_SLUG = '__sin_fuente__';

type WeeklyRow = AnalyticsSummary['companiesBySourceWeekly']['weeks'][number];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSourcesByWeekTooltipHtml(
  week: SourcesByWeekStackedChartData['tooltipWeeks'][number],
  isDark: boolean,
): string {
  const border = isDark ? '#334155' : '#e1e7ee';
  const bg = isDark ? '#1e293b' : '#ffffff';
  const headerBg = isDark ? '#334155' : '#f8fafc';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const text = isDark ? '#f8fafc' : '#0f172a';

  const rows = week.sources
    .filter((source) => source.value > 0)
    .map((source) => {
      const label = escapeHtml(source.label);
      const isUnassigned = source.slug === UNASSIGNED_SOURCE_SLUG;
      return (
        `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:5px 0;font-size:12px;line-height:1.4;">` +
        `<span style="color:${isUnassigned ? text : muted};font-weight:${isUnassigned ? 600 : 400};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px;">${label}</span>` +
        `<span style="font-weight:600;color:${text};font-variant-numeric:tabular-nums;flex-shrink:0;">${source.value}</span>` +
        '</div>'
      );
    })
    .join('');

  const body =
    rows ||
    `<p style="margin:0;padding:8px 0;text-align:center;font-size:12px;color:${muted};">Sin empresas en esta semana</p>`;

  return (
    `<div style="border-radius:12px;overflow:hidden;border:1px solid ${border};box-shadow:0 12px 32px rgba(15,23,42,0.14);` +
    `background:${bg};min-width:236px;max-width:280px;font-family:inherit;">` +
    `<div style="border-bottom:1px solid ${border};background:${headerBg};padding:10px 14px;text-align:center;">` +
    `<p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${muted};">${escapeHtml(weekTooltipHeading(week))}</p>` +
    `<p style="margin:4px 0 0;font-size:12px;font-weight:500;color:${text};">${escapeHtml(formatWeekRangeLima(week.weekStart, week.weekEnd))}</p>` +
    `</div>` +
    `<div style="padding:6px 14px;">${body}</div>` +
    `<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid ${border};` +
    `background:${headerBg};padding:10px 14px;font-size:13px;font-weight:600;color:${text};">` +
    `<span>Total</span><span style="font-variant-numeric:tabular-nums;">${week.total}</span></div>` +
    `</div>`
  );
}

export function buildSourcesByWeekStackedChartData(
  weeks: WeeklyRow[] | undefined,
  bundle: CrmConfigBundle | null,
  contactSourceLabels: Record<string, string> | undefined,
): SourcesByWeekStackedChartData {
  const rows = weeks ?? [];
  if (rows.length === 0) {
    return { categories: [], series: [], tooltipWeeks: [] };
  }

  const slugSet = new Set<string>();
  for (const week of rows) {
    for (const source of week.sources) slugSet.add(source.slug);
  }

  const lastWeek = rows[rows.length - 1];
  const lastWeekValues = new Map(
    (lastWeek?.sources ?? []).map((source) => [source.slug, source.value]),
  );

  const slugs = [...slugSet].sort(
    (a, b) => (lastWeekValues.get(b) ?? 0) - (lastWeekValues.get(a) ?? 0),
  );

  return {
    categories: rows.map((week) => weekAxisLabelFromWeekRow(week)),
    series: slugs.map((slug) => ({
      name: getSourceLabelFromCatalog(slug, bundle, contactSourceLabels),
      data: rows.map(
        (week) => week.sources.find((source) => source.slug === slug)?.value ?? 0,
      ),
    })),
    tooltipWeeks: rows.map((week) => {
      const sources = [...week.sources]
        .sort((a, b) => b.value - a.value)
        .map((source) => ({
          slug: source.slug,
          label: getSourceLabelFromCatalog(source.slug, bundle, contactSourceLabels),
          value: source.value,
        }));
      const total = sources.reduce((sum, source) => sum + source.value, 0);
      return {
        name: week.name,
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        sources,
        total,
      };
    }),
  };
}

export function flattenSourcesByWeekForExport(
  data: SourcesByWeekStackedChartData,
): { semana: string; fuente: string; empresas: number }[] {
  const rows: { semana: string; fuente: string; empresas: number }[] = [];
  for (let weekIndex = 0; weekIndex < data.categories.length; weekIndex += 1) {
    const semana = data.categories[weekIndex] ?? '';
    for (const series of data.series) {
      const empresas = series.data[weekIndex] ?? 0;
      if (empresas > 0) {
        rows.push({ semana, fuente: series.name, empresas });
      }
    }
  }
  return rows;
}

export function sourcesByWeekChartHasData(data: SourcesByWeekStackedChartData): boolean {
  return (
    data.categories.length > 0 &&
    data.series.some((row) => row.data.some((value) => value > 0))
  );
}
