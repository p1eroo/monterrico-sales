import { useMemo, useState } from 'react';
import {
  Phone,
  Mail,
  Users,
  CheckSquare,
  MessageSquare,
  ClipboardList,
  StickyNote,
  Calendar,
  User,
  Clock,
  Pencil,
  Trash2,
  Loader2,
  X,
} from 'lucide-react';
import type { Activity, ActivityType } from '@/types';
import {
  activityTypeIconCircleClass,
  ACTIVITY_ICON_INHERIT,
} from '@/lib/activityTypeCircleStyles';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/formatters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import type { UpdateActivityPayload } from '@/lib/activityApi';

const activityTypeIconMap: Record<string, typeof Phone> = {
  nota: StickyNote,
  llamada: Phone,
  reunion: Users,
  tarea: CheckSquare,
  correo: Mail,
  whatsapp: MessageSquare,
};

const activityTypeLabelMap: Record<string, string> = {
  nota: 'Nota',
  llamada: 'Llamada',
  reunion: 'Reunión',
  tarea: 'Tarea',
  correo: 'Correo',
  whatsapp: 'WhatsApp',
};

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'nota', label: 'Nota' },
  { value: 'llamada', label: 'Llamada' },
  { value: 'reunion', label: 'Reunión' },
  { value: 'tarea', label: 'Tarea' },
  { value: 'correo', label: 'Correo' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

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

function formatFullDateLocal(dateStr: string): string {
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  return d.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

interface ActivityPanelProps {
  activities: Activity[];
  onRegisterActivity?: () => void;
  onUpdateActivity?: (id: string, payload: UpdateActivityPayload) => Promise<Activity>;
  onDeleteActivity?: (id: string) => Promise<void>;
}

export function ActivityPanel({ activities, onRegisterActivity, onUpdateActivity, onDeleteActivity }: ActivityPanelProps) {
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState('');

  const startEdit = (activity: Activity) => {
    setEditTitle(activity.title);
    setEditDescription(activity.description);
    setEditType(normType(activity.type));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const handleSave = async () => {
    if (!selectedActivity || !onUpdateActivity) return;
    setSaving(true);
    try {
      const updated = await onUpdateActivity(selectedActivity.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        type: editType,
      });
      setSelectedActivity(updated);
      setEditing(false);
      toast.success('Actividad actualizada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedActivity || !onDeleteActivity) return;
    setDeleting(true);
    try {
      await onDeleteActivity(selectedActivity.id);
      setSelectedActivity(null);
      toast.success('Actividad eliminada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const hasEditPerms = Boolean(onUpdateActivity);
  const hasDeletePerms = Boolean(onDeleteActivity);

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
            actionLabel={onRegisterActivity ? 'Registrar actividad' : undefined}
            onAction={onRegisterActivity}
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
                  <TableHead className="text-text-tertiary">Vence</TableHead>
                  <TableHead className="text-right text-text-tertiary">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((activity) => {
                  const typeKey = normType(activity.type) as ActivityType;
                  const Icon = activityTypeIconMap[typeKey] ?? ClipboardList;
                  const circle = activityTypeIconCircleClass(typeKey);
                  return (
                    <TableRow
                      key={activity.id}
                      className="cursor-pointer border-border hover:bg-muted/50"
                      onClick={() => { setSelectedActivity(activity); setEditing(false); }}
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

      <Dialog open={!!selectedActivity} onOpenChange={(open) => { if (!open) { setSelectedActivity(null); setEditing(false); } }}>
        <DialogContent className="max-w-lg border-border bg-card text-text-primary">
          {selectedActivity && (() => {
            const stType = normType(selectedActivity.type) as ActivityType;
            const Icon = activityTypeIconMap[stType] ?? ClipboardList;
            const circle = activityTypeIconCircleClass(stType);
            const typeLabel = activityTypeLabelMap[stType] ?? selectedActivity.type;

            if (editing) {
              return (
                <>
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex size-10 items-center justify-center rounded-full',
                          ACTIVITY_ICON_INHERIT,
                          circle ?? 'bg-muted text-muted-foreground [&_svg]:text-muted-foreground',
                        )}
                      >
                        <Icon className="size-5" />
                      </div>
                      <DialogTitle className="text-lg text-text-primary">Editar actividad</DialogTitle>
                    </div>
                  </DialogHeader>

                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-type">Tipo</Label>
                      <select
                        id="edit-type"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                      >
                        {TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-title">Título</Label>
                      <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-desc">Descripción</Label>
                      <Textarea id="edit-desc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4} />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                      <X className="size-4" /> Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={saving || !editTitle.trim()}>
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
                      {saving ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </DialogFooter>
                </>
              );
            }

            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex size-10 items-center justify-center rounded-full',
                        ACTIVITY_ICON_INHERIT,
                        circle ??
                          'bg-muted text-muted-foreground [&_svg]:text-muted-foreground',
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <DialogTitle className="text-lg text-text-primary">{selectedActivity.title}</DialogTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs text-text-secondary border-border">
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
                      <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm leading-relaxed text-text-primary">
                        {selectedActivity.description}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/25 p-3">
                      <User className="size-4 shrink-0 text-text-tertiary" />
                      <div className="min-w-0">
                        <p className="text-xs text-text-secondary">Asignado a</p>
                        <p className="truncate text-sm font-medium text-text-primary">{selectedActivity.assignedToName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/25 p-3">
                      <Calendar className="size-4 shrink-0 text-text-tertiary" />
                      <div className="min-w-0">
                        <p className="text-xs text-text-secondary">Fecha de vencimiento</p>
                        <p className="truncate text-sm font-medium capitalize text-text-primary">
                          {formatFullDateLocal(selectedActivity.dueDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/25 p-3">
                      <Clock className="size-4 shrink-0 text-text-tertiary" />
                      <div className="min-w-0">
                        <p className="text-xs text-text-secondary">Fecha de creación</p>
                        <p className="truncate text-sm font-medium capitalize text-text-primary">
                          {formatFullDateLocal(selectedActivity.createdAt)}
                        </p>
                      </div>
                    </div>
                    {selectedActivity.completedAt && (
                      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/25 p-3">
                        <CheckSquare className="size-4 shrink-0 text-stage-client" />
                        <div className="min-w-0">
                          <p className="text-xs text-text-secondary">Completada el</p>
                          <p className="truncate text-sm font-medium capitalize text-text-primary">
                            {formatFullDateLocal(selectedActivity.completedAt)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedActivity.contactName && (
                    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/25 p-3">
                      <User className="size-4 shrink-0 text-text-tertiary" />
                      <div className="min-w-0">
                        <p className="text-xs text-text-secondary">Contacto asociado</p>
                        <p className="text-sm font-medium text-text-primary">{selectedActivity.contactName}</p>
                      </div>
                    </div>
                  )}
                </div>

                {(hasEditPerms || hasDeletePerms) && (
                  <DialogFooter className="flex-row justify-end gap-2">
                    {hasDeletePerms && (
                      <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting} className="text-red-600 hover:text-red-700 hover:border-red-200 hover:bg-red-50">
                        {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                        {deleting ? 'Eliminando...' : 'Eliminar'}
                      </Button>
                    )}
                    {hasEditPerms && (
                      <Button size="sm" onClick={() => startEdit(selectedActivity)}>
                        <Pencil className="size-4" /> Editar
                      </Button>
                    )}
                  </DialogFooter>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
