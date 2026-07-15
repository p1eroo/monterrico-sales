import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { cn } from '@/lib/utils';

const ACTIVOS_COLOR = '#13944C';
const NUEVOS_COLOR = '#22c55e';

export type ConductoresWeeklyRow = {
  semana: string;
  rango: string;
  nuevos: number;
  nuevosActivos: number;
  weekStartTs: number;
};

interface ConductoresWeeklyAreaChartProps {
  rows: ConductoresWeeklyRow[];
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

function buildConductoresTooltipHtml(opts: {
  title: string;
  subtitle: string;
  nuevos: number;
  activos: number;
  isDark: boolean;
}): string {
  const border = opts.isDark ? '#334155' : '#e1e7ee';
  const bg = opts.isDark ? '#1e293b' : '#ffffff';
  const headerBg = opts.isDark ? '#334155' : '#f8fafc';
  const muted = opts.isDark ? '#94a3b8' : '#64748b';
  const text = opts.isDark ? '#f8fafc' : '#0f172a';
  const fmt = (n: number) => n.toLocaleString('es-PE');

  return (
    `<div style="border-radius:12px;overflow:hidden;border:1px solid ${border};box-shadow:0 12px 32px rgba(15,23,42,0.14);` +
    `background:${bg};min-width:220px;font-family:inherit;">` +
    `<div style="border-bottom:1px solid ${border};background:${headerBg};padding:10px 14px;text-align:center;">` +
    `<p style="margin:0;font-size:12px;font-weight:600;color:${text};">${escapeHtml(opts.title)}</p>` +
    `<p style="margin:4px 0 0;font-size:11px;color:${muted};">${escapeHtml(opts.subtitle)}</p>` +
    `</div>` +
    `<div style="padding:8px 14px;">` +
    `<div style="display:flex;justify-content:space-between;gap:16px;padding:3px 0;font-size:12px;">` +
    `<span style="color:${muted};">Nuevos</span>` +
    `<span style="font-weight:600;color:${text};font-variant-numeric:tabular-nums;">${fmt(opts.nuevos)}</span></div>` +
    `<div style="display:flex;justify-content:space-between;gap:16px;padding:3px 0;font-size:12px;">` +
    `<span style="color:${muted};">Activos</span>` +
    `<span style="font-weight:600;color:${text};font-variant-numeric:tabular-nums;">${fmt(opts.activos)}</span></div>` +
    `</div></div>`
  );
}

export function ConductoresWeeklyAreaChart({
  rows,
  className,
  chartHeight = 380,
}: ConductoresWeeklyAreaChartProps) {
  const chartTheme = useChartTheme();

  const categories = useMemo(() => rows.map((row) => row.semana), [rows]);

  const series = useMemo(
    () => [
      { name: 'Activos', data: rows.map((row) => row.nuevosActivos) },
      { name: 'Nuevos', data: rows.map((row) => row.nuevos) },
    ],
    [rows],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'area',
        stacked: false,
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        background: 'transparent',
        events: {},
      },
      colors: [ACTIVOS_COLOR, NUEVOS_COLOR],
      stroke: { curve: 'smooth', width: 2.5 },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 0.8,
          opacityFrom: chartTheme.isDark ? 0.5 : 0.62,
          opacityTo: chartTheme.isDark ? 0.08 : 0.1,
          stops: [0, 90, 100],
        },
      },
      dataLabels: { enabled: false },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 4, right: 12, bottom: 0, left: 8 },
      },
      xaxis: {
        categories,
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
          style: {
            colors: chartTheme.axisColor,
            fontSize: '11px',
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
        fontSize: '11px',
        fontWeight: 500,
        labels: { colors: chartTheme.axisColor },
        markers: { size: 6, shape: 'circle' },
      },
      markers: {
        size: 3,
        strokeWidth: 2,
        strokeColors: chartTheme.isDark ? '#0f172a' : '#ffffff',
        hover: { size: 5 },
      },
      states: {
        hover: { filter: { type: 'none' } },
      },
      tooltip: {
        enabled: true,
        shared: true,
        intersect: false,
        followCursor: false,
        custom: ({ dataPointIndex }) => {
          if (dataPointIndex < 0) return '';
          const row = rows[dataPointIndex];
          if (!row) return '';
          return buildConductoresTooltipHtml({
            title: row.semana,
            subtitle: row.rango,
            nuevos: row.nuevos,
            activos: row.nuevosActivos,
            isDark: chartTheme.isDark,
          });
        },
      },
    }),
    [categories, chartTheme.axisColor, chartTheme.gridStroke, chartTheme.isDark, rows],
  );

  if (rows.length === 0) return null;

  return (
    <div
      className={cn(
        'w-full leading-none [&_.apexcharts-svg]:overflow-visible',
        '[&_.apexcharts-tooltip]:!border-0 [&_.apexcharts-tooltip]:!bg-transparent',
        '[&_.apexcharts-tooltip]:!p-0 [&_.apexcharts-tooltip]:!shadow-none',
        className,
      )}
      style={{ height: chartHeight, minHeight: chartHeight, width: '100%' }}
    >
      <Chart
        options={options}
        series={series}
        type="area"
        height={chartHeight}
        width="100%"
      />
    </div>
  );
}
