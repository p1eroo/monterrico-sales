import { useNavigate } from 'react-router-dom';
import { Building2, Globe, DollarSign, Target } from 'lucide-react';
import { etapaLabels, companyRubroLabels, companyTipoLabels } from '@/data/mock';
import { LinkedEntitiesCard } from './LinkedEntitiesCard';
import { LinkedEntityItemHeader } from './LinkedEntityItemHeader';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
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
      renderItem={(comp, itemActions) => {
        const rubroLabel = comp.rubro
          ? (companyRubroLabels[comp.rubro] ?? comp.rubro)
          : null;
        const multiple = companies.length > 1;
        const showPrincipal = Boolean(comp.isPrimary && multiple);
        /** Rubro solo bajo el nombre (no se duplica en la lista de campos) */
        let subtitle: string | null = null;
        if (showPrincipal && rubroLabel) subtitle = `Principal · ${rubroLabel}`;
        else if (showPrincipal) subtitle = 'Principal';
        else if (rubroLabel) subtitle = rubroLabel;
        const facturacion = typeof comp.facturacionEstimada === 'number'
          && !Number.isNaN(comp.facturacionEstimada)
          ? comp.facturacionEstimada
          : null;

        return (
        <div
          className={cn(
            'space-y-3',
            showPrincipal && 'rounded-l-sm border-l-[3px] border-primary/45 pl-2.5',
          )}
        >
          <LinkedEntityItemHeader
            variant="company"
            title={comp.name}
            subtitle={subtitle}
            trailing={itemActions}
          />

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

            {facturacion != null && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <DollarSign className="h-3.5 w-3.5 text-text-tertiary" />
                  Facturación
                </div>
                <span className="text-right text-sm text-text-primary tabular-nums">
                  {formatCurrency(facturacion)}
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
        );
      }}
    />
  );
}
