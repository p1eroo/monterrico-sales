import { useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import type { Activity, ActivityType } from '@/types';
import {
  activityTypeIconCircleClass,
  ACTIVITY_ICON_INHERIT,
} from '@/lib/activityTypeCircleStyles';
import { activityTypeSvgIcon } from '@/lib/activityTypeSvgIcons';
import { ActivityDetailDialog } from '@/components/shared/ActivityDetailDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { UpdateActivityPayload } from '@/lib/activityApi';

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

type ActivityFilter =
  | 'all'
  | 'mensajes'
  | 'nota'
  | 'llamada'
  | 'tarea'
  | 'reunion';

const FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'mensajes', label: 'Mensajes' },
  { key: 'nota', label: 'Notas' },
  { key: 'llamada', label: 'Llamadas' },
  { key: 'tarea', label: 'Tareas' },
  { key: 'reunion', label: 'Reuniones' },
];

function normType(type: string | undefined): string {
  return (type ?? '').trim().toLowerCase();
}

interface ActivityPanelProps {
  activities: Activity[];
  onRegisterActivity?: () => void;
  onUpdateActivity?: (id: string, payload: UpdateActivityPayload) => Promise<Activity>;
  onDeleteActivity?: (id: string) => Promise<void>;
}

export function ActivityPanel({
  activities,
  onUpdateActivity,
  onDeleteActivity,
}: ActivityPanelProps) {
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all');

  const sorted = useMemo(
    () =>
      [...activities].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [activities],
  );

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return sorted;
    return sorted.filter((a) => {
      const t = normType(a.type);
      if (activeFilter === 'mensajes') return t === 'correo' || t === 'whatsapp';
      return t === activeFilter;
    });
  }, [sorted, activeFilter]);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-none">
      <div className="shrink-0 border-b border-border px-4 py-2">
        <div className="md:hidden space-y-1.5">
          <label htmlFor="activity-panel-filter" className="text-xs font-medium text-muted-foreground">
            Filtrar por tipo
          </label>
          <select
            id="activity-panel-filter"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as ActivityFilter)}
          >
            {FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="hidden min-w-0 items-center gap-1 overflow-x-auto md:flex md:scrollbar-thin">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                activeFilter === f.key
                  ? 'bg-primary/15 text-primary'
                  : 'text-text-secondary hover:bg-muted/60 hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[min(420px,55vh)] min-h-[120px] flex-1 overflow-y-auto p-4 scrollbar-thin">
        {filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Sin actividades"
            description="No hay actividades que coincidan con el filtro."
          />
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-text-tertiary">Tipo</TableHead>
                  <TableHead className="text-text-tertiary">Título</TableHead>
                  <TableHead className="text-text-tertiary">Descripción</TableHead>
                  <TableHead className="text-text-tertiary">Asignado</TableHead>
                  <TableHead className="text-text-tertiary">Fecha</TableHead>
                  <TableHead className="text-right text-text-tertiary">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((activity) => {
                  const typeKey = normType(activity.type) as ActivityType;
                  const Icon = activityTypeSvgIcon(typeKey);
                  const circle = activityTypeIconCircleClass(typeKey);
                  return (
                    <TableRow
                      key={activity.id}
                      className="cursor-pointer border-border hover:bg-muted/50"
                      onClick={() => setSelectedActivity(activity)}
                    >
                      <TableCell>
                        <div
                          className={cn(
                            'flex size-8 items-center justify-center rounded-full',
                            ACTIVITY_ICON_INHERIT,
                            circle ??
                              'bg-muted text-muted-foreground [&_svg]:text-muted-foreground',
                          )}
                        >
                          <Icon className="size-4" />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-text-primary">{activity.title}</TableCell>
                      <TableCell className="max-w-[220px] whitespace-normal text-text-secondary">
                        <span className="line-clamp-2">{activity.description}</span>
                      </TableCell>
                      <TableCell className="text-text-secondary">{activity.assignedToName}</TableCell>
                      <TableCell className="text-text-secondary">{formatDate(activity.dueDate)}</TableCell>
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
          </div>
        )}
      </div>

      <ActivityDetailDialog
        activity={selectedActivity}
        open={!!selectedActivity}
        onOpenChange={(open) => {
          if (!open) setSelectedActivity(null);
        }}
        onUpdateActivity={onUpdateActivity}
        onDeleteActivity={onDeleteActivity}
      />
    </div>
  );
}
