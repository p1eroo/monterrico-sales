import { useState, forwardRef, useImperativeHandle } from 'react';
import { CheckSquare, Phone, Mail, Users } from 'lucide-react';
import { toast } from 'sonner';
import { users, priorityLabels } from '@/data/mock';
import type { Contact, Opportunity } from '@/types';

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

import { ActivityFormDialog } from './ActivityFormDialog';
import { TaskDetailDialog, type TaskDetailTask, type TaskComment as TaskDetailComment } from './TaskDetailDialog';

type TaskStatus = 'pendiente' | 'completada' | 'en_progreso' | 'vencida';
type TaskPriority = 'alta' | 'media' | 'baja';
type TaskType = 'llamada' | 'reunion' | 'correo' | 'tarea';

interface TaskComment {
  id: string;
  taskId: string;
  author: string;
  text: string;
  date: string;
}

interface TaskAssociation {
  type: 'contacto' | 'empresa' | 'negocio';
  id: string;
  name: string;
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
  tarea: 'Tarea',
};

const taskTypeIcons: Record<TaskType, typeof Phone> = {
  llamada: Phone,
  reunion: Users,
  correo: Mail,
  tarea: CheckSquare,
};

const taskTypeIconColors: Record<TaskType, string> = {
  llamada: 'bg-blue-100 text-blue-600',
  reunion: 'bg-purple-100 text-purple-600',
  correo: 'bg-amber-100 text-amber-600',
  tarea: 'bg-emerald-100 text-emerald-600',
};

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface TasksTabProps {
  contacts?: Contact[];
  companies?: { name: string }[];
  opportunities?: Opportunity[];
  defaultAssigneeId?: string;
  initialTasks?: MockTask[];
  initialComments?: TaskComment[];
  onActivityCreated?: (activity: { id: string; type: string; title: string; description: string; assignedTo: string; assignedToName: string; status: string; dueDate: string; createdAt: string; contactId?: string }) => void;
  contactId?: string;
}

