import { useState, useEffect, useMemo } from 'react';
import {
  User, Building2, Briefcase, Search, Link2, ChevronDown, Loader2,
} from 'lucide-react';
import { toast } from '@/lib/notify';
import { priorityLabels } from '@/data/mock';
import {
  canUserReassignCommercialAdvisor,
  resolveAdvisorAssigneeIdWithFallback,
} from '@/lib/advisorAssigneeDefaults';
import { useUsers } from '@/hooks/useUsers';
import { useAppStore } from '@/store';
import { mergeCompaniesForTaskPicker } from '@/lib/taskAssociationsFromActivity';
import { isLikelyCompanyCuid } from '@/lib/companyApi';
import { contactListPaginated, mapApiContactRowToContact } from '@/lib/contactApi';
import { opportunityListPaginated, mapApiOpportunityToOpportunity } from '@/lib/opportunityApi';
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

const LINKED_ENTITY_FETCH_LIMIT = 500;

function resolveSelectedCompanyId(associations: TaskAssociation[]): string | undefined {
  const empresa = associations.find(
    (a) => a.type === 'empresa' && a.id && isLikelyCompanyCuid(a.id),
  );
  return empresa?.id;
}

function contactBelongsToCompany(
  contact: Contact,
  companyId: string,
  companyName?: string,
): boolean {
  return (
    contact.companies?.some(
      (c) =>
        (c.id && c.id === companyId) ||
        (companyName && c.name.toLowerCase() === companyName.toLowerCase()),
    ) ?? false
  );
}

