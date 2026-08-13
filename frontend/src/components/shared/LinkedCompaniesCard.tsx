import { Buildings2SvgIcon } from '@/components/icons/Buildings2SvgIcon';
import { MapArrowSquareSvgIcon } from '@/components/icons/MapArrowSquareSvgIcon';
import { MoneyBagSvgIcon } from '@/components/icons/MoneyBagSvgIcon';
import { PrioritySvgIcon } from '@/components/icons/PrioritySvgIcon';
import { etapaLabels, companyTipoLabels } from '@/data/mock';
import { getRubroLabelFromCatalog, useCrmConfigStore } from '@/store/crmConfigStore';
import { LinkedEntitiesCard } from './LinkedEntitiesCard';
import { LinkedEntityItemHeader } from './LinkedEntityItemHeader';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import type { LinkedCompany } from '@/types';
import { companyDetailHref } from '@/lib/detailRoutes';

const fieldIconClass = 'h-3.5 w-3.5 shrink-0 text-text-tertiary';

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
  const bundle = useCrmConfigStore((s) => s.bundle);
  return (
    <LinkedEntitiesCard<LinkedCompany>
      title="Empresas"
      icon={Buildings2SvgIcon}
      items={companies}
      maxItems={maxItems}
      emptyMessage="Sin empresas vinculadas."
      createLabel="Crear nueva"
      onCreate={onCreate}
      onAddExisting={onAddExisting}
      onRemove={onRemove}
      getUnlinkLabel={(c) => c.name}
      getItemKey={(c, idx) => c.id ?? `${c.name}-${idx ?? 0}`}
      getItemPath={(c) =>
        companyDetailHref({
          id: c.id ?? '',
          urlSlug: c.urlSlug,
          name: c.name,
        })}
      collapsible
      renderItem={(comp, itemActions) => {
        const rubroLabel = comp.rubro
          ? getRubroLabelFromCatalog(comp.rubro, bundle)
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
                  <MapArrowSquareSvgIcon className={fieldIconClass} />
                  Dominio
                </div>
                <span className="truncate text-right text-sm text-text-primary">{comp.domain}</span>
              </div>
            )}

            {comp.tipo && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Buildings2SvgIcon className={fieldIconClass} />
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
                  <MoneyBagSvgIcon className={fieldIconClass} />
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
                  <PrioritySvgIcon className={fieldIconClass} />
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
