import { useState, forwardRef, useImperativeHandle } from 'react';
import {
  CheckSquare, User, Building2, Briefcase,
  CalendarDays, Calendar, Clock, Edit, Trash2, Send,
  MessageCircle, Search, Link2, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { users, priorityLabels } from '@/data/mock';
import type { Lead, Opportunity } from '@/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

type TaskStatus = 'pendiente' | 'en_progreso' | 'completada';
type TaskPriority = 'alta' | 'media' | 'baja';
type TaskType = 'llamada' | 'reunion' | 'correo';

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
  en_progreso: 'En progreso',
  completada: 'Completada',
};

const taskStatusColors: Record<TaskStatus, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  en_progreso: 'bg-blue-100 text-blue-700',
  completada: 'bg-emerald-100 text-emerald-700',
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
};

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = ['bg-emerald-100 text-emerald-700', 'bg-blue-100 text-blue-700', 'bg-amber-100 text-amber-700', 'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
}

interface TasksTabProps {
  contacts?: Lead[];
  companies?: { name: string }[];
  opportunities?: Opportunity[];
  defaultAssigneeId?: string;
  initialTasks?: MockTask[];
  initialComments?: TaskComment[];
  onActivityCreated?: (activity: { id: string; type: string; title: string; description: string; assignedTo: string; assignedToName: string; status: string; dueDate: string; createdAt: string; leadId?: string }) => void;
  leadId?: string;
}

