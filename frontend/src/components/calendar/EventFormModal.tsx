import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link2, ChevronDown, Search, User, Building2, Briefcase } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useUsers } from '@/hooks/useUsers';
import { useAppStore } from '@/store';
import { canUserReassignCommercialAdvisor, resolveAdvisorAssigneeId } from '@/lib/advisorAssigneeDefaults';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import { eventTypeConfig } from './eventTypeConfig';
import { cn } from '@/lib/utils';
import type { CalendarEvent, Contact, Opportunity } from '@/types';

type Association = { type: string; id: string; name: string };

const eventFormSchema = z.object({
  title: z.string().min(2, 'El título es requerido'),
  type: z.enum(['llamada', 'reunion', 'tarea', 'correo', 'whatsapp']),
  date: z.string().min(1, 'La fecha es requerida'),
  startTime: z.string().min(1, 'La hora de inicio es requerida'),
  endTime: z.string().min(1, 'La hora de fin es requerida'),
  assignedTo: z.string().min(1, 'Selecciona un responsable'),
  description: z.string().optional(),
  status: z.enum(['pendiente', 'completada', 'en_progreso', 'vencida']),
});

type EventFormData = z.infer<typeof eventFormSchema>;

export type EventFormSaveData = EventFormData & { associations: Association[] };

export interface EventFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  contacts: Contact[];
  companies: { name: string; id: string }[];
  opportunities: Opportunity[];
  defaultDate?: string;
  defaultTime?: string;
  onSave: (data: EventFormSaveData) => void | Promise<void>;
}

type EntityCategory = 'contactos' | 'empresas' | 'oportunidades';

const ASSOCIATION_ICONS: Record<EntityCategory, typeof User> = {
  contactos: User,
  empresas: Building2,
  oportunidades: Briefcase,
};

