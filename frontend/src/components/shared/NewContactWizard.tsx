import { useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Etapa, ContactSource, ContactPriority } from '@/types';
import { users, contactSourceLabels, etapaLabels, priorityLabels } from '@/data/mock';

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

export interface NewContactData {
  name: string;
  cargo?: string;
  docType?: 'dni' | 'cee';
  docNumber?: string;
  company: string;
  etapaCiclo: Etapa;
  phone: string;
  email: string;
  source: ContactSource;
  priority: ContactPriority;
  assignedTo: string;
  estimatedValue: number;
  notes?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
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
  const [etapaCiclo, setEtapaCiclo] = useState<Etapa>(defaultValues?.etapaCiclo ?? 'lead');
  const [phone, setPhone] = useState(defaultValues?.phone ?? '');
  const [email, setEmail] = useState(defaultValues?.email ?? '');
  const [source, setSource] = useState<ContactSource>(defaultValues?.source ?? 'base');
  const [priority, setPriority] = useState<ContactPriority>(defaultValues?.priority ?? 'media');
  const [assignedTo, setAssignedTo] = useState(defaultValues?.assignedTo ?? '');
  const [estimatedValue, setEstimatedValue] = useState(defaultValues?.estimatedValue ?? 0);
  const [notes, setNotes] = useState(defaultValues?.notes ?? '');
  const [departamento, setDepartamento] = useState(defaultValues?.departamento ?? '');
  const [provincia, setProvincia] = useState(defaultValues?.provincia ?? '');
  const [distrito, setDistrito] = useState(defaultValues?.distrito ?? '');
  const [direccion, setDireccion] = useState(defaultValues?.direccion ?? '');

  function reset() {
    setStep(0);
    setName(defaultValues?.name ?? '');
    setCargo(defaultValues?.cargo ?? '');
    setDocType(defaultValues?.docType ?? '');
    setDocNumber(defaultValues?.docNumber ?? '');
    setCompany(defaultValues?.company ?? '');
    setEtapaCiclo(defaultValues?.etapaCiclo ?? 'lead');
    setPhone(defaultValues?.phone ?? '');
    setEmail(defaultValues?.email ?? '');
    setSource(defaultValues?.source ?? 'base');
    setPriority(defaultValues?.priority ?? 'media');
    setAssignedTo(defaultValues?.assignedTo ?? '');
    setEstimatedValue(defaultValues?.estimatedValue ?? 0);
    setNotes(defaultValues?.notes ?? '');
    setDepartamento(defaultValues?.departamento ?? '');
    setProvincia(defaultValues?.provincia ?? '');
    setDistrito(defaultValues?.distrito ?? '');
    setDireccion(defaultValues?.direccion ?? '');
  }

  function handleOpenChange(open: boolean) {
    onOpenChange(open);
    if (!open) reset();
  }

  function handleNext() {
    if (step === 0 && (!name.trim() || !company.trim())) {
      toast.error('Nombre y empresa son requeridos');
      return;
    }
    setStep((s) => s + 1);
  }

  function handleSubmit() {
    if (!name.trim() || !company.trim()) return;
    onSubmit({
      name: name.trim(),
      cargo: cargo.trim() || undefined,
      docType: docType || undefined,
      docNumber: docNumber.trim() || undefined,
      company: company.trim(),
      etapaCiclo,
      phone: phone.trim(),
      email: email.trim(),
      source,
      priority,
      assignedTo,
      estimatedValue,
      notes: notes.trim() || undefined,
      departamento: departamento.trim() || undefined,
      provincia: provincia.trim() || undefined,
      distrito: distrito.trim() || undefined,
      direccion: direccion.trim() || undefined,
    });
    reset();
  }

  return (
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
                <Input
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder={docType === 'dni' ? '12345678' : docType === 'cee' ? '001234567890' : 'Selecciona un tipo'}
                  maxLength={docType === 'dni' ? 8 : 12}
                  disabled={!docType}
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre completo *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del contacto" />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ej: Gerente de Compras" />
              </div>
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nombre de la empresa" />
              </div>
              <div className="space-y-2">
                <Label>Etapa de ciclo de vida</Label>
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
                <Label>Prioridad</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as ContactPriority)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([key, label]) => (
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
                    {users.filter((u) => u.status === 'activo').map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor estimado (S/)</Label>
                <Input type="number" value={estimatedValue} onChange={(e) => setEstimatedValue(Number(e.target.value))} placeholder="0" />
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
  );
}
