import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import type { ProspectosCountRow } from '@/lib/flotaProspectosReportUtils';
import { cn } from '@/lib/utils';

const GREEN_BAR_COLORS = [
  '#13944C',
  '#1a9f55',
  '#21aa5e',
  '#28b567',
  '#2fc070',
  '#36cb79',
  '#3dd482',
  '#44df8b',
  '#4bea94',
  '#52f59d',
  '#59ffa6',
] as const;

const LABEL_COLOR = '#0f172a';

interface ProspectosByZonaBarChartProps {
  rows: ProspectosCountRow[];
  className?: string;
  chartHeight?: number;
}

function resolveChartHeight(rowCount: number, explicit?: number): number {
  if (explicit != null) return explicit;
  const rowHeight = 38;
  const chrome = 48;
  return Math.max(280, Math.min(720, rowCount * rowHeight + chrome));
}

export function ProspectosByZonaBarChart({
  rows,
  className,
  chartHeight,
}: ProspectosByZonaBarChartProps) {
  const chartTheme = useChartTheme();
  const height = resolveChartHeight(rows.length, chartHeight);
  const labelColor = chartTheme.isDark ? '#f8fafc' : LABEL_COLOR;

  const categories = useMemo(() => rows.map((r) => r.name), [rows]);

  const series = useMemo(
    () => [
      {
        name: 'Prospectos',
        data: rows.map((r) => r.count),
      },
    ],
    [rows],
  );

  const colors = useMemo(
    () => rows.map((_, i) => GREEN_BAR_COLORS[i % GREEN_BAR_COLORS.length]),
    [rows],
  );

  const maxCount = useMemo(
    () => Math.max(1, ...rows.map((r) => r.count)),
    [rows],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        background: 'transparent',
        parentHeightOffset: 0,
        offsetY: -6,
        events: {},
      },
      colors,
      plotOptions: {
        bar: {
          horizontal: true,
          distributed: true,
          barHeight: '78%',
          borderRadius: 4,
          borderRadiusApplication: 'end',
          dataLabels: {
            position: 'bottom',
            hideOverflowingLabels: false,
          },
        },
      },
      dataLabels: {
        enabled: true,
        offsetX: 12,
        formatter: (_val: number, opts) => {
          const idx = opts?.dataPointIndex ?? 0;
          const label = categories[idx] ?? '';
          const count = rows[idx]?.count ?? 0;
          return `${label}: ${count.toLocaleString('es-PE')}`;
        },
        style: {
          colors: [labelColor],
          fontSize: '11px',
          fontWeight: 500,
        },
        dropShadow: { enabled: false },
      },
      stroke: { width: 0, colors: ['transparent'] },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 0, right: 12, bottom: 0, left: 8 },
      },
      xaxis: {
        categories,
        min: 0,
        max: maxCount <= 4 ? maxCount + 1 : undefined,
        tickAmount: maxCount <= 4 ? maxCount + 1 : undefined,
        labels: {
          style: {
            colors: chartTheme.axisColor,
            fontSize: '11px',
            fontWeight: 500,
          },
          formatter: (val: string) => Number(val).toLocaleString('es-PE'),
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: { show: false },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      legend: { show: false },
      tooltip: {
        theme: chartTheme.isDark ? 'dark' : 'light',
        y: {
          formatter: (val: number) =>
            val === 1 ? '1 prospecto' : `${val.toLocaleString('es-PE')} prospectos`,
        },
      },
    }),
    [
      categories,
      chartTheme.axisColor,
      chartTheme.gridStroke,
      chartTheme.isDark,
      colors,
      labelColor,
      maxCount,
      rows,
    ],
  );

  if (rows.length === 0) return null;

  return (
    <div
      className={cn(
        'w-full leading-none [&_.apexcharts-svg]:overflow-visible',
        className,
      )}
      style={{ height, minHeight: height, width: '100%' }}
    >
      <Chart
        options={options}
        series={series}
        type="bar"
        height={height}
        width="100%"
      />
    </div>
  );
}
