import { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
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
import { WeeklyGoalCard } from '@/components/shared/WeeklyGoalCard';
import { MonthlyGoalCard } from '@/components/shared/MonthlyGoalCard';
import { formatCurrency, formatDateShort } from '@/lib/formatters';
import { usePermissions } from '@/hooks/usePermissions';
import {
  fetchAnalyticsSummary,
  analyticsRangeFromPreset,
  type AnalyticsSummary,
} from '@/lib/analyticsApi';
import { useCrmConfigStore, getStageLabelFromCatalog, getSourceLabelFromCatalog } from '@/store/crmConfigStore';

const PIE_COLORS = ['#13944C', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];
const FUNNEL_COLORS = ['#13944C', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4'];

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
  const bundle = useCrmConfigStore((s) => s.bundle);
  const [dateRange, setDateRange] = useState<DateRangePreset>('1m');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

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
    return summary.funnelByStage.map((x) => ({
      ...x,
      name: getStageLabelFromCatalog(x.name, bundle),
    }));
  }, [summary, bundle]);

  const performanceByAdvisor = summary?.performanceByAdvisor ?? [];
  const salesByMonthData = summary?.salesByMonth ?? [];

  const kpis = summary?.kpis;

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
          <Button size="sm" className="bg-[#13944C] text-white hover:bg-[#0f7a3d]">
            <FileText className="size-4" />
            Exportar
          </Button>
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
          title="Actividades Pendientes"
          value={kpis?.pendingActivities ?? '—'}
          changeType="neutral"
          icon={CalendarCheck}
        />
        <MetricCard
          title="Seguimientos Vencidos"
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
          <CardHeader>
            <CardTitle className="text-base">Ventas por Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByMonthData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `S/${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value?: number, name?: string) => [
                      `S/ ${(value ?? 0).toLocaleString()}`,
                      name === 'ventas' ? 'Ventas' : 'Meta',
                    ]}
                  />
                  <Bar dataKey="ventas" fill="#13944C" radius={[4, 4, 0, 0]} name="ventas" />
                  <Bar dataKey="meta" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.5} name="meta" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Contactos por Fuente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contactos por Fuente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
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
                  <Tooltip formatter={(value?: number) => [value ?? 0, 'Contactos']} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
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
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip formatter={(value?: number) => [value ?? 0, 'Contactos']} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {funnelData.map((_, index) => (
                      <Cell key={index} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Rendimiento por Asesor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rendimiento por Asesor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceByAdvisor} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="leads" fill="#13944C" radius={[4, 4, 0, 0]} name="Contactos" />
                  <Bar dataKey="ventas" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Ventas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
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

        {/* Actividades pendientes / vencidas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actividades pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingActivities.map((activity) => {
                const t = (activity.type ?? '').toLowerCase();
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
