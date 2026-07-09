import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DateRange } from 'react-day-picker';
import html2canvas from 'html2canvas';
import { useUsers } from '@/hooks/useUsers';
import { PageHeader } from '@/components/shared/PageHeader';
import { MetricCard } from '@/components/shared/MetricCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DateRangeFilterButton } from '@/components/ui/date-range-filter-button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PdfSvgIcon } from '@/components/icons/PdfSvgIcon';
import { XlsSvgIcon } from '@/components/icons/XlsSvgIcon';
import { cn } from '@/lib/utils';
import {
  comercialFilterActionClass,
  comercialFilterSurfaceClass,
} from '@/lib/comercialFilterSurface';
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Maximize2, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useChartTheme } from '@/hooks/useChartTheme';
import { formatCurrency } from '@/lib/formatters';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ADVISOR_OTHERS,
  ADVISOR_UNASSIGNED,
  useMultiAdvisorFilter,
} from '@/hooks/useMultiAdvisorFilter';
import { MultiAdvisorFilter } from '@/components/shared/MultiAdvisorFilter';
import { MultiSourceFilter } from '@/components/shared/MultiSourceFilter';
import { contactSourceLabels } from '@/data/mock';
import {
  fetchAnalyticsSummary,
  fetchAnalyticsKPIs,
  formatLocalISODate,
  analyticsYearToDateRange,
  type AnalyticsSummary,
  type AnalyticsKPIs,
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
  useLeadSourceOptions,
} from '@/store/crmConfigStore';
import { ChartCardBody } from '@/components/shared/ChartCardBody';
import { SalesByMonthBarChart } from '@/components/shared/SalesByMonthBarChart';
import { chartHasAnyValue } from '@/lib/chartEmpty';
import { Skeleton } from '@/components/ui/skeleton';
import { FunnelChart, type FunnelStage } from '@/components/crm/FunnelChart';
import { buildOpportunitiesStageFunnelStages } from '@/lib/companyStageFunnelData';
import { AdvisorPerformanceBarChart } from '@/components/shared/AdvisorPerformanceBarChart';
import { ContactsOpportunitiesAreaChart } from '@/components/shared/ContactsOpportunitiesAreaChart';
import { CompaniesBySourceRadialChart } from '@/components/shared/CompaniesBySourceRadialChart';

