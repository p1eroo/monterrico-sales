import { useState } from 'react';
import { Phone, Users, Mail, MessageCircle, User, Building2, Briefcase } from 'lucide-react';
import { toast } from '@/lib/notify';
import type { ActivityType, ActivityStatus, TaskAssociation } from '@/types';
import { formatNowPeruTimeHHmm, formatTodayPeruYmd } from '@/lib/formatters';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  FormDialogActions,
  FormDialogField,
  FormDialogGrid,
  FormDialogShell,
  formDialogInputClass,
  formDialogSelectTriggerClass,
  formDialogTextareaClass,
} from '@/components/ui/form-dialog';
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
  contactId?: string;
}

function createEmptyForm(): ActivityFormData {
  return {
    title: '',
    description: '',
    date: formatTodayPeruYmd(),
    time: formatNowPeruTimeHHmm(),
    duration: '',
    result: '',
    dateTime: '',
    meetingType: '',
  };
}

interface TaskSummary {
  title: string;
  company?: string;
  assignee: string;
  dueDate?: string;
  startTime?: string;
  linkBadges?: Pick<TaskAssociation, 'type' | 'name'>[];
}

interface ActivityFormDialogProps {
  type: 'llamada' | 'reunion' | 'correo' | 'whatsapp';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ActivityFormData) => void | Promise<void>;
  taskSummary?: TaskSummary;
  defaultTitle?: string;
  defaultDate?: string;
  defaultTime?: string;
  showSkip?: boolean;
}

