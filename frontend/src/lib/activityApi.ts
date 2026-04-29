import type {
  Activity,
  ActivityStatus,
  ActivityType,
  CalendarEvent,
  CalendarEventStatus,
  CalendarEventType,
  ContactPriority,
  RelatedEntityType,
  TaskKind,
} from '@/types';
import { TASK_KINDS } from '@/types';
import { api } from './api';

export type ApiActivity = {
  id: string;
  type: string;
  taskKind?: string | null;
  title: string;
  description: string;
  assignedTo?: string;
  status: string;
  priority?: string | null;
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
  'nota',
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
  return VALID_TYPES.includes(raw as ActivityType) ? (raw as ActivityType) : raw;
}

function parseStatus(raw: string): ActivityStatus {
  return VALID_STATUSES.includes(raw as ActivityStatus) ? (raw as ActivityStatus) : 'pendiente';
}

function parseTaskKind(raw: unknown): TaskKind | undefined {
  if (raw == null || typeof raw !== 'string') return undefined;
  return TASK_KINDS.includes(raw as TaskKind) ? (raw as TaskKind) : undefined;
}

const PRIORITIES: ContactPriority[] = ['alta', 'media', 'baja'];

function parsePriority(raw: unknown): ContactPriority | undefined {
  if (raw == null || typeof raw !== 'string') return undefined;
  const p = raw.trim().toLowerCase();
  return PRIORITIES.includes(p as ContactPriority) ? (p as ContactPriority) : undefined;
}

function toDateOnly(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function mapApiActivityToActivity(row: ApiActivity): Activity {
  const contact = row.contacts?.[0]?.contact;
  const company = row.companies?.[0]?.company;
  const opportunity = row.opportunities?.[0]?.opportunity;
  return {
    id: row.id,
    type: parseType(row.type),
    taskKind: parseTaskKind(row.taskKind),
    title: row.title,
    description: row.description ?? '',
    contactId: contact?.id,
    contactName: contact?.name,
    companyId: company?.id,
    companyName: company?.name,
    opportunityId: opportunity?.id,
    opportunityTitle: opportunity?.title,
    assignedTo: row.user?.id ?? row.assignedTo ?? '',
    assignedToName: row.user?.name ?? 'Sin asignar',
    status: parseStatus(row.status),
    priority: parsePriority(row.priority),
    dueDate: toDateOnly(row.dueDate),
    startDate: toDateOnly(row.startDate ?? '') || undefined,
    startTime: row.startTime ?? undefined,
    completedAt: row.completedAt ? toDateOnly(row.completedAt) : undefined,
    createdAt: toDateOnly(row.createdAt),
  };
}

export type CreateActivityPayload = {
  type: string;
  taskKind?: string;
  title: string;
  description?: string;
  assignedTo: string;
  status?: string;
  priority?: string;
  dueDate: string;
  startDate?: string;
  startTime?: string;
  completedAt?: string;
  contactId?: string;
  companyId?: string;
  opportunityId?: string;
};

export type UpdateActivityPayload = {
  type?: string;
  taskKind?: string | null;
  title?: string;
  description?: string;
  assignedTo?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  startDate?: string;
  startTime?: string;
  completedAt?: string;
};

export async function fetchActivities(): Promise<Activity[]> {
  const res = await api<{
    data: ApiActivity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>('/activities?limit=5000&page=1');
  const rows = res?.data ?? [];
  return rows.map(mapApiActivityToActivity);
}

export async function fetchActivitiesList(params: {
  assignedTo?: string;
  limit?: number;
}): Promise<Activity[]> {
  const q = new URLSearchParams();
  q.set('page', '1');
  q.set('limit', String(params.limit ?? 2000));
  if (params.assignedTo) q.set('assignedTo', params.assignedTo);
  const res = await api<{
    data: ApiActivity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>(`/activities?${q.toString()}`);
  const rows = res?.data ?? [];
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
  let relatedCompanyId: string | undefined;
  let relatedCompanyName: string | undefined;
  if (activity.contactId) {
    relatedEntityType = 'contact';
    relatedEntityId = activity.contactId;
    relatedEntityName = activity.contactName;
    if (activity.companyId) {
      relatedCompanyId = activity.companyId;
      relatedCompanyName = activity.companyName;
    }
  } else if (activity.companyId) {
    relatedEntityType = 'company';
    relatedEntityId = activity.companyId;
    relatedEntityName = activity.companyName ?? undefined;
  } else if (activity.opportunityId) {
    relatedEntityType = 'opportunity';
    relatedEntityId = activity.opportunityId;
    relatedEntityName = activity.opportunityTitle ?? activity.contactName;
  }

  const calType: CalendarEventType =
    activity.type === 'tarea' && activity.taskKind
      ? (activity.taskKind as CalendarEventType)
      : ((activity.type as CalendarEventType) ?? 'tarea');

  return {
    id: activity.id,
    title: activity.title,
    type: calType,
    activityRecordType: activity.type,
    taskKind: activity.type === 'tarea' ? activity.taskKind : undefined,
    date,
    startTime,
    endTime,
    assignedTo: activity.assignedTo,
    assignedToName: activity.assignedToName,
    relatedEntityType,
    relatedEntityId,
    relatedEntityName,
    relatedCompanyId,
    relatedCompanyName,
    description: activity.description || undefined,
    status: (activity.status as CalendarEventStatus) ?? 'pendiente',
  };
}
