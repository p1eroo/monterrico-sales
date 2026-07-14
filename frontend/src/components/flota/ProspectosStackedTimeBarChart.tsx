import { useMemo, useRef } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import type { ProspectosTimeSeriesData } from '@/lib/flotaProspectosReportUtils';
import { cn } from '@/lib/utils';

const STACK_COLORS = [
  '#13944C',
  '#22c55e',
  '#4ade80',
  '#86efac',
  '#059669',
  '#64748b',
] as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildProspectosStackedTooltipHtml(opts: {
  title: string;
  rows: { name: string; val: number }[];
  total: number;
  isDark: boolean;
  countLabel?: 'prospecto' | 'actividad';
}): string {
  const border = opts.isDark ? '#334155' : '#e1e7ee';
  const bg = opts.isDark ? '#1e293b' : '#ffffff';
  const headerBg = opts.isDark ? '#334155' : '#f8fafc';
  const muted = opts.isDark ? '#94a3b8' : '#64748b';
  const text = opts.isDark ? '#f8fafc' : '#0f172a';

  const fmt = (n: number) => {
    if (opts.countLabel === 'actividad') {
      return n === 1
        ? '1 actividad'
        : `${n.toLocaleString('es-PE')} actividades`;
    }
    return n === 1
      ? '1 prospecto'
      : `${n.toLocaleString('es-PE')} prospectos`;
  };

  const items = opts.rows
    .map((row) => {
      const color = row.val > 0 ? muted : `${muted}99`;
      return (
        `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:3px 0;font-size:12px;line-height:1.4;">` +
        `<span style="color:${color};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px;">${escapeHtml(row.name)}</span>` +
        `<span style="font-weight:600;color:${row.val > 0 ? text : color};font-variant-numeric:tabular-nums;flex-shrink:0;">${fmt(row.val)}</span>` +
        '</div>'
      );
    })
    .join('');

  return (
    `<div style="border-radius:12px;overflow:hidden;border:1px solid ${border};box-shadow:0 12px 32px rgba(15,23,42,0.14);` +
    `background:${bg};min-width:220px;max-width:280px;font-family:inherit;">` +
    `<div style="border-bottom:1px solid ${border};background:${headerBg};padding:10px 14px;text-align:center;">` +
    `<p style="margin:0;font-size:12px;font-weight:600;color:${text};">${escapeHtml(opts.title)}</p>` +
    `</div>` +
    `<div style="padding:6px 14px;">${items}</div>` +
    `<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid ${border};` +
    `background:${headerBg};padding:10px 14px;font-size:12px;font-weight:600;color:${text};">` +
    `<span>Total</span>` +
    `<span style="font-variant-numeric:tabular-nums;">${fmt(opts.total)}</span>` +
    `</div>` +
    `</div>`
  );
}

interface ProspectosStackedTimeBarChartProps {
  data: ProspectosTimeSeriesData;
  className?: string;
  chartHeight?: number;
  /** Etiqueta del conteo en tooltip (default: prospectos). */
  countLabel?: 'prospecto' | 'actividad';
  /** Día seleccionado (resaltado en el gráfico). */
  selectedDayIndex?: number;
  /** Al hacer clic en un día del gráfico. */
  onDaySelect?: (index: number) => void;
}

function resolveChartHeight(bucketCount: number, explicit?: number): number {
  if (explicit != null) return explicit;
  const base = 300;
  const extra = Math.max(0, bucketCount - 10) * 6;
  return Math.min(440, base + extra);
}

