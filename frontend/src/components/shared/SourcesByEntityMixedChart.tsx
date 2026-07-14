import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { buildSourcesByWeekTooltipHtml } from '@/lib/sourcesByWeekChartUtils';
import { cn } from '@/lib/utils';

export type SourcesByWeekStackedSeries = {
  name: string;
  data: number[];
};

export type SourcesByWeekTooltipSource = {
  slug: string;
  label: string;
  value: number;
};

export type SourcesByWeekTooltipWeek = {
  name: string;
  weekStart: string;
  weekEnd: string;
  sources: SourcesByWeekTooltipSource[];
  total: number;
};

export type SourcesByWeekStackedChartData = {
  categories: string[];
  series: SourcesByWeekStackedSeries[];
  tooltipWeeks: SourcesByWeekTooltipWeek[];
};

const SOURCE_STACK_COLORS = [
  '#13944C',
  '#34d399',
  '#065f46',
  '#6ee7b7',
  '#0f7a3d',
  '#22c55e',
  '#94a3b8',
];

function formatTotal(n: number): string {
  return Math.round(n).toLocaleString('es-PE');
}

interface SourcesByEntityMixedChartProps {
  data: SourcesByWeekStackedChartData;
  className?: string;
  height?: number;
  showLegendSummary?: boolean;
}

export function SourcesByEntityMixedChart({
  data,
  className,
  height = 350,
  showLegendSummary = true,
}: SourcesByEntityMixedChartProps) {
  const chartTheme = useChartTheme();
  const { categories, series, tooltipWeeks } = data;
  const { isDark } = chartTheme;

  const seriesLatest = useMemo(
    () => series.map((row) => row.data[row.data.length - 1] ?? 0),
    [series],
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
      colors: SOURCE_STACK_COLORS,
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '52%',
          borderRadius: 6,
          borderRadiusApplication: 'end',
          borderRadiusWhenStacked: 'last',
          dataLabels: {
            total: {
              enabled: true,
              offsetY: -4,
              style: {
                fontSize: '11px',
                fontWeight: 600,
                color: chartTheme.isDark ? '#e2e8f0' : '#334155',
              },
            },
          },
        },
      },
      stroke: { width: 0 },
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 8, right: 8, bottom: 0, left: 4 },
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
        tickAmount: 4,
        labels: {
          formatter: (value) => String(Math.round(Number(value))),
          style: { colors: chartTheme.axisColor, fontSize: '11px' },
        },
      },
      tooltip: {
        enabled: true,
        shared: false,
        intersect: false,
        followCursor: false,
        custom({ dataPointIndex }) {
          const week = tooltipWeeks[dataPointIndex];
          if (!week || dataPointIndex < 0) return '';
          return buildSourcesByWeekTooltipHtml(week, isDark);
        },
      },
      states: {
        hover: { filter: { type: 'darken', value: 0.9 } },
        active: { filter: { type: 'none' } },
      },
    }),
    [categories, chartTheme.axisColor, chartTheme.gridStroke, isDark, tooltipWeeks],
  );

  const isEmpty =
    categories.length === 0 ||
    series.length === 0 ||
    series.every((row) => row.data.every((value) => value <= 0));

  if (isEmpty) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-sm text-muted-foreground',
          className,
        )}
        style={{ height }}
      >
        Sin empresas acumuladas por fuente en las últimas 6 semanas.
      </div>
    );
  }

  return (
    <div className={cn('flex w-full flex-col', className)}>
      {showLegendSummary ? (
        <div className="mb-3 shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
          {series.map((row, index) => (
            <span key={row.name} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 shrink-0 rounded-sm"
                style={{
                  backgroundColor:
                    SOURCE_STACK_COLORS[index % SOURCE_STACK_COLORS.length],
                }}
              />
              {row.name}{' '}
              <span className="font-semibold text-foreground">
                {formatTotal(seriesLatest[index] ?? 0)}
              </span>
            </span>
          ))}
        </div>
      ) : null}
      <div className="min-h-0 shrink-0 leading-none [&_.apexcharts-canvas]:!w-full [&_.apexcharts-svg]:overflow-visible [&_.apexcharts-tooltip]:!border-0 [&_.apexcharts-tooltip]:!bg-transparent [&_.apexcharts-tooltip]:!shadow-none">
        <Chart options={options} series={series} type="bar" height={height} />
      </div>
    </div>
  );
}
