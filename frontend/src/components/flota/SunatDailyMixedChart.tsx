import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { cn } from '@/lib/utils';

const SERVICIOS_COLOR = '#13944C';
const AUTORIZADOS_COLOR = '#059669';

export type SunatDailyRow = {
  name: string;
  servicios: number;
  autorizados: number;
};

interface SunatDailyMixedChartProps {
  rows: SunatDailyRow[];
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

function buildSunatTooltipHtml(opts: {
  title: string;
  servicios: number;
  autorizados: number;
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
    `</div>` +
    `<div style="padding:8px 14px;">` +
    `<div style="display:flex;justify-content:space-between;gap:16px;padding:3px 0;font-size:12px;">` +
    `<span style="color:${muted};">Servicios totales</span>` +
    `<span style="font-weight:600;color:${text};font-variant-numeric:tabular-nums;">${fmt(opts.servicios)}</span></div>` +
    `<div style="display:flex;justify-content:space-between;gap:16px;padding:3px 0;font-size:12px;">` +
    `<span style="color:${muted};">Conductores autorizados</span>` +
    `<span style="font-weight:600;color:${text};font-variant-numeric:tabular-nums;">${fmt(opts.autorizados)}</span></div>` +
    `</div></div>`
  );
}

export function SunatDailyMixedChart({
  rows,
  className,
  chartHeight = 340,
}: SunatDailyMixedChartProps) {
  const chartTheme = useChartTheme();

  const categories = useMemo(() => rows.map((row) => row.name), [rows]);

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'line',
        stacked: false,
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        background: 'transparent',
        events: {},
      },
      colors: [SERVICIOS_COLOR, AUTORIZADOS_COLOR],
      plotOptions: {
        bar: {
          columnWidth: rows.length > 10 ? '72%' : '52%',
          borderRadius: 4,
          borderRadiusApplication: 'end',
        },
      },
      stroke: {
        width: [0, 3],
        curve: 'smooth',
      },
      markers: {
        size: [0, 4],
        strokeWidth: 2,
        strokeColors: chartTheme.isDark ? '#0f172a' : '#ffffff',
        hover: { size: 6 },
      },
      dataLabels: { enabled: false },
      legend: {
        show: true,
        position: 'top',
        horizontalAlign: 'center',
        fontSize: '11px',
        fontWeight: 500,
        labels: { colors: chartTheme.axisColor },
        markers: { size: 6, shape: 'circle' },
      },
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
          rotate: rows.length > 7 ? -45 : 0,
          rotateAlways: rows.length > 7,
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
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'light',
          type: 'vertical',
          shadeIntensity: 0.35,
          gradientToColors: ['#22c55e'],
          inverseColors: false,
          opacityFrom: 0.95,
          opacityTo: 0.72,
          stops: [0, 100],
        },
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
          return buildSunatTooltipHtml({
            title: row.name,
            servicios: row.servicios,
            autorizados: row.autorizados,
            isDark: chartTheme.isDark,
          });
        },
      },
    }),
    [categories, chartTheme.axisColor, chartTheme.gridStroke, chartTheme.isDark, rows],
  );

  const series = useMemo(
    () => [
      {
        name: 'Servicios Totales',
        type: 'column' as const,
        data: rows.map((row) => row.servicios),
      },
      {
        name: 'Conductores Autorizados',
        type: 'line' as const,
        data: rows.map((row) => row.autorizados),
      },
    ],
    [rows],
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
        type="line"
        height={chartHeight}
        width="100%"
      />
    </div>
  );
}
