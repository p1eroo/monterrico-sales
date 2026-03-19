import { useState } from 'react';
import {
  Phone, Mail, Users, CheckSquare, RefreshCw, MessageSquare, ClipboardList,
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
  llamada: Phone,
  reunion: Users,
  tarea: CheckSquare,
  correo: Mail,
  seguimiento: RefreshCw,
  whatsapp: MessageSquare,
};

const activityTypeLabelMap: Record<ActivityType, string> = {
  llamada: 'Llamada',
  reunion: 'Reunión',
  tarea: 'Tarea',
  correo: 'Correo',
  seguimiento: 'Seguimiento',
  whatsapp: 'WhatsApp',
};

const activityTypeColorMap: Record<ActivityType, string> = {
  llamada: 'bg-blue-100 text-blue-700',
  reunion: 'bg-emerald-100 text-emerald-700',
  tarea: 'bg-violet-100 text-violet-700',
  correo: 'bg-purple-100 text-purple-700',
  seguimiento: 'bg-orange-100 text-orange-700',
  whatsapp: 'bg-green-100 text-green-700',
};

const activityStatusLabelMap: Record<string, string> = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  vencida: 'Vencida',
  en_progreso: 'En progreso',
};

const statusColors: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
  completada: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  vencida: 'bg-red-100 text-red-700 border-red-200',
  en_progreso: 'bg-blue-100 text-blue-700 border-blue-200',
};

function formatDate(dateStr: string): string {
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
    <Card className="pt-2">
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
                <TableHead className="w-10">Tipo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Asignado</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((activity) => {
                const Icon = activityTypeIconMap[activity.type];
                return (
                  <TableRow
                    key={activity.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedActivity(activity)}
                  >
                    <TableCell>
                      <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{activity.title}</TableCell>
                    <TableCell className="max-w-[220px] whitespace-normal text-muted-foreground">
                      <span className="line-clamp-2">{activity.description}</span>
                    </TableCell>
                    <TableCell>{activity.assignedToName}</TableCell>
                    <TableCell>{formatDate(activity.dueDate)}</TableCell>
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
        <DialogContent className="max-w-lg">
          {selectedActivity && (() => {
            const Icon = activityTypeIconMap[selectedActivity.type];
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className={`flex size-10 items-center justify-center rounded-full ${activityTypeColorMap[selectedActivity.type]}`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="text-lg">{selectedActivity.title}</DialogTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-xs ${activityTypeColorMap[selectedActivity.type]}`}>
                          {activityTypeLabelMap[selectedActivity.type]}
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
                      <span className="text-sm font-medium text-muted-foreground">Descripción</span>
                      <p className="text-sm leading-relaxed rounded-lg bg-muted/40 p-3">
                        {selectedActivity.description}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2.5 rounded-lg border p-3">
                      <User className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Asignado a</p>
                        <p className="text-sm font-medium truncate">{selectedActivity.assignedToName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-lg border p-3">
                      <Calendar className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Fecha de vencimiento</p>
                        <p className="text-sm font-medium truncate capitalize">{formatFullDate(selectedActivity.dueDate)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-lg border p-3">
                      <Clock className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Fecha de creación</p>
                        <p className="text-sm font-medium truncate capitalize">{formatFullDate(selectedActivity.createdAt)}</p>
                      </div>
                    </div>
                    {selectedActivity.completedAt && (
                      <div className="flex items-center gap-2.5 rounded-lg border p-3">
                        <CheckSquare className="size-4 text-emerald-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Completada el</p>
                          <p className="text-sm font-medium truncate capitalize">{formatFullDate(selectedActivity.completedAt)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedActivity.leadName && (
                    <div className="flex items-center gap-2.5 rounded-lg border p-3">
                      <User className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Contacto asociado</p>
                        <p className="text-sm font-medium">{selectedActivity.leadName}</p>
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
