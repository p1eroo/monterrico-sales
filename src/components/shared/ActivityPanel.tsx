import {
  Phone, Mail, Users, CheckSquare, RefreshCw, MessageSquare, ClipboardList,
} from 'lucide-react';
import type { Activity, ActivityType } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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

const activityStatusLabelMap: Record<string, string> = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  vencida: 'Vencida',
  reprogramada: 'Reprogramada',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface ActivityPanelProps {
  activities: Activity[];
  onRegisterActivity?: () => void;
}

export function ActivityPanel({ activities, onRegisterActivity }: ActivityPanelProps) {
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
                const statusColors: Record<string, string> = {
                  pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
                  completada: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                  vencida: 'bg-red-100 text-red-700 border-red-200',
                  reprogramada: 'bg-blue-100 text-blue-700 border-blue-200',
                };
                const Icon = activityTypeIconMap[activity.type];
                return (
                  <TableRow key={activity.id}>
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
    </Card>
  );
}
