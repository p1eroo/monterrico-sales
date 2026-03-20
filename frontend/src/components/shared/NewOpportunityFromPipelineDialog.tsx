import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { etapaLabels, users } from '@/data/mock';
import type { Etapa } from '@/types';
import { useCRMStore } from '@/store/crmStore';

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

const etapasParaOportunidad: Etapa[] = [
  'lead', 'contacto', 'reunion_agendada', 'reunion_efectiva',
  'propuesta_economica', 'negociacion', 'licitacion', 'licitacion_etapa_final',
  'cierre_ganado', 'firma_contrato', 'activo', 'cierre_perdido', 'inactivo',
];

const schema = z.object({
  title: z.string().min(2, 'El título debe tener al menos 2 caracteres'),
  amount: z.coerce.number().min(0, 'El monto debe ser positivo'),
  etapa: z.enum(['lead', 'contacto', 'reunion_agendada', 'reunion_efectiva', 'propuesta_economica', 'negociacion', 'licitacion', 'licitacion_etapa_final', 'cierre_ganado', 'firma_contrato', 'activo', 'cierre_perdido', 'inactivo'] as const),
  expectedCloseDate: z.string().min(1, 'Selecciona una fecha'),
  assignedTo: z.string().min(1, 'Selecciona un responsable'),
  description: z.string().optional(),
  contactName: z.string().min(2, 'El nombre del contacto es requerido'),
  company: z.string().min(2, 'La empresa es requerida'),
  phone: z.string().min(1, 'El teléfono es requerido'),
  email: z.string().email('Email inválido'),
});

export type NewOpportunityFromPipelineData = z.infer<typeof schema>;

interface NewOpportunityFromPipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewOpportunityFromPipelineDialog({ open, onOpenChange }: NewOpportunityFromPipelineDialogProps) {
  const { addContact, addOpportunity } = useCRMStore();
  const form = useForm<NewOpportunityFromPipelineData>({
    resolver: zodResolver(schema) as import('react-hook-form').Resolver<NewOpportunityFromPipelineData>,
    defaultValues: {
      title: '',
      amount: 0,
      etapa: 'lead',
      expectedCloseDate: '',
      assignedTo: '',
      description: '',
      contactName: '',
      company: '',
      phone: '',
      email: '',
    },
  });

  function handleSubmit(data: NewOpportunityFromPipelineData) {
    const newContact = addContact({
      name: data.contactName.trim(),
      companies: [{ name: data.company.trim(), isPrimary: true }],
      phone: data.phone.trim(),
      email: data.email.trim(),
      source: 'base',
      priority: 'media',
      assignedTo: data.assignedTo,
      estimatedValue: data.amount,
      etapa: data.etapa as Etapa,
    });
    addOpportunity({
      title: data.title.trim(),
      contactId: newContact.id,
      amount: data.amount,
      etapa: data.etapa as Etapa,
      status: 'abierta',
      expectedCloseDate: data.expectedCloseDate,
      assignedTo: data.assignedTo,
      createdAt: new Date().toISOString().slice(0, 10),
      description: data.description?.trim(),
    });
    toast.success(`Oportunidad "${data.title}" creada exitosamente`);
    form.reset();
    onOpenChange(false);
  }

  function handleOpenChange(value: boolean) {
    if (!value) form.reset();
    onOpenChange(value);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Oportunidad</DialogTitle>
          <DialogDescription>
            Registra una nueva oportunidad en el pipeline. Completa los datos de la oportunidad y del contacto asociado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Sección Oportunidad */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Datos de la oportunidad</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="opp-title">Título *</Label>
                <Input
                  id="opp-title"
                  {...form.register('title')}
                  placeholder="Ej: Servicio Corporativo Empresa X"
                />
                {form.formState.errors.title && (
                  <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="opp-amount">Monto (S/) *</Label>
                <Input
                  id="opp-amount"
                  type="number"
                  {...form.register('amount', { valueAsNumber: true })}
                  placeholder="0"
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Etapa *</Label>
                <Select
                  value={form.watch('etapa')}
                  onValueChange={(v) => form.setValue('etapa', v as Etapa)}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {etapasParaOportunidad.map((e) => (
                      <SelectItem key={e} value={e}>{etapaLabels[e]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="opp-expectedCloseDate">Fecha estimada de cierre *</Label>
                <Input
                  id="opp-expectedCloseDate"
                  type="date"
                  {...form.register('expectedCloseDate')}
                />
                {form.formState.errors.expectedCloseDate && (
                  <p className="text-xs text-destructive">{form.formState.errors.expectedCloseDate.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Responsable *</Label>
                <Select
                  value={form.watch('assignedTo')}
                  onValueChange={(v) => form.setValue('assignedTo', v)}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar responsable" /></SelectTrigger>
                  <SelectContent>
                    {users.filter((u) => u.status === 'activo').map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.assignedTo && (
                  <p className="text-xs text-destructive">{form.formState.errors.assignedTo.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="opp-description">Descripción</Label>
              <Textarea
                id="opp-description"
                {...form.register('description')}
                placeholder="Detalles adicionales sobre la oportunidad..."
                rows={2}
              />
            </div>
          </div>

          {/* Sección Contacto */}
          <div className="space-y-4 border-t pt-4">
            <h4 className="text-sm font-semibold text-foreground">Contacto asociado</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-name">Nombre del contacto *</Label>
                <Input
                  id="contact-name"
                  {...form.register('contactName')}
                  placeholder="Nombre del contacto"
                />
                {form.formState.errors.contactName && (
                  <p className="text-xs text-destructive">{form.formState.errors.contactName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-company">Empresa *</Label>
                <Input
                  id="contact-company"
                  {...form.register('company')}
                  placeholder="Nombre de la empresa"
                />
                {form.formState.errors.company && (
                  <p className="text-xs text-destructive">{form.formState.errors.company.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Teléfono *</Label>
                <Input
                  id="contact-phone"
                  {...form.register('phone')}
                  placeholder="+51 999 999 999"
                />
                {form.formState.errors.phone && (
                  <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Email *</Label>
                <Input
                  id="contact-email"
                  type="email"
                  {...form.register('email')}
                  placeholder="email@empresa.com"
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Crear Oportunidad</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
