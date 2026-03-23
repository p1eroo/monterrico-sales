import { useState, useEffect } from 'react';
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { factilizaApi } from '@/lib/factilizaApi';
import type { Etapa, CompanyRubro, CompanyTipo, ContactSource } from '@/types';
import { companyRubroLabels, companyTipoLabels, etapaLabels, contactSourceLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export interface NewCompanyData {
  ruc: string;
  razonSocial: string;
  rubro: CompanyRubro | '';
  tipoEmpresa: CompanyTipo | '';
  nombreComercial: string;
  telefono: string;
  distrito: string;
  provincia: string;
  departamento: string;
  direccion: string;
  dominio: string;
  linkedin: string;
  correo: string;
  origenLead: ContactSource | '';
  propietario: string;
  clienteRecuperado: 'si' | 'no';
  nombreNegocio: string;
  etapa: Etapa;
  facturacion: string;
  fechaCierre: string;
}

const emptyForm: NewCompanyData = {
  ruc: '', razonSocial: '', rubro: '', tipoEmpresa: '', nombreComercial: '',
  telefono: '', distrito: '', provincia: '', departamento: '', direccion: '',
  dominio: '', linkedin: '', correo: '', origenLead: '', propietario: '',
  clienteRecuperado: 'no', nombreNegocio: '', etapa: 'lead', facturacion: '', fechaCierre: '',
};

interface NewCompanyWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NewCompanyData) => void;
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
  const { activeUsers } = useUsers();

  async function handleRucLookup(rucValue?: string) {
    const ruc = (rucValue ?? form.ruc).trim().replace(/\D/g, '');
    if (!ruc || ruc.length !== 11) {
      toast.error('Ingresa un RUC válido de 11 dígitos');
      return;
    }
    setRucLookupLoading(true);
    try {
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
      toast.success('Datos de empresa cargados correctamente');
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
    // defaultValues se fija al abrir desde el padre; no incluir en deps para evitar resets por referencia nueva
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleOpenChange(value: boolean) {
    onOpenChange(value);
    if (!value) {
      setStep(0);
      setForm({ ...emptyForm });
    }
  }

  function handleNext() {
    if (step === 0 && (!form.ruc.trim() || !form.nombreComercial.trim())) {
      toast.error('RUC y Nombre comercial son obligatorios');
      return;
    }
    if (step === 1) {
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
    const nombreNegocio = form.nombreNegocio.trim() || form.nombreComercial.trim();
    onSubmit({ ...form, nombreNegocio });
    setStep(0);
    setForm({ ...emptyForm });
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
                    onChange={(e) => set('ruc', e.target.value)}
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
                <Input placeholder="Razón social" value={form.razonSocial} onChange={(e) => set('razonSocial', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nombre comercial <span className="text-destructive">*</span></Label>
                <Input placeholder="Nombre comercial" value={form.nombreComercial} onChange={(e) => set('nombreComercial', e.target.value)} />
              </div>
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
                <Label>Fuente</Label>
                <Select value={form.origenLead} onValueChange={(v) => set('origenLead', v as ContactSource)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar fuente" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(contactSourceLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Propietario</Label>
                <Select value={form.propietario} onValueChange={(v) => set('propietario', v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar asesor" /></SelectTrigger>
                  <SelectContent>
                    {activeUsers.map((u) => (
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
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre de la oportunidad</Label>
                <Input placeholder="Nombre de la oportunidad" value={form.nombreNegocio} onChange={(e) => set('nombreNegocio', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Etapa</Label>
                <Select value={form.etapa} onValueChange={(v) => set('etapa', v as Etapa)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(etapaLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Facturación (S/)</Label>
                <Input type="number" placeholder="S/" value={form.facturacion} onChange={(e) => set('facturacion', e.target.value)} />
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
                {confirmButtonLabel}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
