import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DateRange } from 'react-day-picker';
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
  BarChart, Bar,
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
import { inclusiveMultiSourceFilterToApiParam, isInclusiveMultiFilterNone } from '@/lib/comercialFilterSurface';
import { contactSourceLabels } from '@/data/mock';
import {
  fetchAnalyticsSummary,
  fetchAnalyticsKPIs,
  formatLocalISODate,
  analyticsYearToDateRange,
  type AnalyticsSummary,
  type AnalyticsKPIs,
  type AdvisorFunnelMovementDetailQuery,
} from '@/lib/analyticsApi';
import {
  captureReportChartImages,
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
import { chartHasAnyValue } from '@/lib/chartEmpty';
import { Skeleton } from '@/components/ui/skeleton';
import { FunnelChart, type FunnelStage } from '@/components/crm/FunnelChart';
import {
  buildOpportunitiesStageFunnelStages,
  buildCompaniesStagePanelData,
} from '@/lib/companyStageFunnelData';
import { ContactsOpportunitiesAreaChart } from '@/components/shared/ContactsOpportunitiesAreaChart';
import { ActivitiesByTypeHeatmapChart } from '@/components/shared/ActivitiesByTypeHeatmapChart';
import {
  buildActivitiesByTypeHeatmapData,
  activitiesByTypeHeatmapHasData,
} from '@/lib/activitiesByTypeHeatmapUtils';
import { ActivitiesByAdvisorStackedBarChart } from '@/components/shared/ActivitiesByAdvisorStackedBarChart';
import {
  buildActivitiesByAdvisorStackedData,
  activitiesByAdvisorStackedHasData,
} from '@/lib/activitiesByAdvisorStackedUtils';
import type { ActivitiesByTypeMonthComparison } from '@/components/shared/ActivitiesByTypeBarChart';
import { SourcesByEntityMixedChart } from '@/components/shared/SourcesByEntityMixedChart';
import { SourcesExpandedView } from '@/components/shared/SourcesExpandedView';
import { WeeklyPillFilter } from '@/components/shared/WeeklyPillFilter';
import { buildWeeklyPillOptions } from '@/lib/weeklyAdvisorFilterUtils';
import { HotProspectsReportPanel } from '@/components/shared/HotProspectsReportPanel';
import { mapSourcesDetailWeeklyFromApi } from '@/lib/sourceDetailUtils';
import {
  buildSourcesByWeekStackedChartData,
  flattenSourcesByWeekForExport,
  sourcesByWeekChartHasData,
} from '@/lib/sourcesByWeekChartUtils';
import { TasksByKindHeatmapChart } from '@/components/shared/TasksByKindHeatmapChart';
import {
  buildTasksByKindHeatmapData,
  tasksByKindHeatmapHasData,
} from '@/lib/tasksByKindHeatmapUtils';
import { TasksByAdvisorStackedBarChart } from '@/components/shared/TasksByAdvisorStackedBarChart';
import {
  buildTasksByAdvisorStackedData,
  tasksByAdvisorStackedHasData,
} from '@/lib/tasksByAdvisorStackedUtils';
import { OpportunitiesWeeklyProgressStackedChart } from '@/components/shared/OpportunitiesWeeklyProgressStackedChart';
import { CompaniesWeeklyExpandedPanel } from '@/components/shared/CompaniesWeeklyExpandedPanel';
import type { CompaniesWeeklyModalView } from '@/components/shared/CompaniesWeeklyExpandedPanel';
import { buildAdvisorFunnelMovementBundle } from '@/lib/companiesAdvisorMovement';
import { ActiveProspectsMetricCard } from '@/components/shared/ActiveProspectsMetricCard';
import { AdvancedContactsMetricCard } from '@/components/shared/AdvancedContactsMetricCard';
import { AdvancedContactsBarChart } from '@/components/shared/AdvancedContactsBarChart';
import { EstimatedBillingMetricCard } from '@/components/shared/EstimatedBillingMetricCard';
import { EstimatedBillingAreaChart } from '@/components/shared/EstimatedBillingAreaChart';
import { ActiveProspectsAreaChart } from '@/components/shared/ActiveProspectsAreaChart';
import {
  CompaniesStageExpandedPanel,
  CompaniesStageWeekTabs,
  type CompaniesStageWeekView,
} from '@/components/shared/CompaniesStageExpandedPanel';
import { subMonths } from 'date-fns';
import {
  currentLimaWeekCalendarRange,
  isoWeekNumberLima,
  parseDayEndLima,
  parseDayStartLima,
  parseIsoWeekNumberFromLabel,
  startOfWeekMondayLima,
  weekAxisLabelLima,
} from '@/lib/crmTimezone';

const WEEKLY_COMPANY_COLORS = {
  avance: '#13944C',
  nuevoIngreso: '#34d399',
  atraso: '#f59e0b',
  sinCambios: '#94a3b8',
} as const;

/** Si el periodo tiene más semanas, solo se dibujan las más recientes (las iniciales se omiten). */
const WEEKLY_COMPANY_CHART_MAX_WEEKS = 20;
const WEEKLY_OPPS_CHART_MAX_WEEKS = 20;

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

const ACTIVITY_MONTH_LABELS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
] as const;

