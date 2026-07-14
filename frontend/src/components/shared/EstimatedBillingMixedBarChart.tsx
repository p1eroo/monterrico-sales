import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { formatCurrencyCompact } from '@/lib/formatters';
import {
  buildEstimatedBillingTooltipHtml,
  hotStageBillingMarkerYFromWeek,
} from '@/lib/estimatedBillingChartUtils';
import { cn } from '@/lib/utils';
import type { EstimatedBillingWeekly } from '@/lib/analyticsApi';
import { weekAxisLabelFromWeekRow } from '@/lib/crmTimezone';
import { ESTIMATED_BILLING_WEEKLY_CHART } from '@/lib/reportsWeeklyMetricChartColors';

const SERIES_COLOR = ESTIMATED_BILLING_WEEKLY_CHART.bar;
const HOT_STAGE_LINE_COLOR = ESTIMATED_BILLING_WEEKLY_CHART.hotLine;

interface EstimatedBillingMixedBarChartProps {
  data: EstimatedBillingWeekly | null | undefined;
  height?: number;
  className?: string;
  showLegend?: boolean;
  showChartTitle?: boolean;
}

export function EstimatedBillingMixedBarChart({
  data,
  height = 270,
  className,
  showLegend = true,
  showChartTitle = false,
}: EstimatedBillingMixedBarChartProps) {
  const chartTheme = useChartTheme();
  const { isDark } = chartTheme;

  const weeks = data?.weeks ?? [];
  const categories = useMemo(
    () => weeks.map((week) => weekAxisLabelFromWeekRow(week)),
    [weeks],
  );
  const totals = useMemo(() => weeks.map((w) => w.total), [weeks]);
  const hotMarkerYs = useMemo(
    () => weeks.map((week) => hotStageBillingMarkerYFromWeek(week)),
    [weeks],
  );
  const hasHotMarkers = hotMarkerYs.some((value) => value != null);

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'line',
        stacked: false,
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        zoom: { enabled: false },
        background: 'transparent',
        parentHeightOffset: 0,
        redrawOnParentResize: true,
      },
      colors: [SERIES_COLOR, HOT_STAGE_LINE_COLOR],
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '48%',
          borderRadius: 6,
          borderRadiusApplication: 'end',
        },
      },
      stroke: {
        width: hasHotMarkers ? [0, 2.5] : [0, 0],
        curve: 'straight',
      },
      markers: {
        size: hasHotMarkers ? [0, 5] : [0, 0],
        strokeWidth: 2,
        strokeColors: isDark ? '#0f172a' : '#ffffff',
        hover: { size: hasHotMarkers ? 7 : 0 },
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
      states: {
        hover: { filter: { type: 'darken', value: 0.88 } },
        active: { filter: { type: 'none' } },
      },
      tooltip: {
        enabled: true,
        shared: false,
        intersect: false,
        followCursor: false,
        custom({ dataPointIndex }) {
          const week = weeks[dataPointIndex];
          if (!week || dataPointIndex < 0) return '';
          return buildEstimatedBillingTooltipHtml(week, isDark);
        },
      },
    }),
    [categories, chartTheme.axisColor, hasHotMarkers, isDark, weeks],
  );

  const series = useMemo(
    () => [
      { name: 'Facturación estimada', type: 'column' as const, data: totals },
      {
        name: 'Facturación 70%+',
        type: 'line' as const,
        data: hotMarkerYs,
      },
    ],
    [hotMarkerYs, totals],
  );

  const isEmpty = weeks.length === 0 || weeks.every((w) => w.total <= 0);

  if (isEmpty) {
    return (
      <div
        className={cn(
          'flex w-full items-center justify-center text-sm text-muted-foreground',
          className,
        )}
        style={{ minHeight: height }}
      >
        Sin facturación estimada del año en las últimas 6 semanas.
      </div>
    );
  }

  return (
    <div className={cn('w-full min-w-0', className)}>
      {showChartTitle ? (
        <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Facturación del año en el tiempo
        </p>
      ) : null}
      <div className="w-full min-w-0 leading-none [&_.apexcharts-canvas]:!w-full [&_.apexcharts-canvas]:!max-w-full [&_.apexcharts-inner]:!w-full [&_.apexcharts-svg]:!w-full [&_.apexcharts-svg]:overflow-visible [&_.apexcharts-tooltip]:!border-0 [&_.apexcharts-tooltip]:!bg-transparent [&_.apexcharts-tooltip]:!shadow-none">
        <Chart options={options} series={series} type="line" height={height} />
      </div>
      {showLegend ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: SERIES_COLOR }}
            />
            <span>Facturación estimada del año (etapas 10%–100%)</span>
          </span>
          {hasHotMarkers ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block size-2.5 shrink-0 rounded-full border-2 bg-background"
                style={{ borderColor: HOT_STAGE_LINE_COLOR }}
              />
              <span>Facturación 70%+ (monto)</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
