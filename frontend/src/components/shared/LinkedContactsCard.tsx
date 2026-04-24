import { useNavigate } from 'react-router-dom';
import { Users, Mail, Phone, Target } from 'lucide-react';
import { etapaLabels } from '@/data/mock';
import { LinkedEntitiesCard } from './LinkedEntitiesCard';
import { LinkedEntityItemHeader } from './LinkedEntityItemHeader';
import type { Contact } from '@/types';
import { contactDetailHref } from '@/lib/detailRoutes';
import { optionalContactCargoFromApi } from '@/lib/contactCargo';

export interface LinkedContact {
  id: string;
  urlSlug?: string;
  name: string;
  cargo?: string;
  etapa: string;
  telefono?: string;
  correo?: string;
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
      renderItem={(contact, itemActions) => {
        const cargoLine = optionalContactCargoFromApi(contact.cargo);

        return (
          <div className="space-y-3">
            <LinkedEntityItemHeader
              variant="contact"
              title={contact.name}
              subtitle={cargoLine ?? null}
              trailing={itemActions}
            />

            <div className="space-y-2.5">
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

            </div>
          </div>
        );
      }}
    />
  );
}
