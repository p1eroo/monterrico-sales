import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { etapaLabels, contactSourceLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import type { ContactPriority, ContactSource, Etapa } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const contactFuenteValues = [
  'referido', 'base', 'entorno', 'feria', 'masivo',
] as const satisfies readonly ContactSource[];

const schema = z.object({
  title: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  amount: z.coerce.number().min(0, 'El monto debe ser positivo'),
  etapa: z.enum(['lead', 'contacto', 'reunion_agendada', 'reunion_efectiva', 'propuesta_economica', 'negociacion', 'licitacion', 'licitacion_etapa_final', 'cierre_ganado', 'firma_contrato', 'activo', 'cierre_perdido', 'inactivo'] as const),
  expectedCloseDate: z.string().min(1, 'Selecciona una fecha'),
  assignedTo: z.string().min(1, 'Selecciona un asesor'),
  priority: z.enum(['baja', 'media', 'alta']),
  fuente: z.enum(contactFuenteValues),
});

export type NewOpportunityData = z.infer<typeof schema>;

interface NewOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;
  onSave: (data: NewOpportunityData) => void;
  /** Sugerencia inicial (p. ej. fuente del contacto principal). */
  defaultFuente?: ContactSource;
}

export function NewOpportunityDialog({
  open,
  onOpenChange,
  entityName,
  onSave,
  defaultFuente,
}: NewOpportunityDialogProps) {
  const { activeUsers } = useUsers();
  const form = useForm<NewOpportunityData>({
    resolver: zodResolver(schema) as import('react-hook-form').Resolver<NewOpportunityData>,
    defaultValues: {
      title: '',
      amount: 0,
      etapa: 'lead',
      expectedCloseDate: '',
      assignedTo: '',
      priority: 'media',
      fuente: 'base',
    },
  });

  useEffect(() => {
    if (!open) return;
    const f = defaultFuente && contactFuenteValues.includes(defaultFuente) ? defaultFuente : 'base';
    form.setValue('fuente', f);
  }, [open, defaultFuente, form]);

  function handleSubmit(data: NewOpportunityData) {
    onSave(data);
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
            Crea una nueva oportunidad vinculada a {entityName}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="opp-title">Nombre *</Label>
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
              <Label>Prioridad *</Label>
              <Select
                value={form.watch('priority')}
                onValueChange={(v) => form.setValue('priority', v as ContactPriority)}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fuente *</Label>
              <Select
                value={form.watch('fuente')}
                onValueChange={(v) => form.setValue('fuente', v as ContactSource)}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Fuente" /></SelectTrigger>
                <SelectContent>
                  {contactFuenteValues.map((k) => (
                    <SelectItem key={k} value={k}>{contactSourceLabels[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Asesor *</Label>
              <Select
                value={form.watch('assignedTo')}
                onValueChange={(v) => form.setValue('assignedTo', v)}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar asesor" /></SelectTrigger>
                <SelectContent>
                  {activeUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.assignedTo && (
                <p className="text-xs text-destructive">{form.formState.errors.assignedTo.message}</p>
              )}
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
