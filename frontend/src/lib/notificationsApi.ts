import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '@/lib/api';
import type { NotificationItem, NotificationPriority } from '@/types';

export type NotificationApiRow = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  type: string;
  priority: string;
  important: boolean;
  contactId?: string;
  opportunityId?: string;
  activityId?: string;
};

export function mapApiNotificationToItem(row: NotificationApiRow): NotificationItem {
  const priority = (['alta', 'media', 'baja'].includes(row.priority)
    ? row.priority
    : 'media') as NotificationPriority;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    time: formatDistanceToNow(new Date(row.createdAt), {
      addSuffix: true,
      locale: es,
    }),
    read: row.read,
    type: row.type as NotificationItem['type'],
    priority,
    important: row.important,
    contactId: row.contactId,
    opportunityId: row.opportunityId,
    activityId: row.activityId,
    createdAt: row.createdAt,
  };
}

export async function notificationsList(
  limit = 100,
): Promise<NotificationApiRow[]> {
  return api<NotificationApiRow[]>(`/notifications?limit=${limit}`);
}

export async function notificationMarkRead(id: string): Promise<NotificationApiRow> {
  return api<NotificationApiRow>(`/notifications/${id}/read`, { method: 'PATCH' });
}

export async function notificationMarkAllRead(): Promise<{ count: number }> {
  return api<{ count: number }>(`/notifications/read-all`, { method: 'PATCH' });
}

export async function notificationDelete(id: string): Promise<void> {
  await api<{ ok: boolean }>(`/notifications/${id}`, { method: 'DELETE' });
}
