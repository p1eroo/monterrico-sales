import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { buildAdvisorStackedBarTooltipHtml } from '@/lib/advisorStackedBarTooltip';
import {
  type ActivitiesByAdvisorStackedData,
  activitiesByAdvisorStackedHasData,
} from '@/lib/activitiesByAdvisorStackedUtils';
import { cn } from '@/lib/utils';

const ACTIVITY_SERIES = [
  { key: 'llamadas' as const, label: 'Llamadas', color: '#13944C' },
  { key: 'reuniones' as const, label: 'Reuniones', color: '#34d399' },
  { key: 'correos' as const, label: 'Correos', color: '#065f46' },
  { key: 'notas' as const, label: 'Notas', color: '#6ee7b7' },
] as const;

const ACTIVITY_COUNT_BY_LABEL: Record<string, [singular: string, plural: string]> = {
  Llamadas: ['llamada', 'llamadas'],
  Reuniones: ['reunión', 'reuniones'],
  Correos: ['correo', 'correos'],
  Notas: ['nota', 'notas'],
};

function formatActivityCountByLabel(label: string, value: number): string {
  const forms = ACTIVITY_COUNT_BY_LABEL[label];
  const count = formatValue(value);
  if (!forms) return `${count} actividad${value === 1 ? '' : 'es'}`;
  const word = value === 1 ? forms[0] : forms[1];
  return `${count} ${word}`;
}

function formatValue(n: number): string {
  return Math.round(n).toLocaleString('es-PE');
}

function resolveChartHeight(advisorCount: number, explicit?: number): number {
  if (explicit != null) return explicit;
  const rowHeight = 44;
  const chrome = 72;
  return Math.max(200, Math.min(420, advisorCount * rowHeight + chrome));
}

interface ActivitiesByAdvisorStackedBarChartProps {
  data: ActivitiesByAdvisorStackedData;
  className?: string;
  chartHeight?: number;
  showLegend?: boolean;
}

export function ActivitiesByAdvisorStackedBarChart({
  data,
  className,
  chartHeight,
  showLegend = true,
}: ActivitiesByAdvisorStackedBarChartProps) {
  const chartTheme = useChartTheme();
  const isEmpty = !activitiesByAdvisorStackedHasData(data);
  const height = resolveChartHeight(data.advisors.length, chartHeight);

  const categories = useMemo(
    () => data.advisors.map((row) => row.advisorName),
    [data.advisors],
  );

  const series = useMemo(
    () =>
      ACTIVITY_SERIES.map((item) => ({
        name: item.label,
        data: data.advisors.map((row) => row[item.key]),
      })),
    [data.advisors],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'bar',
        stacked: true,
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        background: 'transparent',
      },
      colors: ACTIVITY_SERIES.map((item) => item.color),
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: data.advisors.length > 4 ? '72%' : '58%',
          borderRadius: 4,
          borderRadiusApplication: 'end',
          borderRadiusWhenStacked: 'last',
          dataLabels: {
            total: {
              enabled: true,
              offsetX: 4,
              style: {
                fontSize: '11px',
                fontWeight: 600,
                color: chartTheme.isDark ? '#e2e8f0' : '#334155',
              },
              formatter: (total) =>
                total != null && Number(total) > 0
                  ? formatValue(Number(total))
                  : '',
            },
          },
        },
      },
      dataLabels: { enabled: false },
      stroke: { width: 0, colors: ['transparent'] },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 0, right: 16, bottom: 0, left: 4 },
      },
      xaxis: {
        categories,
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 500 },
          formatter: (value) => formatValue(Number(value)),
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 600 },
          maxWidth: 140,
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      legend: {
        show: showLegend,
        position: 'top',
        horizontalAlign: 'left',
        fontSize: '11px',
        fontWeight: 500,
        markers: { size: 6, shape: 'circle', offsetX: -2 },
        itemMargin: { horizontal: 12, vertical: 0 },
        labels: { colors: chartTheme.axisColor },
        offsetY: 2,
      },
      tooltip: {
        enabled: true,
        shared: false,
        intersect: true,
        followCursor: true,
        theme: chartTheme.isDark ? 'dark' : 'light',
        custom: ({ dataPointIndex }) => {
          if (dataPointIndex == null || dataPointIndex < 0) return '';
          const advisor = data.advisors[dataPointIndex];
          if (!advisor) return '';
          return buildAdvisorStackedBarTooltipHtml({
            title: advisor.advisorName,
            weekLabel: data.weekLabel,
            seriesItems: ACTIVITY_SERIES.map((item) => ({
              name: item.label,
              value: advisor[item.key],
              formatValue: formatActivityCountByLabel,
            })),
          });
        },
      },
      fill: { opacity: 1 },
    }),
    [
      categories,
      chartTheme.axisColor,
      chartTheme.gridStroke,
      chartTheme.isDark,
      data.advisors.length,
      data.advisors,
      data.weekLabel,
      showLegend,
    ],
  );

  if (isEmpty) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-sm text-muted-foreground',
          className,
        )}
        style={{ minHeight: height }}
      >
        Sin actividades registradas en las últimas 6 semanas.
      </div>
    );
  }

  return (
    <div className={cn('flex w-full flex-col', className)}>
      <div className="shrink-0 leading-none [&_.apexcharts-svg]:overflow-visible">
        <Chart options={options} series={series} type="bar" height={height} />
      </div>
    </div>
  );
}
