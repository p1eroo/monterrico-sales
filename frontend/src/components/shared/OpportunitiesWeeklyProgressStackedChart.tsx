import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { cn } from '@/lib/utils';

export type WeeklyOpportunityProgressPoint = {
  name: string;
  avance: number;
  nuevoIngreso: number;
  atraso: number;
  sinCambios: number;
};

const SERIES_COLORS = {
  avance: '#13944C',
  nuevoIngreso: '#34d399',
  atraso: '#f59e0b',
  sinCambios: '#94a3b8',
} as const;

function shortWeekLabel(name: string): string {
  const match = /W(\d{1,2})$/.exec(name);
  return match ? `W${match[1]}` : name;
}

interface OpportunitiesWeeklyProgressStackedChartProps {
  data: WeeklyOpportunityProgressPoint[];
  className?: string;
  height?: number;
  showLegend?: boolean;
}

export function OpportunitiesWeeklyProgressStackedChart({
  data,
  className,
  height = 380,
  showLegend = true,
}: OpportunitiesWeeklyProgressStackedChartProps) {
  const chartTheme = useChartTheme();

  const categories = useMemo(() => data.map((row) => shortWeekLabel(row.name)), [data]);

  const series = useMemo(
    () => [
      { name: 'Avance', data: data.map((row) => row.avance) },
      { name: 'Nuevo', data: data.map((row) => row.nuevoIngreso) },
      { name: 'Atraso', data: data.map((row) => row.atraso) },
      { name: 'Sin cambios', data: data.map((row) => row.sinCambios) },
    ],
    [data],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'bar',
        stacked: true,
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        zoom: { enabled: false },
        background: 'transparent',
      },
      colors: [
        SERIES_COLORS.avance,
        SERIES_COLORS.nuevoIngreso,
        SERIES_COLORS.atraso,
        SERIES_COLORS.sinCambios,
      ],
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: data.length > 18 ? '72%' : '55%',
          borderRadius: 10,
          borderRadiusApplication: 'end',
          borderRadiusWhenStacked: 'all',
        },
      },
      stroke: { width: 0, colors: ['transparent'] },
      dataLabels: { enabled: false },
      legend: {
        show: showLegend,
        position: 'top',
        horizontalAlign: 'left',
        fontSize: '12px',
        fontWeight: 500,
        markers: { size: 6, shape: 'circle', offsetX: -2 },
        itemMargin: { horizontal: 14, vertical: 0 },
        labels: { colors: chartTheme.axisColor },
      },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 4, right: 8, bottom: 0, left: 4 },
      },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          rotate: data.length > 14 ? -45 : 0,
          rotateAlways: data.length > 14,
          hideOverlappingLabels: true,
          style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 500 },
        },
        tooltip: {
          enabled: false,
        },
      },
      yaxis: {
        min: 0,
        tickAmount: 5,
        labels: {
          formatter: (value) => String(Math.round(Number(value))),
          style: { colors: chartTheme.axisColor, fontSize: '11px' },
        },
      },
      tooltip: {
        theme: chartTheme.isDark ? 'dark' : 'light',
        shared: true,
        intersect: false,
        x: {
          formatter: (_value, { dataPointIndex }) => data[dataPointIndex]?.name ?? '',
        },
        y: {
          formatter: (value) => (value == null ? '' : String(Math.round(Number(value)))),
        },
      },
      fill: { opacity: 1 },
    }),
    [categories, chartTheme.axisColor, chartTheme.gridStroke, chartTheme.isDark, data, showLegend],
  );

  const isEmpty =
    data.length === 0 ||
    data.every(
      (row) => row.avance === 0 && row.nuevoIngreso === 0 && row.atraso === 0 && row.sinCambios === 0,
    );

  if (isEmpty) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-sm text-muted-foreground',
          className,
        )}
        style={{ height }}
      >
        No hay datos de oportunidades.
      </div>
    );
  }

  return (
    <div className={cn('w-full min-w-0', className)}>
      <Chart options={options} series={series} type="bar" height={height} />
    </div>
  );
}
