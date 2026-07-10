import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { cn } from '@/lib/utils';
import type { AdvancedContactsWeekly } from '@/lib/analyticsApi';
import { buildCompanyWeeklyStageTooltipHtml } from '@/lib/companyWeeklyStageChartUtils';

const SERIES_COLOR = '#2563eb';

interface AdvancedContactsBarChartProps {
  data: AdvancedContactsWeekly | null | undefined;
  height?: number;
  className?: string;
  showLegend?: boolean;
  showChartTitle?: boolean;
}

export function AdvancedContactsBarChart({
  data,
  height = 270,
  className,
  showLegend = true,
  showChartTitle = false,
}: AdvancedContactsBarChartProps) {
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
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        zoom: { enabled: false },
        background: 'transparent',
        parentHeightOffset: 0,
        redrawOnParentResize: true,
      },
      colors: [SERIES_COLOR],
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '48%',
          borderRadius: 6,
          borderRadiusApplication: 'end',
        },
      },
      stroke: { width: 0 },
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
          return buildCompanyWeeklyStageTooltipHtml(week, dataPointIndex, isDark);
        },
      },
    }),
    [categories, chartTheme.axisColor, isDark, weeks],
  );

  const series = useMemo(
    () => [{ name: 'Contactos avanzados', data: totals }],
    [totals],
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
        Sin contactos avanzados en las últimas 6 semanas.
      </div>
    );
  }

  return (
    <div className={cn('w-full min-w-0', className)}>
      {showChartTitle ? (
        <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Contactos avanzados en el tiempo
        </p>
      ) : null}
      <div className="w-full min-w-0 leading-none [&_.apexcharts-canvas]:!w-full [&_.apexcharts-canvas]:!max-w-full [&_.apexcharts-inner]:!w-full [&_.apexcharts-svg]:!w-full [&_.apexcharts-svg]:overflow-visible [&_.apexcharts-tooltip]:!border-0 [&_.apexcharts-tooltip]:!bg-transparent [&_.apexcharts-tooltip]:!shadow-none">
        <Chart options={options} series={series} type="bar" height={height} />
      </div>
      {showLegend ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className="inline-block size-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: SERIES_COLOR }}
          />
          <span>Contactos avanzados (etapas 30%–100%)</span>
        </div>
      ) : null}
    </div>
  );
}
