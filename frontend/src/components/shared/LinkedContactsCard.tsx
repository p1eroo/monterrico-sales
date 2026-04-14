import { useNavigate } from 'react-router-dom';
import { Users, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { etapaLabels } from '@/data/mock';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatCurrency } from '@/lib/formatters';
import { etapaColors } from '@/lib/etapaConfig';
import { LinkedEntitiesCard } from './LinkedEntitiesCard';
import type { Contact } from '@/types';
import { contactDetailHref } from '@/lib/detailRoutes';

export interface LinkedContact {
  id: string;
  urlSlug?: string;
  name: string;
  cargo?: string;
  etapa: string;
  telefono?: string;
  correo?: string;
  estimatedValue: number;
  companies?: Contact['companies'];
}

interface LinkedContactsCardProps {
  contacts: LinkedContact[];
  title?: string;
  onCreate?: () => void;
  onAddExisting?: () => void;
  onRemove?: (contact: LinkedContact) => void;
  maxItems?: number;
  variant?: 'full' | 'compact';
}

export function LinkedContactsCard({
  contacts,
  title = 'Contactos vinculados',
  onCreate,
  onAddExisting,
  onRemove,
  maxItems = 3,
  variant = 'full',
}: LinkedContactsCardProps) {
  const navigate = useNavigate();

  return (
    <LinkedEntitiesCard<LinkedContact>
      title={title}
      icon={Users}
      items={contacts}
      maxItems={maxItems}
      emptyMessage="Sin contactos vinculados."
      createLabel="Crear nuevo"
      onCreate={onCreate}
      onAddExisting={onAddExisting}
      onRemove={onRemove}
      getUnlinkLabel={(c) => c.name}
      getItemKey={(c) => c.id}
      onItemClick={(c) => navigate(contactDetailHref(c))}
      renderItem={(contact, unlinkButton) => {
        return (
          <>
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="truncate text-[14px] font-semibold leading-tight text-text-primary">{contact.name}</p>
              {variant === 'full' ? (
                <Badge
                  variant="outline"
                  className={`shrink-0 border-0 text-[11px] font-medium ${etapaColors[contact.etapa] ?? 'bg-muted text-text-secondary'}`}
                >
                  {etapaLabels[contact.etapa as keyof typeof etapaLabels] ?? contact.etapa}
                </Badge>
              ) : (
                <StatusBadge status={contact.etapa} />
              )}
            </div>
            {contact.cargo && (
              <p className="mb-1 text-[13px] text-text-secondary">{contact.cargo}</p>
            )}
            {variant === 'full' ? (
              <div className="flex items-center justify-between gap-2 text-[12px] text-text-secondary">
                <div className="flex items-center gap-4 min-w-0">
                  {contact.correo && (
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="size-3 shrink-0 text-text-tertiary" />
                      {contact.correo}
                    </span>
                  )}
                </div>
                {unlinkButton}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] text-text-secondary">{formatCurrency(contact.estimatedValue)}</p>
                {unlinkButton}
              </div>
            )}
          </>
        );
      }}
    />
  );
}
