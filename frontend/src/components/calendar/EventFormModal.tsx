import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useUsers } from '@/hooks/useUsers';
import { eventTypeConfig } from './eventTypeConfig';
import type { CalendarEvent } from '@/types';

const eventFormSchema = z.object({
  title: z.string().min(2, 'El título es requerido'),
  type: z.enum(['llamada', 'reunion', 'tarea', 'correo', 'whatsapp']),
  date: z.string().min(1, 'La fecha es requerida'),
  startTime: z.string().min(1, 'La hora de inicio es requerida'),
  endTime: z.string().min(1, 'La hora de fin es requerida'),
  assignedTo: z.string().min(1, 'Selecciona un responsable'),
  relatedEntityType: z.enum(['contact', 'company', 'opportunity']).optional(),
  relatedEntityId: z.string().optional(),
  relatedEntityName: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['pendiente', 'completada', 'en_progreso', 'vencida']),
});

type EventFormData = z.infer<typeof eventFormSchema>;

export interface EventFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  relatedOptions: { type: 'contact' | 'company' | 'opportunity'; id: string; name: string }[];
  onSave: (data: EventFormData) => void | Promise<void>;
}

export function EventFormModal({
  open,
  onOpenChange,
  event,
  relatedOptions,
  onSave,
}: EventFormModalProps) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: '',
      type: 'llamada',
      date: new Date().toISOString().slice(0, 10),
      startTime: '09:00',
      endTime: '09:30',
      assignedTo: '',
      status: 'pendiente',
    },
  });

  const { activeAdvisors } = useUsers();
  /** Primitivo estable: evita re-ejecutar el efecto en cada render (activeAdvisors era un array nuevo cada vez). */
  const defaultAssigneeId = activeAdvisors[0]?.id ?? '';

  useEffect(() => {
    if (!open) return;
    if (event) {
      reset({
        title: event.title,
        type: event.type,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        assignedTo: event.assignedTo,
        relatedEntityType: event.relatedEntityType,
        relatedEntityId: event.relatedEntityId,
        relatedEntityName: event.relatedEntityName,
        description: event.description,
        status: event.status,
      });
    } else {
      reset({
        title: '',
        type: 'llamada',
        date: new Date().toISOString().slice(0, 10),
        startTime: '09:00',
        endTime: '09:30',
        assignedTo: defaultAssigneeId,
        status: 'pendiente',
      });
    }
  }, [open, event, reset, defaultAssigneeId]);

  async function onSubmit(data: EventFormData) {
    const result = onSave(data);
    await (result instanceof Promise ? result : Promise.resolve());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{event ? 'Editar evento' : 'Nuevo evento'}</DialogTitle>
          <DialogDescription>
            {event ? 'Modifica los datos del evento.' : 'Crea una nueva actividad en el calendario.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" placeholder="Ej: Llamada de seguimiento" {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(eventTypeConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="completada">Completada</SelectItem>
                      <SelectItem value="en_progreso">En progreso</SelectItem>
                      <SelectItem value="vencida">Vencida</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <Input id="date" type="date" {...register('date')} />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Inicio</Label>
              <Input id="startTime" type="time" {...register('startTime')} />
              {errors.startTime && <p className="text-xs text-destructive">{errors.startTime.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Fin</Label>
              <Input id="endTime" type="time" {...register('endTime')} />
              {errors.endTime && <p className="text-xs text-destructive">{errors.endTime.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Responsable</Label>
            <Controller
              control={control}
              name="assignedTo"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAdvisors.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.assignedTo && <p className="text-xs text-destructive">{errors.assignedTo.message}</p>}
          </div>

          {relatedOptions.length > 0 && (
            <div className="space-y-2">
              <Label>Registro vinculado</Label>
              <Controller
                control={control}
                name="relatedEntityId"
                render={({ field }) => (
                  <Select
                    onValueChange={(v) => {
                      const opt = relatedOptions.find((o) => o.id === v);
                      field.onChange(v === 'none' ? undefined : v);
                      if (v === 'none') {
                        setValue('relatedEntityType', undefined);
                        setValue('relatedEntityName', undefined);
                      } else if (opt) {
                        setValue('relatedEntityType', opt.type);
                        setValue('relatedEntityName', opt.name);
                      }
                    }}
                    value={field.value ?? 'none'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ninguno" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguno</SelectItem>
                      {relatedOptions.map((opt) => (
                        <SelectItem key={`${opt.type}-${opt.id}`} value={opt.id}>
                          {opt.type === 'contact' && '👤 '}
                          {opt.type === 'company' && '🏢 '}
                          {opt.type === 'opportunity' && '💼 '}
                          {opt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" rows={3} placeholder="Detalles del evento..." {...register('description')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-[#13944C] hover:bg-[#0f7a3d]">
              {event ? 'Guardar cambios' : 'Crear evento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
