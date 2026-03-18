import { useState } from 'react';
import {
  MessageSquare, Phone, Calendar, Mail, Paperclip, ClipboardList,
  User, Building2, Briefcase, Search, Link2, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCRMStore } from '@/store/crmStore';
import { users, priorityLabels } from '@/data/mock';
import type { Contact, Opportunity } from '@/types';

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

import { ActivityFormDialog } from './ActivityFormDialog';

type TaskStatus = 'pendiente' | 'en_progreso' | 'completada';
type TaskPriority = 'alta' | 'media' | 'baja';
type TaskType = 'llamada' | 'reunion' | 'correo';

export interface QuickTask {
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

export interface TaskAssociation {
  type: 'contacto' | 'empresa' | 'negocio';
  id: string;
  name: string;
}

const taskTypeLabels: Record<TaskType, string> = {
  llamada: 'Llamada',
  reunion: 'Reunión',
  correo: 'Correo',
};

const taskStatusLabels: Record<TaskStatus, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
};

const actions = [
  { type: 'nota', icon: MessageSquare, label: 'Nota' },
  { type: 'llamada', icon: Phone, label: 'Llamada' },
  { type: 'reunion', icon: Calendar, label: 'Reunión' },
  { type: 'correo', icon: Mail, label: 'Correo' },
  { type: 'archivo', icon: Paperclip, label: 'Archivo' },
  { type: 'tarea', icon: ClipboardList, label: 'Tarea' },
];

interface QuickActionsWithDialogsProps {
  entityName: string;
  contacts?: Contact[];
  companies?: { name: string }[];
  opportunities?: Opportunity[];
  onTaskCreated?: (task: QuickTask) => void;
  onActivityCreated?: (activity: { id: string; type: import('@/types').ActivityType; title: string; description: string; assignedTo: string; assignedToName: string; status: import('@/types').ActivityStatus; dueDate: string; createdAt: string; contactId?: string }) => void;
  contactId?: string;
}

