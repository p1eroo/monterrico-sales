import { useState, useEffect, useMemo, useCallback } from 'react';

import { subMonths, startOfMonth, endOfMonth } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  Percent,
  UserPlus,
  AlertTriangle,
  DollarSign,
  Phone,
  Mail,
  Clock,
  FileText,
  MessageSquare,
  CalendarDays,
  Maximize2,
} from 'lucide-react';
import { toast } from 'sonner';
import { buildOpportunitiesStageFunnelStages } from '@/lib/companyStageFunnelData';
import { AdvisorPerformanceBarChart } from '@/components/shared/AdvisorPerformanceBarChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { contactSourceLabels } from '@/data/mock';
import type { Contact } from '@/types';
import { contactListAll, mapApiContactRowToContact } from '@/lib/contactApi';
import { FunnelChart, type FunnelStage } from '@/components/crm/FunnelChart';
import { GoalsStatisticsCard } from '@/components/shared/GoalsStatisticsCard';
import { OpportunitiesBySourceRadarCard } from '@/components/shared/OpportunitiesBySourceRadarCard';
import { formatCurrency, formatDateShort } from '@/lib/formatters';
import { usePermissions } from '@/hooks/usePermissions';
import {
  fetchAnalyticsSummary,
  fetchAnalyticsKPIs,
  formatLocalISODate,
  type AnalyticsSummary,
  type AnalyticsKPIs,
} from '@/lib/analyticsApi';
import {
  downloadReport,
  dashboardExportBaseFilename,
  type ReportsExportInput,
} from '@/lib/reportsExport';
import { useCrmConfigStore, getStageLabelFromCatalog, getSourceLabelFromCatalog } from '@/store/crmConfigStore';
import { ChartCardBody } from '@/components/shared/ChartCardBody';
import { chartHasAnyValue } from '@/lib/chartEmpty';

const activityIconMap: Record<string, typeof Phone> = {
  llamada: Phone,
  correo: Mail,
  reunion: CalendarDays,
  tarea: FileText,
  whatsapp: MessageSquare,
};

function changeTone(s: string): 'positive' | 'negative' | 'neutral' {
  const t = s.trim();
  if (t.startsWith('-')) return 'negative';
  if (t.startsWith('+')) return 'positive';
  return 'neutral';
}

export default function Dashboard() {
  const { hasPermission } = usePermissions();
  const bundle = useCrmConfigStore((s) => s.bundle);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(subMonths(new Date(), 1)),
    to: endOfMonth(new Date()),
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [kpis, setKpis] = useState<AnalyticsKPIs | null>(null);
  const [kpisLoading, setKpisLoading] = useState(false);
  const [funnelChartModalOpen, setFunnelChartModalOpen] = useState(false);
  const [advisorChartModalOpen, setAdvisorChartModalOpen] = useState(false);

  useEffect(() => {
    let c = true;
    void contactListAll()
      .then((rows) => {
        if (c) setContacts(rows.map(mapApiContactRowToContact));
      })
      .catch(() => {
        if (c) setContacts([]);
      });
    return () => {
      c = false;
    };
  }, []);

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
    void fetchAnalyticsKPIs({ from, to, area: 'comercial' })
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
    void fetchAnalyticsSummary({ from, to, area: 'comercial' })
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
  }, [dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

  const latestContacts = useMemo(() => {
    return [...contacts]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 5);
  }, [contacts]);

  const pendingActivities = useMemo(() => {
    return (summary?.pendingActivities ?? []).slice(0, 5);
  }, [summary]);

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
  const advisorChartEmpty =
    !summaryLoading &&
    (!summary || !chartHasAnyValue(performanceByAdvisor, ['oportunidades', 'contactos', 'empresas']));

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
          advisorLabel: 'Todos los asesores',
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
            className={cn('w-[260px]', comercialFilterSurfaceClass)}
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
          value={kpis?.activeOpportunities ?? '—'}
          change={kpis ? kpis.changes.opportunities : undefined}
          changeType={kpis ? changeTone(kpis.changes.opportunities) : 'neutral'}
          description="últimos 7 días"
          sparklineData={opportunitiesSparkline}
          sparklineLabels={opportunitiesSparklineLabels}
          sparklineColor="#06b6d4"
          sparklineLoading={summaryLoading}
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
                <CardTitle className="text-base font-medium">Oportunidades por fuente</CardTitle>
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

      {/* Funnel + Rendimiento */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[45fr_55fr]">
        {/* Funnel de Ventas */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2 max-md:pb-1.5">
            <CardTitle className="text-base font-medium">Funnel de Ventas</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setFunnelChartModalOpen(true)}
              disabled={summaryLoading || funnelChartEmpty}
              aria-label="Ampliar funnel de ventas"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="max-md:px-3 max-md:pb-2 max-md:pt-0">
            <ChartCardBody
              loading={summaryLoading}
              isEmpty={funnelChartEmpty}
              variant="bar"
              emptyMessage="Sin datos de embudo en este periodo."
              className="min-h-[min(56vh,460px)] py-3 max-md:min-h-0 max-md:py-1"
            >
              <FunnelChart stages={funnelStages} height={420} singularLabel="oportunidad" />
            </ChartCardBody>
          </CardContent>
        </Card>

        {/* Rendimiento por Asesor */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Rendimiento por Asesor</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => setAdvisorChartModalOpen(true)}
              disabled={summaryLoading || advisorChartEmpty}
              aria-label="Ampliar gráfico de rendimiento por asesor"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ChartCardBody
              loading={summaryLoading}
              isEmpty={advisorChartEmpty}
              variant="bar"
              emptyMessage="Sin rendimiento por asesor en este periodo."
              className="h-[min(52vh,420px)] py-3"
            >
              <AdvisorPerformanceBarChart data={performanceByAdvisor} height={400} />
            </ChartCardBody>
          </CardContent>
        </Card>
      </div>

      <Dialog open={funnelChartModalOpen} onOpenChange={setFunnelChartModalOpen}>
        <DialogContent className={dashboardChartModalClass} showCloseButton>
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

      <Dialog open={advisorChartModalOpen} onOpenChange={setAdvisorChartModalOpen}>
        <DialogContent className={dashboardChartModalClass} showCloseButton>
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-base">Rendimiento por Asesor</DialogTitle>
          </DialogHeader>
          <div className="w-full px-6 pb-6 pt-4">
            {!advisorChartEmpty ? (
              <AdvisorPerformanceBarChart data={performanceByAdvisor} height={520} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Sections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Últimos Contactos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Últimos Contactos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {latestContacts.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Aún no hay contactos registrados.
                </p>
              ) : null}
              {latestContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 bg-card/30 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{contact.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {contact.companies?.find((c) => c.isPrimary)?.name ?? contact.companies?.[0]?.name ?? '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 pl-4">
                    <StatusBadge status={contact.etapa} />
                    <span className="text-xs text-muted-foreground">
                      {formatDateShort(contact.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tareas pendientes / vencidas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Tareas pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!summaryLoading && pendingActivities.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No hay tareas pendientes.
                </p>
              ) : null}
              {pendingActivities.map((activity) => {
                const t = (
                  activity.taskKind ?? activity.type ?? ''
                ).toLowerCase();
                const IconComp = activityIconMap[t] ?? Clock;
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/30 p-3"
                  >
                    <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
                      activity.status === 'vencida'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      <IconComp className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {activity.title}
                        </p>
                        {activity.status === 'vencida' && (
                          <StatusBadge status="vencida" />
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {activity.contactName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateShort(activity.dueDate)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
