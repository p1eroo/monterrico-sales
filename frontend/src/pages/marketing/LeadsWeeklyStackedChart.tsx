'use client';

import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { cn } from '@/lib/utils';
import {
  formatIsoWeekLabel,
  isoWeekNumberLima,
  parseDayStartLima,
} from '@/lib/crmTimezone';
import type { MarketingLeadsByWeekRow } from '@/lib/marketingApi';

const SERIES_COLORS = {
  leads: '#13944C',
  contactados: '#3b82f6',
} as const;

export function LeadsWeeklyStackedChart({
  data,
  className,
  height = 288,
  emptyMessage = 'Sin datos de leads en este periodo.',
}: {
  data: MarketingLeadsByWeekRow[];
  className?: string;
  height?: number;
  emptyMessage?: string;
}) {
  const chartTheme = useChartTheme();

  const categories = useMemo(
    () =>
      data.map((row) => {
        try {
          return formatIsoWeekLabel(isoWeekNumberLima(parseDayStartLima(row.date)));
        } catch {
          return row.date;
        }
      }),
    [data],
  );

  const series = useMemo(
    () => [
      { name: 'Leads', data: data.map((row) => row.leads) },
      { name: 'Contactados', data: data.map((row) => row.contactados) },
    ],
    [data],
  );

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
      colors: [SERIES_COLORS.leads, SERIES_COLORS.contactados],
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: data.length > 14 ? '68%' : '50%',
          borderRadius: 6,
          borderRadiusApplication: 'end',
          borderRadiusWhenStacked: 'all',
        },
      },
      stroke: { width: 0, colors: ['transparent'] },
      dataLabels: { enabled: false },
      legend: {
        show: true,
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
        padding: { top: 4, right: 8, bottom: 0, left: 4 },
      },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          hideOverlappingLabels: true,
          style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 500 },
        },
        tooltip: { enabled: false },
      },
      yaxis: {
        min: 0,
        tickAmount: 5,
        labels: {
          formatter: (value) => String(Math.round(Number(value))),
          style: { colors: chartTheme.axisColor, fontSize: '11px' },
        },
      },
      tooltip: {
        theme: chartTheme.isDark ? 'dark' : 'light',
        shared: true,
        intersect: false,
        y: {
          formatter: (value) => (value == null ? '' : String(Math.round(Number(value)))),
        },
      },
      fill: { opacity: 1 },
    }),
    [categories, chartTheme.axisColor, chartTheme.gridStroke, chartTheme.isDark, data.length],
  );

  const isEmpty =
    data.length === 0 ||
    data.every((row) => row.leads === 0 && row.contactados === 0);

  if (isEmpty) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-sm text-muted-foreground',
          className,
        )}
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('w-full min-w-0', className)}>
      <Chart options={options} series={series} type="bar" height={height} />
    </div>
  );
}
