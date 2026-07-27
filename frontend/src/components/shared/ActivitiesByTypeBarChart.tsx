import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { cn } from '@/lib/utils';

export type ActivitiesByTypeTotals = {
  correos: number;
  llamadas: number;
  reuniones: number;
  notas?: number;
};

export type ActivitiesByTypeMonthRow = ActivitiesByTypeTotals & {
  name: string;
};

export type ActivitiesByTypeMonthComparison = {
  previousMonth: ActivitiesByTypeMonthRow;
  currentMonth: ActivitiesByTypeMonthRow;
};

const ACTIVITY_ITEMS = [
  { key: 'correos' as const, label: 'Correos' },
  { key: 'llamadas' as const, label: 'Llamadas' },
  { key: 'reuniones' as const, label: 'Reuniones' },
] as const;

/** Mes anterior (oscuro) vs mes actual (claro), estilo referencia Apex. */
const SERIES_COLORS = ['#047857', '#6ee7b7'] as const;

function formatValue(n: number): string {
  return Math.round(n).toLocaleString('es-PE');
}

function comparisonTotal(comparison: ActivitiesByTypeMonthComparison): number {
  const keys = ['correos', 'llamadas', 'reuniones'] as const;
  return keys.reduce(
    (sum, key) =>
      sum + (comparison.previousMonth[key] ?? 0) + (comparison.currentMonth[key] ?? 0),
    0,
  );
}

interface ActivitiesByTypeBarChartProps {
  comparison: ActivitiesByTypeMonthComparison;
  className?: string;
  chartHeight?: number;
}

export function ActivitiesByTypeBarChart({
  comparison,
  className,
  chartHeight = 220,
}: ActivitiesByTypeBarChartProps) {
  const chartTheme = useChartTheme();

  const rows = useMemo(() => {
    const mapped = ACTIVITY_ITEMS.map((item) => ({
      ...item,
      previous: comparison.previousMonth[item.key] ?? 0,
      current: comparison.currentMonth[item.key] ?? 0,
    }));
    return mapped.sort(
      (a, b) => b.previous + b.current - (a.previous + a.current),
    );
  }, [comparison]);

  const categories = useMemo(() => rows.map((row) => row.label), [rows]);

  const series = useMemo(
    () => [
      {
        name: comparison.previousMonth.name,
        data: rows.map((row) => row.previous),
      },
      {
        name: comparison.currentMonth.name,
        data: rows.map((row) => row.current),
      },
    ],
    [comparison.currentMonth.name, comparison.previousMonth.name, rows],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        background: 'transparent',
      },
      colors: [...SERIES_COLORS],
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '48%',
          borderRadius: 4,
          borderRadiusApplication: 'end',
          dataLabels: {
            position: 'top',
            hideOverflowingLabels: false,
          },
        },
      },
      dataLabels: { enabled: false },
      stroke: { width: 0, colors: ['transparent'] },
      states: {
        hover: { filter: { type: 'darken', value: 0.9 } },
        active: { filter: { type: 'darken', value: 0.85 } },
      },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 0, right: 12, bottom: 0, left: 8 },
      },
      xaxis: {
        categories,
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 500 },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 500 },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      legend: { show: false },
      tooltip: {
        theme: chartTheme.isDark ? 'dark' : 'light',
        shared: true,
        intersect: false,
        y: {
          formatter: (val) => {
            const n = Number(val);
            return `${formatValue(n)} actividad${n === 1 ? '' : 'es'}`;
          },
        },
      },
      fill: { opacity: 1 },
    }),
    [categories, chartTheme.axisColor, chartTheme.gridStroke, chartTheme.isDark],
  );

  const isEmpty = comparisonTotal(comparison) <= 0;

  if (isEmpty) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-sm text-muted-foreground',
          className,
        )}
        style={{ minHeight: chartHeight }}
      >
        Sin actividades registradas en este periodo.
      </div>
    );
  }

  return (
    <div className={cn('flex w-full flex-col', className)}>
      <div className="shrink-0 leading-none [&_.apexcharts-svg]:overflow-visible">
        <Chart options={options} series={series} type="bar" height={chartHeight} />
      </div>
    </div>
  );
}
