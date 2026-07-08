import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useCrmConfigStore, getLeadSourceOptionsFromCatalog } from '@/store/crmConfigStore';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, Building2, Link2, Briefcase, Search, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { Etapa, ContactSource } from '@/types';
import { contactSourceLabels, etapaLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { useAppStore } from '@/store';
import { companyListAll, type ApiCompanyRecord } from '@/lib/companyApi';
import { opportunityListAll, type ApiOpportunityListRow } from '@/lib/opportunityApi';

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
  const [company, setCompany] = useState(defaultValues?.company ?? '');
  const [companyId, setCompanyId] = useState<string | null>(defaultValues?.companyId ?? null);
  const [apiCompanies, setApiCompanies] = useState<ApiCompanyRecord[]>([]);
  const [etapaCiclo, setEtapaCiclo] = useState<Etapa>(defaultValues?.etapaCiclo ?? 'lead');
  const [phone, setPhone] = useState(defaultValues?.phone ?? '');
  const [email, setEmail] = useState(defaultValues?.email ?? '');
  const [source, setSource] = useState<ContactSource>(defaultValues?.source ?? 'base');
  const [assignedTo, setAssignedTo] = useState(defaultValues?.assignedTo ?? useAppStore.getState().currentUser?.id ?? '');
  const [clienteRecuperado, setClienteRecuperado] = useState<'si' | 'no'>(defaultValues?.clienteRecuperado ?? 'no');
  const [departamento, setDepartamento] = useState(defaultValues?.departamento ?? '');
  const [provincia, setProvincia] = useState(defaultValues?.provincia ?? '');
  const [distrito, setDistrito] = useState(defaultValues?.distrito ?? '');
  const [direccion, setDireccion] = useState(defaultValues?.direccion ?? '');
  const [apiOpportunities, setApiOpportunities] = useState<ApiOpportunityListRow[]>([]);
  const [assocPanelOpen, setAssocPanelOpen] = useState(false);
  const [assocCategory, setAssocCategory] = useState<'empresas' | 'oportunidades'>(() =>
    (lockCompanySelection ? 'oportunidades' : 'empresas'),
  );
  const [assocSearch, setAssocSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const assocPickerRef = useRef<HTMLDivElement>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(defaultCompanyId ?? null);
  const [selectedOpportunityIds, setSelectedOpportunityIds] = useState<string[]>(defaultOpportunityIds);
  const { activeAdvisors } = useUsers();
  const currentUser = useAppStore((s) => s.currentUser);
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const advisorOptions = useMemo(() => {
    if (!currentUser?.id) return activeAdvisors;
    if (activeAdvisors.some((u) => u.id === currentUser.id)) return activeAdvisors;
    return [
      { id: currentUser.id, name: currentUser.name, status: 'activo' as const, role: 'asesor' as const },
      ...activeAdvisors,
    ];
  }, [activeAdvisors, currentUser]);
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
    setAssignedTo(d?.assignedTo ?? cu?.id ?? '');
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
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const d = defaultValuesRef.current;
    const defCo = defaultCompanyId;
    const defOpps = defaultOpportunityIds ?? [];
    if (lockCompanySelection) {
      setSelectedCompanyId(defCo ?? null);
      setAssocCategory('oportunidades');
      if (!company.trim() && d?.company?.trim()) {
        setCompany(d.company);
      }
    } else {
      setSelectedCompanyId(defCo ?? d?.companyId ?? null);
      setAssocCategory('empresas');
    }
    setSelectedOpportunityIds([...defOpps]);
  }, [open, defaultCompanyId, lockCompanySelection, (defaultOpportunityIds ?? []).join(',')]);

  useEffect(() => {
    if (defaultCompanyId && apiCompanies.length > 0 && !company.trim()) {
      const comp = apiCompanies.find((c) => c.id === defaultCompanyId);
      if (comp) {
        setCompany(comp.name);
      }
    }
  }, [apiCompanies, defaultCompanyId]);

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
                  <label
                    key={c.id}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? 'bg-muted' : ''}`}
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

          {(lockCompanySelection || assocCategory === 'oportunidades') &&
            apiOpportunities
              .filter((o) => o.title.toLowerCase().includes(assocSearch.toLowerCase()))
              .slice(0, ASSOCIATION_PICKER_PAGE_SIZE)
              .map((o) => {
                const isSelected = selectedOpportunityIds.includes(o.id);
                return (
                  <label
                    key={o.id}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? 'bg-muted' : ''}`}
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
    </div>
  )}
</div>
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
                <Label>Teléfono</Label>
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
                    {advisorOptions.map((u) => (
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
                <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
                  <ChevronLeft className="size-4" /> Anterior
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
                Cancelar
              </Button>
              {step < 2 ? (
                <Button type="button" className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={handleNext} disabled={submitting}>
                  Siguiente <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  className="bg-[#13944C] hover:bg-[#0f7a3d]"
                  disabled={submitting || !name.trim() || !company.trim()}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Guardando…' : submitLabel}
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