export function EventFormModal({
  open,
  onOpenChange,
  event,
  contacts,
  companies,
  opportunities,
  defaultDate,
  defaultTime,
  onSave,
}: EventFormModalProps) {
  const [entityCategory, setEntityCategory] = useState<EntityCategory>('contactos');
  const [entitySearch, setEntitySearch] = useState('');
  const [assocPanelOpen, setAssocPanelOpen] = useState(false);
  const [associations, setAssociations] = useState<Association[]>([]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: '',
      type: 'llamada',
      date: defaultDate ?? new Date().toISOString().slice(0, 10),
      startTime: defaultTime ?? '09:00',
      endTime: defaultTime
        ? (() => { const [h, m] = defaultTime.split(':').map(Number); const m2 = m + 30; return `${String(h + (m2 >= 60 ? 1 : 0)).padStart(2, '0')}:${String(m2 >= 60 ? m2 - 60 : m2).padStart(2, '0')}`; })()
        : '09:30',
      assignedTo: '',
      status: 'pendiente',
    },
  });

  const { activeAdvisors } = useUsers();
  const currentUser = useAppStore((s) => s.currentUser);
  const canReassign = canUserReassignCommercialAdvisor(currentUser.role);
  const defaultAssigneeId = resolveAdvisorAssigneeId(undefined, currentUser) || activeAdvisors[0]?.id || '';

  useEffect(() => {
    if (!open) return;
    setEntityCategory('contactos');
    setEntitySearch('');
    setAssocPanelOpen(false);
    setAssociations([]);
    if (event) {
      reset({
        title: event.title,
        type: event.type,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        assignedTo: event.assignedTo,
        description: event.description,
        status: event.status,
      });
    } else {
      reset({
        title: '',
        type: 'llamada',
        date: defaultDate ?? new Date().toISOString().slice(0, 10),
        startTime: defaultTime ?? '09:00',
        endTime: defaultTime
          ? (() => { const [h, m] = defaultTime.split(':').map(Number); const m2 = m + 30; return `${String(h + (m2 >= 60 ? 1 : 0)).padStart(2, '0')}:${String(m2 >= 60 ? m2 - 60 : m2).padStart(2, '0')}`; })()
          : '09:30',
        assignedTo: defaultAssigneeId,
        status: 'pendiente',
      });
    }
  }, [open, event, reset]);

  async function onSubmit(data: EventFormData) {
    const result = onSave({ ...data, associations });
    await (result instanceof Promise ? result : Promise.resolve());
    onOpenChange(false);
  }

  function toggleAssociation(value: string, cat: EntityCategory, label: string) {
    setAssociations((prev) => {
      const exists = prev.some((a) => a.type === cat && a.id === value);
      if (exists) return prev.filter((a) => !(a.type === cat && a.id === value));
      return [...prev, { type: cat, id: value, name: label }];
    });
  }

  const filteredItems: { value: string; type: EntityCategory; label: string }[] = (() => {
    const q = entitySearch.toLowerCase();
    let items: { value: string; type: EntityCategory; label: string }[];
    if (entityCategory === 'contactos') {
      items = contacts
        .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.companies?.[0]?.name || '').toLowerCase().includes(q))
        .map((c) => ({ value: c.id, type: 'contactos' as const, label: `${c.name}${c.companies?.[0]?.name ? ` — ${c.companies[0].name}` : ''}` }));
    } else if (entityCategory === 'empresas') {
      items = companies
        .filter((co) => !q || co.name.toLowerCase().includes(q))
        .map((co) => ({ value: co.id, type: 'empresas' as const, label: co.name }));
    } else {
      items = opportunities
        .filter((o) => !q || o.title.toLowerCase().includes(q))
        .map((o) => ({ value: o.id, type: 'oportunidades' as const, label: o.title }));
    }
    return items.slice(0, 20);
  })();

  function removeAssociation(type: string, id: string) {
    setAssociations((prev) => prev.filter((a) => !(a.type === type && a.id === id)));
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

          <Controller
            control={control}
            name="assignedTo"
            render={({ field }) => (
              <AssignedAdvisorFormField
                htmlId="event-form-assigned-to"
                value={field.value}
                onChange={field.onChange}
                disabled={!canReassign}
                fallbackName={currentUser.name}
                label="Responsable"
              />
            )}
          />
          {errors.assignedTo && <p className="text-xs text-destructive">{errors.assignedTo.message}</p>}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Link2 className="size-3.5" /> Asociaciones *
              </Label>
              {associations.length > 0 && (
                <span className="text-xs text-muted-foreground">{associations.length} registro{associations.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {associations.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {associations.map((a) => {
                  const Icon = ASSOCIATION_ICONS[a.type as EntityCategory] || User;
                  return (
                    <span key={`${a.type}-${a.id}`} className="inline-flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-0.5 text-xs">
                      <Icon className="size-3 shrink-0 text-muted-foreground" />
                      <span className="truncate max-w-32">{a.name}</span>
                      <button type="button" onClick={() => removeAssociation(a.type, a.id)} className="ml-0.5 text-muted-foreground hover:text-foreground">&times;</button>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-between text-muted-foreground font-normal"
                onClick={() => setAssocPanelOpen(!assocPanelOpen)}
              >
                Buscar asociaciones
                <ChevronDown className={`size-4 transition-transform ${assocPanelOpen ? 'rotate-180' : ''}`} />
              </Button>

              {assocPanelOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                  <div className="flex border-b">
                    {(['contactos', 'empresas', 'oportunidades'] as const).map((cat) => {
                      const count = cat === 'contactos' ? contacts.length : cat === 'empresas' ? companies.length : opportunities.length;
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={`flex-1 px-2 py-2 text-xs font-medium capitalize transition-colors ${entityCategory === cat ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => { setEntityCategory(cat); setEntitySearch(''); }}
                        >
                          {cat} <span className="text-muted-foreground">({count})</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-2">
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar..."
                        value={entitySearch}
                        onChange={(e) => setEntitySearch(e.target.value)}
                        className="pl-7 h-8 text-sm"
                      />
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-0.5">
                      {filteredItems.length > 0 ? filteredItems.map((item) => {
                        const isSelected = associations.some((a) => a.type === item.type && a.id === item.value);
                        return (
                          <div
                            key={`${item.type}-${item.value}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleAssociation(item.value, item.type, item.label)}
                            onKeyDown={(e) => e.key === 'Enter' && toggleAssociation(item.value, item.type, item.label)}
                            className={cn('flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted', isSelected && 'bg-muted')}
                          >
                            <Checkbox checked={isSelected} className="size-3.5 pointer-events-none" />
                            {item.type === 'contactos' && <User className="size-3.5 text-muted-foreground" />}
                            {item.type === 'empresas' && <Building2 className="size-3.5 text-muted-foreground" />}
                            {item.type === 'oportunidades' && <Briefcase className="size-3.5 text-muted-foreground" />}
                            <span className="truncate">{item.label}</span>
                          </div>
                        );
                      }) : (
                        <p className="py-4 text-center text-xs text-muted-foreground">Sin resultados</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

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