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
  llamada: 'bg-blue-100 text-blue-600',
  correo: 'bg-purple-100 text-purple-600',
  reunion: 'bg-emerald-100 text-emerald-600',
  nota: 'bg-amber-100 text-amber-600',
  cambio_estado: 'bg-orange-100 text-orange-600',
  tarea: 'bg-cyan-100 text-cyan-600',
  archivo: 'bg-gray-100 text-gray-600',
};

interface TimelinePanelProps {
  events: TimelineEvent[];
}

export function TimelinePanel({ events }: TimelinePanelProps) {
  return (
    <Card className="border-0 bg-transparent shadow-none pt-0">
      <CardContent className="pt-6">
        <div className="relative">
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
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
                      <p className="font-medium">{event.title}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{event.date}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">por {event.user}</p>
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
