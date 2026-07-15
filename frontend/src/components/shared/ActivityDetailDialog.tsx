import { useEffect, useState } from 'react';
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

function normType(type: string | undefined): string {
  return (type ?? '').trim().toLowerCase();
}

function formatFullDateLocal(dateStr: string): string {
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  return d.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

type ActivityDetailDialogProps = {
  activity: Activity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEditing?: boolean;
  onUpdateActivity?: (id: string, payload: UpdateActivityPayload) => Promise<Activity>;
  onDeleteActivity?: (id: string) => Promise<void>;
};

export function ActivityDetailDialog({
  activity,
  open,
  onOpenChange,
  initialEditing = false,
  onUpdateActivity,
  onDeleteActivity,
}: ActivityDetailDialogProps) {
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(activity);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState('');

  useEffect(() => {
    setCurrentActivity(activity);
    if (activity && open) {
      setEditTitle(activity.title);
      setEditDescription(activity.description);
      setEditType(normType(activity.type));
      setEditing(initialEditing);
    }
    if (!open) {
      setEditing(false);
    }
  }, [activity, open, initialEditing]);

  const startEdit = () => {
    if (!currentActivity) return;
    setEditTitle(currentActivity.title);
    setEditDescription(currentActivity.description);
    setEditType(normType(currentActivity.type));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const handleSave = async () => {
    if (!currentActivity || !onUpdateActivity) return;
    setSaving(true);
    try {
      const updated = await onUpdateActivity(currentActivity.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        type: editType,
      });
      setCurrentActivity(updated);
      setEditing(false);
      toast.success('Actividad actualizada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentActivity || !onDeleteActivity) return;
    setDeleting(true);
    try {
      await onDeleteActivity(currentActivity.id);
      onOpenChange(false);
      toast.success('Actividad eliminada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const hasEditPerms = Boolean(onUpdateActivity);
  const hasDeletePerms = Boolean(onDeleteActivity);

  if (!currentActivity) return null;

  const stType = normType(currentActivity.type) as ActivityType;
  const Icon = activityTypeIconMap[stType] ?? ClipboardList;
  const circle = activityTypeIconCircleClass(stType);
  const typeLabel = activityTypeLabelMap[stType] ?? currentActivity.type;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-card text-text-primary">
        {editing ? (
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
                <Textarea
                  id="edit-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                />
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
        ) : (
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
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-lg text-text-primary">{currentActivity.title}</DialogTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs text-text-secondary border-border">
                      {typeLabel}
                    </Badge>
                    <Badge variant="outline" className={statusColors[currentActivity.status] ?? ''}>
                      {activityStatusLabelMap[currentActivity.status] ?? currentActivity.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {currentActivity.description && (
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-text-secondary">Descripción</span>
                  <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm leading-relaxed text-text-primary">
                    {currentActivity.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/25 p-3">
                  <User className="size-4 shrink-0 text-text-tertiary" />
                  <div className="min-w-0">
                    <p className="text-xs text-text-secondary">Asignado a</p>
                    <p className="truncate text-sm font-medium text-text-primary">
                      {currentActivity.assignedToName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/25 p-3">
                  <Calendar className="size-4 shrink-0 text-text-tertiary" />
                  <div className="min-w-0">
                    <p className="text-xs text-text-secondary">Fecha de vencimiento</p>
                    <p className="truncate text-sm font-medium capitalize text-text-primary">
                      {formatFullDateLocal(currentActivity.dueDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/25 p-3">
                  <Clock className="size-4 shrink-0 text-text-tertiary" />
                  <div className="min-w-0">
                    <p className="text-xs text-text-secondary">Fecha de creación</p>
                    <p className="truncate text-sm font-medium capitalize text-text-primary">
                      {formatFullDateLocal(currentActivity.createdAt)}
                    </p>
                  </div>
                </div>
                {currentActivity.completedAt && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/25 p-3">
                    <CheckSquare className="size-4 shrink-0 text-stage-client" />
                    <div className="min-w-0">
                      <p className="text-xs text-text-secondary">Completada el</p>
                      <p className="truncate text-sm font-medium capitalize text-text-primary">
                        {formatFullDateLocal(currentActivity.completedAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {currentActivity.contactName && (
                <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/25 p-3">
                  <User className="size-4 shrink-0 text-text-tertiary" />
                  <div className="min-w-0">
                    <p className="text-xs text-text-secondary">Contacto asociado</p>
                    <p className="text-sm font-medium text-text-primary">{currentActivity.contactName}</p>
                  </div>
                </div>
              )}
            </div>

            {(hasEditPerms || hasDeletePerms) && (
              <DialogFooter className="flex-row justify-end gap-2">
                {hasDeletePerms && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-red-600 hover:text-red-700 hover:border-red-200 hover:bg-red-50"
                  >
                    {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    {deleting ? 'Eliminando...' : 'Eliminar'}
                  </Button>
                )}
                {hasEditPerms && (
                  <Button size="sm" onClick={startEdit}>
                    <Pencil className="size-4" /> Editar
                  </Button>
                )}
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
