import { useNavigate } from 'react-router-dom';
import { Briefcase, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { etapaLabels } from '@/data/mock';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { etapaColors } from '@/lib/etapaConfig';
import { LinkedEntitiesCard } from './LinkedEntitiesCard';
import type { Opportunity } from '@/types';

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
      onItemClick={(o) => navigate(`/opportunities/${o.id}`)}
      renderItem={(opp, unlinkButton) => (
        <>
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-[14px] font-semibold leading-tight">{opp.title}</p>
            <Badge
              variant="outline"
              className={`text-[11px] font-medium shrink-0 border-0 ${etapaColors[opp.etapa] ?? 'bg-gray-100 text-gray-700'}`}
            >
              {etapaLabels[opp.etapa]}
            </Badge>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[15px] font-bold text-emerald-600">{formatCurrency(opp.amount)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
            <div className="flex items-center gap-4 min-w-0">
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3" />
                Cierre: {formatDate(opp.expectedCloseDate)}
              </span>
            </div>
            {unlinkButton}
          </div>
        </>
      )}
    />
  );
}
