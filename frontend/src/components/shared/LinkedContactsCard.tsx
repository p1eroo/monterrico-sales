import { LetterSvgIcon } from '@/components/icons/LetterSvgIcon';
import { LlamadaSvgIcon } from '@/components/icons/LlamadaSvgIcon';
import { PrioritySvgIcon } from '@/components/icons/PrioritySvgIcon';
import { UsersGroupTwoRoundedSvgIcon } from '@/components/icons/UsersGroupTwoRoundedSvgIcon';
import { etapaLabels } from '@/data/mock';
import { LinkedEntitiesCard } from './LinkedEntitiesCard';
import { LinkedEntityItemHeader } from './LinkedEntityItemHeader';
import type { Contact } from '@/types';
import { contactDetailHref } from '@/lib/detailRoutes';
import { optionalContactCargoFromApi } from '@/lib/contactCargo';

const fieldIconClass = 'h-3.5 w-3.5 shrink-0 text-text-tertiary';

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
  /** Si se define, sustituye la navegación por defecto al detalle (p. ej. contacto optimista aún guardándose). */
  onContactNavigate?: (contact: LinkedContact, event: React.MouseEvent) => void;
  maxItems?: number;
  variant?: 'full' | 'compact';
}

export function LinkedContactsCard({
  contacts,
  title = 'Contactos',
  onCreate,
  onAddExisting,
  onRemove,
  onContactNavigate,
  maxItems = 3,
  variant = 'full',
}: LinkedContactsCardProps) {
  return (
    <LinkedEntitiesCard<LinkedContact>
      title={title}
      icon={UsersGroupTwoRoundedSvgIcon}
      items={contacts}
      maxItems={maxItems}
      emptyMessage="Sin contactos vinculados."
      createLabel="Crear nuevo"
      onCreate={onCreate}
      onAddExisting={onAddExisting}
      onRemove={onRemove}
      getUnlinkLabel={(c) => c.name}
      getItemKey={(c) => c.id}
      getItemPath={onContactNavigate ? undefined : (c) => contactDetailHref(c)}
      onItemClick={onContactNavigate ? (c, e) => onContactNavigate(c, e) : undefined}
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
                    <LetterSvgIcon className={fieldIconClass} />
                    Correo
                  </div>
                  <span className="truncate text-right text-sm text-text-primary">{contact.correo}</span>
                </div>
              )}

              {contact.telefono && variant === 'full' && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <LlamadaSvgIcon className={fieldIconClass} />
                    Teléfono
                  </div>
                  <span className="text-sm text-text-primary">{contact.telefono}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <PrioritySvgIcon className={fieldIconClass} />
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
