import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { PageHeader } from '@/components/shared/PageHeader';
import { MetricCard } from '@/components/shared/MetricCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DateRangeFilterButton } from '@/components/ui/date-range-filter-button';
import { cn } from '@/lib/utils';
import { comercialFilterSurfaceClass } from '@/lib/comercialFilterSurface';
import { SquareBottomUpSvgIcon } from '@/components/icons/SquareBottomUpSvgIcon';
import {
  chartCardHeaderClass,
  chartExpandIconClass,
} from '@/components/shared/ChartExpandToggleIcon';
import { ChartCardTitle } from '@/components/shared/ChartCardTitle';
import { ChartCardBody } from '@/components/shared/ChartCardBody';
import {
  clienteReportsChartDescriptions,
  clienteReportsKpiDescriptions,
} from '@/lib/dashboardChartDescriptions';
import { formatCurrency } from '@/lib/formatters';
import { useUsers } from '@/hooks/useUsers';
import { useMultiAdvisorFilter } from '@/hooks/useMultiAdvisorFilter';
import { MultiAdvisorFilter } from '@/components/shared/MultiAdvisorFilter';
import {
  analyticsYearToDateRange,
  formatLocalISODate,
} from '@/lib/analyticsApi';
import { currentLimaWeekCalendarRange } from '@/lib/crmTimezone';
import {
  fetchClienteCarteraAnalyticsSummary,
  type ClienteCarteraAnalyticsSummary,
} from '@/lib/clienteCarteraAnalyticsApi';
import { chartHasAnyValue } from '@/lib/chartEmpty';
import {
  buildActivitiesByTypeHeatmapData,
  activitiesByTypeHeatmapHasData,
} from '@/lib/activitiesByTypeHeatmapUtils';
import {
  buildTasksByKindHeatmapData,
  tasksByKindHeatmapHasData,
} from '@/lib/tasksByKindHeatmapUtils';
import { ActivitiesByTypeWeeklyStackedChart } from '@/components/shared/ActivitiesByTypeWeeklyStackedChart';
import { TasksByKindWeeklyStackedChart } from '@/components/shared/TasksByKindWeeklyStackedChart';
import { ClienteStatusDonutChart } from '@/components/cliente-cartera/ClienteStatusDonutChart';
import { ClienteAltasAreaChart } from '@/components/cliente-cartera/ClienteAltasAreaChart';
import { ClienteIngresosByAdvisorChart } from '@/components/cliente-cartera/ClienteIngresosByAdvisorChart';
import { ClienteMonthlyBillingChart } from '@/components/cliente-cartera/ClienteMonthlyBillingChart';
import { ClienteAdvisorStackedBarChart } from '@/components/cliente-cartera/ClienteAdvisorStackedBarChart';

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

const dialogContentClass =
  'flex max-h-[min(calc(100dvh-1.5rem),900px)] w-full max-w-[min(100vw-1rem,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,56rem)]';

