import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, Loader2, Plus, Building2 } from 'lucide-react';
import type { Etapa, ContactSource } from '@/types';
import { contactSourceLabels, etapaLabels, companyRubroLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { companyListAll, type ApiCompanyRecord } from '@/lib/companyApi';
import { factilizaApi } from '@/lib/factilizaApi';
import { cn } from '@/lib/utils';

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
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NewCompanyWizard, type NewCompanyData } from '@/components/shared/NewCompanyWizard';
import { LinkExistingDialog, type LinkExistingItem } from '@/components/shared/LinkExistingDialog';

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
  estimatedValue: number;
  clienteRecuperado?: 'si' | 'no';
  notes?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
  /** Wizard de empresa embebido: se persiste al guardar el contacto (empresa + opcional oportunidad) */
  newCompanyWizardData?: NewCompanyData;
}

interface NewContactWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NewContactData) => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  defaultValues?: Partial<NewContactData>;
}

const WIZARD_STEPS = [
  { label: 'Identificación' },
  { label: 'Comercial' },
  { label: 'Ubicación' },
];

export function NewContactWizard({
  open,
  onOpenChange,
  onSubmit,
  title = 'Nuevo Contacto',
  description = 'Registra un nuevo prospecto en el sistema.',
  submitLabel = 'Crear Contacto',
  defaultValues,
}: NewContactWizardProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(defaultValues?.name ?? '');
  const [cargo, setCargo] = useState(defaultValues?.cargo ?? '');
  const [docType, setDocType] = useState<'dni' | 'cee' | ''>(defaultValues?.docType ?? '');
  const [docNumber, setDocNumber] = useState(defaultValues?.docNumber ?? '');
  const [company, setCompany] = useState(defaultValues?.company ?? '');
  const [companyId, setCompanyId] = useState<string | null>(defaultValues?.companyId ?? null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [linkExistingCompanyOpen, setLinkExistingCompanyOpen] = useState(false);
  const [linkCompanySearch, setLinkCompanySearch] = useState('');
  const [linkCompanySelectedIds, setLinkCompanySelectedIds] = useState<string[]>([]);
  const [apiCompanies, setApiCompanies] = useState<ApiCompanyRecord[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [etapaCiclo, setEtapaCiclo] = useState<Etapa>(defaultValues?.etapaCiclo ?? 'lead');
  const [phone, setPhone] = useState(defaultValues?.phone ?? '');
  const [email, setEmail] = useState(defaultValues?.email ?? '');
  const [source, setSource] = useState<ContactSource>(defaultValues?.source ?? 'base');
  const [assignedTo, setAssignedTo] = useState(defaultValues?.assignedTo ?? '');
  const [estimatedValue, setEstimatedValue] = useState(defaultValues?.estimatedValue ?? 0);
  const [clienteRecuperado, setClienteRecuperado] = useState<'si' | 'no'>(defaultValues?.clienteRecuperado ?? 'no');
  const [notes, setNotes] = useState(defaultValues?.notes ?? '');
  const [departamento, setDepartamento] = useState(defaultValues?.departamento ?? '');
  const [provincia, setProvincia] = useState(defaultValues?.provincia ?? '');
  const [distrito, setDistrito] = useState(defaultValues?.distrito ?? '');
  const [direccion, setDireccion] = useState(defaultValues?.direccion ?? '');
  const [docLookupLoading, setDocLookupLoading] = useState(false);
  const { activeUsers } = useUsers();

  const [pendingNewCompany, setPendingNewCompany] = useState<NewCompanyData | null>(null);
  const [companyWizardOpen, setCompanyWizardOpen] = useState(false);
  const [companyWizardDefaults, setCompanyWizardDefaults] = useState<Partial<NewCompanyData>>({});

  function reset() {
    setStep(0);
    setName(defaultValues?.name ?? '');
    setCargo(defaultValues?.cargo ?? '');
    setDocType(defaultValues?.docType ?? '');
    setDocNumber(defaultValues?.docNumber ?? '');
    setCompany(defaultValues?.company ?? '');
    setCompanyId(defaultValues?.companyId ?? null);
    setCompanySearch('');
    setCompanyOpen(false);
    setLinkExistingCompanyOpen(false);
    setLinkCompanySearch('');
    setLinkCompanySelectedIds([]);
    setEtapaCiclo(defaultValues?.etapaCiclo ?? 'lead');
    setPhone(defaultValues?.phone ?? '');
    setEmail(defaultValues?.email ?? '');
    setSource(defaultValues?.source ?? 'base');
    setAssignedTo(defaultValues?.assignedTo ?? '');
    setEstimatedValue(defaultValues?.estimatedValue ?? 0);
    setClienteRecuperado(defaultValues?.clienteRecuperado ?? 'no');
    setNotes(defaultValues?.notes ?? '');
    setDepartamento(defaultValues?.departamento ?? '');
    setProvincia(defaultValues?.provincia ?? '');
    setDistrito(defaultValues?.distrito ?? '');
    setDireccion(defaultValues?.direccion ?? '');
    setPendingNewCompany(null);
    setCompanyWizardOpen(false);
    setCompanyWizardDefaults({});
  }

  /** Abre el asistente de nueva empresa (nombre sugerido opcional desde búsqueda o valor ya elegido) */
  function openCompanyWizardForCreate() {
    const q = companySearch.trim() || company.trim();
    if (q) {
      const exact = apiCompanies.some((c) => c.name.trim().toLowerCase() === q.toLowerCase());
      if (exact) {
        toast.message('Ya existe una empresa con ese nombre', {
          description: 'Usa «Empresa existente» y elígela en la lista.',
        });
        return;
      }
    }
    setCompanyWizardDefaults({
      nombreComercial: q,
      origenLead: source,
      propietario: assignedTo,
      etapa: etapaCiclo,
      facturacion: estimatedValue ? String(estimatedValue) : '',
      nombreNegocio: q,
      telefono: phone,
      correo: email,
      clienteRecuperado,
    });
    setCompanyWizardOpen(true);
    setCompanyOpen(false);
    setCompanySearch('');
  }

  function handleConfirmLinkExistingCompany() {
    const id = linkCompanySelectedIds[0];
    if (!id) return;
    const found = apiCompanies.find((c) => c.id === id);
    if (!found) {
      toast.error('No se encontró la empresa seleccionada');
      return;
    }
    setPendingNewCompany(null);
    setCompanyId(found.id);
    setCompany(found.name);
    setLinkExistingCompanyOpen(false);
    setLinkCompanySearch('');
    setLinkCompanySelectedIds([]);
  }

  function handleCompanyWizardSubmit(data: NewCompanyData) {
    setPendingNewCompany(data);
    setCompany(data.nombreComercial.trim());
    setCompanyId(null);
    setCompanyWizardOpen(false);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
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
    if (!open) return;
    let cancelled = false;
    setCompaniesLoading(true);
    companyListAll()
      .then((list) => {
        if (!cancelled) setApiCompanies(list);
      })
      .catch(() => {
        if (!cancelled) {
          setApiCompanies([]);
          toast.error('No se pudieron cargar las empresas. Puedes escribir una nueva.');
        }
      })
      .finally(() => {
        if (!cancelled) setCompaniesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const companyLinkItems = useMemo((): LinkExistingItem[] => {
    return apiCompanies.map((c) => {
      const rubroLabel =
        c.rubro && c.rubro in companyRubroLabels
          ? companyRubroLabels[c.rubro as keyof typeof companyRubroLabels]
          : c.rubro ?? undefined;
      const subtitle = [c.ruc, c.domain, rubroLabel].filter(Boolean).join(' · ') || undefined;
      return {
        id: c.id,
        title: c.name,
        subtitle,
        status: 'Activo',
        icon: <Building2 className="size-4" />,
      };
    });
  }, [apiCompanies]);

  function handleNext() {
    if (step === 0 && (!name.trim() || !company.trim())) {
      toast.error('Nombre y empresa son requeridos');
      return;
    }
    setStep((s) => s + 1);
  }

  function handleSubmit() {
    if (!name.trim() || !company.trim()) return;
    if (estimatedValue <= 0) {
      toast.error('El valor estimado debe ser mayor que 0');
      return;
    }
    onSubmit({
      name: name.trim(),
      cargo: cargo.trim() || undefined,
      docType: docType || undefined,
      docNumber: docNumber.trim() || undefined,
      company: company.trim(),
      companyId: companyId ?? undefined,
      etapaCiclo,
      phone: phone.trim(),
      email: email.trim(),
      source,
      assignedTo,
      estimatedValue,
      clienteRecuperado,
      notes: notes.trim() || undefined,
      departamento: departamento.trim() || undefined,
      provincia: provincia.trim() || undefined,
      distrito: distrito.trim() || undefined,
      direccion: direccion.trim() || undefined,
      ...(pendingNewCompany ? { newCompanyWizardData: pendingNewCompany } : {}),
    });
    reset();
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
                <Label>Empresa *</Label>
                {pendingNewCompany && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                    <strong>Empresa pendiente:</strong> se registrará al pulsar «{submitLabel}».
                    {pendingNewCompany.nombreNegocio.trim()
                      ? ' También se creará la oportunidad indicada en el asistente de empresa.'
                      : ''}
                  </p>
                )}
                <Popover
                  open={companyOpen}
                  onOpenChange={(o) => {
                    setCompanyOpen(o);
                    if (o) {
                      setCompanySearch(company);
                    } else {
                      setCompanySearch('');
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={companyOpen}
                      className="h-10 w-full justify-between font-normal"
                    >
                      <span className={cn('flex min-w-0 items-center gap-2 truncate', !company && 'text-muted-foreground')}>
                        {companyId ? (
                          <Building2 className="size-4 shrink-0 text-muted-foreground" />
                        ) : null}
                        <span className="truncate">{company || 'Crear o vincular empresa…'}</span>
                      </span>
                      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[min(100vw-2rem,max(var(--radix-popover-trigger-width),22rem))] max-w-xl p-0"
                    align="start"
                  >
                    <div className="grid grid-cols-2 gap-2 p-2">
                      <button
                        type="button"
                        className={cn(
                          'flex min-h-[72px] min-w-0 flex-col items-center justify-center gap-2 rounded-lg border border-border/80 bg-card px-2 py-3 text-center transition-colors',
                          'hover:border-[#13944C]/50 hover:bg-[#13944C]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13944C]/30',
                        )}
                        onClick={() => openCompanyWizardForCreate()}
                      >
                        <Plus className="size-6 shrink-0 text-[#13944C]" />
                        <span className="text-sm font-semibold leading-tight">Crear empresa</span>
                      </button>
                      <button
                        type="button"
                        className={cn(
                          'flex min-h-[72px] min-w-0 flex-col items-center justify-center gap-2 rounded-lg border border-border/80 bg-card px-2 py-3 text-center transition-colors',
                          'hover:border-muted-foreground/40 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        )}
                        onClick={() => {
                          setCompanyOpen(false);
                          setLinkCompanySearch(company.trim());
                          setLinkCompanySelectedIds(companyId ? [companyId] : []);
                          setLinkExistingCompanyOpen(true);
                        }}
                      >
                        <Building2 className="size-6 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-semibold leading-tight">Empresa existente</span>
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Etapa</Label>
                <Select value={etapaCiclo} onValueChange={(v) => setEtapaCiclo(v as Etapa)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(etapaLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
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
                    {Object.entries(contactSourceLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Asesor asignado</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar asesor" /></SelectTrigger>
                  <SelectContent>
                    {activeUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor estimado (S/)</Label>
                <Input type="number" value={estimatedValue} onChange={(e) => setEstimatedValue(Number(e.target.value))} placeholder="0" />
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
              <div className="space-y-2 sm:col-span-2">
                <Label>Notas</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Información adicional sobre el contacto..." rows={3} />
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
    <LinkExistingDialog
      open={linkExistingCompanyOpen}
      onOpenChange={(o) => {
        setLinkExistingCompanyOpen(o);
        if (!o) {
          setLinkCompanySearch('');
          setLinkCompanySelectedIds([]);
        }
      }}
      title="Vincular Empresa Existente"
      searchPlaceholder="Buscar empresas..."
      leadName={name.trim() || 'el nuevo contacto'}
      items={companyLinkItems}
      selectedIds={linkCompanySelectedIds}
      onSelectionChange={setLinkCompanySelectedIds}
      onConfirm={handleConfirmLinkExistingCompany}
      searchValue={linkCompanySearch}
      onSearchChange={setLinkCompanySearch}
      emptyMessage={
        companiesLoading
          ? 'Cargando empresas…'
          : apiCompanies.length === 0
            ? 'No hay empresas cargadas o la lista está vacía.'
            : 'Ninguna empresa coincide con la búsqueda.'
      }
      selectionMode="single"
      confirmLabel="Vincular"
      contentClassName="z-[100]"
    />
    </>
  );
}
