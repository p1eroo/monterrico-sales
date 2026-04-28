import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useCrmConfigStore } from '@/store/crmConfigStore';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, Loader2, Building2, Link2, Briefcase, Search, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { Etapa, ContactSource } from '@/types';
import { contactSourceLabels, etapaLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { companyListAll, type ApiCompanyRecord } from '@/lib/companyApi';
import { opportunityListAll, type ApiOpportunityListRow } from '@/lib/opportunityApi';
import { factilizaApi } from '@/lib/factilizaApi';

/** Convierte "APELLIDO APELLIDO, NOMBRES" → "Nombres Apellido Apellido" con mayúscula inicial */
function formatNombreCompleto(nombreCompleto: string): string {
  const commaIdx = nombreCompleto.indexOf(',');
  if (commaIdx === -1) {
    return toTitleCase(nombreCompleto);
  }
  const apellidos = nombreCompleto.slice(0, commaIdx).trim();
  const nombres = nombreCompleto.slice(commaIdx + 1).trim();
  const ordenado = `${nombres} ${apellidos}`.trim();
  return toTitleCase(ordenado);
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

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
  NewCompanyWizard,
  type NewCompanyData,
  type NewCompanyWizardSubmitMeta,
} from '@/components/shared/NewCompanyWizard';

export interface NewContactData {
  name: string;
  cargo?: string;
  docType?: 'dni' | 'cee';
  docNumber?: string;
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
  title = 'Nuevo Contacto',
  description = 'Registra un nuevo prospecto en el sistema.',
  submitLabel = 'Crear Contacto',
  defaultValues,
  lockCompanySelection = false,
  defaultCompanyId,
  defaultOpportunityIds = [],
}: NewContactWizardProps) {
  const defaultValuesRef = useRef(defaultValues);
  defaultValuesRef.current = defaultValues;
  const defaultCompanyIdRef = useRef(defaultCompanyId);
  defaultCompanyIdRef.current = defaultCompanyId;
  const defaultOpportunityIdsRef = useRef(defaultOpportunityIds);
  defaultOpportunityIdsRef.current = defaultOpportunityIds;
  const lockCompanySelectionRef = useRef(lockCompanySelection);
  lockCompanySelectionRef.current = lockCompanySelection;

  const [step, setStep] = useState(0);
  const [name, setName] = useState(defaultValues?.name ?? '');
  const [cargo, setCargo] = useState(defaultValues?.cargo ?? '');
  const [docType, setDocType] = useState<'dni' | 'cee' | ''>(defaultValues?.docType ?? '');
  const [docNumber, setDocNumber] = useState(defaultValues?.docNumber ?? '');
  const [company, setCompany] = useState(defaultValues?.company ?? '');
  const [companyId, setCompanyId] = useState<string | null>(defaultValues?.companyId ?? null);
  const [apiCompanies, setApiCompanies] = useState<ApiCompanyRecord[]>([]);
  const [etapaCiclo, setEtapaCiclo] = useState<Etapa>(defaultValues?.etapaCiclo ?? 'lead');
  const [phone, setPhone] = useState(defaultValues?.phone ?? '');
  const [email, setEmail] = useState(defaultValues?.email ?? '');
  const [source, setSource] = useState<ContactSource>(defaultValues?.source ?? 'base');
  const [assignedTo, setAssignedTo] = useState(defaultValues?.assignedTo ?? '');
  const [clienteRecuperado, setClienteRecuperado] = useState<'si' | 'no'>(defaultValues?.clienteRecuperado ?? 'no');
  const [departamento, setDepartamento] = useState(defaultValues?.departamento ?? '');
  const [provincia, setProvincia] = useState(defaultValues?.provincia ?? '');
  const [distrito, setDistrito] = useState(defaultValues?.distrito ?? '');
  const [direccion, setDireccion] = useState(defaultValues?.direccion ?? '');
  const [docLookupLoading, setDocLookupLoading] = useState(false);
  const [apiOpportunities, setApiOpportunities] = useState<ApiOpportunityListRow[]>([]);
  const [assocPanelOpen, setAssocPanelOpen] = useState(false);
  const [assocCategory, setAssocCategory] = useState<'empresas' | 'oportunidades'>(() =>
    (lockCompanySelection ? 'oportunidades' : 'empresas'),
  );
  const [assocSearch, setAssocSearch] = useState('');
  const assocPickerRef = useRef<HTMLDivElement>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(defaultCompanyId ?? null);
  const [selectedOpportunityIds, setSelectedOpportunityIds] = useState<string[]>(defaultOpportunityIds);
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
    setDocType(d?.docType ?? '');
    setDocNumber(d?.docNumber ?? '');
    setCompany(d?.company ?? '');
    setCompanyId(d?.companyId ?? null);
    setEtapaCiclo(d?.etapaCiclo ?? 'lead');
    setPhone(d?.phone ?? '');
    setEmail(d?.email ?? '');
    setSource(d?.source ?? 'base');
    setAssignedTo(d?.assignedTo ?? '');
    setClienteRecuperado(d?.clienteRecuperado ?? 'no');
    setDepartamento(d?.departamento ?? '');
    setProvincia(d?.provincia ?? '');
    setDistrito(d?.distrito ?? '');
    setDireccion(d?.direccion ?? '');
    setPendingNewCompany(null);
    setWizardCompanyPatchId(null);
    setCompanyWizardOpen(false);
    setCompanyWizardDefaults({});
    setAssocPanelOpen(false);
    setAssocCategory(lockCo ? 'oportunidades' : 'empresas');
    setAssocSearch('');
    setSelectedCompanyId(lockCo ? (defCo ?? null) : (defCo ?? d?.companyId ?? null));
    setSelectedOpportunityIds([...defOpps]);
  }, []);

  useEffect(() => {
    if (!open) return;
    const d = defaultValuesRef.current;
    const defCo = defaultCompanyId;
    const defOpps = defaultOpportunityIds ?? [];
    if (lockCompanySelection) {
      setSelectedCompanyId(defCo ?? null);
      setAssocCategory('oportunidades');
    } else {
      setSelectedCompanyId(defCo ?? d?.companyId ?? null);
      setAssocCategory('empresas');
    }
    setSelectedOpportunityIds([...defOpps]);
  }, [open, defaultCompanyId, lockCompanySelection, (defaultOpportunityIds ?? []).join(',')]);

  const assocCompanyCount = apiCompanies.length;
  const assocOppCount = apiOpportunities.length;

  useEffect(() => {
    if (!assocPanelOpen) return;
    function onMouseDown(e: MouseEvent) {
      const root = assocPickerRef.current;
      if (root && !root.contains(e.target as Node)) {
        setAssocPanelOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setAssocPanelOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [assocPanelOpen]);

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

  async function handleDocLookup() {
    if (!docType || !docNumber.trim()) {
      toast.error('Selecciona tipo de documento e ingresa el número');
      return;
    }
    setDocLookupLoading(true);
    try {
      if (docType === 'dni') {
        const data = await factilizaApi.consultarDni(docNumber);
        setName(data.nombre_completo ? formatNombreCompleto(data.nombre_completo) : '');
        setDepartamento(data.departamento ?? '');
        setProvincia(data.provincia ?? '');
        setDistrito(data.distrito ?? '');
        setDireccion(data.direccion_completa ?? data.direccion ?? '');
      } else {
        const data = await factilizaApi.consultarCee(docNumber);
        const raw =
          data.nombre_completo?.trim() ||
          [data.apellido_paterno, data.apellido_materno, data.nombres].filter(Boolean).join(' ');
        setName(raw ? formatNombreCompleto(raw) : '');
      }
      toast.success('Datos cargados correctamente');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo consultar el documento');
    } finally {
      setDocLookupLoading(false);
    }
  }

  useEffect(() => {
    if (!open || lockCompanySelection) return;
    let cancelled = false;
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
  }, [open, lockCompanySelection]);

  useEffect(() => {
    if (!open) return;
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
      if (!name.trim() || !company.trim()) {
        toast.error('Nombre y empresa son requeridos');
        return;
      }
      if (!phone.trim()) {
        toast.error('El teléfono es obligatorio');
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
    if (!name.trim() || !company.trim()) {
      toast.error('Nombre y empresa son requeridos');
      return;
    }
    if (!phone.trim()) {
      toast.error('El teléfono es obligatorio');
      return;
    }
    if (!email.trim()) {
      toast.error('El correo es obligatorio');
      return;
    }
    const finalCompanyId = selectedCompanyId || companyId;
    onSubmit({
      name: name.trim(),
      cargo: cargo.trim() || undefined,
      docType: docType || undefined,
      docNumber: docNumber.trim() || undefined,
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-0 py-2">
          {WIZARD_STEPS.map((s, i) => (
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
              {i < WIZARD_STEPS.length - 1 && (
                <div className={`mx-2 mb-5 h-0.5 w-12 sm:w-16 ${i < step ? 'bg-[#13944C]' : 'bg-muted-foreground/20'}`} />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <Select value={docType} onValueChange={(v) => { setDocType(v as 'dni' | 'cee'); setDocNumber(''); }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dni">DNI</SelectItem>
                    <SelectItem value="cee">CEE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>N° de {docType === 'dni' ? 'DNI' : docType === 'cee' ? 'CEE' : 'documento'}</Label>
                <div className="relative">
                  <Input
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && docType && docNumber.trim()) {
                        e.preventDefault();
                        handleDocLookup();
                      }
                    }}
                    placeholder={docType === 'dni' ? '12345678 — Enter para buscar' : docType === 'cee' ? '001234567890 — Enter para buscar' : 'Selecciona un tipo'}
                    maxLength={docType === 'dni' ? 8 : 12}
                    disabled={!docType}
                  />
                  {docLookupLoading && (
                    <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nombre completo *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del contacto" />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ej: Gerente de Compras" />
              </div>
<div className="space-y-2 sm:col-span-2">
  <div className="flex items-center justify-between">
    <Label className="flex items-center gap-1.5">
      <Link2 className="size-3.5" /> Asociaciones
    </Label>
    {(selectedCompanyId || selectedOpportunityIds.length > 0) && (
      <span className="text-xs text-muted-foreground">
        {(selectedCompanyId ? 1 : 0) + selectedOpportunityIds.length} registro
        {(selectedCompanyId ? 1 : 0) + selectedOpportunityIds.length !== 1 ? 's' : ''}
      </span>
    )}
  </div>

  {(selectedCompanyId || selectedOpportunityIds.length > 0) && (
    <div className="flex flex-wrap gap-1.5">
      {selectedCompanyId && (() => {
        const comp = apiCompanies.find((c) => c.id === selectedCompanyId);
        const label = comp?.name ?? (company.trim() || 'Empresa');
        return (
          <div
            key={`company-${selectedCompanyId}`}
            className="flex items-center gap-1 rounded-md border border-input bg-muted/60 px-2 py-1 text-xs"
          >
            <Building2 className="size-3" />
            <span className="truncate max-w-[120px]">{label}</span>
            {!lockCompanySelection && (
              <button
                type="button"
                className="ml-0.5 rounded-sm hover:bg-muted p-0.5"
                onClick={() => setSelectedCompanyId(null)}
              >
                <span className="text-xs leading-none">&times;</span>
              </button>
            )}
          </div>
        );
      })()}
      {selectedOpportunityIds.map((oppId) => {
        const opp = apiOpportunities.find((o) => o.id === oppId);
        const label = opp?.title ?? `Oportunidad ${oppId.slice(0, 8)}…`;
        return (
          <div
            key={`opp-${oppId}`}
            className="flex items-center gap-1 rounded-md border border-input bg-muted/60 px-2 py-1 text-xs"
          >
            <Briefcase className="size-3" />
            <span className="truncate max-w-[120px]">{label}</span>
            <button
              type="button"
              className="ml-0.5 rounded-sm hover:bg-muted p-0.5"
              onClick={() => setSelectedOpportunityIds((prev) => prev.filter((id) => id !== oppId))}
            >
              <span className="text-xs leading-none">&times;</span>
            </button>
          </div>
        );
      })}
    </div>
  )}

<div className="relative" ref={assocPickerRef}>
  <Button
    type="button"
    variant="outline"
    size="sm"
    className="w-full justify-between text-muted-foreground font-normal"
    onClick={() => setAssocPanelOpen((v) => !v)}
  >
    Buscar asociaciones
    <ChevronDown className={`size-4 transition-transform ${assocPanelOpen ? 'rotate-180' : ''}`} />
  </Button>

  {assocPanelOpen && (
    <div className="absolute z-[60] mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
      <div className="flex shrink-0 border-b">
        {(lockCompanySelection ? (['oportunidades'] as const) : (['empresas', 'oportunidades'] as const)).map((cat) => (
          <button
            key={cat}
            type="button"
            className={`flex-1 px-2 py-2 text-xs font-medium capitalize transition-colors ${assocCategory === cat ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => { setAssocCategory(cat); setAssocSearch(''); }}
          >
            {cat === 'empresas' ? (
              <>Empresas <span className="text-muted-foreground">({assocCompanyCount})</span></>
            ) : (
              <>Oportunidades <span className="text-muted-foreground">({assocOppCount})</span></>
            )}
          </button>
        ))}
      </div>

      <div className="p-2">
        <div className="relative mb-2 shrink-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={assocSearch}
            onChange={(e) => setAssocSearch(e.target.value)}
            className="pl-7 h-8 text-sm"
          />
        </div>

        <div className="max-h-36 overflow-y-auto overscroll-contain touch-pan-y space-y-0.5 [scrollbar-gutter:stable]">
          {!lockCompanySelection && assocCategory === 'empresas' &&
            apiCompanies
              .filter((c) => c.name.toLowerCase().includes(assocSearch.toLowerCase()))
              .slice(0, ASSOCIATION_PICKER_PAGE_SIZE)
              .map((c) => {
                const isSelected = selectedCompanyId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? 'bg-muted' : ''}`}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedCompanyId(null);
                      } else {
                        setSelectedCompanyId(c.id);
                        setCompany(c.name);
                      }
                    }}
                  >
                    <Checkbox checked={isSelected} className="size-3.5 shrink-0" />
                    <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate text-left">{c.name}</span>
                  </button>
                );
              })}

          {(lockCompanySelection || assocCategory === 'oportunidades') &&
            apiOpportunities
              .filter((o) => o.title.toLowerCase().includes(assocSearch.toLowerCase()))
              .slice(0, ASSOCIATION_PICKER_PAGE_SIZE)
              .map((o) => {
                const isSelected = selectedOpportunityIds.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? 'bg-muted' : ''}`}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedOpportunityIds((prev) => prev.filter((id) => id !== o.id));
                      } else {
                        setSelectedOpportunityIds((prev) => [...prev, o.id]);
                      }
                    }}
                  >
                    <Checkbox checked={isSelected} className="size-3.5 shrink-0" />
                    <Briefcase className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate text-left">{o.title}</span>
                  </button>
                );
              })}
        </div>
      </div>
    </div>
  )}
</div>
  <p className="text-xs text-muted-foreground">
    {lockCompanySelection
      ? 'Vincula oportunidades al contacto (la empresa ya está fijada en esta pantalla).'
      : 'Filtra por texto sobre todas las empresas y oportunidades cargadas; se muestran las primeras coincidencias.'}
  </p>
</div>
              <div className="space-y-2">
                <Label>Etapa</Label>
                <Select value={etapaCiclo} onValueChange={(v) => setEtapaCiclo(v as Etapa)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stageOptions.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Teléfono *</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+51 999 999 999" />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Fuente</Label>
                <Select value={source} onValueChange={(v) => setSource(v as ContactSource)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Asesor asignado</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
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
                <Select value={clienteRecuperado} onValueChange={(v) => setClienteRecuperado(v as 'si' | 'no')}>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input value={departamento} onChange={(e) => setDepartamento(e.target.value)} placeholder="Ej: Lima" />
              </div>
              <div className="space-y-2">
                <Label>Provincia</Label>
                <Input value={provincia} onChange={(e) => setProvincia(e.target.value)} placeholder="Ej: Lima" />
              </div>
              <div className="space-y-2">
                <Label>Distrito</Label>
                <Input value={distrito} onChange={(e) => setDistrito(e.target.value)} placeholder="Ej: Surco" />
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Ej: Av. Primavera 1234" />
              </div>
            </div>
          )}

          <DialogFooter className="flex-row gap-2 sm:justify-between">
            <div>
              {step > 0 && (
                <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                  <ChevronLeft className="size-4" /> Anterior
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              {step < 2 ? (
                <Button type="button" className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={handleNext}>
                  Siguiente <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  className="bg-[#13944C] hover:bg-[#0f7a3d]"
                  disabled={!name.trim() || !company.trim()}
                  onClick={handleSubmit}
                >
                  {submitLabel}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
</DialogContent>
  </Dialog>
  <NewCompanyWizard
    open={companyWizardOpen}
    onOpenChange={setCompanyWizardOpen}
    onSubmit={handleCompanyWizardSubmit}
    defaultValues={companyWizardDefaults}
    title="Nueva empresa (vinculada al contacto)"
    confirmButtonLabel="Usar estos datos"
  />
</>
  );
}
