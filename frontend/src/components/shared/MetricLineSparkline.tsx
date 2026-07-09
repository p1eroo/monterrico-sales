import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { cn } from '@/lib/utils';

interface MetricLineSparklineProps {
  data: number[];
  labels?: string[];
  className?: string;
  color?: string;
}

function weekTooltipLabel(labels: string[] | undefined, index: number): string {
  const raw = labels?.[index];
  if (raw != null && raw !== '') return `S${raw}`;
  return `S${index + 1}`;
}

export function MetricLineSparkline({
  data,
  labels,
  className,
  color = '#3b82f6',
}: MetricLineSparklineProps) {
  const chartWidth = 100;

  const weekLabels = useMemo(
    () => data.map((_, index) => weekTooltipLabel(labels, index)),
    [data, labels],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'line',
        width: chartWidth,
        height: 35,
        sparkline: {
          enabled: true,
        },
        animations: {
          enabled: false,
        },
        toolbar: {
          show: false,
        },
      },
      colors: [color],
      stroke: {
        width: 2,
        curve: 'straight',
      },
      tooltip: {
        enabled: true,
        fixed: {
          enabled: false,
        },
        x: {
          show: false,
        },
        y: {
          title: {
            formatter: () => '',
          },
        },
        marker: {
          show: false,
        },
        custom({ series, seriesIndex, dataPointIndex }) {
          const value = series[seriesIndex]?.[dataPointIndex];
          if (value == null) return '';
          const week = weekLabels[dataPointIndex] ?? `S${dataPointIndex + 1}`;
          const displayValue = String(Math.round(Number(value)));
          return (
            '<div style="border-radius:8px;overflow:hidden;box-shadow:0 4px 14px rgba(15,23,42,0.12);background:#fff;min-width:52px;font-family:inherit;">' +
            `<div style="background:#f1f5f9;padding:5px 10px;text-align:center;font-size:11px;font-weight:500;color:#64748b;line-height:1.2;">${week}</div>` +
            `<div style="padding:6px 10px;display:flex;align-items:center;justify-content:center;gap:6px;">` +
            `<span style="width:8px;height:8px;border-radius:9999px;background:${color};flex-shrink:0;"></span>` +
            `<span style="font-size:13px;font-weight:600;color:#1e293b;line-height:1;">${displayValue}</span>` +
            '</div></div>'
          );
        },
      },
    }),
    [color, weekLabels],
  );

  const series = useMemo(() => [{ data }], [data]);

  return (
    <div className={cn('h-[35px] w-[100px] shrink-0 overflow-visible', className)}>
      <Chart options={options} series={series} type="line" height={35} width={chartWidth} />
    </div>
  );
}