export default function ClienteReportes() {
  const { activeAdvisors } = useUsers();
  const {
    selectedIds: advisorFilter,
    setSelectedIds: setAdvisorFilter,
    canSeeAllAdvisors,
    isInitialized: advisorFilterInitialized,
    isActive: advisorFilterIsActive,
    queryParams: advisorListParams,
  } = useMultiAdvisorFilter();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() =>
    currentLimaWeekCalendarRange(),
  );
  const [weekFilterActive, setWeekFilterActive] = useState(false);
  const [summary, setSummary] = useState<ClienteCarteraAnalyticsSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [altasModalOpen, setAltasModalOpen] = useState(false);
  const [ingresosModalOpen, setIngresosModalOpen] = useState(false);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [advisorModalOpen, setAdvisorModalOpen] = useState(false);
  const [activitiesModalOpen, setActivitiesModalOpen] = useState(false);
  const [tasksModalOpen, setTasksModalOpen] = useState(false);

  const reportsEffectiveRange = useMemo(() => {
    if (weekFilterActive && dateRange?.from && dateRange?.to) {
      return {
        from: formatLocalISODate(dateRange.from),
        to: formatLocalISODate(dateRange.to),
      };
    }
    return analyticsYearToDateRange();
  }, [weekFilterActive, dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

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
    let cancelled = false;
    setLoading(true);
    void fetchClienteCarteraAnalyticsSummary({
      from,
      to,
      assignedTo: advisorListParams.assignedTo,
      excludeAssignedTo: advisorListParams.excludeAssignedTo,
      advisorPool: advisorListParams.advisorPool,
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
  ]);

  const kpis = summary?.kpis;
  const activitiesHeatmap = useMemo(
    () => buildActivitiesByTypeHeatmapData(summary?.activitiesByTypeWeekly),
    [summary?.activitiesByTypeWeekly],
  );
  const tasksHeatmap = useMemo(
    () => buildTasksByKindHeatmapData(summary?.tasksByKindWeekly),
    [summary?.tasksByKindWeekly],
  );

  const statusEmpty =
    !loading && (!summary || !summary.byStatus.some((row) => row.value > 0));
  const altasEmpty =
    !loading &&
    (!summary ||
      !chartHasAnyValue(summary.altasByMonth, ['empresas', 'contactos']));
  const ingresosEmpty =
    !loading &&
    (!summary || !summary.ingresosByAdvisor.some((row) => row.ingresos > 0));
  const billingEmpty =
    !loading &&
    (!summary || !summary.monthlyBilling.some((row) => row.amount > 0));
  const advisorEmpty =
    !loading &&
    (!summary ||
      !summary.byAdvisor.some(
        (row) => row.empresas + row.contactos + row.tareas > 0,
      ));
  const activitiesEmpty =
    !loading && (!summary || !activitiesByTypeHeatmapHasData(activitiesHeatmap));
  const tasksEmpty =
    !loading && (!summary || !tasksByKindHeatmapHasData(tasksHeatmap));

  const altasLegendHeight = 28;
  const altasChartHeight = 280;
  const altasCardHeight = altasChartHeight + altasLegendHeight;
  const chartHeight = 300;
  const stackedHeight = 360;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes de Clientes"
        description={
          weekFilterActive
            ? 'Filtrado por la semana seleccionada · solo cartera de Clientes'
            : 'KPIs de cartera y seguimiento · no incluye el CRM comercial'
        }
      >
        <DateRangeFilterButton
          value={dateRange}
          onChange={handleWeekFilterChange}
          selectionMode="week"
          placeholder="Seleccionar semana"
          className={cn(
            'w-full min-[400px]:w-[260px] sm:w-[260px]',
            comercialFilterSurfaceClass,
          )}
        />
        <MultiAdvisorFilter
          value={advisorFilter}
          onChange={setAdvisorFilter}
          advisors={activeAdvisors}
          disabled={!canSeeAllAdvisors}
          isActive={advisorFilterIsActive}
          isInitialized={advisorFilterInitialized}
          className={cn(
            '!h-10 w-full min-[400px]:w-[190px] sm:w-[190px]',
            comercialFilterSurfaceClass,
          )}
        />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Clientes en cartera"
          info={clienteReportsKpiDescriptions.totalEmpresas}
          value={kpis?.totalEmpresas ?? '—'}
          description={
            kpis
              ? `${kpis.empresasActivas.toLocaleString('es-PE')} activos`
              : 'Inventario actual'
          }
          loading={loading && !summary}
        />
        <MetricCard
          title="Altas en el periodo"
          info={clienteReportsKpiDescriptions.altasInRange}
          value={kpis?.altasInRange ?? '—'}
          change={kpis ? kpis.changes.altas : undefined}
          changeType={kpis ? changeTone(kpis.changes.altas) : 'neutral'}
          description="últimos 7 días"
          sparklineData={weeklySparkValues(summary?.altasWeekly)}
          sparklineLabels={weeklySparkLabels(summary?.altasWeekly)}
          sparklineColor="#2ECC87"
          sparklineVariant="line"
          sparklineLoading={loading}
          loading={loading && !summary}
        />
        <MetricCard
          title="Ingresos"
          info={clienteReportsKpiDescriptions.ingresos}
          value={kpis ? formatCurrency(kpis.ingresos) : '—'}
          description={
            kpis
              ? `Anual ${formatCurrency(kpis.ingresosAnual)}`
              : 'Snapshot Taxi Monterrico'
          }
          sparklineColor="#1DB954"
          sparklineVariant="bar"
          loading={loading && !summary}
        />
        <MetricCard
          title="Tareas completadas"
          info={clienteReportsKpiDescriptions.tasksCompleted}
          value={kpis?.tasksCompleted ?? '—'}
          change={kpis ? kpis.changes.tasks : undefined}
          changeType={kpis ? changeTone(kpis.changes.tasks) : 'neutral'}
          description={
            kpis
              ? `${kpis.tasksPending.toLocaleString('es-PE')} pendientes`
              : 'En el periodo seleccionado'
          }
          sparklineData={weeklySparkValues(summary?.tasksWeekly)}
          sparklineLabels={weeklySparkLabels(summary?.tasksWeekly)}
          sparklineColor="#52D68A"
          sparklineVariant="line"
          sparklineLoading={loading}
          loading={loading && !summary}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] lg:items-start">
        <Card className="h-fit">
          <CardHeader className={cn(chartCardHeaderClass, 'px-5 pb-0 pt-5')}>
            <ChartCardTitle
              title="Clientes por estado"
              info={clienteReportsChartDescriptions.byStatus}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setStatusModalOpen(true)}
              disabled={loading || statusEmpty}
              aria-label="Ampliar clientes por estado"
            >
              <SquareBottomUpSvgIcon className={chartExpandIconClass} />
            </Button>
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-5">
            <ChartCardBody
              loading={loading}
              isEmpty={statusEmpty}
              variant="donut"
              emptyMessage="Sin empresas en la cartera."
              chartHeight={chartHeight}
            >
              <ClienteStatusDonutChart
                data={summary?.byStatus ?? []}
                height={chartHeight}
              />
            </ChartCardBody>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className={cn(chartCardHeaderClass, 'px-5 pb-0 pt-5')}>
            <ChartCardTitle
              title="Ingresos por asesor"
              info={clienteReportsChartDescriptions.ingresosByAdvisor}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setIngresosModalOpen(true)}
              disabled={loading || ingresosEmpty}
              aria-label="Ampliar ingresos por asesor"
            >
              <SquareBottomUpSvgIcon className={chartExpandIconClass} />
            </Button>
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-5">
            <ChartCardBody
              loading={loading}
              isEmpty={ingresosEmpty}
              variant="bar"
              emptyMessage="Sin ingresos reportados."
              chartHeight={chartHeight}
            >
              <ClienteIngresosByAdvisorChart
                data={summary?.ingresosByAdvisor ?? []}
                height={chartHeight}
              />
            </ChartCardBody>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <Card className="h-fit">
          <CardHeader className={cn(chartCardHeaderClass, 'px-5 pb-0 pt-5')}>
            <ChartCardTitle
              title="Altas de empresas y contactos"
              info={clienteReportsChartDescriptions.altas}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setAltasModalOpen(true)}
              disabled={loading || altasEmpty}
              aria-label="Ampliar altas"
            >
              <SquareBottomUpSvgIcon className={chartExpandIconClass} />
            </Button>
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-5">
            <ChartCardBody
              loading={loading}
              isEmpty={altasEmpty}
              variant="area"
              emptyMessage="Sin altas de empresas ni contactos en el periodo."
              chartHeight={altasCardHeight}
            >
              <ClienteAltasAreaChart
                data={summary?.altasByMonth ?? []}
                height={altasChartHeight}
              />
            </ChartCardBody>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className={cn(chartCardHeaderClass, 'px-5 pb-0 pt-5')}>
            <ChartCardTitle
              title="Facturación mensual"
              info={clienteReportsChartDescriptions.monthlyBilling}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setBillingModalOpen(true)}
              disabled={loading || billingEmpty}
              aria-label="Ampliar facturación mensual"
            >
              <SquareBottomUpSvgIcon className={chartExpandIconClass} />
            </Button>
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-5">
            <ChartCardBody
              loading={loading}
              isEmpty={billingEmpty}
              variant="bar"
              emptyMessage="Sin facturación mensual reportada."
              chartHeight={chartHeight}
            >
              <ClienteMonthlyBillingChart
                data={summary?.monthlyBilling ?? []}
                height={chartHeight}
              />
            </ChartCardBody>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader className={cn(chartCardHeaderClass, 'px-5 pb-0 pt-5')}>
          <ChartCardTitle
            title="Actividad por asesor"
            info={clienteReportsChartDescriptions.byAdvisor}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            onClick={() => setAdvisorModalOpen(true)}
            disabled={loading || advisorEmpty}
            aria-label="Ampliar actividad por asesor"
          >
            <SquareBottomUpSvgIcon className={chartExpandIconClass} />
          </Button>
        </CardHeader>
        <CardContent className="px-5 pt-4 pb-5">
          <ChartCardBody
            loading={loading}
            isEmpty={advisorEmpty}
            variant="stackedBar"
            emptyMessage="Sin actividad de cartera por asesor."
            chartHeight={chartHeight}
          >
            <ClienteAdvisorStackedBarChart
              data={summary?.byAdvisor ?? []}
              height={chartHeight}
            />
          </ChartCardBody>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
        <Card className="flex h-full flex-col">
          <CardHeader className={cn(chartCardHeaderClass, 'px-5 pb-0 pt-5')}>
            <ChartCardTitle
              title="Actividades"
              info={clienteReportsChartDescriptions.activities}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setActivitiesModalOpen(true)}
              disabled={loading || activitiesEmpty}
              aria-label="Ampliar actividades"
            >
              <SquareBottomUpSvgIcon className={chartExpandIconClass} />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col px-5 pt-2 pb-5">
            <ChartCardBody
              loading={loading}
              isEmpty={activitiesEmpty}
              variant="stackedBar"
              emptyMessage="Sin actividades de Clientes en el periodo."
              chartHeight={stackedHeight}
              className="flex-1"
            >
              <ActivitiesByTypeWeeklyStackedChart
                data={activitiesHeatmap}
                chartHeight={stackedHeight}
              />
            </ChartCardBody>
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col">
          <CardHeader className={cn(chartCardHeaderClass, 'px-5 pb-0 pt-5')}>
            <ChartCardTitle
              title="Tareas"
              info={clienteReportsChartDescriptions.tasks}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setTasksModalOpen(true)}
              disabled={loading || tasksEmpty}
              aria-label="Ampliar tareas"
            >
              <SquareBottomUpSvgIcon className={chartExpandIconClass} />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col px-5 pt-2 pb-5">
            <ChartCardBody
              loading={loading}
              isEmpty={tasksEmpty}
              variant="stackedBar"
              emptyMessage="Sin tareas de Clientes en el periodo."
              chartHeight={stackedHeight}
              className="flex-1"
            >
              <TasksByKindWeeklyStackedChart
                data={tasksHeatmap}
                chartHeight={stackedHeight}
              />
            </ChartCardBody>
          </CardContent>
        </Card>
      </div>

      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className={dialogContentClass}>
          <DialogHeader className="px-6 pt-5">
            <DialogTitle>Clientes por estado</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <ClienteStatusDonutChart
              data={summary?.byStatus ?? []}
              height={420}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ingresosModalOpen} onOpenChange={setIngresosModalOpen}>
        <DialogContent className={dialogContentClass}>
          <DialogHeader className="px-6 pt-5">
            <DialogTitle>Ingresos por asesor</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <ClienteIngresosByAdvisorChart
              data={summary?.ingresosByAdvisor ?? []}
              height={480}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={altasModalOpen} onOpenChange={setAltasModalOpen}>
        <DialogContent className={dialogContentClass}>
          <DialogHeader className="px-6 pt-5">
            <DialogTitle>Altas de empresas y contactos</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <ClienteAltasAreaChart
              data={summary?.altasByMonth ?? []}
              height={400}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={billingModalOpen} onOpenChange={setBillingModalOpen}>
        <DialogContent className={dialogContentClass}>
          <DialogHeader className="px-6 pt-5">
            <DialogTitle>Facturación mensual</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <ClienteMonthlyBillingChart
              data={summary?.monthlyBilling ?? []}
              height={420}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={advisorModalOpen} onOpenChange={setAdvisorModalOpen}>
        <DialogContent className={dialogContentClass}>
          <DialogHeader className="px-6 pt-5">
            <DialogTitle>Actividad por asesor</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <ClienteAdvisorStackedBarChart
              data={summary?.byAdvisor ?? []}
              height={420}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activitiesModalOpen} onOpenChange={setActivitiesModalOpen}>
        <DialogContent className={dialogContentClass}>
          <DialogHeader className="px-6 pt-5">
            <DialogTitle>Actividades de Clientes</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <ActivitiesByTypeWeeklyStackedChart
              data={activitiesHeatmap}
              chartHeight={420}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={tasksModalOpen} onOpenChange={setTasksModalOpen}>
        <DialogContent className={dialogContentClass}>
          <DialogHeader className="px-6 pt-5">
            <DialogTitle>Tareas de Clientes</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <TasksByKindWeeklyStackedChart
              data={tasksHeatmap}
              chartHeight={420}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
