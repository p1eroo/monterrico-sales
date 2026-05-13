import { useState, useMemo, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Car, UserPlus, Download, Loader2, ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertTriangle, ClipboardList, Hash, CheckCircle2 } from 'lucide-react';
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
  isSameMonth,
  eachDayOfInterval
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
import { getSunatHistorial, type SunatHistorialItem } from '@/lib/flotaSunatApi';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, ComposedChart, Line, Tooltip } from 'recharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import {
  Tooltip as UITooltip,
  TooltipContent as UITooltipContent,
  TooltipProvider as UITooltipProvider,
  TooltipTrigger as UITooltipTrigger,
} from '@/components/ui/tooltip';

const SUNAT_MOCK = {
  autorizados: 73,
  noAutorizados: 12,
  serviciosPenalizados: 4,
  totalAutorizados: 85,
  cantidadServicios: 1240,
  autosPorAutorizar: 8,
  nuevosIngresos: 15,
  history: [
    { name: 'Lun', autorizados: 65, servicios: 180 },
    { name: 'Mar', autorizados: 68, servicios: 210 },
    { name: 'Mie', autorizados: 70, servicios: 195 },
    { name: 'Jue', autorizados: 72, servicios: 230 },
    { name: 'Vie', autorizados: 73, servicios: 250 },
    { name: 'Sab', autorizados: 73, servicios: 190 },
    { name: 'Dom', autorizados: 73, servicios: 120 },
  ]
};

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

  const [sunatDateRange, setSunatDateRange] = useState<DateRange | undefined>({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  });
  const [sunatHistory, setSunatHistory] = useState<any[]>([]);
  const [loadingSunatReal, setLoadingSunatReal] = useState(false);

  useEffect(() => {
    async function load() {
      setLoadingSunat(true);
      setLoadingProspectos(true);
      try {
        const [conds, pros] = await Promise.all([
          getConductores(),
          flotaProspectosList({ limit: 5000 })
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
    
    // For Nuevos Ingresos, let's count drivers created in the selected range
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
                      <Tooltip />
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
                    <Tooltip />
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
                      <UITooltip key={item.name}>
                        <UITooltipTrigger asChild>
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
                        </UITooltipTrigger>
                        <UITooltipContent className="flex flex-col gap-1 p-3">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1 border-b pb-1">{item.name}</p>
                          <div className="flex items-center gap-2">
                            <div className="size-2 rounded-full bg-emerald-100" />
                            <span className="text-xs font-semibold">{item.nuevos} Prospectos nuevos</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="size-2 rounded-full bg-emerald-600" />
                            <span className="text-xs font-semibold">{item.conversion} Conversiones</span>
                          </div>
                        </UITooltipContent>
                      </UITooltip>
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
                      <UITooltip key={week.semana}>
                        <UITooltipTrigger asChild>
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
                        </UITooltipTrigger>
                        <UITooltipContent className="flex flex-col gap-1 p-3">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1 border-b pb-1">{week.semana}</p>
                          <div className="flex items-center gap-2">
                            <div className="size-2 rounded-full bg-blue-500" />
                            <span className="text-xs font-semibold">{week.nuevos} Registros nuevos</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="size-2 rounded-full bg-emerald-500" />
                            <span className="text-xs font-semibold">{week.nuevosActivos} Nuevos activos</span>
                          </div>
                        </UITooltipContent>
                      </UITooltip>
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
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="size-4 text-emerald-500" />
                  SUNAT - Gestión de Flota
                </CardTitle>
                <CardDescription>Cumplimiento y métricas de autorización</CardDescription>
              </div>
              <DateRangePicker 
                value={sunatDateRange} 
                onChange={setSunatDateRange} 
                className="w-[260px]"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8 pt-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight">
                  <CheckCircle2 className="size-3 text-emerald-500" /> Autorizados
                </p>
                <p className="text-3xl font-bold tracking-tighter tabular-nums">{sunatMetrics?.autorizados ?? 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight">
                  <XCircle className="size-3 text-red-500" /> No Autorizados
                </p>
                <p className="text-3xl font-bold tracking-tighter tabular-nums text-red-500">{sunatMetrics?.noAutorizados ?? 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight">
                  <AlertTriangle className="size-3 text-amber-500" /> Penalizados
                </p>
                <p className="text-3xl font-bold tracking-tighter tabular-nums text-amber-500">{sunatMetrics?.penalizados ?? 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight">
                  <Hash className="size-3 text-blue-500" /> Servicios
                </p>
                <p className="text-3xl font-bold tracking-tighter tabular-nums">{sunatMetrics?.servicios ?? 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight">
                  <Car className="size-3 text-zinc-500" /> Por Autorizar
                </p>
                <p className="text-3xl font-bold tracking-tighter tabular-nums">{sunatMetrics?.porAutorizar ?? 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight">
                  <UserPlus className="size-3 text-emerald-600" /> Nuevos Ing.
                </p>
                <p className="text-3xl font-bold tracking-tighter tabular-nums text-emerald-600">{sunatMetrics?.nuevosIngresos ?? 0}</p>
              </div>
            </div>

            <div className="h-72 mt-6 relative">
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
                  <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
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
    </UITooltipProvider>
  );
}
