import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useCrmConfigStore, getLeadSourceOptionsFromCatalog } from '@/store/crmConfigStore';
import { Check, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { toast } from '@/lib/notify';
import { factilizaApi } from '@/lib/factilizaApi';
import type { CompanyRubro, CompanyTipo, ContactSource, Etapa } from '@/types';
import { companyRubroLabels, companyTipoLabels, etapaLabels, contactSourceLabels } from '@/data/mock';
import { useAppStore } from '@/store';
import { canUserReassignCommercialAdvisor, resolveAdvisorAssigneeId } from '@/lib/advisorAssigneeDefaults';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FormDialogShell,
  FormDialogWizardFooter,
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

export type { NewCompanyData };

const emptyForm = emptyNewCompanyForm;

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
}

const steps = [
  { label: 'Identificación' },
  { label: 'Ubicación y Contacto' },
  { label: 'Oportunidad' },
];
const COMPANY_NAME_LOOKUP_DEBOUNCE_MS = 700;

function mergeCompanyForm(
  defaults?: Partial<NewCompanyData>,
  currentUser?: { id: string; role?: string },
): NewCompanyData {
  const merged = { ...emptyForm, ...defaults };
  merged.propietario = resolveAdvisorAssigneeId(defaults?.propietario ?? merged.propietario, {
    id: currentUser?.id ?? '',
    role: currentUser?.role,
  });
  return merged;
}

