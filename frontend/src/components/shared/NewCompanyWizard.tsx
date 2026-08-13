import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useCrmConfigStore, getLeadSourceOptionsFromCatalog } from '@/store/crmConfigStore';
import { Check, ChevronRight, Loader2, Search } from 'lucide-react';
import { toast } from '@/lib/notify';
import { factilizaApi } from '@/lib/factilizaApi';
import type { CompanyRubro, CompanyTipo, ContactSource, Etapa } from '@/types';
import { companyTipoLabels, etapaLabels, contactSourceLabels } from '@/data/mock';
import { useRubroOptions } from '@/store/crmConfigStore';
import { useAppStore } from '@/store';
import { canUserReassignCommercialAdvisor, resolveAdvisorAssigneeId } from '@/lib/advisorAssigneeDefaults';
import { usePermissions } from '@/hooks/usePermissions';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FormDialogShell,
  FormDialogActions,
  FormDialogWizardFooter,
  FormDialogField,
  FormDialogGrid,
  formDialogInputClass,
  formDialogSelectTriggerClass,
} from '@/components/ui/form-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  emptyNewCompanyForm,
  type NewCompanyData,
} from '@/lib/newCompanyData';
import {
  companyGetByRuc,
  companyListPaginated,
  type ApiCompanyRecord,
} from '@/lib/companyApi';
import {
  mapApiCompanyRecordToNewCompanyData,
} from '@/lib/companyWizardMap';
import { useUsersStore } from '@/store/usersStore';

export type { NewCompanyData };

const emptyForm = emptyNewCompanyForm;

function domainConflictCopy(
  company: ApiCompanyRecord,
  getUserName: (userId: string) => string,
) {
  const companyName = company.name?.trim() || 'Empresa sin nombre';
  const advisorName = company.assignedTo
    ? getUserName(company.assignedTo) || 'Sin asignar'
    : 'Sin asignar';
  return { companyName, advisorName };
}

function domainConflictToastMessage(
  company: ApiCompanyRecord,
  getUserName: (userId: string) => string,
): string {
  const { companyName, advisorName } = domainConflictCopy(company, getUserName);
  return `Este dominio ya está registrado en «${companyName}» (asesor: ${advisorName}).`;
}

export type NewCompanyWizardSubmitMeta = {
  mode: 'create' | 'update';
  existingCompanyId?: string;
};

interface NewCompanyWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    data: NewCompanyData,
    meta: NewCompanyWizardSubmitMeta,
  ) => void | Promise<void>;
  title?: string;
  description?: string;
  /** Valores iniciales (p. ej. desde el wizard de contacto) */
  defaultValues?: Partial<NewCompanyData>;
  /** Texto del botón final (default: Crear Empresa) */
  confirmButtonLabel?: string;
  /**
   * Si false, oculta el bloque Contacto (p. ej. alta de empresa desde ficha de contacto,
   * donde el vínculo ya es con ese contacto). Default true (flujo Empresas → Nueva empresa).
   */
  showContactSection?: boolean;
}

const COMPANY_NAME_LOOKUP_DEBOUNCE_MS = 700;

function mergeCompanyForm(
  defaults: Partial<NewCompanyData> | undefined,
  currentUser: { id: string; role?: string },
  canAssignOthers: boolean,
): NewCompanyData {
  const merged = { ...emptyForm, ...defaults };
  merged.propietario = resolveAdvisorAssigneeId(defaults?.propietario ?? merged.propietario, {
    id: currentUser?.id ?? '',
    role: currentUser?.role,
  }, canAssignOthers);
  return merged;
}

