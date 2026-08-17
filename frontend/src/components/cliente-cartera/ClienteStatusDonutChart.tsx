import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  activo: '#22c55e',
  inactivo: '#94a3b8',
  potencial: '#2ECC87',
};

type StatusRow = {
  key: string;
  name: string;
  value: number;
};

interface ClienteStatusDonutChartProps {
  data: StatusRow[];
  height?: number;
  className?: string;
  showLegend?: boolean;
}

export function ClienteStatusDonutChart({
  data,
  height = 280,
  className,
  showLegend = true,
}: ClienteStatusDonutChartProps) {
  const chartTheme = useChartTheme();
  const series = useMemo(() => data.map((row) => row.value), [data]);
  const labels = useMemo(() => data.map((row) => row.name), [data]);
  const colors = useMemo(
    () => data.map((row) => STATUS_COLORS[row.key] ?? '#13944C'),
    [data],
  );
  const total = useMemo(
    () => series.reduce((sum, value) => sum + value, 0),
    [series],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'donut',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        background: 'transparent',
      },
      labels,
      colors,
      stroke: { width: 0 },
      dataLabels: { enabled: false },
      legend: {
        show: showLegend,
        position: 'bottom',
        fontSize: '12px',
        fontWeight: 500,
        markers: { size: 6, shape: 'circle', offsetX: -2 },
        labels: { colors: chartTheme.axisColor },
      },
      plotOptions: {
        pie: {
          donut: {
            size: '72%',
            labels: {
              show: true,
              name: {
                show: true,
                fontSize: '12px',
                color: chartTheme.axisColor,
              },
              value: {
                show: true,
                fontSize: '22px',
                fontWeight: 700,
                color: chartTheme.isDark ? '#f8fafc' : '#0f172a',
                formatter: (val) =>
                  Number(val).toLocaleString('es-PE'),
              },
              total: {
                show: true,
                label: 'Clientes',
                fontSize: '12px',
                color: chartTheme.axisColor,
                formatter: () => total.toLocaleString('es-PE'),
              },
            },
          },
        },
      },
      tooltip: {
        theme: chartTheme.isDark ? 'dark' : 'light',
        y: {
          formatter: (value) =>
            `${Number(value).toLocaleString('es-PE')} empresas`,
        },
      },
    }),
    [chartTheme, colors, labels, showLegend, total],
  );

  return (
    <div className={cn('w-full leading-none [&_.apexcharts-svg]:overflow-visible', className)}>
      <Chart options={options} series={series} type="donut" height={height} />
    </div>
  );
}
