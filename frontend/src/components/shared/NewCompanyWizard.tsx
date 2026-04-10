import { useState, useEffect, useMemo } from 'react';
import { useCrmConfigStore } from '@/store/crmConfigStore';
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { factilizaApi } from '@/lib/factilizaApi';
import type { CompanyRubro, CompanyTipo, ContactSource, Etapa } from '@/types';
import { companyRubroLabels, companyTipoLabels, etapaLabels, contactSourceLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
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
  onSubmit: (data: NewCompanyData, meta: NewCompanyWizardSubmitMeta) => void;
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

function mergeCompanyForm(defaults?: Partial<NewCompanyData>): NewCompanyData {
  return { ...emptyForm, ...defaults };
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
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<NewCompanyData>(() => mergeCompanyForm(defaultValues));
  const [rucLookupLoading, setRucLookupLoading] = useState(false);
  const [companyNameLookupLoading, setCompanyNameLookupLoading] = useState(false);
  const [companyNameSuggestions, setCompanyNameSuggestions] = useState<ApiCompanyRecord[]>([]);
  const [companyNameLookupQuery, setCompanyNameLookupQuery] = useState('');
  const [existingCompanyId, setExistingCompanyId] = useState<string | null>(null);
  const [loadedRucDigits, setLoadedRucDigits] = useState<string | null>(null);
  const { activeAdvisors } = useUsers();
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

  const sourceOptions = useMemo(() => {
    const src = bundle?.catalog.leadSources
      .filter((x) => x.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (src?.length) {
      return src.map((s) => ({ value: s.slug, label: s.name }));
    }
    return Object.entries(contactSourceLabels).map(([value, label]) => ({ value, label }));
  }, [bundle]);

  function resetCompanyNameLookup() {
    setCompanyNameLookupLoading(false);
    setCompanyNameSuggestions([]);
    setCompanyNameLookupQuery('');
  }

  function applyCompanyRecord(record: ApiCompanyRecord, successMessage: string) {
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
      if (!opts?.silent) {
        toast.error(
          err instanceof Error
            ? err.message
            : 'No se pudo buscar empresas por nombre o razón social',
        );
      }
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
          toast.error(
            err instanceof Error ? err.message : 'No se pudo buscar la empresa por RUC',
          );
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
      toast.error(err instanceof Error ? err.message : 'No se pudo consultar el RUC');
    } finally {
      setRucLookupLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setForm(mergeCompanyForm(defaultValues));
    setStep(0);
    setExistingCompanyId(null);
    setLoadedRucDigits(null);
    resetCompanyNameLookup();
    // defaultValues se fija al abrir desde el padre; no incluir en deps para evitar resets por referencia nueva
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function handleOpenChange(value: boolean) {
    onOpenChange(value);
    if (!value) {
      setStep(0);
      setForm({ ...emptyForm });
      setExistingCompanyId(null);
      setLoadedRucDigits(null);
      resetCompanyNameLookup();
    }
  }

  function handleNext() {
    if (step === 0 && (!form.ruc.trim() || !form.nombreComercial.trim())) {
      toast.error('RUC y Nombre comercial son obligatorios');
      return;
    }
    if (step === 1) {
      if (!form.origenLead) {
        toast.error('Selecciona la fuente del lead');
        return;
      }
      setForm((s) => ({
        ...s,
        nombreNegocio: s.nombreNegocio.trim() || s.nombreComercial.trim(),
      }));
    }
    setStep((s) => s + 1);
  }

  function handleSubmit() {
    if (!form.ruc.trim() || !form.nombreComercial.trim()) {
      toast.error('RUC y Nombre comercial son obligatorios');
      return;
    }
    if (!form.origenLead) {
      toast.error('Selecciona la fuente del lead');
      return;
    }
    const nombreNegocio = form.nombreNegocio.trim() || form.nombreComercial.trim();

    if (existingCompanyId) {
      onSubmit(
        { ...form, nombreNegocio },
        { mode: 'update', existingCompanyId },
      );
      setStep(0);
      setForm({ ...emptyForm });
      setExistingCompanyId(null);
      setLoadedRucDigits(null);
      onOpenChange(false);
      return;
    }

    const fact = Number(form.facturacion);
    if (!Number.isFinite(fact) || fact <= 0) {
      toast.error('La facturación estimada es obligatoria y debe ser mayor que 0');
      return;
    }
    onSubmit({ ...form, nombreNegocio }, { mode: 'create' });
    setStep(0);
    setForm({ ...emptyForm });
    setExistingCompanyId(null);
    setLoadedRucDigits(null);
    onOpenChange(false);
  }

  const set = <K extends keyof NewCompanyData>(key: K, value: NewCompanyData[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

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

        <div className="space-y-4">
          {step === 0 && (
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>RUC <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    placeholder="20XXXXXXXXX — Enter para buscar"
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
                        handleRucLookup(val);
                      }
                    }}
                  />
                  {rucLookupLoading && (
                    <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Razón social</Label>
                <Input
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
              {(companyNameLookupLoading ||
                companyNameSuggestions.length > 0 ||
                companyNameLookupQuery.trim().length >= 3) && (
                <div className="col-span-2 rounded-md border bg-muted/20 p-3">
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
              )}
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input placeholder="+51 999 999 999" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rubro de la empresa</Label>
                <Select value={form.rubro} onValueChange={(v) => set('rubro', v as CompanyRubro)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar rubro" /></SelectTrigger>
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
                  <SelectTrigger className="w-full"><SelectValue placeholder="-- Seleccionar --" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(companyTipoLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
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
                <Input placeholder="Ej: Surco" value={form.distrito} onChange={(e) => set('distrito', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Provincia</Label>
                <Input placeholder="Ej: Lima" value={form.provincia} onChange={(e) => set('provincia', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input placeholder="Ej: Lima" value={form.departamento} onChange={(e) => set('departamento', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input placeholder="Ej: Av. Primavera 1234" value={form.direccion} onChange={(e) => set('direccion', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Dominio</Label>
                <Input placeholder="empresa.com" value={form.dominio} onChange={(e) => set('dominio', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>LinkedIn</Label>
                <Input placeholder="https://www.linkedin.com/company/..." value={form.linkedin} onChange={(e) => set('linkedin', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Correo</Label>
                <Input type="email" placeholder="contacto@empresa.com" value={form.correo} onChange={(e) => set('correo', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fuente <span className="text-destructive">*</span></Label>
                <Select value={form.origenLead} onValueChange={(v) => set('origenLead', v as ContactSource)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar fuente" /></SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Propietario</Label>
                <Select value={form.propietario} onValueChange={(v) => set('propietario', v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar asesor" /></SelectTrigger>
                  <SelectContent>
                    {activeAdvisors.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cliente Recuperado</Label>
                <Select value={form.clienteRecuperado} onValueChange={(v) => set('clienteRecuperado', v as 'si' | 'no')}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
                <Input placeholder="Nombre de la oportunidad" value={form.nombreNegocio} onChange={(e) => set('nombreNegocio', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Etapa</Label>
                <Select value={form.etapa} onValueChange={(v) => set('etapa', v as Etapa)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stageOptions.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Facturación estimada (S/) <span className="text-destructive">*</span></Label>
                <Input type="number" min={0.01} step="0.01" placeholder="Mayor que 0" value={form.facturacion} onChange={(e) => set('facturacion', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Cierre</Label>
                <Input type="date" value={form.fechaCierre} onChange={(e) => set('fechaCierre', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <div>
            {step > 0 && (
              <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="size-4" /> Anterior
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
            {step < 2 ? (
              <Button type="button" className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={handleNext}>
                Siguiente <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button type="button" className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={handleSubmit}>
                {existingCompanyId ? 'Actualizar empresa' : confirmButtonLabel}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