export function QuickActionsWithDialogs({
  entityName,
  contacts = [],
  companies = [],
  opportunities = [],
  onTaskCreated,
  onActivityCreated,
  contactId,
}: QuickActionsWithDialogsProps) {
  const { contacts: storeContacts } = useCRMStore();
  const [activeDialog, setActiveDialog] = useState<string | null>(null);

  const [activityDialogType, setActivityDialogType] = useState<'llamada' | 'reunion' | 'correo' | null>(null);

  const [newTask, setNewTask] = useState({
    title: '',
    type: '' as TaskType | '',
    status: 'pendiente' as TaskStatus,
    priority: 'media' as TaskPriority,
    company: '',
    startDate: '',
    dueDate: '',
    startTime: '',
    assignee: '',
  });
  const [taskAssociations, setTaskAssociations] = useState<TaskAssociation[]>([]);
  const [assocPanelOpen, setAssocPanelOpen] = useState(false);
  const [assocSearch, setAssocSearch] = useState('');
  const [assocCategory, setAssocCategory] = useState<'contactos' | 'empresas' | 'negocios'>('contactos');

  function submitQuickAction() {
    if (activeDialog === 'tarea') {
      if (!newTask.title.trim()) {
        toast.error('Ingresa un título para la tarea');
        return;
      }
      const assigneeName = users.find((u) => u.id === newTask.assignee)?.name ?? '';
      const companyFromAssoc = taskAssociations.find((a) => a.type === 'empresa')?.name;
      const task: QuickTask = {
        id: `t${Date.now()}`,
        title: newTask.title,
        status: newTask.status,
        type: (newTask.type || undefined) as TaskType | undefined,
        priority: newTask.priority,
        company: companyFromAssoc ?? (newTask.company || undefined),
        startDate: newTask.startDate || undefined,
        dueDate: newTask.dueDate,
        startTime: newTask.startTime || undefined,
        assignee: assigneeName,
        associations: taskAssociations.length > 0 ? [...taskAssociations] : undefined,
      };
      onTaskCreated?.(task);
      setNewTask({ title: '', type: '', status: 'pendiente', priority: 'media', company: '', startDate: '', dueDate: '', startTime: '', assignee: '' });
      setTaskAssociations([]);
      setAssocPanelOpen(false);
      setAssocSearch('');
      toast.success('Tarea creada');
      setActiveDialog(null);
      return;
    }
    const actionLabels: Record<string, string> = {
      nota: 'Nota agregada',
      archivo: 'Archivo adjuntado',
    };
    toast.success(actionLabels[activeDialog ?? ''] ?? 'Acción completada');
    setActiveDialog(null);
  }

  function handleActivitySave(data: import('./ActivityFormDialog').ActivityFormData) {
    if (!activityDialogType) return;
    const title = data.title || (activityDialogType === 'llamada' ? 'Llamada' : activityDialogType === 'reunion' ? 'Reunión' : 'Correo');
    const dueDate = activityDialogType === 'reunion' && data.dateTime
      ? data.dateTime.slice(0, 10)
      : data.date || new Date().toISOString().slice(0, 10);
    const defaultAssignee = users[0];
    onActivityCreated?.({
      id: `act-${Date.now()}`,
      type: activityDialogType,
      title,
      description: data.description || '',
      assignedTo: defaultAssignee?.id ?? '',
      assignedToName: defaultAssignee?.name ?? '',
      status: 'completada' as import('@/types').ActivityStatus,
      dueDate,
      createdAt: new Date().toISOString().slice(0, 10),
      contactId,
    });
    setActivityDialogType(null);
    setActiveDialog(null);
  }

  const assocContacts = contacts.length > 0 ? contacts : storeContacts;
  const assocCounts = {
    contactos: assocContacts.length,
    empresas: companies.length,
    negocios: opportunities.length,
  };

  return (
    <>
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted/40 p-1.5 border border-border/40">
        {actions.map((a) => (
          <Button
            key={a.type}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (a.type === 'llamada' || a.type === 'reunion' || a.type === 'correo') {
                setActivityDialogType(a.type);
              } else {
                setActiveDialog(a.type);
              }
            }}
          >
            <a.icon className="size-4" /> {a.label}
          </Button>
        ))}
      </div>

      <Dialog open={activeDialog !== null && activeDialog !== 'llamada' && activeDialog !== 'reunion' && activeDialog !== 'correo'} onOpenChange={(open) => { if (!open) setActiveDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activeDialog === 'nota' && 'Agregar Nota'}
              {activeDialog === 'tarea' && 'Crear Tarea'}
              {activeDialog === 'archivo' && 'Adjuntar Archivo'}
            </DialogTitle>
            <DialogDescription>
              {activeDialog === 'nota' && `Agrega una nota sobre ${entityName}.`}
              {activeDialog === 'tarea' && `Crea una tarea relacionada a ${entityName}.`}
              {activeDialog === 'archivo' && `Adjunta un archivo relacionado a ${entityName}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {activeDialog === 'nota' && (
              <div className="space-y-2">
                <Label>Contenido de la nota</Label>
                <Textarea placeholder="Escribe tu nota aquí..." rows={4} />
              </div>
            )}
            {activeDialog === 'tarea' && (
              <>
                <div className="space-y-2">
                  <Label>Título de la tarea</Label>
                  <Input
                    placeholder="¿Qué necesitas hacer?"
                    value={newTask.title}
                    onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <Link2 className="size-3.5" /> Asociaciones
                    </Label>
                    {taskAssociations.length > 0 && (
                      <span className="text-xs text-muted-foreground">{taskAssociations.length} registro{taskAssociations.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>

                  {taskAssociations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {taskAssociations.map((a) => (
                        <Badge key={`${a.type}-${a.id}`} variant="secondary" className="gap-1 pr-1">
                          {a.type === 'contacto' && <User className="size-3" />}
                          {a.type === 'empresa' && <Building2 className="size-3" />}
                          {a.type === 'negocio' && <Briefcase className="size-3" />}
                          <span className="text-xs">{a.name}</span>
                          <button
                            type="button"
                            className="ml-0.5 rounded-sm hover:bg-muted p-0.5"
                            onClick={() => setTaskAssociations((prev) => prev.filter((x) => !(x.type === a.type && x.id === a.id)))}
                          >
                            <span className="text-xs leading-none">&times;</span>
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="relative">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-between text-muted-foreground font-normal"
                      onClick={() => setAssocPanelOpen(!assocPanelOpen)}
                    >
                      Buscar asociaciones
                      <ChevronDown className={`size-4 transition-transform ${assocPanelOpen ? 'rotate-180' : ''}`} />
                    </Button>

                    {assocPanelOpen && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                        <div className="flex border-b">
                          {(['contactos', 'empresas', 'negocios'] as const).map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              className={`flex-1 px-2 py-2 text-xs font-medium capitalize transition-colors ${assocCategory === cat ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                              onClick={() => { setAssocCategory(cat); setAssocSearch(''); }}
                            >
                              {cat} <span className="text-muted-foreground">({assocCounts[cat]})</span>
                            </button>
                          ))}
                        </div>

                        <div className="p-2">
                          <div className="relative mb-2">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                            <Input
                              placeholder="Buscar..."
                              value={assocSearch}
                              onChange={(e) => setAssocSearch(e.target.value)}
                              className="pl-7 h-8 text-sm"
                            />
                          </div>

                          <div className="max-h-36 overflow-y-auto space-y-0.5">
                            {assocCategory === 'contactos' && (
                              assocContacts
                                .filter((l) => l.name.toLowerCase().includes(assocSearch.toLowerCase()))
                                .slice(0, 8)
                                .map((l) => {
                                  const isSelected = taskAssociations.some((a) => a.type === 'contacto' && a.id === l.id);
                                  return (
                                    <button
                                      key={l.id}
                                      type="button"
                                      className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? 'bg-muted' : ''}`}
                                      onClick={() => {
                                        if (isSelected) {
                                          setTaskAssociations((prev) => prev.filter((a) => !(a.type === 'contacto' && a.id === l.id)));
                                        } else {
                                          setTaskAssociations((prev) => [...prev, { type: 'contacto', id: l.id, name: l.name }]);
                                        }
                                      }}
                                    >
                                      <Checkbox checked={isSelected} className="size-3.5" />
                                      <User className="size-3.5 text-muted-foreground" />
                                      <span className="truncate">{l.name}</span>
                                    </button>
                                  );
                                })
                            )}

                            {assocCategory === 'empresas' && (
                              companies
                                .filter((c) => c.name.toLowerCase().includes(assocSearch.toLowerCase()))
                                .map((c) => {
                                  const isSelected = taskAssociations.some((a) => a.type === 'empresa' && a.id === c.name);
                                  return (
                                    <button
                                      key={c.name}
                                      type="button"
                                      className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? 'bg-muted' : ''}`}
                                      onClick={() => {
                                        if (isSelected) {
                                          setTaskAssociations((prev) => prev.filter((a) => !(a.type === 'empresa' && a.id === c.name)));
                                        } else {
                                          setTaskAssociations((prev) => [...prev, { type: 'empresa', id: c.name, name: c.name }]);
                                        }
                                      }}
                                    >
                                      <Checkbox checked={isSelected} className="size-3.5" />
                                      <Building2 className="size-3.5 text-muted-foreground" />
                                      <span className="truncate">{c.name}</span>
                                    </button>
                                  );
                                })
                            )}

                            {assocCategory === 'negocios' && (
                              opportunities
                                .filter((o) => o.title.toLowerCase().includes(assocSearch.toLowerCase()))
                                .map((o) => {
                                  const isSelected = taskAssociations.some((a) => a.type === 'negocio' && a.id === o.id);
                                  return (
                                    <button
                                      key={o.id}
                                      type="button"
                                      className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? 'bg-muted' : ''}`}
                                      onClick={() => {
                                        if (isSelected) {
                                          setTaskAssociations((prev) => prev.filter((a) => !(a.type === 'negocio' && a.id === o.id)));
                                        } else {
                                          setTaskAssociations((prev) => [...prev, { type: 'negocio', id: o.id, name: o.title }]);
                                        }
                                      }}
                                    >
                                      <Checkbox checked={isSelected} className="size-3.5" />
                                      <Briefcase className="size-3.5 text-muted-foreground" />
                                      <span className="truncate">{o.title}</span>
                                    </button>
                                  );
                                })
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label>Asignar a</Label>
                    <Select value={newTask.assignee} onValueChange={(v) => setNewTask((t) => ({ ...t, assignee: v }))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar asesor" /></SelectTrigger>
                      <SelectContent>
                        {users.filter((u) => u.status === 'activo').map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={newTask.type} onValueChange={(v) => setNewTask((t) => ({ ...t, type: v as TaskType }))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(taskTypeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={newTask.status} onValueChange={(v) => setNewTask((t) => ({ ...t, status: v as TaskStatus }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(taskStatusLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Prioridad</Label>
                    <Select value={newTask.priority} onValueChange={(v) => setNewTask((t) => ({ ...t, priority: v as TaskPriority }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(priorityLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Hora estimada</Label>
                    <Input type="time" value={newTask.startTime} onChange={(e) => setNewTask((t) => ({ ...t, startTime: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de inicio</Label>
                    <Input type="date" value={newTask.startDate} onChange={(e) => setNewTask((t) => ({ ...t, startDate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha límite</Label>
                    <Input type="date" value={newTask.dueDate} onChange={(e) => setNewTask((t) => ({ ...t, dueDate: e.target.value }))} />
                  </div>
                </div>
              </>
            )}
            {activeDialog === 'archivo' && (
              <div className="space-y-2">
                <Label>Archivo</Label>
                <Input type="file" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancelar</Button>
            <Button onClick={submitQuickAction}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activityDialogType && (
        <ActivityFormDialog
          type={activityDialogType}
          open={!!activityDialogType}
          onOpenChange={(open) => { if (!open) setActivityDialogType(null); }}
          onSave={handleActivitySave}
        />
      )}
    </>
  );
}
