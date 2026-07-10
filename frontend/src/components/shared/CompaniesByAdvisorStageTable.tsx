import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatCurrencyCompact } from '@/lib/formatters';
import type { CompaniesByAdvisorStageTableData } from '@/lib/companyStageFunnelData';
import { cn } from '@/lib/utils';

const thClass =
  'h-10 min-w-[4.75rem] px-3 py-2.5 text-center text-sm font-medium normal-case tracking-normal text-muted-foreground';
const stageThClass =
  'sticky left-0 z-10 min-w-[9.5rem] bg-muted/60 px-3 py-2.5 text-left text-sm font-medium normal-case tracking-normal text-muted-foreground';
const stageTdClass =
  'sticky left-0 z-10 bg-card px-3 py-2.5 text-sm font-medium text-foreground';
const footerRowClass = 'border-t border-border bg-muted/30 hover:bg-muted/30';
const footerStageTdClass =
  'sticky left-0 z-10 bg-muted/30 px-3 py-2.5 text-sm font-medium text-foreground';
const footerDataCellClass =
  'min-w-[4.75rem] bg-muted/30 px-3 py-2.5 text-center font-medium tabular-nums text-foreground';
const dataCellClass =
  'min-w-[4.75rem] px-3 py-2.5 text-center font-medium tabular-nums text-foreground';

function formatCount(value: number): string {
  return value > 0 ? String(value) : '—';
}

function sumCounts(
  counts: Record<string, number>,
  advisorIds: string[],
): number {
  return advisorIds.reduce((acc, id) => acc + (counts[id] ?? 0), 0);
}

function formatDelta(delta: number): string {
  if (delta === 0) return '0';
  return delta > 0 ? `+${delta}` : String(delta);
}

function deltaBadgeClass(delta: number): string {
  if (delta > 0) {
    return 'rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300';
  }
  if (delta < 0) {
    return 'rounded-md bg-red-500/12 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-400/15 dark:text-red-300';
  }
  return 'text-xs font-medium text-muted-foreground';
}

function deltaTone(delta: number): string {
  if (delta > 0) return 'text-emerald-700 dark:text-emerald-300';
  if (delta < 0) return 'text-red-700 dark:text-red-300';
  return 'text-muted-foreground';
}

export type CompaniesByAdvisorStageComparison = {
  currentWeekLabel: string;
  previousWeekLabel: string;
  previousTable: CompaniesByAdvisorStageTableData;
};

interface CompaniesByAdvisorStageTableProps {
  data: CompaniesByAdvisorStageTableData;
  comparison?: CompaniesByAdvisorStageComparison;
  className?: string;
}

