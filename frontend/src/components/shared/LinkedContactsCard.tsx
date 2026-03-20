import { useNavigate } from 'react-router-dom';
import { Users, Phone, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { etapaLabels } from '@/data/mock';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatCurrency } from '@/lib/formatters';
import { etapaColors } from '@/lib/etapaConfig';
import { getPrimaryCompany } from '@/lib/utils';
import { LinkedEntitiesCard } from './LinkedEntitiesCard';
import type { Contact } from '@/types';

export interface LinkedContact {
  id: string;
  name: string;
  cargo?: string;
  etapa: string;
  phone?: string;
  email?: string;
  estimatedValue: number;
  companies?: Contact['companies'];
}

interface LinkedContactsCardProps {
  contacts: LinkedContact[];
  title?: string;
  onCreate?: () => void;
  onAddExisting?: () => void;
  maxItems?: number;
  variant?: 'full' | 'compact';
}

export function LinkedContactsCard({
  contacts,
  title = 'Contactos vinculados',
  onCreate,
  onAddExisting,
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
      getItemKey={(c) => c.id}
      onItemClick={(c) => navigate(`/contactos/${c.id}`)}
      renderItem={(contact) => {
        const primaryCompany = getPrimaryCompany(contact as Contact);
        return (
          <>
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-[14px] font-semibold leading-tight truncate">{contact.name}</p>
              {variant === 'full' ? (
                <Badge
                  variant="outline"
                  className={`text-[11px] font-medium shrink-0 border-0 ${etapaColors[contact.etapa] ?? 'bg-gray-100 text-gray-700'}`}
                >
                  {etapaLabels[contact.etapa as keyof typeof etapaLabels] ?? contact.etapa}
                </Badge>
              ) : (
                <StatusBadge status={contact.etapa} />
              )}
            </div>
            {contact.cargo && (
              <p className="text-[13px] text-muted-foreground mb-1">
                {contact.cargo}
                {primaryCompany ? ` · ${primaryCompany.name}` : ''}
              </p>
            )}
            {variant === 'full' ? (
              <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
                {contact.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-3" />
                    {contact.phone}
                  </span>
                )}
                {contact.email && (
                  <span className="flex items-center gap-1 truncate">
                    <Mail className="size-3 shrink-0" />
                    {contact.email}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground">{formatCurrency(contact.estimatedValue)}</p>
            )}
          </>
        );
      }}
    />
  );
}
