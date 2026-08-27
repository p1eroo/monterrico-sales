import { useState, useEffect, useMemo, type ComponentType } from 'react';
import { Users, TrendingUp, MessageCircle } from 'lucide-react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { fetchFacebookStats, fetchMarketingLeadsByWeek, type FacebookStats, type MarketingLeadsByWeekRow } from '@/lib/marketingApi';
import {
  MarketingConversionRateSvgIcon,
  MarketingFormsSvgIcon,
  MarketingLeadsTodaySvgIcon,
  MarketingTotalLeadsSvgIcon,
} from '@/pages/marketing/MarketingDashboardKpiSvgIcons';
import { LeadsWeeklyStackedChart } from '@/pages/marketing/LeadsWeeklyStackedChart';
import { useChartTheme } from '@/hooks/useChartTheme';
import { cn } from '@/lib/utils';

const GREEN = '#13944C';
const BLUE = '#3b82f6';
const PIE_COLORS = ['#1DB954', '#2ECC87', '#064E31', '#52D68A', '#0E6B40', '#7AD9AE'];

const PLATFORM_COLORS: Record<string, string> = {
  fb: '#1877F2',
  ig: '#E4405F',
  an: '#f59e0b',
  msg: '#0084FF',
  unknown: '#94a3b8',
};

const campaignData = [
  { name: 'Activación Bono', leads: 45, conversion: 28 },
  { name: 'Captación Leads', leads: 23, conversion: 14 },
  { name: 'Recordatorio', leads: 12, conversion: 7 },
  { name: 'Oferta Especial', leads: 8, conversion: 3 },
];

const monthlyData = [
  { name: 'Ene', leads: 45, importados: 38 },
  { name: 'Feb', leads: 52, importados: 44 },
  { name: 'Mar', leads: 61, importados: 50 },
  { name: 'Abr', leads: 48, importados: 42 },
  { name: 'May', leads: 73, importados: 61 },
  { name: 'Jun', leads: 88, importados: 70 },
];

const chartWrapperClass =
  'min-w-0 w-full leading-none [&_.apexcharts-canvas]:!w-full [&_.apexcharts-svg]:overflow-visible';

const chartBase = {
  toolbar: { show: false },
  fontFamily: 'inherit',
  animations: { enabled: true, speed: 450 },
  background: 'transparent',
} as const;

const legendBase = {
  show: true,
  position: 'bottom' as const,
  horizontalAlign: 'center' as const,
  fontSize: '12px',
  fontWeight: 500,
  markers: { size: 6, shape: 'circle' as const, offsetX: -2 },
  itemMargin: { horizontal: 12, vertical: 4 },
  onItemHover: { highlightDataSeries: false },
};

function CampaignBarChart({ data }: { data: typeof campaignData }) {
  const chartTheme = useChartTheme();

  const categories = useMemo(() => data.map((d) => d.name), [data]);

  const series = useMemo(
    () => [
      { name: 'Leads', data: data.map((d) => d.leads) },
      { name: 'Conversiones', data: data.map((d) => d.conversion) },
    ],
    [data],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: { ...chartBase, type: 'bar' },
      colors: [GREEN, BLUE],
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '48%',
          borderRadius: 4,
          borderRadiusApplication: 'end',
        },
      },
      stroke: { width: 0, colors: ['transparent'] },
      dataLabels: { enabled: false },
      grid: {
        borderColor: chartTheme.gridStroke,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 0, right: 12, bottom: 0, left: 8 },
      },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 500 } },
      },
      yaxis: {
        labels: { style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 500 } },
      },
      legend: { ...legendBase, labels: { colors: chartTheme.axisColor } },
      tooltip: {
        theme: chartTheme.isDark ? 'dark' : 'light',
        shared: false,
        y: { formatter: (val) => (val == null ? '' : String(Math.round(Number(val)))) },
      },
      fill: { opacity: 1 },
    }),
    [categories, chartTheme.axisColor, chartTheme.gridStroke, chartTheme.isDark],
  );

  return (
    <div className={chartWrapperClass}>
      <Chart options={options} series={series} type="bar" height={288} />
    </div>
  );
}

function MonthlyTrendAreaChart({ data }: { data: typeof monthlyData }) {
  const chartTheme = useChartTheme();

  const categories = useMemo(() => data.map((d) => d.name), [data]);

  const series = useMemo(
    () => [
      { name: 'Leads', data: data.map((d) => d.leads) },
      { name: 'Importados', data: data.map((d) => d.importados) },
    ],
    [data],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: { ...chartBase, type: 'area', zoom: { enabled: false }, parentHeightOffset: 0 },
      colors: [GREEN, BLUE],
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
        labels: { style: { colors: chartTheme.axisColor, fontSize: '11px', fontWeight: 500 } },
      },
      yaxis: {
        labels: { style: { colors: chartTheme.axisColor, fontSize: '11px' } },
      },
      legend: { ...legendBase, labels: { colors: chartTheme.axisColor } },
      tooltip: {
        theme: chartTheme.isDark ? 'dark' : 'light',
        shared: true,
        intersect: false,
        y: { formatter: (val) => (val == null ? '' : String(Math.round(Number(val)))) },
      },
    }),
    [categories, chartTheme.axisColor, chartTheme.gridStroke, chartTheme.isDark],
  );

  return (
    <div className={chartWrapperClass}>
      <Chart options={options} series={series} type="area" height={288} />
    </div>
  );
}

