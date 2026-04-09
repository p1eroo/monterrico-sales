import type { ActivityLog, TimelineEvent } from '@/types';
import { api } from '@/lib/api';
import { actionLabels } from '@/data/auditMock';

export type ActivityLogsPageResponse = {
  data: ActivityLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function fetchActivityLogs(params: {
  page?: number;
  limit?: number;
  search?: string;
  userId?: string;
  module?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
}): Promise<ActivityLogsPageResponse> {
  const sp = new URLSearchParams();
  if (params.page != null) sp.set('page', String(params.page));
  if (params.limit != null) sp.set('limit', String(params.limit));
  if (params.search?.trim()) sp.set('search', params.search.trim());
  if (params.userId?.trim()) sp.set('userId', params.userId.trim());
  if (params.module?.trim()) sp.set('module', params.module.trim());
  if (params.action?.trim()) sp.set('action', params.action.trim());
  if (params.entityType?.trim()) sp.set('entityType', params.entityType.trim());
  if (params.entityId?.trim()) sp.set('entityId', params.entityId.trim());
  const q = sp.toString();
  return api<ActivityLogsPageResponse>(`/activity-logs${q ? `?${q}` : ''}`);
}

function actionToTimelineType(action: string): TimelineEvent['type'] {
  switch (action) {
    case 'cambiar_etapa':
      return 'cambio_estado';
    case 'asignar':
    case 'crear':
      return 'tarea';
    case 'eliminar':
    case 'desactivar_usuario':
    case 'login':
    case 'login_fallido':
    case 'cambiar_password':
    default:
      return 'nota';
  }
}

/** Formato compatible con `TimelinePanel` (fecha local corta). */
export function activityLogToTimelineEvent(log: ActivityLog): TimelineEvent {
  let dateStr = log.timestamp;
  try {
    const d = new Date(log.timestamp);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      dateStr = `${y}-${m}-${day} ${h}:${min}`;
    }
  } catch {
    /* usar timestamp crudo */
  }

  return {
    id: log.id,
    type: actionToTimelineType(log.action),
    title: actionLabels[log.action] ?? log.action,
    description: log.description,
    user: log.userName,
    date: dateStr,
  };
}
