import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';

export type AdvisorPerformanceRow = {
  name: string;
  contactos: number;
  oportunidades: number;
  empresas: number;
};

/** Verde oscuro → naranja → cyan (estilo chart apilado de referencia). */
const SERIES_COLORS = ['#0f766e', '#f59e0b', '#22d3ee'] as const;

interface AdvisorPerformanceBarChartProps {
  data: AdvisorPerformanceRow[];
  height?: number;
  showLegend?: boolean;
}

function truncateAdvisorName(name: string, max = 14): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function AdvisorPerformanceBarChart({
  data,
  height = 420,
  showLegend = true,
}: AdvisorPerformanceBarChartProps) {
  const chartTheme = useChartTheme();

  const categories = useMemo(
    () => data.map((row) => truncateAdvisorName(row.name)),
    [data],
  );

  const series = useMemo(
    () => [
      { name: 'Contactos', data: data.map((row) => row.contactos) },
      { name: 'Oportunidades', data: data.map((row) => row.oportunidades) },
      { name: 'Empresas', data: data.map((row) => row.empresas) },
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
      },
      colors: [...SERIES_COLORS],
      states: {
        hover: {
          filter: { type: 'darken', value: 0.82 },
        },
        active: {
          allowMultipleDataPointsSelection: false,
          filter: { type: 'darken', value: 0.78 },
        },
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '52%',
          borderRadius: 4,
          borderRadiusApplication: 'end',
          borderRadiusWhenStacked: 'last',
        },
      },
      stroke: { width: 0, colors: ['transparent'] },
      dataLabels: { enabled: false },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        crosshairs: {
          show: false,
        },
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 500 },
          rotate: categories.some((c) => c.length > 10) ? -25 : 0,
          trim: true,
        },
      },
      yaxis: {
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px' },
        },
      },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 0, right: 8, bottom: 0, left: 8 },
      },
      legend: {
        show: showLegend,
        position: 'bottom',
        horizontalAlign: 'center',
        fontSize: '12px',
        fontWeight: 500,
        markers: { size: 6, shape: 'circle', offsetX: -2 },
        itemMargin: { horizontal: 12, vertical: 4 },
        labels: { colors: chartTheme.axisColor },
        onItemHover: {
          highlightDataSeries: false,
        },
      },
      tooltip: {
        theme: chartTheme.tooltipBg === '#1e293b' ? 'dark' : 'light',
        shared: false,
        intersect: true,
        followCursor: false,
        onDatasetHover: {
          highlightDataSeries: false,
        },
        y: {
          formatter: (val) => (val == null ? '' : String(Math.round(Number(val)))),
        },
      },
      fill: { opacity: 1 },
    }),
    [categories, chartTheme, showLegend],
  );

  if (data.length === 0) {
    return null;
  }

  return (
    <Chart options={options} series={series} type="bar" height={height} />
  );
}
