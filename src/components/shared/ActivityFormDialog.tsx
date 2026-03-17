import { useState } from 'react';
import { Phone, Users, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { users } from '@/data/mock';
import type { ActivityType, ActivityStatus } from '@/types';

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

export interface ActivityFormData {
  title: string;
  description: string;
  date: string;
  time: string;
  duration: string;
  result: string;
  dateTime: string;
  meetingType: string;
}

export interface ActivityResult {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  assignedTo: string;
  assignedToName: string;
  status: ActivityStatus;
  dueDate: string;
  createdAt: string;
  leadId?: string;
}

const emptyForm: ActivityFormData = {
  title: '',
  description: '',
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toTimeString().slice(0, 5),
  duration: '',
  result: '',
  dateTime: '',
  meetingType: '',
};

interface TaskSummary {
  title: string;
  company?: string;
  assignee: string;
  dueDate?: string;
  startTime?: string;
}

interface ActivityFormDialogProps {
  type: 'llamada' | 'reunion' | 'correo';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ActivityFormData) => void;
  /** Shows a task summary card and changes dialog text for task-completion context */
  taskSummary?: TaskSummary;
  /** Pre-fill the title field */
  defaultTitle?: string;
  /** Pre-fill date/time from task data */
  defaultDate?: string;
  defaultTime?: string;
  /** Show "Omitir" instead of "Cancelar" */
  showSkip?: boolean;
}

const typeConfig = {
  llamada: { icon: Phone, color: 'text-blue-600', label: 'Llamada', labelFem: 'a' },
  reunion: { icon: Users, color: 'text-emerald-600', label: 'Reunión', labelFem: 'a' },
  correo: { icon: Mail, color: 'text-purple-600', label: 'Correo', labelFem: 'o' },
};

export function ActivityFormDialog({
  type,
  open,
  onOpenChange,
  onSave,
  taskSummary,
  defaultTitle = '',
  defaultDate,
  defaultTime,
  showSkip = false,
}: ActivityFormDialogProps) {
  const [form, setForm] = useState<ActivityFormData>({
    ...emptyForm,
    title: defaultTitle,
    date: defaultDate || emptyForm.date,
    time: defaultTime || emptyForm.time,
    dateTime: defaultDate && defaultTime ? `${defaultDate}T${defaultTime}` : '',
  });

  const config = typeConfig[type];
  const Icon = config.icon;

  function handleOpenChange(value: boolean) {
    onOpenChange(value);
    if (!value) {
      setForm({ ...emptyForm });
    }
  }

  function handleSave() {
    onSave(form);
    toast.success(`${config.label} registrad${config.labelFem} exitosamente`);
    setForm({ ...emptyForm });
  }

  const set = <K extends keyof ActivityFormData>(key: K, value: ActivityFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`size-5 ${config.color}`} /> Registrar {config.label}
          </DialogTitle>
          <DialogDescription>
            {taskSummary
              ? `La tarea "${taskSummary.title}" fue completada. Registra los detalles de la actividad.`
              : `Registra los detalles de la ${type === 'correo' ? 'el correo' : type === 'llamada' ? 'llamada' : 'reunión'}.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {taskSummary && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tarea</span>
                <span className="font-medium">{taskSummary.title}</span>
              </div>
              {taskSummary.company && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Empresa</span>
                  <span className="font-medium">{taskSummary.company}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Responsable</span>
                <span>{taskSummary.assignee}</span>
              </div>
            </div>
          )}

          {type === 'llamada' && (
            <>
              <div className="space-y-2">
                <Label>Asunto</Label>
                <Input placeholder="Asunto de la llamada" value={form.title} onChange={(e) => set('title', e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Hora</Label>
                  <Input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Duración (min)</Label>
                  <Input type="number" min={1} placeholder="Ej: 15" value={form.duration} onChange={(e) => set('duration', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Resultado</Label>
                <Select value={form.result} onValueChange={(v) => set('result', v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contactado">Contactado</SelectItem>
                    <SelectItem value="no_contesta">No contesta</SelectItem>
                    <SelectItem value="ocupado">Ocupado</SelectItem>
                    <SelectItem value="mensaje">Dejó mensaje</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Resumen</Label>
                <Textarea placeholder="Resumen de la conversación..." rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
              </div>
            </>
          )}

          {type === 'reunion' && (
            <>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input placeholder="Título de la reunión" value={form.title} onChange={(e) => set('title', e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fecha y hora</Label>
                  <Input type="datetime-local" value={form.dateTime} onChange={(e) => set('dateTime', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de reunión</Label>
                  <Select value={form.meetingType} onValueChange={(v) => set('meetingType', v)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presencial">Presencial</SelectItem>
                      <SelectItem value="virtual">Virtual</SelectItem>
                      <SelectItem value="telefonica">Telefónica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Resultado</Label>
                <Select value={form.result} onValueChange={(v) => set('result', v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectiva">Efectiva</SelectItem>
                    <SelectItem value="reprogramada">Reprogramada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notas de la reunión</Label>
                <Textarea placeholder="Puntos tratados, acuerdos, próximos pasos..." rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
              </div>
            </>
          )}

          {type === 'correo' && (
            <>
              <div className="space-y-2">
                <Label>Asunto</Label>
                <Input placeholder="Asunto del correo" value={form.title} onChange={(e) => set('title', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Resumen del contenido</Label>
                <Textarea placeholder="Resumen de lo enviado/recibido..." rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {showSkip ? 'Omitir' : 'Cancelar'}
          </Button>
          <Button className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={handleSave}>
            Guardar actividad
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
