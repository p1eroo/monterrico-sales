import { useNavigate } from 'react-router-dom';
import { Building2, Globe, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { etapaLabels } from '@/data/mock';
import { etapaColors } from '@/lib/etapaConfig';
import { LinkedEntitiesCard } from './LinkedEntitiesCard';
import type { LinkedCompany } from '@/types';
import { companyDetailHref } from '@/lib/detailRoutes';

interface LinkedCompaniesCardProps {
  companies: LinkedCompany[];
  onCreate?: () => void;
  onAddExisting?: () => void;
  onRemove?: (company: LinkedCompany) => void;
  /** Etapa a mostrar (key, ej. "reunion_agendada") desde el contacto/oportunidad padre */
  etapa?: string;
  maxItems?: number;
}

export function LinkedCompaniesCard({
  companies,
  onCreate,
  onAddExisting,
  onRemove,
  etapa,
  maxItems = 3,
}: LinkedCompaniesCardProps) {
  const navigate = useNavigate();

  return (
    <LinkedEntitiesCard<LinkedCompany>
      title="Empresas vinculadas"
      icon={Building2}
      items={companies}
      maxItems={maxItems}
      emptyMessage="Sin empresas vinculadas."
      createLabel="Crear nueva"
      onCreate={onCreate}
      onAddExisting={onAddExisting}
      onRemove={onRemove}
      getUnlinkLabel={(c) => c.name}
      getItemKey={(c, idx) => c.id ?? `${c.name}-${idx ?? 0}`}
      onItemClick={(c) =>
        navigate(
          c.id ? companyDetailHref({ id: c.id, urlSlug: c.urlSlug }) : `/empresas/${encodeURIComponent(c.name)}`,
        )}
      renderItem={(comp, unlinkButton) => (
        <>
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {comp.isPrimary && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" />}
              <p className="text-[14px] font-semibold leading-tight truncate">{comp.name}</p>
            </div>
            {etapa && (
              <Badge
                variant="outline"
                className={`text-[11px] font-medium shrink-0 border-0 ${etapaColors[etapa as keyof typeof etapaColors] ?? 'bg-gray-100 text-gray-700'}`}
              >
                {etapaLabels[etapa as keyof typeof etapaLabels] ?? etapa}
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
            <div className="flex items-center gap-4 min-w-0">
              {comp.domain && (
                <span className="flex items-center gap-1">
                  <Globe className="size-3" />
                  {comp.domain}
                </span>
              )}
            </div>
            {unlinkButton}
          </div>
        </>
      )}
    />
  );
}
