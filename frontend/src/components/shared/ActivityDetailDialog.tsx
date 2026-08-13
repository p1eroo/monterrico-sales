import { useEffect, useState } from 'react';
import {
  ClipboardList,
  Calendar,
  User,
  Clock,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import type { Activity, ActivityType } from '@/types';
import {
  activityTypeIconCircleClass,
  ACTIVITY_ICON_INHERIT,
} from '@/lib/activityTypeCircleStyles';
import { activityTypeSvgIcon } from '@/lib/activityTypeSvgIcons';
import {
  activityToEditForm,
  buildActivityUpdatePayload,
  parseActivityDescriptionSummary,
  type ActivityEditFormState,
} from '@/lib/activityEditForm';
import {
  ActivityTypeFormFields,
  applyFieldsToEditForm,
  editFormToFields,
  type ActivityFormFieldsType,
} from '@/components/shared/ActivityTypeFormFields';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FormDialogActions,
  FormDialogShell,
} from '@/components/ui/form-dialog';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/lib/notify';
import type { UpdateActivityPayload } from '@/lib/activityApi';
import { usePermissions } from '@/hooks/usePermissions';
import { canUserReassignCommercialAdvisor } from '@/lib/advisorAssigneeDefaults';

const activityTypeColorMap: Record<string, string> = {
  nota: 'text-slate-600',
  llamada: 'text-blue-600',
  reunion: 'text-emerald-600',
  tarea: 'text-amber-600',
  correo: 'text-purple-600',
  whatsapp: 'text-green-600',
};

const activityTypeLabelMap: Record<string, string> = {
  nota: 'Nota',
  llamada: 'Llamada',
  reunion: 'Reunión',
  tarea: 'Tarea',
  correo: 'Correo',
  whatsapp: 'WhatsApp',
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

function emptyEditForm(): ActivityEditFormState {
  return {
    title: '',
    type: '',
    assignedTo: '',
    summary: '',
    date: '',
    time: '',
    duration: '',
    callResult: '',
    dateTime: '',
    meetingType: '',
    meetingResult: '',
  };
}

function normType(type: string | undefined): string {
  return (type ?? '').trim().toLowerCase();
}

function toFormFieldsType(type: string): ActivityFormFieldsType {
  const t = normType(type);
  if (t === 'llamada' || t === 'reunion' || t === 'correo' || t === 'whatsapp' || t === 'nota' || t === 'tarea') {
    return t;
  }
  return 'nota';
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
  const { hasPermission } = usePermissions();
  const canReassign = canUserReassignCommercialAdvisor(hasPermission, 'actividades');
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(activity);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState<ActivityEditFormState>(emptyEditForm);

  useEffect(() => {
    setCurrentActivity(activity);
    if (activity && open) {
      setEditForm(activityToEditForm(activity));
      setEditing(initialEditing);
    }
    if (!open) {
      setEditing(false);
      setEditForm(emptyEditForm());
    }
  }, [activity, open, initialEditing]);

  const startEdit = () => {
    if (!currentActivity) return;
    setEditForm(activityToEditForm(currentActivity));
    setEditing(true);
  };

  const cancelEdit = () => {
    if (currentActivity) setEditForm(activityToEditForm(currentActivity));
    setEditing(false);
  };

  function handleEditOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (editing) cancelEdit();
      onOpenChange(false);
    }
  }

  async function handleSave() {
    if (!currentActivity || !onUpdateActivity) return;
    if (!editForm.title.trim()) {
      toast.error('El asunto es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const updated = await onUpdateActivity(
        currentActivity.id,
        buildActivityUpdatePayload(editForm, { includeAssignedTo: canReassign }),
      );
      setCurrentActivity(updated);
      setEditForm(activityToEditForm(updated));
      setEditing(false);
      toast.success('Actividad actualizada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
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
  }

  const hasEditPerms = Boolean(onUpdateActivity);
  const hasDeletePerms = Boolean(onDeleteActivity);

  if (!currentActivity) return null;

  const stType = normType(currentActivity.type) as ActivityType;
  const editType = toFormFieldsType(editForm.type || currentActivity.type);
  const Icon = activityTypeSvgIcon(stType);
  const EditIcon = activityTypeSvgIcon(editType);
  const circle = activityTypeIconCircleClass(stType);
  const typeLabel = activityTypeLabelMap[stType] ?? currentActivity.type;
  const typeColor = activityTypeColorMap[editType] ?? 'text-muted-foreground';
  const viewSummary = parseActivityDescriptionSummary(currentActivity.description);
  const fieldForm = editFormToFields(editForm);

  if (editing) {
    return (
      <FormDialogShell
        open={open}
        onOpenChange={handleEditOpenChange}
        maxWidthClassName="sm:max-w-lg"
        title={(
          <span className="inline-flex items-center gap-2">
            <EditIcon className={`size-5 ${typeColor}`} />
            Editar {activityTypeLabelMap[editType] ?? typeLabel}
          </span>
        )}
        description="Modifica los detalles de la actividad."
        footer={(
          <FormDialogActions
            showCancel
            cancelLabel="Cancelar"
            submitLabel={saving ? 'Guardando…' : 'Guardar actividad'}
            submitting={saving}
            submitDisabled={!editForm.title.trim()}
            onCancel={cancelEdit}
            onSubmit={() => void handleSave()}
          />
        )}
      >
        <div className="space-y-6">
          <ActivityTypeFormFields
            type={editType}
            form={fieldForm}
            onChange={(key, value) => {
              setEditForm((prev) => {
                const nextFields = { ...editFormToFields(prev), [key]: value };
                return applyFieldsToEditForm(nextFields, prev);
              });
            }}
          />
          <AssignedAdvisorFormField
            htmlId="edit-activity-assignee"
            value={editForm.assignedTo}
            onChange={(v) => setEditForm((prev) => ({ ...prev, assignedTo: v }))}
            assignModule="actividades"
            disabled={false}
            fallbackName={currentActivity.assignedToName}
            label="Asignado a"
            formStyle
          />
        </div>
      </FormDialogShell>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-border bg-card text-text-primary">
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
          {viewSummary && (
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-text-secondary">Descripción</span>
              <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm leading-relaxed text-text-primary whitespace-pre-wrap">
                {viewSummary}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
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
                <Calendar className="size-4 shrink-0 text-stage-client" />
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
                onClick={() => void handleDelete()}
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
      </DialogContent>
    </Dialog>
  );
}
