import { useMemo, useState, useEffect, type ComponentType, type ReactNode } from 'react';
import {
  User,
  Building2,
  Briefcase,
  CalendarDays,
  Clock,
  Edit,
  Trash2,
  Send,
  MessageCircle,
  Search,
  Link2,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { toast } from '@/lib/notify';
import { priorityLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import type { Contact, Opportunity, TaskAssociation, TaskKind } from '@/types';
import { TASK_KINDS } from '@/types';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FormDialogActions,
  FormDialogField,
  FormDialogGrid,
  FormDialogShell,
  formDialogBtnOutlineClass,
  formDialogBtnPrimaryClass,
  formDialogInputClass,
  formDialogPickerTriggerClass,
  formDialogPopoverContentClass,
  formDialogScrollListClass,
  formDialogSelectTriggerClass,
  formDialogTextareaClass,
} from '@/components/ui/form-dialog';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import { LlamadaSvgIcon } from '@/components/icons/LlamadaSvgIcon';
import { ReunionSvgIcon } from '@/components/icons/ReunionSvgIcon';
import { CorreoSvgIcon } from '@/components/icons/CorreoSvgIcon';
import { WhatsAppSvgIcon } from '@/components/icons/WhatsAppSvgIcon';
import { formatDate, formatDateTime } from '@/lib/formatters';
import {
  isTaskAssociationMatchingContact,
  isTaskAssociationMatchingEmpresa,
  isTaskAssociationMatchingNegocio,
} from '@/lib/taskAssociationsFromActivity';
import { isLikelyCompanyCuid } from '@/lib/companyApi';
import { contactListPaginated, mapApiContactRowToContact } from '@/lib/contactApi';
import { opportunityListPaginated, mapApiOpportunityToOpportunity } from '@/lib/opportunityApi';
import {
  buildTaskDetailUpdatePayload,
  normalizeTaskAssociations,
  toggleTaskAssociation,
} from '@/lib/taskActivityUpdate';
import {
  TASK_ASSOCIATION_PICKER_TABS,
  TASK_LINKED_ENTITY_FETCH_LIMIT,
  paginateAssociationPickerItems,
  pickContactsForAssociationPicker,
  pickOpportunitiesForAssociationPicker,
  pickCompaniesForAssociationPicker,
  resolveSelectedCompanyId,
  selectedCompanyNameFromAssociations,
} from '@/lib/taskAssociationPicker';
import {
  ACTIVITY_ICON_INHERIT,
  activityTypeIconCircleClass,
} from '@/lib/activityTypeCircleStyles';
import { cn } from '@/lib/utils';
import { useTaskAssociationPickerPagination } from '@/hooks/useTaskAssociationPickerPagination';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TaskAssociationPickerLoadMore } from '@/components/shared/TaskAssociationPickerLoadMore';

export type TaskDetailStatus = string;
export type TaskDetailType = TaskKind;
export type TaskDetailPriority = 'alta' | 'media' | 'baja';

export interface TaskDetailTask {
  id: string;
  title: string;
  status: TaskDetailStatus;
  type?: TaskDetailType;
  priority?: TaskDetailPriority;
  company?: string;
  startDate?: string;
  dueDate: string;
  startTime?: string;
  assignee: string;
  assigneeId?: string;
  associations?: TaskAssociation[];
  description?: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  author: string;
  text: string;
  date: string;
}

const taskTypeLabels: Record<TaskDetailType, string> = {
  llamada: 'Llamada',
  reunion: 'Reunión',
  correo: 'Correo',
  whatsapp: 'WhatsApp',
};

