import { useState, useEffect, useMemo, useCallback } from 'react';

import { subMonths, startOfMonth, endOfMonth } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Target } from 'lucide-react';
import { SquareBottomUpSvgIcon } from '@/components/icons/SquareBottomUpSvgIcon';
import { chartExpandIconClass, chartCardHeaderClass } from '@/components/shared/ChartExpandToggleIcon';
import { toast } from '@/lib/notify';
import { buildOpportunitiesStageFunnelStages } from '@/lib/companyStageFunnelData';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DateRangeFilterButton } from '@/components/ui/date-range-filter-button';
import { PdfSvgIcon } from '@/components/icons/PdfSvgIcon';
import { XlsSvgIcon } from '@/components/icons/XlsSvgIcon';
import { cn } from '@/lib/utils';
import {
  comercialFilterActionClass,
  comercialFilterSurfaceClass,
} from '@/lib/comercialFilterSurface';
import { MetricCard } from '@/components/shared/MetricCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { contactSourceLabels } from '@/data/mock';
import { FunnelChart, type FunnelStage } from '@/components/crm/FunnelChart';
import { GoalsStatisticsCard } from '@/components/shared/GoalsStatisticsCard';
import { OpportunitiesBySourceRadarCard } from '@/components/shared/OpportunitiesBySourceRadarCard';
import { formatCurrency } from '@/lib/formatters';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ADVISOR_OTHERS,
  ADVISOR_UNASSIGNED,
  useMultiAdvisorFilter,
} from '@/hooks/useMultiAdvisorFilter';
import { MultiAdvisorFilter } from '@/components/shared/MultiAdvisorFilter';
import {
  fetchAnalyticsSummary,
  fetchAnalyticsKPIs,
  formatLocalISODate,
  type AnalyticsSummary,
  type AnalyticsKPIs,
  type ActivitiesByAdvisorDetailsQuery,
} from '@/lib/analyticsApi';
import {
  activityGoalTotal,
  fetchCrmActivityGoals,
  type ActivityGoalTargets,
} from '@/lib/crmConfigApi';
import {
  downloadReport,
  dashboardExportBaseFilename,
  type ReportsExportInput,
} from '@/lib/reportsExport';
import { useCrmConfigStore, getStageLabelFromCatalog, getSourceLabelFromCatalog } from '@/store/crmConfigStore';
import { OpportunitiesWeeklyProgressStackedChart } from '@/components/shared/OpportunitiesWeeklyProgressStackedChart';
import {
  buildCompaniesWeeklyProgressChartData,
  companiesWeeklyProgressChartHasData,
} from '@/lib/companiesWeeklyProgressChartUtils';
import { ActivitiesByTypeWeeklyStackedChart } from '@/components/shared/ActivitiesByTypeWeeklyStackedChart';
import { ActivitiesByAdvisorStackedBarChart } from '@/components/shared/ActivitiesByAdvisorStackedBarChart';
import {
  ActivitiesByAdvisorDetailSheet,
  ActivityGoalSummary,
} from '@/components/shared/ActivitiesByAdvisorDetailSheet';
import { ActivityGoalsDialog } from '@/components/shared/ActivityGoalsDialog';
import { WeeklyPillFilter } from '@/components/shared/WeeklyPillFilter';
import { buildWeeklyPillOptions } from '@/lib/weeklyAdvisorFilterUtils';
import {
  buildActivitiesByAdvisorStackedData,
  activitiesByAdvisorStackedHasData,
  type ActivitiesByAdvisorStackedRow,
} from '@/lib/activitiesByAdvisorStackedUtils';
import {
  buildActivitiesByTypeHeatmapData,
  activitiesByTypeHeatmapHasData,
} from '@/lib/activitiesByTypeHeatmapUtils';
import { TasksByKindWeeklyStackedChart } from '@/components/shared/TasksByKindWeeklyStackedChart';
import {
  buildTasksByKindHeatmapData,
  tasksByKindHeatmapHasData,
} from '@/lib/tasksByKindHeatmapUtils';
import { ChartCardBody } from '@/components/shared/ChartCardBody';
import { ChartCardTitle } from '@/components/shared/ChartCardTitle';
import { chartHasAnyValue } from '@/lib/chartEmpty';
import {
  dashboardChartDescriptions,
  dashboardKpiDescriptions,
} from '@/lib/dashboardChartDescriptions';

