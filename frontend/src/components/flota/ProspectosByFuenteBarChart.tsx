import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import type { ProspectosCountRow } from '@/lib/flotaProspectosReportUtils';
import { cn } from '@/lib/utils';

interface ProspectosByFuenteBarChartProps {
  rows: ProspectosCountRow[];
  className?: string;
  chartHeight?: number;
}

function resolveChartHeight(rowCount: number, explicit?: number): number {
  if (explicit != null) return explicit;
  const base = 300;
  const extra = Math.max(0, rowCount - 6) * 12;
  return Math.min(420, base + extra);
}

export function ProspectosByFuenteBarChart({
  rows,
  className,
  chartHeight,
}: ProspectosByFuenteBarChartProps) {
  const chartTheme = useChartTheme();
  const height = resolveChartHeight(rows.length, chartHeight);

  const categories = useMemo(() => rows.map((r) => r.name), [rows]);

  const series = useMemo(
    () => [
      {
        name: 'Prospectos',
        data: rows.map((r) => r.count),
      },
    ],
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
          borderRadius: 10,
          borderRadiusApplication: 'end',
          columnWidth: '50%',
        },
      },
      dataLabels: { enabled: false },
      stroke: { width: 0 },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        row: {
          colors: chartTheme.isDark
            ? ['transparent', 'rgba(148, 163, 184, 0.06)']
            : ['#ffffff', '#f2f2f2'],
        },
        padding: { top: 0, right: 12, bottom: 0, left: 12 },
      },
      xaxis: {
        categories,
        labels: {
          rotate: -45,
          rotateAlways: rows.length > 4,
          trim: true,
          hideOverlappingLabels: false,
          style: {
            colors: chartTheme.axisColor,
            fontSize: '11px',
            fontWeight: 500,
          },
        },
        tickPlacement: 'on',
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          style: {
            colors: chartTheme.axisColor,
            fontSize: '11px',
            fontWeight: 500,
          },
          formatter: (val: number) => Math.round(val).toLocaleString('es-PE'),
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'light',
          type: 'vertical',
          shadeIntensity: 0.35,
          gradientToColors: ['#22c55e'],
          inverseColors: false,
          opacityFrom: 0.95,
          opacityTo: 0.72,
          stops: [0, 100],
        },
      },
      tooltip: {
        theme: chartTheme.isDark ? 'dark' : 'light',
        y: {
          formatter: (val: number) =>
            val === 1 ? '1 prospecto' : `${val.toLocaleString('es-PE')} prospectos`,
        },
      },
      legend: { show: false },
    }),
    [categories, chartTheme.axisColor, chartTheme.gridStroke, chartTheme.isDark, rows.length],
  );

  if (rows.length === 0) return null;

  return (
    <div
      className={cn(
        'w-full leading-none [&_.apexcharts-svg]:overflow-visible',
        className,
      )}
    >
      <Chart
        options={options}
        series={series}
        type="bar"
        height={height}
      />
    </div>
  );
}
