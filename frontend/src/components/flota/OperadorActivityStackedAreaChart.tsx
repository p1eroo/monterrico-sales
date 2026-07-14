import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { OPERADOR_ACTIVITY_COLORS } from '@/lib/flotaOperadorReportUtils';
import type { ProspectosTimeSeriesData } from '@/lib/flotaProspectosReportUtils';
import { cn } from '@/lib/utils';

interface OperadorActivityStackedAreaChartProps {
  data: ProspectosTimeSeriesData;
  className?: string;
  chartHeight?: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildActivityTooltipHtml(opts: {
  title: string;
  rows: { name: string; val: number }[];
  total: number;
  isDark: boolean;
}): string {
  const border = opts.isDark ? '#334155' : '#e1e7ee';
  const bg = opts.isDark ? '#1e293b' : '#ffffff';
  const headerBg = opts.isDark ? '#334155' : '#f8fafc';
  const muted = opts.isDark ? '#94a3b8' : '#64748b';
  const text = opts.isDark ? '#f8fafc' : '#0f172a';
  const fmt = (n: number) => n.toLocaleString('es-PE');

  const items = opts.rows
    .map(
      (row) =>
        `<div style="display:flex;justify-content:space-between;gap:16px;padding:3px 0;font-size:12px;">` +
        `<span style="color:${row.val > 0 ? muted : `${muted}99`};">${escapeHtml(row.name)}</span>` +
        `<span style="font-weight:600;color:${row.val > 0 ? text : `${muted}99`};font-variant-numeric:tabular-nums;">${fmt(row.val)}</span>` +
        `</div>`,
    )
    .join('');

  return (
    `<div style="border-radius:12px;overflow:hidden;border:1px solid ${border};box-shadow:0 12px 32px rgba(15,23,42,0.14);` +
    `background:${bg};min-width:220px;max-width:280px;font-family:inherit;">` +
    `<div style="border-bottom:1px solid ${border};background:${headerBg};padding:10px 14px;text-align:center;">` +
    `<p style="margin:0;font-size:12px;font-weight:600;color:${text};">${escapeHtml(opts.title)}</p>` +
    `</div>` +
    `<div style="padding:6px 14px;">${items}</div>` +
    `<div style="display:flex;justify-content:space-between;gap:16px;border-top:1px solid ${border};` +
    `background:${headerBg};padding:10px 14px;font-size:12px;font-weight:600;color:${text};">` +
    `<span>Total actividad</span>` +
    `<span style="font-variant-numeric:tabular-nums;">${fmt(opts.total)}</span>` +
    `</div></div>`
  );
}

function resolveChartHeight(bucketCount: number, explicit?: number): number {
  if (explicit != null) return explicit;
  const base = 300;
  const extra = Math.max(0, bucketCount - 10) * 6;
  return Math.min(440, base + extra);
}

export function OperadorActivityStackedAreaChart({
  data,
  className,
  chartHeight,
}: OperadorActivityStackedAreaChartProps) {
  const chartTheme = useChartTheme();
  const height = resolveChartHeight(data.categories.length, chartHeight);

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'area',
        stacked: true,
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        background: 'transparent',
      },
      colors: [...OPERADOR_ACTIVITY_COLORS],
      stroke: { curve: 'smooth', width: 1.5 },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 0.8,
          opacityFrom: chartTheme.isDark ? 0.55 : 0.65,
          opacityTo: chartTheme.isDark ? 0.08 : 0.12,
          stops: [0, 90, 100],
        },
      },
      dataLabels: { enabled: false },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
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
              : 'rgba(59, 130, 246, 0.08)',
          },
        },
        labels: {
          rotate: data.categories.length > 7 ? -45 : 0,
          rotateAlways: data.categories.length > 7,
          hideOverlappingLabels: true,
          style: {
            colors: chartTheme.axisColor,
            fontSize: '10px',
            fontWeight: 500,
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false },
      },
      yaxis: {
        min: 0,
        labels: {
          formatter: (val: number) => Math.round(val).toLocaleString('es-PE'),
          style: {
            colors: chartTheme.axisColor,
            fontSize: '11px',
            fontWeight: 500,
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      legend: {
        show: true,
        position: 'top',
        horizontalAlign: 'center',
        fontSize: '10px',
        fontWeight: 500,
        labels: { colors: chartTheme.axisColor },
        markers: { size: 5, shape: 'circle' },
      },
      states: {
        hover: { filter: { type: 'none' } },
        active: {
          allowMultipleDataPointsSelection: true,
          filter: { type: 'none' },
        },
      },
      tooltip: {
        enabled: true,
        shared: true,
        intersect: false,
        followCursor: false,
        custom: ({ series, dataPointIndex, w }) => {
          if (dataPointIndex < 0) return '';
          const names = w.globals.seriesNames as string[];
          const rows = names.map((name, i) => ({
            name,
            val: Number(series[i]?.[dataPointIndex] ?? 0),
          }));
          const total = rows.reduce((sum, row) => sum + row.val, 0);
          return buildActivityTooltipHtml({
            title: data.categories[dataPointIndex] ?? '',
            rows,
            total,
            isDark: chartTheme.isDark,
          });
        },
      },
    }),
    [
      chartTheme.axisColor,
      chartTheme.gridStroke,
      chartTheme.isDark,
      data.categories,
      data.series,
    ],
  );

  if (!data.hasData) return null;

  return (
    <div
      className={cn(
        'w-full leading-none [&_.apexcharts-svg]:overflow-visible',
        '[&_.apexcharts-tooltip]:!border-0 [&_.apexcharts-tooltip]:!bg-transparent',
        '[&_.apexcharts-tooltip]:!p-0 [&_.apexcharts-tooltip]:!shadow-none',
        className,
      )}
    >
      <Chart
        options={options}
        series={data.series}
        type="area"
        height={height}
      />
    </div>
  );
}
