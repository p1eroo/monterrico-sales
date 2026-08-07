import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import {
  type ActivitiesByTypeHeatmapData,
  activitiesByTypeHeatmapHasData,
} from '@/lib/activitiesByTypeHeatmapUtils';
import { formatIsoWeekLabel, parseIsoWeekNumberFromLabel } from '@/lib/crmTimezone';
import { cn } from '@/lib/utils';

/** Paleta verde escalonada: contacto → no contacto → reuniones → correos. */
const ACTIVITY_SERIES = [
  { label: 'Contacto', color: '#0E6B40' },
  { label: 'No contacto', color: '#6ee7b7' },
  { label: 'Reuniones', color: '#2ECC87' },
  { label: 'Correos', color: '#064E31' },
] as const;

const ACTIVITY_COUNT_FORMS: Record<string, [singular: string, plural: string]> = {
  Contacto: ['llamada con contacto', 'llamadas con contacto'],
  'No contacto': ['llamada sin contacto', 'llamadas sin contacto'],
  Reuniones: ['reunión', 'reuniones'],
  Correos: ['correo', 'correos'],
};

function formatValue(n: number): string {
  return Math.round(n).toLocaleString('es-PE');
}

function formatCategoryLabel(name: string, granularity: 'week' | 'day'): string {
  if (granularity === 'day') return name;
  const weekNum = parseIsoWeekNumberFromLabel(name);
  return weekNum != null ? formatIsoWeekLabel(weekNum) : name;
}

function formatActivityCount(typeLabel: string, value: number): string {
  const forms = ACTIVITY_COUNT_FORMS[typeLabel];
  const count = formatValue(value);
  if (!forms) {
    return value === 1 ? '1 actividad' : `${count} actividades`;
  }
  const word = value === 1 ? forms[0] : forms[1];
  return `${count} ${word}`;
}

interface ActivitiesByTypeWeeklyStackedChartProps {
  data: ActivitiesByTypeHeatmapData;
  scopeLabel?: string;
  className?: string;
  chartHeight?: number;
  showLegend?: boolean;
  axisGranularity?: 'week' | 'day';
}

export function ActivitiesByTypeWeeklyStackedChart({
  data,
  scopeLabel = 'Equipo completo',
  className,
  chartHeight = 380,
  showLegend = true,
  axisGranularity = 'week',
}: ActivitiesByTypeWeeklyStackedChartProps) {
  const chartTheme = useChartTheme();
  const isEmpty = !activitiesByTypeHeatmapHasData(data);

  const categories = useMemo(
    () => data.weeks.map((week) => formatCategoryLabel(week, axisGranularity)),
    [data.weeks, axisGranularity],
  );

  const series = useMemo(() => {
    const byName = new Map(data.series.map((row) => [row.name, row]));
    return ACTIVITY_SERIES.map((item) => ({
      name: item.label,
      data: data.weeks.map((weekName, weekIndex) => {
        const row = byName.get(item.label);
        return row?.data[weekIndex]?.y ?? 0;
      }),
    }));
  }, [data.series, data.weeks]);

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
      colors: ACTIVITY_SERIES.map((item) => item.color),
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: data.weeks.length > 8 ? '72%' : '55%',
          borderRadius: 10,
          borderRadiusApplication: 'end',
          borderRadiusWhenStacked: 'all',
          dataLabels: {
            total: {
              enabled: true,
              offsetY: -6,
              style: {
                fontSize: '12px',
                fontWeight: 700,
                color: chartTheme.isDark ? '#e2e8f0' : '#1e293b',
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
      legend: {
        show: showLegend,
        position: 'top',
        horizontalAlign: 'left',
        fontSize: '12px',
        fontWeight: 500,
        markers: { size: 6, shape: 'circle', offsetX: -2 },
        itemMargin: { horizontal: 14, vertical: 0 },
        labels: { colors: chartTheme.axisColor },
      },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 12, right: 8, bottom: 0, left: 4 },
      },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 600 },
        },
        tooltip: { enabled: false },
      },
      yaxis: {
        min: 0,
        tickAmount: 5,
        labels: {
          formatter: (value) => formatValue(Number(value)),
          style: { colors: chartTheme.axisColor, fontSize: '11px' },
        },
      },
      tooltip: {
        theme: chartTheme.isDark ? 'dark' : 'light',
        shared: true,
        intersect: false,
        x: {
          formatter: (_value, opts) => {
            const idx = (opts as { dataPointIndex?: number } | undefined)?.dataPointIndex;
            const week = idx != null ? (data.weeks[idx] ?? '') : '';
            return scopeLabel ? `${week}<br/><span style="font-size:10px;opacity:0.75">${scopeLabel}</span>` : week;
          },
        },
        y: {
          formatter: (value, opts) => {
            const seriesName = opts?.seriesIndex != null
              ? ACTIVITY_SERIES[opts.seriesIndex]?.label ?? 'Actividad'
              : 'Actividad';
            return formatActivityCount(seriesName, Number(value ?? 0));
          },
        },
      },
      fill: { opacity: 1 },
    }),
    [
      categories,
      chartTheme.axisColor,
      chartTheme.gridStroke,
      chartTheme.isDark,
      data.weeks,
      scopeLabel,
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
        style={{ minHeight: chartHeight }}
      >
        Sin actividades registradas en las últimas 6 semanas.
      </div>
    );
  }

  return (
    <div className={cn('w-full min-w-0', className)}>
      <Chart options={options} series={series} type="bar" height={chartHeight} />
    </div>
  );
}
