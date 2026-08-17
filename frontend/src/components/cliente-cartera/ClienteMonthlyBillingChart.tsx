import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { formatCurrencyCompact } from '@/lib/formatters';
import { ESTIMATED_BILLING_WEEKLY_CHART } from '@/lib/reportsWeeklyMetricChartColors';
import { cn } from '@/lib/utils';

type BillingRow = { name: string; amount: number };

interface ClienteMonthlyBillingChartProps {
  data: BillingRow[];
  height?: number;
  className?: string;
}

export function ClienteMonthlyBillingChart({
  data,
  height = 280,
  className,
}: ClienteMonthlyBillingChartProps) {
  const chartTheme = useChartTheme();
  const categories = useMemo(() => data.map((row) => row.name), [data]);
  const series = useMemo(
    () => [{ name: 'Facturación', data: data.map((row) => row.amount) }],
    [data],
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
      colors: [ESTIMATED_BILLING_WEEKLY_CHART.bar],
      plotOptions: {
        bar: {
          columnWidth: data.length > 6 ? '58%' : '42%',
          borderRadius: 8,
          borderRadiusApplication: 'end',
        },
      },
      dataLabels: { enabled: false },
      stroke: { width: 0 },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 8, right: 8, bottom: 0, left: 4 },
      },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 600 },
        },
      },
      yaxis: {
        min: 0,
        labels: {
          formatter: (value) => formatCurrencyCompact(Number(value)),
          style: { colors: chartTheme.axisColor, fontSize: '11px' },
        },
      },
      tooltip: {
        theme: chartTheme.isDark ? 'dark' : 'light',
        y: {
          formatter: (value) => formatCurrencyCompact(Number(value ?? 0)),
        },
      },
    }),
    [categories, chartTheme, data.length],
  );

  return (
    <div className={cn('w-full leading-none [&_.apexcharts-svg]:overflow-visible', className)}>
      <Chart options={options} series={series} type="bar" height={height} />
    </div>
  );
}