export function NewCompanyWizard({
  open,
  onOpenChange,
  onSubmit,
  title = 'Crear nueva empresa',
  description,
  defaultValues,
  confirmButtonLabel = 'Crear empresa',
  showContactSection = true,
}: NewCompanyWizardProps) {
  /** Flujo Empresas: wizard por pasos. Desde ficha de contacto/opp: formulario único. */
  const multiStep = showContactSection;
  /** Un campo por fila (misma densidad en pasos y en vista única). */
  const currentUser = useAppStore((s) => s.currentUser);
  const { hasPermission } = usePermissions();
  const canReassign = canUserReassignCommercialAdvisor(hasPermission, 'empresas');
  const getUserName = useUsersStore((s) => s.getUserName);
  const steps = useMemo(
    () => [
      { label: 'Identificación' },
      { label: 'Contacto y oportunidad' },
      { label: 'Ubicación' },
    ],
    [],
  );
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<NewCompanyData>(() =>
    mergeCompanyForm(defaultValues, currentUser, canReassign),
  );
  const [rucLookupLoading, setRucLookupLoading] = useState(false);
  const [companyNameLookupLoading, setCompanyNameLookupLoading] = useState(false);
  const [companyNameSuggestions, setCompanyNameSuggestions] = useState<ApiCompanyRecord[]>([]);
  const [companyNameLookupQuery, setCompanyNameLookupQuery] = useState('');
  const [existingCompanyId, setExistingCompanyId] = useState<string | null>(null);
  const [loadedRucDigits, setLoadedRucDigits] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [domainLookupLoading, setDomainLookupLoading] = useState(false);
  const [domainMatches, setDomainMatches] = useState<ApiCompanyRecord[]>([]);
  const bundle = useCrmConfigStore((s) => s.bundle);
  const rubroOptions = useRubroOptions();

  const stageOptions = useMemo(() => {
    const stages = bundle?.catalog?.stages
      ?.filter((x) => x.enabled)
      ?.sort((a, b) => a.sortOrder - b.sortOrder);
    if (stages?.length) {
      return stages.map((s) => ({ value: s.slug, label: s.name }));
    }
    return Object.entries(etapaLabels).map(([value, label]) => ({ value, label }));
  }, [bundle]);

  const sourceOptions = useMemo(
    () => getLeadSourceOptionsFromCatalog(bundle, contactSourceLabels),
    [bundle],
  );

  function resetCompanyNameLookup() {
    setCompanyNameLookupLoading(false);
    setCompanyNameSuggestions([]);
    setCompanyNameLookupQuery('');
  }

  async function applyCompanyRecord(record: ApiCompanyRecord, successMessage: string) {
    const mapped = mapApiCompanyRecordToNewCompanyData(record);
    const nextRuc = (record.ruc ?? '').replace(/\D/g, '').slice(0, 11);
    setForm((s) => ({
      ...s,
      ...mapped,
      ruc: mapped.ruc || nextRuc || s.ruc,
    }));
    setExistingCompanyId(record.id);
    setLoadedRucDigits(nextRuc || null);
    resetCompanyNameLookup();

    if (nextRuc.length === 11) {
      try {
        const full = await companyGetByRuc(nextRuc);
        const fullMapped = mapApiCompanyRecordToNewCompanyData(full);
        setForm((s) => ({
          ...s,
          ...fullMapped,
          ruc: fullMapped.ruc || nextRuc || s.ruc,
        }));
      } catch {
        // fallback: nos quedamos con los datos parciales del listado
      }
    }

    toast.success(successMessage);
  }

  async function searchCompaniesByName(
    queryRaw: string,
    opts?: { loadFirstMatch?: boolean; silent?: boolean },
  ) {
    const query = queryRaw.trim();
    if (query.length < 3) {
      setCompanyNameSuggestions([]);
      return null;
    }

    setCompanyNameLookupLoading(true);
    try {
      const res = await companyListPaginated({
        page: 1,
        limit: 5,
        search: query,
      });
      setCompanyNameSuggestions(res.data);
      if (opts?.loadFirstMatch) {
        const first = res.data[0];
        if (!first) {
          if (!opts.silent) {
            toast.error('No se encontraron empresas similares en el sistema');
          }
          return null;
        }
        applyCompanyRecord(
          first,
          'Empresa encontrada: datos cargados desde el sistema',
        );
        return first;
      }
      if (!opts?.silent && res.data.length === 0) {
        toast.error('No se encontraron empresas similares en el sistema');
      }
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo buscar empresas por nombre o razón social';
      toast.error(message);
      return null;
    } finally {
      setCompanyNameLookupLoading(false);
    }
  }

  async function handleRucLookup(rucValue?: string) {
    const ruc = (rucValue ?? form.ruc).trim().replace(/\D/g, '');
    if (!ruc || ruc.length !== 11) {
      toast.error('Ingresa un RUC válido de 11 dígitos');
      return;
    }
    setRucLookupLoading(true);
    try {
      let loadedFromCrm = false;
      try {
        const record = await companyGetByRuc(ruc);
        applyCompanyRecord(
          record,
          'Empresa encontrada: datos cargados desde el sistema',
        );
        loadedFromCrm = true;
      } catch (err) {
        const st = (err as Error & { status?: number }).status;
        if (st !== 404) {
          const message = err instanceof Error ? err.message : 'No se pudo buscar la empresa por RUC';
          toast.error(message);
          return;
        }
      }

      if (!loadedFromCrm) {
        setExistingCompanyId(null);
        setLoadedRucDigits(null);
        resetCompanyNameLookup();
        const data = await factilizaApi.consultarRuc(ruc);
        setForm((s) => ({
          ...s,
          razonSocial: data.nombre_o_razon_social ?? s.razonSocial,
          nombreComercial: data.nombre_o_razon_social ?? s.nombreComercial,
          departamento: data.departamento ?? s.departamento,
          provincia: data.provincia ?? s.provincia,
          distrito: data.distrito ?? s.distrito,
          direccion: data.direccion_completa ?? data.direccion ?? s.direccion,
        }));
        toast.success('Datos de SUNAT cargados correctamente');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo consultar el RUC';
      toast.error(message);
    } finally {
      setRucLookupLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setForm(mergeCompanyForm(defaultValues, currentUser, canReassign));
    setStep(0);
    setExistingCompanyId(null);
    setLoadedRucDigits(null);
    resetCompanyNameLookup();
    setDomainMatches([]);
    setDomainLookupLoading(false);
  }, [open]);

  useEffect(() => {
    if (!open || step !== 0) return;
    const query = companyNameLookupQuery.trim();
    if (query.length < 3) {
      setCompanyNameSuggestions([]);
      setCompanyNameLookupLoading(false);
      return;
    }

    let cancelled = false;
    const t = window.setTimeout(async () => {
      setCompanyNameLookupLoading(true);
      try {
        const res = await companyListPaginated({
          page: 1,
          limit: 5,
          search: query,
        });
        if (!cancelled) {
          setCompanyNameSuggestions(res.data);
        }
      } catch {
        if (!cancelled) {
          setCompanyNameSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setCompanyNameLookupLoading(false);
        }
      }
    }, COMPANY_NAME_LOOKUP_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [companyNameLookupQuery, open, step]);

  useEffect(() => {
    if (!open || step !== 0 || existingCompanyId) {
      setDomainMatches([]);
      return;
    }
    const domain = form.dominio.trim().toLowerCase();
    if (!domain || domain.length < 4) {
      setDomainMatches([]);
      return;
    }

    let cancelled = false;
    const t = window.setTimeout(async () => {
      setDomainLookupLoading(true);
      try {
        const res = await companyListPaginated({
          page: 1,
          limit: 5,
          search: domain,
        });
        if (!cancelled) {
          const filtered = res.data.filter(
            (c) => c.domain?.toLowerCase() === domain,
          );
          setDomainMatches(filtered);
        }
      } catch {
        if (!cancelled) setDomainMatches([]);
      } finally {
        if (!cancelled) setDomainLookupLoading(false);
      }
    }, COMPANY_NAME_LOOKUP_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.dominio, open, step, existingCompanyId]);

  function handleOpenChange(value: boolean) {
    onOpenChange(value);
    if (!value) {
      setSubmitting(false);
      setStep(0);
      setForm(mergeCompanyForm(undefined, currentUser, canReassign));
      setExistingCompanyId(null);
      setLoadedRucDigits(null);
      resetCompanyNameLookup();
      setDomainMatches([]);
      setDomainLookupLoading(false);
    }
  }

  function handleNext() {
    if (submitting) return;
    if (step === 0) {
      if (!form.nombreComercial.trim()) {
        toast.error('Nombre comercial es obligatorio');
        return;
      }
      if (!form.dominio.trim()) {
        toast.error('El dominio es obligatorio');
        return;
      }
      if (!form.origenLead) {
        toast.error('Selecciona la fuente del lead');
        return;
      }
      if (domainMatches.length > 0) {
        toast.error(domainConflictToastMessage(domainMatches[0], getUserName));
        return;
      }
      setForm((s) => ({
        ...s,
        nombreNegocio: s.nombreNegocio.trim() || s.nombreComercial.trim(),
      }));
    }
    if (step === 1) {
      if (!existingCompanyId) {
        if (showContactSection) {
          const contactName = form.contactoNombre.trim();
          const contactEmail = form.contactoCorreo.trim();
          const contactPhone = form.contactoTelefono.trim();
          const contactCargo = form.contactoCargo.trim();
          const startedContact = !!(contactName || contactEmail || contactPhone || contactCargo);
          if (startedContact && !contactName) {
            toast.error('Indica el nombre completo del contacto');
            return;
          }
          if (startedContact && !contactEmail) {
            toast.error('Indica el correo del contacto');
            return;
          }
          if (contactEmail && !contactEmail.includes('@')) {
            toast.error('El correo del contacto no es válido');
            return;
          }
        }
        const fact = Number(form.facturacion);
        if (!Number.isFinite(fact) || fact <= 0) {
          toast.error('La facturación estimada es obligatoria y debe ser mayor que 0');
          return;
        }
        if (!form.fechaCierre.trim()) {
          toast.error('Selecciona la fecha estimada de cierre de la oportunidad');
          return;
        }
      }
      setForm((s) => ({
        ...s,
        nombreNegocio: s.nombreNegocio.trim() || s.nombreComercial.trim(),
      }));
    }
    setStep((s) => s + 1);
  }

  async function handleSubmit() {
    if (submitting) return;
    if (!form.dominio.trim()) {
      toast.error('El dominio es obligatorio');
      return;
    }
    if (!form.nombreComercial.trim()) {
      toast.error('Nombre comercial es obligatorio');
      return;
    }
    if (!form.origenLead) {
      toast.error('Selecciona la fuente del lead');
      return;
    }
    if (domainMatches.length > 0) {
      toast.error(domainConflictToastMessage(domainMatches[0], getUserName));
      return;
    }
    const nombreNegocio = form.nombreNegocio.trim() || form.nombreComercial.trim();

    if (existingCompanyId) {
      setSubmitting(true);
      try {
        await Promise.resolve(
          onSubmit(
            { ...form, nombreNegocio },
            { mode: 'update', existingCompanyId },
          ),
        );
        setStep(0);
        setForm(mergeCompanyForm(undefined, currentUser, canReassign));
        setExistingCompanyId(null);
        setLoadedRucDigits(null);
        resetCompanyNameLookup();
        onOpenChange(false);
      } catch {
        /* el padre ya mostró el error */
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const fact = Number(form.facturacion);
    if (!Number.isFinite(fact) || fact <= 0) {
      toast.error('La facturación estimada es obligatoria y debe ser mayor que 0');
      return;
    }
    if (multiStep && !form.fechaCierre.trim()) {
      toast.error('Selecciona la fecha estimada de cierre de la oportunidad');
      return;
    }
    setSubmitting(true);
    try {
      await Promise.resolve(
        onSubmit({ ...form, nombreNegocio }, { mode: 'create' }),
      );
      setStep(0);
      setForm(mergeCompanyForm(undefined, currentUser, canReassign));
      setExistingCompanyId(null);
      setLoadedRucDigits(null);
      resetCompanyNameLookup();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear o resolver empresa';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const set = <K extends keyof NewCompanyData>(key: K, value: NewCompanyData[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const showCard =
    open &&
    (companyNameLookupLoading ||
      companyNameSuggestions.length > 0 ||
      companyNameLookupQuery.trim().length >= 3);

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
          onPrimary={step < 2 ? handleNext : () => void handleSubmit()}
          primaryLabel={step < 2 ? (
            <>Siguiente <ChevronRight className="size-4" /></>
          ) : (
            <span className="inline-flex items-center gap-2">
              {submitting ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : null}
              {existingCompanyId ? 'Actualizar empresa' : confirmButtonLabel}
            </span>
          )}
        />
      ) : (
        <FormDialogActions
          submitting={submitting}
          submitLabel={existingCompanyId ? 'Actualizar empresa' : confirmButtonLabel}
          onSubmit={() => void handleSubmit()}
        />
      )}
      appendContent={showCard ? (
        <div
          data-coincidences-card
          className="absolute right-full top-1/2 mr-2 w-80 -translate-y-1/2"
        >
          <div className="rounded-2xl border border-border/60 bg-background p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Coincidencias en el CRM</p>
                <p className="text-xs text-muted-foreground">
                  Escribe al menos 3 caracteres. Pulsa Enter para cargar la primera coincidencia.
                </p>
              </div>
              {companyNameLookupLoading ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : null}
            </div>
            {companyNameSuggestions.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                {companyNameSuggestions.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    className="flex w-full items-start justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted/70"
                    onClick={() =>
                      applyCompanyRecord(
                        company,
                        'Empresa encontrada: datos cargados desde el sistema',
                      )
                    }
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{company.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {company.razonSocial?.trim() || 'Sin razón social'}
                      </p>
                    </div>
                    <div className="ml-4 shrink-0 text-right text-xs text-muted-foreground">
                      <p>{company.ruc?.trim() || 'Sin RUC'}</p>
                      <p>{company.domain?.trim() || 'Sin dominio'}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
            {!companyNameLookupLoading &&
            companyNameLookupQuery.trim().length >= 3 &&
            companyNameSuggestions.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                No se encontraron coincidencias para esa búsqueda.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    >
      <div className={multiStep ? 'space-y-6' : 'space-y-3.5'}>
        {multiStep ? (
          <div className="flex items-center justify-center gap-0">
            {steps.map((s, i) => (
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
                {i < steps.length - 1 && (
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

        {(!multiStep || step === 0) && (
          <FormDialogGrid>
            <FormDialogField label="RUC" compactControl={false}>
              <div className="relative">
                <Input
                  className={cn(formDialogInputClass, 'pr-10')}
                  placeholder="20XXXXXXXXX"
                  maxLength={11}
                  value={form.ruc}
                  onChange={(e) => {
                    const v = e.target.value;
                    set('ruc', v);
                    const norm = v.replace(/\D/g, '');
                    if (
                      existingCompanyId &&
                      loadedRucDigits &&
                      norm !== loadedRucDigits
                    ) {
                      setExistingCompanyId(null);
                      setLoadedRucDigits(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    const val = (e.currentTarget as HTMLInputElement).value;
                    if (e.key === 'Enter' && val.trim().replace(/\D/g, '').length === 11) {
                      e.preventDefault();
                      void handleRucLookup(val);
                    }
                  }}
                />
                <div className="absolute top-1/2 right-0.5 z-10 -translate-y-1/2">
                  {rucLookupLoading ? (
                    <div className="flex size-8 items-center justify-center" aria-hidden>
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label="Buscar empresa por RUC"
                      onClick={() => void handleRucLookup()}
                    >
                      <Search className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </FormDialogField>
            <FormDialogField label="Razón social">
              <Input
                className={formDialogInputClass}
                placeholder="Razón social - Enter para cargar coincidencia"
                value={form.razonSocial}
                onChange={(e) => {
                  const value = e.target.value;
                  set('razonSocial', value);
                  setCompanyNameLookupQuery(value);
                }}
                onKeyDown={(e) => {
                  const value = (e.currentTarget as HTMLInputElement).value;
                  if (e.key === 'Enter' && value.trim().length >= 3) {
                    e.preventDefault();
                    void searchCompaniesByName(value, { loadFirstMatch: true });
                  }
                }}
              />
            </FormDialogField>
            <FormDialogField label="Nombre comercial" required>
              <Input
                className={formDialogInputClass}
                placeholder="Nombre comercial - Enter para cargar coincidencia"
                value={form.nombreComercial}
                onChange={(e) => {
                  const value = e.target.value;
                  set('nombreComercial', value);
                  setCompanyNameLookupQuery(value);
                }}
                onKeyDown={(e) => {
                  const value = (e.currentTarget as HTMLInputElement).value;
                  if (e.key === 'Enter' && value.trim().length >= 3) {
                    e.preventDefault();
                    void searchCompaniesByName(value, { loadFirstMatch: true });
                  }
                }}
              />
            </FormDialogField>
            <FormDialogField label="Teléfono empresa">
              <Input
                className={formDialogInputClass}
                placeholder="+51 999 999 999"
                value={form.telefono}
                onChange={(e) => set('telefono', e.target.value)}
              />
            </FormDialogField>
            <FormDialogField label="Rubro de la empresa">
              <Select value={form.rubro} onValueChange={(v) => set('rubro', v as CompanyRubro)}>
                <SelectTrigger className={formDialogSelectTriggerClass}>
                  <SelectValue placeholder="Seleccionar rubro" />
                </SelectTrigger>
                <SelectContent>
                  {rubroOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormDialogField>
            <FormDialogField label="Tipo de empresa">
              <Select value={form.tipoEmpresa} onValueChange={(v) => set('tipoEmpresa', v as CompanyTipo)}>
                <SelectTrigger className={formDialogSelectTriggerClass}>
                  <SelectValue placeholder="-- Seleccionar --" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(companyTipoLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormDialogField>
            <FormDialogField label="Dominio" required>
              <Input
                className={formDialogInputClass}
                placeholder="empresa.com"
                value={form.dominio}
                onChange={(e) => set('dominio', e.target.value)}
              />
            </FormDialogField>
            <FormDialogField label="Fuente" required>
              <Select value={form.origenLead} onValueChange={(v) => set('origenLead', v as ContactSource)}>
                <SelectTrigger className={formDialogSelectTriggerClass}>
                  <SelectValue placeholder="Seleccionar fuente" />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormDialogField>
            <AssignedAdvisorFormField
              htmlId="company-wizard-propietario"
              value={form.propietario}
              onChange={(v) => set('propietario', v)}
              assignModule="empresas"
              disabled={false}
              fallbackName={currentUser.name}
              label="Propietario"
              formStyle
            />
            <FormDialogField label="Cliente recuperado">
              <Select value={form.clienteRecuperado} onValueChange={(v) => set('clienteRecuperado', v as 'si' | 'no')}>
                <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="si">Sí</SelectItem>
                </SelectContent>
              </Select>
            </FormDialogField>
            {!multiStep ? (
              <>
                <FormDialogField label="Etapa">
                  <Select value={form.etapa} onValueChange={(v) => set('etapa', v as Etapa)}>
                    <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {stageOptions.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormDialogField>
                <FormDialogField label="Facturación estimada (S/)" required>
                  <Input
                    className={formDialogInputClass}
                    type="number"
                    min={0.01}
                    step="0.01"
                    placeholder="Mayor que 0"
                    value={form.facturacion}
                    onChange={(e) => set('facturacion', e.target.value)}
                  />
                </FormDialogField>
              </>
            ) : null}
          </FormDialogGrid>
        )}

        {multiStep && step === 1 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground/80">Contacto</p>
              <FormDialogGrid>
                <FormDialogField label="Nombre completo">
                  <Input
                    className={formDialogInputClass}
                    placeholder="Nombre del contacto"
                    value={form.contactoNombre}
                    onChange={(e) => set('contactoNombre', e.target.value)}
                    disabled={!!existingCompanyId}
                  />
                </FormDialogField>
                <FormDialogField label="Cargo">
                  <Input
                    className={formDialogInputClass}
                    placeholder="Ej: Gerente de Compras"
                    value={form.contactoCargo}
                    onChange={(e) => set('contactoCargo', e.target.value)}
                    disabled={!!existingCompanyId}
                  />
                </FormDialogField>
                <FormDialogField label="Teléfono contacto">
                  <Input
                    className={formDialogInputClass}
                    placeholder="+51 999 999 999"
                    value={form.contactoTelefono}
                    onChange={(e) => set('contactoTelefono', e.target.value)}
                    disabled={!!existingCompanyId}
                  />
                </FormDialogField>
                <FormDialogField label="Correo contacto">
                  <Input
                    className={formDialogInputClass}
                    type="email"
                    placeholder="email@empresa.com"
                    value={form.contactoCorreo}
                    onChange={(e) => set('contactoCorreo', e.target.value)}
                    disabled={!!existingCompanyId}
                  />
                </FormDialogField>
              </FormDialogGrid>
            </div>

            <div
              className={cn(
                'space-y-3',
                existingCompanyId && 'pointer-events-none opacity-60',
              )}
              aria-disabled={existingCompanyId ? true : undefined}
            >
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground/80">Oportunidad</p>
                {existingCompanyId ? (
                  <p className="text-xs text-muted-foreground">
                    Esta empresa ya está en el sistema: solo se actualizarán los datos de la cuenta.
                    La sección de oportunidad no aplica en este flujo.
                  </p>
                ) : null}
              </div>
              <FormDialogGrid>
                <FormDialogField label="Nombre de la oportunidad">
                  <Input
                    className={formDialogInputClass}
                    placeholder="Nombre de la oportunidad"
                    value={form.nombreNegocio || form.nombreComercial}
                    onChange={(e) => set('nombreNegocio', e.target.value)}
                  />
                </FormDialogField>
                <FormDialogField label="Etapa">
                  <Select value={form.etapa} onValueChange={(v) => set('etapa', v as Etapa)}>
                    <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {stageOptions.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormDialogField>
                <FormDialogField label="Facturación estimada (S/)" required>
                  <Input
                    className={formDialogInputClass}
                    type="number"
                    min={0.01}
                    step="0.01"
                    placeholder="Mayor que 0"
                    value={form.facturacion}
                    onChange={(e) => set('facturacion', e.target.value)}
                  />
                </FormDialogField>
                <FormDialogField label="Fecha de cierre" required>
                  <Input
                    className={formDialogInputClass}
                    type="date"
                    value={form.fechaCierre}
                    onChange={(e) => set('fechaCierre', e.target.value)}
                  />
                </FormDialogField>
              </FormDialogGrid>
            </div>
          </div>
        )}

        {(!multiStep || step === 2) && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground/80">Ubicación</p>
            <FormDialogGrid>
              <FormDialogField label="Distrito">
                <Input
                  className={formDialogInputClass}
                  placeholder="Ej: Surco"
                  value={form.distrito}
                  onChange={(e) => set('distrito', e.target.value)}
                />
              </FormDialogField>
              <FormDialogField label="Provincia">
                <Input
                  className={formDialogInputClass}
                  placeholder="Ej: Lima"
                  value={form.provincia}
                  onChange={(e) => set('provincia', e.target.value)}
                />
              </FormDialogField>
              <FormDialogField label="Departamento">
                <Input
                  className={formDialogInputClass}
                  placeholder="Ej: Lima"
                  value={form.departamento}
                  onChange={(e) => set('departamento', e.target.value)}
                />
              </FormDialogField>
              <FormDialogField label="Dirección">
                <Input
                  className={formDialogInputClass}
                  placeholder="Ej: Av. Primavera 1234"
                  value={form.direccion}
                  onChange={(e) => set('direccion', e.target.value)}
                />
              </FormDialogField>
              <FormDialogField label="LinkedIn">
                <Input
                  className={formDialogInputClass}
                  placeholder="https://www.linkedin.com/company/..."
                  value={form.linkedin}
                  onChange={(e) => set('linkedin', e.target.value)}
                />
              </FormDialogField>
            </FormDialogGrid>
          </div>
        )}
      </div>
    </FormDialogShell>

    {domainMatches.length > 0 && !domainLookupLoading && createPortal(
      <div className="fixed left-1/2 top-14 z-50 -translate-x-1/2 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300 ease-out">
        <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2.5 shadow-lg">
          <svg className="size-4 shrink-0 text-yellow-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <div className="text-sm">
            <span className="font-semibold text-yellow-800">Este dominio ya existe</span>
            {(() => {
              const { companyName, advisorName } = domainConflictCopy(domainMatches[0], getUserName);
              return (
                <>
                  <span className="block text-yellow-700">
                    Empresa: {companyName}
                    {domainMatches[0].ruc ? ` · RUC ${domainMatches[0].ruc}` : ''}
                  </span>
                  <span className="block text-yellow-700">Asesor: {advisorName}</span>
                </>
              );
            })()}
          </div>
        </div>
      </div>,
      document.body,
    )}
    </>
  );
}
