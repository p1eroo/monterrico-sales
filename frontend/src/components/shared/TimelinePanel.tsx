import {
  Phone, Mail, Users, StickyNote, RefreshCw, CheckSquare, Paperclip,
} from 'lucide-react';
import type { TimelineEvent } from '@/types';
import { Card, CardContent } from '@/components/ui/card';

const timelineIconMap: Record<TimelineEvent['type'], typeof Phone> = {
  llamada: Phone,
  correo: Mail,
  reunion: Users,
  nota: StickyNote,
  cambio_estado: RefreshCw,
  tarea: CheckSquare,
  archivo: Paperclip,
};

const timelineColorMap: Record<TimelineEvent['type'], string> = {
  llamada: 'bg-activity-call/15 text-activity-call',
  correo: 'bg-activity-message/15 text-activity-message',
  reunion: 'bg-stage-client/15 text-stage-client',
  nota: 'bg-activity-note/15 text-activity-note',
  cambio_estado: 'bg-activity-system/15 text-activity-system',
  tarea: 'bg-activity-task/15 text-activity-task',
  archivo: 'bg-muted text-text-secondary',
};

interface TimelinePanelProps {
  events: TimelineEvent[];
}

export function TimelinePanel({ events }: TimelinePanelProps) {
  return (
    <Card className="border-0 bg-transparent pt-0 shadow-none">
      <CardContent className="p-0">
        <div className="relative">
          <div className="absolute bottom-0 left-[19px] top-0 w-px bg-border/80" />
          <div className="space-y-6">
            {events.map((event) => {
              const Icon = timelineIconMap[event.type];
              const colorClass = timelineColorMap[event.type];
              return (
                <div key={event.id} className="relative flex gap-4 pl-0">
                  <div className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-text-primary">{event.title}</p>
                      <span className="shrink-0 text-xs text-text-tertiary">{event.date}</span>
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">{event.description}</p>
                    <p className="mt-1 text-xs text-text-tertiary">por {event.user}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