function CountCell({
  current,
  previous,
  currentWeekLabel,
  previousWeekLabel,
  showDelta,
  className,
}: {
  current: number;
  previous?: number;
  currentWeekLabel?: string;
  previousWeekLabel?: string;
  showDelta: boolean;
  className?: string;
}) {
  const delta = previous != null ? current - previous : 0;
  const content = (
    <div className="inline-flex items-center justify-center gap-1.5">
      <span className="text-sm tabular-nums">{formatCount(current)}</span>
      {showDelta && previous != null && delta !== 0 ? (
        <span className={cn('leading-none', deltaBadgeClass(delta))}>
          {formatDelta(delta)}
        </span>
      ) : null}
    </div>
  );

  if (!showDelta || previous == null || !currentWeekLabel || !previousWeekLabel) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full cursor-default rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          {content}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="min-w-[9rem] px-3 py-2 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{currentWeekLabel}</span>
            <span className="font-medium tabular-nums">{formatCount(current)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{previousWeekLabel}</span>
            <span className="tabular-nums">{formatCount(previous)}</span>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-1">
            <span className="text-muted-foreground">Variación</span>
            <span className={cn('font-medium tabular-nums', deltaTone(delta))}>
              {formatDelta(delta)}
            </span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function BillingCell({
  current,
  previous,
  currentWeekLabel,
  previousWeekLabel,
  showDelta,
  className,
}: {
  current: number;
  previous?: number;
  currentWeekLabel?: string;
  previousWeekLabel?: string;
  showDelta: boolean;
  className?: string;
}) {
  const delta = previous != null ? current - previous : 0;
  const content = (
    <div className="inline-flex items-center justify-center gap-1.5">
      <span className="text-sm tabular-nums">{formatCurrencyCompact(current)}</span>
      {showDelta && previous != null && delta !== 0 ? (
        <span className={cn('leading-none', deltaBadgeClass(delta))}>
          {delta > 0 ? '+' : ''}
          {formatCurrencyCompact(delta)}
        </span>
      ) : null}
    </div>
  );

  if (!showDelta || previous == null || !currentWeekLabel || !previousWeekLabel) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full cursor-default rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          {content}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="min-w-[9rem] px-3 py-2 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{currentWeekLabel}</span>
            <span className="font-medium tabular-nums">{formatCurrencyCompact(current)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{previousWeekLabel}</span>
            <span className="tabular-nums">{formatCurrencyCompact(previous)}</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function CompaniesByAdvisorStageTable({
  data,
  comparison,
  className,
}: CompaniesByAdvisorStageTableProps) {
  const advisorIds = data.advisors.map((a) => a.id);
  const showDelta = comparison != null;
  const previousBySlug = new Map(
    (comparison?.previousTable.stages ?? []).map((stage) => [stage.slug, stage]),
  );

  const grandTotalCount = data.stages.reduce(
    (acc, stage) => acc + sumCounts(stage.counts, advisorIds),
    0,
  );
  const grandTotalBilling = Object.values(data.estimatedBillingByAdvisor).reduce(
    (acc, v) => acc + v,
    0,
  );
  const previousGrandTotalCount = comparison
    ? comparison.previousTable.stages.reduce(
        (acc, stage) => acc + sumCounts(stage.counts, advisorIds),
        0,
      )
    : undefined;
  const previousGrandTotalBilling = comparison
    ? Object.values(comparison.previousTable.estimatedBillingByAdvisor).reduce(
        (acc, v) => acc + v,
        0,
      )
    : undefined;

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('min-w-0 overflow-hidden rounded-lg border border-border', className)}>
        <Table containerClassName="overflow-x-auto">
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className={stageThClass}>Etapa</TableHead>
              {data.advisors.map((advisor) => (
                <TableHead key={advisor.id} className={cn(thClass, advisor.headerClass)}>
                  {advisor.name}
                </TableHead>
              ))}
              <TableHead className={cn(thClass, 'text-foreground')}>
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.stages.map((stage) => {
              const previousStage = previousBySlug.get(stage.slug);
              const rowTotal = sumCounts(stage.counts, advisorIds);
              const previousRowTotal = previousStage
                ? sumCounts(previousStage.counts, advisorIds)
                : undefined;

              return (
                <TableRow key={stage.slug} className="border-border hover:bg-transparent">
                  <TableCell className={stageTdClass}>
                    {stage.probability}% {stage.shortLabel}
                  </TableCell>
                  {data.advisors.map((advisor) => (
                    <TableCell key={advisor.id} className={dataCellClass}>
                      <CountCell
                        current={stage.counts[advisor.id] ?? 0}
                        previous={previousStage?.counts[advisor.id]}
                        currentWeekLabel={comparison?.currentWeekLabel}
                        previousWeekLabel={comparison?.previousWeekLabel}
                        showDelta={showDelta}
                      />
                    </TableCell>
                  ))}
                  <TableCell className={dataCellClass}>
                    <CountCell
                      current={rowTotal}
                      previous={previousRowTotal}
                      currentWeekLabel={comparison?.currentWeekLabel}
                      previousWeekLabel={comparison?.previousWeekLabel}
                      showDelta={showDelta}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className={footerRowClass}>
              <TableCell className={footerStageTdClass}>Total</TableCell>
              {data.advisors.map((advisor) => {
                const advisorTotal = data.stages.reduce(
                  (acc, stage) => acc + (stage.counts[advisor.id] ?? 0),
                  0,
                );
                const previousAdvisorTotal = comparison
                  ? comparison.previousTable.stages.reduce(
                      (acc, stage) => acc + (stage.counts[advisor.id] ?? 0),
                      0,
                    )
                  : undefined;
                return (
                  <TableCell key={advisor.id} className={footerDataCellClass}>
                    <CountCell
                      current={advisorTotal}
                      previous={previousAdvisorTotal}
                      currentWeekLabel={comparison?.currentWeekLabel}
                      previousWeekLabel={comparison?.previousWeekLabel}
                      showDelta={showDelta}
                    />
                  </TableCell>
                );
              })}
              <TableCell className={footerDataCellClass}>
                <CountCell
                  current={grandTotalCount}
                  previous={previousGrandTotalCount}
                  currentWeekLabel={comparison?.currentWeekLabel}
                  previousWeekLabel={comparison?.previousWeekLabel}
                  showDelta={showDelta}
                />
              </TableCell>
            </TableRow>
            <TableRow className={footerRowClass}>
              <TableCell className={footerStageTdClass}>Fact. Estimada</TableCell>
              {data.advisors.map((advisor) => (
                <TableCell key={advisor.id} className={footerDataCellClass}>
                  <BillingCell
                    current={data.estimatedBillingByAdvisor[advisor.id] ?? 0}
                    previous={comparison?.previousTable.estimatedBillingByAdvisor[advisor.id]}
                    currentWeekLabel={comparison?.currentWeekLabel}
                    previousWeekLabel={comparison?.previousWeekLabel}
                    showDelta={showDelta}
                  />
                </TableCell>
              ))}
              <TableCell className={footerDataCellClass}>
                <BillingCell
                  current={grandTotalBilling}
                  previous={previousGrandTotalBilling}
                  currentWeekLabel={comparison?.currentWeekLabel}
                  previousWeekLabel={comparison?.previousWeekLabel}
                  showDelta={showDelta}
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
