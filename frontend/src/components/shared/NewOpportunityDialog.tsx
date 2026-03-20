import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { etapaLabels, users } from '@/data/mock';
import type { Etapa } from '@/types';

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
});

export type NewOpportunityData = z.infer<typeof schema>;

interface NewOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;
  onSave: (data: NewOpportunityData) => void;
}

export function NewOpportunityDialog({ open, onOpenChange, entityName, onSave }: NewOpportunityDialogProps) {
  const form = useForm<NewOpportunityData>({
    resolver: zodResolver(schema) as import('react-hook-form').Resolver<NewOpportunityData>,
    defaultValues: {
      title: '',
      amount: 0,
      etapa: 'lead',
      expectedCloseDate: '',
      assignedTo: '',
      description: '',
    },
  });

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
              rows={3}
            />
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
