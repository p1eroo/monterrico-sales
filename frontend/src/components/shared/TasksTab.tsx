import { useState, forwardRef, useImperativeHandle, useMemo } from 'react';
import { CheckSquare, Phone, Mail, Users, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { priorityLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { useActivities } from '@/hooks/useActivities';
import type { Contact, Opportunity, TaskAssociation, Activity, TaskKind } from '@/types';
import { TASK_KINDS } from '@/types';
import type { UpdateActivityPayload } from '@/lib/activityApi';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/formatters';

import { ActivityFormDialog } from './ActivityFormDialog';
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

const taskTypeIcons: Record<TaskType, typeof Phone> = {
  llamada: Phone,
  reunion: Users,
  correo: Mail,
  whatsapp: MessageCircle,
};

const taskTypeIconColors: Record<TaskType, string> = {
  llamada: 'bg-blue-100 text-blue-600',
  reunion: 'bg-purple-100 text-purple-600',
  correo: 'bg-amber-100 text-amber-600',
  whatsapp: 'bg-green-100 text-green-600',
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
}

function isTaskActivity(a: Activity): boolean {
  return (
    a.type === 'tarea' &&
    !!a.taskKind &&
    TASK_KINDS.includes(a.taskKind)
  );
}

function activityToMockTask(a: Activity): MockTask {
  const company = a.contactName?.includes(' - ') ? a.contactName.split(' - ')[1] : undefined;
  const contactName = a.contactName?.includes(' - ') ? a.contactName.split(' - ')[0] : a.contactName;
  const associations: TaskAssociation[] = [];
  if (a.contactId && contactName) associations.push({ type: 'contacto', id: a.contactId, name: contactName });
  return {
    id: a.id,
    title: a.title,
    status: a.status as TaskStatus,
    type:
      a.taskKind && TASK_KINDS.includes(a.taskKind) ? a.taskKind : 'llamada',
    priority: 'media',
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
  addTask: (task: { id: string; title: string; status: string; type?: string; priority: string; company?: string; startDate?: string; dueDate: string; startTime?: string; assignee: string; associations?: { type: 'contacto' | 'empresa' | 'negocio'; id: string; name: string }[] }) => void;
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
}, ref) {
  const { users, activeUsers } = useUsers();
  const { activities, createActivity, updateActivity, deleteActivity } = useActivities();

  const tasks = useMemo(() => {
    const filtered = activities.filter((a) => {
      if (!isTaskActivity(a)) return false;
      if (contactId && a.contactId === contactId) return true;
      if (companyId && a.companyId === companyId) return true;
      if (opportunityId && a.opportunityId === opportunityId) return true;
      return false;
    });
    return filtered.map(activityToMockTask);
  }, [activities, contactId, companyId, opportunityId]);

  useImperativeHandle(ref, () => ({
    addTask: async (task) => {
      const contactAssoc = task.associations?.find((a) => a.type === 'contacto');
      const empresaAssoc = task.associations?.find((a) => a.type === 'empresa');
      const negocioAssoc = task.associations?.find((a) => a.type === 'negocio');
      const userId = users.find((u) => u.name === task.assignee)?.id ?? defaultAssigneeId ?? activeUsers[0]?.id;
      if (!userId) return;
      const contactIdToUse = contactAssoc?.id ?? contactId;
      const companyIdToUse = empresaAssoc?.id && /^c[a-z0-9]+$/i.test(empresaAssoc.id) ? empresaAssoc.id : companyId;
      const opportunityIdToUse = negocioAssoc?.id ?? opportunityId;
      if (!contactIdToUse && !companyIdToUse && !opportunityIdToUse) return;
      try {
        await createActivity({
          type: 'tarea',
          taskKind:
            task.type && TASK_KINDS.includes(task.type as TaskKind)
              ? task.type
              : 'llamada',
          title: task.title,
          description: '',
          assignedTo: userId,
          dueDate: task.dueDate,
          startDate: task.startDate,
          startTime: task.startTime,
          contactId: contactIdToUse,
          companyId: companyIdToUse,
          opportunityId: opportunityIdToUse,
        });
        toast.success('Tarea creada');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al crear');
      }
    },
  }));
  const [completedTask, setCompletedTask] = useState<MockTask | null>(null);
  const [activityFromTaskOpen, setActivityFromTaskOpen] = useState(false);
  const [linkedTaskPromptOpen, setLinkedTaskPromptOpen] = useState(false);
  const [linkedTaskOpen, setLinkedTaskOpen] = useState(false);
  const [linkedTaskTitle, setLinkedTaskTitle] = useState('');
  const [linkedTaskType, setLinkedTaskType] = useState<TaskType | ''>('');
  const [linkedTaskStatus, setLinkedTaskStatus] = useState<TaskStatus>('pendiente');
  const [linkedTaskPriority, setLinkedTaskPriority] = useState<TaskPriority>('media');
  const [linkedTaskAssignee, setLinkedTaskAssignee] = useState(defaultAssigneeId ?? '');
  const [linkedTaskTime, setLinkedTaskTime] = useState('');
  const [linkedTaskStartDate, setLinkedTaskStartDate] = useState('');
  const [linkedTaskDueDate, setLinkedTaskDueDate] = useState('');
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

  function resetLinkedTaskForm() {
    setLinkedTaskTitle('');
    setLinkedTaskType('');
    setLinkedTaskStatus('pendiente');
    setLinkedTaskPriority('media');
    setLinkedTaskAssignee(defaultAssigneeId ?? '');
    setLinkedTaskTime('');
    setLinkedTaskStartDate('');
    setLinkedTaskDueDate('');
  }

  async function handleTaskToggle(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'completada' ? 'pendiente' : 'completada';
    try {
      const payload: { status: string; completedAt?: string } = { status: newStatus };
      if (newStatus === 'completada') payload.completedAt = new Date().toISOString().slice(0, 10);
      await updateActivity(taskId, payload);
      toast.success(newStatus === 'completada' ? 'Tarea completada' : 'Tarea reactivada');
      if (
        newStatus === 'completada' &&
        task.type &&
        TASK_KINDS.includes(task.type)
      ) {
        setCompletedTask(task);
        setActivityFromTaskOpen(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar');
    }
  }

  return (
    <>
      <Card className="pt-2 overflow-hidden">
        <CardContent>
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-[180px]">Tarea</TableHead>
                <TableHead className="hidden md:table-cell w-[120px]">Empresa</TableHead>
                <TableHead className="hidden md:table-cell w-[120px]">Contacto</TableHead>
                <TableHead className="hidden lg:table-cell w-[90px]">Prioridad</TableHead>
                <TableHead className="w-[110px]">Responsable</TableHead>
                <TableHead className="hidden md:table-cell w-[130px]">Fecha</TableHead>
                <TableHead className="w-[100px] text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const taskType = (
                  task.type && TASK_KINDS.includes(task.type) ? task.type : 'llamada'
                ) as TaskType;
                const TypeIcon = taskTypeIcons[taskType];
                const iconColor = taskTypeIconColors[taskType];
                return (
                <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedTask(task); setTaskDetailOpen(true); }}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={task.status === 'completada'}
                      onCheckedChange={() => handleTaskToggle(task.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div
                      className={`flex size-8 items-center justify-center rounded-lg ${iconColor}`}
                      title={taskTypeLabels[taskType]}
                    >
                      <TypeIcon className="size-4" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`block truncate text-sm font-medium ${task.status === 'completada' ? 'line-through text-muted-foreground' : ''}`}
                      title={task.title}
                    >
                      {task.title}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{task.company ?? '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {task.associations?.find((a) => a.type === 'contacto')?.name ?? '—'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge className={`text-xs border-0 ${taskPriorityColors[task.priority]}`}>
                      {priorityLabels[task.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{task.assignee}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {formatDate(task.dueDate)}
                    {task.startTime && <span className="ml-1 text-xs">({task.startTime})</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className={`text-xs border-0 ${taskStatusColors[task.status]}`}>
                      {taskStatusLabels[task.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
              })}
              {tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
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
          onSave={async (data) => {
            const summary = data.description?.trim() || '';
            if (summary && completedTask) {
              try {
                await updateActivity(completedTask.id, { description: summary });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Error al guardar');
              }
            }
            onActivityCreated?.({
              id: completedTask!.id,
              type: completedTask!.type!,
              title: completedTask!.title,
              description: summary,
              assignedTo: '',
              assignedToName: completedTask!.assignee,
              status: 'completada',
              dueDate: completedTask!.dueDate,
              createdAt: new Date().toISOString().slice(0, 10),
              contactId,
            });
            setActivityFromTaskOpen(false);
            setLinkedTaskPromptOpen(true);
          }}
          taskSummary={{
            title: completedTask.title,
            company: completedTask.company,
            assignee: completedTask.assignee,
          }}
          defaultTitle={completedTask.title}
          defaultDate={completedTask.dueDate || undefined}
          defaultTime={completedTask.startTime || undefined}
          showSkip
        />
      )}

      {/* Prompt para crear tarea vinculada */}
      <Dialog open={linkedTaskPromptOpen} onOpenChange={(open) => { setLinkedTaskPromptOpen(open); if (!open) setCompletedTask(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Crear tarea vinculada</DialogTitle>
            <DialogDescription>
              ¿Deseas crear una nueva tarea vinculada a esta actividad?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => { setLinkedTaskPromptOpen(false); setCompletedTask(null); }}>
              No, gracias
            </Button>
            <Button className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={() => {
              setLinkedTaskPromptOpen(false);
              resetLinkedTaskForm();
              setLinkedTaskTitle(`Seguimiento: ${completedTask?.title ?? ''}`);
              setLinkedTaskOpen(true);
            }}>
              Sí, crear tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Formulario de tarea vinculada */}
      <Dialog open={linkedTaskOpen} onOpenChange={(open) => { setLinkedTaskOpen(open); if (!open) setCompletedTask(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="size-5 text-amber-600" /> Nueva Tarea Vinculada
            </DialogTitle>
            <DialogDescription>
              Crea una tarea para continuar con el proceso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título de la tarea *</Label>
              <Input value={linkedTaskTitle} onChange={(e) => setLinkedTaskTitle(e.target.value)} placeholder="¿Qué necesitas hacer?" />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Asignar a</Label>
                <Select value={linkedTaskAssignee} onValueChange={setLinkedTaskAssignee}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar asesor" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={linkedTaskType} onValueChange={(v) => setLinkedTaskType(v as TaskType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_KINDS.map((key) => (
                      <SelectItem key={key} value={key}>{taskTypeLabels[key]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={linkedTaskStatus} onValueChange={(v) => setLinkedTaskStatus(v as TaskStatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(taskStatusLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select value={linkedTaskPriority} onValueChange={(v) => setLinkedTaskPriority(v as TaskPriority)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hora estimada</Label>
                <Input type="time" value={linkedTaskTime} onChange={(e) => setLinkedTaskTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fecha de inicio</Label>
                <Input type="date" value={linkedTaskStartDate} onChange={(e) => setLinkedTaskStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fecha límite</Label>
                <Input type="date" value={linkedTaskDueDate} onChange={(e) => setLinkedTaskDueDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLinkedTaskOpen(false); setCompletedTask(null); resetLinkedTaskForm(); }}>
              Cancelar
            </Button>
            <Button className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={async () => {
              if (!linkedTaskTitle.trim()) { toast.error('El título es requerido'); return; }
              const dueDate = linkedTaskDueDate || new Date().toISOString().slice(0, 10);
              if (!contactId && !companyId && !opportunityId) {
                toast.error('No hay contacto, empresa u oportunidad vinculada');
                return;
              }
              try {
                await createActivity({
                  type: 'tarea',
                  taskKind:
                    linkedTaskType && TASK_KINDS.includes(linkedTaskType as TaskKind)
                      ? linkedTaskType
                      : 'llamada',
                  title: linkedTaskTitle.trim(),
                  description: '',
                  assignedTo: linkedTaskAssignee || defaultAssigneeId || activeUsers[0]?.id || '',
                  dueDate,
                  startDate: linkedTaskStartDate || undefined,
                  startTime: linkedTaskTime || undefined,
                  contactId: contactId || undefined,
                  companyId: companyId || undefined,
                  opportunityId: opportunityId || undefined,
                });
                toast.success(`Tarea "${linkedTaskTitle}" creada`);
                setLinkedTaskOpen(false);
                setCompletedTask(null);
                resetLinkedTaskForm();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Error al crear');
              }
            }}>
              Crear tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            const payload: UpdateActivityPayload = {};
            if (nd.title !== oldDetail.title) payload.title = nd.title;
            if (nd.status !== oldDetail.status) {
              payload.status = nd.status;
              if (nd.status === 'completada') {
                payload.completedAt = new Date().toISOString().slice(0, 10);
              }
            }
            if (nd.type !== oldDetail.type) payload.taskKind = nd.type;
            if (nd.dueDate !== oldDetail.dueDate) payload.dueDate = nd.dueDate;
            if (nd.startDate !== oldDetail.startDate) payload.startDate = nd.startDate;
            if (nd.startTime !== oldDetail.startTime) payload.startTime = nd.startTime;
            if (Object.keys(payload).length === 0) continue;
            try {
              await updateActivity(nd.id, payload);
              const becameCompleted =
                oldDetail.status !== 'completada' && nd.status === 'completada';
              if (
                becameCompleted &&
                selectedTask?.id === nd.id &&
                nd.type &&
                TASK_KINDS.includes(nd.type as TaskKind)
              ) {
                setCompletedTask(tasks.find((ta) => ta.id === nd.id) as MockTask);
                setTaskDetailOpen(false);
                setSelectedTask(null);
                setActivityFromTaskOpen(true);
              }
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
