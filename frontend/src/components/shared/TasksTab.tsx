import { useState, forwardRef, useImperativeHandle, useMemo } from 'react';
import type { ComponentType } from 'react';
import { toast } from '@/lib/notify';
import { priorityLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { useAppStore } from '@/store';
import { resolveAdvisorAssigneeId } from '@/lib/advisorAssigneeDefaults';
import { canPickOtherCommercialAdvisor } from '@/data/rbac';
import { usePermissions } from '@/hooks/usePermissions';
import { useActivities } from '@/hooks/useActivities';
import type { Contact, Opportunity, TaskAssociation, Activity, TaskKind } from '@/types';
import { TASK_KINDS } from '@/types';
import { activityMatchesTasksTabContext } from '@/lib/activityEntityLinks';
import { completeTaskWithActivityForm } from '@/lib/activityPayloadFromForm';
import {
  buildCreateTaskPayloadFromForm,
  buildTaskDetailUpdatePayload,
  normalizeTaskAssociations,
  taskFormHasEntityLinks,
} from '@/lib/taskActivityUpdate';
import {
  fallbackTaskAssociationsFromEntityContext,
  resolveLinkedCompanyFromTaskContext,
  taskAssociationsFromActivity,
  taskLinkBadgesFromActivity,
} from '@/lib/taskAssociationsFromActivity';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatDate, formatTodayPeruYmd, completedAtNowIso } from '@/lib/formatters';
import { effectiveTaskStatus } from '@/lib/taskStatus';
import {
  activityTypeIconCircleClass,
  ACTIVITY_ICON_INHERIT,
} from '@/lib/activityTypeCircleStyles';
import { activityTypeSvgIcon } from '@/lib/activityTypeSvgIcons';
import { cn } from '@/lib/utils';

import { ActivityFormDialog } from './ActivityFormDialog';
import { TaskFormDialog, type TaskFormResult } from './TaskFormDialog';
import { TaskDetailDialog, type TaskDetailTask, type TaskComment as TaskDetailComment } from './TaskDetailDialog';

type TaskStatus = 'pendiente' | 'completada' | 'en_progreso' | 'vencida';
type TaskPriority = 'alta' | 'media' | 'baja';
type TaskType = TaskKind;

interface TaskComment {
  id: string;
  taskId: string;
  author: string;
  text: string;
  date: string;
}

interface MockTask {
  id: string;
  title: string;
  status: TaskStatus;
  type?: TaskType;
  priority: TaskPriority;
  company?: string;
  startDate?: string;
  dueDate: string;
  startTime?: string;
  assignee: string;
  associations?: TaskAssociation[];
  /** Resumen guardado al completar (llamada/reunión/correo) */
  description?: string;
}

const taskStatusLabels: Record<TaskStatus, string> = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  en_progreso: 'En progreso',
  vencida: 'Vencida',
};

const taskStatusColors: Record<TaskStatus, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  completada: 'bg-emerald-100 text-emerald-700',
  en_progreso: 'bg-blue-100 text-blue-700',
  vencida: 'bg-red-100 text-red-700',
};

const taskPriorityColors: Record<TaskPriority, string> = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-amber-100 text-amber-700',
  baja: 'bg-slate-100 text-slate-600',
};

const taskTypeLabels: Record<TaskType, string> = {
  llamada: 'Llamada',
  reunion: 'Reunión',
  correo: 'Correo',
  whatsapp: 'WhatsApp',
};

const taskTypeIcons: Record<TaskType, ComponentType<{ className?: string }>> = {
  llamada: activityTypeSvgIcon('llamada'),
  reunion: activityTypeSvgIcon('reunion'),
  correo: activityTypeSvgIcon('correo'),
  whatsapp: activityTypeSvgIcon('whatsapp'),
};

interface TasksTabProps {
  contacts?: Contact[];
  companies?: { name: string; id?: string }[];
  opportunities?: Opportunity[];
  defaultAssigneeId?: string;
  initialComments?: TaskComment[];
  onActivityCreated?: (activity: { id: string; type: string; title: string; description: string; assignedTo: string; assignedToName: string; status: string; dueDate: string; createdAt: string; contactId?: string }) => void;
  contactId?: string;
  companyId?: string;
  opportunityId?: string;
  clienteEmpresaId?: string;
  contactoClienteId?: string;
  contactoClienteName?: string;
  clienteEmpresaName?: string;
}

function isTaskActivity(a: Activity): boolean {
  return (
    a.type === 'tarea' &&
    !!a.taskKind &&
    TASK_KINDS.includes(a.taskKind)
  );
}

