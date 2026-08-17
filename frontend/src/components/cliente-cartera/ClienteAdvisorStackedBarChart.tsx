import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { cn } from '@/lib/utils';

export type ClienteAdvisorStackRow = {
  advisorName: string;
  empresas: number;
  contactos: number;
  tareas: number;
};

const SERIES_COLORS = ['#0f766e', '#22c55e', '#6ee7b7'] as const;

interface ClienteAdvisorStackedBarChartProps {
  data: ClienteAdvisorStackRow[];
  height?: number;
  showLegend?: boolean;
  className?: string;
}

function truncateAdvisorName(name: string, max = 14): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function ClienteAdvisorStackedBarChart({
  data,
  height = 320,
  showLegend = true,
  className,
}: ClienteAdvisorStackedBarChartProps) {
  const chartTheme = useChartTheme();
  const rows = useMemo(() => data.slice(0, 12), [data]);
  const categories = useMemo(
    () => rows.map((row) => truncateAdvisorName(row.advisorName)),
    [rows],
  );
  const series = useMemo(
    () => [
      { name: 'Empresas', data: rows.map((row) => row.empresas) },
      { name: 'Contactos', data: rows.map((row) => row.contactos) },
      { name: 'Tareas', data: rows.map((row) => row.tareas) },
    ],
    [rows],
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
      colors: [...SERIES_COLORS],
      plotOptions: {
        bar: {
          columnWidth: rows.length > 8 ? '68%' : '52%',
          borderRadius: 4,
          borderRadiusApplication: 'end',
          borderRadiusWhenStacked: 'last',
        },
      },
      stroke: { width: 0, colors: ['transparent'] },
      dataLabels: { enabled: false },
      legend: {
        show: showLegend,
        position: 'top',
        horizontalAlign: 'left',
        fontSize: '12px',
        fontWeight: 500,
        markers: { size: 6, shape: 'circle', offsetX: -2 },
        labels: { colors: chartTheme.axisColor },
      },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 500 },
          rotate: categories.some((c) => c.length > 10) ? -25 : 0,
          trim: true,
        },
      },
      yaxis: {
        min: 0,
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px' },
        },
      },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
      },
      tooltip: {
        theme: chartTheme.isDark ? 'dark' : 'light',
        shared: true,
        intersect: false,
      },
    }),
    [categories, chartTheme, rows.length, showLegend],
  );

  return (
    <div className={cn('w-full leading-none [&_.apexcharts-svg]:overflow-visible', className)}>
      <Chart options={options} series={series} type="bar" height={height} />
    </div>
  );
}
