import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useCrmConfigStore, getLeadSourceOptionsFromCatalog } from '@/store/crmConfigStore';
import { toast } from '@/lib/notify';
import { Check, ChevronRight, Building2, Briefcase, Search, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { Etapa, ContactSource } from '@/types';
import { contactSourceLabels, etapaLabels } from '@/data/mock';
import { useAppStore } from '@/store';
import { canUserReassignCommercialAdvisor, resolveAdvisorAssigneeId } from '@/lib/advisorAssigneeDefaults';
import { usePermissions } from '@/hooks/usePermissions';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import {
  AssociationChip,
  AssociationPickerStatic,
  AssociationPickerTrigger,
} from '@/components/shared/AssociationPickerField';
import { companyListAll, type ApiCompanyRecord } from '@/lib/companyApi';
import { fetchClienteEmpresas } from '@/lib/clienteCarteraApi';
import { opportunityListAll, type ApiOpportunityListRow } from '@/lib/opportunityApi';

import { Input } from '@/components/ui/input';
import {
  FormDialogActions,
  FormDialogShell,
  FormDialogWizardFooter,
  FormDialogField,
  FormDialogGrid,
  formDialogInputClass,
  formDialogPopoverContentClass,
  formDialogScrollListClass,
  formDialogSelectTriggerClass,
} from '@/components/ui/form-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  NewCompanyWizard,
  type NewCompanyData,
  type NewCompanyWizardSubmitMeta,
} from '@/components/shared/NewCompanyWizard';

export interface NewContactData {
  name: string;
  cargo?: string;
  /** Nombre mostrado / texto para empresa nueva */
  company: string;
  /** Si el usuario eligió una empresa existente en el servidor (cuid) */
  companyId?: string;
  etapaCiclo: Etapa;
  phone: string;
  email: string;
  source: ContactSource;
  assignedTo: string;
  /** @deprecated El monto es solo de empresa/oportunidad; el asistente envía 0. */
  estimatedValue?: number;
  clienteRecuperado?: 'si' | 'no';
  departamento?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
  /** Wizard de empresa embebido: se persiste al guardar el contacto (empresa + opcional oportunidad) */
  newCompanyWizardData?: NewCompanyData;
  /** Si el RUC ya existía: PATCH empresa y vincular por id (sin crear empresa nueva ni oportunidad desde el wizard) */
  newCompanyWizardUpdate?: { companyId: string };
  /** IDs de oportunidades seleccionadas en el paso de asociaciones */
  selectedOpportunityIds?: string[];
}

interface NewContactWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NewContactData) => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  defaultValues?: Partial<NewContactData>;
  /** Si es true, la empresa queda fijada (p. ej. alta desde ficha de empresa); no se crea ni se busca otra. */
  lockCompanySelection?: boolean;
  /** ID de empresa preseleccionada (vista detallada) */
  defaultCompanyId?: string;
  /** IDs de oportunidades preseleccionadas (vista detallada) */
  defaultOpportunityIds?: string[];
  /** CRM (default) o cartera de clientes (empresas cliente, sin oportunidades). */
  variant?: 'crm' | 'cliente-cartera';
  /**
   * Una sola pantalla (sin pasos), p. ej. alta desde ficha de empresa/oportunidad.
   * Default false: wizard Identificación → Comercial → Ubicación.
   */
  singlePage?: boolean;
}

const WIZARD_STEPS = [
  { label: 'Identificación' },
  { label: 'Comercial' },
  { label: 'Ubicación' },
];

/** Mismo criterio que `TaskFormDialog`: pocas filas visibles; el filtro recorre toda la lista cargada. */
const ASSOCIATION_PICKER_PAGE_SIZE = 8;

