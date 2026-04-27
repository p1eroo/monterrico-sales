import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DateRange } from 'react-day-picker';
import { useUsers } from '@/hooks/useUsers';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Maximize2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useChartTheme } from '@/hooks/useChartTheme';
import { formatCurrency } from '@/lib/formatters';
import { usePermissions } from '@/hooks/usePermissions';
import { useCrmTeamAdvisorFilter } from '@/hooks/useCrmTeamAdvisorFilter';
import { contactSourceLabels } from '@/data/mock';
import {
  fetchAnalyticsSummary,
  analyticsRangeFromPreset,
  type AnalyticsSummary,
} from '@/lib/analyticsApi';
import {
  downloadReport,
  reportExportBaseFilename,
  type ReportsExportInput,
} from '@/lib/reportsExport';
import { useAppStore } from '@/store';
import {
  useCrmConfigStore,
  getSourceLabelFromCatalog,
  getStageLabelFromCatalog,
} from '@/store/crmConfigStore';
import { ChartCardBody } from '@/components/shared/ChartCardBody';
import { SalesByMonthBarChart } from '@/components/shared/SalesByMonthBarChart';
import { chartHasAnyValue } from '@/lib/chartEmpty';
import { Skeleton } from '@/components/ui/skeleton';
import { FunnelChart, type FunnelStage } from '@/components/crm/FunnelChart';
import { buildCompaniesStageFunnelRows } from '@/lib/companyStageFunnelData';

const COLORS = ['#13944C', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

const WEEKLY_COMPANY_COLORS = {
  avance: '#3b82f6',
  nuevoIngreso: '#13944C',
  retroceso: '#f59e0b',
  sinCambios: '#ef4444',
} as const;

/** Si el periodo tiene más semanas, solo se dibujan las más recientes (las iniciales se omiten). */
const WEEKLY_COMPANY_CHART_MAX_WEEKS = 20;

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

function changeTone(s: string): 'positive' | 'negative' | 'neutral' {
  const t = s.trim();
  if (t.startsWith('-')) return 'negative';
  if (t.startsWith('+')) return 'positive';
  return 'neutral';
}

type DateRangePreset = '7d' | '1m' | '3m' | '1y' | 'custom';

/** Alineado con `analytics.service.ts` (semanas ISO lun–dom UTC). */
function startOfUtcWeekMonday(d: Date): Date {
  const x = new Date(d.getTime());
  const day = x.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function isoWeekNumberUtc(d: Date): number {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil((x.getTime() - yearStart.getTime()) / 86400000 / 7);
}

function isoWeekYearUtc(monday: Date): number {
  const thu = new Date(monday.getTime());
  thu.setUTCDate(thu.getUTCDate() + 3);
  return thu.getUTCFullYear();
}

/** Etiqueta única por semana ISO (evita duplicados al cruzar año). */
function weekAxisLabelUtc(monday: Date): string {
  const y = isoWeekYearUtc(monday);
  const w = isoWeekNumberUtc(monday);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

/** Acepta `YYYY-MM-DD` o ISO completo del API (`…T00:00:00.000Z`). */
function parseAnalyticsRangeDateUtc(s: string, endOfDay: boolean): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return new Date(NaN);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (endOfDay) return new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999));
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
}