function opportunityBelongsToCompany(opp: Opportunity, companyId: string): boolean {
  if (opp.linkedCompanyIds?.includes(companyId)) return true;
  return opp.clientId === companyId;
}

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
    return resolveAdvisorAssigneeIdWithFallback(
      defaultAssigneeId,
      currentUser,
      activeAdvisors[0]?.id,
    );
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
  const [assocCategory, setAssocCategory] = useState<'contactos' | 'empresas' | 'negocios'>('empresas');
  const [linkedContacts, setLinkedContacts] = useState<Contact[]>([]);
  const [linkedOpportunities, setLinkedOpportunities] = useState<Opportunity[]>([]);
  const [linkedLoading, setLinkedLoading] = useState(false);

  const selectedCompanyId = useMemo(
    () => resolveSelectedCompanyId(associations),
    [associations],
  );

  const selectedCompanyName = useMemo(
    () => associations.find((a) => a.type === 'empresa' && a.id === selectedCompanyId)?.name,
    [associations, selectedCompanyId],
  );

  useEffect(() => {
    if (open) {
      setFormTitle(defaultTitle);
      setFormStatus(defaultStatus && defaultStatus !== 'vencida' ? defaultStatus : 'pendiente');
      setFormDueDate(getDefaultDueDate());
      setAssociations(
        defaultAssociations?.length ? defaultAssociations.map((a) => ({ ...a })) : [],
      );
      setFormAssignee(resolveDefaultAssignee());
      const hasCompany = defaultAssociations?.some(
        (a) => a.type === 'empresa' && a.id && isLikelyCompanyCuid(a.id),
      );
      setAssocCategory(hasCompany ? 'contactos' : 'empresas');
    }
  }, [open, defaultTitle, defaultStatus, defaultStartDate, defaultAssociations, defaultAssigneeId, canReassign, currentUser.id, activeAdvisors]);

  useEffect(() => {
    if (!open || !selectedCompanyId) {
      setLinkedContacts([]);
      setLinkedOpportunities([]);
      setLinkedLoading(false);
      return;
    }

    let cancelled = false;
    setLinkedLoading(true);

    Promise.all([
      contactListPaginated({
        linkedToCompanyId: selectedCompanyId,
        limit: LINKED_ENTITY_FETCH_LIMIT,
        page: 1,
      }),
      opportunityListPaginated({
        linkedToCompanyId: selectedCompanyId,
        limit: LINKED_ENTITY_FETCH_LIMIT,
        page: 1,
      }),
    ])
      .then(([contactRes, oppRes]) => {
        if (cancelled) return;
        setLinkedContacts(contactRes.data.map(mapApiContactRowToContact));
        setLinkedOpportunities(oppRes.data.map(mapApiOpportunityToOpportunity));
      })
      .catch(() => {
        if (cancelled) return;
        setLinkedContacts([]);
        setLinkedOpportunities([]);
        toast.error('No se pudieron cargar contactos u oportunidades vinculados');
      })
      .finally(() => {
        if (!cancelled) setLinkedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId || linkedLoading) return;

    const contactIds = new Set(linkedContacts.map((c) => c.id));
    const oppIds = new Set(linkedOpportunities.map((o) => o.id));

    setAssociations((prev) => {
      const next = prev.filter((a) => {
        if (a.type === 'contacto') return contactIds.has(a.id);
        if (a.type === 'negocio') return oppIds.has(a.id);
        return true;
      });
      return next.length === prev.length ? prev : next;
    });
  }, [selectedCompanyId, linkedContacts, linkedOpportunities, linkedLoading]);

  const pickerCompanies = useMemo(
    () => mergeCompaniesForTaskPicker(companies, [
      ...(defaultAssociations ?? []),
      ...associations,
    ]),
    [companies, defaultAssociations, associations],
  );

  const pickerContacts = useMemo((): Contact[] => {
    if (selectedCompanyId) return linkedContacts;
    const empresa = associations.find((a) => a.type === 'empresa');
    if (empresa && !isLikelyCompanyCuid(empresa.id)) {
      return contacts.filter((c) => contactBelongsToCompany(c, empresa.id, empresa.name));
    }
    return contacts;
  }, [selectedCompanyId, linkedContacts, associations, contacts]);

  const pickerOpportunities = useMemo((): Opportunity[] => {
    if (selectedCompanyId) return linkedOpportunities;
    const empresa = associations.find((a) => a.type === 'empresa');
    if (empresa && !isLikelyCompanyCuid(empresa.id)) {
      return opportunities.filter((o) =>
        opportunityBelongsToCompany(o, empresa.id) ||
        (empresa.name && o.clientName?.toLowerCase() === empresa.name.toLowerCase()),
      );
    }
    return opportunities;
  }, [selectedCompanyId, linkedOpportunities, associations, opportunities]);

  const usesLinkedFetch = Boolean(selectedCompanyId);

  const assocCounts = {
    contactos: pickerContacts.length,
    empresas: pickerCompanies.length,
    negocios: pickerOpportunities.length,
  };

  const filteredPickerContacts = useMemo(
    () =>
      pickerContacts.filter((l) =>
        l.name.toLowerCase().includes(assocSearch.toLowerCase()),
      ),
    [pickerContacts, assocSearch],
  );

  const filteredPickerOpportunities = useMemo(
    () =>
      pickerOpportunities.filter((o) =>
        o.title.toLowerCase().includes(assocSearch.toLowerCase()),
      ),
    [pickerOpportunities, assocSearch],
  );

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
    setAssocCategory('empresas');
    setLinkedContacts([]);
    setLinkedOpportunities([]);
    setLinkedLoading(false);
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
    const assigneeId = resolveAdvisorAssigneeIdWithFallback(
      formAssignee || defaultAssigneeId,
      currentUser,
      activeAdvisors[0]?.id,
    );
    if (!assigneeId) {
      toast.error('No hay asesor disponible para asignar la tarea');
      return;
    }
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
                    onClick={() => {
                      if (a.type === 'empresa') {
                        setAssociations((prev) =>
                          prev.filter(
                            (x) =>
                              x.type !== 'empresa' &&
                              x.type !== 'contacto' &&
                              x.type !== 'negocio',
                          ),
                        );
                      } else {
                        setAssociations((prev) =>
                          prev.filter((x) => !(x.type === a.type && x.id === a.id)),
                        );
                      }
                    }}
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
                  {assocCategory === 'contactos' && !usesLinkedFetch && pickerContacts.length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      Selecciona una empresa para ver sus contactos vinculados.
                    </p>
                  )}
                  {assocCategory === 'contactos' && usesLinkedFetch && linkedLoading && (
                    <div className="flex items-center justify-center gap-2 px-2 py-6 text-xs text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Cargando contactos…
                    </div>
                  )}
                  {assocCategory === 'contactos' &&
                    !linkedLoading &&
                    filteredPickerContacts
                      .slice(0, ASSOCIATION_PICKER_PAGE_SIZE)
                      .map((l) => {
                        const isSelected = associations.some((a) => a.type === 'contacto' && a.id === l.id);
                        return (
                          <label
                            key={l.id}
                            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/60 ${isSelected ? 'bg-muted/50' : ''}`}
                          >
                            <Checkbox
                              checked={isSelected}
                              className="size-3.5 shrink-0"
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setAssociations((prev) => [
                                    ...prev,
                                    { type: 'contacto', id: l.id, name: l.name },
                                  ]);
                                } else {
                                  setAssociations((prev) =>
                                    prev.filter((a) => !(a.type === 'contacto' && a.id === l.id)),
                                  );
                                }
                              }}
                            />
                            <User className="size-3.5 text-muted-foreground" />
                            <span className="truncate">{l.name}</span>
                          </label>
                        );
                      })}
                  {assocCategory === 'contactos' &&
                    !linkedLoading &&
                    usesLinkedFetch &&
                    filteredPickerContacts.length === 0 && (
                      <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                        {selectedCompanyName
                          ? `No hay contactos vinculados a ${selectedCompanyName}.`
                          : 'No hay contactos vinculados a esta empresa.'}
                      </p>
                    )}

                  {assocCategory === 'empresas' &&
                    pickerCompanies
                      .filter((c) => c.name.toLowerCase().includes(assocSearch.toLowerCase()))
                      .slice(0, ASSOCIATION_PICKER_PAGE_SIZE)
                      .map((c) => {
                        const rowId = c.id ?? c.name;
                        const isSelected = associations.some((a) => a.type === 'empresa' && a.id === rowId);
                        return (
                          <label
                            key={rowId}
                            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/60 ${isSelected ? 'bg-muted/50' : ''}`}
                          >
                            <Checkbox
                              checked={isSelected}
                              className="size-3.5 shrink-0"
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setAssociations((prev) => {
                                    const withoutLinked = prev.filter(
                                      (a) =>
                                        a.type !== 'empresa' &&
                                        a.type !== 'contacto' &&
                                        a.type !== 'negocio',
                                    );
                                    return [...withoutLinked, { type: 'empresa', id: rowId, name: c.name }];
                                  });
                                  setAssocCategory('contactos');
                                  setAssocSearch('');
                                } else {
                                  setAssociations((prev) =>
                                    prev.filter(
                                      (a) =>
                                        !(a.type === 'empresa' && a.id === rowId) &&
                                        a.type !== 'contacto' &&
                                        a.type !== 'negocio',
                                    ),
                                  );
                                }
                              }}
                            />
                            <Building2 className="size-3.5 text-muted-foreground" />
                            <span className="truncate">{c.name}</span>
                          </label>
                        );
                      })}

                  {assocCategory === 'negocios' && !usesLinkedFetch && pickerOpportunities.length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      Selecciona una empresa para ver sus negocios vinculados.
                    </p>
                  )}
                  {assocCategory === 'negocios' && usesLinkedFetch && linkedLoading && (
                    <div className="flex items-center justify-center gap-2 px-2 py-6 text-xs text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Cargando negocios…
                    </div>
                  )}
                  {assocCategory === 'negocios' &&
                    !linkedLoading &&
                    filteredPickerOpportunities
                      .slice(0, ASSOCIATION_PICKER_PAGE_SIZE)
                      .map((o) => {
                        const isSelected = associations.some((a) => a.type === 'negocio' && a.id === o.id);
                        return (
                          <label
                            key={o.id}
                            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/60 ${isSelected ? 'bg-muted/50' : ''}`}
                          >
                            <Checkbox
                              checked={isSelected}
                              className="size-3.5 shrink-0"
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setAssociations((prev) => [
                                    ...prev,
                                    { type: 'negocio', id: o.id, name: o.title },
                                  ]);
                                } else {
                                  setAssociations((prev) =>
                                    prev.filter((a) => !(a.type === 'negocio' && a.id === o.id)),
                                  );
                                }
                              }}
                            />
                            <Briefcase className="size-3.5 text-muted-foreground" />
                            <span className="truncate">{o.title}</span>
                          </label>
                        );
                      })}
                  {assocCategory === 'negocios' &&
                    !linkedLoading &&
                    usesLinkedFetch &&
                    filteredPickerOpportunities.length === 0 && (
                      <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                        {selectedCompanyName
                          ? `No hay negocios vinculados a ${selectedCompanyName}.`
                          : 'No hay negocios vinculados a esta empresa.'}
                      </p>
                    )}
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
