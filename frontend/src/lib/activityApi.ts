import type {
  Activity,
  ActivityStatus,
  ActivityType,
  CalendarEvent,
  CalendarEventStatus,
  CalendarEventType,
  RelatedEntityType,
} from '@/types';
import { api } from './api';

export type ApiActivity = {
  id: string;
  type: string;
  title: string;
  description: string;
  assignedTo: string;
  status: string;
  dueDate: string;
  startDate: string | null;
  startTime: string | null;
  completedAt: string | null;
  createdAt: string;
  user?: { id: string; name: string } | null;
  contacts?: { contact: { id: string; name: string } }[];
  companies?: { company: { id: string; name: string } }[];
  opportunities?: { opportunity: { id: string; title: string } }[];
};

const VALID_TYPES: ActivityType[] = [
  'llamada',
  'reunion',
  'tarea',
  'correo',
  'whatsapp',
];
const VALID_STATUSES: ActivityStatus[] = [
  'pendiente',
  'completada',
  'en_progreso',
  'vencida',
];

function parseType(raw: string): ActivityType {
  return VALID_TYPES.includes(raw as ActivityType) ? (raw as ActivityType) : 'tarea';
}

function parseStatus(raw: string): ActivityStatus {
  return VALID_STATUSES.includes(raw as ActivityStatus) ? (raw as ActivityStatus) : 'pendiente';
}

function toDateOnly(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function mapApiActivityToActivity(row: ApiActivity): Activity {
  const contact = row.contacts?.[0]?.contact;
  const company = row.companies?.[0]?.company;
  const opportunity = row.opportunities?.[0]?.opportunity;
  const contactName = contact
    ? company
      ? `${contact.name} - ${company.name}`
      : contact.name
    : company?.name;
  return {
    id: row.id,
    type: parseType(row.type),
    title: row.title,
    description: row.description ?? '',
    contactId: contact?.id,
    contactName: contactName ?? opportunity?.title ?? undefined,
    companyId: company?.id,
    opportunityId: opportunity?.id,
    opportunityTitle: opportunity?.title,
    assignedTo: row.assignedTo,
    assignedToName: row.user?.name ?? 'Sin asignar',
    status: parseStatus(row.status),
    dueDate: toDateOnly(row.dueDate),
    startDate: toDateOnly(row.startDate ?? '') || undefined,
    startTime: row.startTime ?? undefined,
    completedAt: row.completedAt ? toDateOnly(row.completedAt) : undefined,
    createdAt: toDateOnly(row.createdAt),
  };
}

export type CreateActivityPayload = {
  type: string;
  title: string;
  description?: string;
  assignedTo: string;
  dueDate: string;
  startDate?: string;
  startTime?: string;
  contactId?: string;
  companyId?: string;
  opportunityId?: string;
};

export type UpdateActivityPayload = {
  type?: string;
  title?: string;
  description?: string;
  assignedTo?: string;
  status?: string;
  dueDate?: string;
  startDate?: string;
  startTime?: string;
  completedAt?: string;
};

export async function fetchActivities(): Promise<Activity[]> {
  const rows = (await api<ApiActivity[]>('/activities')) ?? [];
  return rows.map(mapApiActivityToActivity);
}

export async function createActivity(payload: CreateActivityPayload): Promise<Activity> {
  const row = await api<ApiActivity>('/activities', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return mapApiActivityToActivity(row);
}

export async function updateActivity(
  id: string,
  payload: UpdateActivityPayload,
): Promise<Activity> {
  const row = await api<ApiActivity>(`/activities/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return mapApiActivityToActivity(row);
}

export async function deleteActivity(id: string): Promise<void> {
  await api(`/activities/${id}`, { method: 'DELETE' });
}

/** Convierte Activity a CalendarEvent para el Calendario */
export function activityToCalendarEvent(activity: Activity): CalendarEvent {
  const date = activity.startDate || activity.dueDate;
  const startTime = activity.startTime || '00:00';
  const [h, m] = startTime.split(':').map(Number);
  const endMin = (m + 30) % 60;
  const endHour = m + 30 >= 60 ? (h + 1) % 24 : h;
  const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

  let relatedEntityType: RelatedEntityType | undefined;
  let relatedEntityId: string | undefined;
  let relatedEntityName: string | undefined;
  if (activity.contactId) {
    relatedEntityType = 'contact';
    relatedEntityId = activity.contactId;
    relatedEntityName = activity.contactName;
  } else if (activity.opportunityId) {
    relatedEntityType = 'opportunity';
    relatedEntityId = activity.opportunityId;
    relatedEntityName = activity.opportunityTitle ?? activity.contactName;
  }

  return {
    id: activity.id,
    title: activity.title,
    type: (activity.type as CalendarEventType) ?? 'tarea',
    date,
    startTime,
    endTime,
    assignedTo: activity.assignedTo,
    assignedToName: activity.assignedToName,
    relatedEntityType,
    relatedEntityId,
    relatedEntityName,
    description: activity.description || undefined,
    status: (activity.status as CalendarEventStatus) ?? 'pendiente',
  };
}
