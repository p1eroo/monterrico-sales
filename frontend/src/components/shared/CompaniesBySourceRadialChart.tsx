import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { cn } from '@/lib/utils';

const RING_COLORS = ['#22c55e', '#fbbf24', '#fb7185', '#8b5cf6', '#06b6d4'];
/** Un poco más oscuro que el fondo del card, sin resultar pesado. */
const TRACK_COLOR = '#e8ecf0';
const MAX_RINGS = 5;

export type CompaniesBySourcePoint = {
  name: string;
  value: number;
};

function buildSlices(data: CompaniesBySourcePoint[]): CompaniesBySourcePoint[] {
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= MAX_RINGS) return sorted;

  const top = sorted.slice(0, MAX_RINGS - 1);
  const others = sorted.slice(MAX_RINGS - 1).reduce((sum, row) => sum + row.value, 0);
  if (others > 0) {
    top.push({ name: 'Otros', value: others });
  }
  return top;
}

function formatTotal(n: number): string {
  return Math.round(n).toLocaleString('es-PE');
}

function colorForSliceName(slices: CompaniesBySourcePoint[], name: string): string {
  const index = slices.findIndex((s) => s.name === name);
  return RING_COLORS[index >= 0 ? index % RING_COLORS.length : 0];
}

interface CompaniesBySourceRadialChartProps {
  data: CompaniesBySourcePoint[];
  className?: string;
  chartHeight?: number;
  showLegend?: boolean;
}

export function CompaniesBySourceRadialChart({
  data,
  className,
  chartHeight = 240,
  showLegend = true,
}: CompaniesBySourceRadialChartProps) {
  const slices = useMemo(() => buildSlices(data), [data]);
  const total = useMemo(() => data.reduce((sum, row) => sum + row.value, 0), [data]);

  const ascendingSlices = useMemo(
    () => [...slices].sort((a, b) => a.value - b.value),
    [slices],
  );

  const series = useMemo(() => {
    if (total <= 0) return [];
    return ascendingSlices.map((row) => Math.round((row.value / total) * 100));
  }, [ascendingSlices, total]);

  const legendSlices = useMemo(() => [...slices].sort((a, b) => b.value - a.value), [slices]);

  const labels = useMemo(() => ascendingSlices.map((row) => row.name), [ascendingSlices]);

  const colors = useMemo(
    () =>
      ascendingSlices.map((row) => colorForSliceName(slices, row.name)),
    [ascendingSlices, slices],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'radialBar',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        sparkline: { enabled: false },
      },
      colors,
      labels,
      stroke: { lineCap: 'round' as const },
      plotOptions: {
        radialBar: {
          startAngle: 0,
          endAngle: 360,
          hollow: {
            size: '28%',
          },
          track: {
            background: TRACK_COLOR,
            strokeWidth: '100%',
            margin: 7,
            opacity: 1,
          },
          dataLabels: {
            show: false,
            name: { show: false },
            value: { show: false },
            total: { show: false },
          },
        },
      },
      fill: {
        type: 'solid',
      },
      legend: { show: false },
      tooltip: {
        enabled: true,
        y: {
          formatter: (_val, opts) => {
            const idx = opts?.seriesIndex ?? 0;
            const slice = ascendingSlices[idx];
            if (!slice) return '';
            const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
            return `${slice.value.toLocaleString('es-PE')} (${pct}%)`;
          },
          title: {
            formatter: (_name, opts) => ascendingSlices[opts?.seriesIndex ?? 0]?.name ?? '',
          },
        },
      },
    }),
    [ascendingSlices, colors, labels, total],
  );

  const isEmpty = slices.length === 0 || total <= 0;

  if (isEmpty) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-sm text-muted-foreground',
          className,
        )}
        style={{ minHeight: chartHeight }}
      >
        Sin empresas por fuente en este periodo.
      </div>
    );
  }

  return (
    <div className={cn('flex w-full flex-col', className)}>
      <div className="relative shrink-0" style={{ height: chartHeight }}>
        <Chart options={options} series={series} type="radialBar" height={chartHeight} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground">Total</span>
          <span className="text-xl font-medium tabular-nums tracking-tight text-foreground">
            {formatTotal(total)}
          </span>
        </div>
      </div>
      {showLegend ? (
        <div className="mt-2 shrink-0 border-t border-dashed border-[#e8ecf0] px-2 pb-2 pt-4 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {legendSlices.map((slice) => (
              <div
                key={slice.name}
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colorForSliceName(slices, slice.name) }}
                />
                {slice.name}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
