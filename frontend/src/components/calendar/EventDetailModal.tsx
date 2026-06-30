import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, Users, FileText, Video, Building2, Link2, Pencil, Trash2, User, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types';
import { eventTypeConfig, eventStatusConfig } from './eventTypeConfig';
import { getCalendarEventNavPaths } from '@/lib/calendarEventLinks';
import { GoogleEventFloatingBar } from '@/pages/comercial/GoogleEventFloatingBar';
import type { CreateActivityPayload } from '@/lib/activityApi';

interface EventDetailModalProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
  createActivity?: (data: CreateActivityPayload) => Promise<any>;
}

export function EventDetailModal({ event, open, onOpenChange, onEdit, onDelete, createActivity }: EventDetailModalProps) {
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
      <DialogContent className="min-w-0 max-w-[calc(100vw-2rem)] overflow-x-hidden sm:max-w-[500px] max-h-[92vh]">
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
                  {event.assignedTo !== 'google' && (
                    <Badge variant="outline" className={statusConfig.color}>
                      {statusConfig.label}
                    </Badge>
                  )}
                  {event.assignedTo === 'google' && (
                    <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                      Google Calendar
                    </Badge>
                  )}
                </div>
              </div>
          </div>
        </DialogHeader>

        <div className="min-w-0 space-y-4 pt-2">
          {event.meetLink && (
            <div className="flex items-center gap-2">
              <Video className="size-5 text-amber-500" strokeWidth={1.5} />
              <a
                href={event.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-xl bg-[#13944C] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f7a3d] transition-colors"
              >
                Unirse a Google Meet
              </a>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <CalendarClock className="size-[18px]" strokeWidth={1.5} />
              Fecha y hora
            </p>
            <div className="pl-[26px]">
              <p className="text-sm mt-1">
                {(() => {
                  const [y, m, d] = event.date.split('-').map(Number);
                  return new Date(y, m - 1, d).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                })()}
              </p>
              <p className="text-sm text-muted-foreground">{event.startTime} - {event.endTime}</p>
            </div>
          </div>

          {event.assignedTo !== 'google' && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <User className="size-[18px]" strokeWidth={1.5} />
                Asignado a
              </p>
            <div className="pl-[26px]">
              <p className="text-sm mt-1">{event.assignedToName}</p>
            </div>
            </div>
          )}

          {hasLinkedSection && (
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Link2 className="size-[18px]" strokeWidth={1.5} />
                Registro vinculado
              </p>
              <div className="pl-[26px]">
                <div className="mt-2 min-w-0 space-y-2 rounded-lg border border-border/80 bg-muted/25 p-3 dark:bg-muted/15">
                <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <Link2 className="size-4 shrink-0" aria-hidden />
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
            </div>
          )}

          {event.attendees && event.attendees.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Users className="size-[18px]" strokeWidth={1.5} />
                Invitados ({event.attendees.length})
              </p>
              <div className="pl-[26px] mt-1 space-y-1">
                {event.attendees.map((a, i) => (
                  <p key={i} className="text-sm flex items-center gap-2">
                    <span className="text-muted-foreground">{a.email}</span>
                    {a.organizer && (
                      <span className="text-[10px] font-medium text-[#13944C] bg-[#13944C]/10 rounded px-1.5 py-0.5">Organizador</span>
                    )}
                  </p>
                ))}
              </div>
            </div>
          )}

          {event.description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText className="size-[18px]" strokeWidth={1.5} />
                Descripción
              </p>
              <p className="text-sm mt-1 text-muted-foreground break-words pl-[26px]">{event.description}</p>
            </div>
          )}
        </div>

        {event.assignedTo === 'google' && createActivity && (
          <GoogleEventFloatingBar event={event} createActivity={createActivity} />
        )}

        {(onEdit || onDelete) && (
          <div className="flex justify-end gap-2 pt-4">
            {onDelete && (
              <button type="button" onClick={() => onDelete(event)} className="rounded-md p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 className="size-[18px]" />
              </button>
            )}
            {onEdit && (
              <button type="button" onClick={() => onEdit(event)} className="rounded-md p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors">
                <Pencil className="size-[18px]" />
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