const priorityBadgeClass: Record<TaskDetailPriority, string> = {
  alta: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  media: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
  baja: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const taskTypeIcons: Record<TaskDetailType, ComponentType<{ className?: string }>> = {
  llamada: LlamadaSvgIcon,
  reunion: ReunionSvgIcon,
  correo: CorreoSvgIcon,
  whatsapp: WhatsAppSvgIcon,
};

const formLabelClass = 'font-medium';

const detailReadonlyClass =
  'flex min-h-11 items-center gap-2 rounded-lg border border-slate-300/80 bg-muted/15 px-3 text-sm text-foreground';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = [
    'bg-emerald-100 text-emerald-700',
    'bg-blue-100 text-blue-700',
    'bg-amber-100 text-amber-700',
    'bg-violet-100 text-violet-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
}

function TaskDetailTitleIcon({ type }: { type?: TaskDetailType }) {
  const kind = type && TASK_KINDS.includes(type) ? type : 'llamada';
  const Icon = taskTypeIcons[kind];
  const circle = activityTypeIconCircleClass(kind);

  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-full',
        ACTIVITY_ICON_INHERIT,
        circle ?? 'bg-muted text-muted-foreground',
      )}
    >
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

function DetailReadonlyField({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <FormDialogField label={label} labelClassName={formLabelClass}>
      <div className={cn(detailReadonlyClass, className)}>{children}</div>
    </FormDialogField>
  );
}

export interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskDetailTask | null;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  tasks: TaskDetailTask[];
  onTasksChange: (tasks: TaskDetailTask[]) => void | Promise<void>;
  taskComments: TaskComment[];
  onTaskCommentsChange: (comments: TaskComment[]) => void;
  contacts?: Contact[];
  companies?: { name: string; id?: string }[];
  opportunities?: Opportunity[];
  onCompleteWithActivity?: (task: TaskDetailTask) => void;
}

