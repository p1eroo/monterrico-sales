import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { cn } from '@/lib/utils';

export type ContactsOpportunitiesMonthPoint = {
  name: string;
  contactos: number;
  oportunidades: number;
};

const CONTACTOS_COLOR = '#13944C';
const OPORTUNIDADES_COLOR = '#6ee7b7';

function formatTotal(n: number): string {
  return Math.round(n).toLocaleString('es-PE');
}

interface ContactsOpportunitiesAreaChartProps {
  data: ContactsOpportunitiesMonthPoint[];
  className?: string;
  height?: number;
  showLegendSummary?: boolean;
}

export function ContactsOpportunitiesAreaChart({
  data,
  className,
  height = 300,
  showLegendSummary = true,
}: ContactsOpportunitiesAreaChartProps) {
  const chartTheme = useChartTheme();
  const categories = useMemo(() => data.map((d) => d.name), [data]);
  const contactosSeries = useMemo(() => data.map((d) => d.contactos), [data]);
  const oportunidadesSeries = useMemo(() => data.map((d) => d.oportunidades), [data]);
  const totalContactos = useMemo(
    () => contactosSeries.reduce((sum, value) => sum + value, 0),
    [contactosSeries],
  );
  const totalOportunidades = useMemo(
    () => oportunidadesSeries.reduce((sum, value) => sum + value, 0),
    [oportunidadesSeries],
  );

  const dataMax = useMemo(() => {
    const values = [...contactosSeries, ...oportunidadesSeries];
    return values.length > 0 ? Math.max(...values) : 0;
  }, [contactosSeries, oportunidadesSeries]);

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
      colors: [CONTACTOS_COLOR, OPORTUNIDADES_COLOR],
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
        padding: { top: 0, right: 4, bottom: -6, left: 4 },
      },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          offsetY: -2,
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
    [categories, chartTheme.axisColor, chartTheme.gridStroke, chartTheme.isDark, yAxisMax],
  );

  const series = useMemo(
    () => [
      { name: 'Contactos', data: contactosSeries },
      { name: 'Oportunidades', data: oportunidadesSeries },
    ],
    [contactosSeries, oportunidadesSeries],
  );

  const isEmpty =
    data.length === 0 ||
    (contactosSeries.every((value) => value === 0) &&
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
        Sin contactos ni oportunidades en el año.
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
              style={{ backgroundColor: OPORTUNIDADES_COLOR }}
            />
            Oportunidades{' '}
            <span className="font-semibold text-foreground">
              {formatTotal(totalOportunidades)}
            </span>
          </span>
        </div>
      ) : null}
      <div className="min-h-0 shrink-0 leading-none [&_.apexcharts-canvas]:!w-full [&_.apexcharts-svg]:overflow-visible">
        <Chart options={options} series={series} type="area" height={height} />
      </div>
    </div>
  );
}
