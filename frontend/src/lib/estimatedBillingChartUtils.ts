import { formatCurrency } from '@/lib/formatters';
import type { EstimatedBillingWeekly } from '@/lib/analyticsApi';
import { formatWeekRange } from '@/lib/companyWeeklyStageChartUtils';
import { weekTooltipHeading } from '@/lib/crmTimezone';

type WeekRow = EstimatedBillingWeekly['weeks'][number];

const HOT_STAGE_MIN_PROBABILITY = 70;

export function hotStageBillingFromWeek(week: WeekRow): number {
  return week.byStage
    .filter((stage) => stage.probability >= HOT_STAGE_MIN_PROBABILITY)
    .reduce((sum, stage) => sum + stage.amount, 0);
}

/** Valor Y del punto/línea: facturación estimada en etapas 70%+. */
export function hotStageBillingMarkerYFromWeek(week: WeekRow): number | null {
  const hotBilling = hotStageBillingFromWeek(week);
  return hotBilling > 0 ? hotBilling : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildEstimatedBillingTooltipHtml(
  week: WeekRow,
  isDark: boolean,
): string {
  const border = isDark ? '#334155' : '#e1e7ee';
  const bg = isDark ? '#1e293b' : '#ffffff';
  const headerBg = isDark ? '#334155' : '#f8fafc';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const text = isDark ? '#f8fafc' : '#0f172a';

  const rows = week.byStage
    .filter((stage) => stage.amount > 0)
    .map((stage) => {
      const label = escapeHtml(`${stage.name} (${stage.probability}%)`);
      return (
        `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:5px 0;font-size:12px;line-height:1.4;">` +
        `<span style="color:${muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px;">${label}</span>` +
        `<span style="font-weight:600;color:${text};font-variant-numeric:tabular-nums;flex-shrink:0;">${escapeHtml(formatCurrency(stage.amount))}</span>` +
        '</div>'
      );
    })
    .join('');

  const body =
    rows ||
    `<p style="margin:0;padding:8px 0;text-align:center;font-size:12px;color:${muted};">Sin facturación en este rango</p>`;

  return (
    `<div style="border-radius:12px;overflow:hidden;border:1px solid ${border};box-shadow:0 12px 32px rgba(15,23,42,0.14);` +
    `background:${bg};min-width:236px;max-width:280px;font-family:inherit;">` +
    `<div style="border-bottom:1px solid ${border};background:${headerBg};padding:10px 14px;text-align:center;">` +
    `<p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${muted};">${escapeHtml(weekTooltipHeading(week))}</p>` +
    `<p style="margin:4px 0 0;font-size:12px;font-weight:500;color:${text};">${escapeHtml(formatWeekRange(week.weekStart, week.weekEnd))}</p>` +
    `</div>` +
    `<div style="padding:6px 14px;">${body}</div>` +
    `<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid ${border};` +
    `background:${headerBg};padding:10px 14px;font-size:13px;font-weight:600;color:${text};">` +
    `<span>Total</span><span style="font-variant-numeric:tabular-nums;">${escapeHtml(formatCurrency(week.total))}</span></div>` +
    `</div>`
  );
}
