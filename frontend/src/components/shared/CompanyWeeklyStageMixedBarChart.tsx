import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { cn } from '@/lib/utils';
import {
  buildCompanyWeeklyStageTooltipHtml,
  hotStageMarkerYFromWeek,
  type CompanyWeeklyStageData,
} from '@/lib/companyWeeklyStageChartUtils';
import { weekAxisLabelFromWeekRow } from '@/lib/crmTimezone';

interface CompanyWeeklyStageMixedBarChartProps {
  data: CompanyWeeklyStageData | null | undefined;
  height?: number;
  className?: string;
  showLegend?: boolean;
  showChartTitle?: boolean;
  seriesColor: string;
  hotStageLineColor: string;
  totalSeriesName: string;
  totalLegendLabel: string;
  chartTitle: string;
  emptyMessage: string;
}

export function CompanyWeeklyStageMixedBarChart({
  data,
  height = 270,
  className,
  showLegend = true,
  showChartTitle = false,
  seriesColor,
  hotStageLineColor,
  totalSeriesName,
  totalLegendLabel,
  chartTitle,
  emptyMessage,
}: CompanyWeeklyStageMixedBarChartProps) {
  const chartTheme = useChartTheme();
  const { isDark } = chartTheme;

  const weeks = data?.weeks ?? [];
  const categories = useMemo(
    () => weeks.map((week) => weekAxisLabelFromWeekRow(week)),
    [weeks],
  );
  const totals = useMemo(() => weeks.map((w) => w.total), [weeks]);
  const hotMarkerYs = useMemo(
    () => weeks.map((week) => hotStageMarkerYFromWeek(week)),
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
      colors: [seriesColor, hotStageLineColor],
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
          formatter: (value) => String(Math.round(Number(value))),
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
          return buildCompanyWeeklyStageTooltipHtml(week, isDark);
        },
      },
    }),
    [categories, chartTheme.axisColor, hasHotMarkers, hotStageLineColor, isDark, seriesColor, weeks],
  );

  const series = useMemo(
    () => [
      { name: totalSeriesName, type: 'column' as const, data: totals },
      {
        name: 'Etapas 70%+',
        type: 'line' as const,
        data: hotMarkerYs,
      },
    ],
    [hotMarkerYs, totalSeriesName, totals],
  );
  const isEmpty = totals.length === 0 || totals.every((v) => v <= 0);

  if (isEmpty) {
    return (
      <div
        className={cn(
          'flex w-full items-center justify-center text-sm text-muted-foreground',
          className,
        )}
        style={{ minHeight: height }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('w-full min-w-0', className)}>
      {showChartTitle ? (
        <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {chartTitle}
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
              style={{ backgroundColor: seriesColor }}
            />
            <span>{totalLegendLabel}</span>
          </span>
          {hasHotMarkers ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block size-2.5 shrink-0 rounded-full border-2 bg-background"
                style={{ borderColor: hotStageLineColor }}
              />
              <span>Etapas 70%+ (cantidad)</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