export function NewContactWizard({
  open,
  onOpenChange,
  onSubmit,
  title = 'Crear nuevo contacto',
  description,
  submitLabel = 'Crear contacto',
  defaultValues,
  lockCompanySelection = false,
  defaultCompanyId,
  defaultOpportunityIds = [],
  variant = 'crm',
  singlePage = false,
}: NewContactWizardProps) {
  const multiStep = !singlePage;
  /** Vista detalle: una columna (label + input por fila), como formularios tipo HubSpot. */
  const fieldsGridClass = multiStep ? undefined : 'sm:grid-cols-1';
  const defaultValuesRef = useRef(defaultValues);
  defaultValuesRef.current = defaultValues;
  const defaultCompanyIdRef = useRef(defaultCompanyId);
  defaultCompanyIdRef.current = defaultCompanyId;
  const defaultOpportunityIdsRef = useRef(defaultOpportunityIds);
  defaultOpportunityIdsRef.current = defaultOpportunityIds;
  const lockCompanySelectionRef = useRef(lockCompanySelection);
  lockCompanySelectionRef.current = lockCompanySelection;
  const variantRef = useRef(variant);
  variantRef.current = variant;
  const isClienteCartera = variant === 'cliente-cartera';

  const [step, setStep] = useState(0);
  const [name, setName] = useState(defaultValues?.name ?? '');
  const [cargo, setCargo] = useState(defaultValues?.cargo ?? '');
  const [company, setCompany] = useState(defaultValues?.company ?? '');
  const [companyId, setCompanyId] = useState<string | null>(defaultValues?.companyId ?? null);
  const [apiCompanies, setApiCompanies] = useState<ApiCompanyRecord[]>([]);
  const [etapaCiclo, setEtapaCiclo] = useState<Etapa>(defaultValues?.etapaCiclo ?? 'lead');
  const [phone, setPhone] = useState(defaultValues?.phone ?? '');
  const [email, setEmail] = useState(defaultValues?.email ?? '');
  const [source, setSource] = useState<ContactSource>(defaultValues?.source ?? 'base');
  const [assignedTo, setAssignedTo] = useState(() =>
    resolveAdvisorAssigneeId(defaultValues?.assignedTo, useAppStore.getState().currentUser),
  );
  const [clienteRecuperado, setClienteRecuperado] = useState<'si' | 'no'>(defaultValues?.clienteRecuperado ?? 'no');
  const [departamento, setDepartamento] = useState(defaultValues?.departamento ?? '');
  const [provincia, setProvincia] = useState(defaultValues?.provincia ?? '');
  const [distrito, setDistrito] = useState(defaultValues?.distrito ?? '');
  const [direccion, setDireccion] = useState(defaultValues?.direccion ?? '');
  const [apiOpportunities, setApiOpportunities] = useState<ApiOpportunityListRow[]>([]);
  const [companyPanelOpen, setCompanyPanelOpen] = useState(false);
  const [oppPanelOpen, setOppPanelOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [oppSearch, setOppSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(defaultCompanyId ?? null);
  const [selectedOpportunityIds, setSelectedOpportunityIds] = useState<string[]>(defaultOpportunityIds);
  const currentUser = useAppStore((s) => s.currentUser);
  const { hasPermission } = usePermissions();
  const canReassign = canUserReassignCommercialAdvisor(hasPermission, 'contactos');
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const bundle = useCrmConfigStore((s) => s.bundle);

  const stageOptions = useMemo(() => {
    const stages = bundle?.catalog.stages
      .filter((x) => x.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (stages?.length) {
      return stages.map((s) => ({ value: s.slug, label: s.name }));
    }
    return Object.entries(etapaLabels).map(([value, label]) => ({ value, label }));
  }, [bundle]);

  const sourceOptions = useMemo(
    () => getLeadSourceOptionsFromCatalog(bundle, contactSourceLabels),
    [bundle],
  );

  const [pendingNewCompany, setPendingNewCompany] = useState<NewCompanyData | null>(null);
  const [wizardCompanyPatchId, setWizardCompanyPatchId] = useState<string | null>(null);
  const [companyWizardOpen, setCompanyWizardOpen] = useState(false);
  const [companyWizardDefaults, setCompanyWizardDefaults] = useState<Partial<NewCompanyData>>({});

  const reset = useCallback(() => {
    const d = defaultValuesRef.current;
    const defCo = defaultCompanyIdRef.current;
    const defOpps = defaultOpportunityIdsRef.current ?? [];
    const lockCo = lockCompanySelectionRef.current;
    setStep(0);
    setName(d?.name ?? '');
    setCargo(d?.cargo ?? '');
    setCompany(d?.company ?? '');
    setCompanyId(d?.companyId ?? null);
    setEtapaCiclo(d?.etapaCiclo ?? 'lead');
    setPhone(d?.phone ?? '');
    setEmail(d?.email ?? '');
    setSource(d?.source ?? 'base');
    const cu = currentUserRef.current;
    setAssignedTo(resolveAdvisorAssigneeId(d?.assignedTo, cu, canReassign));
    setClienteRecuperado(d?.clienteRecuperado ?? 'no');
    setDepartamento(d?.departamento ?? '');
    setProvincia(d?.provincia ?? '');
    setDistrito(d?.distrito ?? '');
    setDireccion(d?.direccion ?? '');
    setPendingNewCompany(null);
    setWizardCompanyPatchId(null);
    setCompanyWizardOpen(false);
    setCompanyWizardDefaults({});
    setCompanyPanelOpen(false);
    setOppPanelOpen(false);
    setCompanySearch('');
    setOppSearch('');
    setSelectedCompanyId(lockCo ? (defCo ?? null) : (defCo ?? d?.companyId ?? null));
    setSelectedOpportunityIds([...defOpps]);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const d = defaultValuesRef.current;
    const defCo = defaultCompanyId;
    const defOpps = defaultOpportunityIds ?? [];
    if (lockCompanySelection) {
      setSelectedCompanyId(defCo ?? null);
      if (!company.trim() && d?.company?.trim()) {
        setCompany(d.company);
      }
    } else {
      setSelectedCompanyId(defCo ?? d?.companyId ?? null);
    }
    setCompanyPanelOpen(false);
    setOppPanelOpen(false);
    setCompanySearch('');
    setOppSearch('');
    setSelectedOpportunityIds([...defOpps]);
  }, [open, defaultCompanyId, lockCompanySelection, isClienteCartera, (defaultOpportunityIds ?? []).join(',')]);

  useEffect(() => {
    if (defaultCompanyId && apiCompanies.length > 0 && !company.trim()) {
      const comp = apiCompanies.find((c) => c.id === defaultCompanyId);
      if (comp) {
        setCompany(comp.name);
      }
    }
  }, [apiCompanies, defaultCompanyId]);

  const companiesForPicker = useMemo(() => {
    let list = apiCompanies;
    if (
      lockCompanySelection &&
      selectedCompanyId &&
      !apiCompanies.some((c) => c.id === selectedCompanyId)
    ) {
      const name = company.trim() || defaultValuesRef.current?.company?.trim() || 'Empresa';
      list = [
        { id: selectedCompanyId, name, urlSlug: selectedCompanyId } as ApiCompanyRecord,
        ...apiCompanies,
      ];
    }
    if (lockCompanySelection && selectedCompanyId) {
      const selected = list.find((c) => c.id === selectedCompanyId);
      if (selected) {
        return [selected, ...list.filter((c) => c.id !== selectedCompanyId)];
      }
    }
    return list;
  }, [apiCompanies, lockCompanySelection, selectedCompanyId, company]);

function handleCompanyWizardSubmit(
    data: NewCompanyData,
    meta: NewCompanyWizardSubmitMeta,
  ) {
    setPendingNewCompany(data);
    setCompany(data.nombreComercial.trim());
    if (meta.mode === 'update' && meta.existingCompanyId) {
      setWizardCompanyPatchId(meta.existingCompanyId);
      setCompanyId(meta.existingCompanyId);
      setSelectedCompanyId(meta.existingCompanyId);
    } else {
      setWizardCompanyPatchId(null);
      setCompanyId(null);
      setSelectedCompanyId(null);
    }
    setCompanyWizardOpen(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      reset();
    }
    onOpenChange(next);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    if (isClienteCartera) {
      fetchClienteEmpresas()
        .then((list) => {
          if (!cancelled) {
            setApiCompanies(
              list.map(
                (e) =>
                  ({
                    id: e.id,
                    name: e.empresa,
                    urlSlug: e.id,
                  }) as ApiCompanyRecord,
              ),
            );
          }
        })
        .catch(() => {
          if (!cancelled) {
            setApiCompanies([]);
            toast.error('No se pudieron cargar las empresas cliente.');
          }
        });
      return () => {
        cancelled = true;
      };
    }
    companyListAll()
      .then((list) => {
        if (!cancelled) setApiCompanies(list);
      })
      .catch(() => {
        if (!cancelled) {
          setApiCompanies([]);
          toast.error('No se pudieron cargar las empresas. Puedes escribir una nueva.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, isClienteCartera]);

  useEffect(() => {
    if (!open || isClienteCartera) return;
    let cancelled = false;
    opportunityListAll()
      .then((list) => {
        if (!cancelled) setApiOpportunities(list);
      })
      .catch(() => {
        if (!cancelled) setApiOpportunities([]);
      });
return () => {
      cancelled = true;
    };
  }, [open]);

  function handleNext() {
    if (step === 0) {
      if (!name.trim()) {
        toast.error('El nombre es obligatorio');
        return;
      }
      if (isClienteCartera) {
        if (!selectedCompanyId) {
          toast.error('Selecciona una empresa cliente en asociaciones');
          return;
        }
      } else if (!company.trim()) {
        toast.error('Nombre y empresa son requeridos');
        return;
      }
      if (!email.trim()) {
        toast.error('El correo es obligatorio');
        return;
      }
    }
    setStep((s) => s + 1);
  }

  function handleSubmit() {
    if (submitting) return;
    if (!name.trim() || !company.trim()) {
      toast.error('Nombre y empresa son requeridos');
      return;
    }
    if (isClienteCartera && !selectedCompanyId && !companyId) {
      toast.error('Selecciona una empresa cliente en asociaciones');
      return;
    }
    if (!email.trim()) {
      toast.error('El correo es obligatorio');
      return;
    }
    setSubmitting(true);
    const finalCompanyId = selectedCompanyId || companyId;
    onSubmit({
      name: name.trim(),
      cargo: cargo.trim() || undefined,
      company: company.trim(),
      companyId: finalCompanyId ?? undefined,
      etapaCiclo,
      phone: phone.trim(),
      email: email.trim(),
      source,
      assignedTo,
      estimatedValue: 0,
      clienteRecuperado,
      departamento: departamento.trim() || undefined,
      provincia: provincia.trim() || undefined,
      distrito: distrito.trim() || undefined,
      direccion: direccion.trim() || undefined,
      ...(pendingNewCompany
        ? {
            newCompanyWizardData: pendingNewCompany,
            ...(wizardCompanyPatchId
              ? { newCompanyWizardUpdate: { companyId: wizardCompanyPatchId } }
              : {}),
          }
        : {}),
      selectedOpportunityIds: selectedOpportunityIds.length > 0 ? selectedOpportunityIds : undefined,
    });
  }

  return (
    <>
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      maxWidthClassName="sm:max-w-lg"
      title={title}
      description={description}
      footer={multiStep ? (
        <FormDialogWizardFooter
          showBack={step > 0}
          onBack={() => setStep((s) => s - 1)}
          onCancel={() => handleOpenChange(false)}
          submitting={submitting}
          primaryDisabled={step === 2 ? !name.trim() || !company.trim() : false}
          onPrimary={step < 2 ? handleNext : handleSubmit}
          primaryLabel={step < 2 ? (
            <>Siguiente <ChevronRight className="size-4" /></>
          ) : submitLabel}
          primaryIcon={step === 2 && submitting ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : undefined}
        />
      ) : (
        <FormDialogActions
          submitting={submitting}
          submitLabel={submitLabel}
          onSubmit={handleSubmit}
        />
      )}
    >
      <div className="space-y-6">
        {multiStep ? (
          <div className="flex items-center justify-center gap-0">
            {WIZARD_STEPS.map((s, i) => (
              <div key={s.label} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { if (i < step) setStep(i); }}
                    className={cn(
                      'flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                      i < step
                        ? 'border-[#13944C] bg-[#13944C] text-white'
                        : i === step
                          ? 'border-[#13944C] bg-background text-[#13944C]'
                          : 'border-border bg-muted/60 text-muted-foreground',
                    )}
                  >
                    {i < step ? <Check className="size-4" /> : i + 1}
                  </button>
                  <span
                    className={cn(
                      'text-xs whitespace-nowrap',
                      i === step ? 'font-medium text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < WIZARD_STEPS.length - 1 && (
                  <div
                    className={cn(
                      'mx-2 mb-5 h-px w-10 sm:w-14',
                      i < step ? 'bg-[#13944C]' : 'bg-border',
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        ) : null}

        <form
          onSubmit={(e) => e.preventDefault()}
          className={multiStep ? 'space-y-6' : 'space-y-3.5'}
        >
          {(!multiStep || step === 0) && (
            <>
              <FormDialogGrid className={fieldsGridClass}>
                <FormDialogField label="Nombre completo" required>
                  <Input
                    className={formDialogInputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre del contacto"
                  />
                </FormDialogField>
                <FormDialogField label="Cargo">
                  <Input
                    className={formDialogInputClass}
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    placeholder="Ej: Gerente de Compras"
                  />
                </FormDialogField>
              </FormDialogGrid>

              <div className={cn(multiStep ? 'space-y-4' : 'space-y-3.5')}>
                <FormDialogField label="Empresa" compactControl={false}>
                  {lockCompanySelection && selectedCompanyId ? (
                    <AssociationPickerStatic
                      chips={(
                        <AssociationChip
                          kind="empresa"
                          label={
                            companiesForPicker.find((c) => c.id === selectedCompanyId)?.name
                            ?? (company.trim() || 'Empresa')
                          }
                          locked
                          showTypeLabel={false}
                        />
                      )}
                    />
                  ) : (
                    <Popover
                      open={companyPanelOpen}
                      onOpenChange={(next) => {
                        setCompanyPanelOpen(next);
                        if (next) {
                          setOppPanelOpen(false);
                          setCompanySearch('');
                        }
                      }}
                      modal={false}
                    >
                      <PopoverTrigger asChild>
                        <AssociationPickerTrigger
                          open={companyPanelOpen}
                          placeholder="Buscar empresa"
                          chips={selectedCompanyId ? (
                            <AssociationChip
                              kind="empresa"
                              label={
                                companiesForPicker.find((c) => c.id === selectedCompanyId)?.name
                                ?? (company.trim() || 'Empresa')
                              }
                              showTypeLabel={false}
                              onRemove={() => setSelectedCompanyId(null)}
                            />
                          ) : null}
                        />
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        side="bottom"
                        sideOffset={8}
                        collisionPadding={16}
                        className={formDialogPopoverContentClass}
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        <div className="p-3">
                          <div className="relative mb-3">
                            <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Buscar..."
                              value={companySearch}
                              onChange={(e) => setCompanySearch(e.target.value)}
                              className={`${formDialogInputClass} h-10 pl-9 text-sm`}
                            />
                          </div>
                          <div
                            className={cn(formDialogScrollListClass, 'space-y-0.5')}
                            onWheel={(e) => e.stopPropagation()}
                          >
                            {companiesForPicker
                              .filter((c) => c.name.toLowerCase().includes(companySearch.toLowerCase()))
                              .slice(0, ASSOCIATION_PICKER_PAGE_SIZE)
                              .map((c) => {
                                const isSelected = selectedCompanyId === c.id;
                                return (
                                  <label
                                    key={c.id}
                                    className={cn(
                                      'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/60',
                                      isSelected ? 'bg-muted/50' : '',
                                    )}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      className="size-3.5 shrink-0"
                                      onCheckedChange={() => {
                                        if (isSelected) {
                                          setSelectedCompanyId(null);
                                        } else {
                                          setSelectedCompanyId(c.id);
                                          setCompany(c.name);
                                        }
                                      }}
                                    />
                                    <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                                    <span className="min-w-0 truncate text-left">{c.name}</span>
                                  </label>
                                );
                              })}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </FormDialogField>

                {!isClienteCartera && (
                  <FormDialogField label="Oportunidad" compactControl={false}>
                    <Popover
                      open={oppPanelOpen}
                      onOpenChange={(next) => {
                        setOppPanelOpen(next);
                        if (next) {
                          setCompanyPanelOpen(false);
                          setOppSearch('');
                        }
                      }}
                      modal={false}
                    >
                      <PopoverTrigger asChild>
                        <AssociationPickerTrigger
                          open={oppPanelOpen}
                          placeholder="Buscar oportunidad"
                          chips={selectedOpportunityIds.map((oppId) => {
                            const opp = apiOpportunities.find((o) => o.id === oppId);
                            const label = opp?.title ?? `Oportunidad ${oppId.slice(0, 8)}…`;
                            return (
                              <AssociationChip
                                key={`opp-${oppId}`}
                                kind="oportunidad"
                                label={label}
                                showTypeLabel={false}
                                onRemove={() => setSelectedOpportunityIds((prev) => prev.filter((id) => id !== oppId))}
                              />
                            );
                          })}
                        />
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        side="bottom"
                        sideOffset={8}
                        collisionPadding={16}
                        className={formDialogPopoverContentClass}
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        <div className="p-3">
                          <div className="relative mb-3">
                            <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Buscar..."
                              value={oppSearch}
                              onChange={(e) => setOppSearch(e.target.value)}
                              className={`${formDialogInputClass} h-10 pl-9 text-sm`}
                            />
                          </div>
                          <div
                            className={cn(formDialogScrollListClass, 'space-y-0.5')}
                            onWheel={(e) => e.stopPropagation()}
                          >
                            {apiOpportunities
                              .filter((o) => o.title.toLowerCase().includes(oppSearch.toLowerCase()))
                              .slice(0, ASSOCIATION_PICKER_PAGE_SIZE)
                              .map((o) => {
                                const isSelected = selectedOpportunityIds.includes(o.id);
                                return (
                                  <label
                                    key={o.id}
                                    className={cn(
                                      'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/60',
                                      isSelected ? 'bg-muted/50' : '',
                                    )}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      className="size-3.5 shrink-0"
                                      onCheckedChange={() => {
                                        if (isSelected) {
                                          setSelectedOpportunityIds((prev) => prev.filter((id) => id !== o.id));
                                        } else {
                                          setSelectedOpportunityIds((prev) => [...prev, o.id]);
                                        }
                                      }}
                                    />
                                    <Briefcase className="size-3.5 shrink-0 text-muted-foreground" />
                                    <span className="min-w-0 truncate text-left">{o.title}</span>
                                  </label>
                                );
                              })}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </FormDialogField>
                )}
              </div>

              <FormDialogGrid className={fieldsGridClass}>
                <FormDialogField label="Etapa">
                  <Select value={etapaCiclo} onValueChange={(v) => setEtapaCiclo(v as Etapa)}>
                    <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {stageOptions.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormDialogField>
                <FormDialogField label="Teléfono">
                  <Input
                    className={formDialogInputClass}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+51 999 999 999"
                  />
                </FormDialogField>
                <FormDialogField label="Email" required>
                  <Input
                    className={formDialogInputClass}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@empresa.com"
                  />
                </FormDialogField>
              </FormDialogGrid>
            </>
          )}

          {(!multiStep || step === 1) && (
            <FormDialogGrid className={fieldsGridClass}>
              <FormDialogField label="Fuente">
                <Select value={source} onValueChange={(v) => setSource(v as ContactSource)}>
                  <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormDialogField>
              <AssignedAdvisorFormField
                htmlId="contact-wizard-assigned-to"
                value={assignedTo}
                onChange={setAssignedTo}
                assignModule="contactos"
                disabled={false}
                fallbackName={currentUser.name}
                label="Asesor asignado"
                formStyle
              />
              <FormDialogField label="Cliente recuperado">
                <Select value={clienteRecuperado} onValueChange={(v) => setClienteRecuperado(v as 'si' | 'no')}>
                  <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="si">Sí</SelectItem>
                  </SelectContent>
                </Select>
              </FormDialogField>
            </FormDialogGrid>
          )}

          {(!multiStep || step === 2) && (
            <>
              {!multiStep ? (
                <p className="pt-1 text-sm font-semibold text-foreground/80">Ubicación</p>
              ) : null}
              <FormDialogGrid className={fieldsGridClass}>
                <FormDialogField label="Departamento">
                  <Input
                    className={formDialogInputClass}
                    value={departamento}
                    onChange={(e) => setDepartamento(e.target.value)}
                    placeholder="Ej: Lima"
                  />
                </FormDialogField>
                <FormDialogField label="Provincia">
                  <Input
                    className={formDialogInputClass}
                    value={provincia}
                    onChange={(e) => setProvincia(e.target.value)}
                    placeholder="Ej: Lima"
                  />
                </FormDialogField>
                <FormDialogField label="Distrito">
                  <Input
                    className={formDialogInputClass}
                    value={distrito}
                    onChange={(e) => setDistrito(e.target.value)}
                    placeholder="Ej: Surco"
                  />
                </FormDialogField>
                <FormDialogField label="Dirección">
                  <Input
                    className={formDialogInputClass}
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Ej: Av. Primavera 1234"
                  />
                </FormDialogField>
              </FormDialogGrid>
            </>
          )}
        </form>
      </div>
    </FormDialogShell>
  {!isClienteCartera && (
  <NewCompanyWizard
    open={companyWizardOpen}
    onOpenChange={setCompanyWizardOpen}
    onSubmit={handleCompanyWizardSubmit}
    defaultValues={companyWizardDefaults}
    title="Crear nueva empresa"
    confirmButtonLabel="Usar estos datos"
    showContactSection={false}
  />
  )}
</>
  );
}
