import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types';
import { eventTypeConfig, eventStatusConfig } from './eventTypeConfig';

interface EventDetailModalProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (event: CalendarEvent) => void;
}

function getEntityLink(event: CalendarEvent): string | null {
  if (!event.relatedEntityType || !event.relatedEntityId) return null;
  switch (event.relatedEntityType) {
    case 'contact':
      return `/contactos/${event.relatedEntityId}`;
    case 'company':
      return `/empresas/${encodeURIComponent(event.relatedEntityName ?? event.relatedEntityId)}`;
    case 'opportunity':
      return `/opportunities/${event.relatedEntityId}`;
    default:
      return null;
  }
}

export function EventDetailModal({ event, open, onOpenChange, onEdit }: EventDetailModalProps) {
  const navigate = useNavigate();

  if (!event) return null;

  const config = eventTypeConfig[event.type];
  const Icon = config.icon;
  const statusConfig = eventStatusConfig[event.status];
  const link = getEntityLink(event);

  const handleEntityClick = () => {
    if (link) {
      navigate(link);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl', config.bgColor, config.color)}>
              <Icon className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg">{event.title}</DialogTitle>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline" className={config.color}>
                  {config.label}
                </Badge>
                <Badge variant="outline" className={statusConfig.color}>
                  {statusConfig.label}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha y hora</p>
            <p className="text-sm mt-1">
              {new Date(event.date).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="text-sm text-muted-foreground">{event.startTime} - {event.endTime}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Asignado a</p>
            <p className="text-sm mt-1">{event.assignedToName}</p>
          </div>

          {event.relatedEntityName && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Registro vinculado</p>
              <Button
                variant="link"
                className="h-auto p-0 mt-1 text-[#13944C] font-medium"
                onClick={handleEntityClick}
              >
                {event.relatedEntityType === 'contact' && '👤 Contacto: '}
                {event.relatedEntityType === 'company' && '🏢 Empresa: '}
                {event.relatedEntityType === 'opportunity' && '💼 Oportunidad: '}
                {event.relatedEntityName}
              </Button>
            </div>
          )}

          {event.description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descripción</p>
              <p className="text-sm mt-1 text-muted-foreground">{event.description}</p>
            </div>
          )}
        </div>

        {onEdit && (
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" size="sm" onClick={() => onEdit(event)}>
              <Pencil className="size-4 mr-1.5" />
              Editar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
