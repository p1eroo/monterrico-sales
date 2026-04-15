import { useState } from 'react';
import {
  Phone, Mail, Users, CheckSquare, MessageSquare, ClipboardList, StickyNote,
  Calendar, User, Clock,
} from 'lucide-react';
import type { Activity, ActivityType } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const activityTypeIconMap: Record<ActivityType, typeof Phone> = {
  nota: StickyNote,
  llamada: Phone,
  reunion: Users,
  tarea: CheckSquare,
  correo: Mail,
  whatsapp: MessageSquare,
};

const activityTypeLabelMap: Record<ActivityType, string> = {
  nota: 'Nota',
  llamada: 'Llamada',
  reunion: 'Reunión',
  tarea: 'Tarea',
  correo: 'Correo',
  whatsapp: 'WhatsApp',
};

const activityTypeColorMap: Record<ActivityType, string> = {
  nota: 'bg-activity-note/15 text-activity-note',
  llamada: 'bg-activity-call/15 text-activity-call',
  reunion: 'bg-stage-client/15 text-stage-client',
  tarea: 'bg-activity-task/15 text-activity-task',
  correo: 'bg-activity-message/15 text-activity-message',
  whatsapp: 'bg-whatsapp/15 text-whatsapp',
};

const activityStatusLabelMap: Record<string, string> = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  vencida: 'Vencida',
  en_progreso: 'En progreso',
};

const statusColors: Record<string, string> = {
  pendiente: 'border-warning/30 bg-warning/15 text-warning',
  completada: 'border-stage-client/30 bg-stage-client/15 text-stage-client',
  vencida: 'border-stage-lost/30 bg-stage-lost/15 text-stage-lost',
  en_progreso: 'border-stage-prospect/30 bg-stage-prospect/15 text-stage-prospect',
};

/** Formato de fecha para strings sin hora (ej: "2026-03-05") - evita desfase UTC */
function formatDateLocal(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

interface ActivityPanelProps {
  activities: Activity[];
  onRegisterActivity?: () => void;
}

export function ActivityPanel({ activities, onRegisterActivity }: ActivityPanelProps) {
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  return (
    <Card className="border-border/70 bg-surface-elevated pt-2 shadow-none">
      <CardContent>
        {activities.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Sin actividades"
            description="No hay actividades registradas."
            actionLabel="Registrar actividad"
            onAction={onRegisterActivity}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-text-tertiary">Tipo</TableHead>
                <TableHead className="text-text-tertiary">Título</TableHead>
                <TableHead className="text-text-tertiary">Descripción</TableHead>
                <TableHead className="text-text-tertiary">Asignado</TableHead>
                <TableHead className="text-text-tertiary">Vence</TableHead>
                <TableHead className="text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((activity) => {
                const Icon = activityTypeIconMap[activity.type] ?? ClipboardList;
                const typeColor = activityTypeColorMap[activity.type] ?? 'bg-muted text-muted-foreground';
                return (
                  <TableRow
                    key={activity.id}
                    className="cursor-pointer border-border/60 hover:bg-surface-hover"
                    onClick={() => setSelectedActivity(activity)}
                  >
                    <TableCell>
                      <div className={`flex size-8 items-center justify-center rounded-full ${typeColor}`}>
                        <Icon className="size-4" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-text-primary">{activity.title}</TableCell>
                    <TableCell className="max-w-[220px] whitespace-normal text-text-secondary">
                      <span className="line-clamp-2">{activity.description}</span>
                    </TableCell>
                    <TableCell className="text-text-secondary">{activity.assignedToName}</TableCell>
                    <TableCell className="text-text-secondary">{formatDateLocal(activity.dueDate)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={statusColors[activity.status] ?? ''}>
                        {activityStatusLabelMap[activity.status] ?? activity.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!selectedActivity} onOpenChange={(open) => { if (!open) setSelectedActivity(null); }}>
        <DialogContent className="max-w-lg border-border bg-card text-text-primary">
          {selectedActivity && (() => {
            const Icon = activityTypeIconMap[selectedActivity.type] ?? ClipboardList;
            const typeColor = activityTypeColorMap[selectedActivity.type] ?? 'bg-muted text-muted-foreground';
            const typeLabel = activityTypeLabelMap[selectedActivity.type] ?? selectedActivity.type;
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className={`flex size-10 items-center justify-center rounded-full ${typeColor}`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="text-lg text-text-primary">{selectedActivity.title}</DialogTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-xs ${typeColor}`}>
                          {typeLabel}
                        </Badge>
                        <Badge variant="outline" className={statusColors[selectedActivity.status] ?? ''}>
                          {activityStatusLabelMap[selectedActivity.status] ?? selectedActivity.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  {selectedActivity.description && (
                    <div className="space-y-1.5">
                      <span className="text-sm font-medium text-text-secondary">Descripción</span>
                      <p className="rounded-lg border border-border/60 bg-background/40 p-3 text-sm leading-relaxed text-text-primary">
                        {selectedActivity.description}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/30 p-3">
                      <User className="size-4 shrink-0 text-text-tertiary" />
                      <div className="min-w-0">
                        <p className="text-xs text-text-secondary">Asignado a</p>
                        <p className="truncate text-sm font-medium text-text-primary">{selectedActivity.assignedToName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/30 p-3">
                      <Calendar className="size-4 shrink-0 text-text-tertiary" />
                      <div className="min-w-0">
                        <p className="text-xs text-text-secondary">Fecha de vencimiento</p>
                        <p className="truncate text-sm font-medium capitalize text-text-primary">{formatFullDate(selectedActivity.dueDate)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/30 p-3">
                      <Clock className="size-4 shrink-0 text-text-tertiary" />
                      <div className="min-w-0">
                        <p className="text-xs text-text-secondary">Fecha de creación</p>
                        <p className="truncate text-sm font-medium capitalize text-text-primary">{formatFullDate(selectedActivity.createdAt)}</p>
                      </div>
                    </div>
                    {selectedActivity.completedAt && (
                      <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/30 p-3">
                        <CheckSquare className="size-4 shrink-0 text-stage-client" />
                        <div className="min-w-0">
                          <p className="text-xs text-text-secondary">Completada el</p>
                          <p className="truncate text-sm font-medium capitalize text-text-primary">{formatFullDate(selectedActivity.completedAt)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedActivity.contactName && (
                    <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/30 p-3">
                      <User className="size-4 shrink-0 text-text-tertiary" />
                      <div className="min-w-0">
                        <p className="text-xs text-text-secondary">Contacto asociado</p>
                        <p className="text-sm font-medium text-text-primary">{selectedActivity.contactName}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
