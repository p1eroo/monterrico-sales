import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { formatCurrencyCompact } from '@/lib/formatters';
import { buildEstimatedBillingTooltipHtml } from '@/lib/estimatedBillingChartUtils';
import { cn } from '@/lib/utils';
import type { EstimatedBillingWeekly } from '@/lib/analyticsApi';
import { weekAxisLabelFromWeekRow } from '@/lib/crmTimezone';

const SERIES_COLOR = '#6366f1';

interface EstimatedBillingAreaChartProps {
  data: EstimatedBillingWeekly | null | undefined;
  height?: number;
  className?: string;
  showLegend?: boolean;
  showChartTitle?: boolean;
}

export function EstimatedBillingAreaChart({
  data,
  height = 270,
  className,
  showLegend = true,
  showChartTitle = false,
}: EstimatedBillingAreaChartProps) {
  const chartTheme = useChartTheme();
  const { isDark } = chartTheme;

  const weeks = data?.weeks ?? [];
  const categories = useMemo(
    () => weeks.map((week) => weekAxisLabelFromWeekRow(week)),
    [weeks],
  );
  const totals = useMemo(() => weeks.map((w) => w.total), [weeks]);

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'area',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        zoom: { enabled: false },
        background: 'transparent',
        parentHeightOffset: 0,
        redrawOnParentResize: true,
      },
      colors: [SERIES_COLOR],
      stroke: { curve: 'straight', width: 2 },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: isDark ? 0.45 : 0.55,
          opacityTo: isDark ? 0.08 : 0.12,
          stops: [0, 90, 100],
        },
      },
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: {
        show: false,
        padding: { top: 4, right: 0, bottom: 0, left: 8 },
      },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 500 },
        },
        tooltip: { enabled: false },
      },
      yaxis: {
        min: 0,
        forceNiceScale: true,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          formatter: (value) => formatCurrencyCompact(Number(value)),
          style: { colors: chartTheme.axisColor, fontSize: '11px' },
        },
      },
      markers: {
        size: 0,
        hover: { size: 0 },
      },
      tooltip: {
        enabled: true,
        shared: false,
        intersect: false,
        custom({ dataPointIndex }) {
          const week = weeks[dataPointIndex];
          if (!week || dataPointIndex < 0) return '';
          return buildEstimatedBillingTooltipHtml(week, isDark);
        },
      },
      states: {
        hover: { filter: { type: 'lighten', value: 0.04 } },
        active: { filter: { type: 'none' } },
      },
    }),
    [categories, chartTheme.axisColor, isDark, weeks],
  );

  const series = useMemo(
    () => [{ name: 'Facturación estimada', data: totals }],
    [totals],
  );

  const isEmpty =
    weeks.length === 0 ||
    weeks.every((w) => w.total <= 0);

  if (isEmpty) {
    return (
      <div
        className={cn(
          'flex w-full items-center justify-center text-sm text-muted-foreground',
          className,
        )}
        style={{ minHeight: height }}
      >
        Sin facturación estimada en las últimas 6 semanas.
      </div>
    );
  }

  return (
    <div className={cn('w-full min-w-0', className)}>
      {showChartTitle ? (
        <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Facturación en el tiempo
        </p>
      ) : null}
      <div className="w-full min-w-0 leading-none [&_.apexcharts-canvas]:!w-full [&_.apexcharts-canvas]:!max-w-full [&_.apexcharts-inner]:!w-full [&_.apexcharts-svg]:!w-full [&_.apexcharts-svg]:overflow-visible [&_.apexcharts-tooltip]:!border-0 [&_.apexcharts-tooltip]:!bg-transparent [&_.apexcharts-tooltip]:!shadow-none">
        <Chart options={options} series={series} type="area" height={height} />
      </div>
      {showLegend ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className="inline-block size-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: SERIES_COLOR }}
          />
          <span>Facturación estimada (etapas 10%–100%)</span>
        </div>
      ) : null}
    </div>
  );
}
