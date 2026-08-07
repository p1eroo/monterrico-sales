import { useMemo } from 'react';
import { FunnelChart } from '@/components/crm/FunnelChart';
import {
  CompaniesByAdvisorStageTable,
  type CompaniesByAdvisorStageComparison,
} from '@/components/shared/CompaniesByAdvisorStageTable';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CompaniesWeeklyComparison } from '@/lib/companyStageFunnelData';
import { cn } from '@/lib/utils';

export type CompaniesStageWeekView = 'compare' | 'current' | 'previous';

interface CompaniesStageWeekTabsProps {
  value: CompaniesStageWeekView;
  onValueChange: (value: CompaniesStageWeekView) => void;
  currentWeekLabel: string;
  previousWeekLabel: string;
  className?: string;
}

export function CompaniesStageWeekTabs({
  value,
  onValueChange,
  currentWeekLabel,
  previousWeekLabel,
  className,
}: CompaniesStageWeekTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onValueChange(next as CompaniesStageWeekView)}
      className={cn('w-fit', className)}
    >
      <TabsList variant="line" className="h-8 w-fit gap-0.5 p-0.5">
        <TabsTrigger value="compare" className="h-7 px-2.5 text-xs">
          Comparar
        </TabsTrigger>
        <TabsTrigger value="current" className="h-7 px-2.5 text-xs">
          {currentWeekLabel}
        </TabsTrigger>
        <TabsTrigger value="previous" className="h-7 px-2.5 text-xs">
          {previousWeekLabel}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

interface CompaniesStageExpandedPanelProps {
  weeklyComparison: CompaniesWeeklyComparison;
  view: CompaniesStageWeekView;
  className?: string;
}

export function CompaniesStageExpandedPanel({
  weeklyComparison,
  view,
  className,
}: CompaniesStageExpandedPanelProps) {
  const { totalFunnelStages, currentWeek, previousWeek } = weeklyComparison;

  const tableComparison: CompaniesByAdvisorStageComparison | undefined = useMemo(
    () =>
      view === 'compare'
        ? {
            currentWeekLabel: currentWeek.weekLabel,
            previousWeekLabel: previousWeek.weekLabel,
            previousTable: previousWeek.table,
          }
        : undefined,
    [view, currentWeek, previousWeek],
  );

  const funnelStages =
    view === 'compare'
      ? currentWeek.funnelStages
      : view === 'previous'
        ? previousWeek.funnelStages
        : currentWeek.funnelStages;
  const table = view === 'previous' ? previousWeek.table : currentWeek.table;

  if (funnelStages.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] xl:items-center',
        className,
      )}
    >
      <div className="flex min-w-0 justify-center">
        <div className="w-full max-w-md">
          <FunnelChart stages={funnelStages} height={560} singularLabel="empresa" />
        </div>
      </div>
      <div className="flex min-w-0 w-full justify-center">
        <CompaniesByAdvisorStageTable
          data={table}
          comparison={tableComparison}
          className="w-full"
        />
      </div>
    </div>
  );
}
