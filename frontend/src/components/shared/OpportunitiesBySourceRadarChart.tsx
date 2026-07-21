import { useMemo, type CSSProperties } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { cn } from '@/lib/utils';
import { GOALS_ROW_CHART_MIN_HEIGHT } from '@/components/shared/GoalGroupedBarChart';

const PIE_COLORS = ['#1DB954', '#2ECC87', '#064E31', '#52D68A', '#0E6B40', '#7AD9AE'];
const PIE_CHART_HEIGHT = 300;
const MAX_SLICES = 5;

export type SourceRadarPoint = {
  name: string;
  value: number;
};

interface OpportunitiesBySourceRadarChartProps {
  data: SourceRadarPoint[];
  className?: string;
  style?: CSSProperties;
}

function buildPieSlices(data: SourceRadarPoint[]): SourceRadarPoint[] {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  if (sorted.length <= MAX_SLICES) return sorted;

  const top = sorted.slice(0, MAX_SLICES - 1);
  const others = sorted.slice(MAX_SLICES - 1).reduce((sum, row) => sum + row.value, 0);
  if (others > 0) {
    top.push({ name: 'Otros', value: others });
  }
  return top;
}

export function OpportunitiesBySourceRadarChart({
  data,
  className,
  style,
}: OpportunitiesBySourceRadarChartProps) {
  const slices = useMemo(() => buildPieSlices(data), [data]);

  const labels = useMemo(() => slices.map((d) => d.name), [slices]);
  const series = useMemo(() => slices.map((d) => d.value), [slices]);

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'pie',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        offsetY: 4,
      },
      colors: PIE_COLORS,
      labels,
      stroke: { width: 0, colors: ['transparent'] },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${Math.round(val * 10) / 10}%`,
        dropShadow: { enabled: false },
        style: {
          fontSize: '12px',
          fontWeight: 600,
          colors: ['#fff'],
        },
      },
      legend: { show: false },
      plotOptions: {
        pie: {
          expandOnClick: false,
          customScale: 0.92,
          dataLabels: {
            offset: -4,
            minAngleToShowLabel: 12,
          },
        },
      },
      tooltip: {
        y: {
          formatter: (val) => (val == null ? '' : String(Math.round(Number(val)))),
          title: { formatter: (name) => String(name) },
        },
      },
    }),
    [labels],
  );

  if (slices.length === 0 || series.every((v) => v <= 0)) {
    return (
      <div
        className={cn(
          'flex flex-1 items-center justify-center text-sm text-muted-foreground',
          className,
        )}
        style={{ minHeight: GOALS_ROW_CHART_MIN_HEIGHT, ...style }}
      >
        Sin oportunidades por fuente en este periodo.
      </div>
    );
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)} style={style}>
      <div
        className="mb-4 mt-1 flex shrink-0 items-center justify-center overflow-hidden"
        style={{ height: GOALS_ROW_CHART_MIN_HEIGHT }}
      >
        <Chart
          options={options}
          series={series}
          type="pie"
          height={PIE_CHART_HEIGHT}
        />
      </div>
      <div className="mt-auto shrink-0 border-t border-dashed border-[#e8ecf0] px-2 pb-4 pt-2 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {slices.map((slice, index) => (
            <div
              key={slice.name}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
              />
              {slice.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
