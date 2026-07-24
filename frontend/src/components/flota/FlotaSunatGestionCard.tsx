import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Hash,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { endOfWeek, startOfWeek } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ChartCardTitle } from '@/components/shared/ChartCardTitle';
import { flotaDashboardChartDescriptions } from '@/lib/dashboardChartDescriptions';
import { DateRangeFilterButton } from '@/components/ui/date-range-filter-button';
import { ChartCardBody } from '@/components/shared/ChartCardBody';
import { SunatDailyMixedChart } from '@/components/flota/SunatDailyMixedChart';
import { useFlotaReportesData, useFlotaReportesSunat } from '@/hooks/useFlotaReportesData';
import { usePorAutorizarCount } from '@/hooks/usePorAutorizarCount';
import {
  buildSunatChartData,
  buildSunatMetrics,
  filterSunatHistory,
  type SunatMetrics,
} from '@/lib/flotaDashboardChartUtils';
import { cn } from '@/lib/utils';

const CHART_HEIGHT = 280;
const DATE_FILTER_CLASS =
  'w-[248px] !bg-transparent hover:!bg-transparent dark:!bg-transparent dark:hover:!bg-transparent';

function SunatMetricsGrid({ metrics }: { metrics: SunatMetrics }) {
  return (
    <div className="grid grid-cols-2 justify-items-center gap-4 pt-6 md:grid-cols-3 lg:grid-cols-6">
      <div className="space-y-1 text-center">
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
          <CheckCircle2 className="size-3 text-[#13944C]" />
          Autorizados
        </p>
        <p
          className={cn(
            'text-2xl font-bold tabular-nums tracking-tighter',
            metrics.autorizados > 0 ? 'text-[#13944C]' : 'text-muted-foreground',
          )}
        >
          {metrics.autorizados}
        </p>
      </div>
      <div className="space-y-1 text-center">
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
          <XCircle
            className={cn(
              'size-3',
              metrics.noAutorizados > 0 ? 'text-red-500' : 'text-muted-foreground/60',
            )}
          />
          No Aut.
        </p>
        <p
          className={cn(
            'text-2xl font-bold tabular-nums tracking-tighter',
            metrics.noAutorizados > 0 ? 'text-red-500' : 'text-muted-foreground',
          )}
        >
          {metrics.noAutorizados}
        </p>
      </div>
      <div className="space-y-1 text-center">
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
          <AlertTriangle
            className={cn(
              'size-3',
              metrics.penalizados > 0 ? 'text-amber-500' : 'text-muted-foreground/60',
            )}
          />
          Penalizados
        </p>
        <p
          className={cn(
            'text-2xl font-bold tabular-nums tracking-tighter',
            metrics.penalizados > 0 ? 'text-amber-500' : 'text-muted-foreground',
          )}
        >
          {metrics.penalizados}
        </p>
      </div>
      <div className="space-y-1 text-center">
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
          <Hash className="size-3 text-[#13944C]" />
          Servicios
        </p>
        <p className="text-2xl font-bold tabular-nums tracking-tighter text-foreground">
          {metrics.servicios}
        </p>
      </div>
      <div className="space-y-1 text-center">
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
          <Car className="size-3 text-[#13944C]" />
          Por Autorizar
        </p>
        <p className="text-2xl font-bold tabular-nums tracking-tighter text-foreground">
          {metrics.porAutorizar}
        </p>
      </div>
      <div className="space-y-1 text-center">
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
          <UserPlus className="size-3 text-[#059669]" />
          Nuevos Ing.
        </p>
        <p
          className={cn(
            'text-2xl font-bold tabular-nums tracking-tighter',
            metrics.nuevosIngresos > 0 ? 'text-[#059669]' : 'text-muted-foreground',
          )}
        >
          {metrics.nuevosIngresos}
        </p>
      </div>
    </div>
  );
}

type FlotaSunatGestionCardProps = {
  className?: string;
};

export function FlotaSunatGestionCard({ className }: FlotaSunatGestionCardProps) {
  const { conductores } = useFlotaReportesData();
  const porAutorizarCount = usePorAutorizarCount();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  }));

  const { sunatHistory, loadingSunatReal } = useFlotaReportesSunat(dateRange);

  const sunatFiltered = useMemo(() => filterSunatHistory(sunatHistory), [sunatHistory]);

  const sunatChartData = useMemo(
    () => buildSunatChartData(sunatFiltered, dateRange),
    [sunatFiltered, dateRange],
  );

  const sunatMetrics = useMemo(
    () =>
      buildSunatMetrics(
        sunatFiltered,
        conductores,
        dateRange,
        porAutorizarCount,
        loadingSunatReal,
      ),
    [sunatFiltered, conductores, dateRange, porAutorizarCount, loadingSunatReal],
  );

  return (
    <Card className={cn('flex h-full flex-col py-0', className)}>
      <CardHeader className="pb-2 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ChartCardTitle
            title="SUNAT - Gestión de Flota"
            info={flotaDashboardChartDescriptions.sunatGestion}
          />
          <DateRangeFilterButton
            value={dateRange}
            onChange={setDateRange}
            placeholder="Seleccionar fechas"
            className={DATE_FILTER_CLASS}
          />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <ChartCardBody
          loading={loadingSunatReal}
          isEmpty={sunatChartData.length === 0}
          variant="bar"
          chartHeight={CHART_HEIGHT}
          className="min-h-0"
          emptyMessage="Sin datos SUNAT en el periodo"
        >
          <SunatDailyMixedChart rows={sunatChartData} chartHeight={CHART_HEIGHT} />
        </ChartCardBody>
        <SunatMetricsGrid metrics={sunatMetrics} />
      </CardContent>
    </Card>
  );
}