const defaultInitialTasks: MockTask[] = [
  { id: 't1', title: 'Enviar propuesta comercial actualizada', status: 'completada', type: 'correo', priority: 'alta', company: 'Minera Los Andes', startDate: '2026-03-03', dueDate: '2026-03-05', startTime: '09:00', assignee: 'Carlos Mendoza', associations: [{ type: 'empresa', id: 'minera', name: 'Minera Los Andes' }] },
  { id: 't2', title: 'Coordinar visita a la flota ejecutiva', status: 'pendiente', type: 'reunion', priority: 'media', company: 'Hotel Libertador', startDate: '2026-03-06', dueDate: '2026-03-08', startTime: '14:00', assignee: 'José Ramírez', associations: [{ type: 'empresa', id: 'hotel', name: 'Hotel Libertador' }, { type: 'contacto', id: 'c1', name: 'Roberto Sánchez' }] },
  { id: 't3', title: 'Preparar contrato borrador', status: 'pendiente', type: 'correo', priority: 'media', startDate: '2026-03-08', dueDate: '2026-03-10', startTime: '10:00', assignee: 'María García' },
  { id: 't4', title: 'Confirmar disponibilidad de vehículos', status: 'en_progreso', type: 'llamada', priority: 'baja', startDate: '2026-03-05', dueDate: '2026-03-07', startTime: '11:30', assignee: 'Ana Torres' },
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
  leadId,
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
  const [taskEditMode, setTaskEditMode] = useState(false);
  const [taskEditForm, setTaskEditForm] = useState<MockTask | null>(null);
  const [taskComments, setTaskComments] = useState<TaskComment[]>(initialComments);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentsVisible, setCommentsVisible] = useState(true);
  const [editAssociations, setEditAssociations] = useState<TaskAssociation[]>([]);
  const [editAssocPanelOpen, setEditAssocPanelOpen] = useState(false);
  const [editAssocSearch, setEditAssocSearch] = useState('');
  const [editAssocCategory, setEditAssocCategory] = useState<'contactos' | 'empresas' | 'negocios'>('contactos');

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

  const assocCounts = {
    contactos: contacts.length,
    empresas: companies.length,
    negocios: opportunities.length,
  };

  return (
    <>
      <Card className="pt-2">
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Tarea</TableHead>
                <TableHead className="hidden md:table-cell">Empresa</TableHead>
                <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                <TableHead className="hidden lg:table-cell">Prioridad</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead className="hidden md:table-cell">Fecha</TableHead>
                <TableHead className="text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedTask(task); setTaskDetailOpen(true); setTaskEditMode(false); setTaskEditForm(null); setNewCommentText(''); }}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={task.status === 'completada'}
                      onCheckedChange={() => handleTaskToggle(task.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm font-medium ${task.status === 'completada' ? 'line-through text-muted-foreground' : ''}`}>
                      {task.title}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{task.company ?? '—'}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {task.type ? (
                      <Badge variant="outline" className="text-xs">{taskTypeLabels[task.type]}</Badge>
                    ) : '—'}
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
              ))}
              {tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No hay tareas registradas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {completedTask?.type && activityFromTaskOpen && (
        <ActivityFormDialog
          type={completedTask.type}
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
              leadId,
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
      <Dialog open={taskDetailOpen} onOpenChange={(open) => { setTaskDetailOpen(open); if (!open) { setSelectedTask(null); setTaskEditMode(false); setTaskEditForm(null); setNewCommentText(''); } }}>
        <DialogContent className="max-w-lg">
          {selectedTask && !taskEditMode && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckSquare className="size-5 text-amber-600" />
                  <span className={selectedTask.status === 'completada' ? 'line-through text-muted-foreground' : ''}>
                    {selectedTask.title}
                  </span>
                </DialogTitle>
                <DialogDescription>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge className={`text-xs border-0 ${taskStatusColors[selectedTask.status]}`}>
                      {taskStatusLabels[selectedTask.status]}
                    </Badge>
                    <Badge className={`text-xs border-0 ${taskPriorityColors[selectedTask.priority]}`}>
                      {priorityLabels[selectedTask.priority]}
                    </Badge>
                    {selectedTask.type && (
                      <Badge variant="outline" className="text-xs">{taskTypeLabels[selectedTask.type]}</Badge>
                    )}
                  </div>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="flex items-center gap-2.5 rounded-lg border p-3">
                  <User className="size-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Responsable</p>
                    <p className="text-sm font-medium truncate">{selectedTask.assignee}</p>
                  </div>
                </div>

                {(selectedTask.associations ?? []).length > 0 && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Link2 className="size-3.5" /> Asociado con {selectedTask.associations!.length} registro{selectedTask.associations!.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTask.associations!.map((a) => (
                        <Badge key={`${a.type}-${a.id}`} variant="secondary" className="gap-1">
                          {a.type === 'contacto' && <User className="size-3" />}
                          {a.type === 'empresa' && <Building2 className="size-3" />}
                          {a.type === 'negocio' && <Briefcase className="size-3" />}
                          <span className="text-xs">{a.name}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-3 grid-cols-3">
                  {selectedTask.startDate && (
                    <div className="flex items-center gap-2.5 rounded-lg border p-3">
                      <Calendar className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Inicio</p>
                        <p className="text-sm font-medium">{formatDate(selectedTask.startDate)}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 rounded-lg border p-3">
                    <CalendarDays className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Fecha límite</p>
                      <p className="text-sm font-medium">{formatDate(selectedTask.dueDate)}</p>
                    </div>
                  </div>
                  {selectedTask.startTime && (
                    <div className="flex items-center gap-2.5 rounded-lg border p-3">
                      <Clock className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Hora</p>
                        <p className="text-sm font-medium">{selectedTask.startTime}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t pt-3">
                  <h4 className="text-sm font-medium mb-2">Cambiar estado</h4>
                  <div className="flex gap-2">
                    {(Object.entries(taskStatusLabels) as [TaskStatus, string][]).map(([key, label]) => (
                      <Button
                        key={key}
                        variant={selectedTask.status === key ? 'default' : 'outline'}
                        size="sm"
                        className={selectedTask.status === key ? `border-0 ${taskStatusColors[key]}` : ''}
                        onClick={() => {
                          setTasks((prev) => prev.map((t) => t.id === selectedTask.id ? { ...t, status: key } : t));
                          setSelectedTask({ ...selectedTask, status: key });
                          if (key === 'completada') {
                            toast.success('Tarea completada');
                            if (selectedTask.type) {
                              setCompletedTask(selectedTask);
                              setTaskDetailOpen(false);
                              setSelectedTask(null);
                              setActivityFromTaskOpen(true);
                            }
                          }
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-3">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline mb-2"
                    onClick={() => setCommentsVisible(!commentsVisible)}
                  >
                    <MessageCircle className="size-4" />
                    {commentsVisible ? 'Ocultar comentarios' : 'Mostrar comentarios'}
                    <span className="text-xs text-muted-foreground">
                      ({taskComments.filter((c) => c.taskId === selectedTask.id).length})
                    </span>
                  </button>

                  {commentsVisible && (
                    <div className="space-y-3">
                      {taskComments
                        .filter((c) => c.taskId === selectedTask.id)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((comment) => (
                          <div key={comment.id} className="flex gap-3 group">
                            <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarColor(comment.author)}`}>
                              {getInitials(comment.author)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium">{comment.author}</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">{formatDateTime(comment.date)}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="size-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                    onClick={() => {
                                      setTaskComments((prev) => prev.filter((c) => c.id !== comment.id));
                                      toast.success('Comentario eliminado');
                                    }}
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">{comment.text}</p>
                            </div>
                          </div>
                        ))}

                      {taskComments.filter((c) => c.taskId === selectedTask.id).length === 0 && (
                        <p className="text-sm text-muted-foreground py-1">Sin comentarios aún.</p>
                      )}

                      <div className="flex gap-2 pt-1">
                        <Textarea
                          placeholder="Escribe un comentario..."
                          rows={2}
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          className="text-sm resize-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (!newCommentText.trim()) return;
                              const comment: TaskComment = {
                                id: `tc-${Date.now()}`,
                                taskId: selectedTask.id,
                                author: selectedTask.assignee,
                                text: newCommentText.trim(),
                                date: new Date().toISOString(),
                              };
                              setTaskComments((prev) => [...prev, comment]);
                              setNewCommentText('');
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="shrink-0 self-end bg-[#13944C] hover:bg-[#0f7a3d]"
                          disabled={!newCommentText.trim()}
                          onClick={() => {
                            if (!newCommentText.trim()) return;
                            const comment: TaskComment = {
                              id: `tc-${Date.now()}`,
                              taskId: selectedTask.id,
                              author: selectedTask.assignee,
                              text: newCommentText.trim(),
                              date: new Date().toISOString(),
                            };
                            setTaskComments((prev) => [...prev, comment]);
                            setNewCommentText('');
                            toast.success('Comentario agregado');
                          }}
                        >
                          <Send className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-row gap-2 sm:justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));
                    setTaskDetailOpen(false);
                    setSelectedTask(null);
                    toast.success('Tarea eliminada');
                  }}
                >
                  <Trash2 className="size-4" /> Eliminar
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setTaskEditMode(true); setTaskEditForm({ ...selectedTask }); setEditAssociations([...(selectedTask.associations ?? [])]); }}>
                    <Edit className="size-4" /> Editar
                  </Button>
                  <Button variant="outline" onClick={() => { setTaskDetailOpen(false); setSelectedTask(null); }}>
                    Cerrar
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}

          {taskEditForm && taskEditMode && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Edit className="size-5 text-blue-600" /> Editar Tarea
                </DialogTitle>
                <DialogDescription>Modifica los campos que necesites actualizar.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Título de la tarea</Label>
                  <Input
                    value={taskEditForm.title}
                    onChange={(e) => setTaskEditForm({ ...taskEditForm, title: e.target.value })}
                    placeholder="¿Qué necesitas hacer?"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <Link2 className="size-3.5" /> Asociaciones
                    </Label>
                    {editAssociations.length > 0 && (
                      <span className="text-xs text-muted-foreground">{editAssociations.length} registro{editAssociations.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {editAssociations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {editAssociations.map((a) => (
                        <Badge key={`${a.type}-${a.id}`} variant="secondary" className="gap-1 pr-1">
                          {a.type === 'contacto' && <User className="size-3" />}
                          {a.type === 'empresa' && <Building2 className="size-3" />}
                          {a.type === 'negocio' && <Briefcase className="size-3" />}
                          <span className="text-xs">{a.name}</span>
                          <button type="button" className="ml-0.5 rounded-sm hover:bg-muted p-0.5" onClick={() => setEditAssociations((prev) => prev.filter((x) => !(x.type === a.type && x.id === a.id)))}>
                            <span className="text-xs leading-none">&times;</span>
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <Button type="button" variant="outline" size="sm" className="w-full justify-between text-muted-foreground font-normal" onClick={() => setEditAssocPanelOpen(!editAssocPanelOpen)}>
                      Buscar asociaciones
                      <ChevronDown className={`size-4 transition-transform ${editAssocPanelOpen ? 'rotate-180' : ''}`} />
                    </Button>
                    {editAssocPanelOpen && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                        <div className="flex border-b">
                          {(['contactos', 'empresas', 'negocios'] as const).map((cat) => (
                            <button key={cat} type="button" className={`flex-1 px-2 py-2 text-xs font-medium capitalize transition-colors ${editAssocCategory === cat ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => { setEditAssocCategory(cat); setEditAssocSearch(''); }}>
                              {cat} ({assocCounts[cat]})
                            </button>
                          ))}
                        </div>
                        <div className="p-2">
                          <div className="relative mb-2">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                            <Input placeholder="Buscar..." value={editAssocSearch} onChange={(e) => setEditAssocSearch(e.target.value)} className="pl-7 h-8 text-sm" />
                          </div>
                          <div className="max-h-36 overflow-y-auto space-y-0.5">
                            {editAssocCategory === 'contactos' && contacts.filter((l) => l.name.toLowerCase().includes(editAssocSearch.toLowerCase())).slice(0, 8).map((l) => {
                              const isSelected = editAssociations.some((a) => a.type === 'contacto' && a.id === l.id);
                              return (<button key={l.id} type="button" className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? 'bg-muted' : ''}`} onClick={() => { if (isSelected) { setEditAssociations((prev) => prev.filter((a) => !(a.type === 'contacto' && a.id === l.id))); } else { setEditAssociations((prev) => [...prev, { type: 'contacto', id: l.id, name: l.name }]); } }}><Checkbox checked={isSelected} className="size-3.5" /><User className="size-3.5 text-muted-foreground" /><span className="truncate">{l.name}</span></button>);
                            })}
                            {editAssocCategory === 'empresas' && companies.filter((c) => c.name.toLowerCase().includes(editAssocSearch.toLowerCase())).map((c) => {
                              const isSelected = editAssociations.some((a) => a.type === 'empresa' && a.id === c.name);
                              return (<button key={c.name} type="button" className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? 'bg-muted' : ''}`} onClick={() => { if (isSelected) { setEditAssociations((prev) => prev.filter((a) => !(a.type === 'empresa' && a.id === c.name))); } else { setEditAssociations((prev) => [...prev, { type: 'empresa', id: c.name, name: c.name }]); } }}><Checkbox checked={isSelected} className="size-3.5" /><Building2 className="size-3.5 text-muted-foreground" /><span className="truncate">{c.name}</span></button>);
                            })}
                            {editAssocCategory === 'negocios' && opportunities.filter((o) => o.title.toLowerCase().includes(editAssocSearch.toLowerCase())).map((o) => {
                              const isSelected = editAssociations.some((a) => a.type === 'negocio' && a.id === o.id);
                              return (<button key={o.id} type="button" className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? 'bg-muted' : ''}`} onClick={() => { if (isSelected) { setEditAssociations((prev) => prev.filter((a) => !(a.type === 'negocio' && a.id === o.id))); } else { setEditAssociations((prev) => [...prev, { type: 'negocio', id: o.id, name: o.title }]); } }}><Checkbox checked={isSelected} className="size-3.5" /><Briefcase className="size-3.5 text-muted-foreground" /><span className="truncate">{o.title}</span></button>);
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label>Asignar a</Label>
                    <Select value={users.find((u) => u.name === taskEditForm.assignee)?.id ?? ''} onValueChange={(v) => { const u = users.find((usr) => usr.id === v); if (u) setTaskEditForm({ ...taskEditForm, assignee: u.name }); }}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar asesor" /></SelectTrigger>
                      <SelectContent>{users.filter((u) => u.status === 'activo').map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={taskEditForm.type ?? ''} onValueChange={(v) => setTaskEditForm({ ...taskEditForm, type: v as TaskType })}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                      <SelectContent>{Object.entries(taskTypeLabels).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={taskEditForm.status} onValueChange={(v) => setTaskEditForm({ ...taskEditForm, status: v as TaskStatus })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(taskStatusLabels).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Prioridad</Label>
                    <Select value={taskEditForm.priority} onValueChange={(v) => setTaskEditForm({ ...taskEditForm, priority: v as TaskPriority })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(priorityLabels).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Hora estimada</Label>
                    <Input type="time" value={taskEditForm.startTime ?? ''} onChange={(e) => setTaskEditForm({ ...taskEditForm, startTime: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de inicio</Label>
                    <Input type="date" value={taskEditForm.startDate ?? ''} onChange={(e) => setTaskEditForm({ ...taskEditForm, startDate: e.target.value })} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Fecha límite</Label>
                    <Input type="date" value={taskEditForm.dueDate} onChange={(e) => setTaskEditForm({ ...taskEditForm, dueDate: e.target.value })} />
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-row gap-2 sm:justify-end">
                <Button variant="outline" onClick={() => { setTaskEditMode(false); setTaskEditForm(null); }}>
                  Cancelar
                </Button>
                <Button className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={() => {
                  if (!taskEditForm.title.trim()) { toast.error('El título es requerido'); return; }
                  const companyFromAssoc = editAssociations.find((a) => a.type === 'empresa')?.name;
                  const updated = { ...taskEditForm, associations: editAssociations.length > 0 ? [...editAssociations] : undefined, company: companyFromAssoc ?? taskEditForm.company };
                  setTasks((prev) => prev.map((t) => t.id === taskEditForm.id ? updated : t));
                  setSelectedTask(updated);
                  setTaskEditMode(false);
                  setTaskEditForm(null);
                  setEditAssocPanelOpen(false);
                  setEditAssocSearch('');
                  toast.success('Tarea actualizada');
                }}>
                  Guardar cambios
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
});