export function NewCompanyWizard({
  open,
  onOpenChange,
  onSubmit,
  title = 'Nueva Empresa',
  description = 'Registra una nueva empresa en el sistema.',
  defaultValues,
  confirmButtonLabel = 'Crear Empresa',
}: NewCompanyWizardProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const canReassign = canUserReassignCommercialAdvisor(currentUser.role);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<NewCompanyData>(() => mergeCompanyForm(defaultValues, currentUser));
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
    setForm(mergeCompanyForm(defaultValues, currentUser));
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
      setForm(mergeCompanyForm(undefined, currentUser));
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
        toast.error('Este dominio ya existe. Usa otro dominio o actualiza la empresa existente.');
        return;
      }
    }
    if (step === 1) {
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
      toast.error('Este dominio ya existe. Usa otro dominio o actualiza la empresa existente.');
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
        setForm(mergeCompanyForm(undefined, currentUser));
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
    if (!form.fechaCierre.trim()) {
      toast.error('Selecciona la fecha estimada de cierre de la oportunidad');
      return;
    }
    setSubmitting(true);
    try {
      await Promise.resolve(
        onSubmit({ ...form, nombreNegocio }, { mode: 'create' }),
      );
      setStep(0);
      setForm(mergeCompanyForm(undefined, currentUser));
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
      title={title}
      description={description}
      footer={(
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
      )}
      appendContent={showCard ? (
        <div
          data-coincidences-card
          className="absolute right-full top-1/2 -translate-y-1/2 mr-2 w-80"
        >
          <div className="rounded-lg border bg-background p-4 shadow-lg">
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
              <div className="mt-3 space-y-2">
                {companyNameSuggestions.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    className="flex w-full items-start justify-between rounded-md border bg-background px-3 py-2 text-left transition-colors hover:bg-accent"
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
        <div className="space-y-6">
          <div className="flex items-center justify-center gap-0 py-2">
            {steps.map((s, i) => (
              <div key={s.label} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { if (i < step) setStep(i); }}
                    className={`flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                      i < step
                        ? 'border-[#13944C] bg-[#13944C] text-white'
                        : i === step
                          ? 'border-[#13944C] bg-white text-[#13944C]'
                          : 'border-muted-foreground/30 bg-muted text-muted-foreground'
                    }`}
                  >
                    {i < step ? <Check className="size-4" /> : i + 1}
                  </button>
                  <span className={`text-xs whitespace-nowrap ${i === step ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`mx-2 mb-5 h-0.5 w-12 sm:w-16 ${i < step ? 'bg-[#13944C]' : 'bg-muted-foreground/20'}`} />
                )}
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>RUC</Label>
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
                  <div className="absolute right-0.5 top-1/2 z-10 -translate-y-1/2">
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
              </div>
              <div className="space-y-2">
                <Label>Razón social</Label>
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
              </div>
              <div className="space-y-2">
                <Label>Nombre comercial <span className="text-destructive">*</span></Label>
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
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input className={formDialogInputClass} placeholder="+51 999 999 999" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rubro de la empresa</Label>
                <Select value={form.rubro} onValueChange={(v) => set('rubro', v as CompanyRubro)}>
                  <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue placeholder="Seleccionar rubro" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(companyRubroLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de empresa</Label>
                <Select value={form.tipoEmpresa} onValueChange={(v) => set('tipoEmpresa', v as CompanyTipo)}>
                  <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue placeholder="-- Seleccionar --" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(companyTipoLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dominio <span className="text-destructive">*</span></Label>
                <Input className={formDialogInputClass} placeholder="empresa.com" value={form.dominio} onChange={(e) => set('dominio', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fuente <span className="text-destructive">*</span></Label>
                <Select value={form.origenLead} onValueChange={(v) => set('origenLead', v as ContactSource)}>
                  <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue placeholder="Seleccionar fuente" /></SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Distrito</Label>
                <Input className={formDialogInputClass} placeholder="Ej: Surco" value={form.distrito} onChange={(e) => set('distrito', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Provincia</Label>
                <Input className={formDialogInputClass} placeholder="Ej: Lima" value={form.provincia} onChange={(e) => set('provincia', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input className={formDialogInputClass} placeholder="Ej: Lima" value={form.departamento} onChange={(e) => set('departamento', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input className={formDialogInputClass} placeholder="Ej: Av. Primavera 1234" value={form.direccion} onChange={(e) => set('direccion', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>LinkedIn</Label>
                <Input className={formDialogInputClass} placeholder="https://www.linkedin.com/company/..." value={form.linkedin} onChange={(e) => set('linkedin', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Correo</Label>
                <Input className={formDialogInputClass} type="email" placeholder="contacto@empresa.com" value={form.correo} onChange={(e) => set('correo', e.target.value)} />
              </div>
              <AssignedAdvisorFormField
                htmlId="company-wizard-propietario"
                value={form.propietario}
                onChange={(v) => set('propietario', v)}
                disabled={!canReassign}
                fallbackName={currentUser.name}
                label="Propietario"
                formStyle
              />
              <div className="space-y-2">
                <Label>Cliente Recuperado</Label>
                <Select value={form.clienteRecuperado} onValueChange={(v) => set('clienteRecuperado', v as 'si' | 'no')}>
                  <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="si">Sí</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div
              className={cn(
                'grid gap-4 grid-cols-2',
                existingCompanyId && 'pointer-events-none opacity-60',
              )}
              aria-disabled={existingCompanyId ? true : undefined}
            >
              {existingCompanyId ? (
                <p className="col-span-2 text-sm text-muted-foreground">
                  Esta empresa ya está en el sistema: solo se actualizarán los datos de la cuenta.
                  La sección de oportunidad no aplica en este flujo.
                </p>
              ) : null}
              <div className="space-y-2">
                <Label>Nombre de la oportunidad</Label>
                <Input className={formDialogInputClass} placeholder="Nombre de la oportunidad" value={form.nombreNegocio} onChange={(e) => set('nombreNegocio', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Etapa</Label>
                <Select value={form.etapa} onValueChange={(v) => set('etapa', v as Etapa)}>
                  <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stageOptions.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Facturación estimada (S/) <span className="text-destructive">*</span></Label>
                <Input className={formDialogInputClass} type="number" min={0.01} step="0.01" placeholder="Mayor que 0" value={form.facturacion} onChange={(e) => set('facturacion', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Cierre</Label>
                <Input className={formDialogInputClass} type="date" value={form.fechaCierre} onChange={(e) => set('fechaCierre', e.target.value)} />
              </div>
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
            <span className="block text-yellow-700">
              {domainMatches[0].name}{domainMatches[0].ruc ? ` — RUC ${domainMatches[0].ruc}` : ''}
            </span>
          </div>
        </div>
      </div>,
      document.body,
    )}
    </>
  );
}
