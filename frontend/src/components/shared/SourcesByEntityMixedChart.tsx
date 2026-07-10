import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { cn } from '@/lib/utils';

export type SourceByEntityPoint = {
  name: string;
  contactos: number;
  empresas: number;
  oportunidades: number;
};

const CONTACTOS_COLOR = '#13944C';
const EMPRESAS_COLOR = '#34d399';
const OPORTUNIDADES_COLOR = '#065f46';

function formatTotal(n: number): string {
  return Math.round(n).toLocaleString('es-PE');
}

interface SourcesByEntityMixedChartProps {
  data: SourceByEntityPoint[];
  className?: string;
  height?: number;
  showLegendSummary?: boolean;
}

export function SourcesByEntityMixedChart({
  data,
  className,
  height = 350,
  showLegendSummary = true,
}: SourcesByEntityMixedChartProps) {
  const chartTheme = useChartTheme();

  const categories = useMemo(() => data.map((row) => row.name), [data]);
  const contactosSeries = useMemo(() => data.map((row) => row.contactos), [data]);
  const empresasSeries = useMemo(() => data.map((row) => row.empresas), [data]);
  const oportunidadesSeries = useMemo(() => data.map((row) => row.oportunidades), [data]);

  const totalContactos = useMemo(
    () => contactosSeries.reduce((sum, value) => sum + value, 0),
    [contactosSeries],
  );
  const totalEmpresas = useMemo(
    () => empresasSeries.reduce((sum, value) => sum + value, 0),
    [empresasSeries],
  );
  const totalOportunidades = useMemo(
    () => oportunidadesSeries.reduce((sum, value) => sum + value, 0),
    [oportunidadesSeries],
  );

  const series = useMemo(
    () => [
      { name: 'Contactos', type: 'column' as const, data: contactosSeries },
      { name: 'Empresas', type: 'area' as const, data: empresasSeries },
      { name: 'Oportunidades', type: 'line' as const, data: oportunidadesSeries },
    ],
    [contactosSeries, empresasSeries, oportunidadesSeries],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'line',
        stacked: false,
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        zoom: { enabled: false },
        background: 'transparent',
      },
      colors: [CONTACTOS_COLOR, EMPRESAS_COLOR, OPORTUNIDADES_COLOR],
      stroke: {
        width: [0, 2, 5],
        curve: 'smooth',
      },
      plotOptions: {
        bar: {
          columnWidth: '50%',
          borderRadius: 4,
          borderRadiusApplication: 'end',
        },
      },
      fill: {
        opacity: [0.85, 0.25, 1],
        gradient: {
          inverseColors: false,
          shade: 'light',
          type: 'vertical',
          opacityFrom: 0.85,
          opacityTo: 0.55,
          stops: [0, 100, 100, 100],
        },
      },
      dataLabels: { enabled: false },
      markers: { size: 0, hover: { size: 5 } },
      legend: { show: false },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 0, right: 8, bottom: 0, left: 4 },
      },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 500 },
          rotate: categories.some((label) => label.length > 10) ? -25 : 0,
          trim: true,
        },
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
          formatter: (value) => (value == null ? '' : formatTotal(Number(value))),
        },
      },
    }),
    [categories, chartTheme.axisColor, chartTheme.gridStroke, chartTheme.isDark],
  );

  const isEmpty =
    data.length === 0 ||
    (contactosSeries.every((value) => value === 0) &&
      empresasSeries.every((value) => value === 0) &&
      oportunidadesSeries.every((value) => value === 0));

  if (isEmpty) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-sm text-muted-foreground',
          className,
        )}
        style={{ height }}
      >
        Sin datos por fuente en este periodo.
      </div>
    );
  }

  return (
    <div className={cn('flex w-full flex-col', className)}>
      {showLegendSummary ? (
        <div className="mb-3 shrink-0 flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-muted-foreground">
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
              style={{ backgroundColor: OPORTUNIDADES_COLOR }}
            />
            Oportunidades{' '}
            <span className="font-semibold text-foreground">
              {formatTotal(totalOportunidades)}
            </span>
          </span>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 shrink-0 leading-none [&_.apexcharts-canvas]:!w-full [&_.apexcharts-svg]:overflow-visible">
        <Chart options={options} series={series} type="line" height={height} />
      </div>
    </div>
  );
}
