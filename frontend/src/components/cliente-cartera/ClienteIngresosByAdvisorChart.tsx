import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { formatCurrencyCompact } from '@/lib/formatters';
import { cn } from '@/lib/utils';

export type ClienteIngresosAdvisorRow = {
  advisorName: string;
  empresas: number;
  ingresos: number;
};

interface ClienteIngresosByAdvisorChartProps {
  data: ClienteIngresosAdvisorRow[];
  height?: number;
  className?: string;
}

function truncateAdvisorName(name: string, max = 16): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function ClienteIngresosByAdvisorChart({
  data,
  height = 320,
  className,
}: ClienteIngresosByAdvisorChartProps) {
  const chartTheme = useChartTheme();
  const rows = useMemo(() => data.slice(0, 12), [data]);
  const categories = useMemo(
    () => rows.map((row) => truncateAdvisorName(row.advisorName)),
    [rows],
  );
  const series = useMemo(
    () => [{ name: 'Ingresos', data: rows.map((row) => row.ingresos) }],
    [rows],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'bar',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        background: 'transparent',
      },
      colors: ['#13944C'],
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: rows.length > 8 ? '68%' : '52%',
          borderRadius: 6,
          borderRadiusApplication: 'end',
        },
      },
      dataLabels: { enabled: false },
      stroke: { width: 0 },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: true } },
        yaxis: { lines: { show: false } },
        padding: { top: 0, right: 12, bottom: 0, left: 4 },
      },
      xaxis: {
        categories,
        labels: {
          formatter: (value) => formatCurrencyCompact(Number(value)),
          style: { colors: chartTheme.axisColor, fontSize: '11px' },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 500 },
        },
      },
      tooltip: {
        theme: chartTheme.isDark ? 'dark' : 'light',
        y: {
          formatter: (value, opts) => {
            const row = rows[opts?.dataPointIndex ?? -1];
            const amount = formatCurrencyCompact(Number(value ?? 0));
            const empresas = row?.empresas ?? 0;
            return `${amount} · ${empresas} ${empresas === 1 ? 'empresa' : 'empresas'}`;
          },
        },
      },
    }),
    [categories, chartTheme, rows],
  );

  return (
    <div className={cn('w-full leading-none [&_.apexcharts-svg]:overflow-visible', className)}>
      <Chart options={options} series={series} type="bar" height={height} />
    </div>
  );
}