export default function Reports() {
  const { users, activeAdvisors } = useUsers();
  const currentUser = useAppStore((s) => s.currentUser);
  const { hasPermission } = usePermissions();
  const bundle = useCrmConfigStore((s) => s.bundle);
  const [dateRange, setDateRange] = useState<DateRangePreset>('3m');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [advisorFilter, setAdvisorFilter] = useState('all');
  const { canSeeAllAdvisors, currentUserId } = useCrmTeamAdvisorFilter(
    advisorFilter,
    setAdvisorFilter,
    'all',
  );
  /**
   * Sin `usuarios.ver` / `equipo.ver` el listado API puede quedar vacío, pero el filtro
   * sigue fijado al id de sesión: el Select necesita al menos un ítem con ese value.
   */
  const advisorSelectOptions = useMemo(() => {
    if (!canSeeAllAdvisors && currentUserId) {
      return [
        {
          id: currentUserId,
          name: currentUser.name || currentUser.username || 'Asesor',
        },
      ];
    }
    const out: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    for (const u of activeAdvisors) {
      if (!seen.has(u.id)) {
        seen.add(u.id);
        out.push({ id: u.id, name: u.name });
      }
    }
    if (currentUserId && !seen.has(currentUserId)) {
      out.push({
        id: currentUserId,
        name: currentUser.name || currentUser.username || currentUserId,
      });
    }
    return out;
  }, [canSeeAllAdvisors, currentUserId, currentUser, activeAdvisors]);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  /** Lunes UTC (ms) de la última semana visible en el gráfico de avance semanal. */
  const [weeklyProgressCapMs, setWeeklyProgressCapMs] = useState<number | null>(null);
  const [companiesFunnelModalOpen, setCompaniesFunnelModalOpen] = useState(false);
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

  const companiesStageFunnelRows = useMemo(
    () => buildCompaniesStageFunnelRows(summary?.companiesByStage ?? [], bundle),
    [summary?.companiesByStage, bundle],
  );

  const companiesFunnelStages: FunnelStage[] = useMemo(
    () =>
      companiesStageFunnelRows.map((r) => ({
        label: r.name,
        value: r.value,
        color: r.fill,
      })),
    [companiesStageFunnelRows],
  );

  const companiesWeeklyProgressData = useMemo(
    () => summary?.companiesWeeklyProgress ?? [],
    [summary?.companiesWeeklyProgress],
  );

  /** Semanas desde el inicio del rango del reporte hasta la semana ISO actual (UTC); rellena ceros tras el `to` del API. */
  const weeklyProgressExtended = useMemo(() => {
    if (!summary?.range?.from || !summary?.range?.to) return [];
    const apiRows = summary.companiesWeeklyProgress ?? [];
    const fromD = parseAnalyticsRangeDateUtc(summary.range.from, false);
    const toD = parseAnalyticsRangeDateUtc(summary.range.to, true);
    const fromMon = startOfUtcWeekMonday(fromD);
    const todayMon = startOfUtcWeekMonday(new Date());
    let apiIdx = 0;
    type Row = {
      name: string;
      avance: number;
      nuevoIngreso: number;
      retroceso: number;
      sinCambios: number;
      weekStartMs: number;
    };
    const out: Row[] = [];
    for (let cur = new Date(fromMon.getTime()); cur.getTime() <= todayMon.getTime(); ) {
      const axisName = weekAxisLabelUtc(cur);
      let row: Omit<Row, 'weekStartMs'>;
      if (cur.getTime() <= toD.getTime()) {
        if (apiIdx < apiRows.length) {
          const api = apiRows[apiIdx]!;
          apiIdx += 1;
          row = { ...api, name: axisName };
        } else {
          row = {
            name: axisName,
            avance: 0,
            nuevoIngreso: 0,
            retroceso: 0,
            sinCambios: 0,
          };
        }
      } else {
        row = {
          name: axisName,
          avance: 0,
          nuevoIngreso: 0,
          retroceso: 0,
          sinCambios: 0,
        };
      }
      out.push({ ...row, weekStartMs: cur.getTime() });
      const next = new Date(cur.getTime());
      next.setUTCDate(next.getUTCDate() + 7);
      cur = next;
    }
    return out;
  }, [summary]);

  const weeklyProgressWeekOptions = useMemo(
    () =>
      weeklyProgressExtended.map((r) => ({
        value: String(r.weekStartMs),
        label: `Hasta ${r.name}`,
      })),
    [weeklyProgressExtended],
  );

  const weeklyProgressDefaultCapMs = useMemo(() => {
    if (!weeklyProgressExtended.length) return null;
    return weeklyProgressExtended[weeklyProgressExtended.length - 1]!.weekStartMs;
  }, [weeklyProgressExtended]);

  useEffect(() => {
    if (weeklyProgressDefaultCapMs != null) {
      setWeeklyProgressCapMs(weeklyProgressDefaultCapMs);
    } else {
      setWeeklyProgressCapMs(null);
    }
  }, [weeklyProgressDefaultCapMs]);

  const weeklyProgressChartSlice = useMemo(() => {
    const cap = weeklyProgressCapMs ?? weeklyProgressDefaultCapMs;
    if (cap == null) {
      return {
        chartData: [] as {
          name: string;
          avance: number;
          nuevoIngreso: number;
          retroceso: number;
          sinCambios: number;
        }[],
        truncated: false,
        omittedWeeks: 0,
      };
    }
    const rows = weeklyProgressExtended
      .filter((r) => r.weekStartMs <= cap)
      .map(({ weekStartMs: _w, ...rest }) => rest);
    const max = WEEKLY_COMPANY_CHART_MAX_WEEKS;
    if (rows.length <= max) {
      return { chartData: rows, truncated: false, omittedWeeks: 0 };
    }
    return {
      chartData: rows.slice(-max),
      truncated: true,
      omittedWeeks: rows.length - max,
    };
  }, [weeklyProgressExtended, weeklyProgressCapMs, weeklyProgressDefaultCapMs]);

  const weeklyProgressChartData = weeklyProgressChartSlice.chartData;

  const kpis = summary?.kpis;
  const leadsByPeriodData = summary?.contactsByPeriod ?? [];
  const conversionData = summary?.conversionByMonth ?? [];
  const activitiesByTypeData = summary?.activitiesByTypeData ?? [];
  const followUpsData = summary?.followUpsByMonth ?? [];
  const salesByMonthData = summary?.salesByMonth ?? [];
  const performanceByAdvisor = summary?.performanceByAdvisor ?? [];

  const handleExport = useCallback(
    (format: 'PDF' | 'Excel' | 'CSV') => {
      if (loading || !summary) {
        toast.error('Espera a que carguen los datos o elige un periodo válido.');
        return;
      }
      const nameFromSession =
        (users.find((u) => u.id === currentUserId)?.name ?? currentUser.name) ||
        'Mi cartera';
      const advisorLabel = !canSeeAllAdvisors
        ? nameFromSession
        : advisorFilter === 'all'
          ? 'Todos los asesores'
          : activeAdvisors.find((u) => u.id === advisorFilter)?.name ??
            (advisorFilter === currentUserId
              ? (currentUser.name || currentUser.username)
              : advisorFilter);
      const sourceLabel =
        sourceOptions.find((o) => o.value === sourceFilter)?.label ?? sourceFilter;

      const payload: ReportsExportInput = {
        range: summary.range,
        meta: { advisorLabel, sourceLabel },
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
        downloadReport(format, payload, reportExportBaseFilename());
        toast.success(`Archivo ${format} generado`);
      } catch {
        toast.error('No se pudo generar el archivo. Intenta de nuevo.');
      }
    },
    [
      loading,
      summary,
      advisorFilter,
      users,
      activeAdvisors,
      canSeeAllAdvisors,
      currentUserId,
      currentUser,
      sourceFilter,
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

  const chartH = 'h-[300px]';

  const periodChartEmpty =
    !loading && (!summary || !chartHasAnyValue(leadsByPeriodData, ['leads', 'nuevos']));
  const sourceChartEmpty =
    !loading && (!summary || !chartHasAnyValue(leadsBySourceData, ['value']));
  const conversionChartEmpty =
    !loading && (!summary || !chartHasAnyValue(conversionData, ['tasa']));
  const advisorChartEmpty =
    !loading &&
    (!summary || !chartHasAnyValue(performanceByAdvisor, ['empresas', 'ventas']));
  const salesChartEmpty =
    !loading && (!summary || !chartHasAnyValue(salesByMonthData, ['ventas', 'meta']));
  const pipelineChartEmpty =
    !loading &&
    (!summary || !chartHasAnyValue(opportunitiesByStageData, ['value', 'count']));
  const activitiesChartEmpty =
    !loading &&
    (!summary ||
      !chartHasAnyValue(activitiesByTypeData, ['llamadas', 'reuniones', 'correos']));
  const followUpsChartEmpty =
    !loading &&
    (!summary || !chartHasAnyValue(followUpsData, ['completados', 'pendientes']));
  const companiesFunnelEmpty =
    !loading &&
    (!summary || !chartHasAnyValue(summary.companiesByStage ?? [], ['value']));
  const weeklyCompaniesChartEmpty =
    !loading &&
    (!summary ||
      !companiesWeeklyProgressData.some(
        (r) =>
          r.avance + r.nuevoIngreso + r.retroceso + r.sinCambios > 0,
      ));

  const summaryCards = useMemo(
    () => [
      {
        label: 'Contactos creados en el periodo',
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
        label: 'Tareas completadas',
        value: kpis ? String(kpis.activitiesCompleted) : '—',
        icon: Activity,
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-900/30',
        trend: 'En el periodo seleccionado',
        trendType: 'neutral' as const,
      },
    ],
    [kpis],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
      />

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

        <Select
          value={advisorFilter}
          onValueChange={setAdvisorFilter}
          disabled={!canSeeAllAdvisors}
        >
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue
              placeholder={
                canSeeAllAdvisors ? 'Asesor' : currentUser.name || 'Asesor'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {canSeeAllAdvisors ? (
              <>
                <SelectItem value="all">Todos los asesores</SelectItem>
                {advisorSelectOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </>
            ) : currentUserId ? (
              <SelectItem value={currentUserId}>
                {currentUser.name || currentUser.username}
              </SelectItem>
            ) : null}
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
            <Button
              variant="outline"
              size="sm"
              disabled={loading || !summary}
              onClick={() => handleExport('PDF')}
            >
              <FileText className="mr-1.5 size-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || !summary}
              onClick={() => handleExport('Excel')}
            >
              <FileSpreadsheet className="mr-1.5 size-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || !summary}
              onClick={() => handleExport('CSV')}
            >
              <FileDown className="mr-1.5 size-4" />
              CSV
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <Card key={`sk-${i}`} className="py-0">
                <CardContent className="space-y-3 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-[55%]" />
                    <Skeleton className="size-10 rounded-lg" />
                  </div>
                  <Skeleton className="h-8 w-[40%]" />
                  <Skeleton className="h-3 w-[70%]" />
                </CardContent>
              </Card>
            ))
          : summaryCards.map((card) => (
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
            <ChartCardBody
              loading={loading}
              isEmpty={periodChartEmpty}
              variant="area"
              emptyMessage="Sin evolución de contactos en este periodo."
              className={chartH}
            >
              <ResponsiveContainer width="100%" height="100%">
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
                      color: chartTheme.tooltipText,
                      fontSize: '13px',
                    }}
                    itemStyle={{ color: chartTheme.tooltipText }}
                    labelStyle={{ color: chartTheme.tooltipTextMuted, marginBottom: 4 }}
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
            </ChartCardBody>
          </CardContent>
        </Card>

        {/* 2. Contactos por Fuente - PieChart Donut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contactos por Fuente</CardTitle>
            <CardDescription>Distribución de contactos según canal de origen</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={loading}
              isEmpty={sourceChartEmpty}
              variant="donut"
              emptyMessage="Sin contactos por fuente en este periodo."
              className={chartH}
            >
              <ResponsiveContainer width="100%" height="100%">
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
                      color: chartTheme.tooltipText,
                      fontSize: '13px',
                    }}
                    itemStyle={{ color: chartTheme.tooltipText }}
                    labelStyle={{ color: chartTheme.tooltipTextMuted, marginBottom: 4 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCardBody>
          </CardContent>
        </Card>

        {/* Embudo empresas por etapa (izquierda); derecha reservada */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">Empresas por etapa</CardTitle>
              <CardDescription>
                Embudo según etapa comercial (empresas creadas en el periodo; respeta asesor y fuente).
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setCompaniesFunnelModalOpen(true)}
              disabled={loading || companiesFunnelEmpty}
              aria-label="Ampliar embudo de empresas por etapa"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={loading}
              isEmpty={companiesFunnelEmpty}
              variant="bar"
              emptyMessage="Sin empresas en este periodo con las etapas seleccionadas."
              className="min-h-[min(52vh,420px)] py-3"
            >
              <FunnelChart stages={companiesFunnelStages} height={360} />
            </ChartCardBody>
          </CardContent>
        </Card>

        <Dialog open={companiesFunnelModalOpen} onOpenChange={setCompaniesFunnelModalOpen}>
          <DialogContent
            className="flex max-h-[min(calc(100dvh-1.5rem),900px)] w-full max-w-[min(100vw-1rem,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,56rem)]"
            showCloseButton
          >
            <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Empresas por etapa</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {!companiesFunnelEmpty ? (
                <FunnelChart stages={companiesFunnelStages} height={500} showLegend />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
        <Card>
          <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <CardTitle className="text-base">Avance semanal · Empresas</CardTitle>
              <CardDescription className="text-sm leading-tight">
                Cambios de etapa por semana
                {weeklyProgressChartSlice.truncated && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Mostrando las últimas {WEEKLY_COMPANY_CHART_MAX_WEEKS} semanas; se omiten{' '}
                    {weeklyProgressChartSlice.omittedWeeks} semana
                    {weeklyProgressChartSlice.omittedWeeks === 1 ? '' : 's'} anteriores para
                    mantener el gráfico legible.
                  </span>
                )}
              </CardDescription>
            </div>
            {weeklyProgressWeekOptions.length > 0 && (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Select
                  value={
                    weeklyProgressCapMs != null
                      ? String(weeklyProgressCapMs)
                      : String(weeklyProgressWeekOptions[weeklyProgressWeekOptions.length - 1]!.value)
                  }
                  onValueChange={(v) => setWeeklyProgressCapMs(Number(v))}
                  disabled={loading || weeklyCompaniesChartEmpty}
                >
                  <SelectTrigger
                    className="h-9 min-w-[160px] sm:min-w-[200px]"
                    aria-label="Mostrar datos hasta esta semana (ISO, UTC)"
                  >
                    <SelectValue placeholder="Semana" />
                  </SelectTrigger>
                  <SelectContent>
                    {weeklyProgressWeekOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={loading}
              isEmpty={weeklyCompaniesChartEmpty}
              variant="barHorizontal"
              emptyMessage="Sin empresas en cartera en este periodo para este avance."
              className="h-[min(58vh,560px)] min-h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeklyProgressChartData}
                  layout="vertical"
                  margin={{ left: 4, right: 12, top: 8, bottom: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal stroke={chartTheme.gridStroke} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={76}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
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
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: 8 }} />
                  <Bar
                    dataKey="avance"
                    name="Avance"
                    stackId="weeklyCompanies"
                    fill={WEEKLY_COMPANY_COLORS.avance}
                    radius={[0, 0, 0, 0]}
                    barSize={18}
                  />
                  <Bar
                    dataKey="nuevoIngreso"
                    name="Nuevo ingreso"
                    stackId="weeklyCompanies"
                    fill={WEEKLY_COMPANY_COLORS.nuevoIngreso}
                    barSize={18}
                  />
                  <Bar
                    dataKey="retroceso"
                    name="Retroceso"
                    stackId="weeklyCompanies"
                    fill={WEEKLY_COMPANY_COLORS.retroceso}
                    barSize={18}
                  />
                  <Bar
                    dataKey="sinCambios"
                    name="Sin cambios"
                    stackId="weeklyCompanies"
                    fill={WEEKLY_COMPANY_COLORS.sinCambios}
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCardBody>
          </CardContent>
        </Card>

        {/* 3. Tasa de Conversión - LineChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasa de Conversión</CardTitle>
            <CardDescription>Porcentaje de conversión mensual de contactos a clientes</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={loading}
              isEmpty={conversionChartEmpty}
              variant="line"
              emptyMessage="Sin datos de conversión en este periodo."
              className={chartH}
            >
              <ResponsiveContainer width="100%" height="100%">
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
                      color: chartTheme.tooltipText,
                      fontSize: '13px',
                    }}
                    itemStyle={{ color: chartTheme.tooltipText }}
                    labelStyle={{ color: chartTheme.tooltipTextMuted, marginBottom: 4 }}
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
            </ChartCardBody>
          </CardContent>
        </Card>

        {/* 4. Rendimiento por Asesor - Horizontal BarChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rendimiento por Asesor</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={loading}
              isEmpty={advisorChartEmpty}
              variant="barHorizontal"
              emptyMessage="Sin rendimiento por asesor en este periodo."
              className={chartH}
            >
              <ResponsiveContainer width="100%" height="100%">
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
                      color: chartTheme.tooltipText,
                      fontSize: '13px',
                    }}
                    itemStyle={{ color: chartTheme.tooltipText }}
                    labelStyle={{ color: chartTheme.tooltipTextMuted, marginBottom: 4 }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="empresas" name="Empresas" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14} />
                  <Bar dataKey="ventas" name="Ventas" fill="#13944C" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCardBody>
          </CardContent>
        </Card>

        {/* 5. Ventas Cerradas por Mes - BarChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas Cerradas por Mes</CardTitle>
            <CardDescription>Ingresos mensuales vs meta establecida</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={loading}
              isEmpty={salesChartEmpty}
              variant="bar"
              emptyMessage="Sin ventas por mes en este periodo."
              className={chartH}
            >
              <SalesByMonthBarChart data={salesByMonthData} variant="reports" barSize={28} />
            </ChartCardBody>
          </CardContent>
        </Card>

        {/* 6. Pipeline por Etapa - BarChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline por Etapa</CardTitle>
            <CardDescription>Valor total de oportunidades por etapa del embudo</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={loading}
              isEmpty={pipelineChartEmpty}
              variant="bar"
              emptyMessage="Sin oportunidades por etapa en este periodo."
              className={chartH}
            >
              <ResponsiveContainer width="100%" height="100%">
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
                      color: chartTheme.tooltipText,
                      fontSize: '13px',
                    }}
                    itemStyle={{ color: chartTheme.tooltipText }}
                    labelStyle={{ color: chartTheme.tooltipTextMuted, marginBottom: 4 }}
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
            </ChartCardBody>
          </CardContent>
        </Card>

        {/* 7. Actividades Realizadas - Stacked BarChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actividades Realizadas</CardTitle>
            <CardDescription>Desglose mensual por tipo de actividad comercial</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={loading}
              isEmpty={activitiesChartEmpty}
              variant="stackedBar"
              emptyMessage="Sin actividades registradas en este periodo."
              className={chartH}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activitiesByTypeData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
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
                  <Bar dataKey="llamadas" name="Llamadas" stackId="a" fill="#13944C" />
                  <Bar dataKey="reuniones" name="Reuniones" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="correos" name="Correos" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCardBody>
          </CardContent>
        </Card>

        {/* 8. Tareas - LineChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tareas</CardTitle>
            <CardDescription>Completadas vs pendientes por mes</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={loading}
              isEmpty={followUpsChartEmpty}
              variant="line"
              emptyMessage="Sin tareas en este periodo."
              className={chartH}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={followUpsData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
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
                  <Line
                    type="monotone"
                    dataKey="completados"
                    name="Completadas"
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
            </ChartCardBody>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
