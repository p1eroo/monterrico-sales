import { useEffect, useMemo, useRef } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { buildAdvisorStackedBarTooltipHtml } from '@/lib/advisorStackedBarTooltip';
import {
  type TasksByAdvisorStackedData,
  type TasksByAdvisorStackedRow,
  tasksByAdvisorStackedHasData,
} from '@/lib/tasksByAdvisorStackedUtils';
import { cn } from '@/lib/utils';

const TASK_SERIES = [
  { key: 'llamadas' as const, label: 'Llamadas', color: '#13944C' },
  { key: 'reuniones' as const, label: 'Reuniones', color: '#34d399' },
  { key: 'correos' as const, label: 'Correos', color: '#065f46' },
] as const;

const TASK_COUNT_BY_LABEL: Record<string, [singular: string, plural: string]> = {
  Llamadas: ['tarea de llamada', 'tareas de llamada'],
  Reuniones: ['tarea de reunión', 'tareas de reunión'],
  Correos: ['tarea de correo', 'tareas de correo'],
};

function formatValue(n: number): string {
  return Math.round(n).toLocaleString('es-PE');
}

function formatTaskCountByLabel(label: string, value: number): string {
  const forms = TASK_COUNT_BY_LABEL[label];
  const count = formatValue(value);
  if (!forms) return `${count} tarea${value === 1 ? '' : 's'}`;
  const word = value === 1 ? forms[0] : forms[1];
  return `${count} ${word}`;
}

function resolveChartHeight(advisorCount: number, explicit?: number): number {
  if (explicit != null) return explicit;
  const rowHeight = 44;
  const chrome = 72;
  return Math.max(200, Math.min(420, advisorCount * rowHeight + chrome));
}

interface TasksByAdvisorStackedBarChartProps {
  data: TasksByAdvisorStackedData;
  className?: string;
  chartHeight?: number;
  showLegend?: boolean;
  onAdvisorSelect?: (advisor: TasksByAdvisorStackedRow) => void;
}

export function TasksByAdvisorStackedBarChart({
  data,
  className,
  chartHeight,
  showLegend = true,
  onAdvisorSelect,
}: TasksByAdvisorStackedBarChartProps) {
  const chartTheme = useChartTheme();
  const hoverIndexRef = useRef(-1);
  const onAdvisorSelectRef = useRef(onAdvisorSelect);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  onAdvisorSelectRef.current = onAdvisorSelect;

  useEffect(() => {
    if (!onAdvisorSelect) return;
    const root = chartWrapRef.current;
    if (!root) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const label = target?.closest('.apexcharts-yaxis-label');
      if (!label || !root.contains(label)) return;
      const labels = root.querySelectorAll('.apexcharts-yaxis-label');
      const index = Array.from(labels).indexOf(label);
      const advisor = data.advisors[index];
      if (advisor && advisor.total > 0) {
        onAdvisorSelect(advisor);
      }
    };

    root.addEventListener('click', handleClick);
    return () => root.removeEventListener('click', handleClick);
  }, [data.advisors, onAdvisorSelect]);

  const isEmpty = !tasksByAdvisorStackedHasData(data);
  const height = resolveChartHeight(data.advisors.length, chartHeight);

  const categories = useMemo(
    () => data.advisors.map((row) => row.advisorName),
    [data.advisors],
  );

  const series = useMemo(
    () =>
      TASK_SERIES.map((item) => ({
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
        events: onAdvisorSelect
          ? {
              mouseMove(_event, _chartContext, config) {
                if (!config) return;
                const idx = config.dataPointIndex;
                if (idx != null && idx >= 0) hoverIndexRef.current = idx;
              },
              click(_event, _chartContext, config) {
                if (!config || !onAdvisorSelectRef.current) return;
                const idx =
                  config.dataPointIndex >= 0
                    ? config.dataPointIndex
                    : hoverIndexRef.current;
                const advisor = data.advisors[idx];
                if (advisor && advisor.total > 0) {
                  onAdvisorSelectRef.current(advisor);
                }
              },
              dataPointSelection(_event, _chartContext, config) {
                if (!config || !onAdvisorSelectRef.current) return;
                const idx = config.dataPointIndex;
                const advisor = data.advisors[idx ?? -1];
                if (advisor && advisor.total > 0) {
                  onAdvisorSelectRef.current(advisor);
                }
              },
            }
          : {},
      },
      colors: TASK_SERIES.map((item) => item.color),
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
            seriesItems: TASK_SERIES.map((item) => ({
              name: item.label,
              value: advisor[item.key],
              formatValue: formatTaskCountByLabel,
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
      data.advisors,
      data.weekLabel,
      onAdvisorSelect,
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
        Sin tareas registradas en las últimas 6 semanas.
      </div>
    );
  }

  return (
    <div className={cn('flex w-full flex-col', className)}>
      {onAdvisorSelect ? (
        <p className="mb-2 text-[11px] text-muted-foreground">
          Clic en un asesor para ver el detalle por empresa, contacto y oportunidad.
        </p>
      ) : null}
      <div
        ref={chartWrapRef}
        className={cn(
          'shrink-0 leading-none [&_.apexcharts-svg]:overflow-visible',
          onAdvisorSelect &&
            '[&_.apexcharts-bar-area]:cursor-pointer [&_.apexcharts-yaxis-label]:cursor-pointer',
        )}
      >
        <Chart options={options} series={series} type="bar" height={height} />
      </div>
    </div>
  );
}
