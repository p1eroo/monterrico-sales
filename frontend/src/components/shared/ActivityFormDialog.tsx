import { useState, useEffect, useMemo } from 'react';
import { User, Building2, Briefcase, Plus, Loader2, ChevronDown, Check, Search } from 'lucide-react';
import { toast } from '@/lib/notify';
import type { ActivityType, ActivityStatus, CallGoalInfo, TaskAssociation } from '@/types';
import { formatNowPeruTimeHHmm, formatTodayPeruYmd } from '@/lib/formatters';
import { isLikelyCompanyCuid } from '@/lib/companyApi';
import { NewContactWizard, type NewContactData } from '@/components/shared/NewContactWizard';
import { createContactFromWizardForCompany } from '@/lib/createContactFromWizard';
import { activityTypeSvgIcon } from '@/lib/activityTypeSvgIcons';
import { showCallGoalToast } from '@/lib/callGoalToast';

import { ActivityTypeFormFields, type ActivityFormFieldsData } from '@/components/shared/ActivityTypeFormFields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FormDialogActions,
  FormDialogShell,
  formDialogInputClass,
  formDialogPopoverContentClass,
  formDialogScrollListClass,
  DISMISS_BLOCKER_ATTR,
} from '@/components/ui/form-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type ActivityFormData = ActivityFormFieldsData;

export interface ActivityFormSaveMeta {
  extraContactIds?: string[];
}

export type ActivityFormSaveResult = {
  callGoal?: CallGoalInfo;
};

export interface ActivityResult {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  assignedTo: string;
  assignedToName: string;
  status: ActivityStatus;
  dueDate: string;
  createdAt: string;
  contactId?: string;
}

function createEmptyForm(): ActivityFormData {
  return {
    title: '',
    description: '',
    date: formatTodayPeruYmd(),
    time: formatNowPeruTimeHHmm(),
    duration: '',
    result: '',
    dateTime: '',
    meetingType: '',
  };
}

interface TaskSummary {
  title: string;
  company?: string;
  assignee: string;
  dueDate?: string;
  startTime?: string;
  linkBadges?: Pick<TaskAssociation, 'type' | 'name'>[];
}

export type RegisterLinkPlanEntity = {
  action: 'create' | 'link' | 'skip';
  name: string;
};

export type RegisterLinkPlan = {
  emailSubject: string;
  assignee: string;
  email: string;
  loading?: boolean;
  excluded?: boolean;
  contact: RegisterLinkPlanEntity;
  company: RegisterLinkPlanEntity;
  opportunity: RegisterLinkPlanEntity;
};

export type RegisterCarteraEmpresaOption = {
  id: string;
  empresa: string;
  email?: string | null;
  ruc?: string | null;
  suggested?: boolean;
  reason?: string;
};

export type RegisterCarteraPlan = {
  emailSubject: string;
  assignee: string;
  email: string;
  domain: string;
  loading?: boolean;
  empresas: RegisterCarteraEmpresaOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

interface ActivityFormDialogProps {
  type: 'llamada' | 'reunion' | 'correo' | 'whatsapp';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    data: ActivityFormData,
    meta?: ActivityFormSaveMeta,
  ) => void | Promise<void | ActivityFormSaveResult>;
  taskSummary?: TaskSummary;
  registerLinkPlan?: RegisterLinkPlan;
  registerCarteraPlan?: RegisterCarteraPlan;
  dialogDescription?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultDate?: string;
  defaultTime?: string;
  showSkip?: boolean;
  /** Empresa vinculada a la tarea; habilita crear contacto sin salir del flujo. */
  linkedCompanyId?: string;
  linkedCompanyName?: string;
  defaultAssigneeId?: string;
}

const typeConfig = {
  llamada: { icon: activityTypeSvgIcon('llamada'), color: 'text-emerald-600', label: 'Llamada', labelFem: 'a' },
  reunion: { icon: activityTypeSvgIcon('reunion'), color: 'text-blue-600', label: 'Reunión', labelFem: 'a' },
  correo: { icon: activityTypeSvgIcon('correo'), color: 'text-slate-600', label: 'Correo', labelFem: 'o' },
  whatsapp: { icon: activityTypeSvgIcon('whatsapp'), color: 'text-green-600', label: 'WhatsApp', labelFem: 'o' },
};

