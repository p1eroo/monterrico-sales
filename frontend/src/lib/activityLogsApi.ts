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
  const a = action.trim().toLowerCase();
  switch (a) {
    case 'crear':
      return 'crear';
    case 'actualizar':
      return 'actualizar';
    case 'cambiar_etapa':
      return 'cambio_estado';
    case 'asignar':
      return 'asignar';
    case 'eliminar':
      return 'eliminar';
    case 'desactivar_usuario':
      return 'eliminar';
    case 'login':
    case 'login_fallido':
    case 'cambiar_password':
      return 'sistema';
    default:
      return 'nota';
  }
}

/**
 * Logs del módulo `actividades` guardan el subtipo en la descripción
 * (p. ej. «tarea (llamada)», «actividad (correo)»). Así el timeline puede
 * reutilizar el mismo icono que en actividades/tareas reales.
 */
function inferActivityModuleTimelineType(
  log: ActivityLog,
): TimelineEvent['type'] | null {
  if (log.module !== 'actividades') return null;
  const d = log.description.trim();
  const m = d.match(/^Se (?:creó|actualizó|eliminó) (?:una |la )(.+?): «/u);
  if (!m?.[1]) return null;
  const phrase = m[1].trim().toLowerCase();

  const taskSub = phrase.match(/^tarea \(([^)]+)\)$/);
  const activitySub = phrase.match(/^actividad \(([^)]+)\)$/);
  const raw = (taskSub?.[1] ?? activitySub?.[1] ?? '').trim().toLowerCase();

  if (raw === 'llamada') return 'llamada';
  if (raw === 'correo') return 'correo';
  if (raw === 'reunion' || raw === 'reunión') return 'reunion';
  if (raw === 'nota') return 'nota';
  if (raw === 'whatsapp') return 'whatsapp';
  if (phrase === 'tarea') return 'tarea';

  return null;
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

  const fromActivityModule = inferActivityModuleTimelineType(log);
  const type = fromActivityModule ?? actionToTimelineType(log.action);

  return {
    id: log.id,
    type,
    title: actionLabels[log.action] ?? log.action,
    description: log.description,
    user: log.userName,
    date: dateStr,
  };
}