export function TaskDetailDialog({
  open,
  onOpenChange,
  task,
  statusLabels,
  statusColors,
  tasks,
  onTasksChange,
  taskComments,
  onTaskCommentsChange,
  contacts = [],
  companies = [],
  opportunities = [],
  onCompleteWithActivity,
}: TaskDetailDialogProps) {
  const { users, activeAdvisors } = useUsers();

  const [taskEditMode, setTaskEditMode] = useState(false);
  const [taskEditForm, setTaskEditForm] = useState<TaskDetailTask | null>(null);
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [commentsVisible, setCommentsVisible] = useState(true);
  const [editAssociations, setEditAssociations] = useState<TaskAssociation[]>([]);
  const [editAssocPanelOpen, setEditAssocPanelOpen] = useState(false);
  const [editAssocSearch, setEditAssocSearch] = useState('');
  const [editAssocCategory, setEditAssocCategory] = useState<'contactos' | 'empresas' | 'negocios'>('contactos');
  const [editLinkedContacts, setEditLinkedContacts] = useState<Contact[]>([]);
  const [editLinkedOpportunities, setEditLinkedOpportunities] = useState<Opportunity[]>([]);
  const [editLinkedLoading, setEditLinkedLoading] = useState(false);
  const [deleteTaskConfirmOpen, setDeleteTaskConfirmOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const editSelectedCompanyId = useMemo(
    () => resolveSelectedCompanyId(editAssociations),
    [editAssociations],
  );

  const editSelectedCompanyName = useMemo(
    () => selectedCompanyNameFromAssociations(editAssociations, editSelectedCompanyId),
    [editAssociations, editSelectedCompanyId],
  );

  useEffect(() => {
    if (!taskEditMode || !editSelectedCompanyId) {
      setEditLinkedContacts([]);
      setEditLinkedOpportunities([]);
      setEditLinkedLoading(false);
      return;
    }

    let cancelled = false;
    setEditLinkedLoading(true);

    Promise.all([
      contactListPaginated({
        linkedToCompanyId: editSelectedCompanyId,
        limit: TASK_LINKED_ENTITY_FETCH_LIMIT,
        page: 1,
      }),
      opportunityListPaginated({
        linkedToCompanyId: editSelectedCompanyId,
        limit: TASK_LINKED_ENTITY_FETCH_LIMIT,
        page: 1,
      }),
    ])
      .then(([contactRes, oppRes]) => {
        if (cancelled) return;
        setEditLinkedContacts(contactRes.data.map(mapApiContactRowToContact));
        setEditLinkedOpportunities(oppRes.data.map(mapApiOpportunityToOpportunity));
      })
      .catch(() => {
        if (cancelled) return;
        setEditLinkedContacts([]);
        setEditLinkedOpportunities([]);
        toast.error('No se pudieron cargar contactos u oportunidades vinculados');
      })
      .finally(() => {
        if (!cancelled) setEditLinkedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [taskEditMode, editSelectedCompanyId]);

  const editHasEmpresa = editAssociations.some((a) => a.type === 'empresa');

  const editPickerCompanies = useMemo(
    () =>
      pickCompaniesForAssociationPicker(editAssociations, companies, {
        onlySelectedCompany: editHasEmpresa,
      }),
    [editAssociations, companies, editHasEmpresa],
  );

  const editPickerContacts = useMemo(
    () =>
      pickContactsForAssociationPicker(
        editAssociations,
        contacts,
        editLinkedContacts,
        editSelectedCompanyId,
      ),
    [editSelectedCompanyId, editLinkedContacts, editAssociations, contacts],
  );

  const editPickerOpportunities = useMemo(
    () =>
      pickOpportunitiesForAssociationPicker(
        editAssociations,
        opportunities,
        editLinkedOpportunities,
        editSelectedCompanyId,
      ),
    [editSelectedCompanyId, editLinkedOpportunities, editAssociations, opportunities],
  );

  const editUsesLinkedFetch = Boolean(editSelectedCompanyId);

  const filteredEditPickerContacts = useMemo(
    () =>
      editPickerContacts.filter((l) =>
        l.name.toLowerCase().includes(editAssocSearch.toLowerCase()),
      ),
    [editPickerContacts, editAssocSearch],
  );

  const filteredEditPickerOpportunities = useMemo(
    () =>
      editPickerOpportunities.filter((o) =>
        o.title.toLowerCase().includes(editAssocSearch.toLowerCase()),
      ),
    [editPickerOpportunities, editAssocSearch],
  );

  const filteredEditPickerCompanies = useMemo(
    () =>
      editPickerCompanies.filter((c) =>
        c.name.toLowerCase().includes(editAssocSearch.toLowerCase()),
      ),
    [editPickerCompanies, editAssocSearch],
  );

  const { visibleCount: editAssocVisibleCount, showMore: showMoreEditAssocItems } =
    useTaskAssociationPickerPagination(`${editAssocCategory}:${editAssocSearch}`);

  const activeEditAssocFilteredTotal =
    editAssocCategory === 'contactos'
      ? filteredEditPickerContacts.length
      : editAssocCategory === 'empresas'
        ? filteredEditPickerCompanies.length
        : filteredEditPickerOpportunities.length;

  const assocCounts = {
    contactos: editPickerContacts.length,
    empresas: editPickerCompanies.length,
    negocios: editPickerOpportunities.length,
  };

  function handleClose() {
    onOpenChange(false);
    setTaskEditMode(false);
    setTaskEditForm(null);
    setEditAssigneeId('');
    setNewCommentText('');
    setEditAssocPanelOpen(false);
    setEditAssocSearch('');
    setDeleteTaskConfirmOpen(false);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) handleClose();
  }

  function startEdit() {
    if (!task) return;
    setTaskEditMode(true);
    setTaskEditForm({ ...task });
    setEditAssociations([...(task.associations ?? [])]);
    const hasCompany = (task.associations ?? []).some(
      (a) => a.type === 'empresa' && a.id && isLikelyCompanyCuid(a.id),
    );
    setEditAssocCategory(hasCompany ? 'contactos' : 'empresas');
    const assigneeId =
      users.find((u) => u.name === task.assignee)?.id ??
      activeAdvisors.find((u) => u.name === task.assignee)?.id ??
      '';
    setEditAssigneeId(assigneeId);
  }

  function cancelEdit() {
    setTaskEditMode(false);
    setTaskEditForm(null);
    setEditAssigneeId('');
    setEditAssocPanelOpen(false);
    setEditAssocSearch('');
  }

  function handleStatusChange(newStatus: string) {
    if (!task) return;
    if (
      newStatus === 'completada' &&
      onCompleteWithActivity &&
      task.type &&
      TASK_KINDS.includes(task.type)
    ) {
      handleClose();
      onCompleteWithActivity(task);
      return;
    }
    const updated = { ...task, status: newStatus };
    onTasksChange(tasks.map((t) => (t.id === task.id ? updated : t)));
  }

  function confirmTaskDelete() {
    if (!task) return;
    onTasksChange(tasks.filter((t) => t.id !== task.id));
    handleClose();
    toast.success('Tarea eliminada');
  }

  async function saveEdit() {
    if (!taskEditForm) return;
    if (!taskEditForm.title.trim()) {
      toast.error('El título es requerido');
      return;
    }
    if (!taskEditForm.type) {
      toast.error('Selecciona un tipo de tarea');
      return;
    }
    if (editAssociations.length === 0) {
      toast.error('Debes vincular la tarea a al menos un contacto, empresa u oportunidad');
      return;
    }
    const assigneeUser = users.find((u) => u.id === editAssigneeId);
    const normalizedAssociations = normalizeTaskAssociations(editAssociations);
    const companyFromAssoc = normalizedAssociations.find((a) => a.type === 'empresa')?.name;
    const updated: TaskDetailTask = {
      ...taskEditForm,
      assignee: assigneeUser?.name ?? taskEditForm.assignee,
      assigneeId: editAssigneeId || undefined,
      associations: normalizedAssociations,
      company: companyFromAssoc ?? taskEditForm.company,
    };
    setEditSaving(true);
    try {
      await onTasksChange(tasks.map((t) => (t.id === taskEditForm.id ? updated : t)));
      cancelEdit();
      toast.success('Tarea actualizada');
    } catch {
      /* el padre muestra toast de error */
    } finally {
      setEditSaving(false);
    }
  }

  function addComment() {
    if (!task || !newCommentText.trim()) return;
    const comment: TaskComment = {
      id: `tc-${Date.now()}`,
      taskId: task.id,
      author: task.assignee,
      text: newCommentText.trim(),
      date: new Date().toISOString(),
    };
    onTaskCommentsChange([...taskComments, comment]);
    setNewCommentText('');
    toast.success('Comentario agregado');
  }

  const statusKeys = Object.keys(statusLabels);
  const taskEditStatusKeys = statusKeys.filter((key) => key !== 'vencida');
  const taskCommentsForTask = task
    ? taskComments.filter((c) => c.taskId === task.id)
    : [];

  const shellTitle = taskEditMode
    ? 'Editar tarea'
    : task
      ? (
          <span className="flex items-start gap-3">
            <TaskDetailTitleIcon type={task.type} />
            <span className={cn('pt-1.5', task.status === 'completada' && 'line-through text-muted-foreground')}>
              {task.title}
            </span>
          </span>
        )
      : '';

  const shellDescription = !taskEditMode && task ? (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {statusLabels[task.status] && (
        <Badge
          variant="outline"
          className={cn('rounded-md border-0 font-normal', statusColors[task.status] ?? 'bg-slate-100 text-slate-700')}
        >
          {statusLabels[task.status]}
        </Badge>
      )}
      {task.priority && priorityLabels[task.priority] && (
        <Badge className={cn('rounded-md border-0 font-normal', priorityBadgeClass[task.priority])}>
          {priorityLabels[task.priority]}
        </Badge>
      )}
    </div>
  ) : taskEditMode
    ? 'Modifica los campos que necesites actualizar.'
    : undefined;

  const shellFooter = taskEditMode ? (
    <FormDialogActions
      onCancel={cancelEdit}
      submitLabel={editSaving ? 'Guardando…' : 'Guardar cambios'}
      onSubmit={() => void saveEdit()}
      submitting={editSaving}
    />
  ) : task ? (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Button
        type="button"
        variant="outline"
        className={cn(formDialogBtnOutlineClass, 'text-destructive hover:text-destructive')}
        onClick={() => setDeleteTaskConfirmOpen(true)}
      >
        <Trash2 className="size-4" />
        Eliminar
      </Button>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" className={formDialogBtnOutlineClass} onClick={startEdit}>
          <Edit className="size-4" />
          Editar
        </Button>
        <Button type="button" variant="outline" className={formDialogBtnOutlineClass} onClick={handleClose}>
          Cerrar
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <FormDialogShell
        open={open && !!task}
        onOpenChange={handleOpenChange}
        maxWidthClassName="sm:max-w-2xl"
        titleClassName="font-medium"
        title={shellTitle}
        description={shellDescription}
        footer={shellFooter}
        bodyClassName="mt-5"
      >
        {task && !taskEditMode && (
          <div className="space-y-5">
            <FormDialogGrid className="gap-y-4">
              <DetailReadonlyField label="Responsable">
                <User className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{task.assignee}</span>
              </DetailReadonlyField>
              <DetailReadonlyField label="Fecha límite">
                <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{formatDate(task.dueDate)}</span>
              </DetailReadonlyField>
              {task.startTime ? (
                <DetailReadonlyField label="Hora">
                  <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{task.startTime}</span>
                </DetailReadonlyField>
              ) : null}
              {task.startDate ? (
                <DetailReadonlyField label="Fecha de inicio">
                  <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{formatDate(task.startDate)}</span>
                </DetailReadonlyField>
              ) : null}
            </FormDialogGrid>

            {(task.associations ?? []).length > 0 && (
              <FormDialogField
                label={(
                  <span className="inline-flex items-center gap-1.5">
                    <Link2 className="size-3.5 text-muted-foreground" />
                    Asociado con {task.associations!.length} registro{task.associations!.length !== 1 ? 's' : ''}
                  </span>
                )}
                labelClassName={formLabelClass}
                compactControl={false}
              >
                <div className="flex flex-wrap gap-2">
                  {task.associations!.map((a) => (
                    <Badge
                      key={`${a.type}-${a.id}`}
                      variant="secondary"
                      className="gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 font-normal"
                    >
                      {a.type === 'contacto' && <User className="size-3" />}
                      {a.type === 'empresa' && <Building2 className="size-3" />}
                      {a.type === 'negocio' && <Briefcase className="size-3" />}
                      <span className="text-xs">{a.name}</span>
                    </Badge>
                  ))}
                </div>
              </FormDialogField>
            )}

            {task.status === 'completada' && task.description && (
              <FormDialogField label="Resumen" labelClassName={formLabelClass} compactControl={false}>
                <div className="rounded-lg border border-slate-300/80 bg-muted/15 px-3 py-2.5 text-sm whitespace-pre-wrap">
                  {task.description}
                </div>
              </FormDialogField>
            )}

            <div className="space-y-3 border-t border-border/60 pt-5">
              <h4 className="text-sm font-medium text-foreground/90">Cambiar estado</h4>
              <div className="flex flex-wrap gap-2">
                {statusKeys.map((key) => (
                  <Button
                    key={key}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-9 rounded-lg font-normal shadow-none',
                      task.status === key
                        ? cn('border-transparent', statusColors[key] ?? 'bg-primary text-primary-foreground')
                        : formDialogBtnOutlineClass,
                    )}
                    onClick={() => handleStatusChange(key)}
                  >
                    {statusLabels[key]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3 border-t border-border/60 pt-5">
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm font-medium text-[#13944C] hover:underline"
                onClick={() => setCommentsVisible(!commentsVisible)}
              >
                <MessageCircle className="size-4" />
                {commentsVisible ? 'Ocultar comentarios' : 'Mostrar comentarios'}
                <span className="font-normal text-muted-foreground">({taskCommentsForTask.length})</span>
              </button>

              {commentsVisible && (
                <div className="space-y-4">
                  {taskCommentsForTask
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((comment) => (
                      <div key={comment.id} className="group flex gap-3">
                        <div
                          className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                            getAvatarColor(comment.author),
                          )}
                        >
                          {getInitials(comment.author)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{comment.author}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(comment.date)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  onTaskCommentsChange(taskComments.filter((c) => c.id !== comment.id));
                                  toast.success('Comentario eliminado');
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">{comment.text}</p>
                        </div>
                      </div>
                    ))}

                  {taskCommentsForTask.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sin comentarios aún.</p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Textarea
                      placeholder="Escribe un comentario..."
                      rows={2}
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      className={cn(formDialogTextareaClass, 'min-h-[4.5rem] resize-none')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          addComment();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      className={cn('size-11 shrink-0 self-end', formDialogBtnPrimaryClass)}
                      disabled={!newCommentText.trim()}
                      onClick={addComment}
                    >
                      <Send className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {taskEditForm && taskEditMode && (
          <div className="space-y-5">
            <FormDialogField label="Título de la tarea" required labelClassName={formLabelClass}>
              <Input
                className={formDialogInputClass}
                value={taskEditForm.title}
                onChange={(e) => setTaskEditForm({ ...taskEditForm, title: e.target.value })}
                placeholder="¿Qué necesitas hacer?"
              />
            </FormDialogField>

            <FormDialogField
              label={(
                <span className="inline-flex items-center gap-1.5">
                  <Link2 className="size-3.5 text-muted-foreground" />
                  Asociaciones
                </span>
              )}
              compactControl={false}
              labelClassName={formLabelClass}
              hint={
                editAssociations.length > 0
                  ? `${editAssociations.length} registro${editAssociations.length !== 1 ? 's' : ''} vinculado${editAssociations.length !== 1 ? 's' : ''}`
                  : undefined
              }
            >
              {editAssociations.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-1">
                  {editAssociations.map((a) => (
                    <Badge
                      key={`${a.type}-${a.id}`}
                      variant="secondary"
                      className="gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 pr-1.5 font-normal"
                    >
                      {a.type === 'contacto' && <User className="size-3" />}
                      {a.type === 'empresa' && <Building2 className="size-3" />}
                      {a.type === 'negocio' && <Briefcase className="size-3" />}
                      <span className="text-xs">{a.name}</span>
                      <button
                        type="button"
                        className="ml-0.5 rounded-sm p-0.5 hover:bg-muted"
                        onClick={() =>
                          setEditAssociations((prev) =>
                            prev.filter((x) => !(x.type === a.type && x.id === a.id)),
                          )
                        }
                      >
                        <span className="text-xs leading-none text-muted-foreground">&times;</span>
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <Popover open={editAssocPanelOpen} onOpenChange={setEditAssocPanelOpen} modal={false}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className={formDialogPickerTriggerClass}>
                    Buscar asociaciones
                    <ChevronDown
                      className={cn(
                        'size-4 text-muted-foreground transition-transform',
                        editAssocPanelOpen && 'rotate-180',
                      )}
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={8}
                  collisionPadding={16}
                  className={formDialogPopoverContentClass}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="flex border-b border-border/60">
                    {TASK_ASSOCIATION_PICKER_TABS.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        className={cn(
                          'flex-1 px-3 py-2.5 text-xs font-semibold transition-colors',
                          editAssocCategory === key
                            ? 'border-b-2 border-[#13944C] text-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                        onClick={() => {
                          setEditAssocCategory(key);
                          setEditAssocSearch('');
                        }}
                      >
                        {label}{' '}
                        <span className="font-normal text-muted-foreground">({assocCounts[key]})</span>
                      </button>
                    ))}
                  </div>
                  <div className="p-3">
                    <div className="relative mb-3">
                      <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar..."
                        value={editAssocSearch}
                        onChange={(e) => setEditAssocSearch(e.target.value)}
                        className={cn(formDialogInputClass, 'h-10 pl-9 text-sm')}
                      />
                    </div>
                    <div
                      className={cn(formDialogScrollListClass, 'space-y-0.5')}
                      onWheel={(e) => e.stopPropagation()}
                    >
                      {editAssocCategory === 'contactos' &&
                        !editUsesLinkedFetch &&
                        editPickerContacts.length === 0 && (
                          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                            Selecciona una empresa para ver sus contactos vinculados.
                          </p>
                        )}
                      {editAssocCategory === 'contactos' && editUsesLinkedFetch && editLinkedLoading && (
                        <div className="flex items-center justify-center gap-2 px-2 py-6 text-xs text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" />
                          Cargando contactos…
                        </div>
                      )}
                      {editAssocCategory === 'contactos' &&
                        !editLinkedLoading &&
                        paginateAssociationPickerItems(
                          filteredEditPickerContacts,
                          editAssocVisibleCount,
                        ).map((l) => {
                            const isSelected = editAssociations.some((a) =>
                              isTaskAssociationMatchingContact(a, l.id),
                            );
                            return (
                              <label
                                key={l.id}
                                className={cn(
                                  'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/60',
                                  isSelected && 'bg-muted/50',
                                )}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  className="size-3.5 shrink-0"
                                  onCheckedChange={(checked) => {
                                    setEditAssociations((prev) =>
                                      toggleTaskAssociation(
                                        prev,
                                        { type: 'contacto', id: l.id, name: l.name },
                                        checked === true,
                                      ),
                                    );
                                  }}
                                />
                                <User className="size-3.5 text-muted-foreground" />
                                <span className="truncate">{l.name}</span>
                              </label>
                            );
                          })}
                      {editAssocCategory === 'contactos' &&
                        !editLinkedLoading &&
                        editUsesLinkedFetch &&
                        filteredEditPickerContacts.length === 0 && (
                          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                            {editSelectedCompanyName
                              ? `No hay contactos vinculados a ${editSelectedCompanyName}.`
                              : 'No hay contactos vinculados a esta empresa.'}
                          </p>
                        )}
                      {editAssocCategory === 'empresas' &&
                        paginateAssociationPickerItems(
                          filteredEditPickerCompanies,
                          editAssocVisibleCount,
                        ).map((c) => {
                            const rowId = c.id ?? c.name;
                            const isSelected = editAssociations.some((a) =>
                              isTaskAssociationMatchingEmpresa(a, c),
                            );
                            return (
                              <label
                                key={rowId}
                                className={cn(
                                  'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/60',
                                  isSelected && 'bg-muted/50',
                                )}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  className="size-3.5 shrink-0"
                                  onCheckedChange={(checked) => {
                                    setEditAssociations((prev) => {
                                      const next = toggleTaskAssociation(
                                        prev,
                                        { type: 'empresa', id: rowId, name: c.name },
                                        checked === true,
                                      );
                                      return next;
                                    });
                                    if (checked) {
                                      setEditAssocCategory('contactos');
                                      setEditAssocSearch('');
                                    }
                                  }}
                                />
                                <Building2 className="size-3.5 text-muted-foreground" />
                                <span className="truncate">{c.name}</span>
                              </label>
                            );
                          })}
                      {editAssocCategory === 'negocios' &&
                        !editUsesLinkedFetch &&
                        editPickerOpportunities.length === 0 && (
                          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                            Selecciona una empresa para ver sus oportunidades vinculadas.
                          </p>
                        )}
                      {editAssocCategory === 'negocios' && editUsesLinkedFetch && editLinkedLoading && (
                        <div className="flex items-center justify-center gap-2 px-2 py-6 text-xs text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" />
                          Cargando oportunidades…
                        </div>
                      )}
                      {editAssocCategory === 'negocios' &&
                        !editLinkedLoading &&
                        paginateAssociationPickerItems(
                          filteredEditPickerOpportunities,
                          editAssocVisibleCount,
                        ).map((o) => {
                            const isSelected = editAssociations.some((a) =>
                              isTaskAssociationMatchingNegocio(a, o.id),
                            );
                            return (
                              <label
                                key={o.id}
                                className={cn(
                                  'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/60',
                                  isSelected && 'bg-muted/50',
                                )}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  className="size-3.5 shrink-0"
                                  onCheckedChange={(checked) => {
                                    setEditAssociations((prev) =>
                                      toggleTaskAssociation(
                                        prev,
                                        { type: 'negocio', id: o.id, name: o.title },
                                        checked === true,
                                      ),
                                    );
                                  }}
                                />
                                <Briefcase className="size-3.5 text-muted-foreground" />
                                <span className="truncate">{o.title}</span>
                              </label>
                            );
                          })}
                      {editAssocCategory === 'negocios' &&
                        !editLinkedLoading &&
                        editUsesLinkedFetch &&
                        filteredEditPickerOpportunities.length === 0 && (
                          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                            {editSelectedCompanyName
                              ? `No hay oportunidades vinculadas a ${editSelectedCompanyName}.`
                              : 'No hay oportunidades vinculadas a esta empresa.'}
                          </p>
                        )}
                      <TaskAssociationPickerLoadMore
                        visibleCount={editAssocVisibleCount}
                        totalCount={activeEditAssocFilteredTotal}
                        onShowMore={showMoreEditAssocItems}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </FormDialogField>

            <FormDialogGrid className="gap-y-4">
              <FormDialogField label="Fecha de tarea" required labelClassName={formLabelClass}>
                <Input
                  type="date"
                  className={formDialogInputClass}
                  value={taskEditForm.dueDate}
                  onChange={(e) => setTaskEditForm({ ...taskEditForm, dueDate: e.target.value })}
                />
              </FormDialogField>
              <FormDialogField label="Tipo" required labelClassName={formLabelClass}>
                <Select
                  value={taskEditForm.type ?? ''}
                  onValueChange={(v) => setTaskEditForm({ ...taskEditForm, type: v as TaskDetailType })}
                >
                  <SelectTrigger className={formDialogSelectTriggerClass}>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_KINDS.map((key) => (
                      <SelectItem key={key} value={key}>
                        {taskTypeLabels[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormDialogField>
              <FormDialogField label="Hora estimada" labelClassName={formLabelClass}>
                <Input
                  type="time"
                  className={formDialogInputClass}
                  value={taskEditForm.startTime ?? ''}
                  onChange={(e) => setTaskEditForm({ ...taskEditForm, startTime: e.target.value })}
                />
              </FormDialogField>
              <FormDialogField label="Estado" labelClassName={formLabelClass}>
                <Select
                  value={taskEditForm.status === 'vencida' ? 'pendiente' : taskEditForm.status}
                  onValueChange={(v) => setTaskEditForm({ ...taskEditForm, status: v })}
                >
                  <SelectTrigger className={formDialogSelectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taskEditStatusKeys.map((key) => (
                      <SelectItem key={key} value={key}>
                        {statusLabels[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormDialogField>
              <FormDialogField label="Prioridad" labelClassName={formLabelClass}>
                <Select
                  value={taskEditForm.priority ?? 'media'}
                  onValueChange={(v) =>
                    setTaskEditForm({ ...taskEditForm, priority: v as TaskDetailPriority })
                  }
                >
                  <SelectTrigger className={formDialogSelectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormDialogField>
              <AssignedAdvisorFormField
                htmlId="task-detail-edit-assignee"
                value={editAssigneeId}
                onChange={setEditAssigneeId}
                assignModule="actividades"
                disabled={false}
                fallbackName={taskEditForm.assignee}
                label="Asignado"
                formStyle
              />
            </FormDialogGrid>
          </div>
        )}
      </FormDialogShell>

      <ConfirmDialog
        open={deleteTaskConfirmOpen}
        onOpenChange={setDeleteTaskConfirmOpen}
        title="Eliminar tarea"
        description={
          task
            ? `¿Estás seguro de que deseas eliminar la tarea «${task.title}»? Esta acción no se puede deshacer.`
            : ''
        }
        onConfirm={confirmTaskDelete}
        variant="destructive"
        nested
      />
    </>
  );
}
