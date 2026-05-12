import { useState, useMemo, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Car, UserPlus, Download, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import {
  subMonths,
  startOfWeek,
  endOfWeek,
  getISOWeek,
  format,
  parseISO,
  getYear,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  isSameMonth
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { MetricCard } from '@/components/shared/MetricCard';
import { formatCurrency } from '@/lib/formatters';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { getConductores, type Conductor } from '@/lib/flotaConductoresApi';
import { flotaProspectosList, type FlotaProspectoRow } from '@/lib/flotaProspectosApi';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const REPORTES_MOCK = {
  prospectosMes: 45,
  prospectosMesPrev: 38,
  conversionMes: 12,
  conversionMesPrev: 9,
  conductoresNuevos: 8,
  conductoresNuevosPrev: 5,
  conductoresActivos: 156,
  conductoresInactivos: 24,
  ingresosMes: 289000,
  ingresosMesPrev: 245000,
};

const PROSPECTOS_BY_MONTH = [
  { name: 'Ene', nuevos: 12, conversion: 3 },
  { name: 'Feb', nuevos: 15, conversion: 4 },
  { name: 'Mar', nuevos: 18, conversion: 5 },
  { name: 'Abr', nuevos: 10, conversion: 2 },
  { name: 'May', nuevos: 22, conversion: 6 },
  { name: 'Jun', nuevos: 25, conversion: 8 },
];

const FUENTE_DATA = [
  { name: 'Web', value: 35 },
  { name: 'Facebook', value: 25 },
  { name: 'Referido', value: 20 },
  { name: 'Instagram', value: 15 },
  { name: 'TikTok', value: 5 },
];

const ZONA_DATA = [
  { name: 'Lima Centro', value: 28 },
  { name: 'Miraflores', value: 18 },
  { name: 'Surco', value: 15 },
  { name: 'Barranco', value: 12 },
  { name: 'Other', value: 27 },
];

const FLAOTA_MOCK_ZONA_DATA = [
  { name: 'Lima Centro', value: 28 },
  { name: 'Miraflores', value: 18 },
  { name: 'Surco', value: 15 },
  { name: 'Barranco', value: 12 },
  { name: 'Other', value: 27 },
];

const PIE_COLORS_FUENTE = ['#13944C', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
const PIE_COLORS_ZONA = ['#13944C', '#22c55e', '#3b82f6', '#06b6d4', '#8b5cf6'];

export default function FlotaReportes() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 6),
    to: new Date(),
  });
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [prospectos, setProspectos] = useState<FlotaProspectoRow[]>([]);
  const [loadingSunat, setLoadingSunat] = useState(true);
  const [loadingProspectos, setLoadingProspectos] = useState(true);
  const [weekPage, setWeekPage] = useState(-1); // -1 = auto-jump to last page
  const weeksPerPage = 6;
  const chartTheme = useChartTheme();

  const data = useMemo(() => REPORTES_MOCK, []);

  useEffect(() => {
    async function load() {
      setLoadingSunat(true);
      setLoadingProspectos(true);
      try {
        const [conds, pros] = await Promise.all([
          getConductores(),
          flotaProspectosList({ limit: 5000 }) // Load a large chunk for reporting
        ]);
        setConductores(Array.isArray(conds) ? conds : []);
        setProspectos(Array.isArray(pros.data) ? pros.data : []);
      } catch (err) {
        console.error("Error loading report data:", err);
        setConductores([]);
        setProspectos([]);
      } finally {
        setLoadingSunat(false);
        setLoadingProspectos(false);
      }
    }
    void load();
  }, []);

  const sunatAutorizados = useMemo(() => {
    return conductores.filter(
      (c) => c.codigo?.startsWith('1S') && c.estado !== 'RETIRADO'
    );
  }, [conductores]);

  const weeklyData = useMemo(() => {
    if (!conductores.length) return [];

    const weekMap = new Map<string, { nuevos: number; nuevosActivos: number; weekStart: Date; weekEnd: Date; weekNum: number }>();

    for (const c of conductores) {
      if (!c.fechorregistro) continue;
      let regDate: Date;
      try {
        regDate = parseISO(c.fechorregistro);
        if (isNaN(regDate.getTime())) continue;
      } catch {
        continue;
      }

      const wStart = startOfWeek(regDate, { weekStartsOn: 1 });
      const wEnd = endOfWeek(regDate, { weekStartsOn: 1 });
      const weekNum = getISOWeek(regDate);
      const key = format(wStart, 'yyyy-MM-dd');

      const existing = weekMap.get(key) || { nuevos: 0, nuevosActivos: 0, weekStart: wStart, weekEnd: wEnd, weekNum };
      existing.nuevos += 1;
      if (c.estado !== 'RETIRADO') {
        existing.nuevosActivos += 1;
      }
      weekMap.set(key, existing);
    }

    return Array.from(weekMap.values())
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
      .map((w) => ({
        semana: `Sem ${w.weekNum}`,
        rango: `${format(w.weekStart, 'dd MMM', { locale: es })} - ${format(w.weekEnd, 'dd MMM', { locale: es })}`,
        nuevos: w.nuevos,
        nuevosActivos: w.nuevosActivos,
      }));
  }, [conductores]);

  // Auto-scroll to the most recent weeks on first load
  useEffect(() => {
    if (weeklyData.length > 0 && weekPage === -1) {
      const lastPage = Math.max(0, Math.ceil(weeklyData.length / weeksPerPage) - 1);
      setWeekPage(lastPage);
    }
  }, [weeklyData, weekPage, weeksPerPage]);

  const sunatByEstado = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of sunatAutorizados) {
      const estado = c.estado || '(Vacío)';
      map[estado] = (map[estado] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [sunatAutorizados]);

  const monthlyProspectsData = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    
    const interval = eachMonthOfInterval({
      start: startOfMonth(dateRange.from),
      end: startOfMonth(dateRange.to)
    });

    return interval.map(m => {
      const monthStart = startOfMonth(m);
      const monthEnd = endOfMonth(m);

      // Prospectos nuevos: registrados en este mes
      const nuevos = prospectos.filter(p => {
        if (!p.fechaRegistro) return false;
        const d = parseISO(p.fechaRegistro);
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
      }).length;

      // Conversiones: pasaron a AFILIADO en este mes
      const conversion = prospectos.filter(p => {
        if (!p.fechaAfiliacion || p.estado !== 'AFILIADO') return false;
        const d = parseISO(p.fechaAfiliacion);
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
      }).length;

      return {
        name: format(m, 'MMM', { locale: es }),
        nuevos,
        conversion
      };
    });
  }, [prospectos, dateRange]);

  const stats = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return { nuevos: 0, conversiones: 0, condNuevos: 0 };
    
    const interval = { start: startOfMonth(dateRange.from), end: endOfMonth(dateRange.to) };

    const nuevos = prospectos.filter(p => {
      if (!p.fechaRegistro) return false;
      const d = parseISO(p.fechaRegistro);
      return isWithinInterval(d, interval);
    }).length;

    const conversiones = prospectos.filter(p => {
      if (!p.fechaAfiliacion || p.estado !== 'AFILIADO') return false;
      const d = parseISO(p.fechaAfiliacion);
      return isWithinInterval(d, interval);
    }).length;

    const condNuevos = conductores.filter(c => {
      if (!c.fechorregistro) return false;
      const d = parseISO(c.fechorregistro);
      return isWithinInterval(d, interval);
    }).length;

    return { nuevos, conversiones, condNuevos };
  }, [prospectos, conductores, dateRange]);

  const prospectosByFuente = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to || !prospectos.length) return [];
    
    const interval = { start: startOfMonth(dateRange.from), end: endOfMonth(dateRange.to) };
    
    const filtered = prospectos.filter(p => {
      if (!p.fechaRegistro) return false;
      const d = parseISO(p.fechaRegistro);
      return isWithinInterval(d, interval);
    });

    const total = filtered.length;
    if (total === 0) return [];

    const map: Record<string, number> = {};
    for (const p of filtered) {
      const fuente = p.redSocial || 'Otros';
      map[fuente] = (map[fuente] || 0) + 1;
    }

    return Object.entries(map)
      .map(([name, count]) => ({
        name,
        value: Math.round((count / total) * 100),
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [prospectos, dateRange]);

  const changeTone = (change: number) => {
    if (change > 0) return 'positive';
    if (change < 0) return 'negative';
    return 'neutral';
  };

  const prospectosChange = ((data.prospectosMes - data.prospectosMesPrev) / data.prospectosMesPrev * 100).toFixed(0);
  const conversionChange = ((data.conversionMes - data.conversionMesPrev) / data.conversionMesPrev * 100).toFixed(0);
  const conductoresChange = ((data.conductoresNuevos - data.conductoresNuevosPrev) / data.conductoresNuevosPrev * 100).toFixed(0);
  const ingresosChange = ((data.ingresosMes - data.ingresosMesPrev) / data.ingresosMesPrev * 100).toFixed(0);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-6">
      <PageHeader
        title="Reportes Flota"
        description="Métricas de prospectos y conductores"
      >
        <div className="flex items-center gap-2">
          <DateRangePicker 
            value={dateRange} 
            onChange={setDateRange} 
            className="w-[260px]"
          />
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="size-4" />
            Exportar
          </Button>
        </div>
      </PageHeader>

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Prospectos Nuevos"
          value={stats.nuevos}
          change="En el periodo"
          icon={UserPlus}
        />
        <MetricCard
          title="Conversiones"
          value={stats.conversiones}
          change="Afiliados nuevos"
          icon={TrendingUp}
        />
        <MetricCard
          title="Conductores Nuevos"
          value={stats.condNuevos}
          change="En el periodo"
          icon={Car}
        />
        <MetricCard
          title="Ingresos Flota"
          value={formatCurrency(data.ingresosMes)}
          change="+12% vs mes anterior"
          icon={Users}
        />
      </div>

      {/* Row 1: Fuente & Zona */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Prospectos por Fuente</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingProspectos ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : prospectosByFuente.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                Sin datos en el periodo
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <div className="h-52 w-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={prospectosByFuente}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        dataKey="count"
                        nameKey="name"
                        stroke="none"
                        paddingAngle={2}
                      >
                        {prospectosByFuente.map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS_FUENTE[index % PIE_COLORS_FUENTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value?: number) => [`${value ?? 0} prospectos`, '']}
                        contentStyle={{
                          borderRadius: '8px',
                          border: `1px solid ${chartTheme.tooltipBorder}`,
                          backgroundColor: chartTheme.tooltipBg,
                          color: chartTheme.tooltipText,
                          fontSize: '13px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {prospectosByFuente.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="size-3 rounded-full" style={{ backgroundColor: PIE_COLORS_FUENTE[index % PIE_COLORS_FUENTE.length] }} />
                        <span className="text-muted-foreground truncate max-w-[100px]" title={item.name}>
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium tabular-nums">{item.count}</span>
                        <span className="text-xs text-muted-foreground w-10 text-right">{item.value}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Prospectos por Zona</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="h-52 w-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={FLAOTA_MOCK_ZONA_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      dataKey="value"
                      nameKey="name"
                      stroke="none"
                      paddingAngle={2}
                    >
                      {FLAOTA_MOCK_ZONA_DATA.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS_ZONA[index % PIE_COLORS_ZONA.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value?: number) => [`${value ?? 0}%`, '']}
                      contentStyle={{
                        borderRadius: '8px',
                        border: `1px solid ${chartTheme.tooltipBorder}`,
                        backgroundColor: chartTheme.tooltipBg,
                        color: chartTheme.tooltipText,
                        fontSize: '13px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {FLAOTA_MOCK_ZONA_DATA.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="size-3 rounded-full" style={{ backgroundColor: PIE_COLORS_ZONA[index % PIE_COLORS_ZONA.length] }} />
                      <span className="text-muted-foreground truncate max-w-[100px]" title={item.name}>
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium tabular-nums">{item.value}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Conversión & Nuevos Conductores (Tendencias) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              Conversión Mensual
              <BarChart3 className="size-4 text-muted-foreground" />
            </CardTitle>
            <CardDescription>Prospectos registrados vs afiliados por mes</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingProspectos ? (
              <div className="flex items-center justify-center h-56">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex items-end gap-2 h-56 pt-6 px-2">
                  {monthlyProspectsData.map((item) => {
                    const maxVal = Math.max(...monthlyProspectsData.map(d => d.nuevos + d.conversion), 1);
                    return (
                      <Tooltip key={item.name}>
                        <TooltipTrigger asChild>
                          <div className="flex-1 flex flex-col items-center gap-3 group/item cursor-pointer hover:bg-emerald-50/50 rounded-lg p-2 transition-colors">
                            <div className="flex items-end gap-1 w-full justify-center h-44">
                              <div
                                className="w-full max-w-[32px] rounded-t bg-emerald-100 group-hover/item:bg-emerald-200 transition-colors"
                                style={{ height: `${(item.nuevos / maxVal) * 100}%` }}
                              />
                              <div
                                className="w-full max-w-[32px] rounded-t bg-emerald-600 group-hover/item:bg-emerald-700 transition-colors"
                                style={{ height: `${(item.conversion / maxVal) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground uppercase">{item.name}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="flex flex-col gap-1 p-3">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1 border-b pb-1">{item.name}</p>
                          <div className="flex items-center gap-2">
                            <div className="size-2 rounded-full bg-emerald-100" />
                            <span className="text-xs font-semibold">{item.nuevos} Prospectos nuevos</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="size-2 rounded-full bg-emerald-600" />
                            <span className="text-xs font-semibold">{item.conversion} Conversiones</span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="size-3 rounded bg-emerald-100" />
                    Prospectos nuevos
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="size-3 rounded bg-emerald-600" />
                    Conversiones
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Nuevos Conductores</CardTitle>
                <CardDescription>Registros nuevos vs activos por semana</CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={weekPage === 0}
                  onClick={() => setWeekPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-[10px] text-muted-foreground min-w-[70px] text-center">
                  {weeklyData.length > 0
                    ? `${weeklyData[weekPage * weeksPerPage]?.semana ?? ''} – ${weeklyData[Math.min((weekPage + 1) * weeksPerPage - 1, weeklyData.length - 1)]?.semana ?? ''}`
                    : ''}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={(weekPage + 1) * weeksPerPage >= weeklyData.length}
                  onClick={() => setWeekPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {weekPage === -1 || loadingSunat ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (() => {
              const visibleWeeks = weeklyData.slice(
                weekPage * weeksPerPage,
                (weekPage + 1) * weeksPerPage
              );
              const maxVal = Math.max(...visibleWeeks.map((w) => w.nuevos), 1);
              return (
                <>
                  <div className="flex items-end gap-2 h-56">
                    {visibleWeeks.map((week) => (
                      <Tooltip key={week.semana}>
                        <TooltipTrigger asChild>
                          <div className="flex-1 flex flex-col items-center gap-1 group/week cursor-pointer hover:bg-blue-50/50 rounded-lg p-1.5 transition-colors">
                            <div className="flex items-end gap-1.5 w-full justify-center h-48">
                              <div
                                className="w-3 rounded-t bg-blue-500/70 group-hover/week:bg-blue-500/90 transition-colors"
                                style={{ height: `${(week.nuevos / maxVal) * 100}%` }}
                              />
                              <div
                                className="w-3 rounded-t bg-emerald-500/70 group-hover/week:bg-emerald-500/90 transition-colors"
                                style={{ height: `${(week.nuevosActivos / maxVal) * 100}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-muted-foreground font-medium">{week.semana}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="flex flex-col gap-1 p-3">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1 border-b pb-1">{week.semana}</p>
                          <div className="flex items-center gap-2">
                            <div className="size-2 rounded-full bg-blue-500" />
                            <span className="text-xs font-semibold">{week.nuevos} Registros nuevos</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="size-2 rounded-full bg-emerald-500" />
                            <span className="text-xs font-semibold">{week.nuevosActivos} Nuevos activos</span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <div className="size-2 rounded-sm bg-blue-500" />
                        Nuevos
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="size-2 rounded-sm bg-emerald-500" />
                        Activos
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: SUNAT & Estado (Cumplimiento) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">SUNAT - Cond. Autorizados</CardTitle>
            <CardDescription>Conductores con código 1S (excluyendo RETIRADO)</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSunat ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{sunatAutorizados.length}</span>
                  <span className="text-sm text-muted-foreground">conductores autorizados</span>
                </div>
                <div className="space-y-2.5">
                  {sunatByEstado.map((item) => {
                    const pct = sunatAutorizados.length > 0
                      ? Math.round((item.count / sunatAutorizados.length) * 100)
                      : 0;
                    return (
                      <div key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground truncate max-w-[160px]">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium tabular-nums">{item.count}</span>
                            <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-primary/15 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Conductores por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="size-3 rounded-full bg-emerald-500" />
                    Activos
                  </span>
                  <span className="font-medium text-lg">{data.conductoresActivos}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${(data.conductoresActivos / (data.conductoresActivos + data.conductoresInactivos)) * 100}%` }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="size-3 rounded-full bg-red-500" />
                    Inactivos
                  </span>
                  <span className="font-medium text-lg">{data.conductoresInactivos}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: `${(data.conductoresInactivos / (data.conductoresActivos + data.conductoresInactivos)) * 100}%` }} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground pt-4">
                Total registrado: {data.conductoresActivos + data.conductoresInactivos} conductores
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </TooltipProvider>
  );
}
