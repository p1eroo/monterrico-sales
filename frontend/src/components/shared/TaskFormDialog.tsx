import { useState, useEffect } from 'react';
import {
  User, Building2, Briefcase, Search, Link2, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { priorityLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import type { Contact, Opportunity, TaskAssociation } from '@/types';

import { Button } from '@/components/ui/button';
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

export type TaskFormStatus = 'pendiente' | 'completada' | 'en_progreso' | 'vencida';
export type TaskFormPriority = 'alta' | 'media' | 'baja';
export type TaskFormType = 'llamada' | 'reunion' | 'correo' | 'tarea';

export interface TaskFormResult {
  title: string;
  type?: TaskFormType;
  status: TaskFormStatus;
  priority: TaskFormPriority;
  assignee: string;
  assigneeName: string;
  startDate?: string;
  startTime?: string;
  dueDate: string;
  associations?: TaskAssociation[];
}

const taskTypeLabels: Record<TaskFormType, string> = {
  llamada: 'Llamada',
  reunion: 'Reunión',
  correo: 'Correo',
  tarea: 'Tarea',
};

const taskStatusLabels: Record<TaskFormStatus, string> = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  en_progreso: 'En progreso',
  vencida: 'Vencida',
};

export interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  contacts: Contact[];
  companies: { name: string }[];
  opportunities: Opportunity[];
  defaultAssigneeId?: string;
  defaultTitle?: string;
  onSave: (task: TaskFormResult) => void | Promise<void>;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  title = 'Crear Tarea',
  description = 'Crea una nueva tarea.',
  contacts,
  companies,
  opportunities,
  defaultAssigneeId = '',
  defaultTitle = '',
  onSave,
}: TaskFormDialogProps) {
  const { users, activeUsers } = useUsers();
  const today = new Date().toISOString().slice(0, 10);
  const [formTitle, setFormTitle] = useState(defaultTitle);

  useEffect(() => {
    if (open) setFormTitle(defaultTitle);
  }, [open, defaultTitle]);

  const [formType, setFormType] = useState<TaskFormType | ''>('');
  const [formStatus, setFormStatus] = useState<TaskFormStatus>('pendiente');
  const [formPriority, setFormPriority] = useState<TaskFormPriority>('media');
  const [formAssignee, setFormAssignee] = useState(defaultAssigneeId);
  const [formStartTime, setFormStartTime] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formDueDate, setFormDueDate] = useState(today);
  const [associations, setAssociations] = useState<TaskAssociation[]>([]);
  const [assocPanelOpen, setAssocPanelOpen] = useState(false);
  const [assocSearch, setAssocSearch] = useState('');
  const [assocCategory, setAssocCategory] = useState<'contactos' | 'empresas' | 'negocios'>('contactos');

  const assocCounts = {
    contactos: contacts.length,
    empresas: companies.length,
    negocios: opportunities.length,
  };

  function resetForm() {
    setFormTitle('');
    setFormType('');
    setFormStatus('pendiente');
    setFormPriority('media');
    setFormAssignee(defaultAssigneeId);
    setFormStartTime('');
    setFormStartDate('');
    setFormDueDate(today);
    setAssociations([]);
    setAssocPanelOpen(false);
    setAssocSearch('');
  }

  async function handleSave() {
    if (!formTitle.trim()) {
      toast.error('Ingresa un título para la tarea');
      return;
    }
    const assigneeUser = users.find((u) => u.id === formAssignee);
    const assigneeName = assigneeUser?.name ?? 'Sin asignar';
    const result = onSave({
      title: formTitle.trim(),
      type: formType || undefined,
      status: formStatus,
      priority: formPriority,
      assignee: formAssignee,
      assigneeName,
      startDate: formStartDate || undefined,
      startTime: formStartTime || undefined,
      dueDate: formDueDate,
      associations: associations.length > 0 ? [...associations] : undefined,
    });
    await (result instanceof Promise ? result : Promise.resolve());
    resetForm();
    onOpenChange(false);
    toast.success('Tarea creada');
  }

  function handleOpenChange(o: boolean) {
    if (!o) resetForm();
    onOpenChange(o);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título de la tarea *</Label>
            <Input
              placeholder="¿Qué necesitas hacer?"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Link2 className="size-3.5" /> Asociaciones
              </Label>
              {associations.length > 0 && (
                <span className="text-xs text-muted-foreground">{associations.length} registro{associations.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {associations.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {associations.map((a) => (
                  <Badge key={`${a.type}-${a.id}`} variant="secondary" className="gap-1 pr-1">
                    {a.type === 'contacto' && <User className="size-3" />}
                    {a.type === 'empresa' && <Building2 className="size-3" />}
                    {a.type === 'negocio' && <Briefcase className="size-3" />}
                    <span className="text-xs">{a.name}</span>
                    <button
                      type="button"
                      className="ml-0.5 rounded-sm hover:bg-muted p-0.5"
                      onClick={() => setAssociations((prev) => prev.filter((x) => !(x.type === a.type && x.id === a.id)))}
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
                      {assocCategory === 'contactos' &&
                        contacts
                          .filter((l) => l.name.toLowerCase().includes(assocSearch.toLowerCase()))
                          .slice(0, 8)
                          .map((l) => {
                            const isSelected = associations.some((a) => a.type === 'contacto' && a.id === l.id);
                            return (
                              <button
                                key={l.id}
                                type="button"
                                className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? 'bg-muted' : ''}`}
                                onClick={() => {
                                  if (isSelected) {
                                    setAssociations((prev) => prev.filter((a) => !(a.type === 'contacto' && a.id === l.id)));
                                  } else {
                                    setAssociations((prev) => [...prev, { type: 'contacto', id: l.id, name: l.name }]);
                                  }
                                }}
                              >
                                <Checkbox checked={isSelected} className="size-3.5" />
                                <User className="size-3.5 text-muted-foreground" />
                                <span className="truncate">{l.name}</span>
                              </button>
                            );
                          })}

                      {assocCategory === 'empresas' &&
                        companies
                          .filter((c) => c.name.toLowerCase().includes(assocSearch.toLowerCase()))
                          .map((c) => {
                            const isSelected = associations.some((a) => a.type === 'empresa' && a.id === c.name);
                            return (
                              <button
                                key={c.name}
                                type="button"
                                className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? 'bg-muted' : ''}`}
                                onClick={() => {
                                  if (isSelected) {
                                    setAssociations((prev) => prev.filter((a) => !(a.type === 'empresa' && a.id === c.name)));
                                  } else {
                                    setAssociations((prev) => [...prev, { type: 'empresa', id: c.name, name: c.name }]);
                                  }
                                }}
                              >
                                <Checkbox checked={isSelected} className="size-3.5" />
                                <Building2 className="size-3.5 text-muted-foreground" />
                                <span className="truncate">{c.name}</span>
                              </button>
                            );
                          })}

                      {assocCategory === 'negocios' &&
                        opportunities
                          .filter((o) => o.title.toLowerCase().includes(assocSearch.toLowerCase()))
                          .map((o) => {
                            const isSelected = associations.some((a) => a.type === 'negocio' && a.id === o.id);
                            return (
                              <button
                                key={o.id}
                                type="button"
                                className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? 'bg-muted' : ''}`}
                                onClick={() => {
                                  if (isSelected) {
                                    setAssociations((prev) => prev.filter((a) => !(a.type === 'negocio' && a.id === o.id)));
                                  } else {
                                    setAssociations((prev) => [...prev, { type: 'negocio', id: o.id, name: o.title }]);
                                  }
                                }}
                              >
                                <Checkbox checked={isSelected} className="size-3.5" />
                                <Briefcase className="size-3.5 text-muted-foreground" />
                                <span className="truncate">{o.title}</span>
                              </button>
                            );
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
              <Select value={formAssignee} onValueChange={setFormAssignee}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar asesor" /></SelectTrigger>
                <SelectContent>
                  {activeUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as TaskFormType)}>
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
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as TaskFormStatus)}>
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
              <Select value={formPriority} onValueChange={(v) => setFormPriority(v as TaskFormPriority)}>
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
              <Input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de inicio</Label>
              <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fecha límite</Label>
              <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
