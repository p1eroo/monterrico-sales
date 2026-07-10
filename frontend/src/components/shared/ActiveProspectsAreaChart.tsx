import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { cn } from '@/lib/utils';
import type { ActiveProspectsWeekly } from '@/lib/analyticsApi';
import { buildCompanyWeeklyStageTooltipHtml } from '@/lib/companyWeeklyStageChartUtils';

const SERIES_COLOR = '#4f46e5';

interface ActiveProspectsAreaChartProps {
  data: ActiveProspectsWeekly | null | undefined;
  height?: number;
  className?: string;
  showLegend?: boolean;
  showChartTitle?: boolean;
}

export function ActiveProspectsAreaChart({
  data,
  height = 270,
  className,
  showLegend = true,
  showChartTitle = false,
}: ActiveProspectsAreaChartProps) {
  const chartTheme = useChartTheme();
  const { isDark } = chartTheme;

  const weeks = data?.weeks ?? [];
  const categories = useMemo(
    () => weeks.map((_, index) => `W${index + 1}`),
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
      stroke: { curve: 'smooth', width: 2.5 },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: isDark ? 0.35 : 0.4,
          opacityTo: isDark ? 0.02 : 0.05,
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
        crosshairs: {
          show: true,
          stroke: {
            color: chartTheme.gridStroke,
            width: 1,
            dashArray: 4,
          },
        },
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
      markers: {
        size: 0,
        hover: { size: 6, sizeOffset: 0 },
      },
      tooltip: {
        enabled: true,
        shared: false,
        intersect: false,
        followCursor: false,
        fixed: { enabled: false },
        custom({ dataPointIndex }) {
          const week = weeks[dataPointIndex];
          if (!week || dataPointIndex < 0) return '';
          return buildCompanyWeeklyStageTooltipHtml(week, dataPointIndex, isDark);
        },
      },
      states: {
        hover: { filter: { type: 'lighten', value: 0.04 } },
        active: { filter: { type: 'none' } },
      },
    }),
    [categories, chartTheme.axisColor, chartTheme.gridStroke, isDark, weeks],
  );

  const series = useMemo(() => [{ name: 'Prospectos activos', data: totals }], [totals]);
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
        Sin prospectos activos en las últimas 6 semanas.
      </div>
    );
  }

  return (
    <div className={cn('w-full min-w-0', className)}>
      {showChartTitle ? (
        <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Prospectos en el tiempo
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
          <span>Prospectos activos (etapas 10%–100%)</span>
        </div>
      ) : null}
    </div>
  );
}
