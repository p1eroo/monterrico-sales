import { useState, useEffect, useMemo } from 'react';
import type { DateRange } from 'react-day-picker';
import { useUsers } from '@/hooks/useUsers';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  FileText, FileSpreadsheet, FileDown,
  TrendingUp, Target, DollarSign, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { useChartTheme } from '@/hooks/useChartTheme';
import { formatCurrency } from '@/lib/formatters';
import { usePermissions } from '@/hooks/usePermissions';
import { contactSourceLabels } from '@/data/mock';
import {
  fetchAnalyticsSummary,
  analyticsRangeFromPreset,
  type AnalyticsSummary,
} from '@/lib/analyticsApi';
import {
  useCrmConfigStore,
  getSourceLabelFromCatalog,
  getStageLabelFromCatalog,
} from '@/store/crmConfigStore';

const COLORS = ['#13944C', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

const sourceOptions = [
  { value: 'all', label: 'Todas las fuentes' },
  { value: 'web', label: 'Web' },
  { value: 'referido', label: 'Referidos' },
  { value: 'evento', label: 'Eventos' },
  { value: 'redes_sociales', label: 'Redes Sociales' },
  { value: 'llamada', label: 'Llamadas' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
];

function handleExport(format: string) {
  toast.info(`Exportación en ${format}`, {
    description: 'La descarga comenzará en breve...',
  });
}

function changeTone(s: string): 'positive' | 'negative' | 'neutral' {
  const t = s.trim();
  if (t.startsWith('-')) return 'negative';
  if (t.startsWith('+')) return 'positive';
  return 'neutral';
}

type DateRangePreset = '7d' | '1m' | '3m' | '1y' | 'custom';

export default function Reports() {
  const { activeUsers } = useUsers();
  const { hasPermission } = usePermissions();
  const bundle = useCrmConfigStore((s) => s.bundle);
  const [dateRange, setDateRange] = useState<DateRangePreset>('3m');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [advisorFilter, setAdvisorFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const chartTheme = useChartTheme();

  useEffect(() => {
    if (dateRange === 'custom' && (!customRange?.from || !customRange?.to)) {
      setSummary(null);
      return;
    }
    const { from, to } = analyticsRangeFromPreset(dateRange, customRange);
    const advisorId = advisorFilter !== 'all' ? advisorFilter : undefined;
    const source = sourceFilter !== 'all' ? sourceFilter : undefined;
    let cancelled = false;
    setLoading(true);
    void fetchAnalyticsSummary({ from, to, advisorId, source })
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateRange, customRange?.from, customRange?.to, advisorFilter, sourceFilter]);

  const leadsBySourceData = useMemo(() => {
    if (!summary) return [];
    return summary.contactsBySource.map((x) => ({
      ...x,
      name: getSourceLabelFromCatalog(x.name, bundle, contactSourceLabels),
    }));
  }, [summary, bundle]);

  const opportunitiesByStageData = useMemo(() => {
    if (!summary) return [];
    return summary.opportunitiesByStageData.map((x) => ({
      ...x,
      name: getStageLabelFromCatalog(x.name, bundle),
    }));
  }, [summary, bundle]);

  const kpis = summary?.kpis;
  const leadsByPeriodData = summary?.contactsByPeriod ?? [];
  const conversionData = summary?.conversionByMonth ?? [];
  const activitiesByTypeData = summary?.activitiesByTypeData ?? [];
  const followUpsData = summary?.followUpsByMonth ?? [];
  const salesByMonthData = summary?.salesByMonth ?? [];
  const performanceByAdvisor = summary?.performanceByAdvisor ?? [];

  const summaryCards = useMemo(
    () => [
      {
        label: 'Total Contactos del Periodo',
        value: kpis ? String(kpis.totalContacts) : '—',
        icon: TrendingUp,
        color: 'text-primary',
        bg: 'bg-primary/10',
        trend: kpis
          ? `${kpis.changes.contacts} vs periodo anterior`
          : '—',
        trendType: kpis ? changeTone(kpis.changes.contacts) : 'neutral' as const,
      },
      {
        label: 'Tasa de Conversión',
        value: kpis ? `${kpis.conversionPct}%` : '—',
        icon: Target,
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-900/30',
        trend: 'En el periodo seleccionado',
        trendType: 'neutral' as const,
      },
      {
        label: 'Ventas Cerradas',
        value: kpis ? formatCurrency(kpis.closedSalesAmount) : '—',
        icon: DollarSign,
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-900/30',
        trend: kpis
          ? `${kpis.changes.sales} vs periodo anterior`
          : '—',
        trendType: kpis ? changeTone(kpis.changes.sales) : 'neutral',
      },
      {
        label: 'Actividades Realizadas',
        value: kpis ? String(kpis.activitiesCompleted) : '—',
        icon: Activity,
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-900/30',
        trend: 'Completadas en el periodo',
        trendType: 'neutral' as const,
      },
    ],
    [kpis],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Reportes" description="Análisis y métricas del rendimiento comercial" />

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangePreset)}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 días</SelectItem>
              <SelectItem value="1m">Último mes</SelectItem>
              <SelectItem value="3m">Últimos 3 meses</SelectItem>
              <SelectItem value="1y">Este año</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {dateRange === 'custom' && (
            <DateRangePicker
              value={customRange}
              onChange={setCustomRange}
              placeholder="Seleccionar rango"
            />
          )}
          {loading && (
            <span className="text-xs text-muted-foreground">Cargando…</span>
          )}
        </div>

        <Select value={advisorFilter} onValueChange={setAdvisorFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los asesores</SelectItem>
            {activeUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sourceOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasPermission('reportes.exportar') && (
          <div className="flex gap-2 md:ml-auto">
            <Button variant="outline" size="sm" onClick={() => handleExport('PDF')}>
              <FileText className="mr-1.5 size-4" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('Excel')}>
              <FileSpreadsheet className="mr-1.5 size-4" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('CSV')}>
              <FileDown className="mr-1.5 size-4" />
              CSV
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="py-0">
            <CardContent className="px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <div className={`flex size-10 items-center justify-center rounded-lg ${card.bg}`}>
                  <card.icon className={`size-5 ${card.color}`} />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold">{card.value}</p>
              <p
                className={`mt-1 text-xs ${
                  card.trendType === 'positive'
                    ? 'text-emerald-600'
                    : card.trendType === 'negative'
                      ? 'text-red-600'
                      : 'text-muted-foreground'
                }`}
              >
                {card.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 1. Contactos por Periodo - AreaChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contactos por Periodo</CardTitle>
            <CardDescription>Evolución de captación de contactos en el tiempo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={leadsByPeriodData}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#13944C" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#13944C" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorNuevos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: `1px solid ${chartTheme.tooltipBorder}`,
                    backgroundColor: chartTheme.tooltipBg,
                    fontSize: '13px',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="leads"
                  name="Total Contactos"
                  stroke="#13944C"
                  strokeWidth={2}
                  fill="url(#colorLeads)"
                />
                <Area
                  type="monotone"
                  dataKey="nuevos"
                  name="Nuevos"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#colorNuevos)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 2. Contactos por Fuente - PieChart Donut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contactos por Fuente</CardTitle>
            <CardDescription>Distribución de contactos según canal de origen</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={leadsBySourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={{ strokeWidth: 1 }}
                  style={{ fontSize: '11px' }}
                >
                  {leadsBySourceData.map((_entry, index) => (
                    <Cell key={`cell-source-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: `1px solid ${chartTheme.tooltipBorder}`,
                    backgroundColor: chartTheme.tooltipBg,
                    fontSize: '13px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 3. Tasa de Conversión - LineChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasa de Conversión</CardTitle>
            <CardDescription>Porcentaje de conversión mensual de contactos a clientes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={conversionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: `1px solid ${chartTheme.tooltipBorder}`,
                    backgroundColor: chartTheme.tooltipBg,
                    fontSize: '13px',
                  }}
                  formatter={(value?: number) => [`${(value ?? 0)}%`, 'Conversión']}
                />
                <Line
                  type="monotone"
                  dataKey="tasa"
                  name="Tasa de Conversión"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 4. Rendimiento por Asesor - Horizontal BarChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rendimiento por Asesor</CardTitle>
            <CardDescription>Contactos asignados y ventas cerradas por ejecutivo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceByAdvisor} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartTheme.gridStroke} />
                <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: `1px solid ${chartTheme.tooltipBorder}`,
                    backgroundColor: chartTheme.tooltipBg,
                    fontSize: '13px',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="leads" name="Contactos" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14} />
                <Bar dataKey="ventas" name="Ventas" fill="#13944C" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 5. Ventas Cerradas por Mes - BarChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas Cerradas por Mes</CardTitle>
            <CardDescription>Ingresos mensuales vs meta establecida</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesByMonthData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: `1px solid ${chartTheme.tooltipBorder}`,
                    backgroundColor: chartTheme.tooltipBg,
                    fontSize: '13px',
                  }}
                  formatter={(value?: number) => [formatCurrency(value ?? 0)]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="ventas" name="Ventas" fill="#13944C" radius={[4, 4, 0, 0]} barSize={28} />
                <Bar dataKey="meta" name="Meta" fill={chartTheme.metaBar} radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 6. Pipeline por Etapa - BarChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline por Etapa</CardTitle>
            <CardDescription>Valor total de oportunidades por etapa del embudo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={opportunitiesByStageData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: `1px solid ${chartTheme.tooltipBorder}`,
                    backgroundColor: chartTheme.tooltipBg,
                    fontSize: '13px',
                  }}
                  formatter={(value?: number, name?: string) => [
                    name === 'value' ? formatCurrency(value ?? 0) : (value ?? 0),
                    name === 'value' ? 'Valor' : 'Oportunidades',
                  ]}
                />
                <Bar dataKey="value" name="Valor" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={36}>
                  {opportunitiesByStageData.map((_entry, index) => (
                    <Cell key={`cell-pipeline-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 7. Actividades Realizadas - Stacked BarChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actividades Realizadas</CardTitle>
            <CardDescription>Desglose mensual por tipo de actividad comercial</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={activitiesByTypeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: `1px solid ${chartTheme.tooltipBorder}`,
                    backgroundColor: chartTheme.tooltipBg,
                    fontSize: '13px',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="llamadas" name="Llamadas" stackId="a" fill="#13944C" />
                <Bar dataKey="reuniones" name="Reuniones" stackId="a" fill="#3b82f6" />
                <Bar dataKey="correos" name="Correos" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 8. Tareas - LineChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seguimientos</CardTitle>
            <CardDescription>Actividades completadas vs pendientes por mes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={followUpsData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: `1px solid ${chartTheme.tooltipBorder}`,
                    backgroundColor: chartTheme.tooltipBg,
                    fontSize: '13px',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="completados"
                  name="Completados"
                  stroke="#13944C"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#13944C', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="pendientes"
                  name="Pendientes"
                  stroke="#ec4899"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#ec4899', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
