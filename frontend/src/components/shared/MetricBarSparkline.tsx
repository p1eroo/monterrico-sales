import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { cn } from '@/lib/utils';

interface MetricBarSparklineProps {
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

export function MetricBarSparkline({
  data,
  labels,
  className,
  color = '#3b82f6',
}: MetricBarSparklineProps) {
  const chartWidth = useMemo(
    () => Math.max(96, Math.min(140, data.length * 11)),
    [data.length],
  );

  const weekLabels = useMemo(
    () => data.map((_, index) => weekTooltipLabel(labels, index)),
    [data, labels],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'bar',
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
      plotOptions: {
        bar: {
          columnWidth: '52%',
          borderRadius: 2,
          borderRadiusApplication: 'end',
        },
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        width: 0,
      },
      xaxis: {
        crosshairs: {
          width: 1,
        },
      },
      yaxis: {
        min: 0,
      },
      grid: {
        padding: {
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
        },
      },
      tooltip: {
        enabled: true,
        shared: false,
        intersect: true,
        followCursor: false,
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
    [chartWidth, color, weekLabels],
  );

  const series = useMemo(() => [{ data }], [data]);

  return (
    <div
      className={cn('h-[35px] shrink-0 overflow-visible', className)}
      style={{ width: chartWidth }}
    >
      <Chart options={options} series={series} type="bar" height={35} width={chartWidth} />
    </div>
  );
}
