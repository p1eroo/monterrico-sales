import { Building2 } from 'lucide-react';
import { LinkedEntitiesCard } from '@/components/shared/LinkedEntitiesCard';
import { LinkedEntityItemHeader } from '@/components/shared/LinkedEntityItemHeader';
import { clienteEmpresaDetailHref } from '@/lib/detailRoutes';

export interface LinkedClienteEmpresa {
  id: string;
  empresa: string;
  logoUrl?: string;
  isPrimary?: boolean;
}

interface LinkedClienteEmpresasCardProps {
  empresas: LinkedClienteEmpresa[];
  title?: string;
  onAddExisting?: () => void;
  onRemove?: (empresa: LinkedClienteEmpresa) => void;
  maxItems?: number;
}

export function LinkedClienteEmpresasCard({
  empresas,
  title = 'Empresas',
  onAddExisting,
  onRemove,
  maxItems = 5,
}: LinkedClienteEmpresasCardProps) {
  return (
    <LinkedEntitiesCard<LinkedClienteEmpresa>
      title={title}
      icon={Building2}
      items={empresas}
      maxItems={maxItems}
      emptyMessage="Sin empresas vinculadas."
      createLabel="Agregar existente"
      onAddExisting={onAddExisting}
      onRemove={onRemove}
      getUnlinkLabel={(e) => e.empresa}
      getItemKey={(e) => e.id}
      getItemPath={(e) => clienteEmpresaDetailHref({ empresa: e.empresa })}
      collapsible
      renderItem={(empresa, itemActions) => {
        const multiple = empresas.length > 1;
        const subtitle =
          empresa.isPrimary && multiple ? 'Principal' : null;

        return (
          <div className="space-y-3">
            <LinkedEntityItemHeader
              variant="company"
              title={empresa.empresa}
              subtitle={subtitle}
              trailing={itemActions}
            />
          </div>
        );
      }}
    />
  );
}
