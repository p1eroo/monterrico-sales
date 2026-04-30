import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  Users,
  Target,
  TrendingUp,
  Percent,
  UserPlus,
  CalendarCheck,
  AlertTriangle,
  DollarSign,
  Phone,
  Mail,
  Clock,
  FileText,
  MessageSquare,
  CalendarDays,
  FileSpreadsheet,
  FileDown,
  Maximize2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { MetricCard } from '@/components/shared/MetricCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { contactSourceLabels } from '@/data/mock';
import type { Contact } from '@/types';
import { contactListAll, mapApiContactRowToContact } from '@/lib/contactApi';
import { FunnelChart, type FunnelStage } from '@/components/crm/FunnelChart';
import { WeeklyGoalCard } from '@/components/shared/WeeklyGoalCard';
import { MonthlyGoalCard } from '@/components/shared/MonthlyGoalCard';
import { formatCurrency, formatDateShort } from '@/lib/formatters';
import { usePermissions } from '@/hooks/usePermissions';
import {
  fetchAnalyticsSummary,
  analyticsRangeFromPreset,
  type AnalyticsSummary,
} from '@/lib/analyticsApi';
import {
  downloadReport,
  dashboardExportBaseFilename,
  type ReportsExportInput,
} from '@/lib/reportsExport';
import { useCrmConfigStore, getStageLabelFromCatalog, getSourceLabelFromCatalog } from '@/store/crmConfigStore';
import { ChartCardBody } from '@/components/shared/ChartCardBody';
import { chartHasAnyValue } from '@/lib/chartEmpty';
import { useChartTheme } from '@/hooks/useChartTheme';
import { SalesByMonthBarChart } from '@/components/shared/SalesByMonthBarChart';
import { buildOpportunitiesStageFunnelStages } from '@/lib/companyStageFunnelData';

