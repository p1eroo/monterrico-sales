import {
  Phone,
  Mail,
  Users,
  StickyNote,
  RefreshCw,
  CheckSquare,
  Paperclip,
  Plus,
  FileText,
  UserPlus,
  Settings,
  Trash2,
  MessageCircle,
} from 'lucide-react';
import type { TimelineEvent } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  activityTypeIconCircleClass,
  ACTIVITY_ICON_INHERIT,
} from '@/lib/activityTypeCircleStyles';

const timelineIconMap: Record<TimelineEvent['type'], typeof Phone> = {
  llamada: Phone,
  correo: Mail,
  reunion: Users,
  nota: StickyNote,
  cambio_estado: RefreshCw,
  tarea: CheckSquare,
  whatsapp: MessageCircle,
  archivo: Paperclip,
  crear: Plus,
  actualizar: FileText,
  asignar: UserPlus,
  sistema: Settings,
  eliminar: Trash2,
};

/** Fondo + aro (glow suave) y color explícito del trazo del icono (Lucide usa currentColor). */
const timelineStyles: Record<
  TimelineEvent['type'],
  { wrap: string; icon: string }
> = {
  llamada: {
    wrap: 'bg-activity-call/20 ring-1 ring-inset ring-activity-call/35',
    icon: 'text-activity-call',
  },
  correo: {
    wrap: 'bg-activity-message/20 ring-1 ring-inset ring-activity-message/35',
    icon: 'text-activity-message',
  },
  reunion: {
    wrap: 'bg-stage-client/20 ring-1 ring-inset ring-stage-client/35',
    icon: 'text-stage-client',
  },
  nota: {
    wrap: 'bg-activity-note/20 ring-1 ring-inset ring-activity-note/35',
    icon: 'text-activity-note',
  },
  cambio_estado: {
    wrap: 'bg-info/18 ring-1 ring-inset ring-info/35',
    icon: 'text-info',
  },
  tarea: {
    wrap: 'bg-activity-task/20 ring-1 ring-inset ring-activity-task/35',
    icon: 'text-activity-task',
  },
  whatsapp: {
    wrap: 'bg-whatsapp/20 ring-1 ring-inset ring-whatsapp/35',
    icon: 'text-whatsapp',
  },
  archivo: {
    wrap: 'bg-muted ring-1 ring-inset ring-border/80',
    icon: 'text-muted-foreground',
  },
  crear: {
    wrap: 'bg-success/18 ring-1 ring-inset ring-success/35',
    icon: 'text-success',
  },
  actualizar: {
    wrap: 'bg-chart-3/18 ring-1 ring-inset ring-chart-3/40',
    icon: 'text-chart-3',
  },
  asignar: {
    wrap: 'bg-chart-4/18 ring-1 ring-inset ring-chart-4/40',
    icon: 'text-chart-4',
  },
  sistema: {
    wrap: 'bg-muted ring-1 ring-inset ring-border/70',
    icon: 'text-muted-foreground',
  },
  eliminar: {
    wrap: 'bg-destructive/15 ring-1 ring-inset ring-destructive/35',
    icon: 'text-destructive',
  },
};

interface TimelinePanelProps {
  events: TimelineEvent[];
}

export function TimelinePanel({ events }: TimelinePanelProps) {
  return (
    <Card className="border-0 bg-transparent pt-0 shadow-none">
      <CardContent className="p-0">
        <div className="space-y-1">
          {events.map((event) => {
            const Icon = timelineIconMap[event.type];
            const { wrap, icon } = timelineStyles[event.type];
            const tintedCircle = activityTypeIconCircleClass(event.type);
            const author = event.user?.trim() || 'Sistema';
            const detail =
              event.description?.trim() || event.title || 'Sin descripción';
            const isMutedSystem = event.type === 'sistema';
            return (
              <div
                key={event.id}
                className="group flex gap-3 rounded-md py-2.5 pl-0 pr-1 transition-colors hover:bg-surface-hover/60"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 cursor-default items-center justify-center rounded-full border-0 p-0 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        tintedCircle
                          ? cn(
                              'ring-1 ring-inset ring-black/[0.07] dark:ring-white/[0.1]',
                              ACTIVITY_ICON_INHERIT,
                              tintedCircle,
                            )
                          : wrap,
                      )}
                      aria-label={event.title}
                    >
                      <Icon
                        className={cn('h-3.5 w-3.5 shrink-0', tintedCircle ? undefined : icon)}
                        strokeWidth={2}
                        aria-hidden
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={6}>
                    {event.title}
                  </TooltipContent>
                </Tooltip>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        'truncate text-sm font-medium',
                        isMutedSystem ? 'text-text-tertiary' : 'text-text-primary',
                      )}
                    >
                      {author}
                    </span>
                    <span className="shrink-0 text-xs text-text-tertiary">{event.date}</span>
                  </div>
                  <p
                    className={cn(
                      'mt-0.5 text-sm leading-relaxed',
                      isMutedSystem
                        ? 'italic text-text-tertiary'
                        : 'text-text-secondary',
                    )}
                  >
                    {detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