function activitiesMonthLabel(d: Date): string {
  return `${ACTIVITY_MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
}

const EMPTY_ACTIVITY_MONTH = {
  correos: 0,
  llamadas: 0,
  reuniones: 0,
  notas: 0,
} as const;

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
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    () => currentLimaWeekCalendarRange(),
  );
  /** false al entrar: vista estándar (año en curso). true tras elegir semana en el calendario. */
  const [weekFilterActive, setWeekFilterActive] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [kpis, setKpis] = useState<AnalyticsKPIs | null>(null);
  const [loading, setLoading] = useState(false);
  const [kpisLoading, setKpisLoading] = useState(false);
  /** Lunes Lima (ms) de la última semana visible en el gráfico de avance semanal. */
  const [weeklyProgressCapMs, setWeeklyProgressCapMs] = useState<number | null>(null);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [sourcesByEntityModalOpen, setSourcesByEntityModalOpen] = useState(false);
  const [activitiesBarModalOpen, setActivitiesBarModalOpen] = useState(false);
  const [activitiesChartView, setActivitiesChartView] = useState<'type' | 'advisor'>('type');
  const [activitiesAdvisorWeekPillIndex, setActivitiesAdvisorWeekPillIndex] = useState(0);
  const [weeklyCompaniesModalOpen, setWeeklyCompaniesModalOpen] = useState(false);
  const [weeklyOpportunitiesModalOpen, setWeeklyOpportunitiesModalOpen] = useState(false);
  const [companiesWeeklyModalView, setCompaniesWeeklyModalView] =
    useState<CompaniesWeeklyModalView>('chart');
  const [companiesFunnelModalOpen, setCompaniesFunnelModalOpen] = useState(false);
  const [companiesStageWeekView, setCompaniesStageWeekView] =
    useState<CompaniesStageWeekView>('compare');
  const [activeProspectsModalOpen, setActiveProspectsModalOpen] = useState(false);
  const [advancedContactsModalOpen, setAdvancedContactsModalOpen] = useState(false);
  const [estimatedBillingModalOpen, setEstimatedBillingModalOpen] = useState(false);
  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [tasksChartView, setTasksChartView] = useState<'type' | 'advisor'>('type');
  const [tasksAdvisorWeekPillIndex, setTasksAdvisorWeekPillIndex] = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);
  const chartTheme = useChartTheme();

  const dialogContentClass =
    "flex max-h-[min(calc(100dvh-1.5rem),900px)] w-full max-w-[min(100vw-1rem,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,56rem)]";
  const companiesFunnelDialogClass =
    "flex max-h-[min(calc(100dvh-1.5rem),920px)] w-full max-w-[min(100vw-1rem,104rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,104rem)]";
  const companiesWeeklyDialogClass =
    "flex max-h-[min(calc(100dvh-1.5rem),920px)] w-full max-w-[min(100vw-1rem,72rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,72rem)]";
  const sourcesDetailDialogClass =
    "flex max-h-[min(calc(100dvh-1.5rem),920px)] w-full max-w-[min(100vw-1rem,96rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,96rem)]";

  const reportsEffectiveRange = useMemo(() => {
    if (weekFilterActive && dateRange?.from && dateRange?.to) {
      return {
        from: formatLocalISODate(dateRange.from),
        to: formatLocalISODate(dateRange.to),
      };
    }
    return analyticsYearToDateRange();
  }, [
    weekFilterActive,
    dateRange?.from?.getTime(),
    dateRange?.to?.getTime(),
  ]);

  const handleWeekFilterChange = useCallback((range: DateRange | undefined) => {
    if (!range?.from || !range?.to) {
      setDateRange(currentLimaWeekCalendarRange());
      setWeekFilterActive(false);
      return;
    }
    setDateRange(range);
    setWeekFilterActive(true);
  }, []);

  useEffect(() => {
    const { from, to } = reportsEffectiveRange;
    const source = inclusiveMultiSourceFilterToApiParam(sourceFilter);
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
    reportsEffectiveRange.from,
    reportsEffectiveRange.to,
    advisorListParams.assignedTo,
    advisorListParams.excludeAssignedTo,
    advisorListParams.advisorPool,
    sourceFilter,
  ]);

  useEffect(() => {
    const { from, to } = reportsEffectiveRange;
    const source = inclusiveMultiSourceFilterToApiParam(sourceFilter);
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
    reportsEffectiveRange.from,
    reportsEffectiveRange.to,
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

  const sourcesByEntityData = useMemo(
    () =>
      buildSourcesByWeekStackedChartData(
        summary?.companiesBySourceWeekly?.weeks,
        bundle,
        contactSourceLabels,
      ),
    [summary?.companiesBySourceWeekly?.weeks, bundle, contactSourceLabels],
  );

  const sourcesDetailWeeks = useMemo(
    () => mapSourcesDetailWeeklyFromApi(summary?.sourcesDetailWeekly, bundle),
    [summary?.sourcesDetailWeekly, bundle],
  );

  const opportunitiesFunnelStages: FunnelStage[] = useMemo(
    () => buildOpportunitiesStageFunnelStages(summary?.opportunitiesByStage ?? [], bundle),
    [summary?.opportunitiesByStage, bundle],
  );

  const companiesStagePanelData = useMemo(
    () =>
      buildCompaniesStagePanelData(
        summary?.activeProspectsWeekly,
        summary?.activeProspectsByAdvisorWeekly,
        bundle,
      ),
    [summary?.activeProspectsWeekly, summary?.activeProspectsByAdvisorWeekly, bundle],
  );

  const companiesStageFunnelStages = companiesStagePanelData.totalFunnelStages;
  const companiesWeeklyComparison = companiesStagePanelData.weeklyComparison;

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
    const fromD = parseDayStartLima(summary.range.from);
    const toD = parseDayEndLima(summary.range.to);
    const fromMon = startOfWeekMondayLima(fromD);
    const todayMon = startOfWeekMondayLima(new Date());
    // Index API rows by ISO week number so each row lands on the correct axis position.
    const apiByWeek = new Map(
      apiRows.flatMap((r) => {
        const weekNum = parseIsoWeekNumberFromLabel(r.name);
        return weekNum != null ? [[weekNum, r] as const] : [];
      }),
    );
    type Row = {
      name: string;
      avance: number;
      nuevoIngreso: number;
      atraso: number;
      sinCambios: number;
      weekStartMs: number;
    };
    const out: Row[] = [];
    for (let cur = new Date(fromMon.getTime()); cur.getTime() <= todayMon.getTime(); ) {
      const axisName = weekAxisLabelLima(cur);
      const weekNum = isoWeekNumberLima(cur);
      const api = cur.getTime() <= toD.getTime() ? apiByWeek.get(weekNum) : undefined;
      const row: Omit<Row, 'weekStartMs'> = api
        ? { ...api, name: axisName }
        : { name: axisName, avance: 0, nuevoIngreso: 0, atraso: 0, sinCambios: 0 };
      out.push({ ...row, weekStartMs: cur.getTime() });
      const next = new Date(cur.getTime());
      next.setTime(cur.getTime() + 7 * 24 * 60 * 60 * 1000);
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
          atraso: number;
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

  /** Semanas desde el inicio del rango del reporte hasta la semana ISO actual (UTC); rellena ceros tras el `to` del API para empresas. */
  const weeklyOppsProgressExtended = useMemo(() => {
    if (!summary?.range?.from || !summary?.range?.to) return [];
    const apiRows = summary.companiesWeeklyProgress ?? [];
    const fromD = parseDayStartLima(summary.range.from);
    const toD = parseDayEndLima(summary.range.to);
    const fromMon = startOfWeekMondayLima(fromD);
    const todayMon = startOfWeekMondayLima(new Date());
    // Index API rows by ISO week number so each row lands on the correct axis position.
    const apiByWeek = new Map(
      apiRows.flatMap((r) => {
        const weekNum = parseIsoWeekNumberFromLabel(r.name);
        return weekNum != null ? [[weekNum, r] as const] : [];
      }),
    );
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
      const axisName = weekAxisLabelLima(cur);
      const weekNum = isoWeekNumberLima(cur);
      const api = cur.getTime() <= toD.getTime() ? apiByWeek.get(weekNum) : undefined;
      const row: Omit<RowOpp, 'weekStartMs'> = api
        ? { avance: api.avance, nuevoIngreso: api.nuevoIngreso, atraso: api.atraso, sinCambios: api.sinCambios, name: axisName }
        : { name: axisName, avance: 0, nuevoIngreso: 0, atraso: 0, sinCambios: 0 };
      out.push({ ...row, weekStartMs: cur.getTime() });
      const next = new Date(cur.getTime());
      next.setTime(cur.getTime() + 7 * 24 * 60 * 60 * 1000);
      cur = next;
    }
    return out;
  }, [summary]);

  const weeklyOppsProgressChartEmpty = useMemo(
    () => !weeklyOppsProgressExtended.some((r) => r.avance || r.nuevoIngreso || r.atraso || r.sinCambios),
    [weeklyOppsProgressExtended],
  );

  const weeklyOppsProgressChartSlice = useMemo(() => {
    if (!weeklyOppsProgressExtended.length) {
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
    const rows = weeklyOppsProgressExtended.map(({ weekStartMs: _w, ...rest }) => rest);
    const max = WEEKLY_OPPS_CHART_MAX_WEEKS;
    if (rows.length <= max) {
      return { chartData: rows, truncated: false, omittedWeeks: 0 };
    }
    return {
      chartData: rows.slice(-max),
      truncated: true,
      omittedWeeks: rows.length - max,
    };
  }, [weeklyOppsProgressExtended]);

  const weeklyOppsProgressChartData = weeklyOppsProgressChartSlice.chartData;

  const advisorFunnelMovement = useMemo(
    () => buildAdvisorFunnelMovementBundle(summary?.companiesAdvisorFunnelMovement),
    [summary?.companiesAdvisorFunnelMovement],
  );

  const advisorMovementDetailQuery = useMemo((): AdvisorFunnelMovementDetailQuery => {
    const { to } = analyticsYearToDateRange();
    const summaryTo = summary?.range?.to?.trim();
    const referenceTo =
      summaryTo && summaryTo.length >= 10 ? summaryTo.slice(0, 10) : to;
    return {
      to: referenceTo,
      assignedTo: advisorListParams.assignedTo,
      excludeAssignedTo: advisorListParams.excludeAssignedTo,
      advisorPool: advisorListParams.advisorPool,
      source: inclusiveMultiSourceFilterToApiParam(sourceFilter),
      area: 'comercial',
    };
  }, [
    summary?.range?.to,
    advisorListParams.assignedTo,
    advisorListParams.excludeAssignedTo,
    advisorListParams.advisorPool,
    sourceFilter,
  ]);

  const contactsVsOpportunitiesData = summary?.contactsVsOpportunitiesByMonth ?? [];
  const conversionData = summary?.conversionByMonth ?? [];
  const activitiesByTypeHeatmap = useMemo(
    () => buildActivitiesByTypeHeatmapData(summary?.activitiesByTypeWeekly),
    [summary?.activitiesByTypeWeekly],
  );

  const activitiesByAdvisorStacked = useMemo(
    () => buildActivitiesByAdvisorStackedData(summary?.activitiesByAdvisorWeekly),
    [summary?.activitiesByAdvisorWeekly],
  );

  const activitiesAdvisorWeekOptions = useMemo(
    () => buildWeeklyPillOptions(summary?.activitiesByAdvisorWeekly?.weeks),
    [summary?.activitiesByAdvisorWeekly?.weeks],
  );

  const activitiesAdvisorSelectedWeekIndex = useMemo(
    () =>
      activitiesAdvisorWeekOptions[activitiesAdvisorWeekPillIndex]?.sourceIndex ??
      -1,
    [activitiesAdvisorWeekOptions, activitiesAdvisorWeekPillIndex],
  );

  const activitiesByAdvisorStackedModal = useMemo(
    () =>
      buildActivitiesByAdvisorStackedData(
        summary?.activitiesByAdvisorWeekly,
        activitiesAdvisorSelectedWeekIndex >= 0
          ? activitiesAdvisorSelectedWeekIndex
          : undefined,
      ),
    [summary?.activitiesByAdvisorWeekly, activitiesAdvisorSelectedWeekIndex],
  );

  const tasksByKindHeatmap = useMemo(
    () => buildTasksByKindHeatmapData(summary?.tasksByKindWeekly),
    [summary?.tasksByKindWeekly],
  );

  const tasksByAdvisorStacked = useMemo(
    () => buildTasksByAdvisorStackedData(summary?.tasksByAdvisorWeekly),
    [summary?.tasksByAdvisorWeekly],
  );

  const tasksAdvisorWeekOptions = useMemo(
    () => buildWeeklyPillOptions(summary?.tasksByAdvisorWeekly?.weeks),
    [summary?.tasksByAdvisorWeekly?.weeks],
  );

  const tasksAdvisorSelectedWeekIndex = useMemo(
    () =>
      tasksAdvisorWeekOptions[tasksAdvisorWeekPillIndex]?.sourceIndex ?? -1,
    [tasksAdvisorWeekOptions, tasksAdvisorWeekPillIndex],
  );

  const tasksByAdvisorStackedModal = useMemo(
    () =>
      buildTasksByAdvisorStackedData(
        summary?.tasksByAdvisorWeekly,
        tasksAdvisorSelectedWeekIndex >= 0
          ? tasksAdvisorSelectedWeekIndex
          : undefined,
      ),
    [summary?.tasksByAdvisorWeekly, tasksAdvisorSelectedWeekIndex],
  );

  const activitiesHeatmapScopeLabel = useMemo(() => {
    if (!canSeeAllAdvisors || !advisorFilterIsActive) return 'Equipo completo';
    if (advisorFilter.length === 0) return 'Sin asesores seleccionados';
    return advisorFilter
      .map((id) => {
        if (id === ADVISOR_UNASSIGNED) return 'Sin asignar';
        if (id === ADVISOR_OTHERS) return 'Otros';
        return activeAdvisors.find((u) => u.id === id)?.name ?? id;
      })
      .join(', ');
  }, [
    canSeeAllAdvisors,
    advisorFilterIsActive,
    advisorFilter,
    activeAdvisors,
  ]);

  const tasksHeatmapScopeLabel = activitiesHeatmapScopeLabel;

  const activitiesByTypeData = summary?.activitiesByTypeData ?? [];

  const activitiesMonthComparison = useMemo((): ActivitiesByTypeMonthComparison | null => {
    const rows = summary?.activitiesByTypeData ?? [];
    const now = new Date();
    const previousDate = subMonths(now, 1);
    const currentLabel = activitiesMonthLabel(now);
    const previousLabel = activitiesMonthLabel(previousDate);
    const currentRow = rows.find((row) => row.name === currentLabel);
    const previousRow = rows.find((row) => row.name === previousLabel);

    return {
      previousMonth: {
        name: previousLabel,
        ...EMPTY_ACTIVITY_MONTH,
        ...previousRow,
      },
      currentMonth: {
        name: currentLabel,
        ...EMPTY_ACTIVITY_MONTH,
        ...currentRow,
      },
    };
  }, [summary?.activitiesByTypeData]);
  const followUpsData = summary?.followUpsByMonth ?? [];
  const salesByMonthData = summary?.salesByMonth ?? [];
  const wonSalesByMonthData = useMemo(
    () => salesByMonthData.map((row) => ({ name: row.name, ventas: row.ventas ?? 0 })),
    [salesByMonthData],
  );
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
      const sourceLabel = isInclusiveMultiFilterNone(sourceFilter)
        ? 'Sin fuente'
        : sourceFilter.length === 0
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
        sourcesByEntity: flattenSourcesByWeekForExport(sourcesByEntityData),
        wonSalesByMonth: wonSalesByMonthData,
        activitiesComparison: activitiesMonthComparison ?? undefined,
        pdfLayout: 'reports',
      };

      if (format === 'PDF') {
        setExportingPdf(true);
        void captureReportChartImages()
          .then((charts) => {
            downloadReport(format, { ...payload, charts }, reportExportBaseFilename());
            const withCharts = Object.keys(charts).length > 0;
            toast.success(
              withCharts
                ? 'Reporte PDF con gráficos generado'
                : 'Reporte PDF generado (sin gráficos)',
            );
          })
          .catch((err) => {
            console.error(err);
            try {
              downloadReport(format, payload, reportExportBaseFilename());
              toast.success('Reporte PDF generado (sin gráficos)');
            } catch {
              toast.error('No se pudo generar el PDF. Intenta de nuevo.');
            }
          })
          .finally(() => {
            setExportingPdf(false);
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
      opportunitiesFunnelStages,
      weeklyOppsProgressChartData,
      sourcesByEntityData,
      wonSalesByMonthData,
      activitiesMonthComparison,
      bundle,
      contactSourceLabels,
    ],
  );

  const contactsAreaLegendHeight = 28;
  const contactsAreaChartHeight = 320;
  const contactsAreaCardHeight = contactsAreaChartHeight + contactsAreaLegendHeight;
  const tasksByMonthChartHeight = 380;
  const weeklyOppsChartHeight = 420;
  const activeProspectsChartHeight = 460;
  const sourcesByEntityChartHeight = 372;

  const sourcesByEntityChartEmpty =
    !loading && (!summary || !sourcesByWeekChartHasData(sourcesByEntityData));
  const periodChartEmpty =
    !loading &&
    (!summary ||
      !chartHasAnyValue(contactsVsOpportunitiesData, ['contactos', 'oportunidades']));
  const activitiesBarChartEmpty =
    !loading &&
    (!summary ||
      (!activitiesByTypeHeatmapHasData(activitiesByTypeHeatmap) &&
        !activitiesByAdvisorStackedHasData(activitiesByAdvisorStacked)));
  const activitiesChartEmptyForView =
    !loading &&
    (activitiesChartView === 'type'
      ? !summary || !activitiesByTypeHeatmapHasData(activitiesByTypeHeatmap)
      : !summary || !activitiesByAdvisorStackedHasData(activitiesByAdvisorStacked));
  const activitiesAdvisorChartHeight = Math.max(
    220,
    activitiesByAdvisorStackedModal.advisors.length * 44 + 88,
  );
  const tasksChartEmpty =
    !loading &&
    (!summary ||
      (!tasksByKindHeatmapHasData(tasksByKindHeatmap) &&
        !tasksByAdvisorStackedHasData(tasksByAdvisorStacked)));
  const tasksChartEmptyForView =
    !loading &&
    (tasksChartView === 'type'
      ? !summary || !tasksByKindHeatmapHasData(tasksByKindHeatmap)
      : !summary || !tasksByAdvisorStackedHasData(tasksByAdvisorStacked));
  const activeProspectsChartEmpty =
    !loading &&
    (!summary?.activeProspectsWeekly?.weeks?.length ||
      summary.activeProspectsWeekly.weeks.every((w) => w.total <= 0));
  const advancedContactsChartEmpty =
    !loading &&
    (!summary?.advancedContactsWeekly?.weeks?.length ||
      summary.advancedContactsWeekly.weeks.every((w) => w.total <= 0));
  const estimatedBillingChartEmpty =
    !loading &&
    (!summary?.estimatedBillingWeekly?.weeks?.length ||
      summary.estimatedBillingWeekly.weeks.every((w) => w.total <= 0));
  const companiesStageFunnelEmpty =
    !loading &&
    companiesStageFunnelStages.length === 0;
  const weeklyCompaniesChartEmpty =
    !loading &&
    (!summary ||
      !companiesWeeklyProgressData.some(
        (r) =>
          r.avance + r.nuevoIngreso + r.atraso + r.sinCambios > 0,
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
        description={
          weekFilterActive
            ? 'Filtrado por la semana seleccionada'
            : 'KPIs acumulados del año · gráficos con datos del año en curso'
        }
      >
        <DateRangeFilterButton
          value={dateRange}
          onChange={handleWeekFilterChange}
          selectionMode="week"
          placeholder="Seleccionar semana"
          className={cn('w-full min-[400px]:w-[260px] sm:w-[260px]', comercialFilterSurfaceClass)}
        />

        <MultiAdvisorFilter
          value={advisorFilter}
          onChange={setAdvisorFilter}
          advisors={activeAdvisors}
          disabled={!canSeeAllAdvisors}
          isActive={advisorFilterIsActive}
          isInitialized={advisorFilterInitialized}
          className={cn('!h-10 w-full min-[400px]:w-[190px] sm:w-[190px]', comercialFilterSurfaceClass)}
        />

        <MultiSourceFilter
          value={sourceFilter}
          onChange={setSourceFilter}
          options={leadSourceOptions}
          className={cn('!h-10 w-full min-[400px]:w-[190px] sm:w-[190px]', comercialFilterSurfaceClass)}
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

      {/* Fila KPI extendida: prospectos, contactos avanzados y facturación estimada */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ActiveProspectsMetricCard
          data={summary?.activeProspectsWeekly}
          loading={loading}
          onMaximize={() => setActiveProspectsModalOpen(true)}
          maximizeDisabled={loading || activeProspectsChartEmpty}
        />
        <AdvancedContactsMetricCard
          data={summary?.advancedContactsWeekly}
          loading={loading}
          onMaximize={() => setAdvancedContactsModalOpen(true)}
          maximizeDisabled={loading || advancedContactsChartEmpty}
        />
        <EstimatedBillingMetricCard
          data={summary?.estimatedBillingWeekly}
          loading={loading}
          onMaximize={() => setEstimatedBillingModalOpen(true)}
          maximizeDisabled={loading || estimatedBillingChartEmpty}
        />
      </div>

      {/* Fila 2: embudo empresas (izq) + avance semanal oportunidades (der) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)] lg:items-start">
        <Card id="chart-companies-funnel" className="h-fit">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 px-5 pb-0 pt-5">
            <CardTitle className="text-base font-medium">Empresas por etapa</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setCompaniesFunnelModalOpen(true)}
              disabled={loading || companiesStageFunnelEmpty}
              aria-label="Ampliar empresas por etapa"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="px-5 pt-6 pb-5">
            <ChartCardBody
              loading={loading}
              isEmpty={companiesStageFunnelEmpty}
              variant="bar"
              emptyMessage="Sin empresas en etapas de prospecto."
              chartHeight={weeklyOppsChartHeight}
            >
              <FunnelChart
                stages={companiesStageFunnelStages}
                height={weeklyOppsChartHeight}
                singularLabel="empresa"
              />
            </ChartCardBody>
          </CardContent>
        </Card>

        <Card id="chart-weekly-opps" className="h-fit">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 px-5 pb-0 pt-5">
            <CardTitle className="text-base font-medium">Empresas</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setWeeklyOpportunitiesModalOpen(true)}
              disabled={loading || weeklyOppsProgressChartEmpty}
              aria-label="Ampliar empresas"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-5">
            <ChartCardBody
              loading={loading}
              isEmpty={weeklyOppsProgressChartEmpty || weeklyOppsProgressChartData.length === 0}
              variant="stackedBar"
              emptyMessage="No hay datos de empresas."
              chartHeight={weeklyOppsChartHeight}
            >
              <OpportunitiesWeeklyProgressStackedChart
                data={weeklyOppsProgressChartData}
                height={weeklyOppsChartHeight}
              />
            </ChartCardBody>
          </CardContent>
        </Card>
      </div>

      {/* Fila 3: contactos + fuentes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.15fr)] lg:items-start">
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
          <CardContent className="px-5 pt-4 pb-5">
            <ChartCardBody
              loading={loading}
              isEmpty={periodChartEmpty}
              variant="area"
              emptyMessage="Sin contactos ni oportunidades en el año."
              chartHeight={contactsAreaCardHeight}
            >
              <ContactsOpportunitiesAreaChart
                data={contactsVsOpportunitiesData}
                height={contactsAreaChartHeight}
              />
            </ChartCardBody>
          </CardContent>
        </Card>

        <Card id="chart-sources-by-entity" className="h-fit">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 px-5 pb-0 pt-5">
            <CardTitle className="text-base font-medium">Fuentes: Empresas</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setSourcesByEntityModalOpen(true)}
              disabled={loading || sourcesByEntityChartEmpty}
              aria-label="Ampliar distribución por fuente"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-5">
            <ChartCardBody
              loading={loading}
              isEmpty={sourcesByEntityChartEmpty}
              variant="bar"
              emptyMessage="Sin empresas acumuladas por fuente en las últimas 6 semanas."
              chartHeight={sourcesByEntityChartHeight}
            >
              <SourcesByEntityMixedChart
                data={sourcesByEntityData}
                height={sourcesByEntityChartHeight}
              />
            </ChartCardBody>
          </CardContent>
        </Card>
      </div>

      {/* Prospectos calientes: KPIs + top 15 */}
      <HotProspectsReportPanel
        data={summary?.hotProspects}
        loading={loading}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-stretch">
        <Card id="chart-activities-donut" className="flex h-full flex-col">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 px-5 pb-0 pt-5">
            <CardTitle className="text-base font-medium">Actividades</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setActivitiesBarModalOpen(true)}
              disabled={loading || activitiesBarChartEmpty}
              aria-label="Ampliar actividades"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col px-5 pt-2 pb-5">
            <ChartCardBody
              loading={loading}
              isEmpty={
                !loading &&
                (!summary || !activitiesByTypeHeatmapHasData(activitiesByTypeHeatmap))
              }
              variant="bar"
              emptyMessage="Sin actividades registradas en las últimas 6 semanas."
              chartHeight={tasksByMonthChartHeight}
              className="flex-1"
            >
              <ActivitiesByTypeHeatmapChart
                data={activitiesByTypeHeatmap}
                scopeLabel={activitiesHeatmapScopeLabel}
                chartHeight={tasksByMonthChartHeight}
              />
            </ChartCardBody>
          </CardContent>
        </Card>

        <Card id="chart-tasks" className="flex h-full flex-col">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 px-5 pb-0 pt-5">
            <CardTitle className="text-base font-medium">Tareas</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setTasksModalOpen(true)}
              disabled={loading || tasksChartEmpty}
              aria-label="Ampliar tareas"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col px-5 pt-2 pb-5">
            <ChartCardBody
              loading={loading}
              isEmpty={
                !loading &&
                (!summary || !tasksByKindHeatmapHasData(tasksByKindHeatmap))
              }
              variant="bar"
              emptyMessage="Sin tareas registradas en las últimas 6 semanas."
              chartHeight={tasksByMonthChartHeight}
              className="flex-1"
            >
              <TasksByKindHeatmapChart
                data={tasksByKindHeatmap}
                scopeLabel={tasksHeatmapScopeLabel}
                chartHeight={tasksByMonthChartHeight}
              />
            </ChartCardBody>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Dialog open={estimatedBillingModalOpen} onOpenChange={setEstimatedBillingModalOpen}>
          <DialogContent className={dialogContentClass} showCloseButton>
            <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Facturación estimada total</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {!estimatedBillingChartEmpty ? (
                <EstimatedBillingAreaChart
                  data={summary?.estimatedBillingWeekly}
                  height={activeProspectsChartHeight}
                  showLegend
                  showChartTitle
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={advancedContactsModalOpen} onOpenChange={setAdvancedContactsModalOpen}>
          <DialogContent className={dialogContentClass} showCloseButton>
            <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Contactos avanzados</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {!advancedContactsChartEmpty ? (
                <AdvancedContactsBarChart
                  data={summary?.advancedContactsWeekly}
                  height={activeProspectsChartHeight}
                  showLegend
                  showChartTitle
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={activeProspectsModalOpen} onOpenChange={setActiveProspectsModalOpen}>
          <DialogContent className={dialogContentClass} showCloseButton>
            <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Prospectos Activos</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {!activeProspectsChartEmpty ? (
                <ActiveProspectsAreaChart
                  data={summary?.activeProspectsWeekly}
                  height={activeProspectsChartHeight}
                  showLegend
                  showChartTitle
                />
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

        <Dialog open={sourcesByEntityModalOpen} onOpenChange={setSourcesByEntityModalOpen}>
          <DialogContent className={sourcesDetailDialogClass} showCloseButton>
            <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Fuentes: Empresas</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {!sourcesByEntityChartEmpty ? (
                <SourcesExpandedView
                  chartData={sourcesByEntityData}
                  detailWeeks={sourcesDetailWeeks}
                  advisors={activeAdvisors}
                  canSeeAllAdvisors={canSeeAllAdvisors}
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={activitiesBarModalOpen}
          onOpenChange={(open) => {
            setActivitiesBarModalOpen(open);
            if (!open) {
              setActivitiesChartView('type');
              setActivitiesAdvisorWeekPillIndex(0);
            }
          }}
        >
          <DialogContent className={dialogContentClass} showCloseButton>
            <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Actividades</DialogTitle>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pr-8 pt-3">
                <div className="flex w-fit rounded-md border border-border/80 bg-muted/30 p-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-7 rounded px-2.5 text-xs font-medium',
                      activitiesChartView === 'type' && 'bg-background shadow-sm',
                    )}
                    onClick={() => setActivitiesChartView('type')}
                  >
                    Por tipo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-7 rounded px-2.5 text-xs font-medium',
                      activitiesChartView === 'advisor' && 'bg-background shadow-sm',
                    )}
                    onClick={() => setActivitiesChartView('advisor')}
                  >
                    Por asesor
                  </Button>
                </div>
                {activitiesChartView === 'advisor' ? (
                  <WeeklyPillFilter
                    weeks={activitiesAdvisorWeekOptions}
                    selectedIndex={activitiesAdvisorWeekPillIndex}
                    onChange={setActivitiesAdvisorWeekPillIndex}
                    className="justify-end"
                  />
                ) : null}
              </div>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {!activitiesChartEmptyForView ? (
                activitiesChartView === 'type' ? (
                  <ActivitiesByTypeHeatmapChart
                    data={activitiesByTypeHeatmap}
                    scopeLabel={activitiesHeatmapScopeLabel}
                    chartHeight={280}
                  />
                ) : activitiesByAdvisorStackedHasData(activitiesByAdvisorStackedModal) ? (
                  <ActivitiesByAdvisorStackedBarChart
                    data={activitiesByAdvisorStackedModal}
                    chartHeight={Math.max(
                      320,
                      activitiesByAdvisorStackedModal.advisors.length * 44 + 96,
                    )}
                  />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Sin actividades en{' '}
                    {activitiesByAdvisorStackedModal.weekLabel ?? 'esta semana'}.
                  </p>
                )
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
                      <XAxis type="number" tick={{ fontSize: 11, fill: chartTheme.axisColor }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={76}
                        tick={{ fontSize: 10, fill: chartTheme.axisColor }}
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
                        dataKey="atraso"
                        name="Atraso"
                        stackId="weeklyCompanies"
                        fill={WEEKLY_COMPANY_COLORS.atraso}
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

        <Dialog
          open={tasksModalOpen}
          onOpenChange={(open) => {
            setTasksModalOpen(open);
            if (!open) {
              setTasksChartView('type');
              setTasksAdvisorWeekPillIndex(0);
            }
          }}
        >
          <DialogContent className={dialogContentClass} showCloseButton>
            <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Tareas</DialogTitle>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pr-8 pt-3">
                <div className="flex w-fit rounded-md border border-border/80 bg-muted/30 p-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-7 rounded px-2.5 text-xs font-medium',
                      tasksChartView === 'type' && 'bg-background shadow-sm',
                    )}
                    onClick={() => setTasksChartView('type')}
                  >
                    Por tipo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-7 rounded px-2.5 text-xs font-medium',
                      tasksChartView === 'advisor' && 'bg-background shadow-sm',
                    )}
                    onClick={() => setTasksChartView('advisor')}
                  >
                    Por asesor
                  </Button>
                </div>
                {tasksChartView === 'advisor' ? (
                  <WeeklyPillFilter
                    weeks={tasksAdvisorWeekOptions}
                    selectedIndex={tasksAdvisorWeekPillIndex}
                    onChange={setTasksAdvisorWeekPillIndex}
                    className="justify-end"
                  />
                ) : null}
              </div>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {!tasksChartEmptyForView ? (
                tasksChartView === 'type' ? (
                  <TasksByKindHeatmapChart
                    data={tasksByKindHeatmap}
                    scopeLabel={tasksHeatmapScopeLabel}
                    chartHeight={280}
                  />
                ) : tasksByAdvisorStackedHasData(tasksByAdvisorStackedModal) ? (
                  <TasksByAdvisorStackedBarChart
                    data={tasksByAdvisorStackedModal}
                    chartHeight={Math.max(
                      320,
                      tasksByAdvisorStackedModal.advisors.length * 44 + 96,
                    )}
                  />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Sin tareas en{' '}
                    {tasksByAdvisorStackedModal.weekLabel ?? 'esta semana'}.
                  </p>
                )
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
                  <XAxis type="number" tick={{ fontSize: 11, fill: chartTheme.axisColor }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={76}
                    tick={{ fontSize: 10, fill: chartTheme.axisColor }}
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
                    dataKey="atraso"
                    name="Atraso"
                    stackId="weeklyCompanies"
                    fill={WEEKLY_COMPANY_COLORS.atraso}
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

        <Dialog
          open={companiesFunnelModalOpen}
          onOpenChange={(open) => {
            setCompaniesFunnelModalOpen(open);
            if (!open) setCompaniesStageWeekView('compare');
          }}
        >
          <DialogContent className={companiesFunnelDialogClass} showCloseButton>
            <DialogHeader className="shrink-0 items-start space-y-2 px-4 pb-2 pt-5 text-left sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Empresas por etapa</DialogTitle>
              {companiesWeeklyComparison ? (
                <CompaniesStageWeekTabs
                  value={companiesStageWeekView}
                  onValueChange={setCompaniesStageWeekView}
                  currentWeekLabel={companiesWeeklyComparison.currentWeek.weekLabel}
                  previousWeekLabel={companiesWeeklyComparison.previousWeek.weekLabel}
                />
              ) : null}
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-auto px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              {companiesWeeklyComparison ? (
                <CompaniesStageExpandedPanel
                  weeklyComparison={companiesWeeklyComparison}
                  view={companiesStageWeekView}
                />
              ) : !companiesStageFunnelEmpty ? (
                <div className="flex justify-center">
                  <div className="w-full max-w-md">
                    <FunnelChart
                      stages={companiesStageFunnelStages}
                      height={560}
                      singularLabel="empresa"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={weeklyOpportunitiesModalOpen}
          onOpenChange={(open) => {
            setWeeklyOpportunitiesModalOpen(open);
            if (!open) setCompaniesWeeklyModalView('chart');
          }}
        >
          <DialogContent className={companiesWeeklyDialogClass} showCloseButton>
            <DialogHeader className="shrink-0 items-start space-y-2 px-4 pb-2 pt-5 text-left sm:px-6 sm:pt-6">
              <DialogTitle className="pr-8 text-base">Empresas</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
              <CompaniesWeeklyExpandedPanel
                chartData={weeklyOppsProgressChartData}
                chartEmpty={weeklyOppsProgressChartEmpty || weeklyOppsProgressChartData.length === 0}
                advisorMovement={advisorFunnelMovement}
                advisorMovementDetailQuery={advisorMovementDetailQuery}
                chartHeight={480}
                view={companiesWeeklyModalView}
                onViewChange={setCompaniesWeeklyModalView}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
