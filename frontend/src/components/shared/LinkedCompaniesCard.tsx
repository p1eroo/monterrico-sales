import { useNavigate } from 'react-router-dom';
import { Building2, Globe, Star, Briefcase, Target } from 'lucide-react';
import { etapaLabels, companyRubroLabels, companyTipoLabels } from '@/data/mock';
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
      title="Empresas"
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
      collapsible
      itemClassName="bg-background/35 p-4"
      renderItem={(comp, unlinkButton) => (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {comp.isPrimary && <Star className="size-3.5 shrink-0 fill-stage-lead text-stage-lead" />}
              <p className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight text-text-primary">
                {comp.name}
              </p>
            </div>
            {unlinkButton}
          </div>

          <div className="space-y-2.5">
            {comp.domain && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Globe className="h-3.5 w-3.5 text-text-tertiary" />
                  Dominio
                </div>
                <span className="truncate text-right text-sm text-text-primary">{comp.domain}</span>
              </div>
            )}

            {comp.rubro && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Briefcase className="h-3.5 w-3.5 text-text-tertiary" />
                  Rubro
                </div>
                <span className="text-right text-sm text-text-primary">
                  {companyRubroLabels[comp.rubro] ?? comp.rubro}
                </span>
              </div>
            )}

            {comp.tipo && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Building2 className="h-3.5 w-3.5 text-text-tertiary" />
                  Tipo
                </div>
                <span className="text-sm text-text-primary">
                  {companyTipoLabels[comp.tipo] ?? comp.tipo}
                </span>
              </div>
            )}

            {etapa && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Target className="h-3.5 w-3.5 text-text-tertiary" />
                  Etapa
                </div>
                <span className="text-right text-sm text-text-primary">
                  {etapaLabels[etapa as keyof typeof etapaLabels] ?? etapa}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    />
  );
}
