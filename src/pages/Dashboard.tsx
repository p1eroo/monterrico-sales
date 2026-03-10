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
import { MetricCard } from '@/components/shared/MetricCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import {
  activities,
  salesByMonthData,
  leadsBySourceData,
  funnelData,
  performanceByAdvisor,
} from '@/data/mock';
import { useCRMStore } from '@/store/crmStore';

const PIE_COLORS = ['#13944C', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];
const FUNNEL_COLORS = ['#13944C', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4'];

const activityIconMap: Record<string, typeof Phone> = {
  llamada: Phone,
  correo: Mail,
  reunion: CalendarDays,
  tarea: FileText,
  seguimiento: Clock,
  whatsapp: MessageSquare,
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

export default function Dashboard() {
  const { leads } = useCRMStore();
  const latestLeads = leads.slice(0, 5);
  const pendingActivities = activities
    .filter((a) => a.status === 'pendiente' || a.status === 'vencida')
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Resumen ejecutivo del equipo comercial"
      >
        <Button variant="outline" size="sm">
          <CalendarCheck className="size-4" />
          Este mes
        </Button>
        <Button size="sm" className="bg-[#13944C] text-white hover:bg-[#0f7a3d]">
          <FileText className="size-4" />
          Exportar
        </Button>
      </PageHeader>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Leads"
          value={156}
          change="+12.5%"
          changeType="positive"
          icon={Users}
        />
        <MetricCard
          title="Oportunidades Activas"
          value={34}
          change="+8.3%"
          changeType="positive"
          icon={Target}
        />
        <MetricCard
          title="Ventas Cerradas"
          value="S/ 245,000"
          change="+15.2%"
          changeType="positive"
          icon={TrendingUp}
        />
        <MetricCard
          title="Tasa de Conversión"
          value="32.5%"
          change="-2.1%"
          changeType="negative"
          icon={Percent}
        />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Leads Nuevos"
          value={23}
          change="+18%"
          changeType="positive"
          icon={UserPlus}
        />
        <MetricCard
          title="Actividades Pendientes"
          value={28}
          changeType="neutral"
          icon={CalendarCheck}
        />
        <MetricCard
          title="Seguimientos Vencidos"
          value={7}
          change="Requiere atención"
          changeType="warning"
          icon={AlertTriangle}
        />
        <MetricCard
          title="Valor Pipeline"
          value="S/ 875,000"
          change="+5.4%"
          changeType="positive"
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

        {/* Leads por Fuente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads por Fuente</CardTitle>
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
                  <Tooltip formatter={(value?: number) => [value ?? 0, 'Leads']} />
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
                  <Tooltip formatter={(value?: number) => [value ?? 0, 'Leads']} />
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
                  <Bar dataKey="leads" fill="#13944C" radius={[4, 4, 0, 0]} name="Leads" />
                  <Bar dataKey="ventas" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Ventas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Sections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Últimos Leads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {latestLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{lead.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lead.companies?.find((c) => c.isPrimary)?.name ?? lead.companies?.[0]?.name ?? '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 pl-4">
                    <StatusBadge status={lead.etapa} />
                    <span className="text-xs text-muted-foreground">
                      {formatDate(lead.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actividades del Día */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actividades del Día</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingActivities.map((activity) => {
                const IconComp = activityIconMap[activity.type] ?? Clock;
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
                        {activity.leadName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(activity.dueDate)}
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