const defaultInitialTasks: MockTask[] = [
  { id: 't1', title: 'Enviar propuesta comercial actualizada', status: 'completada', type: 'correo', priority: 'alta', company: 'Minera Los Andes', startDate: '2026-03-03', dueDate: '2026-03-05', startTime: '09:00', assignee: 'Carlos Mendoza', associations: [{ type: 'empresa', id: 'minera', name: 'Minera Los Andes' }, { type: 'contacto', id: 'l1', name: 'Pedro Castillo' }] },
  { id: 't2', title: 'Coordinar visita a la flota ejecutiva', status: 'pendiente', type: 'reunion', priority: 'media', company: 'Hotel Libertador', startDate: '2026-03-06', dueDate: '2026-03-08', startTime: '14:00', assignee: 'José Ramírez', associations: [{ type: 'empresa', id: 'hotel', name: 'Hotel Libertador' }, { type: 'contacto', id: 'c1', name: 'Roberto Sánchez' }] },
  { id: 't3', title: 'Preparar contrato borrador', status: 'pendiente', type: 'correo', priority: 'media', startDate: '2026-03-08', dueDate: '2026-03-10', startTime: '10:00', assignee: 'María García', associations: [{ type: 'contacto', id: 'l6', name: 'Patricia Huamán' }] },
  { id: 't4', title: 'Confirmar disponibilidad de vehículos', status: 'en_progreso', type: 'llamada', priority: 'baja', startDate: '2026-03-05', dueDate: '2026-03-07', startTime: '11:30', assignee: 'Ana Torres', associations: [{ type: 'empresa', id: 'telefonica', name: 'Telefónica' }, { type: 'contacto', id: 'l9', name: 'Diego Sánchez' }] },
];

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
  initialTasks = defaultInitialTasks,
  initialComments = defaultInitialComments,
  onActivityCreated,
  contactId,
}, ref) {
  const [tasks, setTasks] = useState<MockTask[]>(initialTasks);

  useImperativeHandle(ref, () => ({
    addTask: (task) => {
      setTasks((prev) => [...prev, task as MockTask]);
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

  function handleTaskToggle(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (task.status === 'completada') {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'pendiente' as TaskStatus } : t));
      return;
    }

    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'completada' as TaskStatus } : t));
    toast.success('Tarea completada');

    if (task.type) {
      setCompletedTask(task);
      setActivityFromTaskOpen(true);
    }
  }

  return (
    <>
      <Card className="pt-2">
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead>Tarea</TableHead>
                <TableHead className="hidden md:table-cell">Empresa</TableHead>
                <TableHead className="hidden md:table-cell">Contacto</TableHead>
                <TableHead className="hidden lg:table-cell">Prioridad</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead className="hidden md:table-cell">Fecha</TableHead>
                <TableHead className="text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const taskType = (['llamada', 'reunion', 'correo', 'tarea'].includes(task.type ?? '') ? task.type : 'tarea') as TaskType;
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
                    <span className={`text-sm font-medium ${task.status === 'completada' ? 'line-through text-muted-foreground' : ''}`}>
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

      {completedTask && ['llamada', 'reunion', 'correo'].includes(completedTask.type ?? '') && activityFromTaskOpen && (
        <ActivityFormDialog
          type={completedTask.type as 'llamada' | 'reunion' | 'correo'}
          open={activityFromTaskOpen}
          onOpenChange={(open) => { setActivityFromTaskOpen(open); if (!open) setCompletedTask(null); }}
          onSave={(data) => {
            const title = data.title || completedTask.title;
            const dueDate = completedTask.type === 'reunion' && data.dateTime
              ? data.dateTime.slice(0, 10)
              : data.date || new Date().toISOString().slice(0, 10);
            const assignee = users[0];
            onActivityCreated?.({
              id: `act-${Date.now()}`,
              type: completedTask.type!,
              title,
              description: data.description || '',
              assignedTo: assignee?.id ?? '',
              assignedToName: assignee?.name ?? '',
              status: 'completada',
              dueDate,
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
            <DialogTitle>Crear tarea de seguimiento</DialogTitle>
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
              Crea una tarea de seguimiento para continuar con el proceso.
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
                    {users.filter((u) => u.status === 'activo').map((u) => (
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
                    {Object.entries(taskTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
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
            <Button className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={() => {
              if (!linkedTaskTitle.trim()) { toast.error('El título es requerido'); return; }
              const assignee = users.find((u) => u.id === linkedTaskAssignee)?.name ?? 'Sin asignar';
              const newTask: MockTask = {
                id: `t-${Date.now()}`,
                title: linkedTaskTitle.trim(),
                status: linkedTaskStatus,
                type: linkedTaskType || undefined,
                priority: linkedTaskPriority,
                dueDate: linkedTaskDueDate || new Date().toISOString().slice(0, 10),
                startDate: linkedTaskStartDate || undefined,
                startTime: linkedTaskTime || undefined,
                assignee,
              };
              setTasks((prev) => [...prev, newTask]);
              toast.success(`Tarea "${linkedTaskTitle}" creada exitosamente`);
              setLinkedTaskOpen(false);
              setCompletedTask(null);
              resetLinkedTaskForm();
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
        tasks={tasks as TaskDetailTask[]}
        onTasksChange={(tasks) => setTasks(tasks as MockTask[])}
        taskComments={taskComments as TaskDetailComment[]}
        onTaskCommentsChange={(comments) => setTaskComments(comments as TaskComment[])}
        contacts={contacts}
        companies={companies}
        opportunities={opportunities}
        onCompleteWithActivity={(t) => {
          setCompletedTask(t as MockTask);
          setTaskDetailOpen(false);
          setSelectedTask(null);
          setActivityFromTaskOpen(true);
        }}
      />
    </>
  );
});