const COLORS = ['#13944C', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

const WEEKLY_COMPANY_COLORS = {
  avance: '#3b82f6',
  nuevoIngreso: '#13944C',
  retroceso: '#f59e0b',
  sinCambios: '#ef4444',
} as const;

const WEEKLY_OPPORTUNITY_COLORS = {
  avance: '#3b82f6',
  nuevoIngreso: '#8b5cf6',
  atrasoo: '#f59e0b',
  sinCambios: '#ef4444',
} as const;

/** Si el periodo tiene más semanas, solo se dibujan las más recientes (las iniciales se omiten). */
const WEEKLY_COMPANY_CHART_MAX_WEEKS = 20;

function weeklySparkValues(series: { value: number }[] | undefined): number[] {
  return (series ?? []).map((x) => x.value);
}

function weeklySparkLabels(series: { name: string }[] | undefined): string[] {
  return (series ?? []).map((x) => x.name);
}

function changeTone(s: string): 'positive' | 'negative' | 'neutral' {
  const t = s.trim();
  if (t.startsWith('-')) return 'negative';
  if (t.startsWith('+')) return 'positive';
  return 'neutral';
}

import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

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
  return Math.ceil((x.getTime() - yearStart.getTime() + 86400000) / 86400000 / 7);
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
  const leadSourceOptions = useLeadSourceOptions();
  const {
    selectedIds: advisorFilter,
    setSelectedIds: setAdvisorFilter,
    canSeeAllAdvisors,
    currentUserId,
    isInitialized: advisorFilterInitialized,
    isActive: advisorFilterIsActive,
    queryParams: advisorListParams,
  } = useMultiAdvisorFilter();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(subMonths(new Date(), 1)),
    to: endOfMonth(new Date()),
  });
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [kpis, setKpis] = useState<AnalyticsKPIs | null>(null);
  const [loading, setLoading] = useState(false);
  const [kpisLoading, setKpisLoading] = useState(false);
  /** Lunes UTC (ms) de la última semana visible en el gráfico de avance semanal. */
  const [weeklyProgressCapMs, setWeeklyProgressCapMs] = useState<number | null>(null);
  const [weeklyOppsProgressCapMs, setWeeklyOppsProgressCapMs] = useState<number | null>(null);
  const [opportunitiesFunnelModalOpen, setOpportunitiesFunnelModalOpen] = useState(false);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [weeklyCompaniesModalOpen, setWeeklyCompaniesModalOpen] = useState(false);
  const [weeklyOpportunitiesModalOpen, setWeeklyOpportunitiesModalOpen] = useState(false);
  const [conversionModalOpen, setConversionModalOpen] = useState(false);
  const [advisorPerfModalOpen, setAdvisorPerfModalOpen] = useState(false);
  const [salesByMonthModalOpen, setSalesByMonthModalOpen] = useState(false);
  const [activitiesModalOpen, setActivitiesModalOpen] = useState(false);
  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const chartTheme = useChartTheme();

  const dialogContentClass =
    "flex max-h-[min(calc(100dvh-1.5rem),900px)] w-full max-w-[min(100vw-1rem,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,56rem)]";

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) {
      setKpis(null);
      return;
    }
    const from = formatLocalISODate(dateRange.from);
    const to = formatLocalISODate(dateRange.to);
    const source = sourceFilter.length > 0 ? sourceFilter.join(',') : undefined;
    let cancelled = false;

    setKpisLoading(true);
    void fetchAnalyticsKPIs({
      from,
      to,
      assignedTo: advisorListParams.assignedTo,
      excludeAssignedTo: advisorListParams.excludeAssignedTo,
      advisorPool: advisorListParams.advisorPool,
      source,
      area: 'comercial',
    })
      .then((data) => {
        if (!cancelled) setKpis(data);
      })
      .catch(() => {
        if (!cancelled) setKpis(null);
      })
      .finally(() => {
        if (!cancelled) setKpisLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    dateRange?.from?.getTime(),
    dateRange?.to?.getTime(),
    advisorListParams.assignedTo,
    advisorListParams.excludeAssignedTo,
    advisorListParams.advisorPool,
    sourceFilter,
  ]);

  useEffect(() => {
    const { from, to } = analyticsYearToDateRange();
    const source = sourceFilter.length > 0 ? sourceFilter.join(',') : undefined;
    let cancelled = false;

    setLoading(true);
    void fetchAnalyticsSummary({
      from,
      to,
      assignedTo: advisorListParams.assignedTo,
      excludeAssignedTo: advisorListParams.excludeAssignedTo,
      advisorPool: advisorListParams.advisorPool,
      source,
      area: 'comercial',
      sparklineWeeks: 10,
    })
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
  }, [
    advisorListParams.assignedTo,
    advisorListParams.excludeAssignedTo,
    advisorListParams.advisorPool,
    sourceFilter,
  ]);

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

  const companiesBySourceData = useMemo(() => {
    if (!summary) return [];
    return summary.companiesBySource.map((x) => ({
      ...x,
      name: getSourceLabelFromCatalog(x.name, bundle, contactSourceLabels),
    }));
  }, [summary, bundle]);

  const opportunitiesFunnelStages: FunnelStage[] = useMemo(
    () => buildOpportunitiesStageFunnelStages(summary?.opportunitiesByStage ?? [], bundle),
    [summary?.opportunitiesByStage, bundle],
  );

  const companiesWeeklyProgressData = useMemo(
    () => summary?.companiesWeeklyProgress ?? [],
    [summary?.companiesWeeklyProgress],
  );

  const opportunitiesWeeklyProgressData = useMemo(
    () => summary?.opportunitiesWeeklyProgress ?? [],
    [summary?.opportunitiesWeeklyProgress],
  );

  /** Semanas desde el inicio del rango del reporte hasta la semana ISO actual (UTC); rellena ceros tras el `to` del API. */
  const weeklyProgressExtended = useMemo(() => {
    if (!summary?.range?.from || !summary?.range?.to) return [];
    const apiRows = summary.companiesWeeklyProgress ?? [];
    const fromD = parseAnalyticsRangeDateUtc(summary.range.from, false);
    const toD = parseAnalyticsRangeDateUtc(summary.range.to, true);
    const fromMon = startOfUtcWeekMonday(fromD);
    const todayMon = startOfUtcWeekMonday(new Date());
    // Index API rows by ISO week number so each row lands on the correct axis position.
    const apiByWeek = new Map(apiRows.map((r) => [Number(r.name), r]));
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
      const weekNum = isoWeekNumberUtc(cur);
      const api = cur.getTime() <= toD.getTime() ? apiByWeek.get(weekNum) : undefined;
      const row: Omit<Row, 'weekStartMs'> = api
        ? { ...api, name: axisName }
        : { name: axisName, avance: 0, nuevoIngreso: 0, retroceso: 0, sinCambios: 0 };
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

  /** Semanas desde el inicio del rango del reporte hasta la semana ISO actual (UTC); rellena ceros tras el `to` del API para oportunidades. */
  const weeklyOppsProgressExtended = useMemo(() => {
    if (!summary?.range?.from || !summary?.range?.to) return [];
    const apiRows = summary.opportunitiesWeeklyProgress ?? [];
    const fromD = parseAnalyticsRangeDateUtc(summary.range.from, false);
    const toD = parseAnalyticsRangeDateUtc(summary.range.to, true);
    const fromMon = startOfUtcWeekMonday(fromD);
    const todayMon = startOfUtcWeekMonday(new Date());
    // Index API rows by ISO week number so each row lands on the correct axis position.
    const apiByWeek = new Map(apiRows.map((r) => [Number(r.name), r]));
    type RowOpp = {
      name: string;
      avance: number;
      nuevoIngreso: number;
      atraso: number;
      sinCambios: number;
      weekStartMs: number;
    };
    const out: RowOpp[] = [];
    for (let cur = new Date(fromMon.getTime()); cur.getTime() <= todayMon.getTime(); ) {
      const axisName = weekAxisLabelUtc(cur);
      const weekNum = isoWeekNumberUtc(cur);
      const api = cur.getTime() <= toD.getTime() ? apiByWeek.get(weekNum) : undefined;
      const row: Omit<RowOpp, 'weekStartMs'> = api
        ? { avance: api.avance, nuevoIngreso: api.nuevoIngreso, atraso: api.atraso, sinCambios: api.sinCambios, name: axisName }
        : { name: axisName, avance: 0, nuevoIngreso: 0, atraso: 0, sinCambios: 0 };
      out.push({ ...row, weekStartMs: cur.getTime() });
      const next = new Date(cur.getTime());
      next.setUTCDate(next.getUTCDate() + 7);
      cur = next;
    }
    return out;
  }, [summary]);

  const weeklyOppsProgressChartEmpty = useMemo(
    () => !weeklyOppsProgressExtended.some((r) => r.avance || r.nuevoIngreso || r.atraso || r.sinCambios),
    [weeklyOppsProgressExtended],
  );

  const weeklyOppsProgressWeekOptions = useMemo(
    () =>
      weeklyOppsProgressExtended.map((r) => ({
        value: String(r.weekStartMs),
        label: `Hasta ${r.name}`,
      })),
    [weeklyOppsProgressExtended],
  );

  const weeklyOppsProgressDefaultCapMs = useMemo(() => {
    if (!weeklyOppsProgressExtended.length) return null;
    return weeklyOppsProgressExtended[weeklyOppsProgressExtended.length - 1]!.weekStartMs;
  }, [weeklyOppsProgressExtended]);

  useEffect(() => {
    if (weeklyOppsProgressDefaultCapMs != null) {
      setWeeklyOppsProgressCapMs(weeklyOppsProgressDefaultCapMs);
    } else {
      setWeeklyOppsProgressCapMs(null);
    }
  }, [weeklyOppsProgressDefaultCapMs]);

  const weeklyOppsProgressChartSlice = useMemo(() => {
    const cap = weeklyOppsProgressCapMs ?? weeklyOppsProgressDefaultCapMs;
    if (cap == null) {
      return {
        chartData: [] as {
          name: string;
          avance: number;
          nuevoIngreso: number;
          atraso: number;
          sinCambios: number;
        }[],
        truncated: false,
        omittedWeeks: 0,
      };
    }
    const rows = weeklyOppsProgressExtended
      .filter((r) => r.weekStartMs <= cap)
      .filter((r) => r.avance || r.nuevoIngreso || r.atraso || r.sinCambios)
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
  }, [weeklyOppsProgressExtended, weeklyOppsProgressCapMs, weeklyOppsProgressDefaultCapMs]);

  const weeklyOppsProgressChartData = weeklyOppsProgressChartSlice.chartData;

  const contactsVsOpportunitiesData = summary?.contactsVsOpportunitiesByMonth ?? [];
  const conversionData = summary?.conversionByMonth ?? [];
  const activitiesByTypeData = summary?.activitiesByTypeData ?? [];
  const followUpsData = summary?.followUpsByMonth ?? [];
  const salesByMonthData = summary?.salesByMonth ?? [];
  const performanceByAdvisor = summary?.performanceByAdvisor ?? [];

  const handleExport = useCallback(
    (format: 'PDF' | 'Excel') => {
      if (loading || !summary || !kpis) {
        toast.error('Espera a que carguen los datos o elige un periodo válido.');
        return;
      }
      const nameFromSession =
        (users.find((u) => u.id === currentUserId)?.name ?? currentUser.name) ||
        'Mi cartera';
      const advisorLabel = !canSeeAllAdvisors
        ? nameFromSession
        : !advisorFilterIsActive
          ? 'Todos los asesores'
          : advisorFilter.length === 0
            ? 'Ninguno'
            : advisorFilter
                .map((id) => {
                  if (id === ADVISOR_UNASSIGNED) return 'Sin asignar';
                  if (id === ADVISOR_OTHERS) return 'Otros';
                  return (
                    activeAdvisors.find((u) => u.id === id)?.name ??
                    (id === currentUserId
                      ? currentUser.name || currentUser.username
                      : id)
                  );
                })
                .join(', ');
      const sourceLabel =
        sourceFilter.length === 0
          ? 'Todas las fuentes'
          : sourceFilter
              .map((key) =>
                getSourceLabelFromCatalog(key, bundle, contactSourceLabels),
              )
              .join(', ');

      const payload: ReportsExportInput = {
        range: kpis.range,
        meta: { advisorLabel, sourceLabel },
        kpis,
        contactsVsOpportunitiesByMonth: contactsVsOpportunitiesData,
        contactsBySource: leadsBySourceData,
        conversionByMonth: conversionData,
        performanceByAdvisor,
        salesByMonth: salesByMonthData,
        opportunitiesByStage: opportunitiesByStageData,
        activitiesByType: activitiesByTypeData,
        followUpsByMonth: followUpsData,
        companiesByStage: opportunitiesFunnelStages,
        weeklyOppsData: weeklyOppsProgressChartData,
      };

      if (format === 'PDF') {
        setExportingPdf(true);
        const captureCharts = async () => {
          const chartIds = {
            contacts: 'chart-contacts',
            sources: 'chart-sources',
            funnel: 'chart-funnel',
            weeklyOpps: 'chart-weekly-opps',
            conversion: 'chart-conversion',
            performance: 'chart-performance',
            sales: 'chart-sales',
            pipeline: 'chart-pipeline',
            activities: 'chart-activities',
            tasks: 'chart-tasks',
          };
          const chartImages: ReportsExportInput['charts'] = {};

          // Esperar a que las animaciones terminen
          await new Promise((resolve) => setTimeout(resolve, 1000));

          for (const [key, id] of Object.entries(chartIds)) {
            const cardEl = document.getElementById(id);
            if (!cardEl) continue;

            try {
              // Senior Strategy: En lugar de confiar en un selector, buscamos todos los SVGs 
              // y nos quedamos con el que tenga mayor altura (el gráfico principal).
              // Esto ignora automáticamente iconos de leyenda, botones y decoraciones.
              const allSvgs = Array.from(cardEl.querySelectorAll('svg'));
              if (allSvgs.length === 0) continue;

              const svgEl = allSvgs.reduce((prev, current) => {
                return (current.clientHeight > prev.clientHeight) ? current : prev;
              });

              if (!svgEl || svgEl.clientHeight < 50) { // Si es muy pequeño, probablemente no es el gráfico
                console.warn(`No se encontró un SVG válido para el gráfico en ${id}`);
                continue;
              }

              // Clonamos el SVG para manipularlo sin afectar la UI
              const clonedSvg = svgEl.cloneNode(true) as SVGElement;
              
              // Paso Senior: Aseguramos que el SVG tenga dimensiones explícitas
              const width = svgEl.clientWidth || 800;
              const height = svgEl.clientHeight || 400;
              clonedSvg.setAttribute('width', width.toString());
              clonedSvg.setAttribute('height', height.toString());

              // Serializar SVG a XML
              const svgData = new XMLSerializer().serializeToString(clonedSvg);
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const img = new Image();
              
              canvas.width = width * 2; // Alta resolución
              canvas.height = height * 2;
              
              const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
              const url = URL.createObjectURL(svgBlob);

              await new Promise((resolve, reject) => {
                img.onload = () => {
                  if (ctx) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    chartImages[key as keyof typeof chartIds] = canvas.toDataURL('image/png');
                  }
                  URL.revokeObjectURL(url);
                  resolve(true);
                };
                img.onerror = reject;
                img.src = url;
              });
            } catch (e) {
              console.error(`Error capturando gráfico ${id} vía SVG:`, e);
            }
          }
          return chartImages;
        };

        void captureCharts().then((charts) => {
          try {
            downloadReport(format, { ...payload, charts }, reportExportBaseFilename());
            toast.success(`Reporte PDF con gráficos generado`);
          } catch (err) {
            console.error(err);
            toast.error('Error al generar PDF con gráficos. Intenta de nuevo.');
          } finally {
            setExportingPdf(false);
          }
        });
        return;
      }

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
      kpis,
      advisorFilter,
      advisorFilterIsActive,
      users,
      activeAdvisors,
      canSeeAllAdvisors,
      currentUserId,
      currentUser,
      sourceFilter,
      contactsVsOpportunitiesData,
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
  const contactsAreaChartHeight = 290;
  const sourceRadialChartHeight = 350;

  const periodChartEmpty =
    !loading &&
    (!summary ||
      !chartHasAnyValue(contactsVsOpportunitiesData, ['contactos', 'oportunidades']));
  const sourceChartEmpty =
    !loading && (!summary || !chartHasAnyValue(companiesBySourceData, ['value']));
  const conversionChartEmpty =
    !loading && (!summary || !chartHasAnyValue(conversionData, ['tasa']));
  const advisorChartEmpty =
    !loading &&
    (!summary || !chartHasAnyValue(performanceByAdvisor, ['oportunidades', 'contactos', 'empresas']));
  const salesChartEmpty =
    !loading && (!summary || !chartHasAnyValue(salesByMonthData, ['ventas', 'meta']));
  const activitiesChartEmpty =
    !loading &&
    (!summary ||
      !chartHasAnyValue(activitiesByTypeData, ['llamadas', 'reuniones', 'correos']));
  const followUpsChartEmpty =
    !loading &&
    (!summary || !chartHasAnyValue(followUpsData, ['completados', 'pendientes']));
  const opportunitiesFunnelEmpty =
    !loading &&
    (!summary || !chartHasAnyValue(summary.opportunitiesByStage ?? [], ['count']));
  const weeklyCompaniesChartEmpty =
    !loading &&
    (!summary ||
      !companiesWeeklyProgressData.some(
        (r) =>
          r.avance + r.nuevoIngreso + r.retroceso + r.sinCambios > 0,
      ));

  const contactsSparkline = useMemo(
    () => weeklySparkValues(summary?.contactsWeekly),
    [summary?.contactsWeekly],
  );
  const contactsSparklineLabels = useMemo(
    () => weeklySparkLabels(summary?.contactsWeekly),
    [summary?.contactsWeekly],
  );
  const wonSparkline = useMemo(
    () => weeklySparkValues(summary?.wonOpportunitiesWeekly),
    [summary?.wonOpportunitiesWeekly],
  );
  const wonSparklineLabels = useMemo(
    () => weeklySparkLabels(summary?.wonOpportunitiesWeekly),
    [summary?.wonOpportunitiesWeekly],
  );
  const salesSparkline = useMemo(
    () => weeklySparkValues(summary?.salesWeekly),
    [summary?.salesWeekly],
  );
  const salesSparklineLabels = useMemo(
    () => weeklySparkLabels(summary?.salesWeekly),
    [summary?.salesWeekly],
  );
  const tasksSparkline = useMemo(
    () => weeklySparkValues(summary?.activitiesCompletedWeekly),
    [summary?.activitiesCompletedWeekly],
  );
  const tasksSparklineLabels = useMemo(
    () => weeklySparkLabels(summary?.activitiesCompletedWeekly),
    [summary?.activitiesCompletedWeekly],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description="KPIs por periodo seleccionado · gráficos con datos del año en curso"
      >
        <DateRangeFilterButton
          value={dateRange}
          onChange={setDateRange}
          placeholder="Seleccionar periodo"
          className={cn('w-[260px]', comercialFilterSurfaceClass)}
        />

        <MultiAdvisorFilter
          value={advisorFilter}
          onChange={setAdvisorFilter}
          advisors={activeAdvisors}
          disabled={!canSeeAllAdvisors}
          isActive={advisorFilterIsActive}
          isInitialized={advisorFilterInitialized}
          className={cn('!h-12 w-[190px]', comercialFilterSurfaceClass)}
        />

        <MultiSourceFilter
          value={sourceFilter}
          onChange={setSourceFilter}
          options={leadSourceOptions}
          className={cn('!h-12 w-[190px]', comercialFilterSurfaceClass)}
        />

        {hasPermission('reportes.exportar') && (
          <>
            <button
              type="button"
              disabled={loading || !summary || exportingPdf}
              onClick={() => handleExport('PDF')}
              className={cn(comercialFilterActionClass, 'cursor-pointer')}
            >
              {exportingPdf ? (
                <Loader2 className="size-5 shrink-0 animate-spin" />
              ) : (
                <PdfSvgIcon className="size-5 shrink-0" />
              )}
              {exportingPdf ? 'Generando…' : 'PDF'}
            </button>
            <button
              type="button"
              disabled={loading || !summary}
              onClick={() => handleExport('Excel')}
              className={cn(comercialFilterActionClass, 'cursor-pointer')}
            >
              <XlsSvgIcon className="size-5 shrink-0" />
              Excel
            </button>
          </>
        )}
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Contactos creados en el periodo"
          value={kpis?.totalContacts ?? '—'}
          change={kpis ? kpis.changes.contacts : undefined}
          changeType={kpis ? changeTone(kpis.changes.contacts) : 'neutral'}
          description="últimos 7 días"
          sparklineData={contactsSparkline}
          sparklineLabels={contactsSparklineLabels}
          sparklineColor="#22c55e"
          sparklineVariant="line"
          sparklineLoading={loading}
          loading={kpisLoading}
        />
        <MetricCard
          title="Ganadas en el periodo"
          value={kpis?.conversionPct ?? '—'}
          description="En el periodo seleccionado"
          sparklineData={wonSparkline}
          sparklineLabels={wonSparklineLabels}
          sparklineColor="#3b82f6"
          sparklineVariant="line"
          sparklineLoading={loading}
          loading={kpisLoading}
        />
        <MetricCard
          title="Ventas Cerradas"
          value={kpis ? formatCurrency(kpis.closedSalesAmount) : '—'}
          change={kpis ? kpis.changes.sales : undefined}
          changeType={kpis ? changeTone(kpis.changes.sales) : 'neutral'}
          description="últimos 7 días"
          sparklineData={salesSparkline}
          sparklineLabels={salesSparklineLabels}
          sparklineColor="#f97316"
          sparklineVariant="line"
          sparklineLoading={loading}
          loading={kpisLoading}
        />
        <MetricCard
          title="Tareas completadas"
          value={kpis?.activitiesCompleted ?? '—'}
          description="En el periodo seleccionado"
          sparklineData={tasksSparkline}
          sparklineLabels={tasksSparklineLabels}
          sparklineColor="#8b5cf6"
          sparklineVariant="line"
          sparklineLoading={loading}
          loading={kpisLoading}
        />
      </div>

      {/* Charts Grid — fila principal: contactos (ancho) + fuentes (estrecho) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start">
        {/* 1. Contactos vs Oportunidades - Apex AreaChart (año en curso) */}
        <Card id="chart-contacts" className="h-fit">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 px-5 pb-0 pt-5">
            <CardTitle className="text-base font-medium">Contactos y Oportunidades</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setPeriodModalOpen(true)}
              disabled={loading || periodChartEmpty}
              aria-label="Ampliar contactos y oportunidades"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="px-5 pt-6 pb-5">
            <ChartCardBody
              loading={loading}
              isEmpty={periodChartEmpty}
              variant="area"
              emptyMessage="Sin contactos ni oportunidades en el año."
              className="h-auto"
            >
              <ContactsOpportunitiesAreaChart
                data={contactsVsOpportunitiesData}
                height={contactsAreaChartHeight}
              />
            </ChartCardBody>
          </CardContent>
        </Card>

        {/* 2. Empresas por Fuente - RadialBar */}
        <Card id="chart-sources" className="h-fit">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 px-5 pb-0 pt-5">
            <CardTitle className="text-base font-medium">Empresas por Fuente</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setSourceModalOpen(true)}
              disabled={loading || sourceChartEmpty}
              aria-label="Ampliar empresas por fuente"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="px-5 pt-5 pb-5">
            <ChartCardBody
              loading={loading}
              isEmpty={sourceChartEmpty}
              variant="donut"
              emptyMessage="Sin empresas por fuente en este periodo."
              className="h-auto"
            >
              <CompaniesBySourceRadialChart
                data={companiesBySourceData}
                chartHeight={sourceRadialChartHeight}
              />
            </ChartCardBody>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Oportunidades por etapa */}
        <Card id="chart-funnel">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2 max-md:pb-1.5">
            <CardTitle className="text-base font-medium">Oportunidades por etapa</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setOpportunitiesFunnelModalOpen(true)}
              disabled={loading || opportunitiesFunnelEmpty}
              aria-label="Ampliar oportunidades por etapa"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="max-md:px-3 max-md:pb-2 max-md:pt-0">
            <ChartCardBody
              loading={loading}
              isEmpty={opportunitiesFunnelEmpty}
              variant="bar"
              emptyMessage="Sin oportunidades en este periodo con las etapas seleccionadas."
              className="min-h-[min(56vh,460px)] py-3 max-md:min-h-0 max-md:py-1"
            >
              <FunnelChart stages={opportunitiesFunnelStages} height={420} singularLabel="oportunidad" />
            </ChartCardBody>
          </CardContent>
        </Card>

        <Dialog open={opportunitiesFunnelModalOpen} onOpenChange={setOpportunitiesFunnelModalOpen}>
          <DialogContent
            className={dialogContentClass}
            showCloseButton
          >
            <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Oportunidades por etapa</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {!opportunitiesFunnelEmpty ? (
                <FunnelChart stages={opportunitiesFunnelStages} height={560} showLegend singularLabel="oportunidad" />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={periodModalOpen} onOpenChange={setPeriodModalOpen}>
          <DialogContent className={dialogContentClass} showCloseButton>
            <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Contactos y Oportunidades</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {!periodChartEmpty ? (
                <ContactsOpportunitiesAreaChart
                  data={contactsVsOpportunitiesData}
                  height={520}
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={sourceModalOpen} onOpenChange={setSourceModalOpen}>
          <DialogContent className={dialogContentClass} showCloseButton>
            <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Empresas por Fuente</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {!sourceChartEmpty ? (
                <CompaniesBySourceRadialChart
                  data={companiesBySourceData}
                  chartHeight={480}
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={weeklyCompaniesModalOpen} onOpenChange={setWeeklyCompaniesModalOpen}>
          <DialogContent className={dialogContentClass} showCloseButton>
            <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Avance semanal · Empresas</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {!weeklyCompaniesChartEmpty ? (
                <div className="h-[560px] min-h-[360px] w-full">
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
                        isAnimationActive={!exportingPdf}
                        dataKey="avance"
                        name="Avance"
                        stackId="weeklyCompanies"
                        fill={WEEKLY_COMPANY_COLORS.avance}
                        radius={[0, 0, 0, 0]}
                        barSize={18}
                      />
                      <Bar
                        isAnimationActive={!exportingPdf}
                        dataKey="nuevoIngreso"
                        name="Nuevo ingreso"
                        stackId="weeklyCompanies"
                        fill={WEEKLY_COMPANY_COLORS.nuevoIngreso}
                        barSize={18}
                      />
                      <Bar
                        isAnimationActive={!exportingPdf}
                        dataKey="retroceso"
                        name="Retroceso"
                        stackId="weeklyCompanies"
                        fill={WEEKLY_COMPANY_COLORS.retroceso}
                        barSize={18}
                      />
                      <Bar
                        isAnimationActive={!exportingPdf}
                        dataKey="sinCambios"
                        name="Sin cambios"
                        stackId="weeklyCompanies"
                        fill={WEEKLY_COMPANY_COLORS.sinCambios}
                        radius={[0, 4, 4, 0]}
                        barSize={18}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={conversionModalOpen} onOpenChange={setConversionModalOpen}>
          <DialogContent className={dialogContentClass} showCloseButton>
            <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Ganadas por Mes</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {!conversionChartEmpty ? (
                <div className="h-[520px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={conversionData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
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
                        formatter={(value?: number) => [value ?? 0, 'Convertidas']}
                      />
                      <Line
                        type="monotone"
                        dataKey="tasa"
                        name="Convertidas a Activo"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
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
                        isAnimationActive={!exportingPdf}
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
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={advisorPerfModalOpen} onOpenChange={setAdvisorPerfModalOpen}>
          <DialogContent className={dialogContentClass} showCloseButton>
            <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Rendimiento por Asesor</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {!advisorChartEmpty ? (
                <AdvisorPerformanceBarChart data={performanceByAdvisor} height={520} />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={salesByMonthModalOpen} onOpenChange={setSalesByMonthModalOpen}>
          <DialogContent className={dialogContentClass} showCloseButton>
            <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Ventas Cerradas por Mes</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {!salesChartEmpty ? (
                <div className="h-[520px] w-full">
                  <SalesByMonthBarChart data={salesByMonthData} variant="reports" barSize={32} isAnimationActive={!exportingPdf} />
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>



        <Dialog open={activitiesModalOpen} onOpenChange={setActivitiesModalOpen}>
          <DialogContent className={dialogContentClass} showCloseButton>
            <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Actividades Realizadas</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {!activitiesChartEmpty ? (
                <div className="h-[520px] w-full">
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
                      <Bar isAnimationActive={!exportingPdf} dataKey="llamadas" name="Llamadas" stackId="a" fill="#13944C" />
                      <Bar isAnimationActive={!exportingPdf} dataKey="reuniones" name="Reuniones" stackId="a" fill="#3b82f6" />
                      <Bar isAnimationActive={!exportingPdf} dataKey="correos" name="Correos" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={tasksModalOpen} onOpenChange={setTasksModalOpen}>
          <DialogContent className={dialogContentClass} showCloseButton>
            <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Tareas</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {!followUpsChartEmpty ? (
                <div className="h-[520px] w-full">
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
                        isAnimationActive={!exportingPdf}
                        type="monotone"
                        dataKey="completados"
                        name="Completadas"
                        stroke="#13944C"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#13944C', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        isAnimationActive={!exportingPdf}
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
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
        {/*<Card>
          <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <CardTitle className="text-base font-medium">Avance semanal · Empresas</CardTitle>
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
            <div className="flex shrink-0 items-center gap-2">
              {weeklyProgressWeekOptions.length > 0 && (
                <>
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                    onClick={() => setWeeklyCompaniesModalOpen(true)}
                    disabled={loading || weeklyCompaniesChartEmpty}
                    aria-label="Ampliar avance semanal de empresas"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
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
        </Card>*/}

        <Dialog open={weeklyOpportunitiesModalOpen} onOpenChange={setWeeklyOpportunitiesModalOpen}>
          <DialogContent className={dialogContentClass} showCloseButton>
            <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Avance semanal · Oportunidades</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {!weeklyOppsProgressChartEmpty ? (
                <div className="h-[560px] min-h-[360px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={weeklyOppsProgressChartData}
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
                        stackId="weeklyOpps"
                        fill={WEEKLY_OPPORTUNITY_COLORS.avance}
                        radius={[0, 0, 0, 0]}
                        barSize={18}
                      />
                      <Bar
                        dataKey="nuevoIngreso"
                        name="Nuevo"
                        stackId="weeklyOpps"
                        fill={WEEKLY_OPPORTUNITY_COLORS.nuevoIngreso}
                        barSize={18}
                      />
                      <Bar
                        dataKey="atraso"
                        name="Atraso"
                        stackId="weeklyOpps"
                        fill={WEEKLY_OPPORTUNITY_COLORS.atrasoo}
                        barSize={18}
                      />
                      <Bar
                        dataKey="sinCambios"
                        name="Sin cambios"
                        stackId="weeklyOpps"
                        fill={WEEKLY_OPPORTUNITY_COLORS.sinCambios}
                        radius={[0, 4, 4, 0]}
                        barSize={18}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  No hay datos de oportunidades
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* 2. Avance semanal - Oportunidades */}
        <Card id="chart-weekly-opps">
          <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base font-medium">Avance semanal · Oportunidades</CardTitle>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {weeklyOppsProgressWeekOptions.length > 0 && (
                <>
                  <Select
                    value={
                      weeklyOppsProgressCapMs != null
                        ? String(weeklyOppsProgressCapMs)
                        : String(weeklyOppsProgressWeekOptions[weeklyOppsProgressWeekOptions.length - 1]!.value)
                    }
                    onValueChange={(v) => setWeeklyOppsProgressCapMs(Number(v))}
                    disabled={loading || weeklyOppsProgressChartEmpty}
                  >
                    <SelectTrigger
                      className="h-9 min-w-[160px] sm:min-w-[200px]"
                      aria-label="Mostrar datos hasta esta semana (ISO, UTC)"
                    >
                      <SelectValue placeholder="Semana" />
                    </SelectTrigger>
                    <SelectContent>
                      {weeklyOppsProgressWeekOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                    onClick={() => setWeeklyOpportunitiesModalOpen(true)}
                    disabled={loading || weeklyOppsProgressChartEmpty}
                    aria-label="Ampliar gráfico"
                  >
                    <Maximize2 className="size-4" />
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={loading}
              isEmpty={weeklyOppsProgressChartEmpty || weeklyOppsProgressChartData.length === 0}
              variant="bar"
              emptyMessage="No hay datos de oportunidades."
              className="h-[min(58vh,560px)] min-h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeklyOppsProgressChartData}
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
                      isAnimationActive={!exportingPdf}
                      dataKey="avance"
                      name="Avance"
                      stackId="weeklyOpps"
                      fill={WEEKLY_OPPORTUNITY_COLORS.avance}
                      radius={[0, 0, 0, 0]}
                      barSize={18}
                    />
                    <Bar
                      isAnimationActive={!exportingPdf}
                      dataKey="nuevoIngreso"
                      name="Nuevo"
                      stackId="weeklyOpps"
                      fill={WEEKLY_OPPORTUNITY_COLORS.nuevoIngreso}
                      barSize={18}
                    />
                    <Bar
                      isAnimationActive={!exportingPdf}
                      dataKey="atraso"
                      name="Atraso"
                      stackId="weeklyOpps"
                      fill={WEEKLY_OPPORTUNITY_COLORS.atrasoo}
                      barSize={18}
                    />
                    <Bar
                      isAnimationActive={!exportingPdf}
                      dataKey="sinCambios"
                      name="Sin cambios"
                      stackId="weeklyOpps"
                      fill={WEEKLY_OPPORTUNITY_COLORS.sinCambios}
                      radius={[0, 4, 4, 0]}
                      barSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCardBody>
          </CardContent>
        </Card>

        {/* 3. Conversión a Activo - LineChart */}
        <Card id="chart-conversion">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2">
            <CardTitle className="text-base font-medium">Ganadas por Mes</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setConversionModalOpen(true)}
              disabled={loading || conversionChartEmpty}
              aria-label="Ampliar conversión a activo"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={loading}
              isEmpty={conversionChartEmpty}
              variant="line"
              emptyMessage="Sin datos en este periodo."
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
                    allowDecimals={false}
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
                    formatter={(value?: number) => [value ?? 0, 'Convertidas']}
                  />
                  <Line
                    type="monotone"
                    dataKey="tasa"
                    name="Convertidas a Activo"
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

        {/* 4. Rendimiento por Asesor - BarChart */}
        <Card id="chart-performance">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base font-medium">Rendimiento por Asesor</CardTitle>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setAdvisorPerfModalOpen(true)}
              disabled={loading || advisorChartEmpty}
              aria-label="Ampliar rendimiento por asesor"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={loading}
              isEmpty={advisorChartEmpty}
              variant="bar"
              emptyMessage="Sin rendimiento por asesor en este periodo."
              className={chartH}
            >
              <AdvisorPerformanceBarChart data={performanceByAdvisor} height={400} />
            </ChartCardBody>
          </CardContent>
        </Card>

        {/* 5. Ventas por Mes - BarChart */}
        <Card id="chart-sales">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2">
            <CardTitle className="text-base font-medium">Ventas Cerradas por Mes</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setSalesByMonthModalOpen(true)}
              disabled={loading || salesChartEmpty}
              aria-label="Ampliar ventas cerradas por mes"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
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

        {/* 6. Interacción con Oportunidades */}
        <Card id="chart-pipeline">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2">
            <CardTitle className="text-base font-medium">Interacción con Contactos</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={loading}
              isEmpty={!summary || (summary.opportunitiesInteraction.withInteraction === 0 && summary.opportunitiesInteraction.withoutInteraction === 0)}
              variant="donut"
              emptyMessage="Sin datos de interacción en este periodo."
              className={chartH}
            >
              {summary && (() => {
                const data = [
                  { name: 'Con interacción', value: summary.opportunitiesInteraction.withInteraction },
                  { name: 'Sin interacción', value: summary.opportunitiesInteraction.withoutInteraction },
                ];
                const total = data[0].value + data[1].value;
                return (
                  <div className="flex items-center gap-4 h-full">
                    <div className="h-full flex-1 min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data}
                            cx="50%" cy="50%"
                            innerRadius={65} outerRadius={100}
                            dataKey="value" nameKey="name"
                            stroke="none" paddingAngle={3}
                            isAnimationActive={!exportingPdf}
                          >
                            <Cell fill="#13944C" />
                            <Cell fill="#ef4444" />
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
                            formatter={(value?: number) => [value ?? 0, 'Contactos']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-4 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="size-3 rounded-full bg-emerald-500 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Con interacción</p>
                          <p className="text-lg font-bold">{data[0].value}</p>
                          <p className="text-xs text-muted-foreground">{total > 0 ? Math.round(data[0].value / total * 100) : 0}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="size-3 rounded-full bg-red-500 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Sin interacción</p>
                          <p className="text-lg font-bold">{data[1].value}</p>
                          <p className="text-xs text-muted-foreground">{total > 0 ? Math.round(data[1].value / total * 100) : 0}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </ChartCardBody>
          </CardContent>
        </Card>

        {/* 7. Actividades Realizadas - Stacked BarChart */}
        <Card id="chart-activities">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2">
            <CardTitle className="text-base font-medium">Actividades Realizadas</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setActivitiesModalOpen(true)}
              disabled={loading || activitiesChartEmpty}
              aria-label="Ampliar actividades realizadas"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
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
        <Card id="chart-tasks">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2">
            <CardTitle className="text-base font-medium">Tareas</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setTasksModalOpen(true)}
              disabled={loading || followUpsChartEmpty}
              aria-label="Ampliar gráfico de tareas"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
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