function SourceDonutChart({ data }: { data: { key: string; name: string; value: number }[] }) {
  const chartTheme = useChartTheme();

  const labels = useMemo(() => data.map((d) => d.name), [data]);
  const series = useMemo(() => data.map((d) => d.value), [data]);
  const colors = useMemo(
    () => data.map((d, i) => PLATFORM_COLORS[d.key] ?? PIE_COLORS[i % PIE_COLORS.length]),
    [data],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: { ...chartBase, type: 'donut' },
      colors,
      labels,
      stroke: { width: 0, colors: ['transparent'] },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${Math.round(Number(val))}%`,
        style: {
          fontSize: '12px',
          fontWeight: 600,
          colors: [chartTheme.isDark ? '#f8fafc' : '#334155'],
        },
        dropShadow: { enabled: false },
      },
      plotOptions: {
        pie: {
          expandOnClick: false,
          donut: {
            size: '62%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Total',
                fontSize: '12px',
                fontWeight: 600,
                color: chartTheme.axisColor,
                formatter: (w) => {
                  const total = w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
                  return String(Math.round(total));
                },
              },
              value: {
                fontSize: '22px',
                fontWeight: 700,
                color: chartTheme.isDark ? '#f8fafc' : '#0f172a',
              },
            },
          },
        },
      },
      legend: { show: false },
      tooltip: {
        theme: chartTheme.isDark ? 'dark' : 'light',
        y: { formatter: (val) => (val == null ? '' : String(Math.round(Number(val)))) },
      },
    }),
    [colors, labels, chartTheme.axisColor, chartTheme.isDark],
  );

  return (
    <div className={cn(chartWrapperClass, 'flex items-center justify-center')}>
      <Chart options={options} series={series} type="donut" height={288} />
    </div>
  );
}

export default function MarketingDashboard() {
  const [stats, setStats] = useState<FacebookStats | null>(null);
  const [weeklyLeads, setWeeklyLeads] = useState<MarketingLeadsByWeekRow[]>([]);
  const [weeklyLoading, setWeeklyLoading] = useState(true);

  useEffect(() => {
    fetchFacebookStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    fetchMarketingLeadsByWeek(8)
      .then((res) => setWeeklyLeads(res.weeks))
      .catch(() => {})
      .finally(() => setWeeklyLoading(false));
  }, []);

  const sourceData = useMemo(
    () => (stats?.byPlatform ?? []).filter((s) => s.value > 0),
    [stats],
  );

  const conversionRate = stats && stats.total > 0
    ? ((stats.today / stats.total) * 100).toFixed(0) + '%'
    : '0%';

  const kpis: Array<{
    label: string;
    value: string | number;
    icon: ComponentType<{ className?: string }>;
    color: string;
  }> = [
    {
      label: 'Total Leads',
      value: stats?.total ?? 0,
      icon: MarketingTotalLeadsSvgIcon,
      color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/15',
    },
    {
      label: 'Leads Hoy',
      value: stats?.today ?? 0,
      icon: MarketingLeadsTodaySvgIcon,
      color: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/15',
    },
    {
      label: 'Tasa Conversión',
      value: conversionRate,
      icon: MarketingConversionRateSvgIcon,
      color: 'text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-500/15',
    },
    {
      label: 'Formularios',
      value: stats?.formsCount ?? 0,
      icon: MarketingFormsSvgIcon,
      color: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/15',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Marketing" description="Panel de leads y rendimiento de campañas" />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={cn('flex size-11 items-center justify-center rounded-xl', c.color)}>
                  <Icon className="size-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-bold">{c.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row 1: Daily leads + Campaigns bar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads y contactados por semana</CardTitle>
            <CardDescription>Flota y Comercial · últimas 8 semanas</CardDescription>
          </CardHeader>
          <CardContent>
            {weeklyLoading ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                Cargando…
              </div>
            ) : (
              <LeadsWeeklyStackedChart data={weeklyLeads} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Rendimiento por campaña</CardTitle>
            <CardDescription>Leads generados vs convertidos</CardDescription>
          </CardHeader>
          <CardContent>
            <CampaignBarChart data={campaignData} />
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Monthly trend + Source donut */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tendencia mensual</CardTitle>
            <CardDescription>Leads vs importados por mes</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyTrendAreaChart data={monthlyData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads por fuente</CardTitle>
            <CardDescription>Facebook vs Instagram (según Meta)</CardDescription>
          </CardHeader>
          <CardContent>
            {sourceData.length === 0 ? (
              <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                Aún no hay leads con fuente. Sincroniza los formularios.
              </p>
            ) : (
              <SourceDonutChart data={sourceData} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom: conversion rate card */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[
          { label: 'Tasa de contacto', value: '72%', desc: 'De los leads, el 72% fue contactado exitosamente', icon: MessageCircle, color: 'text-blue-600' },
          { label: 'Costo por lead', value: 'S/ 3.20', desc: 'Costo promedio por lead generado en campañas', icon: TrendingUp, color: 'text-emerald-600' },
          { label: 'Leads calificados', value: '58%', desc: 'Porcentaje de leads que cumplen los requisitos', icon: Users, color: 'text-violet-600' },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <c.icon className={`size-8 ${c.color}`} />
                <div>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-bold">{c.value}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{c.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