function activityToMockTask(a: Activity): MockTask {
  const associations = taskAssociationsFromActivity(a);
  const company =
    associations.find((x) => x.type === 'empresa')?.name ??
    (a.contactName && !a.contactId ? a.contactName.trim() : undefined);
  return {
    id: a.id,
    title: a.title,
    status: a.status as TaskStatus,
    type:
      a.taskKind && TASK_KINDS.includes(a.taskKind) ? a.taskKind : 'llamada',
    priority: (a.priority as TaskPriority) || 'media',
    company,
    startDate: a.startDate,
    dueDate: a.dueDate,
    startTime: a.startTime,
    assignee: a.assignedToName,
    associations: associations.length > 0 ? associations : undefined,
    description: a.description || undefined,
  };
}

const defaultInitialComments: TaskComment[] = [
  { id: 'tc1', taskId: 't2', author: 'Carlos Mendoza', text: 'Se confirmó la visita para el día 8, coordinar con recepción del hotel.', date: '2026-03-06T10:30:00' },
  { id: 'tc2', taskId: 't2', author: 'José Ramírez', text: 'Listo, ya me comuniqué con el hotel. Nos esperan a las 2pm.', date: '2026-03-06T14:15:00' },
  { id: 'tc3', taskId: 't1', author: 'María García', text: 'Propuesta enviada al correo del contacto principal.', date: '2026-03-04T09:00:00' },
];

export interface TasksTabHandle {
  addTask: (task: {
    id: string;
    title: string;
    status: string;
    type?: string;
    priority: string;
    company?: string;
    startDate?: string;
    dueDate: string;
    startTime?: string;
    assignee: string;
    associations?: TaskAssociation[];
  }) => void;
}

