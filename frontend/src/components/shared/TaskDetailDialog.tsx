import { useState } from 'react';
import {
  CheckSquare, User, Building2, Briefcase,
  CalendarDays, Calendar, Clock, Edit, Trash2, Send,
  MessageCircle, Search, Link2, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { priorityLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import type { Contact, Opportunity, TaskAssociation, TaskKind } from '@/types';
import { TASK_KINDS } from '@/types';

import { Button } from '@/components/ui/button';
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
import { formatDate, formatDateTime } from '@/lib/formatters';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

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

const ASSOCIATION_PICKER_PAGE_SIZE = 8;

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = ['bg-emerald-100 text-emerald-700', 'bg-blue-100 text-blue-700', 'bg-amber-100 text-amber-700', 'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
}

export interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskDetailTask | null;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  tasks: TaskDetailTask[];
  onTasksChange: (tasks: TaskDetailTask[]) => void;
  taskComments: TaskComment[];
  onTaskCommentsChange: (comments: TaskComment[]) => void;
  contacts?: Contact[];
  companies?: { name: string }[];
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
  const [newCommentText, setNewCommentText] = useState('');
  const [commentsVisible, setCommentsVisible] = useState(true);
  const [editAssociations, setEditAssociations] = useState<TaskAssociation[]>([]);
  const [editAssocPanelOpen, setEditAssocPanelOpen] = useState(false);
  const [editAssocSearch, setEditAssocSearch] = useState('');
  const [editAssocCategory, setEditAssocCategory] = useState<'contactos' | 'empresas' | 'negocios'>('contactos');
  const [deleteTaskConfirmOpen, setDeleteTaskConfirmOpen] = useState(false);

  const assocCounts = {
    contactos: contacts.length,
    empresas: companies.length,
    negocios: opportunities.length,
  };

  function handleClose() {
    onOpenChange(false);
    setTaskEditMode(false);
    setTaskEditForm(null);
    setNewCommentText('');
    setDeleteTaskConfirmOpen(false);
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

  const statusKeys = Object.keys(statusLabels);

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">
        {task && !taskEditMode && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckSquare className="size-5 text-amber-600" />
                <span className={task.status === 'completada' ? 'line-through text-muted-foreground' : ''}>
                  {task.title}
                </span>
              </DialogTitle>
              <DialogDescription>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {statusLabels[task.status] && (
                    <Badge className={`text-xs border-0 ${statusColors[task.status] ?? 'bg-slate-100 text-slate-700'}`}>
                      {statusLabels[task.status]}
                    </Badge>
                  )}
                  {task.priority && priorityLabels[task.priority] && (
                    <Badge className={`text-xs border-0 ${
                      task.priority === 'alta' ? 'bg-red-100 text-red-700' :
                      task.priority === 'media' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {priorityLabels[task.priority]}
                    </Badge>
                  )}
                  {task.type && (
                    <Badge variant="outline" className="text-xs">{taskTypeLabels[task.type]}</Badge>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2.5 rounded-lg border p-3">
                <User className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Responsable</p>
                  <p className="text-sm font-medium truncate">{task.assignee}</p>
                </div>
              </div>

              {(task.associations ?? []).length > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Link2 className="size-3.5" /> Asociado con {task.associations!.length} registro{task.associations!.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {task.associations!.map((a) => (
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
                {task.startDate && (
                  <div className="flex items-center gap-2.5 rounded-lg border p-3">
                    <Calendar className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Inicio</p>
                      <p className="text-sm font-medium">{formatDate(task.startDate)}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2.5 rounded-lg border p-3">
                  <CalendarDays className="size-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Fecha límite</p>
                    <p className="text-sm font-medium">{formatDate(task.dueDate)}</p>
                  </div>
                </div>
                {task.startTime && (
                  <div className="flex items-center gap-2.5 rounded-lg border p-3">
                    <Clock className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Hora</p>
                      <p className="text-sm font-medium">{task.startTime}</p>
                    </div>
                  </div>
                )}
              </div>

              {task.status === 'completada' && task.description && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground mb-1.5">Resumen</p>
                  <p className="text-sm whitespace-pre-wrap">{task.description}</p>
                </div>
              )}

              <div className="border-t pt-3">
                <h4 className="text-sm font-medium mb-2">Cambiar estado</h4>
                <div className="flex flex-wrap gap-2">
                  {statusKeys.map((key) => (
                    <Button
                      key={key}
                      variant={task.status === key ? 'default' : 'outline'}
                      size="sm"
                      className={task.status === key ? `border-0 ${statusColors[key] ?? ''}` : ''}
                      onClick={() => handleStatusChange(key)}
                    >
                      {statusLabels[key]}
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
                    ({taskComments.filter((c) => c.taskId === task.id).length})
                  </span>
                </button>

                {commentsVisible && (
                  <div className="space-y-3">
                    {taskComments
                      .filter((c) => c.taskId === task.id)
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
                                    onTaskCommentsChange(taskComments.filter((c) => c.id !== comment.id));
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

                    {taskComments.filter((c) => c.taskId === task.id).length === 0 && (
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
                              taskId: task.id,
                              author: task.assignee,
                              text: newCommentText.trim(),
                              date: new Date().toISOString(),
                            };
                            onTaskCommentsChange([...taskComments, comment]);
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
                            taskId: task.id,
                            author: task.assignee,
                            text: newCommentText.trim(),
                            date: new Date().toISOString(),
                          };
                          onTaskCommentsChange([...taskComments, comment]);
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
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteTaskConfirmOpen(true)}
              >
                <Trash2 className="size-4" /> Eliminar
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTaskEditMode(true);
                    setTaskEditForm({ ...task });
                    setEditAssociations([...(task.associations ?? [])]);
                  }}
                >
                  <Edit className="size-4" /> Editar
                </Button>
                <Button variant="outline" onClick={() => handleClose()}>
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
                          {editAssocCategory === 'contactos' && contacts.filter((l) => l.name.toLowerCase().includes(editAssocSearch.toLowerCase())).slice(0, ASSOCIATION_PICKER_PAGE_SIZE).map((l) => {
                            const isSelected = editAssociations.some((a) => a.type === 'contacto' && a.id === l.id);
                            return (<button key={l.id} type="button" className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? 'bg-muted' : ''}`} onClick={() => { if (isSelected) { setEditAssociations((prev) => prev.filter((a) => !(a.type === 'contacto' && a.id === l.id))); } else { setEditAssociations((prev) => [...prev, { type: 'contacto' as const, id: l.id, name: l.name }]); } }}><Checkbox checked={isSelected} className="size-3.5" /><User className="size-3.5 text-muted-foreground" /><span className="truncate">{l.name}</span></button>);
                          })}
                          {editAssocCategory === 'empresas' && companies.filter((c) => c.name.toLowerCase().includes(editAssocSearch.toLowerCase())).slice(0, ASSOCIATION_PICKER_PAGE_SIZE).map((c) => {
                            const isSelected = editAssociations.some((a) => a.type === 'empresa' && a.id === c.name);
                            return (<button key={c.name} type="button" className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? 'bg-muted' : ''}`} onClick={() => { if (isSelected) { setEditAssociations((prev) => prev.filter((a) => !(a.type === 'empresa' && a.id === c.name))); } else { setEditAssociations((prev) => [...prev, { type: 'empresa' as const, id: c.name, name: c.name }]); } }}><Checkbox checked={isSelected} className="size-3.5" /><Building2 className="size-3.5 text-muted-foreground" /><span className="truncate">{c.name}</span></button>);
                          })}
                          {editAssocCategory === 'negocios' && opportunities.filter((o) => o.title.toLowerCase().includes(editAssocSearch.toLowerCase())).slice(0, ASSOCIATION_PICKER_PAGE_SIZE).map((o) => {
                            const isSelected = editAssociations.some((a) => a.type === 'negocio' && a.id === o.id);
                            return (<button key={o.id} type="button" className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? 'bg-muted' : ''}`} onClick={() => { if (isSelected) { setEditAssociations((prev) => prev.filter((a) => !(a.type === 'negocio' && a.id === o.id))); } else { setEditAssociations((prev) => [...prev, { type: 'negocio' as const, id: o.id, name: o.title }]); } }}><Checkbox checked={isSelected} className="size-3.5" /><Briefcase className="size-3.5 text-muted-foreground" /><span className="truncate">{o.title}</span></button>);
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
                    <SelectContent>{activeAdvisors.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={taskEditForm.type ?? ''} onValueChange={(v) => setTaskEditForm({ ...taskEditForm, type: v as TaskDetailType })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                    <SelectContent>{TASK_KINDS.map((key) => (<SelectItem key={key} value={key}>{taskTypeLabels[key]}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={taskEditForm.status} onValueChange={(v) => setTaskEditForm({ ...taskEditForm, status: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{statusKeys.map((key) => (<SelectItem key={key} value={key}>{statusLabels[key]}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                {taskEditForm.priority !== undefined && (
                  <div className="space-y-2">
                    <Label>Prioridad</Label>
                    <Select value={taskEditForm.priority} onValueChange={(v) => setTaskEditForm({ ...taskEditForm, priority: v as TaskDetailPriority })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(priorityLabels).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                )}
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
              <Button variant="outline" onClick={() => { setTaskEditMode(false); setTaskEditForm(null); setEditAssocPanelOpen(false); setEditAssocSearch(''); }}>
                Cancelar
              </Button>
              <Button className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={() => {
                if (!taskEditForm.title.trim()) { toast.error('El título es requerido'); return; }
                const companyFromAssoc = editAssociations.find((a) => a.type === 'empresa')?.name;
                const updated: TaskDetailTask = { ...taskEditForm, associations: editAssociations.length > 0 ? [...editAssociations] : undefined, company: companyFromAssoc ?? taskEditForm.company };
                onTasksChange(tasks.map((t) => (t.id === taskEditForm.id ? updated : t)));
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
    />
    </>
  );
}