export function ActivityFormDialog({
  type,
  open,
  onOpenChange,
  onSave,
  taskSummary,
  registerLinkPlan,
  registerCarteraPlan,
  dialogDescription,
  defaultTitle = '',
  defaultDescription = '',
  defaultDate,
  defaultTime,
  showSkip = false,
  linkedCompanyId,
  linkedCompanyName,
  defaultAssigneeId = '',
}: ActivityFormDialogProps) {
  const [form, setForm] = useState<ActivityFormData>(() => {
    const base = createEmptyForm();
    const time = defaultTime ?? base.time;
    return {
      ...base,
      title: defaultTitle,
      description: defaultDescription,
      date: defaultDate ?? base.date,
      time,
      dateTime: defaultDate ? `${defaultDate}T${time}` : '',
    };
  });

  useEffect(() => {
    if (!open) return;
    const base = createEmptyForm();
    const time = defaultTime ?? base.time;
    setForm({
      ...base,
      title: defaultTitle,
      description: defaultDescription,
      date: defaultDate ?? base.date,
      time,
      dateTime: defaultDate ? `${defaultDate}T${time}` : '',
    });
  }, [open, defaultTitle, defaultDescription, defaultDate, defaultTime]);

  const config = typeConfig[type];
  const Icon = config.icon;
  const [saving, setSaving] = useState(false);
  const [newContactWizardOpen, setNewContactWizardOpen] = useState(false);
  const [creatingContact, setCreatingContact] = useState(false);
  const [extraContactIds, setExtraContactIds] = useState<string[]>([]);
  const [extraLinkBadges, setExtraLinkBadges] = useState<Pick<TaskAssociation, 'type' | 'name'>[]>([]);
  const [carteraPickerOpen, setCarteraPickerOpen] = useState(false);
  const [carteraSearch, setCarteraSearch] = useState('');

  const selectedCarteraEmpresa = registerCarteraPlan?.empresas.find(
    (e) => e.id === registerCarteraPlan.selectedId,
  );
  const sortedCarteraEmpresas = useMemo(() => {
    const list = registerCarteraPlan?.empresas ?? [];
    const q = carteraSearch.trim().toLowerCase();
    const filtered = q
      ? list.filter((row) =>
          `${row.empresa} ${row.email ?? ''} ${row.ruc ?? ''}`
            .toLowerCase()
            .includes(q),
        )
      : list;
    return [...filtered].sort((a, b) => {
      if (a.suggested === b.suggested) return a.empresa.localeCompare(b.empresa, 'es');
      return a.suggested ? -1 : 1;
    });
  }, [registerCarteraPlan?.empresas, carteraSearch]);

  const canCreateLinkedContact = Boolean(
    linkedCompanyId && isLikelyCompanyCuid(linkedCompanyId),
  );

  const displayLinkBadges = [
    ...(taskSummary?.linkBadges ?? []),
    ...extraLinkBadges,
  ];

  function resetContactCreationState() {
    setNewContactWizardOpen(false);
    setCreatingContact(false);
    setExtraContactIds([]);
    setExtraLinkBadges([]);
  }

  function handleOpenChange(value: boolean) {
    if (!value && saving) return;
    onOpenChange(value);
    if (!value) {
      setForm(createEmptyForm());
      setSaving(false);
      resetContactCreationState();
    }
  }

  async function handleCreateContactFromWizard(data: NewContactData) {
    if (!linkedCompanyId || !isLikelyCompanyCuid(linkedCompanyId)) {
      toast.error('No hay empresa vinculada para crear el contacto');
      return;
    }
    setCreatingContact(true);
    const LOADING_ID = 'activity-form-create-contact';
    toast.loading('Guardando contacto…', { id: LOADING_ID });
    try {
      const contact = await createContactFromWizardForCompany(data, linkedCompanyId, {
        defaultAssignedTo: defaultAssigneeId,
      });
      setExtraContactIds((prev) =>
        prev.includes(contact.id) ? prev : [...prev, contact.id],
      );
      setExtraLinkBadges((prev) => {
        if (prev.some((b) => b.type === 'contacto' && b.name === contact.name)) return prev;
        return [...prev, { type: 'contacto', name: contact.name }];
      });
      setNewContactWizardOpen(false);
      toast.success(`Contacto "${contact.name}" creado`, { id: LOADING_ID });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo crear el contacto',
        { id: LOADING_ID },
      );
    } finally {
      setCreatingContact(false);
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const result = await Promise.resolve(
        onSave(form, extraContactIds.length > 0 ? { extraContactIds } : undefined),
      );
      if (type === 'llamada' && result?.callGoal) {
        showCallGoalToast(result.callGoal);
      } else {
        toast.success(`${config.label} registrad${config.labelFem} exitosamente`);
      }
      setForm(createEmptyForm());
      resetContactCreationState();
    } catch {
      /* el padre ya mostró el error */
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof ActivityFormData>(key: K, value: ActivityFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const planActionLabel = (action: RegisterLinkPlanEntity['action']) => {
    if (action === 'create') return 'Se creará';
    if (action === 'link') return 'Se vinculará a';
    return 'No aplica';
  };

  return (
    <>
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      maxWidthClassName="sm:max-w-lg"
      title={(
        <span className="inline-flex items-center gap-2">
          <Icon className={`size-5 ${config.color}`} />
          Registrar {config.label}
        </span>
      )}
      description={
        dialogDescription ??
        (taskSummary
          ? `Registra los detalles de la actividad. Al guardar, la tarea «${taskSummary.title}» quedará como completada.`
          : `Registra los detalles de la ${type === 'correo' ? 'el correo' : type === 'llamada' ? 'llamada' : type === 'whatsapp' ? 'conversación de WhatsApp' : 'reunión'}.`)
      }
      footer={(
        <FormDialogActions
          cancelLabel={showSkip ? 'Omitir' : 'Cancelar'}
          submitLabel={saving ? 'Guardando…' : 'Guardar actividad'}
          submitting={saving}
          submitDisabled={
            registerLinkPlan?.excluded ||
            registerLinkPlan?.loading ||
            registerCarteraPlan?.loading ||
            (registerCarteraPlan != null && !registerCarteraPlan.selectedId)
          }
          onCancel={() => handleOpenChange(false)}
          onSubmit={() => void handleSave()}
        />
      )}
    >
      <div className="space-y-6">
        {registerLinkPlan ? (
          <div className="space-y-3 rounded-xl border border-slate-300/80 bg-muted/20 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Correo</span>
              <span className="max-w-[16rem] truncate text-right font-medium">
                {registerLinkPlan.emailSubject}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Contraparte</span>
              <span className="max-w-[16rem] truncate text-right">{registerLinkPlan.email}</span>
            </div>
            <div className="border-t border-border/60 pt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Al guardar en el CRM
              </p>
              {registerLinkPlan.loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Consultando registros…
                </div>
              ) : registerLinkPlan.excluded ? (
                <p className="text-xs text-destructive">
                  Este dominio no se puede vincular al CRM. No se creará la actividad.
                </p>
              ) : (
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <User className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="text-muted-foreground">Contacto:</span>{' '}
                      {planActionLabel(registerLinkPlan.contact.action)}{' '}
                      <span className="font-medium">{registerLinkPlan.contact.name}</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Building2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="text-muted-foreground">Empresa:</span>{' '}
                      {planActionLabel(registerLinkPlan.company.action)}{' '}
                      <span className="font-medium">{registerLinkPlan.company.name}</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Briefcase className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="text-muted-foreground">Oportunidad:</span>{' '}
                      {planActionLabel(registerLinkPlan.opportunity.action)}
                      {registerLinkPlan.opportunity.action !== 'skip' ? (
                        <>
                          {' '}
                          <span className="font-medium">{registerLinkPlan.opportunity.name}</span>
                        </>
                      ) : null}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    {(() => {
                      const CorreoIcon = activityTypeSvgIcon('correo');
                      return (
                        <CorreoIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      );
                    })()}
                    <span>
                      <span className="text-muted-foreground">Actividad:</span>{' '}
                      <span className="font-medium">Se creará actividad tipo correo</span>
                    </span>
                  </li>
                </ul>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <span className="text-muted-foreground">Responsable</span>
              <span>{registerLinkPlan.assignee}</span>
            </div>
          </div>
        ) : null}
        {registerCarteraPlan ? (
          <div className="space-y-3 rounded-xl border border-slate-300/80 bg-muted/20 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Correo</span>
              <span className="max-w-[16rem] truncate text-right font-medium">
                {registerCarteraPlan.emailSubject}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Contraparte</span>
              <span className="max-w-[16rem] truncate text-right">{registerCarteraPlan.email}</span>
            </div>
            <div className="border-t border-border/60 pt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Empresa de cartera
              </p>
              {registerCarteraPlan.loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Buscando coincidencias en cartera…
                </div>
              ) : (
                <Popover
                  open={carteraPickerOpen}
                  onOpenChange={(next) => {
                    setCarteraPickerOpen(next);
                    if (!next) setCarteraSearch('');
                  }}
                  modal={false}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto w-full justify-between gap-2 px-3 py-2 text-left font-normal"
                    >
                      <span className="min-w-0">
                        {selectedCarteraEmpresa ? (
                          <>
                            <span className="block truncate font-medium">
                              {selectedCarteraEmpresa.empresa}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {[selectedCarteraEmpresa.email, selectedCarteraEmpresa.ruc]
                                .filter(Boolean)
                                .join(' · ') ||
                                (selectedCarteraEmpresa.reason
                                  ? selectedCarteraEmpresa.reason
                                  : registerCarteraPlan.domain)}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            Selecciona la empresa cliente
                          </span>
                        )}
                      </span>
                      <ChevronDown className="size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    side="bottom"
                    sideOffset={8}
                    collisionPadding={16}
                    className={formDialogPopoverContentClass}
                    {...{ [DISMISS_BLOCKER_ATTR]: '' }}
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    onWheel={(event) => event.stopPropagation()}
                  >
                    <div className="p-3">
                      <div className="relative mb-3">
                        <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por empresa, correo o RUC…"
                          value={carteraSearch}
                          onChange={(event) => setCarteraSearch(event.target.value)}
                          className={`${formDialogInputClass} h-10 pl-9 text-sm`}
                        />
                      </div>
                      <div
                        className={cn(formDialogScrollListClass, 'space-y-0.5')}
                        onWheel={(event) => event.stopPropagation()}
                      >
                        {sortedCarteraEmpresas.length === 0 ? (
                          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                            {registerCarteraPlan.empresas.length === 0
                              ? 'No hay empresas de cartera.'
                              : 'Sin resultados'}
                          </p>
                        ) : (
                          sortedCarteraEmpresas.map((row) => {
                            const isSelected = registerCarteraPlan.selectedId === row.id;
                            return (
                              <button
                                key={row.id}
                                type="button"
                                className={cn(
                                  'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/80',
                                  isSelected && 'bg-[#e8f5e9] text-foreground dark:bg-green-900/25',
                                )}
                                onClick={() => {
                                  registerCarteraPlan.onSelect(row.id);
                                  setCarteraPickerOpen(false);
                                  setCarteraSearch('');
                                }}
                              >
                                <Check
                                  className={cn(
                                    'size-4 shrink-0',
                                    isSelected ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate">{row.empresa}</span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {row.suggested && row.reason
                                      ? `${row.reason} · ${row.email || row.ruc || ''}`
                                      : [row.email, row.ruc].filter(Boolean).join(' · ') || '—'}
                                  </span>
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {!registerCarteraPlan.loading && registerCarteraPlan.domain ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Si el dominio coincide ({registerCarteraPlan.domain}), la empresa aparece preseleccionada. Puedes cambiarla.
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <span className="text-muted-foreground">Responsable</span>
              <span>{registerCarteraPlan.assignee}</span>
            </div>
          </div>
        ) : null}
        {taskSummary && !registerLinkPlan && !registerCarteraPlan && (
          <div className="space-y-2 rounded-xl border border-slate-300/80 bg-muted/20 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Tarea</span>
              <span className="font-medium text-right">{taskSummary.title}</span>
            </div>
            {taskSummary.company && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Empresa</span>
                <span className="font-medium text-right">{taskSummary.company}</span>
              </div>
            )}
            {displayLinkBadges.length > 0 && (
              <div className="pt-0.5">
                <p className="mb-2 text-xs text-muted-foreground">Vinculado a</p>
                <div className="flex flex-wrap gap-1.5">
                  {displayLinkBadges.map((row, idx) => (
                    <Badge key={`${row.type}-${idx}-${row.name}`} variant="secondary" className="gap-1 rounded-md border border-border/60 bg-muted/40 pr-1.5 text-xs">
                      {row.type === 'contacto' && <User className="size-3" />}
                      {(row.type === 'empresa' || row.type === 'cliente_empresa') && <Building2 className="size-3" />}
                      {row.type === 'negocio' && <Briefcase className="size-3" />}
                      <span className="max-w-[12rem] truncate">{row.name}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {canCreateLinkedContact && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 h-8 gap-1.5 text-xs"
                disabled={creatingContact}
                onClick={() => setNewContactWizardOpen(true)}
              >
                <Plus className="size-3.5" />
                Crear contacto
              </Button>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Responsable</span>
              <span>{taskSummary.assignee}</span>
            </div>
          </div>
        )}

        <ActivityTypeFormFields type={type} form={form} onChange={set} />
      </div>
    </FormDialogShell>

    <NewContactWizard
      open={newContactWizardOpen}
      onOpenChange={setNewContactWizardOpen}
      onSubmit={(data) => { void handleCreateContactFromWizard(data); }}
      title="Crear nuevo contacto"
      submitLabel="Crear y vincular"
      singlePage
      lockCompanySelection
      defaultCompanyId={linkedCompanyId}
      defaultValues={{
        company: linkedCompanyName ?? '',
        companyId: linkedCompanyId,
        etapaCiclo: 'lead',
        assignedTo: defaultAssigneeId,
      }}
    />
    </>
  );
}
