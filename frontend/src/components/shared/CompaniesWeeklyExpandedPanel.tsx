import { useEffect, useState } from 'react';
import { OpportunitiesWeeklyProgressStackedChart } from '@/components/shared/OpportunitiesWeeklyProgressStackedChart';
import type { WeeklyPortfolioProgressPoint } from '@/components/shared/OpportunitiesWeeklyProgressStackedChart';
import { CompaniesAdvisorFunnelMovement } from '@/components/shared/CompaniesAdvisorFunnelMovement';
import type { AdvisorFunnelMovementDetailQuery } from '@/lib/analyticsApi';
import {
  advisorFunnelPeriodFilterLabel,
  type AdvisorFunnelMovementBundle,
} from '@/lib/companiesAdvisorMovement';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export type CompaniesWeeklyModalView = 'chart' | 'advisors';

interface CompaniesWeeklyExpandedPanelProps {
  chartData: WeeklyPortfolioProgressPoint[];
  chartEmpty: boolean;
  advisorMovement: AdvisorFunnelMovementBundle;
  advisorMovementDetailQuery: AdvisorFunnelMovementDetailQuery;
  chartHeight?: number;
  className?: string;
  view?: CompaniesWeeklyModalView;
  onViewChange?: (view: CompaniesWeeklyModalView) => void;
}

export function CompaniesWeeklyExpandedPanel({
  chartData,
  chartEmpty,
  advisorMovement,
  advisorMovementDetailQuery,
  chartHeight = 480,
  className,
  view: controlledView,
  onViewChange,
}: CompaniesWeeklyExpandedPanelProps) {
  const [internalView, setInternalView] = useState<CompaniesWeeklyModalView>('chart');
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(0);
  const view = controlledView ?? internalView;

  const setView = (next: CompaniesWeeklyModalView) => {
    onViewChange?.(next);
    if (controlledView === undefined) setInternalView(next);
  };

  useEffect(() => {
    setSelectedPeriodIndex(0);
  }, [advisorMovement.periods]);

  const selectedPeriod =
    advisorMovement.periods[selectedPeriodIndex] ?? advisorMovement.periods[0] ?? null;

  return (
    <Tabs
      value={view}
      onValueChange={(next) => setView(next as CompaniesWeeklyModalView)}
      className={cn('flex min-h-0 flex-1 flex-col gap-4', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <TabsList variant="line" className="h-8 w-fit gap-0.5 p-0.5">
          <TabsTrigger value="chart" className="h-7 px-2.5 text-xs">
            Gráfico
          </TabsTrigger>
          <TabsTrigger value="advisors" className="h-7 px-2.5 text-xs">
            Por asesor
          </TabsTrigger>
        </TabsList>

        {view === 'advisors' && advisorMovement.periods.length > 0 ? (
          <div
            className="flex flex-wrap items-center gap-1"
            role="group"
            aria-label="Filtrar por semanas"
          >
            {advisorMovement.periods.map((period, index) => (
              <button
                key={`${period.fromWeekNumber}-${period.toWeekNumber}`}
                type="button"
                onClick={() => setSelectedPeriodIndex(index)}
                className={cn(
                  'h-7 rounded-md border px-2.5 text-xs font-medium transition-colors',
                  selectedPeriodIndex === index
                    ? 'border-[#13944C] bg-[#13944C]/10 text-[#13944C]'
                    : 'border-transparent text-muted-foreground hover:bg-muted/80',
                )}
              >
                {advisorFunnelPeriodFilterLabel(period)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <TabsContent value="chart" className="mt-0 min-h-0 flex-1">
        {!chartEmpty ? (
          <OpportunitiesWeeklyProgressStackedChart
            data={chartData}
            height={chartHeight}
            showLegend
          />
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No hay datos de empresas
          </div>
        )}
      </TabsContent>

      <TabsContent value="advisors" className="mt-0 min-h-0 flex-1">
        {selectedPeriod ? (
          <CompaniesAdvisorFunnelMovement
            data={selectedPeriod}
            detailQuery={advisorMovementDetailQuery}
          />
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            Sin movimiento por asesor en las últimas semanas.
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
