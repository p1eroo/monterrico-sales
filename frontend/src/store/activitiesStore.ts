import { create } from 'zustand';
import type { Activity } from '@/types';
import {
  fetchActivities,
  createActivity as apiCreate,
  updateActivity as apiUpdate,
  deleteActivity as apiDelete,
  type CreateActivityPayload,
  type UpdateActivityPayload,
} from '@/lib/activityApi';

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
    const updated = await apiUpdate(id, payload);
    set((s) => ({
      activities: s.activities.map((a) => (a.id === id ? updated : a)),
    }));
    return updated;
  },

  deleteActivity: async (id) => {
    await apiDelete(id);
    set((s) => ({ activities: s.activities.filter((a) => a.id !== id) }));
  },
}));
