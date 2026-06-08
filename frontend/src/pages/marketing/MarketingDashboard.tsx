import { useState, useEffect } from 'react';
import { Users, UserPlus, TrendingUp, BarChart3, MessageCircle } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { fetchLeads } from '@/lib/marketingApi';
import { useChartTheme } from '@/hooks/useChartTheme';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';

const PIE_COLORS = ['#13944C', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

const dailyData = [
  { name: 'Lun', leads: 12, contactados: 8 },
  { name: 'Mar', leads: 18, contactados: 11 },
  { name: 'Mié', leads: 8, contactados: 5 },
  { name: 'Jue', leads: 22, contactados: 15 },
  { name: 'Vie', leads: 16, contactados: 12 },
  { name: 'Sáb', leads: 5, contactados: 3 },
  { name: 'Dom', leads: 3, contactados: 1 },
];

const campaignData = [
  { name: 'Activación Bono', leads: 45, conversion: 28 },
  { name: 'Captación Leads', leads: 23, conversion: 14 },
  { name: 'Recordatorio', leads: 12, conversion: 7 },
  { name: 'Oferta Especial', leads: 8, conversion: 3 },
];

const sourceData = [
  { name: 'Facebook', value: 68 },
  { name: 'Instagram', value: 22 },
  { name: 'Google', value: 10 },
];

const monthlyData = [
  { name: 'Ene', leads: 45, importados: 38 },
  { name: 'Feb', leads: 52, importados: 44 },
  { name: 'Mar', leads: 61, importados: 50 },
  { name: 'Abr', leads: 48, importados: 42 },
  { name: 'May', leads: 73, importados: 61 },
  { name: 'Jun', leads: 88, importados: 70 },
];

export default function MarketingDashboard() {
  const [stats, setStats] = useState({ total: 0, today: 0, facebook: 0, campaigns: 0 });
  const chartTheme = useChartTheme();

  useEffect(() => {
    fetchLeads().then((res) => {
      const today = res.data.filter((l) => l.createdAt.startsWith(new Date().toISOString().slice(0, 10))).length;
      setStats({ total: res.total, today, facebook: res.data.filter((l) => l.source === 'facebook').length, campaigns: 4 });
    });
  }, []);

  const tooltipStyle = {
    borderRadius: '8px',
    border: `1px solid ${chartTheme.tooltipBorder}`,
    backgroundColor: chartTheme.tooltipBg,
    color: chartTheme.tooltipText,
    fontSize: '13px',
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Marketing" description="Panel de leads y rendimiento de campañas" />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Leads', value: stats.total, icon: Users, color: 'text-blue-600 bg-blue-100' },
          { label: 'Leads Hoy', value: stats.today, icon: UserPlus, color: 'text-emerald-600 bg-emerald-100' },
          { label: 'Tasa Conversión', value: '68%', icon: TrendingUp, color: 'text-violet-600 bg-violet-100' },
          { label: 'Campañas', value: stats.campaigns, icon: BarChart3, color: 'text-amber-600 bg-amber-100' },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex size-11 items-center justify-center rounded-xl ${c.color}`}>
                <c.icon className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1: Daily leads + Campaigns bar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads por día</CardTitle>
            <CardDescription>Últimos 7 días</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} barGap={4} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} opacity={0.4} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dy={8} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend verticalAlign="top" align="center" height={24} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="leads" name="Nuevos Leads" fill="#13944C" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="contactados" name="Contactados" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Rendimiento por campaña</CardTitle>
            <CardDescription>Leads generados vs convertidos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignData} layout="vertical" barGap={4} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartTheme.gridStroke} opacity={0.4} />
                  <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={110} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend verticalAlign="top" align="center" height={24} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="leads" name="Leads" fill="#13944C" radius={[0, 4, 4, 0]} maxBarSize={20} />
                  <Bar dataKey="conversion" name="Conversiones" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Monthly trend + Source pie */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tendencia mensual</CardTitle>
            <CardDescription>Leads vs importados por mes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#13944C" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#13944C" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="importedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} opacity={0.4} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dy={8} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend verticalAlign="top" align="center" height={24} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="leads" name="Leads" stroke="#13944C" strokeWidth={2} fill="url(#leadsGrad)" dot={{ r: 3, fill: '#13944C', strokeWidth: 2, stroke: '#fff' }} />
                  <Area type="monotone" dataKey="importados" name="Importados" stroke="#3b82f6" strokeWidth={2} fill="url(#importedGrad)" dot={{ r: 3, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads por fuente</CardTitle>
            <CardDescription>Distribución de origen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%" cy="50%"
                    innerRadius={70} outerRadius={115}
                    dataKey="value" nameKey="name"
                    stroke="none" paddingAngle={2}
                    animationDuration={300}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {sourceData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
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