const typeConfig = {
  llamada: { icon: Phone, color: 'text-blue-600', label: 'Llamada', labelFem: 'a' },
  reunion: { icon: Users, color: 'text-emerald-600', label: 'Reunión', labelFem: 'a' },
  correo: { icon: Mail, color: 'text-purple-600', label: 'Correo', labelFem: 'o' },
  whatsapp: { icon: MessageCircle, color: 'text-green-600', label: 'WhatsApp', labelFem: 'o' },
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
  const [form, setForm] = useState<ActivityFormData>(() => {
    const base = createEmptyForm();
    const time = defaultTime ?? base.time;
    return {
      ...base,
      title: defaultTitle,
      date: defaultDate ?? base.date,
      time,
      dateTime: defaultDate ? `${defaultDate}T${time}` : '',
    };
  });

  const config = typeConfig[type];
  const Icon = config.icon;

  function handleOpenChange(value: boolean) {
    onOpenChange(value);
    if (!value) {
      setForm(createEmptyForm());
    }
  }

  async function handleSave() {
    try {
      await Promise.resolve(onSave(form));
      toast.success(`${config.label} registrad${config.labelFem} exitosamente`);
      setForm(createEmptyForm());
    } catch {
      /* el padre ya mostró el error */
    }
  }

  const set = <K extends keyof ActivityFormData>(key: K, value: ActivityFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      maxWidthClassName="sm:max-w-lg"
      title={(
        <span className="inline-flex items-center gap-2">
          <Icon className={`size-5 ${config.color}`} />
          Registrar {config.label}
        </span>
      )}
      description={
        taskSummary
          ? `Registra los detalles de la actividad. Al guardar, la tarea «${taskSummary.title}» quedará como completada.`
          : `Registra los detalles de la ${type === 'correo' ? 'el correo' : type === 'llamada' ? 'llamada' : type === 'whatsapp' ? 'conversación de WhatsApp' : 'reunión'}.`
      }
      footer={(
        <FormDialogActions
          cancelLabel={showSkip ? 'Omitir' : 'Cancelar'}
          submitLabel="Guardar actividad"
          onCancel={() => handleOpenChange(false)}
          onSubmit={() => void handleSave()}
        />
      )}
    >
      <div className="space-y-6">
        {taskSummary && (
          <div className="space-y-2 rounded-xl border border-slate-300/80 bg-muted/20 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Tarea</span>
              <span className="font-medium text-right">{taskSummary.title}</span>
            </div>
            {taskSummary.company && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Empresa</span>
                <span className="font-medium text-right">{taskSummary.company}</span>
              </div>
            )}
            {taskSummary.linkBadges && taskSummary.linkBadges.length > 0 && (
              <div className="pt-0.5">
                <p className="mb-2 text-xs text-muted-foreground">Vinculado a</p>
                <div className="flex flex-wrap gap-1.5">
                  {taskSummary.linkBadges.map((row, idx) => (
                    <Badge key={`${row.type}-${idx}-${row.name}`} variant="secondary" className="gap-1 rounded-md border border-border/60 bg-muted/40 pr-1.5 text-xs">
                      {row.type === 'contacto' && <User className="size-3" />}
                      {(row.type === 'empresa' || row.type === 'cliente_empresa') && <Building2 className="size-3" />}
                      {row.type === 'negocio' && <Briefcase className="size-3" />}
                      <span className="max-w-[12rem] truncate">{row.name}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Responsable</span>
              <span>{taskSummary.assignee}</span>
            </div>
          </div>
        )}

        {type === 'llamada' && (
          <>
            <FormDialogField label="Asunto">
              <Input className={formDialogInputClass} placeholder="Asunto de la llamada" value={form.title} onChange={(e) => set('title', e.target.value)} />
            </FormDialogField>
            <FormDialogGrid className="sm:grid-cols-3">
              <FormDialogField label="Fecha">
                <Input type="date" className={formDialogInputClass} value={form.date} onChange={(e) => set('date', e.target.value)} />
              </FormDialogField>
              <FormDialogField label="Hora">
                <Input type="time" className={formDialogInputClass} value={form.time} onChange={(e) => set('time', e.target.value)} />
              </FormDialogField>
              <FormDialogField label="Duración (min)">
                <Input type="number" min={1} className={formDialogInputClass} placeholder="Ej: 15" value={form.duration} onChange={(e) => set('duration', e.target.value)} />
              </FormDialogField>
            </FormDialogGrid>
            <FormDialogField label="Resultado">
              <Select value={form.result} onValueChange={(v) => set('result', v)}>
                <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contactado">Contactado</SelectItem>
                  <SelectItem value="no_contesta">No contesta</SelectItem>
                  <SelectItem value="ocupado">Ocupado</SelectItem>
                  <SelectItem value="mensaje">Dejó mensaje</SelectItem>
                </SelectContent>
              </Select>
            </FormDialogField>
            <FormDialogField label="Resumen" compactControl={false}>
              <Textarea className={formDialogTextareaClass} placeholder="Resumen de la conversación..." rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </FormDialogField>
          </>
        )}

        {type === 'reunion' && (
          <>
            <FormDialogField label="Título">
              <Input className={formDialogInputClass} placeholder="Título de la reunión" value={form.title} onChange={(e) => set('title', e.target.value)} />
            </FormDialogField>
            <FormDialogGrid>
              <FormDialogField label="Fecha y hora">
                <Input type="datetime-local" className={formDialogInputClass} value={form.dateTime} onChange={(e) => set('dateTime', e.target.value)} />
              </FormDialogField>
              <FormDialogField label="Tipo de reunión">
                <Select value={form.meetingType} onValueChange={(v) => set('meetingType', v)}>
                  <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presencial">Presencial</SelectItem>
                    <SelectItem value="virtual">Virtual</SelectItem>
                    <SelectItem value="telefonica">Telefónica</SelectItem>
                  </SelectContent>
                </Select>
              </FormDialogField>
            </FormDialogGrid>
            <FormDialogField label="Resultado">
              <Select value={form.result} onValueChange={(v) => set('result', v)}>
                <SelectTrigger className={formDialogSelectTriggerClass}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectiva">Efectiva</SelectItem>
                  <SelectItem value="reprogramada">Reprogramada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </FormDialogField>
            <FormDialogField label="Notas de la reunión" compactControl={false}>
              <Textarea className={formDialogTextareaClass} placeholder="Puntos tratados, acuerdos, próximos pasos..." rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </FormDialogField>
          </>
        )}

        {type === 'correo' && (
          <>
            <FormDialogField label="Asunto">
              <Input className={formDialogInputClass} placeholder="Asunto del correo" value={form.title} onChange={(e) => set('title', e.target.value)} />
            </FormDialogField>
            <FormDialogField label="Resumen del contenido" compactControl={false}>
              <Textarea className={formDialogTextareaClass} placeholder="Resumen de lo enviado/recibido..." rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </FormDialogField>
          </>
        )}

        {type === 'whatsapp' && (
          <>
            <FormDialogField label="Tema">
              <Input className={formDialogInputClass} placeholder="Tema del seguimiento" value={form.title} onChange={(e) => set('title', e.target.value)} />
            </FormDialogField>
            <FormDialogField label="Resumen" compactControl={false}>
              <Textarea className={formDialogTextareaClass} placeholder="Qué se acordó o conversó..." rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </FormDialogField>
          </>
        )}
      </div>
    </FormDialogShell>
  );
}
