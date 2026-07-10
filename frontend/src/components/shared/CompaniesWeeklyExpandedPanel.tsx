import { useState } from 'react';
import { OpportunitiesWeeklyProgressStackedChart } from '@/components/shared/OpportunitiesWeeklyProgressStackedChart';
import type { WeeklyPortfolioProgressPoint } from '@/components/shared/OpportunitiesWeeklyProgressStackedChart';
import { CompaniesAdvisorFunnelMovement } from '@/components/shared/CompaniesAdvisorFunnelMovement';
import type { AdvisorFunnelMovementSnapshot } from '@/lib/companiesAdvisorMovement';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export type CompaniesWeeklyModalView = 'chart' | 'advisors';

interface CompaniesWeeklyExpandedPanelProps {
  chartData: WeeklyPortfolioProgressPoint[];
  chartEmpty: boolean;
  advisorMovement: AdvisorFunnelMovementSnapshot;
  chartHeight?: number;
  className?: string;
  view?: CompaniesWeeklyModalView;
  onViewChange?: (view: CompaniesWeeklyModalView) => void;
}

export function CompaniesWeeklyExpandedPanel({
  chartData,
  chartEmpty,
  advisorMovement,
  chartHeight = 480,
  className,
  view: controlledView,
  onViewChange,
}: CompaniesWeeklyExpandedPanelProps) {
  const [internalView, setInternalView] = useState<CompaniesWeeklyModalView>('chart');
  const view = controlledView ?? internalView;

  const setView = (next: CompaniesWeeklyModalView) => {
    onViewChange?.(next);
    if (controlledView === undefined) setInternalView(next);
  };

  return (
    <Tabs
      value={view}
      onValueChange={(next) => setView(next as CompaniesWeeklyModalView)}
      className={cn('flex min-h-0 flex-1 flex-col gap-4', className)}
    >
      <TabsList variant="line" className="h-8 w-fit gap-0.5 p-0.5">
        <TabsTrigger value="chart" className="h-7 px-2.5 text-xs">
          Gráfico
        </TabsTrigger>
        <TabsTrigger value="advisors" className="h-7 px-2.5 text-xs">
          Por asesor
        </TabsTrigger>
      </TabsList>

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
        <CompaniesAdvisorFunnelMovement data={advisorMovement} />
      </TabsContent>
    </Tabs>
  );
}