const PIE_COLORS = ['#13944C', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

const activityIconMap: Record<string, typeof Phone> = {
  llamada: Phone,
  correo: Mail,
  reunion: CalendarDays,
  tarea: FileText,
  whatsapp: MessageSquare,
};

type DateRangePreset = '7d' | '1m' | '3m' | '1y' | 'custom';

function changeTone(s: string): 'positive' | 'negative' | 'neutral' {
  const t = s.trim();
  if (t.startsWith('-')) return 'negative';
  if (t.startsWith('+')) return 'positive';
  return 'neutral';
}

export default function Dashboard() {
  const { hasPermission } = usePermissions();
  const chartTheme = useChartTheme();
  const bundle = useCrmConfigStore((s) => s.bundle);
  const [dateRange, setDateRange] = useState<DateRangePreset>('1m');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [salesChartModalOpen, setSalesChartModalOpen] = useState(false);

  useEffect(() => {
    let c = true;
    void contactListAll()
      .then((rows) => {
        if (c) setContacts(rows.map(mapApiContactRowToContact));
      })
      .catch(() => {
        if (c) setContacts([]);
      });
    return () => {
      c = false;
    };
  }, []);

  useEffect(() => {
    if (dateRange === 'custom' && (!customRange?.from || !customRange?.to)) {
      setSummary(null);
      return;
    }
    const { from, to } = analyticsRangeFromPreset(dateRange, customRange);
    let cancelled = false;
    setSummaryLoading(true);
    void fetchAnalyticsSummary({ from, to })
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateRange, customRange?.from, customRange?.to]);

  const latestContacts = useMemo(() => {
    return [...contacts]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 5);
  }, [contacts]);

  const pendingActivities = useMemo(() => {
    return (summary?.pendingActivities ?? []).slice(0, 5);
  }, [summary]);

  const leadsBySourceData = useMemo(() => {
    if (!summary) return [];
    return summary.contactsBySource.map((x) => ({
      ...x,
      name: getSourceLabelFromCatalog(x.name, bundle, contactSourceLabels),
    }));
  }, [summary, bundle]);

  const funnelData = useMemo(() => {
    if (!summary) return [];
    return summary.opportunitiesByStageData.map((x) => ({
      name: getStageLabelFromCatalog(x.name, bundle),
      value: x.count,
    }));
  }, [summary, bundle]);

  const funnelStages: FunnelStage[] = useMemo(() => {
    if (!summary) return [];
    return buildOpportunitiesStageFunnelStages(
      summary.opportunitiesByStageData,
      bundle,
    );
  }, [summary, bundle]);

  const opportunitiesByStageData = useMemo(() => {
    if (!summary) return [];
    return summary.opportunitiesByStageData.map((x) => ({
      ...x,
      name: getStageLabelFromCatalog(x.name, bundle),
    }));
  }, [summary, bundle]);

  const leadsByPeriodData = summary?.contactsByPeriod ?? [];
  const conversionData = summary?.conversionByMonth ?? [];
  const activitiesByTypeData = summary?.activitiesByTypeData ?? [];
  const followUpsData = summary?.followUpsByMonth ?? [];

  const performanceByAdvisor = summary?.performanceByAdvisor ?? [];
  const salesByMonthData = summary?.salesByMonth ?? [];

  const kpis = summary?.kpis;

  const salesChartEmpty =
    !summaryLoading &&
    (!summary || !chartHasAnyValue(salesByMonthData, ['ventas', 'meta']));
  const sourceChartEmpty =
    !summaryLoading &&
    (!summary || !chartHasAnyValue(leadsBySourceData, ['value']));
  const funnelChartEmpty =
    !summaryLoading &&
    (!summary || !chartHasAnyValue(funnelData, ['value']));
  const advisorChartEmpty =
    !summaryLoading &&
    (!summary || !chartHasAnyValue(performanceByAdvisor, ['empresas', 'ventas']));

  const handleExport = useCallback(
    (format: 'PDF' | 'Excel' | 'CSV') => {
      if (summaryLoading || !summary) {
        toast.error('Espera a que carguen las métricas o elige un periodo válido.');
        return;
      }
      const payload: ReportsExportInput = {
        documentTitle: 'Resumen dashboard',
        range: summary.range,
        meta: {
          advisorLabel: 'Todos los asesores',
          sourceLabel: 'Todas las fuentes',
        },
        kpis: summary.kpis,
        contactsByPeriod: leadsByPeriodData,
        contactsBySource: leadsBySourceData,
        conversionByMonth: conversionData,
        performanceByAdvisor,
        salesByMonth: salesByMonthData,
        opportunitiesByStage: opportunitiesByStageData,
        activitiesByType: activitiesByTypeData,
        followUpsByMonth: followUpsData,
      };
      try {
        downloadReport(format, payload, dashboardExportBaseFilename());
        toast.success(`Archivo ${format} generado`);
      } catch {
        toast.error('No se pudo generar el archivo. Intenta de nuevo.');
      }
    },
    [
      summaryLoading,
      summary,
      leadsByPeriodData,
      leadsBySourceData,
      conversionData,
      performanceByAdvisor,
      salesByMonthData,
      opportunitiesByStageData,
      activitiesByTypeData,
      followUpsData,
    ],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Resumen ejecutivo del equipo comercial"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangePreset)}>
            <SelectTrigger className="h-9 w-[160px]">
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
              className="h-9 w-[240px]"
            />
          )}
          {summaryLoading && (
            <span className="text-xs text-muted-foreground">Cargando métricas…</span>
          )}
        </div>
        {hasPermission('dashboard.exportar') && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={summaryLoading || !summary}
              onClick={() => handleExport('PDF')}
            >
              <FileText className="mr-1.5 size-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={summaryLoading || !summary}
              onClick={() => handleExport('Excel')}
            >
              <FileSpreadsheet className="mr-1.5 size-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={summaryLoading || !summary}
              onClick={() => handleExport('CSV')}
            >
              <FileDown className="mr-1.5 size-4" />
              CSV
            </Button>
          </>
        )}
      </PageHeader>

      {/* Metas semanal y mensual */}
      <div className="grid gap-4 sm:grid-cols-2">
        <WeeklyGoalCard />
        <MonthlyGoalCard />
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Contactos"
          value={kpis?.totalContacts ?? '—'}
          change={kpis ? `${kpis.changes.contacts} vs periodo anterior` : undefined}
          changeType={kpis ? changeTone(kpis.changes.contacts) : 'neutral'}
          icon={Users}
        />
        <MetricCard
          title="Oportunidades Activas"
          value={kpis?.activeOpportunities ?? '—'}
          changeType="neutral"
          icon={Target}
        />
        <MetricCard
          title="Ventas Cerradas"
          value={kpis ? formatCurrency(kpis.closedSalesAmount) : '—'}
          change={kpis ? `${kpis.changes.sales} vs periodo anterior` : undefined}
          changeType={kpis ? changeTone(kpis.changes.sales) : 'neutral'}
          icon={TrendingUp}
        />
        <MetricCard
          title="Tasa de Conversión"
          value={kpis ? `${kpis.conversionPct}%` : '—'}
          changeType="neutral"
          icon={Percent}
        />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Contactos Nuevos"
          value={kpis?.newContactsInRange ?? '—'}
          changeType="neutral"
          icon={UserPlus}
        />
        <MetricCard
          title="Tareas pendientes"
          value={kpis?.pendingActivities ?? '—'}
          changeType="neutral"
          icon={CalendarCheck}
        />
        <MetricCard
          title="Tareas vencidas"
          value={kpis?.overdueFollowUps ?? '—'}
          change={
            kpis && kpis.overdueFollowUps > 0 ? 'Requiere atención' : undefined
          }
          changeType={
            kpis && kpis.overdueFollowUps > 0 ? 'warning' : 'neutral'
          }
          icon={AlertTriangle}
        />
        <MetricCard
          title="Valor Pipeline"
          value={kpis ? formatCurrency(kpis.pipelineValue) : '—'}
          changeType="neutral"
          icon={DollarSign}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Ventas por Mes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Ventas por Mes</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setSalesChartModalOpen(true)}
              disabled={summaryLoading || salesChartEmpty}
              aria-label="Ampliar gráfico de ventas por mes"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={summaryLoading}
              isEmpty={salesChartEmpty}
              variant="bar"
              emptyMessage="Sin datos de ventas en este periodo."
            >
              <SalesByMonthBarChart data={salesByMonthData} variant="dashboard" />
            </ChartCardBody>
          </CardContent>
        </Card>

        <Dialog open={salesChartModalOpen} onOpenChange={setSalesChartModalOpen}>
          <DialogContent
            className="max-h-[min(90vh,900px)] w-full max-w-[min(100vw-2rem,56rem)] gap-0 p-0 sm:max-w-[min(100vw-2rem,56rem)]"
            showCloseButton
          >
            <DialogHeader className="px-6 pt-6 pb-0">
              <DialogTitle className="text-base">Ventas por Mes</DialogTitle>
            </DialogHeader>
            <div className="h-[min(70vh,520px)] w-full px-6 pb-6 pt-4">
              {!salesChartEmpty ? <SalesByMonthBarChart data={salesByMonthData} variant="dashboard" /> : null}
            </div>
          </DialogContent>
        </Dialog>

        {/* Contactos por Fuente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contactos por Fuente</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={summaryLoading}
              isEmpty={sourceChartEmpty}
              variant="donut"
              emptyMessage="Sin contactos por fuente en este periodo."
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leadsBySourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                    stroke="none"
                    paddingAngle={2}
                  >
                    {leadsBySourceData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value?: number) => [value ?? 0, 'Contactos']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: `1px solid ${chartTheme.tooltipBorder}`,
                      backgroundColor: chartTheme.tooltipBg,
                      color: chartTheme.tooltipText,
                      fontSize: '13px',
                    }}
                    itemStyle={{ color: chartTheme.tooltipText }}
                    labelStyle={{ color: chartTheme.tooltipTextMuted, marginBottom: 4 }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCardBody>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Funnel de Ventas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funnel de Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={summaryLoading}
              isEmpty={funnelChartEmpty}
              variant="bar"
              emptyMessage="Sin datos de embudo en este periodo."
              className="min-h-[min(52vh,420px)] py-3"
            >
              <FunnelChart stages={funnelStages} height={360} singularLabel="oportunidad" variant="rect" />
            </ChartCardBody>
          </CardContent>
        </Card>

        {/* Rendimiento por Asesor (barras horizontales, misma altura mín. que Funnel) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rendimiento por Asesor</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={summaryLoading}
              isEmpty={advisorChartEmpty}
              variant="barHorizontal"
              emptyMessage="Sin rendimiento por asesor en este periodo."
              className="h-[min(52vh,420px)] py-3"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceByAdvisor} layout="vertical" barGap={2} margin={{ left: 4, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartTheme.gridStroke} />
                  <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: `1px solid ${chartTheme.tooltipBorder}`,
                      backgroundColor: chartTheme.tooltipBg,
                      color: chartTheme.tooltipText,
                      fontSize: '13px',
                    }}
                    itemStyle={{ color: chartTheme.tooltipText }}
                    labelStyle={{ color: chartTheme.tooltipTextMuted, marginBottom: 4 }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    dataKey="empresas"
                    name="Empresas"
                    fill="#3b82f6"
                    radius={[0, 4, 4, 0]}
                    barSize={14}
                  />
                  <Bar
                    dataKey="ventas"
                    name="Ventas"
                    fill="#13944C"
                    radius={[0, 4, 4, 0]}
                    barSize={14}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCardBody>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Sections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Últimos Contactos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos Contactos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {latestContacts.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Aún no hay contactos registrados.
                </p>
              ) : null}
              {latestContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{contact.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {contact.companies?.find((c) => c.isPrimary)?.name ?? contact.companies?.[0]?.name ?? '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 pl-4">
                    <StatusBadge status={contact.etapa} />
                    <span className="text-xs text-muted-foreground">
                      {formatDateShort(contact.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tareas pendientes / vencidas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tareas pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!summaryLoading && pendingActivities.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No hay tareas pendientes.
                </p>
              ) : null}
              {pendingActivities.map((activity) => {
                const t = (
                  activity.taskKind ?? activity.type ?? ''
                ).toLowerCase();
                const IconComp = activityIconMap[t] ?? Clock;
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
                      activity.status === 'vencida'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      <IconComp className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {activity.title}
                        </p>
                        {activity.status === 'vencida' && (
                          <StatusBadge status="vencida" />
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {activity.contactName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateShort(activity.dueDate)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
