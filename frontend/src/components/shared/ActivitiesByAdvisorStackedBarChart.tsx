import { useEffect, useMemo, useRef } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { applyActivityGoalDecorations } from '@/lib/activityGoalChartMarkers';
import { buildAdvisorStackedBarTooltipHtml } from '@/lib/advisorStackedBarTooltip';
import {
  type ActivityGoalTargets,
  activityGoalTotalForPeriod,
} from '@/lib/crmConfigApi';
import type { ActivityGoalPeriod } from '@/components/shared/ActivitiesByAdvisorDetailSheet';
import {
  type ActivitiesByAdvisorStackedData,
  type ActivitiesByAdvisorStackedRow,
  activitiesByAdvisorStackedHasData,
} from '@/lib/activitiesByAdvisorStackedUtils';
import { cn } from '@/lib/utils';

const ACTIVITY_SERIES = [
  { key: 'llamadasContacto' as const, label: 'Contacto', color: '#0E6B40' },
  { key: 'llamadasNoContacto' as const, label: 'No contacto', color: '#6ee7b7' },
  { key: 'reuniones' as const, label: 'Reuniones', color: '#34d399' },
  { key: 'correos' as const, label: 'Correos', color: '#065f46' },
] as const;

const ACTIVITY_COUNT_BY_LABEL: Record<string, [singular: string, plural: string]> = {
  Contacto: ['llamada con contacto', 'llamadas con contacto'],
  'No contacto': ['llamada sin contacto', 'llamadas sin contacto'],
  Reuniones: ['reunión', 'reuniones'],
  Correos: ['correo', 'correos'],
};

function formatActivityCountByLabel(label: string, value: number): string {
  const forms = ACTIVITY_COUNT_BY_LABEL[label];
  const count = formatValue(value);
  if (!forms) return `${count} actividad${value === 1 ? '' : 'es'}`;
  const word = value === 1 ? forms[0] : forms[1];
  return `${count} ${word}`;
}

function advisorGoalProgressActual(
  row: ActivitiesByAdvisorStackedRow,
  period: ActivityGoalPeriod,
): number {
  if (period === 'day') {
    return row.llamadasContacto + row.reuniones;
  }
  return row.total;
}

function goalTotalForPeriod(
  targets: ActivityGoalTargets,
  period: ActivityGoalPeriod,
): number {
  return activityGoalTotalForPeriod(targets, period);
}

function formatValue(n: number): string {
  return Math.round(n).toLocaleString('es-PE');
}

function resolveChartHeight(advisorCount: number, explicit?: number): number {
  if (explicit != null) return explicit;
  const rowHeight = 44;
  const chrome = 72;
  return Math.max(200, Math.min(420, advisorCount * rowHeight + chrome));
}

interface ActivitiesByAdvisorStackedBarChartProps {
  data: ActivitiesByAdvisorStackedData;
  className?: string;
  chartHeight?: number;
  showLegend?: boolean;
  onAdvisorSelect?: (advisor: ActivitiesByAdvisorStackedRow) => void;
  /** Metas por userId (Contacto, No contacto, Reuniones, Correos). */
  goalByAdvisorId?: Record<string, ActivityGoalTargets>;
  /** week = reportes; day = dashboard operativo. */
  goalPeriod?: ActivityGoalPeriod;
}

