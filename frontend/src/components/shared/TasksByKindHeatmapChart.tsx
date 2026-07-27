import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import {
  type TasksByKindHeatmapData,
  tasksByKindHeatmapHasData,
} from '@/lib/tasksByKindHeatmapUtils';
import { cn } from '@/lib/utils';

const HEATMAP_BASE = '#13944C';
const HEATMAP_EMPTY = '#eef2f6';

const TASK_COUNT_FORMS: Record<string, [singular: string, plural: string]> = {
  Llamadas: ['tarea de llamada', 'tareas de llamada'],
  Reuniones: ['tarea de reunión', 'tareas de reunión'],
  Correos: ['tarea de correo', 'tareas de correo'],
};

function formatTaskCount(typeLabel: string, value: number): string {
  const forms = TASK_COUNT_FORMS[typeLabel];
  const count = value.toLocaleString('es-PE');
  if (!forms) {
    return value === 1 ? '1 tarea' : `${count} tareas`;
  }
  const word = value === 1 ? forms[0] : forms[1];
  return `${count} ${word}`;
}

interface TasksByKindHeatmapChartProps {
  data: TasksByKindHeatmapData;
  scopeLabel?: string;
  className?: string;
  chartHeight?: number;
}

function resolveChartHeight(rowCount: number, explicit?: number): number {
  if (explicit != null) return explicit;
  const rowHeight = 42;
  const chrome = 64;
  return Math.max(200, Math.min(320, rowCount * rowHeight + chrome));
}

export function TasksByKindHeatmapChart({
  data,
  scopeLabel = 'Equipo completo',
  className,
  chartHeight,
}: TasksByKindHeatmapChartProps) {
  const chartTheme = useChartTheme();
  const isEmpty = !tasksByKindHeatmapHasData(data);
  const height = resolveChartHeight(data.series.length, chartHeight);

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'heatmap',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 400 },
        background: 'transparent',
      },
      colors: [HEATMAP_BASE],
      dataLabels: { enabled: false },
      stroke: {
        width: 2,
        colors: [chartTheme.isDark ? '#1f2937' : '#ffffff'],
      },
      plotOptions: {
        heatmap: {
          shadeIntensity: 0.72,
          radius: 4,
          enableShades: true,
          useFillColorAsStroke: false,
          colorScale: {
            ranges: [
              {
                from: 0,
                to: 0,
                color: chartTheme.isDark ? '#1e293b' : HEATMAP_EMPTY,
                foreColor: chartTheme.isDark ? '#64748b' : '#94a3b8',
                name: 'Sin tareas',
              },
              {
                from: 1,
                to: Math.max(1, data.maxCount),
                color: HEATMAP_BASE,
                name: 'Tareas',
              },
            ],
          },
        },
      },
      grid: {
        borderColor: chartTheme.gridStroke,
        padding: { top: 0, right: 8, bottom: 0, left: 4 },
      },
      xaxis: {
        type: 'category',
        categories: data.weeks,
        labels: {
          style: {
            colors: chartTheme.axisColor,
            fontSize: '11px',
            fontWeight: 600,
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false },
      },
      yaxis: {
        labels: {
          style: {
            colors: chartTheme.axisColor,
            fontSize: '11px',
            fontWeight: 600,
          },
          maxWidth: 120,
        },
      },
      legend: { show: false },
      tooltip: {
        theme: chartTheme.isDark ? 'dark' : 'light',
        custom: ({ seriesIndex, dataPointIndex }) => {
          const typeLabel = data.series[seriesIndex]?.name ?? 'Tarea';
          const week = data.weeks[dataPointIndex] ?? '';
          const value = Number(
            data.series[seriesIndex]?.data[dataPointIndex]?.y ?? 0,
          );
          const label = formatTaskCount(typeLabel, value);
          return `<div class="px-2.5 py-2 text-xs">
            <div class="font-semibold">${typeLabel}</div>
            <div class="text-muted-foreground">${week} · ${label}</div>
            <div class="mt-0.5 text-[10px] text-muted-foreground">${scopeLabel}</div>
          </div>`;
        },
      },
    }),
    [
      chartTheme.axisColor,
      chartTheme.gridStroke,
      chartTheme.isDark,
      data.maxCount,
      data.series,
      data.weeks,
      scopeLabel,
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
      <div className="shrink-0 leading-none [&_.apexcharts-svg]:overflow-visible">
        <Chart
          options={options}
          series={data.series}
          type="heatmap"
          height={height}
        />
      </div>
    </div>
  );
}
