import { useNavigate } from 'react-router-dom';
import { Briefcase, CalendarDays, DollarSign, Target, TrendingUp } from 'lucide-react';
import { etapaLabels } from '@/data/mock';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { LinkedEntitiesCard } from './LinkedEntitiesCard';
import type { Opportunity } from '@/types';
import { opportunityDetailHref } from '@/lib/detailRoutes';

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
  const navigate = useNavigate();

  return (
    <LinkedEntitiesCard<Opportunity>
      title="Oportunidades"
      icon={Briefcase}
      items={opportunities}
      maxItems={maxItems}
      emptyMessage="Sin oportunidades vinculadas."
      createLabel="Crear nueva"
      onCreate={onCreate}
      onAddExisting={onAddExisting}
      onRemove={onRemove}
      getUnlinkLabel={(o) => o.title}
      getItemKey={(o) => o.id}
      onItemClick={(o) => navigate(opportunityDetailHref(o))}
      collapsible
      itemClassName="bg-background/35 p-4"
      renderItem={(opp, unlinkButton) => (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight text-text-primary">
              {opp.title}
            </p>
            {unlinkButton}
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <DollarSign className="h-3.5 w-3.5 text-text-tertiary" />
                Monto
              </div>
              <span className="text-sm font-semibold text-text-primary">{formatCurrency(opp.amount)}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Target className="h-3.5 w-3.5 text-text-tertiary" />
                Etapa
              </div>
              <span className="text-right text-sm text-text-primary">
                {etapaLabels[opp.etapa] ?? opp.etapa}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <CalendarDays className="h-3.5 w-3.5 text-text-tertiary" />
                Cierre est.
              </div>
              <span className="text-sm text-text-primary">{formatDate(opp.expectedCloseDate)}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <TrendingUp className="h-3.5 w-3.5 text-text-tertiary" />
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
      )}
    />
  );
}
