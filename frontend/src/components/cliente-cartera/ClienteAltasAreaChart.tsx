import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { cn } from '@/lib/utils';

export type ClienteAltasMonthPoint = {
  name: string;
  empresas: number;
  contactos: number;
};

const EMPRESAS_COLOR = '#13944C';
const CONTACTOS_COLOR = '#6ee7b7';

function formatTotal(n: number): string {
  return Math.round(n).toLocaleString('es-PE');
}

interface ClienteAltasAreaChartProps {
  data: ClienteAltasMonthPoint[];
  className?: string;
  height?: number;
  showLegendSummary?: boolean;
}

export function ClienteAltasAreaChart({
  data,
  className,
  height = 300,
  showLegendSummary = true,
}: ClienteAltasAreaChartProps) {
  const chartTheme = useChartTheme();
  const categories = useMemo(() => data.map((d) => d.name), [data]);
  const empresasSeries = useMemo(() => data.map((d) => d.empresas), [data]);
  const contactosSeries = useMemo(() => data.map((d) => d.contactos), [data]);
  const totalEmpresas = useMemo(
    () => empresasSeries.reduce((sum, value) => sum + value, 0),
    [empresasSeries],
  );
  const totalContactos = useMemo(
    () => contactosSeries.reduce((sum, value) => sum + value, 0),
    [contactosSeries],
  );

  const dataMax = useMemo(() => {
    const values = [...empresasSeries, ...contactosSeries];
    return values.length > 0 ? Math.max(...values) : 0;
  }, [empresasSeries, contactosSeries]);

  const yAxisMax = useMemo(() => {
    if (dataMax <= 0) return 10;
    const padded = dataMax * 1.12;
    if (padded <= 50) return Math.ceil(padded / 10) * 10;
    if (padded <= 500) return Math.ceil(padded / 50) * 50;
    return Math.ceil(padded / 100) * 100;
  }, [dataMax]);

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'area',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        zoom: { enabled: false },
        offsetY: 0,
        parentHeightOffset: 0,
        background: 'transparent',
      },
      colors: [EMPRESAS_COLOR, CONTACTOS_COLOR],
      stroke: { curve: 'smooth', width: 2.5 },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: chartTheme.isDark ? 0.28 : 0.35,
          opacityTo: chartTheme.isDark ? 0.02 : 0.04,
          stops: [0, 90, 100],
        },
      },
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 4, right: 8, bottom: 8, left: 4 },
      },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          offsetY: 2,
          style: {
            colors: chartTheme.axisColor,
            fontSize: '11px',
            fontWeight: 500,
          },
        },
      },
      yaxis: {
        min: 0,
        max: yAxisMax,
        tickAmount: 4,
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
    }),
    [categories, chartTheme, yAxisMax],
  );

  const series = useMemo(
    () => [
      { name: 'Empresas', data: empresasSeries },
      { name: 'Contactos', data: contactosSeries },
    ],
    [empresasSeries, contactosSeries],
  );

  return (
    <div className={cn('flex h-full w-full flex-col', className)}>
      {showLegendSummary ? (
        <div className="mb-3 shrink-0 flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: EMPRESAS_COLOR }}
            />
            Empresas{' '}
            <span className="font-semibold text-foreground">
              {formatTotal(totalEmpresas)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: CONTACTOS_COLOR }}
            />
            Contactos{' '}
            <span className="font-semibold text-foreground">
              {formatTotal(totalContactos)}
            </span>
          </span>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 leading-none pb-1 [&_.apexcharts-canvas]:!w-full [&_.apexcharts-svg]:overflow-visible">
        <Chart options={options} series={series} type="area" height={height} />
      </div>
    </div>
  );
}