export function ProspectosStackedTimeBarChart({
  data,
  className,
  chartHeight,
  countLabel,
  selectedDayIndex,
  onDaySelect,
}: ProspectosStackedTimeBarChartProps) {
  const chartTheme = useChartTheme();
  const height = resolveChartHeight(data.categories.length, chartHeight);
  const onDaySelectRef = useRef(onDaySelect);
  onDaySelectRef.current = onDaySelect;
  const hoverIndexRef = useRef(-1);

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'bar',
        stacked: true,
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        background: 'transparent',
        events: onDaySelect
          ? {
              mouseMove(_event, _chartContext, config) {
                if (!config) return;
                const idx = config.dataPointIndex;
                if (idx != null && idx >= 0) {
                  hoverIndexRef.current = idx;
                }
              },
              click(_event, _chartContext, config) {
                if (!config) return;
                const idx =
                  config.dataPointIndex >= 0
                    ? config.dataPointIndex
                    : hoverIndexRef.current;
                if (idx >= 0) {
                  onDaySelectRef.current?.(idx);
                }
              },
              dataPointSelection(_event, _chartContext, config) {
                if (!config) return;
                const idx = config.dataPointIndex;
                if (idx != null && idx >= 0) {
                  onDaySelectRef.current?.(idx);
                }
              },
            }
          : undefined,
      },
      colors: [...STACK_COLORS],
      plotOptions: {
        bar: {
          borderRadius: 4,
          borderRadiusApplication: 'end',
          borderRadiusWhenStacked: 'last',
          columnWidth: data.categories.length > 14 ? '78%' : '55%',
        },
      },
      dataLabels: { enabled: false },
      stroke: { width: 0 },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        row: {
          colors: chartTheme.isDark
            ? ['transparent', 'rgba(148, 163, 184, 0.06)']
            : ['#ffffff', '#f2f2f2'],
        },
        padding: { top: 0, right: 12, bottom: 0, left: 12 },
      },
      xaxis: {
        categories: data.categories,
        crosshairs: {
          show: true,
          width: 'tickWidth',
          position: 'back',
          fill: {
            type: 'solid',
            color: chartTheme.isDark
              ? 'rgba(148, 163, 184, 0.14)'
              : 'rgba(19, 148, 76, 0.08)',
          },
        },
        labels: {
          rotate: data.categories.length > 7 ? -45 : 0,
          rotateAlways: data.categories.length > 7,
          trim: true,
          hideOverlappingLabels: true,
          style: {
            colors: chartTheme.axisColor,
            fontSize: '10px',
            fontWeight: 500,
          },
        },
        tickPlacement: 'on',
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false },
      },
      annotations:
        selectedDayIndex != null &&
        selectedDayIndex >= 0 &&
        data.categories[selectedDayIndex]
          ? {
              xaxis: [
                {
                  x: data.categories[selectedDayIndex],
                  strokeDashArray: 0,
                  borderColor: chartTheme.isDark
                    ? 'rgba(148, 163, 184, 0.55)'
                    : 'rgba(19, 148, 76, 0.45)',
                  borderWidth: 2,
                  opacity: 1,
                  fillColor: chartTheme.isDark
                    ? 'rgba(148, 163, 184, 0.18)'
                    : 'rgba(19, 148, 76, 0.12)',
                },
              ],
            }
          : undefined,
      yaxis: {
        labels: {
          style: {
            colors: chartTheme.axisColor,
            fontSize: '11px',
            fontWeight: 500,
          },
          formatter: (val: number) => Math.round(val).toLocaleString('es-PE'),
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      fill: {
        type: 'solid',
        opacity: 0.92,
      },
      states: {
        hover: {
          filter: { type: 'none' },
        },
        active: {
          allowMultipleDataPointsSelection: true,
          filter: { type: 'none' },
        },
      },
      legend: {
        show: true,
        position: 'bottom',
        horizontalAlign: 'center',
        fontSize: '11px',
        fontWeight: 500,
        labels: { colors: chartTheme.axisColor },
        markers: { size: 6, shape: 'circle' },
      },
      tooltip: {
        enabled: true,
        shared: true,
        intersect: false,
        followCursor: false,
        custom: ({ series, dataPointIndex, w }) => {
          if (dataPointIndex < 0) return '';
          const category = data.categories[dataPointIndex] ?? '';
          const names = w.globals.seriesNames as string[];
          const rows = names.map((name, i) => ({
            name,
            val: Number(series[i]?.[dataPointIndex] ?? 0),
          }));
          const total = rows.reduce((sum, row) => sum + row.val, 0);

          return buildProspectosStackedTooltipHtml({
            title: category,
            rows,
            total,
            isDark: chartTheme.isDark,
            countLabel,
          });
        },
      },
    }),
    [
      chartTheme.axisColor,
      chartTheme.gridStroke,
      chartTheme.isDark,
      countLabel,
      data.categories,
      data.series,
      onDaySelect,
      selectedDayIndex,
    ],
  );

  if (!data.hasData) return null;

  return (
    <div
      className={cn(
        'w-full leading-none [&_.apexcharts-svg]:overflow-visible',
        onDaySelect && '[&_.apexcharts-canvas]:cursor-pointer',
        '[&_.apexcharts-tooltip]:!border-0 [&_.apexcharts-tooltip]:!bg-transparent',
        '[&_.apexcharts-tooltip]:!p-0 [&_.apexcharts-tooltip]:!shadow-none',
        className,
      )}
    >
      <Chart
        options={options}
        series={data.series}
        type="bar"
        height={height}
      />
    </div>
  );
}
