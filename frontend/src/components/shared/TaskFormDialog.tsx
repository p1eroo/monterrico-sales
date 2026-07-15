import { useState, useEffect } from 'react';
import {
  User, Building2, Briefcase, Search, Link2, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { priorityLabels } from '@/data/mock';
import { canUserReassignCommercialAdvisor, resolveAdvisorAssigneeId } from '@/lib/advisorAssigneeDefaults';
import { useUsers } from '@/hooks/useUsers';
import { useAppStore } from '@/store';
import type { Contact, Opportunity, TaskAssociation, TaskKind } from '@/types';
import { TASK_KINDS } from '@/types';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import {
  FormDialogActions,
  FormDialogField,
  FormDialogGrid,
  FormDialogShell,
  formDialogInputClass,
  formDialogPickerTriggerClass,
  formDialogPopoverContentClass,
  formDialogSelectTriggerClass,
} from '@/components/ui/form-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export type TaskFormStatus = 'pendiente' | 'completada' | 'en_progreso' | 'vencida';
export type TaskFormPriority = 'alta' | 'media' | 'baja';
export type TaskFormType = TaskKind;

export interface TaskFormResult {
  title: string;
  /** Tipo de tarea obligatorio al guardar */
  type: TaskFormType;
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
  whatsapp: 'WhatsApp',
};

const taskStatusLabels: Record<TaskFormStatus, string> = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  en_progreso: 'En progreso',
  vencida: 'Vencida',
};

/** Estados elegibles al crear una tarea (vencida la asigna el sistema). */
const taskCreateStatusOptions = (
  Object.entries(taskStatusLabels) as [TaskFormStatus, string][]
).filter(([key]) => key !== 'vencida');

/** Filas visibles por pestaña al abrir el buscador; el resto se alcanza filtrando por texto. */
const ASSOCIATION_PICKER_PAGE_SIZE = 8;

export interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  contacts: Contact[];
  /** Si `id` existe (API), se usa para companyId al crear la tarea; si no, se usa el nombre como antes. */
  companies: { name: string; id?: string }[];
  opportunities: Opportunity[];
  defaultAssigneeId?: string;
  defaultTitle?: string;
  /** Estado inicial al abrir (p. ej. columna Kanban desde la que se creó la tarea). */
  defaultStatus?: TaskFormStatus;
  /** Fecha de tarea predefinida (p. ej. día seleccionado en calendario). */
  defaultStartDate?: string;
  /** Vínculos prellenados (p. ej. tarea de seguimiento tras completar otra). */
  defaultAssociations?: TaskAssociation[];
  onSave: (task: TaskFormResult) => void | Promise<void>;
  /**
   * Si es true, no espera al API: cierra y muestra éxito al instante (creación optimista en el store).
   * En otras pantallas debe ser false para esperar `onSave` (p. ej. Calendario).
   */
  optimisticClose?: boolean;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  title = 'Crear Tarea',
  description = 'Registra una nueva tarea.',
  contacts,
  companies,
  opportunities,
  defaultAssigneeId = '',
  defaultTitle = '',
  defaultStatus,
  defaultStartDate,
  defaultAssociations,
  onSave,
  optimisticClose = false,
}: TaskFormDialogProps) {
  const { users, activeAdvisors } = useUsers();
  const currentUser = useAppStore((s) => s.currentUser);
  const canReassign = canUserReassignCommercialAdvisor(currentUser.role);

  function resolveDefaultAssignee() {
    return resolveAdvisorAssigneeId(defaultAssigneeId, currentUser);
  }

  function getDefaultDueDate() {
    if (defaultStartDate) return defaultStartDate;
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }

  const [formTitle, setFormTitle] = useState(defaultTitle);
  const [formType, setFormType] = useState<TaskFormType | ''>('');
  const [formStatus, setFormStatus] = useState<TaskFormStatus>('pendiente');
  const [formPriority, setFormPriority] = useState<TaskFormPriority>('media');
  const [formAssignee, setFormAssignee] = useState(resolveDefaultAssignee);
  const [formStartTime, setFormStartTime] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [associations, setAssociations] = useState<TaskAssociation[]>([]);
  const [assocPanelOpen, setAssocPanelOpen] = useState(false);
  const [assocSearch, setAssocSearch] = useState('');
  const [assocCategory, setAssocCategory] = useState<'contactos' | 'empresas' | 'negocios'>('contactos');

  useEffect(() => {
    if (open) {
      setFormTitle(defaultTitle);
      setFormStatus(defaultStatus && defaultStatus !== 'vencida' ? defaultStatus : 'pendiente');
      setFormDueDate(getDefaultDueDate());
      setAssociations(
        defaultAssociations?.length ? defaultAssociations.map((a) => ({ ...a })) : [],
      );
      setFormAssignee(resolveDefaultAssignee());
    }
  }, [open, defaultTitle, defaultStatus, defaultStartDate, defaultAssociations, defaultAssigneeId, canReassign, currentUser.id]);

  const assocCounts = {
    contactos: contacts.length,
    empresas: companies.length,
    negocios: opportunities.length,
  };

  function resetForm() {
    setFormTitle('');
    setFormType('');
    setFormStatus(defaultStatus && defaultStatus !== 'vencida' ? defaultStatus : 'pendiente');
    setFormPriority('media');
    setFormAssignee(resolveDefaultAssignee());
    setFormStartTime('');
    setFormDueDate(getDefaultDueDate());
    setAssociations([]);
    setAssocPanelOpen(false);
    setAssocSearch('');
  }

  async function handleSave() {
    if (!formTitle.trim()) {
      toast.error('Ingresa un título para la tarea');
      return;
    }
    if (!formType) {
      toast.error('Selecciona el tipo de tarea');
      return;
    }
    if (associations.length === 0) {
      toast.error('Debes vincular la tarea a al menos un contacto, empresa u oportunidad');
      return;
    }
    if (!formDueDate.trim()) {
      toast.error('Selecciona la fecha de tarea');
      return;
    }
    const assigneeId = formAssignee.trim() || resolveDefaultAssignee();
    const assigneeUser =
      users.find((u) => u.id === assigneeId) ??
      activeAdvisors.find((u) => u.id === assigneeId) ??
      (assigneeId === currentUser.id ? { id: currentUser.id, name: currentUser.name } : undefined);
    const assigneeName = assigneeUser?.name ?? 'Sin asignar';
    const payload: TaskFormResult = {
      title: formTitle.trim(),
      type: formType,
      status: formStatus,
      priority: formPriority,
      assignee: assigneeId,
      assigneeName,
      startTime: formStartTime || undefined,
      dueDate: formDueDate,
      associations: [...associations],
    };
    try {
      const result = onSave(payload);
      if (result instanceof Promise) {
        if (optimisticClose) {
          void result.catch(() => {
            /* el padre hace toast al fallar (p. ej. Tareas) */
          });
        } else {
          await result;
        }
      }
    } catch {
      return;
    }
    resetForm();
    onOpenChange(false);
    toast.success('Tarea creada');
  }

  function handleOpenChange(o: boolean) {
    if (!o) resetForm();
    onOpenChange(o);
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      footer={(
        <FormDialogActions
          onCancel={() => handleOpenChange(false)}
          onSubmit={() => void handleSave()}
        />
      )}
    >
      <div className="space-y-6">
        <FormDialogField label="Título de la tarea" required>
          <Input
            className={formDialogInputClass}
            placeholder="¿Qué necesitas hacer?"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />
        </FormDialogField>

        <FormDialogField
          label={(
            <span className="inline-flex items-center gap-1.5">
              <Link2 className="size-3.5 text-muted-foreground" />
              Asociaciones
            </span>
          )}
          required
          compactControl={false}
          hint={associations.length > 0
            ? `${associations.length} registro${associations.length !== 1 ? 's' : ''} vinculado${associations.length !== 1 ? 's' : ''}`
            : 'Vincula la tarea a un contacto, empresa u oportunidad'}
        >
          {associations.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-1">
              {associations.map((a) => (
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
                    onClick={() => setAssociations((prev) => prev.filter((x) => !(x.type === a.type && x.id === a.id)))}
                  >
                    <span className="text-xs leading-none text-muted-foreground">&times;</span>
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <Popover open={assocPanelOpen} onOpenChange={setAssocPanelOpen} modal={false}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={formDialogPickerTriggerClass}
              >
                Buscar asociaciones
                <ChevronDown className={`size-4 text-muted-foreground transition-transform ${assocPanelOpen ? 'rotate-180' : ''}`} />
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
                {(['contactos', 'empresas', 'negocios'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`flex-1 px-3 py-2.5 text-xs font-semibold capitalize transition-colors ${assocCategory === cat ? 'border-b-2 border-[#13944C] text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => { setAssocCategory(cat); setAssocSearch(''); }}
                  >
                    {cat} <span className="font-normal text-muted-foreground">({assocCounts[cat]})</span>
                  </button>
                ))}
              </div>

              <div className="p-3">
                <div className="relative mb-3">
                  <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={assocSearch}
                    onChange={(e) => setAssocSearch(e.target.value)}
                    className={`${formDialogInputClass} h-10 pl-9 text-sm`}
                  />
                </div>

                <div className="max-h-52 space-y-0.5 overflow-y-auto">
                  {assocCategory === 'contactos' &&
                    contacts
                      .filter((l) => l.name.toLowerCase().includes(assocSearch.toLowerCase()))
                      .slice(0, ASSOCIATION_PICKER_PAGE_SIZE)
                      .map((l) => {
                        const isSelected = associations.some((a) => a.type === 'contacto' && a.id === l.id);
                        return (
                          <button
                            key={l.id}
                            type="button"
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/60 ${isSelected ? 'bg-muted/50' : ''}`}
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
                      .slice(0, ASSOCIATION_PICKER_PAGE_SIZE)
                      .map((c) => {
                        const rowId = c.id ?? c.name;
                        const isSelected = associations.some((a) => a.type === 'empresa' && a.id === rowId);
                        return (
                          <button
                            key={rowId}
                            type="button"
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/60 ${isSelected ? 'bg-muted/50' : ''}`}
                            onClick={() => {
                              if (isSelected) {
                                setAssociations((prev) => prev.filter((a) => !(a.type === 'empresa' && a.id === rowId)));
                              } else {
                                setAssociations((prev) => [...prev, { type: 'empresa', id: rowId, name: c.name }]);
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
                      .slice(0, ASSOCIATION_PICKER_PAGE_SIZE)
                      .map((o) => {
                        const isSelected = associations.some((a) => a.type === 'negocio' && a.id === o.id);
                        return (
                          <button
                            key={o.id}
                            type="button"
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/60 ${isSelected ? 'bg-muted/50' : ''}`}
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
            </PopoverContent>
          </Popover>
        </FormDialogField>

        <FormDialogGrid>
          <FormDialogField label="Fecha de tarea" required>
            <Input
              type="date"
              className={formDialogInputClass}
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
            />
          </FormDialogField>
          <FormDialogField label="Tipo" required>
            <Select value={formType} onValueChange={(v) => setFormType(v as TaskFormType)}>
              <SelectTrigger className={formDialogSelectTriggerClass}>
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {TASK_KINDS.map((key) => (
                  <SelectItem key={key} value={key}>{taskTypeLabels[key]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormDialogField>
          <FormDialogField label="Hora estimada">
            <Input
              type="time"
              className={formDialogInputClass}
              value={formStartTime}
              onChange={(e) => setFormStartTime(e.target.value)}
            />
          </FormDialogField>
          <FormDialogField label="Estado">
            <Select value={formStatus} onValueChange={(v) => setFormStatus(v as TaskFormStatus)}>
              <SelectTrigger className={formDialogSelectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {taskCreateStatusOptions.map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormDialogField>
          <FormDialogField label="Prioridad">
            <Select value={formPriority} onValueChange={(v) => setFormPriority(v as TaskFormPriority)}>
              <SelectTrigger className={formDialogSelectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(priorityLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormDialogField>
          <AssignedAdvisorFormField
            htmlId="task-form-assignee"
            value={formAssignee}
            onChange={setFormAssignee}
            disabled={!canReassign}
            fallbackName={currentUser.name}
            label="Asignado"
            formStyle
          />
        </FormDialogGrid>
      </div>
    </FormDialogShell>
  );
}