export const TasksTab = forwardRef<TasksTabHandle, TasksTabProps>(function TasksTab({
  contacts = [],
  companies = [],
  opportunities = [],
  defaultAssigneeId,
  initialComments = defaultInitialComments,
  onActivityCreated,
  contactId,
  companyId,
  opportunityId,
  clienteEmpresaId,
  contactoClienteId,
  contactoClienteName,
  clienteEmpresaName,
}, ref) {
  const { users, activeAdvisors } = useUsers();
  const currentUser = useAppStore((s) => s.currentUser);
  const { hasPermission } = usePermissions();
  const canAssignOthers = canPickOtherCommercialAdvisor(hasPermission);
  const resolvedDefaultAssignee = resolveAdvisorAssigneeId(defaultAssigneeId, currentUser, canAssignOthers);
  const { activities, createActivity, updateActivity, deleteActivity } = useActivities();

  const tasks = useMemo(() => {
    const filtered = activities.filter((a) => {
      if (!isTaskActivity(a)) return false;
      return activityMatchesTasksTabContext(a, {
        contactId,
        companyId,
        opportunityId,
        clienteEmpresaId,
        contactoClienteId,
      });
    });
    return filtered.map(activityToMockTask);
  }, [activities, contactId, companyId, opportunityId, clienteEmpresaId, contactoClienteId]);

  useImperativeHandle(ref, () => ({
    addTask: async (task) => {
      const userId =
        users.find((u) => u.name === task.assignee)?.id ??
        defaultAssigneeId ??
        activeAdvisors[0]?.id;
      if (!userId) return;

      const mergedAssociations = normalizeTaskAssociations(task.associations);
      const formLike = {
        title: task.title,
        type:
          task.type && TASK_KINDS.includes(task.type as TaskKind)
            ? (task.type as TaskKind)
            : 'llamada',
        status: (task.status as TaskStatus) || 'pendiente',
        priority: (task.priority as TaskPriority) || 'media',
        assignee: userId,
        assigneeName: task.assignee,
        startDate: task.startDate,
        startTime: task.startTime,
        dueDate: task.dueDate,
        associations: mergedAssociations,
      };

      if (!taskFormHasEntityLinks(formLike)) {
        const fallbackAssocs: TaskAssociation[] = [...mergedAssociations];
        if (contactId && !fallbackAssocs.some((a) => a.type === 'contacto' && a.id === contactId)) {
          const c = contacts.find((x) => x.id === contactId);
          fallbackAssocs.push({ type: 'contacto', id: contactId, name: c?.name ?? 'Contacto' });
        }
        if (
          companyId &&
          !fallbackAssocs.some((a) => a.type === 'empresa' && a.id === companyId)
        ) {
          const c = companies.find((x) => x.id === companyId);
          fallbackAssocs.push({ type: 'empresa', id: companyId, name: c?.name ?? 'Empresa' });
        }
        if (
          opportunityId &&
          !fallbackAssocs.some((a) => a.type === 'negocio' && a.id === opportunityId)
        ) {
          const o = opportunities.find((x) => x.id === opportunityId);
          fallbackAssocs.push({
            type: 'negocio',
            id: opportunityId,
            name: o?.title ?? 'Oportunidad',
          });
        }
        if (
          clienteEmpresaId &&
          !fallbackAssocs.some((a) => a.type === 'cliente_empresa' && a.id === clienteEmpresaId)
        ) {
          fallbackAssocs.push({
            type: 'cliente_empresa',
            id: clienteEmpresaId,
            name: clienteEmpresaName ?? 'Empresa cliente',
          });
        }
        if (
          contactoClienteId &&
          !fallbackAssocs.some((a) => a.type === 'cliente_contacto' && a.id === contactoClienteId)
        ) {
          fallbackAssocs.push({
            type: 'cliente_contacto',
            id: contactoClienteId,
            name: contactoClienteName ?? 'Contacto cliente',
          });
        }
        formLike.associations = fallbackAssocs;
      }

      if (!taskFormHasEntityLinks(formLike)) return;

      try {
        await createActivity(buildCreateTaskPayloadFromForm(formLike));
        toast.success('Tarea creada');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al crear');
      }
    },
  }));
  const [completedTask, setCompletedTask] = useState<MockTask | null>(null);
  const [activityFromTaskOpen, setActivityFromTaskOpen] = useState(false);
  const [linkedTaskPromptOpen, setLinkedTaskPromptOpen] = useState(false);
  const [linkPromptSourceTaskId, setLinkPromptSourceTaskId] = useState<string | null>(null);
  const [linkedTaskOpen, setLinkedTaskOpen] = useState(false);
  const [linkedTaskDefaultAssociations, setLinkedTaskDefaultAssociations] = useState<TaskAssociation[] | undefined>();
  const [selectedTask, setSelectedTask] = useState<MockTask | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [taskComments, setTaskComments] = useState<TaskComment[]>(initialComments);

  const tasksAsDetailFormat = useMemo(() => tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    type: t.type,
    priority: t.priority,
    company: t.company,
    startDate: t.startDate,
    dueDate: t.dueDate,
    startTime: t.startTime,
    assignee: t.assignee,
    associations: t.associations,
    description: t.description,
  })), [tasks]);

  const completedTaskLinkedCompany = useMemo(() => {
    if (!completedTask) return { id: undefined, name: undefined };
    const assocs = completedTask.associations ?? [];
    return resolveLinkedCompanyFromTaskContext(
      assocs,
      companyId,
      completedTask.company ?? companies.find((c) => c.id === companyId)?.name,
    );
  }, [completedTask, companyId, companies]);

  function buildLinkedTaskDefaultAssociations(source?: MockTask | null): TaskAssociation[] {
    const fromTask = source?.associations?.length
      ? source.associations.map((a) => ({ ...a }))
      : [];
    if (fromTask.length > 0) return fromTask;
    return fallbackTaskAssociationsFromEntityContext({
      contactId,
      contactName: contacts.find((c) => c.id === contactId)?.name,
      companyId,
      companyName: companies.find((c) => c.id === companyId)?.name ?? source?.company,
      opportunityId,
      opportunityTitle: opportunities.find((o) => o.id === opportunityId)?.title,
      clienteEmpresaId,
      clienteEmpresaName,
      contactoClienteId,
      contactoClienteName,
    });
  }

  async function handleLinkedTaskFormSave(data: TaskFormResult) {
    if (!taskFormHasEntityLinks(data)) {
      toast.error('Debes vincular la tarea a al menos un contacto, empresa u oportunidad');
      throw new Error('TASK_FORM_VALIDATION');
    }
    try {
      await createActivity(
        buildCreateTaskPayloadFromForm(data, {
          sourceTaskId: linkPromptSourceTaskId ?? undefined,
        }),
      );
      toast.success(`Tarea "${data.title}" creada`);
      setLinkedTaskOpen(false);
      setCompletedTask(null);
      setLinkPromptSourceTaskId(null);
      setLinkedTaskDefaultAssociations(undefined);
    } catch (e) {
      if (e instanceof Error && e.message === 'TASK_FORM_VALIDATION') throw e;
      toast.error(e instanceof Error ? e.message : 'Error al crear');
      throw e;
    }
  }

  function handleTaskToggle(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'completada' ? 'pendiente' : 'completada';
    if (
      newStatus === 'completada' &&
      task.type &&
      TASK_KINDS.includes(task.type)
    ) {
      setCompletedTask(task);
      setActivityFromTaskOpen(true);
      return;
    }
    const payload: { status: string; completedAt?: string } = { status: newStatus };
    if (newStatus === 'completada') {
      payload.completedAt = completedAtNowIso();
    } else if (task.status === 'completada') {
      payload.completedAt = '';
    }
    toast.success(newStatus === 'completada' ? 'Tarea completada' : 'Tarea reactivada');
    void updateActivity(taskId, payload).catch((e) => {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar');
    });
  }

  return (
    <>
      <Card className="overflow-hidden pt-2">
        <CardContent>
          <Table className="table-fixed w-full min-w-0">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-11 text-center text-text-tertiary">Tipo</TableHead>
                <TableHead className="min-w-0 text-text-tertiary">Título</TableHead>
                <TableHead className="hidden w-[92px] sm:table-cell text-text-tertiary">
                  Prioridad
                </TableHead>
                <TableHead className="hidden min-w-[88px] md:table-cell text-text-tertiary">
                  Asignado
                </TableHead>
                <TableHead className="hidden w-[104px] lg:table-cell text-text-tertiary">Fecha</TableHead>
                <TableHead className="w-[104px] text-right text-text-tertiary">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const taskType = (
                  task.type && TASK_KINDS.includes(task.type) ? task.type : 'llamada'
                ) as TaskType;
                const TypeIcon = taskTypeIcons[taskType];
                const circle = activityTypeIconCircleClass(taskType);
                return (
                <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedTask(task); setTaskDetailOpen(true); }}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={task.status === 'completada'}
                      onCheckedChange={() => handleTaskToggle(task.id)}
                    />
                  </TableCell>
                  <TableCell className="text-center align-middle">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            'mx-auto mt-0.5 flex h-7 w-7 cursor-default items-center justify-center rounded-full border-0 p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                            ACTIVITY_ICON_INHERIT,
                            circle ??
                              'bg-muted text-muted-foreground [&_svg]:text-muted-foreground',
                          )}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={taskTypeLabels[taskType]}
                        >
                          <TypeIcon className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">{taskTypeLabels[taskType]}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="min-w-0 align-middle">
                    <span
                      className={cn(
                        'block truncate text-sm font-medium',
                        task.status === 'completada' && 'text-muted-foreground line-through',
                      )}
                      title={task.title}
                    >
                      {task.title}
                    </span>
                  </TableCell>
                  <TableCell className="hidden align-middle sm:table-cell">
                    <Badge className={`text-xs border-0 ${taskPriorityColors[task.priority]}`}>
                      {priorityLabels[task.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden min-w-0 align-middle md:table-cell">
                    <span className="block truncate text-sm text-muted-foreground" title={task.assignee}>
                      {task.assignee}
                    </span>
                  </TableCell>
                  <TableCell className="hidden align-middle text-sm text-muted-foreground lg:table-cell">
                    <div className="leading-tight">
                      <span className="block whitespace-nowrap">{formatDate(task.dueDate)}</span>
                      {task.startTime && (
                        <span className="mt-0.5 block whitespace-nowrap text-xs text-muted-foreground/80">
                          {task.startTime}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right align-middle">
                    {(() => {
                      const displayStatus = effectiveTaskStatus({
                        status: task.status,
                        dueDate: task.dueDate,
                      });
                      return (
                        <Badge className={`text-xs border-0 ${taskStatusColors[displayStatus]}`}>
                          {taskStatusLabels[displayStatus]}
                        </Badge>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              );
              })}
              {tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No hay tareas registradas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {completedTask &&
        completedTask.type &&
        TASK_KINDS.includes(completedTask.type) &&
        activityFromTaskOpen && (
        <ActivityFormDialog
          type={completedTask.type}
          open={activityFromTaskOpen}
          onOpenChange={(open) => { setActivityFromTaskOpen(open); if (!open) setCompletedTask(null); }}
          onSave={async (data, meta) => {
            if (!completedTask?.type || !TASK_KINDS.includes(completedTask.type)) return;
            const t = completedTask;
            const kind = completedTask.type!;
            const sourceActivity = activities.find((a) => a.id === t.id);
            if (!sourceActivity) {
              toast.error('No se encontró la tarea para registrar la actividad');
              throw new Error('task_not_found');
            }
            try {
              const { savedActivity } = await completeTaskWithActivityForm({
                kind,
                form: data,
                task: sourceActivity,
                extraContactIds: meta?.extraContactIds,
                createActivity,
                updateActivity,
              });
              setLinkPromptSourceTaskId(t.id);
              setActivityFromTaskOpen(false);
              setLinkedTaskPromptOpen(true);
              onActivityCreated?.({
                id: savedActivity.id,
                type: savedActivity.type,
                title: savedActivity.title,
                description: savedActivity.description,
                assignedTo: savedActivity.assignedTo,
                assignedToName: savedActivity.assignedToName,
                status: savedActivity.status,
                dueDate: savedActivity.dueDate,
                createdAt: savedActivity.createdAt,
                contactId: savedActivity.contactId ?? contactId,
              });
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : 'Error al guardar; el estado se revirtió.',
              );
              throw e;
            }
          }}
          taskSummary={{
            title: completedTask.title,
            company: completedTask.company,
            assignee: completedTask.assignee,
            linkBadges: completedTask.associations?.length
              ? completedTask.associations.map((x) => ({ type: x.type, name: x.name }))
              : (() => {
                  const act = activities.find((a) => a.id === completedTask.id);
                  return act ? taskLinkBadgesFromActivity(act) : undefined;
                })(),
          }}
          linkedCompanyId={completedTaskLinkedCompany.id}
          linkedCompanyName={completedTaskLinkedCompany.name}
          defaultAssigneeId={
            activities.find((a) => a.id === completedTask.id)?.assignedTo ?? resolvedDefaultAssignee
          }
          defaultTitle={completedTask.title}
          defaultDate={formatTodayPeruYmd()}
          showSkip
        />
      )}

      {/* Prompt para crear tarea vinculada */}
      <Dialog
        open={linkedTaskPromptOpen}
        onOpenChange={(open) => {
          setLinkedTaskPromptOpen(open);
          if (!open) {
            setCompletedTask(null);
            setLinkPromptSourceTaskId(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Crear tarea vinculada</DialogTitle>
            <DialogDescription>
              ¿Deseas crear una nueva tarea vinculada a esta actividad?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setLinkedTaskPromptOpen(false);
                setCompletedTask(null);
                setLinkPromptSourceTaskId(null);
              }}
            >
              No, gracias
            </Button>
            <Button
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              onClick={() => {
                setLinkedTaskDefaultAssociations(buildLinkedTaskDefaultAssociations(completedTask));
                setLinkedTaskPromptOpen(false);
                setLinkedTaskOpen(true);
              }}
            >
              Sí, crear tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskFormDialog
        open={linkedTaskOpen}
        onOpenChange={(open) => {
          setLinkedTaskOpen(open);
          if (!open) {
            setCompletedTask(null);
            setLinkPromptSourceTaskId(null);
            setLinkedTaskDefaultAssociations(undefined);
          }
        }}
        title="Nueva Tarea Vinculada"
        description="Crea una tarea para continuar con el proceso."
        contacts={contacts}
        companies={companies}
        opportunities={opportunities}
        defaultAssigneeId={resolvedDefaultAssignee}
        defaultAssociations={linkedTaskDefaultAssociations}
        onSave={handleLinkedTaskFormSave}
      />

      {/* Detalle de tarea */}
      <TaskDetailDialog
        open={taskDetailOpen}
        onOpenChange={(o) => { setTaskDetailOpen(o); if (!o) setSelectedTask(null); }}
        task={selectedTask as TaskDetailTask | null}
        statusLabels={taskStatusLabels}
        statusColors={taskStatusColors}
        tasks={tasksAsDetailFormat as TaskDetailTask[]}
        onTasksChange={async (newTasks) => {
          const current = tasksAsDetailFormat;
          const newIds = new Set(newTasks.map((t) => t.id));
          const deleted = current.filter((t) => !newIds.has(t.id));
          for (const t of deleted) {
            try {
              await deleteActivity(t.id);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Error al eliminar');
            }
          }
          for (const nd of newTasks) {
            const oldDetail = current.find((c) => c.id === nd.id);
            if (!oldDetail) continue;
            const prevAssigneeId = users.find((u) => u.name === oldDetail.assignee)?.id;
            const payload = buildTaskDetailUpdatePayload(oldDetail, nd, {
              previousAssigneeId: prevAssigneeId,
            });
            if (Object.keys(payload).length === 0) continue;
            try {
              await updateActivity(nd.id, payload);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Error al actualizar');
            }
          }
        }}
        taskComments={taskComments as TaskDetailComment[]}
        onTaskCommentsChange={(comments) => setTaskComments(comments as TaskComment[])}
        contacts={contacts}
        companies={companies}
        opportunities={opportunities}
        onCompleteWithActivity={(t) => {
          const mt = tasks.find((ta) => ta.id === t.id) as MockTask;
          if (mt) {
            setCompletedTask(mt);
            setTaskDetailOpen(false);
            setSelectedTask(null);
            setActivityFromTaskOpen(true);
          }
        }}
      />
    </>
  );
});
