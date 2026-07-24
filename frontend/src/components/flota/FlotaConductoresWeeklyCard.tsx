import { useEffect, useMemo, useRef, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { endOfWeek, startOfWeek, subWeeks } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ChartCardTitle } from '@/components/shared/ChartCardTitle';
import { flotaDashboardChartDescriptions } from '@/lib/dashboardChartDescriptions';
import { DateRangeFilterButton } from '@/components/ui/date-range-filter-button';
import { ChartCardBody } from '@/components/shared/ChartCardBody';
import { ConductoresWeeklyAreaChart } from '@/components/flota/ConductoresWeeklyAreaChart';
import { useFlotaReportesData } from '@/hooks/useFlotaReportesData';
import {
  buildConductoresWeeklyData,
  filterConductoresWeeklyByRange,
} from '@/lib/flotaDashboardChartUtils';
import { cn } from '@/lib/utils';

const MIN_CHART_HEIGHT = 280;
const DATE_FILTER_CLASS =
  'w-[248px] !bg-transparent hover:!bg-transparent dark:!bg-transparent dark:hover:!bg-transparent';

type FlotaConductoresWeeklyCardProps = {
  className?: string;
};

export function FlotaConductoresWeeklyCard({ className }: FlotaConductoresWeeklyCardProps) {
  const { conductores, loadingConductores } = useFlotaReportesData();
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(MIN_CHART_HEIGHT);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfWeek(subWeeks(new Date(), 3), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  }));

  useEffect(() => {
    const el = chartAreaRef.current;
    if (!el) return;

    const measure = () => {
      const next = Math.floor(el.getBoundingClientRect().height);
      if (next >= MIN_CHART_HEIGHT) {
        setChartHeight(next);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const weeklyData = useMemo(
    () => buildConductoresWeeklyData(conductores),
    [conductores],
  );

  const filteredWeeklyData = useMemo(
    () => filterConductoresWeeklyByRange(weeklyData, dateRange),
    [weeklyData, dateRange],
  );

  return (
    <Card className={cn('flex h-full flex-col py-0', className)}>
      <CardHeader className="shrink-0 pb-2 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ChartCardTitle
            title="Nuevos Conductores"
            info={flotaDashboardChartDescriptions.nuevosConductores}
          />
          <DateRangeFilterButton
            value={dateRange}
            onChange={setDateRange}
            placeholder="Seleccionar fechas"
            className={DATE_FILTER_CLASS}
          />
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-0">
        <div ref={chartAreaRef} className="min-h-[280px] flex-1">
          <ChartCardBody
            loading={loadingConductores}
            isEmpty={filteredWeeklyData.length === 0}
            variant="area"
            chartHeight={chartHeight}
            className="h-full min-h-0"
            emptyMessage="Sin datos de conductores en el periodo"
          >
            <ConductoresWeeklyAreaChart rows={filteredWeeklyData} chartHeight={chartHeight} />
          </ChartCardBody>
        </div>
      </CardContent>
    </Card>
  );
}
