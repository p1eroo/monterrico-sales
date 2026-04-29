import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Link2, Pencil, Trash2, User, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types';
import { eventTypeConfig, eventStatusConfig } from './eventTypeConfig';
import { getCalendarEventNavPaths } from '@/lib/calendarEventLinks';

interface EventDetailModalProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
}

export function EventDetailModal({ event, open, onOpenChange, onEdit, onDelete }: EventDetailModalProps) {
  const navigate = useNavigate();

  if (!event) return null;

  const config = eventTypeConfig[event.type];
  const Icon = config.icon;
  const statusConfig = eventStatusConfig[event.status];
  const links = getCalendarEventNavPaths(event);

  const go = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  const hasContactRow = Boolean(links.contactPath && links.contactName);
  const hasCompanyRow = Boolean(links.companyPath && links.companyName);
  const hasOpportunityRow = Boolean(links.opportunityPath && links.opportunityTitle);
  const recordCount =
    (hasContactRow ? 1 : 0) + (hasCompanyRow ? 1 : 0) + (hasOpportunityRow ? 1 : 0);
  const hasLinkedSection = hasContactRow || hasCompanyRow || hasOpportunityRow;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-0 max-w-[calc(100vw-2rem)] overflow-x-hidden sm:max-w-md">
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

        <div className="min-w-0 space-y-4 pt-2">
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

          {hasLinkedSection && (
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Registro vinculado</p>
              <div className="mt-2 min-w-0 space-y-2 rounded-lg border border-border/80 bg-muted/25 p-3 dark:bg-muted/15">
                <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <Link2 className="size-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    Asociado con {recordCount} registro{recordCount === 1 ? '' : 's'}
                  </span>
                </p>
                <div className="flex min-w-0 flex-col gap-2">
                  {hasContactRow ? (
                    <button
                      type="button"
                      onClick={() => go(links.contactPath!)}
                      className="flex min-w-0 w-full items-start gap-2 rounded-md border border-border/60 bg-background/80 px-2.5 py-2 text-left text-sm font-medium text-primary transition-colors hover:bg-muted/60"
                    >
                      <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 break-words">{links.contactName}</span>
                    </button>
                  ) : null}
                  {hasCompanyRow ? (
                    <button
                      type="button"
                      onClick={() => go(links.companyPath!)}
                      className="flex min-w-0 w-full items-start gap-2 rounded-md border border-border/60 bg-background/80 px-2.5 py-2 text-left text-sm font-medium text-primary transition-colors hover:bg-muted/60"
                    >
                      <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 break-words">{links.companyName}</span>
                    </button>
                  ) : null}
                  {hasOpportunityRow ? (
                    <button
                      type="button"
                      onClick={() => go(links.opportunityPath!)}
                      className="flex min-w-0 w-full items-start gap-2 rounded-md border border-border/60 bg-background/80 px-2.5 py-2 text-left text-sm font-medium text-primary transition-colors hover:bg-muted/60"
                    >
                      <Briefcase className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 break-words">{links.opportunityTitle}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {event.description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descripción</p>
              <p className="text-sm mt-1 text-muted-foreground break-words">{event.description}</p>
            </div>
          )}
        </div>

        {(onEdit || onDelete) && (
          <div className="flex justify-end gap-2 border-t pt-4">
            {onDelete && (
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => onDelete(event)}>
                <Trash2 className="size-4 mr-1.5" />
                Eliminar
              </Button>
            )}
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(event)}>
                <Pencil className="size-4 mr-1.5" />
                Editar
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
