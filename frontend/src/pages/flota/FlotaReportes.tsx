import { useState, useMemo, useEffect } from 'react';
import { BarChart3, Car, UserPlus, Download, Loader2, ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertTriangle, ClipboardList, Hash, CheckCircle2, Maximize2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  getISOWeek,
  format,
  parseISO,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  eachDayOfInterval
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useChartTheme } from '@/hooks/useChartTheme';
import {
  TooltipProvider as UITooltipProvider,
} from '@/components/ui/tooltip';
import { getConductores, type Conductor } from '@/lib/flotaConductoresApi';
import { flotaProspectosList, type FlotaProspectoRow, fetchOperadorStats, fetchOperadores, getOperatorDisplayName, type OperadorStats, type OperadorUser } from '@/lib/flotaProspectosApi';
import { getSunatHistorial, type SunatHistorialItem } from '@/lib/flotaSunatApi';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, ComposedChart, Line, Tooltip } from 'recharts';
import { ChartCardBody } from '@/components/shared/ChartCardBody';

const PIE_COLORS_FUENTE = ['#13944C', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
const PIE_COLORS_ZONA = ['#13944C', '#22c55e', '#3b82f6', '#06b6d4', '#8b5cf6'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur-md border border-border p-4 rounded-xl shadow-2xl min-w-[180px] ring-1 ring-black/5">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 border-b border-border/50 pb-2 flex items-center justify-between">
          <span>{label}</span>
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-emerald-600" />
              <span className="text-xs font-medium text-foreground/80">Servicios</span>
            </div>
            <span className="text-sm font-bold tabular-nums">{payload[0].value}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-blue-500" />
              <span className="text-xs font-medium text-foreground/80">Autorizados</span>
            </div>
            <span className="text-sm font-bold tabular-nums">{payload[1].value}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function FlotaReportes() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [prospectos, setProspectos] = useState<FlotaProspectoRow[]>([]);
  const [loadingSunat, setLoadingSunat] = useState(true);
  const [loadingProspectos, setLoadingProspectos] = useState(true);
  const chartTheme = useChartTheme();

  const [sunatDateRange, setSunatDateRange] = useState<DateRange | undefined>({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  });
  const [sunatHistory, setSunatHistory] = useState<any[]>([]);
  const [loadingSunatReal, setLoadingSunatReal] = useState(false);
  const [conductoresDateRange, setConductoresDateRange] = useState<DateRange | undefined>({
    from: startOfWeek(subWeeks(new Date(), 3), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  });
  const [conversionModalOpen, setConversionModalOpen] = useState(false);
  const [conductoresModalOpen, setConductoresModalOpen] = useState(false);
  const [fuenteModalOpen, setFuenteModalOpen] = useState(false);
  const [zonaModalOpen, setZonaModalOpen] = useState(false);
  const [actividadModalOpen, setActividadModalOpen] = useState(false);
  const [sunatModalOpen, setSunatModalOpen] = useState(false);

  useEffect(() => {
    async function load() {
      setLoadingSunat(true);
      setLoadingProspectos(true);
      try {
        const [conds, pros] = await Promise.all([
          getConductores(),
          flotaProspectosList({ limit: 10000 })
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

  useEffect(() => {
    async function loadSunatHistory() {
      if (!sunatDateRange?.from || !sunatDateRange?.to) return;
      setLoadingSunatReal(true);
      try {
        const fecini = format(sunatDateRange.from, 'yyyy-MM-dd');
        const fecfin = format(sunatDateRange.to, 'yyyy-MM-dd');
        const history = await getSunatHistorial(fecini, fecfin);
        setSunatHistory(history);
      } catch (err) {
        console.error("Error loading SUNAT history:", err);
      } finally {
        setLoadingSunatReal(false);
      }
    }
    void loadSunatHistory();
  }, [sunatDateRange]);

  const [operadorStats, setOperadorStats] = useState<OperadorStats[]>([]);
  const [loadingOperadorStats, setLoadingOperadorStats] = useState(false);

  useEffect(() => {
    async function load() {
      if (!dateRange?.from || !dateRange?.to) return;
      setLoadingOperadorStats(true);
      try {
        const fecini = format(dateRange.from, 'yyyy-MM-dd');
        const fecfin = format(dateRange.to, 'yyyy-MM-dd');
        const [rawStats, operadores] = await Promise.all([
          fetchOperadorStats(fecini, fecfin),
          fetchOperadores(),
        ]);

        const unified = new Map<string, OperadorStats>();
        for (const s of rawStats) {
          const canonical = getOperatorDisplayName(s.operador, operadores) || s.operador;
          const existing = unified.get(canonical);
          if (existing) {
            existing.prospectosAsignados += s.prospectosAsignados;
            existing.chatsActivos += s.chatsActivos;
            existing.mensajesEnviados += s.mensajesEnviados;
            existing.mensajesRecibidos += s.mensajesRecibidos;
          } else {
            unified.set(canonical, { ...s, operador: canonical });
          }
        }

        setOperadorStats(Array.from(unified.values()));
      } catch (err) {
        console.error("Error loading operator stats:", err);
        setOperadorStats([]);
      } finally {
        setLoadingOperadorStats(false);
      }
    }
    void load();
  }, [dateRange]);

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
        weekStartTs: w.weekStart.getTime(),
      }));
  }, [conductores]);

  const filteredWeeklyData = useMemo(() => {
    if (!conductoresDateRange?.from || !conductoresDateRange?.to) return weeklyData;
    const start = conductoresDateRange.from.getTime();
    const end = conductoresDateRange.to.getTime() + 86400000;
    return weeklyData.filter((w) => w.weekStartTs >= start && w.weekStartTs <= end);
  }, [weeklyData, conductoresDateRange]);

  const sunatFiltered = useMemo(() => {
    return sunatHistory.filter((s: any) => 
      s.cliente === "SUNAT" || s.cliente === "SUNAT INTENDENCIA LIMA"
    );
  }, [sunatHistory]);

  const sunatMetrics = useMemo(() => {
    if (sunatFiltered.length === 0 && !loadingSunatReal) {
      return {
        servicios: 0,
        autorizados: 0,
        noAutorizados: 0,
        penalizados: 0,
        porAutorizar: 0,
        nuevosIngresos: 0
      };
    }
    
    const authorizedPrefixes = ['0S', '1S', '3S', '5S', '9S'];
    const uniqueMobiles = new Set(sunatFiltered.map((s: any) => s.movil).filter(Boolean));
    let autorizadosCount = 0;
    let noAutorizadosCount = 0;
    
    uniqueMobiles.forEach(m => {
      if (authorizedPrefixes.some(p => m.startsWith(p))) {
        autorizadosCount++;
      } else {
        noAutorizadosCount++;
      }
    });

    const penalizados = sunatFiltered.filter((s: any) => (s.tiempopuntualidad || 0) > 15).length;
    
    // For Nuevos Ingresos, count drivers created in the selected range
    const rangeStart = sunatDateRange?.from;
    const rangeEnd = sunatDateRange?.to;
    const nuevosIngresos = conductores.filter(c => {
      if (!rangeStart || !rangeEnd || !c.fechorregistro) return false;
      const regDate = new Date(c.fechorregistro);
      return regDate >= rangeStart && regDate <= rangeEnd;
    }).length;

    return {
      servicios: sunatFiltered.length,
      autorizados: autorizadosCount,
      noAutorizados: noAutorizadosCount,
      penalizados,
      porAutorizar: conductores.filter(c => c.sunat && c.estado !== 'ACTIVO').length,
      nuevosIngresos
    };
  }, [sunatFiltered, conductores, loadingSunatReal, sunatDateRange]);

  const sunatChartData = useMemo(() => {
    if (!sunatDateRange?.from || !sunatDateRange?.to) {
      return [];
    }

    const interval = eachDayOfInterval({
      start: sunatDateRange.from,
      end: sunatDateRange.to
    });

    const authorizedPrefixes = ['0S', '1S', '3S', '5S', '9S'];
    const historyMap = new Map<string, { servicios: number; autorizados: Set<string> }>();
    for (const item of sunatFiltered) {
      const d = item.fechareserva || item.fechorregistro;
      if (d) {
        const dateKey = d.split('T')[0];
        const current = historyMap.get(dateKey) || { servicios: 0, autorizados: new Set<string>() };
        current.servicios += 1;
        
        if (item.movil && authorizedPrefixes.some(p => item.movil.startsWith(p))) {
          current.autorizados.add(item.movil);
        }
        
        historyMap.set(dateKey, current);
      }
    }

    return interval.map(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const dataPoint = historyMap.get(dateKey);
      return {
        name: format(date, 'EEE dd', { locale: es }),
        servicios: dataPoint?.servicios || 0,
        autorizados: dataPoint?.autorizados.size || 0
      };
    });
  }, [sunatFiltered, sunatDateRange, conductores]);

  const monthlyProspectsData = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    
    const interval = eachMonthOfInterval({
      start: startOfMonth(dateRange.from),
      end: startOfMonth(dateRange.to)
    });

    return interval.map(m => {
      const monthStart = new Date(Date.UTC(m.getFullYear(), m.getMonth(), 1));
      const monthEnd = new Date(Date.UTC(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59, 999));

      const nuevos = prospectos.filter(p => {
        const d = p.fechaRegistro ? parseISO(p.fechaRegistro) : new Date(p.createdAt);
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
      }).length;

      const conversion = prospectos.filter(p => {
        if (p.estado !== 'AFILIADO') return false;
        const d = p.fechaAfiliacion ? parseISO(p.fechaAfiliacion) : null;
        if (!d) return false;
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
      }).length;

      return {
        name: format(m, 'MMM', { locale: es }),
        nuevos,
        conversion
      };
    });
  }, [prospectos, dateRange]);

  const prospectosByFuente = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to || !prospectos.length) return [];
    
    const monthStart = new Date(Date.UTC(dateRange.from.getFullYear(), dateRange.from.getMonth(), 1));
    const monthEnd = new Date(Date.UTC(dateRange.to.getFullYear(), dateRange.to.getMonth() + 1, 0, 23, 59, 59, 999));
    const interval = { start: monthStart, end: monthEnd };

    const filtered = prospectos.filter(p => {
      const d = p.fechaRegistro ? parseISO(p.fechaRegistro) : new Date(p.createdAt);
      return isWithinInterval(d, interval);
    });

    const total = filtered.length;
    if (total === 0) return [];

    const map: Record<string, number> = {};
    for (const p of filtered) {
      if (!p.redSocial) continue;
      map[p.redSocial] = (map[p.redSocial] || 0) + 1;
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

  const prospectosByZona = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to || !prospectos.length) return [];

    const monthStart = new Date(Date.UTC(dateRange.from.getFullYear(), dateRange.from.getMonth(), 1));
    const monthEnd = new Date(Date.UTC(dateRange.to.getFullYear(), dateRange.to.getMonth() + 1, 0, 23, 59, 59, 999));
    const interval = { start: monthStart, end: monthEnd };

    const filtered = prospectos.filter(p => {
      const d = p.fechaRegistro ? parseISO(p.fechaRegistro) : new Date(p.createdAt);
      return isWithinInterval(d, interval);
    });

    const total = filtered.length;
    if (total === 0) return [];

    const map: Record<string, number> = {};
    for (const p of filtered) {
      if (!p.distrito) continue;
      map[p.distrito] = (map[p.distrito] || 0) + 1;
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

  return (
    <UITooltipProvider delayDuration={0}>
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

      {/* Conversión & Nuevos Conductores */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">Conversión Mensual</CardTitle>
              <CardDescription>Prospectos registrados vs afiliados por mes</CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setConversionModalOpen(true)}
              disabled={loadingProspectos || monthlyProspectsData.length === 0}
              aria-label="Ampliar conversión mensual"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ChartCardBody loading={loadingProspectos} isEmpty={monthlyProspectsData.length === 0} variant="bar" className="h-80" emptyMessage="Sin datos de conversión en el periodo">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyProspectsData} barGap={4} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} opacity={0.4} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dy={8} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
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
                  <Legend verticalAlign="top" align="center" height={24} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="nuevos" name="Prospectos nuevos" fill="#13944C" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="conversion" name="Conversiones" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCardBody>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div>
                  <CardTitle className="text-base">Nuevos Conductores</CardTitle>
                  <CardDescription>Registros nuevos vs activos por semana</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DateRangePicker 
                  value={conductoresDateRange} 
                  onChange={setConductoresDateRange} 
                  className="w-[260px]"
                />
                <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                onClick={() => setConductoresModalOpen(true)}
                disabled={loadingSunat || filteredWeeklyData.length === 0}
                aria-label="Ampliar nuevos conductores"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
            </div>
          </CardHeader>
          <CardContent>
            <ChartCardBody loading={loadingSunat} isEmpty={filteredWeeklyData.length === 0} variant="area" className="h-80" emptyMessage="Sin datos de conductores en el periodo">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredWeeklyData}>
                      <defs>
                        <linearGradient id="gradNuevos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradActivos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#13944C" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#13944C" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} opacity={0.4} />
                      <XAxis dataKey="semana" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} dy={8} />
                      <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
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
                      <Legend verticalAlign="top" align="center" height={24} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                      <Area type="monotone" dataKey="nuevos" name="Nuevos" stroke="#3b82f6" strokeWidth={2} fill="url(#gradNuevos)" dot={{ r: 3, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5, strokeWidth: 0 }} />
                      <Area type="monotone" dataKey="nuevosActivos" name="Activos" stroke="#13944C" strokeWidth={2} fill="url(#gradActivos)" dot={{ r: 3, fill: '#13944C', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCardBody>
              </CardContent>
        </Card>
      </div>

      {/* Row 1: Fuente & Zona */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">Prospectos por Fuente</CardTitle>
              <CardDescription>Distribución según canal de origen</CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setFuenteModalOpen(true)}
              disabled={loadingProspectos || prospectosByFuente.length === 0}
              aria-label="Ampliar prospectos por fuente"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ChartCardBody loading={loadingProspectos} isEmpty={prospectosByFuente.length === 0} variant="donut" className="h-[350px]" emptyMessage="Sin datos en el periodo">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={prospectosByFuente}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={115}
                    dataKey="count"
                    nameKey="name"
                    stroke="none"
                    paddingAngle={2}
                    animationDuration={300}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {prospectosByFuente.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS_FUENTE[index % PIE_COLORS_FUENTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCardBody>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">Prospectos por Zona</CardTitle>
              <CardDescription>Distribución por distrito</CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setZonaModalOpen(true)}
              disabled={loadingProspectos || prospectosByZona.length === 0}
              aria-label="Ampliar prospectos por zona"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ChartCardBody loading={loadingProspectos} isEmpty={prospectosByZona.length === 0} variant="donut" className="h-[350px]" emptyMessage="Sin datos en el periodo">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={prospectosByZona}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={115}
                    dataKey="count"
                    nameKey="name"
                    stroke="none"
                    paddingAngle={2}
                    animationDuration={300}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {prospectosByZona.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS_ZONA[index % PIE_COLORS_ZONA.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCardBody>
          </CardContent>
        </Card>
      </div>

      {/* Actividad & SUNAT */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">Actividad por Operador</CardTitle>
              <CardDescription>Prospectos asignados, chats activos y mensajes en el periodo</CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setActividadModalOpen(true)}
              disabled={loadingOperadorStats || operadorStats.length === 0}
              aria-label="Ampliar actividad por operador"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 pb-4">
            <ChartCardBody loading={loadingOperadorStats} isEmpty={operadorStats.length === 0} variant="stackedBar" className="flex-1 min-h-0" emptyMessage="Sin datos de operadores en el periodo">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={operadorStats} barSize={32} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} opacity={0.4} />
                  <XAxis
                    dataKey="operador"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => v.split(' ')[0]}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
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
                  <Legend verticalAlign="top" align="center" height={24} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="prospectosAsignados" name="Asignados" fill="#13944C" radius={[0, 3, 3, 0]} stackId="a" />
                  <Bar dataKey="chatsActivos" name="Chats" fill="#3b82f6" radius={[0, 3, 3, 0]} stackId="a" />
                  <Bar dataKey="mensajesEnviados" name="Enviados" fill="#8b5cf6" radius={[0, 3, 3, 0]} stackId="a" />
                  <Bar dataKey="mensajesRecibidos" name="Recibidos" fill="#f59e0b" radius={[0, 3, 3, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCardBody>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  SUNAT - Gestión de Flota
                </CardTitle>
                <CardDescription>Cumplimiento y métricas de autorización</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <DateRangePicker 
                  value={sunatDateRange} 
                  onChange={setSunatDateRange} 
                  className="w-[260px]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  onClick={() => setSunatModalOpen(true)}
                  disabled={loadingSunatReal || sunatChartData.length === 0}
                  aria-label="Ampliar SUNAT"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72 relative">
              {loadingSunatReal && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
                  <Loader2 className="size-8 animate-spin text-primary" />
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={sunatChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} opacity={0.4} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: chartTheme.axisColor, fontSize: 12, fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: chartTheme.axisColor, fontSize: 12 }}
                    dx={-10}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    cursor={{ fill: 'rgba(0,0,0,0.04)', strokeWidth: 2 }}
                  />
                  <Legend verticalAlign="top" align="center" height={24} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Bar 
                    dataKey="servicios" 
                    fill="#13944C" 
                    radius={[4, 4, 0, 0]} 
                    barSize={40}
                    name="Servicios Totales"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="autorizados" 
                    stroke="#3b82f6" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    name="Conductores Autorizados"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-6 justify-items-center">
              <div className="space-y-1 text-center">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                  <CheckCircle2 className="size-3 text-emerald-500" /> Autorizados
                </p>
                <p className="text-2xl font-bold tracking-tighter tabular-nums">{sunatMetrics?.autorizados ?? 0}</p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                  <XCircle className="size-3 text-red-500" /> No Autorizados
                </p>
                <p className="text-2xl font-bold tracking-tighter tabular-nums text-red-500">{sunatMetrics?.noAutorizados ?? 0}</p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                  <AlertTriangle className="size-3 text-amber-500" /> Penalizados
                </p>
                <p className="text-2xl font-bold tracking-tighter tabular-nums text-amber-500">{sunatMetrics?.penalizados ?? 0}</p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                  <Hash className="size-3 text-blue-500" /> Servicios
                </p>
                <p className="text-2xl font-bold tracking-tighter tabular-nums">{sunatMetrics?.servicios ?? 0}</p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                  <Car className="size-3 text-zinc-500" /> Por Autorizar
                </p>
                <p className="text-2xl font-bold tracking-tighter tabular-nums">{sunatMetrics?.porAutorizar ?? 0}</p>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                  <UserPlus className="size-3 text-emerald-600" /> Nuevos Ing.
                </p>
                <p className="text-2xl font-bold tracking-tighter tabular-nums text-emerald-600">{sunatMetrics?.nuevosIngresos ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    {/* Dialogs */}
    <Dialog open={conversionModalOpen} onOpenChange={setConversionModalOpen}>
      <DialogContent className="flex max-h-[min(calc(100dvh-1.5rem),900px)] w-full max-w-[min(100vw-1rem,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,56rem)]" showCloseButton>
        <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
          <DialogTitle className="pr-8 text-base">Conversión Mensual</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
          {monthlyProspectsData.length > 0 && (
            <div className="h-[520px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyProspectsData} barGap={4} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} opacity={0.4} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dy={8} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
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
                  <Legend verticalAlign="top" align="center" height={24} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="nuevos" name="Prospectos nuevos" fill="#13944C" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  <Bar dataKey="conversion" name="Conversiones" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={conductoresModalOpen} onOpenChange={setConductoresModalOpen}>
      <DialogContent className="flex max-h-[min(calc(100dvh-1.5rem),900px)] w-full max-w-[min(100vw-1rem,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,56rem)]" showCloseButton>
        <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
          <DialogTitle className="pr-8 text-base">Nuevos Conductores</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
          {filteredWeeklyData.length > 0 && (
            <div className="h-[520px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredWeeklyData}>
                    <defs>
                      <linearGradient id="modalGradNuevos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="modalGradActivos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#13944C" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#13944C" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} opacity={0.4} />
                    <XAxis dataKey="semana" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dy={8} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
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
                    <Legend verticalAlign="top" align="center" height={24} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Area type="monotone" dataKey="nuevos" name="Nuevos" stroke="#3b82f6" strokeWidth={2} fill="url(#modalGradNuevos)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                    <Area type="monotone" dataKey="nuevosActivos" name="Activos" stroke="#13944C" strokeWidth={2} fill="url(#modalGradActivos)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={fuenteModalOpen} onOpenChange={setFuenteModalOpen}>
      <DialogContent className="flex max-h-[min(calc(100dvh-1.5rem),900px)] w-full max-w-[min(100vw-1rem,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,56rem)]" showCloseButton>
        <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
          <DialogTitle className="pr-8 text-base">Prospectos por Fuente</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
          {prospectosByFuente.length > 0 && (
            <div className="h-[520px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={prospectosByFuente}
                    cx="50%" cy="50%"
                    innerRadius={90} outerRadius={140}
                    dataKey="count" nameKey="name"
                    stroke="none" paddingAngle={3}
                    animationDuration={300}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {prospectosByFuente.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS_FUENTE[index % PIE_COLORS_FUENTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={zonaModalOpen} onOpenChange={setZonaModalOpen}>
      <DialogContent className="flex max-h-[min(calc(100dvh-1.5rem),900px)] w-full max-w-[min(100vw-1rem,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,56rem)]" showCloseButton>
        <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
          <DialogTitle className="pr-8 text-base">Prospectos por Zona</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
          {prospectosByZona.length > 0 && (
            <div className="h-[520px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={prospectosByZona}
                    cx="50%" cy="50%"
                    innerRadius={90} outerRadius={140}
                    dataKey="count" nameKey="name"
                    stroke="none" paddingAngle={3}
                    animationDuration={300}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {prospectosByZona.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS_ZONA[index % PIE_COLORS_ZONA.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={actividadModalOpen} onOpenChange={setActividadModalOpen}>
      <DialogContent className="flex max-h-[min(calc(100dvh-1.5rem),900px)] w-full max-w-[min(100vw-1rem,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,56rem)]" showCloseButton>
        <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
          <DialogTitle className="pr-8 text-base">Actividad por Operador</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
          {operadorStats.length > 0 && (
            <div className="h-[520px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={operadorStats} barSize={50} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} opacity={0.4} />
                  <XAxis dataKey="operador" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.split(' ')[0]} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
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
                  <Legend verticalAlign="top" align="center" height={24} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="prospectosAsignados" name="Asignados" fill="#13944C" radius={[0, 3, 3, 0]} stackId="a" />
                  <Bar dataKey="chatsActivos" name="Chats" fill="#3b82f6" radius={[0, 3, 3, 0]} stackId="a" />
                  <Bar dataKey="mensajesEnviados" name="Enviados" fill="#8b5cf6" radius={[0, 3, 3, 0]} stackId="a" />
                  <Bar dataKey="mensajesRecibidos" name="Recibidos" fill="#f59e0b" radius={[0, 3, 3, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={sunatModalOpen} onOpenChange={setSunatModalOpen}>
      <DialogContent className="flex max-h-[min(calc(100dvh-1.5rem),900px)] w-full max-w-[min(100vw-1rem,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,56rem)]" showCloseButton>
        <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
          <DialogTitle className="pr-8 text-base">SUNAT - Gestión de Flota</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
          {sunatChartData.length > 0 && (
            <div className="h-[520px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={sunatChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} opacity={0.4} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartTheme.axisColor, fontSize: 12, fontWeight: 500 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: chartTheme.axisColor, fontSize: 12 }} dx={-10} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)', strokeWidth: 2 }} />
                  <Legend verticalAlign="top" align="center" height={24} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="servicios" fill="#13944C" radius={[4, 4, 0, 0]} barSize={60} name="Servicios Totales" />
                  <Line type="monotone" dataKey="autorizados" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} name="Conductores Autorizados" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </UITooltipProvider>
  );
}
