import { useState } from 'react';
import {
  leadsBySourceData, salesByMonthData, performanceByAdvisor, opportunitiesByStageData,
} from '@/data/mock';
import { users } from '@/data/mock';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

const COLORS = ['#13944C', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

const leadsByPeriodData = [
  { name: 'Sep', leads: 18, nuevos: 8 },
  { name: 'Oct', leads: 24, nuevos: 12 },
  { name: 'Nov', leads: 20, nuevos: 9 },
  { name: 'Dic', leads: 28, nuevos: 14 },
  { name: 'Ene', leads: 22, nuevos: 11 },
  { name: 'Feb', leads: 26, nuevos: 13 },
  { name: 'Mar', leads: 18, nuevos: 10 },
];

const conversionData = [
  { name: 'Sep', tasa: 28 },
  { name: 'Oct', tasa: 31 },
  { name: 'Nov', tasa: 29 },
  { name: 'Dic', tasa: 35 },
  { name: 'Ene', tasa: 30 },
  { name: 'Feb', tasa: 33 },
  { name: 'Mar', tasa: 32.5 },
];

const activitiesByTypeData = [
  { name: 'Sep', llamadas: 25, reuniones: 12, correos: 18, seguimientos: 15 },
  { name: 'Oct', llamadas: 30, reuniones: 15, correos: 22, seguimientos: 18 },
  { name: 'Nov', llamadas: 28, reuniones: 10, correos: 20, seguimientos: 14 },
  { name: 'Dic', llamadas: 35, reuniones: 18, correos: 25, seguimientos: 20 },
  { name: 'Ene', llamadas: 22, reuniones: 14, correos: 19, seguimientos: 16 },
  { name: 'Feb', llamadas: 32, reuniones: 16, correos: 24, seguimientos: 19 },
  { name: 'Mar', llamadas: 20, reuniones: 8, correos: 15, seguimientos: 12 },
];

const followUpsData = [
  { name: 'Sep', completados: 28, pendientes: 8 },
  { name: 'Oct', completados: 35, pendientes: 12 },
  { name: 'Nov', completados: 30, pendientes: 10 },
  { name: 'Dic', completados: 38, pendientes: 15 },
  { name: 'Ene', completados: 25, pendientes: 11 },
  { name: 'Feb', completados: 33, pendientes: 9 },
  { name: 'Mar', completados: 22, pendientes: 7 },
];

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

function formatCurrency(amount: number) {
  return `S/ ${amount.toLocaleString('es-PE')}`;
}

function handleExport(format: string) {
  toast.info(`Exportación en ${format}`, {
    description: 'La descarga comenzará en breve...',
  });
}

export default function Reports() {
  const [dateRange, setDateRange] = useState('3m');
  const [advisorFilter, setAdvisorFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  const summaryCards = [
    { label: 'Total Leads del Periodo', value: '156', icon: TrendingUp, color: 'text-[#13944C]', bg: 'bg-[#13944C]/10', trend: '+12% vs periodo anterior' },
    { label: 'Tasa de Conversión', value: '32.5%', icon: Target, color: 'text-blue-600', bg: 'bg-blue-50', trend: '+3.2% vs periodo anterior' },
    { label: 'Ventas Cerradas', value: 'S/ 245,000', icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50', trend: '+18% vs periodo anterior' },
    { label: 'Actividades Realizadas', value: '87', icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50', trend: '+5 vs periodo anterior' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Reportes" description="Análisis y métricas del rendimiento comercial" />

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 días</SelectItem>
              <SelectItem value="1m">Último mes</SelectItem>
              <SelectItem value="3m">Últimos 3 meses</SelectItem>
              <SelectItem value="1y">Este año</SelectItem>
            </SelectContent>
          </Select>

          <Select value={advisorFilter} onValueChange={setAdvisorFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los asesores</SelectItem>
              {users.filter((u) => u.status === 'activo').map((u) => (
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
        </CardContent>
      </Card>

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
              <p className="mt-1 text-xs text-muted-foreground">{card.trend}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 1. Leads por Periodo - AreaChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads por Periodo</CardTitle>
            <CardDescription>Evolución de captación de leads en el tiempo</CardDescription>
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="leads"
                  name="Total Leads"
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

        {/* 2. Leads por Fuente - PieChart Donut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads por Fuente</CardTitle>
            <CardDescription>Distribución de leads según canal de origen</CardDescription>
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
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 3. Tasa de Conversión - LineChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasa de Conversión</CardTitle>
            <CardDescription>Porcentaje de conversión mensual de leads a clientes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={conversionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
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
            <CardDescription>Leads asignados y ventas cerradas por ejecutivo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceByAdvisor} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
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
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="leads" name="Leads" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14} />
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                  formatter={(value?: number) => [formatCurrency(value ?? 0)]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="ventas" name="Ventas" fill="#13944C" radius={[4, 4, 0, 0]} barSize={28} />
                <Bar dataKey="meta" name="Meta" fill="#e5e7eb" radius={[4, 4, 0, 0]} barSize={28} />
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="llamadas" name="Llamadas" stackId="a" fill="#13944C" />
                <Bar dataKey="reuniones" name="Reuniones" stackId="a" fill="#3b82f6" />
                <Bar dataKey="correos" name="Correos" stackId="a" fill="#f59e0b" />
                <Bar
                  dataKey="seguimientos"
                  name="Seguimientos"
                  stackId="a"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 8. Seguimientos - LineChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seguimientos</CardTitle>
            <CardDescription>Comparativa de seguimientos completados vs pendientes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={followUpsData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
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