function changeTone(s: string): 'positive' | 'negative' | 'neutral' {
  const t = s.trim();
  if (t.startsWith('-')) return 'negative';
  if (t.startsWith('+')) return 'positive';
  return 'neutral';
}

export default function Dashboard() {
  const { hasPermission } = usePermissions();
  const bundle = useCrmConfigStore((s) => s.bundle);
  const {
    selectedIds: advisorFilter,
    setSelectedIds: setAdvisorFilter,
    canSeeAllAdvisors,
    activeAdvisors,
    isInitialized: advisorFilterInitialized,
    isActive: advisorFilterIsActive,
    queryParams: advisorListParams,
  } = useMultiAdvisorFilter();
  const canEditActivityGoals = bundle?.permissions.canEditActivityGoals ?? false;
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(subMonths(new Date(), 1)),
    to: endOfMonth(new Date()),
  });
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [kpis, setKpis] = useState<AnalyticsKPIs | null>(null);
  const [kpisLoading, setKpisLoading] = useState(false);
  const [funnelChartModalOpen, setFunnelChartModalOpen] = useState(false);
  const [weeklyCompaniesModalOpen, setWeeklyCompaniesModalOpen] = useState(false);
  const [activitiesChartModalOpen, setActivitiesChartModalOpen] = useState(false);
  const [activitiesChartView, setActivitiesChartView] = useState<'type' | 'advisor'>('type');
  const [activitiesAdvisorWeekPillIndex, setActivitiesAdvisorWeekPillIndex] = useState(0);
  const [activityGoalsDialogOpen, setActivityGoalsDialogOpen] = useState(false);
  const [activityGoalsByUserId, setActivityGoalsByUserId] = useState<
    Record<string, ActivityGoalTargets>
  >({});
  const [activityGoalsLatestWeek, setActivityGoalsLatestWeek] = useState<
    Record<string, ActivityGoalTargets>
  >({});
  const [activitiesAdvisorDetailOpen, setActivitiesAdvisorDetailOpen] = useState(false);
  const [activitiesAdvisorDetailSelection, setActivitiesAdvisorDetailSelection] =
    useState<ActivitiesByAdvisorStackedRow | null>(null);
  const [tasksChartModalOpen, setTasksChartModalOpen] = useState(false);

  const latestActivityWeek = summary?.activitiesByAdvisorWeekly?.weeks?.[0] ?? null;

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) {
      setSummary(null);
      setKpis(null);
      return;
    }
    const from = formatLocalISODate(dateRange.from);
    const to = formatLocalISODate(dateRange.to);
    let cancelled = false;

    // Cargar KPIs primero (rápido)
    setKpisLoading(true);
    void fetchAnalyticsKPIs({
      from,
      to,
      assignedTo: advisorListParams.assignedTo,
      excludeAssignedTo: advisorListParams.excludeAssignedTo,
      advisorPool: advisorListParams.advisorPool,
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

    // Cargar charts después (más pesado)
    setSummaryLoading(true);
    void fetchAnalyticsSummary({
      from,
      to,
      assignedTo: advisorListParams.assignedTo,
      excludeAssignedTo: advisorListParams.excludeAssignedTo,
      advisorPool: advisorListParams.advisorPool,
      area: 'comercial',
    })
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
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
  ]);

  const contactsSparkline = useMemo(
    () => summary?.contactsWeekly.map((x) => x.value) ?? [],
    [summary],
  );
  const contactsSparklineLabels = useMemo(
    () => summary?.contactsWeekly.map((x) => x.name) ?? [],
    [summary],
  );
  const salesSparkline = useMemo(
    () => summary?.salesWeekly.map((x) => x.value) ?? [],
    [summary],
  );
  const salesSparklineLabels = useMemo(
    () => summary?.salesWeekly.map((x) => x.name) ?? [],
    [summary],
  );
  const opportunitiesSparkline = useMemo(
    () => summary?.opportunitiesWeeklySparkline.map((x) => x.value) ?? [],
    [summary],
  );
  const opportunitiesSparklineLabels = useMemo(
    () => summary?.opportunitiesWeeklySparkline.map((x) => x.name) ?? [],
    [summary],
  );

  const opportunitiesBySourceData = useMemo(() => {
    if (!summary) return [];
    return summary.opportunitiesBySource.map((x) => ({
      ...x,
      name: getSourceLabelFromCatalog(x.name, bundle, contactSourceLabels),
    }));
  }, [summary, bundle]);

  const opportunitiesBySourceEmpty =
    !summaryLoading &&
    (!summary || !chartHasAnyValue(opportunitiesBySourceData, ['value']));

  const leadsBySourceData = useMemo(() => {
    if (!summary) return [];
    return summary.contactsBySource.map((x) => ({
      ...x,
      name: getSourceLabelFromCatalog(x.name, bundle, contactSourceLabels),
    }));
  }, [summary, bundle]);

  const funnelData = useMemo(() => {
    if (!summary) return [];
    return summary.opportunitiesByStageData.map((x) => ({
      name: getStageLabelFromCatalog(x.name, bundle),
      value: x.count,
    }));
  }, [summary, bundle]);

  const funnelStages: FunnelStage[] = useMemo(() => {
    if (!summary) return [];
    return buildOpportunitiesStageFunnelStages(
      summary.opportunitiesByStageData,
      bundle,
    );
  }, [summary, bundle]);

  const opportunitiesByStageData = useMemo(() => {
    if (!summary) return [];
    return summary.opportunitiesByStageData.map((x) => ({
      ...x,
      name: getStageLabelFromCatalog(x.name, bundle),
    }));
  }, [summary, bundle]);

  const contactsVsOpportunitiesData = summary?.contactsVsOpportunitiesByMonth ?? [];
  const conversionData = summary?.conversionByMonth ?? [];
  const activitiesByTypeData = summary?.activitiesByTypeData ?? [];
  const followUpsData = summary?.followUpsByMonth ?? [];

  const performanceByAdvisor = summary?.performanceByAdvisor ?? [];
  const salesByMonthData = summary?.salesByMonth ?? [];

  const funnelChartEmpty =
    !summaryLoading &&
    (!summary || !chartHasAnyValue(funnelData, ['value']));

  const weeklyCompaniesChartData = useMemo(
    () => buildCompaniesWeeklyProgressChartData(summary),
    [summary],
  );
  const weeklyCompaniesChartEmpty =
    !summaryLoading &&
    (!summary || !companiesWeeklyProgressChartHasData(weeklyCompaniesChartData));

  const activitiesByTypeHeatmap = useMemo(
    () => buildActivitiesByTypeHeatmapData(summary?.activitiesByTypeWeekly),
    [summary?.activitiesByTypeWeekly],
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

  const activitiesByAdvisorStackedView = useMemo(
    () =>
      buildActivitiesByAdvisorStackedData(
        summary?.activitiesByAdvisorWeekly,
        activitiesAdvisorSelectedWeekIndex >= 0
          ? activitiesAdvisorSelectedWeekIndex
          : undefined,
      ),
    [summary?.activitiesByAdvisorWeekly, activitiesAdvisorSelectedWeekIndex],
  );

  const activitiesAdvisorSelectedWeek = useMemo(() => {
    if (activitiesAdvisorSelectedWeekIndex < 0) return null;
    return summary?.activitiesByAdvisorWeekly?.weeks?.[activitiesAdvisorSelectedWeekIndex] ?? null;
  }, [activitiesAdvisorSelectedWeekIndex, summary?.activitiesByAdvisorWeekly?.weeks]);

  const activityGoalsAdvisors = useMemo(
    () =>
      activeAdvisors.map((u) => ({
        id: u.id,
        name: u.name?.trim() || u.email || 'Asesor',
      })),
    [activeAdvisors],
  );

  useEffect(() => {
    const weekStart = activitiesAdvisorSelectedWeek?.weekStart;
    if (!weekStart) {
      setActivityGoalsByUserId({});
      return;
    }
    let cancelled = false;
    void fetchCrmActivityGoals(weekStart.slice(0, 10))
      .then((data) => {
        if (!cancelled) setActivityGoalsByUserId(data.byUserId ?? {});
      })
      .catch(() => {
        if (!cancelled) setActivityGoalsByUserId({});
      });
    return () => {
      cancelled = true;
    };
  }, [activitiesAdvisorSelectedWeek?.weekStart]);

  useEffect(() => {
    const weekStart = latestActivityWeek?.weekStart;
    if (!weekStart) {
      setActivityGoalsLatestWeek({});
      return;
    }
    let cancelled = false;
    void fetchCrmActivityGoals(weekStart.slice(0, 10))
      .then((data) => {
        if (!cancelled) setActivityGoalsLatestWeek(data.byUserId ?? {});
      })
      .catch(() => {
        if (!cancelled) setActivityGoalsLatestWeek({});
      });
    return () => {
      cancelled = true;
    };
  }, [latestActivityWeek?.weekStart]);

  const activitiesByAdvisorLatestWeek = useMemo(
    () => buildActivitiesByAdvisorStackedData(summary?.activitiesByAdvisorWeekly, 0),
    [summary?.activitiesByAdvisorWeekly],
  );

  const myActivityGoalProgress = useMemo(() => {
    if (canSeeAllAdvisors) return null;
    const row = activitiesByAdvisorLatestWeek.advisors[0];
    if (!row) return null;
    const target = activityGoalsLatestWeek[row.advisorId];
    if (!target || activityGoalTotal(target) <= 0) return null;
    return {
      row,
      target,
      weekLabel: latestActivityWeek?.name ?? activitiesByAdvisorLatestWeek.weekLabel ?? '—',
    };
  }, [
    activitiesByAdvisorLatestWeek,
    activityGoalsLatestWeek,
    canSeeAllAdvisors,
    latestActivityWeek?.name,
  ]);

  const activitiesAdvisorDetailQuery = useMemo((): Omit<
    ActivitiesByAdvisorDetailsQuery,
    'advisorId' | 'weekStart' | 'weekEnd' | 'page' | 'limit'
  > => {
    const from = dateRange?.from ? formatLocalISODate(dateRange.from) : '';
    const to = dateRange?.to ? formatLocalISODate(dateRange.to) : '';
    return {
      from,
      to,
      assignedTo: advisorListParams.assignedTo,
      excludeAssignedTo: advisorListParams.excludeAssignedTo,
      advisorPool: advisorListParams.advisorPool,
      area: 'comercial',
    };
  }, [
    dateRange?.from,
    dateRange?.to,
    advisorListParams.assignedTo,
    advisorListParams.excludeAssignedTo,
    advisorListParams.advisorPool,
  ]);

  const activitiesTypeChartEmpty =
    !summaryLoading &&
    (!summary || !activitiesByTypeHeatmapHasData(activitiesByTypeHeatmap));

  const activitiesChartEmpty =
    !summaryLoading &&
    (activitiesChartView === 'type'
      ? !summary || !activitiesByTypeHeatmapHasData(activitiesByTypeHeatmap)
      : !summary || !activitiesByAdvisorStackedHasData(activitiesByAdvisorStackedView));

  const tasksByKindHeatmap = useMemo(
    () => buildTasksByKindHeatmapData(summary?.tasksByKindWeekly),
    [summary?.tasksByKindWeekly],
  );
  const tasksChartEmpty =
    !summaryLoading &&
    (!summary || !tasksByKindHeatmapHasData(tasksByKindHeatmap));

  const weeklyChartHeight = 420;

  const advisorExportLabel = useMemo(() => {
    if (!canSeeAllAdvisors) {
      return activeAdvisors.find((u) => u.id === advisorFilter[0])?.name ?? 'Mi cartera';
    }
    if (!advisorFilterIsActive) return 'Todos los asesores';
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

  const activitiesScopeLabel = useMemo(() => {
    if (!canSeeAllAdvisors) return 'Mi cartera';
    if (!advisorFilterIsActive) return 'Equipo completo';
    return advisorExportLabel;
  }, [advisorExportLabel, advisorFilterIsActive, canSeeAllAdvisors]);

  const handleExport = useCallback(
    (format: 'PDF' | 'Excel') => {
      if (summaryLoading || !summary) {
        toast.error('Espera a que carguen las métricas o elige un periodo válido.');
        return;
      }
      const payload: ReportsExportInput = {
        documentTitle: 'Resumen dashboard',
        range: summary.range,
        meta: {
          advisorLabel: advisorExportLabel,
          sourceLabel: 'Todas las fuentes',
        },
        kpis: summary.kpis,
        contactsVsOpportunitiesByMonth: contactsVsOpportunitiesData,
        contactsBySource: leadsBySourceData,
        conversionByMonth: conversionData,
        performanceByAdvisor,
        salesByMonth: salesByMonthData,
        opportunitiesByStage: opportunitiesByStageData,
        activitiesByType: activitiesByTypeData,
        followUpsByMonth: followUpsData,
      };
      try {
        downloadReport(format, payload, dashboardExportBaseFilename());
        toast.success(`Archivo ${format} generado`);
      } catch {
        toast.error('No se pudo generar el archivo. Intenta de nuevo.');
      }
    },
    [
      summaryLoading,
      summary,
      advisorExportLabel,
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

  const dashboardChartModalClass =
    'max-h-[min(90vh,900px)] w-full max-w-[min(100vw-2rem,56rem)] gap-0 p-0 sm:max-w-[min(100vw-2rem,56rem)]';

  const activitiesAdvisorChartHeight = useMemo(
    () =>
      Math.max(
        200,
        activitiesByAdvisorStackedView.advisors.length * 44 + 96,
      ),
    [activitiesByAdvisorStackedView.advisors.length],
  );

  const activitiesModalGoalDetail = useMemo(() => {
    if (canSeeAllAdvisors || !myActivityGoalProgress) return null;
    return {
      actual: {
        contacto: myActivityGoalProgress.row.llamadasContacto,
        noContacto: myActivityGoalProgress.row.llamadasNoContacto,
        reuniones: myActivityGoalProgress.row.reuniones,
        correos: myActivityGoalProgress.row.correos,
      },
      target: myActivityGoalProgress.target,
    };
  }, [canSeeAllAdvisors, myActivityGoalProgress]);

  const openActivitiesAdvisorDetail = useCallback((advisor: ActivitiesByAdvisorStackedRow) => {
    setActivitiesAdvisorDetailSelection(advisor);
    setActivitiesAdvisorDetailOpen(true);
  }, []);

  const openActivitiesModal = useCallback(() => {
    setActivitiesChartView(canSeeAllAdvisors ? 'type' : 'advisor');
    setActivitiesChartModalOpen(true);
  }, [canSeeAllAdvisors]);

  const renderActivitiesChartControls = () => (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1">
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canEditActivityGoals ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={() => setActivityGoalsDialogOpen(true)}
            >
              <Target className="size-3.5" aria-hidden />
              Metas
            </Button>
          ) : null}
          <WeeklyPillFilter
            weeks={activitiesAdvisorWeekOptions}
            selectedIndex={activitiesAdvisorWeekPillIndex}
            onChange={setActivitiesAdvisorWeekPillIndex}
            className="justify-end"
          />
        </div>
      ) : null}
    </div>
  );

  const renderActivitiesChart = (height: number) => {
    if (activitiesChartView === 'type') {
      return (
        <ActivitiesByTypeWeeklyStackedChart
          data={activitiesByTypeHeatmap}
          scopeLabel={activitiesScopeLabel}
          chartHeight={height}
        />
      );
    }
    if (!activitiesByAdvisorStackedHasData(activitiesByAdvisorStackedView)) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sin actividades en{' '}
          {activitiesByAdvisorStackedView.weekLabel ?? 'esta semana'}.
        </p>
      );
    }
    return (
      <ActivitiesByAdvisorStackedBarChart
        data={activitiesByAdvisorStackedView}
        goalByAdvisorId={activityGoalsByUserId}
        chartHeight={height}
        onAdvisorSelect={openActivitiesAdvisorDetail}
      />
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Resumen ejecutivo del equipo comercial"
      >
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilterButton
            value={dateRange}
            onChange={setDateRange}
            placeholder="Seleccionar periodo"
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
        </div>
        {hasPermission('dashboard.exportar') && (
          <>
            <button
              type="button"
              disabled={summaryLoading || !summary}
              onClick={() => handleExport('PDF')}
              className={cn(comercialFilterActionClass, 'cursor-pointer')}
            >
              <PdfSvgIcon className="size-5 shrink-0" />
              PDF
            </button>
            <button
              type="button"
              disabled={summaryLoading || !summary}
              onClick={() => handleExport('Excel')}
              className={cn(comercialFilterActionClass, 'cursor-pointer')}
            >
              <XlsSvgIcon className="size-5 shrink-0" />
              Excel
            </button>
          </>
        )}
      </PageHeader>

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Total Contactos"
          info={dashboardKpiDescriptions.totalContacts}
          value={kpis?.totalContacts ?? '—'}
          change={kpis ? kpis.changes.contacts : undefined}
          changeType={kpis ? changeTone(kpis.changes.contacts) : 'neutral'}
          description="últimos 7 días"
          sparklineData={contactsSparkline}
          sparklineLabels={contactsSparklineLabels}
          sparklineColor="#22c55e"
          sparklineLoading={summaryLoading}
          loading={kpisLoading}
        />
        <MetricCard
          title="Oportunidades Activas"
          info={dashboardKpiDescriptions.activeOpportunities}
          value={kpis?.activeOpportunities ?? '—'}
          change={kpis ? kpis.changes.opportunities : undefined}
          changeType={kpis ? changeTone(kpis.changes.opportunities) : 'neutral'}
          description="últimos 7 días"
          sparklineData={opportunitiesSparkline}
          sparklineLabels={opportunitiesSparklineLabels}
          sparklineColor="#2ECC87"
          sparklineLoading={summaryLoading}
          loading={kpisLoading}
        />
        <MetricCard
          title="Ventas Cerradas"
          info={dashboardKpiDescriptions.closedSales}
          value={kpis ? formatCurrency(kpis.closedSalesAmount) : '—'}
          change={kpis ? kpis.changes.sales : undefined}
          changeType={kpis ? changeTone(kpis.changes.sales) : 'neutral'}
          description="últimos 7 días"
          sparklineData={salesSparkline}
          sparklineLabels={salesSparklineLabels}
          sparklineColor="#1DB954"
          sparklineLoading={summaryLoading}
          loading={kpisLoading}
        />
      </div>

      {/* Metas + Oportunidades por fuente */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:items-stretch">
        <div className="flex lg:col-span-3">
          <GoalsStatisticsCard />
        </div>
        <div className="flex lg:col-span-2">
          {opportunitiesBySourceEmpty && !summaryLoading ? (
            <Card className="relative flex h-full w-full flex-col overflow-hidden py-0">
              <CardHeader className="shrink-0 pb-2">
                <ChartCardTitle
                  title="Oportunidades por fuente"
                  info={dashboardChartDescriptions.opportunitiesBySource}
                />
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col items-center justify-center pb-4 pt-0 text-sm text-muted-foreground">
                Sin oportunidades por fuente en este periodo.
              </CardContent>
            </Card>
          ) : (
            <OpportunitiesBySourceRadarCard
              data={opportunitiesBySourceData}
              loading={summaryLoading}
            />
          )}
        </div>
      </div>

      {/* Funnel + Empresas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[45fr_55fr] lg:items-stretch">
        <Card className="flex h-full flex-col">
          <CardHeader className={cn(chartCardHeaderClass, 'pb-2 max-md:pb-1.5')}>
            <ChartCardTitle
              title="Funnel de Ventas"
              info={dashboardChartDescriptions.salesFunnel}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setFunnelChartModalOpen(true)}
              disabled={summaryLoading || funnelChartEmpty}
              aria-label="Ampliar funnel de ventas"
            >
              <SquareBottomUpSvgIcon className={chartExpandIconClass} />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col max-md:px-3 max-md:pb-2 max-md:pt-0">
            <ChartCardBody
              loading={summaryLoading}
              isEmpty={funnelChartEmpty}
              variant="bar"
              emptyMessage="Sin datos de embudo en este periodo."
              chartHeight={weeklyChartHeight}
              className="flex-1 py-3 max-md:py-1"
            >
              <FunnelChart stages={funnelStages} height={weeklyChartHeight} singularLabel="oportunidad" />
            </ChartCardBody>
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col">
          <CardHeader className={cn(chartCardHeaderClass, 'px-5 pb-0 pt-5')}>
            <ChartCardTitle
              title="Empresas"
              info={dashboardChartDescriptions.companies}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setWeeklyCompaniesModalOpen(true)}
              disabled={summaryLoading || weeklyCompaniesChartEmpty}
              aria-label="Ampliar empresas"
            >
              <SquareBottomUpSvgIcon className={chartExpandIconClass} />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col px-5 pt-4 pb-5">
            <ChartCardBody
              loading={summaryLoading}
              isEmpty={weeklyCompaniesChartEmpty || weeklyCompaniesChartData.length === 0}
              variant="stackedBar"
              emptyMessage="No hay datos de empresas en este periodo."
              chartHeight={weeklyChartHeight}
              className="flex-1"
            >
              <OpportunitiesWeeklyProgressStackedChart
                data={weeklyCompaniesChartData}
                height={weeklyChartHeight}
              />
            </ChartCardBody>
          </CardContent>
        </Card>
      </div>

      {/* Actividades + Tareas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
        <Card className="flex h-full flex-col">
          <CardHeader className={cn(chartCardHeaderClass, 'px-5 pb-0 pt-5')}>
            <ChartCardTitle
              title="Actividades"
              info={dashboardChartDescriptions.activities}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={openActivitiesModal}
              disabled={summaryLoading || activitiesTypeChartEmpty}
              aria-label="Ampliar actividades"
            >
              <SquareBottomUpSvgIcon className={chartExpandIconClass} />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col px-5 pt-2 pb-5">
            <ChartCardBody
              loading={summaryLoading}
              isEmpty={activitiesTypeChartEmpty}
              variant="stackedBar"
              emptyMessage="Sin actividades registradas en las últimas 6 semanas."
              chartHeight={weeklyChartHeight}
              className="flex-1"
            >
              <ActivitiesByTypeWeeklyStackedChart
                data={activitiesByTypeHeatmap}
                scopeLabel={activitiesScopeLabel}
                chartHeight={weeklyChartHeight}
              />
            </ChartCardBody>
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col">
          <CardHeader className={cn(chartCardHeaderClass, 'px-5 pb-0 pt-5')}>
            <ChartCardTitle
              title="Tareas"
              info={dashboardChartDescriptions.tasks}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setTasksChartModalOpen(true)}
              disabled={summaryLoading || tasksChartEmpty}
              aria-label="Ampliar tareas"
            >
              <SquareBottomUpSvgIcon className={chartExpandIconClass} />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col px-5 pt-2 pb-5">
            <ChartCardBody
              loading={summaryLoading}
              isEmpty={tasksChartEmpty}
              variant="stackedBar"
              emptyMessage="Sin tareas registradas en las últimas 6 semanas."
              chartHeight={weeklyChartHeight}
              className="flex-1"
            >
              <TasksByKindWeeklyStackedChart
                data={tasksByKindHeatmap}
                scopeLabel="Equipo completo"
                chartHeight={weeklyChartHeight}
              />
            </ChartCardBody>
          </CardContent>
        </Card>
      </div>

      <Dialog open={funnelChartModalOpen} onOpenChange={setFunnelChartModalOpen}>
        <DialogContent className={dashboardChartModalClass} showCloseButton closeButtonIcon="chart-reduce">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-base">Funnel de Ventas</DialogTitle>
          </DialogHeader>
          <div className="max-h-[min(72vh,640px)] w-full overflow-y-auto px-6 pb-6 pt-4">
            {!funnelChartEmpty ? (
              <FunnelChart
                stages={funnelStages}
                height={560}
                showLegend
                singularLabel="oportunidad"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={weeklyCompaniesModalOpen} onOpenChange={setWeeklyCompaniesModalOpen}>
        <DialogContent className={dashboardChartModalClass} showCloseButton closeButtonIcon="chart-reduce">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-base">Empresas</DialogTitle>
          </DialogHeader>
          <div className="w-full px-6 pb-6 pt-4">
            {!weeklyCompaniesChartEmpty ? (
              <OpportunitiesWeeklyProgressStackedChart
                data={weeklyCompaniesChartData}
                height={520}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activitiesChartModalOpen}
        onOpenChange={(open) => {
          setActivitiesChartModalOpen(open);
          if (!open && !canSeeAllAdvisors) {
            setActivitiesChartView('advisor');
          }
        }}
      >
        <DialogContent
          className={cn(dashboardChartModalClass, 'flex flex-col overflow-hidden')}
          showCloseButton
          closeButtonIcon="chart-reduce"
        >
          <DialogHeader className="shrink-0 px-6 pt-6 pb-0">
            <DialogTitle className="text-base">Actividades</DialogTitle>
            <div className="pr-6">{renderActivitiesChartControls()}</div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 pb-6 pt-2">
            {activitiesChartView === 'advisor' && activitiesModalGoalDetail ? (
              <div className="mb-4 overflow-hidden rounded-lg border border-border/70 bg-muted/20">
                <ActivityGoalSummary
                  actual={activitiesModalGoalDetail.actual}
                  target={activitiesModalGoalDetail.target}
                />
              </div>
            ) : null}
            {!activitiesChartEmpty ? (
              renderActivitiesChart(
                activitiesChartView === 'advisor'
                  ? activitiesAdvisorChartHeight
                  : 520,
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <ActivitiesByAdvisorDetailSheet
        open={activitiesAdvisorDetailOpen}
        onOpenChange={setActivitiesAdvisorDetailOpen}
        advisorId={activitiesAdvisorDetailSelection?.advisorId ?? null}
        advisorName={activitiesAdvisorDetailSelection?.advisorName ?? null}
        weekLabel={
          activitiesAdvisorSelectedWeek?.name ??
          activitiesByAdvisorStackedView.weekLabel ??
          null
        }
        weekStart={activitiesAdvisorSelectedWeek?.weekStart ?? null}
        weekEnd={activitiesAdvisorSelectedWeek?.weekEnd ?? null}
        detailQuery={activitiesAdvisorDetailQuery}
        actualCounts={
          activitiesAdvisorDetailSelection
            ? {
                contacto: activitiesAdvisorDetailSelection.llamadasContacto,
                noContacto: activitiesAdvisorDetailSelection.llamadasNoContacto,
                reuniones: activitiesAdvisorDetailSelection.reuniones,
                correos: activitiesAdvisorDetailSelection.correos,
              }
            : null
        }
        goalTargets={
          activitiesAdvisorDetailSelection
            ? activityGoalsByUserId[activitiesAdvisorDetailSelection.advisorId] ??
              null
            : null
        }
      />

      <ActivityGoalsDialog
        open={activityGoalsDialogOpen}
        onOpenChange={setActivityGoalsDialogOpen}
        weekStart={activitiesAdvisorSelectedWeek?.weekStart ?? null}
        weekLabel={
          activitiesAdvisorSelectedWeek?.name ??
          activitiesByAdvisorStackedView.weekLabel ??
          null
        }
        advisors={activityGoalsAdvisors}
        onSaved={setActivityGoalsByUserId}
      />

      <Dialog open={tasksChartModalOpen} onOpenChange={setTasksChartModalOpen}>
        <DialogContent className={dashboardChartModalClass} showCloseButton closeButtonIcon="chart-reduce">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-base">Tareas</DialogTitle>
          </DialogHeader>
          <div className="w-full px-6 pb-6 pt-4">
            {!tasksChartEmpty ? (
              <TasksByKindWeeklyStackedChart
                data={tasksByKindHeatmap}
                scopeLabel="Equipo completo"
                chartHeight={520}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
