import { useNavigate } from 'react-router-dom';
import { Users, Mail, Phone, Briefcase, Target, DollarSign } from 'lucide-react';
import { etapaLabels } from '@/data/mock';
import { formatCurrency } from '@/lib/formatters';
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
  title = 'Contactos',
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
      collapsible
      itemClassName="bg-background/35 p-4"
      renderItem={(contact, unlinkButton) => {
        return (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight text-text-primary">
                {contact.name}
              </p>
              {unlinkButton}
            </div>

            <div className="space-y-2.5">
              {contact.cargo && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Briefcase className="h-3.5 w-3.5 text-text-tertiary" />
                    Cargo
                  </div>
                  <span className="truncate text-right text-sm text-text-primary">{contact.cargo}</span>
                </div>
              )}

              {contact.correo && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Mail className="h-3.5 w-3.5 text-text-tertiary" />
                    Correo
                  </div>
                  <span className="truncate text-right text-sm text-text-primary">{contact.correo}</span>
                </div>
              )}

              {contact.telefono && variant === 'full' && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Phone className="h-3.5 w-3.5 text-text-tertiary" />
                    Teléfono
                  </div>
                  <span className="text-sm text-text-primary">{contact.telefono}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Target className="h-3.5 w-3.5 text-text-tertiary" />
                  Etapa
                </div>
                <span className="text-right text-sm text-text-primary">
                  {etapaLabels[contact.etapa as keyof typeof etapaLabels] ?? contact.etapa}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <DollarSign className="h-3.5 w-3.5 text-text-tertiary" />
                  Valor est.
                </div>
                <span className="text-sm font-medium text-text-primary">{formatCurrency(contact.estimatedValue)}</span>
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
