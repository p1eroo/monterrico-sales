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
    }),
    [categories, chartTheme.axisColor, chartTheme.gridStroke, chartTheme.isDark],
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
        <div className="mb-6 flex flex-wrap items-end gap-6 sm:gap-10">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: CONTACTOS_COLOR }}
              />
              Contactos
            </div>
            <p className="text-xl font-medium tabular-nums tracking-tight">
              {formatTotal(totalContactos)}
            </p>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: OPORTUNIDADES_COLOR }}
              />
              Oportunidades
            </div>
            <p className="text-xl font-medium tabular-nums tracking-tight">
              {formatTotal(totalOportunidades)}
            </p>
          </div>
        </div>
      ) : null}
      <div className="shrink-0 pb-2 leading-none [&_.apexcharts-svg]:overflow-visible">
        <Chart options={options} series={series} type="area" height={height} />
      </div>
    </div>
  );
}
