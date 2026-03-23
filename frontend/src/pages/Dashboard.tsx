import { useState } from 'react';
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
import {
  activities,
  salesByMonthData,
  leadsBySourceData,
  funnelData,
  performanceByAdvisor,
} from '@/data/mock';
import { useCRMStore } from '@/store/crmStore';
import { WeeklyGoalCard } from '@/components/shared/WeeklyGoalCard';
import { MonthlyGoalCard } from '@/components/shared/MonthlyGoalCard';
import { formatDateShort } from '@/lib/formatters';

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

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRangePreset>('1m');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const { contacts } = useCRMStore();
  const latestContacts = contacts.slice(0, 5);
  const pendingActivities = activities
    .filter((a) => a.status === 'pendiente' || a.status === 'vencida')
    .slice(0, 5);

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
        </div>
        <Button size="sm" className="bg-[#13944C] text-white hover:bg-[#0f7a3d]">
          <FileText className="size-4" />
          Exportar
        </Button>
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
          title="Contactos Nuevos"
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
