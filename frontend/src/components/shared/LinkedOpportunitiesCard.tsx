import { useMemo } from 'react';
import { BusinessGraphBoardSvgIcon } from '@/components/icons/BusinessGraphBoardSvgIcon';
import { CalendarSvgIcon } from '@/components/icons/CalendarSvgIcon';
import { MoneyBagSvgIcon } from '@/components/icons/MoneyBagSvgIcon';
import { PrioritySvgIcon } from '@/components/icons/PrioritySvgIcon';
import { etapaLabels, priorityLabels } from '@/data/mock';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { LinkedEntitiesCard } from './LinkedEntitiesCard';
import { LinkedEntityItemHeader } from './LinkedEntityItemHeader';
import type { Opportunity } from '@/types';
import { opportunityDetailHref } from '@/lib/detailRoutes';
import { getHighestPriorityOpportunity } from '@/lib/opportunityUtils';

const fieldIconClass = 'h-3.5 w-3.5 shrink-0 text-text-tertiary';

function resolvePrimaryOpportunityId(opportunities: Opportunity[]): string | undefined {
  if (opportunities.length < 2) return undefined;
  return getHighestPriorityOpportunity(opportunities)?.id;
}

interface LinkedOpportunitiesCardProps {
  opportunities: Opportunity[];
  onCreate?: () => void;
  onAddExisting?: () => void;
  onRemove?: (opp: Opportunity) => void;
  maxItems?: number;
}

export function LinkedOpportunitiesCard({
  opportunities,
  onCreate,
  onAddExisting,
  onRemove,
  maxItems = 3,
}: LinkedOpportunitiesCardProps) {
  const primaryOpportunityId = useMemo(
    () => resolvePrimaryOpportunityId(opportunities),
    [opportunities],
  );

  return (
    <LinkedEntitiesCard<Opportunity>
      title="Oportunidades"
      icon={MoneyBagSvgIcon}
      items={opportunities}
      maxItems={maxItems}
      emptyMessage="Sin oportunidades vinculadas."
      createLabel="Crear nueva"
      onCreate={onCreate}
      onAddExisting={onAddExisting}
      onRemove={onRemove}
      getUnlinkLabel={(o) => o.title}
      getItemKey={(o) => o.id}
      getItemPath={(o) => opportunityDetailHref(o)}
      collapsible
      renderItem={(opp, itemActions) => {
        const prioritySubtitle =
          opp.priority && priorityLabels[opp.priority]
            ? priorityLabels[opp.priority]
            : opp.priority
              ? String(opp.priority)
              : null;

        const showPrincipal =
          primaryOpportunityId != null && opp.id === primaryOpportunityId;

        return (
        <div className="space-y-3">
          <LinkedEntityItemHeader
            variant="opportunity"
            overline={showPrincipal ? 'Principal' : undefined}
            title={opp.title}
            subtitle={prioritySubtitle}
            trailing={itemActions}
          />

          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <MoneyBagSvgIcon className={fieldIconClass} />
                Monto
              </div>
              <span className="text-sm font-semibold text-text-primary">{formatCurrency(opp.amount)}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <PrioritySvgIcon className={fieldIconClass} />
                Etapa
              </div>
              <span className="text-right text-sm text-text-primary">
                {etapaLabels[opp.etapa] ?? opp.etapa}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <CalendarSvgIcon className={fieldIconClass} />
                Cierre est.
              </div>
              <span className="text-sm text-text-primary">{formatDate(opp.expectedCloseDate)}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <BusinessGraphBoardSvgIcon className={fieldIconClass} />
                Probabilidad
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-stage-client"
                    style={{ width: `${Math.max(0, Math.min(100, opp.probability))}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-text-primary">
                  {Math.max(0, opp.probability)}%
                </span>
              </div>
            </div>
          </div>
        </div>
        );
      }}
    />
  );
}
