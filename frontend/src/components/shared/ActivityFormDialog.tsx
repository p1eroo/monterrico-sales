import { useState, useEffect } from 'react';
import { User, Building2, Briefcase, Plus, Loader2 } from 'lucide-react';
import { toast } from '@/lib/notify';
import type { ActivityType, ActivityStatus, TaskAssociation } from '@/types';
import { formatNowPeruTimeHHmm, formatTodayPeruYmd } from '@/lib/formatters';
import { isLikelyCompanyCuid } from '@/lib/companyApi';
import { NewContactWizard, type NewContactData } from '@/components/shared/NewContactWizard';
import { createContactFromWizardForCompany } from '@/lib/createContactFromWizard';
import { activityTypeSvgIcon } from '@/lib/activityTypeSvgIcons';

import { ActivityTypeFormFields, type ActivityFormFieldsData } from '@/components/shared/ActivityTypeFormFields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FormDialogActions,
  FormDialogShell,
} from '@/components/ui/form-dialog';

export type ActivityFormData = ActivityFormFieldsData;

export interface ActivityFormSaveMeta {
  extraContactIds?: string[];
}

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

interface ActivityFormDialogProps {
  type: 'llamada' | 'reunion' | 'correo' | 'whatsapp';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ActivityFormData, meta?: ActivityFormSaveMeta) => void | Promise<void>;
  taskSummary?: TaskSummary;
  registerLinkPlan?: RegisterLinkPlan;
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
      await Promise.resolve(
        onSave(form, extraContactIds.length > 0 ? { extraContactIds } : undefined),
      );
      toast.success(`${config.label} registrad${config.labelFem} exitosamente`);
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
          submitDisabled={registerLinkPlan?.excluded || registerLinkPlan?.loading}
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
        {taskSummary && !registerLinkPlan && (
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