export function ActivitiesByAdvisorStackedBarChart({
  data,
  className,
  chartHeight,
  showLegend = true,
  onAdvisorSelect,
  goalByAdvisorId,
  goalPeriod = 'week',
}: ActivitiesByAdvisorStackedBarChartProps) {
  const chartTheme = useChartTheme();
  const hoverIndexRef = useRef(-1);
  const onAdvisorSelectRef = useRef(onAdvisorSelect);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const goalByAdvisorIdRef = useRef(goalByAdvisorId);
  onAdvisorSelectRef.current = onAdvisorSelect;
  goalByAdvisorIdRef.current = goalByAdvisorId;

  const hasGoals = useMemo(() => {
    if (!goalByAdvisorId) return false;
    return Object.values(goalByAdvisorId).some(
      (targets) => goalTotalForPeriod(targets, goalPeriod) > 0,
    );
  }, [goalByAdvisorId, goalPeriod]);

  const xAxisBounds = useMemo(() => {
    const actualMax = Math.max(
      ...data.advisors.map((row) => advisorGoalProgressActual(row, goalPeriod)),
      0,
    );
    const goalMax = data.advisors.reduce((max, row) => {
      const targets = goalByAdvisorId?.[row.advisorId];
      if (!targets) return max;
      return Math.max(max, goalTotalForPeriod(targets, goalPeriod));
    }, 0);
    const min = 0;
    const peak = Math.max(actualMax, goalMax);
    const max =
      peak > 0 && goalMax > actualMax
        ? Math.ceil(peak * 1.08)
        : undefined;
    return { min, max };
  }, [data.advisors, goalByAdvisorId, goalPeriod]);

  const defaultTotalLabelColor = chartTheme.isDark ? '#e2e8f0' : '#334155';

  const applyGoalDecorations = (chartContext: unknown) => {
    applyActivityGoalDecorations(
      chartContext as Parameters<typeof applyActivityGoalDecorations>[0],
      data.advisors,
      goalByAdvisorIdRef.current,
      {
        isDark: chartTheme.isDark,
        defaultLabelColor: defaultTotalLabelColor,
        goalPeriod,
      },
    );
  };

  useEffect(() => {
    if (!onAdvisorSelect) return;
    const root = chartWrapRef.current;
    if (!root) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const label = target?.closest('.apexcharts-yaxis-label');
      if (!label || !root.contains(label)) return;
      const labels = root.querySelectorAll('.apexcharts-yaxis-label');
      const index = Array.from(labels).indexOf(label);
      const advisor = data.advisors[index];
      if (advisor && advisor.total > 0) {
        onAdvisorSelect(advisor);
      }
    };

    root.addEventListener('click', handleClick);
    return () => root.removeEventListener('click', handleClick);
  }, [data.advisors, onAdvisorSelect]);
  const isEmpty = !activitiesByAdvisorStackedHasData(data);
  const height = resolveChartHeight(data.advisors.length, chartHeight);

  const categories = useMemo(
    () => data.advisors.map((row) => row.advisorName),
    [data.advisors],
  );

  const series = useMemo(
    () =>
      ACTIVITY_SERIES.map((item) => ({
        name: item.label,
        data: data.advisors.map((row) => row[item.key]),
      })),
    [data.advisors],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'bar',
        stacked: true,
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        background: 'transparent',
        events: {
          mounted(chartContext) {
            applyGoalDecorations(chartContext);
          },
          updated(chartContext) {
            applyGoalDecorations(chartContext);
          },
          animationEnd(chartContext) {
            applyGoalDecorations(chartContext);
          },
          ...(onAdvisorSelect
            ? {
                mouseMove(_event, _chartContext, config) {
                  if (!config) return;
                  const idx = config.dataPointIndex;
                  if (idx != null && idx >= 0) hoverIndexRef.current = idx;
                },
                click(_event, _chartContext, config) {
                  if (!config || !onAdvisorSelectRef.current) return;
                  const idx =
                    config.dataPointIndex >= 0
                      ? config.dataPointIndex
                      : hoverIndexRef.current;
                  const advisor = data.advisors[idx];
                  if (advisor && advisor.total > 0) {
                    onAdvisorSelectRef.current(advisor);
                  }
                },
                dataPointSelection(_event, _chartContext, config) {
                  if (!config || !onAdvisorSelectRef.current) return;
                  const idx = config.dataPointIndex;
                  const advisor = data.advisors[idx ?? -1];
                  if (advisor && advisor.total > 0) {
                    onAdvisorSelectRef.current(advisor);
                  }
                },
              }
            : {}),
        },
      },
      colors: ACTIVITY_SERIES.map((item) => item.color),
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: data.advisors.length > 4 ? '72%' : '58%',
          borderRadius: 4,
          borderRadiusApplication: 'end',
          borderRadiusWhenStacked: 'last',
          dataLabels: {
            total: {
              enabled: true,
              offsetX: 4,
              style: {
                fontSize: '11px',
                fontWeight: 600,
                color: defaultTotalLabelColor,
              },
              formatter: (total, opts) => {
                const idx = opts?.dataPointIndex ?? -1;
                const advisor = data.advisors[idx];
                if (!advisor) return '';
                const totalNum = advisorGoalProgressActual(advisor, goalPeriod);
                const goalTotal = goalTotalForPeriod(
                  goalByAdvisorId?.[advisor.advisorId] ?? {
                    contacto: 0,
                    noContacto: 0,
                    reuniones: 0,
                    correos: 0,
                  },
                  goalPeriod,
                );

                if (totalNum <= 0 && goalTotal <= 0) return '';
                if (goalTotal > 0) {
                  const met = totalNum >= goalTotal;
                  return `${formatValue(totalNum)}/${formatValue(goalTotal)}${met ? ' ✓' : ''}`;
                }
                return totalNum > 0 ? formatValue(totalNum) : '';
              },
            },
          },
        },
      },
      dataLabels: { enabled: false },
      stroke: { width: 0, colors: ['transparent'] },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 0, right: 16, bottom: 0, left: 4 },
      },
      xaxis: {
        categories,
        min: xAxisBounds.min,
        ...(xAxisBounds.max != null ? { max: xAxisBounds.max } : {}),
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 500 },
          formatter: (value) => formatValue(Number(value)),
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 600 },
          maxWidth: 140,
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      legend: {
        show: showLegend,
        position: 'top',
        horizontalAlign: 'left',
        fontSize: '11px',
        fontWeight: 500,
        markers: { size: 6, shape: 'circle', offsetX: -2 },
        itemMargin: { horizontal: 12, vertical: 0 },
        labels: { colors: chartTheme.axisColor },
        offsetY: 2,
      },
      tooltip: {
        enabled: true,
        shared: false,
        intersect: true,
        followCursor: true,
        theme: chartTheme.isDark ? 'dark' : 'light',
        custom: ({ dataPointIndex }) => {
          if (dataPointIndex == null || dataPointIndex < 0) return '';
          const advisor = data.advisors[dataPointIndex];
          if (!advisor) return '';
          const targets = goalByAdvisorId?.[advisor.advisorId];
          const goalTotal = targets ? goalTotalForPeriod(targets, goalPeriod) : 0;
          const progressTotal = advisorGoalProgressActual(advisor, goalPeriod);
          const base = buildAdvisorStackedBarTooltipHtml({
            title: advisor.advisorName,
            weekLabel: data.weekLabel,
            seriesItems: ACTIVITY_SERIES.map((item) => ({
              name: item.label,
              value: advisor[item.key],
              formatValue: formatActivityCountByLabel,
            })),
          });
          if (goalTotal <= 0) return base;
          const goalLine = `<div class="mt-1.5 border-t border-border/40 pt-1.5 text-[10px] text-muted-foreground">
                  Meta total: <span class="font-semibold tabular-nums text-foreground">${formatValue(goalTotal)}</span>
                  · Avance: <span class="font-semibold tabular-nums ${progressTotal >= goalTotal ? 'text-emerald-600' : 'text-foreground'}">${formatValue(progressTotal)}/${formatValue(goalTotal)}</span>
                </div>`;
          return base.replace(/<\/div>\s*$/, `${goalLine}</div>`);
        },
      },
      fill: { opacity: 1 },
    }),
    [
      categories,
      chartTheme.axisColor,
      chartTheme.gridStroke,
      chartTheme.isDark,
      data.advisors,
      data.weekLabel,
      goalByAdvisorId,
      goalPeriod,
      onAdvisorSelect,
      showLegend,
      xAxisBounds,
      defaultTotalLabelColor,
    ],
  );

  if (isEmpty) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-sm text-muted-foreground',
          className,
        )}
        style={{ minHeight: height }}
      >
        Sin actividades registradas en las últimas 6 semanas.
      </div>
    );
  }

  return (
    <div className={cn('flex w-full flex-col', className)}>
      {onAdvisorSelect ? (
        <p className="mb-2 text-[11px] text-muted-foreground">
          Clic en un asesor para ver el detalle por empresa, contacto y oportunidad.
        </p>
      ) : null}
      <div
        ref={chartWrapRef}
        className={cn(
          'shrink-0 leading-none [&_.apexcharts-svg]:overflow-visible',
          onAdvisorSelect &&
            '[&_.apexcharts-bar-area]:cursor-pointer [&_.apexcharts-yaxis-label]:cursor-pointer',
        )}
      >
        <Chart options={options} series={series} type="bar" height={height} />
      </div>
      {hasGoals ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-0 border-l-2 border-dashed border-amber-600 dark:border-amber-400"
              aria-hidden
            />
            {goalPeriod === 'day' ? 'Meta diaria' : 'Meta semanal'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block size-2 rounded-sm bg-emerald-500/25 ring-1 ring-emerald-500/40"
              aria-hidden
            />
            Meta cumplida
          </span>
        </p>
      ) : null}
    </div>
  );
}
