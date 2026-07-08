import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import type { GoalChartPoint } from '@/lib/analyticsApi';
import { cn } from '@/lib/utils';

export const GOALS_ROW_CHART_MIN_HEIGHT = 320;
/** Altura del bloque Meta/Avance (h-14 + mb-4) para alinear el pie con el bar chart. */
export const GOALS_SUMMARY_BLOCK_CLASS = 'mb-4 h-14 shrink-0';

const META_COLOR = '#0f766e';
const AVANCE_COLOR = '#fb923c';

function formatAxisValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(Math.round(value));
}

interface GoalGroupedBarChartProps {
  data: GoalChartPoint[];
  className?: string;
}

export function GoalGroupedBarChart({ data, className }: GoalGroupedBarChartProps) {
  const categories = useMemo(() => data.map((d) => d.name), [data]);
  const metaSeries = useMemo(() => data.map((d) => d.meta), [data]);
  const avanceSeries = useMemo(() => data.map((d) => d.avance), [data]);

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 400 },
      },
      colors: [META_COLOR, AVANCE_COLOR],
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '48%',
          borderRadius: 4,
          borderRadiusApplication: 'end',
        },
      },
      dataLabels: { enabled: false },
      stroke: { show: true, width: 2, colors: ['transparent'] },
      legend: { show: false },
      grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 0, right: 8, bottom: 0, left: 8 },
      },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: { colors: '#94a3b8', fontSize: '11px', fontWeight: 500 },
        },
      },
      yaxis: {
        min: 0,
        labels: {
          formatter: (v) => formatAxisValue(Number(v)),
          style: { colors: '#94a3b8', fontSize: '11px' },
        },
      },
      tooltip: {
        shared: true,
        intersect: false,
        y: {
          formatter: (v) =>
            v == null ? '' : `S/ ${Math.round(Number(v)).toLocaleString('es-PE')}`,
        },
      },
    }),
    [categories],
  );

  const series = useMemo(
    () => [
      { name: 'Meta', data: metaSeries },
      { name: 'Avance', data: avanceSeries },
    ],
    [metaSeries, avanceSeries],
  );

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-sm text-muted-foreground',
          className,
        )}
        style={{ height: GOALS_ROW_CHART_MIN_HEIGHT }}
      >
        Sin datos de metas.
      </div>
    );
  }

  return (
    <div
      className={cn('w-full overflow-hidden', className)}
      style={{ height: GOALS_ROW_CHART_MIN_HEIGHT }}
    >
      <Chart
        options={options}
        series={series}
        type="bar"
        height={GOALS_ROW_CHART_MIN_HEIGHT}
      />
    </div>
  );
}

export { META_COLOR as GOAL_META_COLOR, AVANCE_COLOR as GOAL_AVANCE_COLOR };
