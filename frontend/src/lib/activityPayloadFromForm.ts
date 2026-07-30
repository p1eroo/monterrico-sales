import type { ActivityFormData } from '@/components/shared/ActivityFormDialog';
import type { Activity, TaskKind } from '@/types';
import type { CreateActivityPayload, UpdateActivityPayload } from '@/lib/activityApi';
import { linkIdsFromActivity } from '@/lib/activityEntityLinks';
import { formatTodayPeruYmd } from '@/lib/formatters';

export type ActivityEntityContext = {
  contactId?: string;
  companyId?: string;
  opportunityId?: string;
  clienteEmpresaId?: string;
};

export function entityContextFromActivity(
  activity: Pick<
    Activity,
    | 'contactId'
    | 'companyId'
    | 'opportunityId'
    | 'clienteEmpresaId'
    | 'linkedContacts'
    | 'linkedCompanies'
    | 'linkedOpportunities'
    | 'linkedClienteEmpresas'
  >,
): ActivityEntityContext {
  const links = linkIdsFromActivity(activity as Activity);
  return {
    contactId: links.contactIds[0],
    companyId: links.companyIds[0],
    opportunityId: links.opportunityIds[0],
    clienteEmpresaId: links.clienteEmpresaIds[0],
  };
}

export function entityLinkIdsFromActivity(
  activity: Pick<
    Activity,
    | 'contactId'
    | 'companyId'
    | 'opportunityId'
    | 'clienteEmpresaId'
    | 'linkedContacts'
    | 'linkedCompanies'
    | 'linkedOpportunities'
    | 'linkedClienteEmpresas'
  >,
): Pick<
  CreateActivityPayload,
  'contactIds' | 'companyIds' | 'opportunityIds' | 'clienteEmpresaIds'
> {
  const links = linkIdsFromActivity(activity as Activity);
  return {
    contactIds: links.contactIds,
    companyIds: links.companyIds,
    opportunityIds: links.opportunityIds,
    clienteEmpresaIds: links.clienteEmpresaIds,
  };
}

export function activityPayloadFromForm(
  kind: 'llamada' | 'reunion' | 'correo' | 'whatsapp',
  data: ActivityFormData,
  ctx: ActivityEntityContext,
  assignedTo: string,
): CreateActivityPayload {
  const today = formatTodayPeruYmd();
  let dueDate = today;
  let startDate = today;
  let startTime = '09:00';
  const extra: string[] = [];

  if (kind === 'llamada') {
    dueDate = data.date || today;
    startDate = data.date || today;
    startTime = data.time || '09:00';
    if (data.duration) extra.push(`Duración: ${data.duration} min`);
    if (data.result) extra.push(`Resultado: ${data.result}`);
  } else if (kind === 'reunion') {
    const dt = data.dateTime?.trim();
    if (dt) {
      dueDate = dt.slice(0, 10);
      startDate = dt.slice(0, 10);
      startTime = dt.length >= 16 ? dt.slice(11, 16) : '09:00';
    }
    if (data.meetingType) extra.push(`Modalidad: ${data.meetingType}`);
    if (data.result) extra.push(`Resultado: ${data.result}`);
  }

  const title =
    data.title?.trim() ||
    (kind === 'llamada'
      ? 'Llamada'
      : kind === 'reunion'
        ? 'Reunión'
        : kind === 'correo'
          ? 'Correo'
          : 'WhatsApp');
  const description = [data.description?.trim(), ...extra].filter(Boolean).join('\n');

  return {
    type: kind,
    title,
    description,
    assignedTo,
    dueDate,
    startDate,
    startTime,
    ...ctx,
  };
}

export async function completeTaskWithActivityForm(params: {
  kind: TaskKind;
  form: ActivityFormData;
  task: Pick<
    Activity,
    | 'id'
    | 'assignedTo'
    | 'contactId'
    | 'companyId'
    | 'opportunityId'
    | 'clienteEmpresaId'
  >;
  createActivity: (payload: CreateActivityPayload) => Promise<Activity>;
  updateActivity: (id: string, payload: UpdateActivityPayload) => Promise<Activity>;
}): Promise<{ savedActivity: Activity; updatedTask: Activity }> {
  const assignedTo = params.task.assignedTo?.trim();
  if (!assignedTo) {
    throw new Error('No hay usuario asignado para la actividad');
  }

  const completedAt = formatTodayPeruYmd();
  const summary = params.form.description?.trim() || '';
  const activityPayload: CreateActivityPayload = {
    ...activityPayloadFromForm(
      params.kind,
      params.form,
      entityContextFromActivity(params.task),
      assignedTo,
    ),
    ...entityLinkIdsFromActivity(params.task),
    status: 'completada',
    completedAt,
  };

  const taskUpdate: UpdateActivityPayload = {
    status: 'completada',
    completedAt,
    ...(summary ? { description: summary } : {}),
  };

  const savedActivity = await params.createActivity(activityPayload);
  const updatedTask = await params.updateActivity(params.task.id, taskUpdate);
  return { savedActivity, updatedTask };
}
