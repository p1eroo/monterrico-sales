import { create } from 'zustand';
import type { Activity, ActivityStatus, ContactPriority, TaskKind } from '@/types';
import { TASK_KINDS } from '@/types';
import {
  fetchActivities,
  createActivity as apiCreate,
  updateActivity as apiUpdate,
  deleteActivity as apiDelete,
  type CreateActivityPayload,
  type UpdateActivityPayload,
} from '@/lib/activityApi';

const ACTIVITY_STATUSES: ActivityStatus[] = ['pendiente', 'completada', 'en_progreso', 'vencida'];

function parseActivityStatus(raw: string): ActivityStatus {
  return ACTIVITY_STATUSES.includes(raw as ActivityStatus) ? (raw as ActivityStatus) : 'pendiente';
}

/** Vista previa local para que el UI reaccione al instante; el servidor confirma con la respuesta del PATCH. */
function mergeActivityOptimistic(activity: Activity, payload: UpdateActivityPayload): Activity {
  const next: Activity = { ...activity };
  if (payload.type !== undefined) next.type = payload.type;
  if (payload.taskKind !== undefined) {
    if (payload.taskKind == null || payload.taskKind === '') {
      next.taskKind = undefined;
    } else if (TASK_KINDS.includes(payload.taskKind as TaskKind)) {
      next.taskKind = payload.taskKind as TaskKind;
    }
  }
  if (payload.title !== undefined) next.title = payload.title;
  if (payload.description !== undefined) next.description = payload.description;
  if (payload.assignedTo !== undefined) next.assignedTo = payload.assignedTo;
  if (payload.status !== undefined) next.status = parseActivityStatus(payload.status);
  if (payload.priority !== undefined) {
    const p = payload.priority.trim().toLowerCase();
    if (p === 'alta' || p === 'media' || p === 'baja') next.priority = p as ContactPriority;
  }
  if (payload.dueDate !== undefined) next.dueDate = payload.dueDate;
  if (payload.startDate !== undefined) next.startDate = payload.startDate || undefined;
  if (payload.startTime !== undefined) next.startTime = payload.startTime || undefined;
  if (payload.completedAt !== undefined) {
    next.completedAt =
      payload.completedAt === '' ? undefined : payload.completedAt.slice(0, 10);
  }
  return next;
}

interface ActivitiesState {
  activities: Activity[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
  loadActivities: () => Promise<void>;
  createActivity: (payload: CreateActivityPayload) => Promise<Activity>;
  updateActivity: (id: string, payload: UpdateActivityPayload) => Promise<Activity>;
  deleteActivity: (id: string) => Promise<void>;
}

export const useActivitiesStore = create<ActivitiesState>((set, get) => ({
  activities: [],
  loading: false,
  error: null,
  loaded: false,

  loadActivities: async () => {
    const state = get();
    if (state.loading) return;
    set({ loading: true, error: null });
    try {
      const activities = await fetchActivities();
      set({ activities, loaded: true, error: null });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'Error al cargar actividades',
        activities: [],
        loaded: true,
      });
    } finally {
      set({ loading: false });
    }
  },

  createActivity: async (payload) => {
    const activity = await apiCreate(payload);
    set((s) => ({ activities: [activity, ...s.activities] }));
    return activity;
  },

  updateActivity: async (id, payload) => {
    const prevList = get().activities;
    const previous = prevList.find((a) => a.id === id);
    if (previous) {
      const optimistic = mergeActivityOptimistic(previous, payload);
      set((s) => ({
        activities: s.activities.map((a) => (a.id === id ? optimistic : a)),
      }));
    }
    try {
      const updated = await apiUpdate(id, payload);
      set((s) => ({
        activities: s.activities.map((a) => (a.id === id ? updated : a)),
      }));
      return updated;
    } catch (e) {
      if (previous) {
        set((s) => ({
          activities: s.activities.map((a) => (a.id === id ? previous : a)),
        }));
      }
      throw e;
    }
  },

  deleteActivity: async (id) => {
    await apiDelete(id);
    set((s) => ({ activities: s.activities.filter((a) => a.id !== id) }));
  },
}));
