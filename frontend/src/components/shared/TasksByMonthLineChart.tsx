import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { cn } from '@/lib/utils';

export type TasksByMonthPoint = {
  name: string;
  completados: number;
  pendientes: number;
};

const COMPLETADAS_COLOR = '#13944C';
const PENDIENTES_COLOR = '#86efac';

function formatTotal(n: number): string {
  return Math.round(n).toLocaleString('es-PE');
}

interface TasksByMonthLineChartProps {
  data: TasksByMonthPoint[];
  className?: string;
  height?: number;
  showLegendSummary?: boolean;
}

export function TasksByMonthLineChart({
  data,
  className,
  height = 350,
  showLegendSummary = true,
}: TasksByMonthLineChartProps) {
  const chartTheme = useChartTheme();
  const { isDark } = chartTheme;

  const categories = useMemo(() => data.map((row) => row.name), [data]);
  const completadasSeries = useMemo(
    () => data.map((row) => row.completados ?? 0),
    [data],
  );
  const pendientesSeries = useMemo(
    () => data.map((row) => row.pendientes ?? 0),
    [data],
  );

  const totalCompletadas = useMemo(
    () => completadasSeries.reduce((sum, value) => sum + value, 0),
    [completadasSeries],
  );
  const totalPendientes = useMemo(
    () => pendientesSeries.reduce((sum, value) => sum + value, 0),
    [pendientesSeries],
  );

  const series = useMemo(
    () => [
      { name: 'Completadas', data: completadasSeries },
      { name: 'Pendientes', data: pendientesSeries },
    ],
    [completadasSeries, pendientesSeries],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'line',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        zoom: { enabled: false },
        background: 'transparent',
      },
      colors: [COMPLETADAS_COLOR, PENDIENTES_COLOR],
      dataLabels: { enabled: false },
      stroke: {
        width: [5, 5],
        curve: 'straight',
        dashArray: [0, 8],
      },
      markers: {
        size: 0,
        hover: { sizeOffset: 6 },
      },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 8, right: 12, bottom: 0, left: 8 },
      },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 500 },
        },
      },
      yaxis: {
        min: 0,
        forceNiceScale: true,
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px' },
          formatter: (value) => String(Math.round(Number(value))),
        },
      },
      legend: { show: false },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        shared: true,
        intersect: false,
        y: {
          formatter: (value) => formatTotal(Number(value)),
        },
      },
    }),
    [categories, chartTheme.axisColor, chartTheme.gridStroke, isDark],
  );

  return (
    <div className={cn('flex w-full flex-col', className)}>
      {showLegendSummary ? (
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4 shrink-0 rounded-full"
              style={{ backgroundColor: COMPLETADAS_COLOR }}
            />
            Completadas{' '}
            <span className="font-semibold text-foreground">
              {formatTotal(totalCompletadas)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4 shrink-0"
              style={{
                backgroundImage: `repeating-linear-gradient(90deg, ${PENDIENTES_COLOR} 0 4px, transparent 4px 7px)`,
              }}
            />
            Pendientes{' '}
            <span className="font-semibold text-foreground">
              {formatTotal(totalPendientes)}
            </span>
          </span>
        </div>
      ) : null}
      <div className="shrink-0 leading-none [&_.apexcharts-svg]:overflow-visible">
        <Chart
          type="line"
          height={height}
          width="100%"
          series={series}
          options={options}
        />
      </div>
    </div>
  );
}
