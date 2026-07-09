import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

export type WonSalesMonthPoint = {
  name: string;
  ventas: number;
};

const SERIES_COLOR = '#13944C';

function formatAxisAmount(value: number): string {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

interface WonOpportunitiesSalesLineChartProps {
  data: WonSalesMonthPoint[];
  className?: string;
  height?: number;
}

export function WonOpportunitiesSalesLineChart({
  data,
  className,
  height = 350,
}: WonOpportunitiesSalesLineChartProps) {
  const chartTheme = useChartTheme();
  const { isDark } = chartTheme;

  const categories = useMemo(() => data.map((row) => row.name), [data]);
  const values = useMemo(() => data.map((row) => row.ventas ?? 0), [data]);

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'line',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        zoom: { enabled: false },
        background: 'transparent',
      },
      colors: [SERIES_COLOR],
      dataLabels: { enabled: false },
      stroke: {
        curve: 'straight',
        width: 2.5,
      },
      markers: {
        size: 4,
        strokeWidth: 2,
        strokeColors: isDark ? '#0f172a' : '#ffffff',
        hover: { size: 6 },
      },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 4, right: 8, bottom: 0, left: 8 },
      },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 500 },
        },
      },
      yaxis: {
        min: 0,
        labels: {
          formatter: (value) => formatAxisAmount(Number(value)),
          style: { colors: chartTheme.axisColor, fontSize: '11px' },
        },
      },
      legend: { show: false },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        y: {
          formatter: (val) => formatCurrency(Number(val)),
        },
      },
      fill: { opacity: 1 },
    }),
    [categories, chartTheme.axisColor, chartTheme.gridStroke, isDark],
  );

  const series = useMemo(
    () => [{ name: 'Ventas (etapa Activo)', data: values }],
    [values],
  );

  const isEmpty = values.every((value) => value <= 0);

  if (isEmpty) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-sm text-muted-foreground',
          className,
        )}
        style={{ minHeight: height }}
      >
        Sin ventas en etapa Activo en este periodo.
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <Chart options={options} series={series} type="line" height={height} />
    </div>
  );
}
