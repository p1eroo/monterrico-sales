import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  FormDialogField,
  FormDialogGrid,
  formDialogInputClass,
  formDialogSelectTriggerClass,
  formDialogTextareaClass,
} from '@/components/ui/form-dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CALL_RESULT_OPTIONS } from '@/lib/callResult';

export type ActivityFormFieldsData = {
  title: string;
  description: string;
  date: string;
  time: string;
  duration: string;
  result: string;
  dateTime: string;
  meetingType: string;
};

export type ActivityFormFieldsType =
  | 'llamada'
  | 'reunion'
  | 'correo'
  | 'whatsapp'
  | 'nota'
  | 'tarea';

type Props = {
  type: ActivityFormFieldsType;
  form: ActivityFormFieldsData;
  onChange: <K extends keyof ActivityFormFieldsData>(
    key: K,
    value: ActivityFormFieldsData[K],
  ) => void;
};

export function ActivityTypeFormFields({ type, form, onChange }: Props) {
  const set = <K extends keyof ActivityFormFieldsData>(key: K, value: ActivityFormFieldsData[K]) =>
    onChange(key, value);

  if (type === 'llamada') {
    return (
      <>
        <FormDialogField label="Asunto">
          <Input
            className={formDialogInputClass}
            placeholder="Asunto de la llamada"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </FormDialogField>
        <FormDialogGrid>
          <FormDialogField label="Fecha">
            <Input
              type="date"
              className={formDialogInputClass}
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </FormDialogField>
          <FormDialogField label="Hora">
            <Input
              type="time"
              className={formDialogInputClass}
              value={form.time}
              onChange={(e) => set('time', e.target.value)}
            />
          </FormDialogField>
          <FormDialogField label="Duración (min)">
            <Input
              type="number"
              min={1}
              className={formDialogInputClass}
              placeholder="Ej: 15"
              value={form.duration}
              onChange={(e) => set('duration', e.target.value)}
            />
          </FormDialogField>
        </FormDialogGrid>
        <FormDialogField label="Resultado">
          <Select value={form.result} onValueChange={(v) => set('result', v)}>
            <SelectTrigger className={formDialogSelectTriggerClass}>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Contacto</SelectLabel>
                {CALL_RESULT_OPTIONS.filter((option) => option.group === 'contacto').map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>No contacto</SelectLabel>
                {CALL_RESULT_OPTIONS.filter((option) => option.group === 'no_contacto').map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </FormDialogField>
        <FormDialogField label="Resumen" compactControl={false}>
          <Textarea
            className={formDialogTextareaClass}
            placeholder="Resumen de la conversación..."
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </FormDialogField>
      </>
    );
  }

  if (type === 'reunion') {
    return (
      <>
        <FormDialogField label="Título">
          <Input
            className={formDialogInputClass}
            placeholder="Título de la reunión"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </FormDialogField>
        <FormDialogGrid>
          <FormDialogField label="Fecha y hora">
            <Input
              type="datetime-local"
              className={formDialogInputClass}
              value={form.dateTime}
              onChange={(e) => set('dateTime', e.target.value)}
            />
          </FormDialogField>
          <FormDialogField label="Tipo de reunión">
            <Select value={form.meetingType} onValueChange={(v) => set('meetingType', v)}>
              <SelectTrigger className={formDialogSelectTriggerClass}>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
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
            <SelectTrigger className={formDialogSelectTriggerClass}>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="efectiva">Efectiva</SelectItem>
              <SelectItem value="reprogramada">Reprogramada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </FormDialogField>
        <FormDialogField label="Notas de la reunión" compactControl={false}>
          <Textarea
            className={formDialogTextareaClass}
            placeholder="Puntos tratados, acuerdos, próximos pasos..."
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </FormDialogField>
      </>
    );
  }

  if (type === 'correo') {
    return (
      <>
        <FormDialogField label="Asunto">
          <Input
            className={formDialogInputClass}
            placeholder="Asunto del correo"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </FormDialogField>
        <FormDialogField label="Resumen del contenido" compactControl={false}>
          <Textarea
            className={formDialogTextareaClass}
            placeholder="Resumen de lo enviado/recibido..."
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </FormDialogField>
      </>
    );
  }

  if (type === 'whatsapp') {
    return (
      <>
        <FormDialogField label="Tema">
          <Input
            className={formDialogInputClass}
            placeholder="Tema del seguimiento"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </FormDialogField>
        <FormDialogField label="Resumen" compactControl={false}>
          <Textarea
            className={formDialogTextareaClass}
            placeholder="Qué se acordó o conversó..."
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </FormDialogField>
      </>
    );
  }

  return (
    <>
      <FormDialogField label="Título">
        <Input
          className={formDialogInputClass}
          placeholder="Título"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
        />
      </FormDialogField>
      <FormDialogGrid>
        <FormDialogField label="Fecha">
          <Input
            type="date"
            className={formDialogInputClass}
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </FormDialogField>
        <FormDialogField label="Hora">
          <Input
            type="time"
            className={formDialogInputClass}
            value={form.time}
            onChange={(e) => set('time', e.target.value)}
          />
        </FormDialogField>
      </FormDialogGrid>
      <FormDialogField label="Descripción" compactControl={false}>
        <Textarea
          className={formDialogTextareaClass}
          placeholder="Detalle de la actividad..."
          rows={3}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </FormDialogField>
    </>
  );
}

export function editFormToFields(form: {
  title: string;
  summary: string;
  date: string;
  time: string;
  duration: string;
  callResult: string;
  dateTime: string;
  meetingType: string;
  meetingResult: string;
  type: string;
}): ActivityFormFieldsData {
  const type = form.type.trim().toLowerCase();
  return {
    title: form.title,
    description: form.summary,
    date: form.date,
    time: form.time,
    duration: form.duration,
    result: type === 'reunion' ? form.meetingResult : form.callResult,
    dateTime: form.dateTime,
    meetingType: form.meetingType,
  };
}

export function applyFieldsToEditForm<
  T extends {
    title: string;
    summary: string;
    date: string;
    time: string;
    duration: string;
    callResult: string;
    dateTime: string;
    meetingType: string;
    meetingResult: string;
    type: string;
  },
>(fields: ActivityFormFieldsData, prev: T): T {
  const type = prev.type.trim().toLowerCase();
  return {
    ...prev,
    title: fields.title,
    summary: fields.description,
    date: fields.date,
    time: fields.time,
    duration: fields.duration,
    callResult: type === 'llamada' ? fields.result : prev.callResult,
    meetingResult: type === 'reunion' ? fields.result : prev.meetingResult,
    dateTime: fields.dateTime,
    meetingType: fields.meetingType,
  };
}
