import { useEffect } from 'react';
import { useActivitiesStore } from '@/store/activitiesStore';

/**
 * Actividades/tareas cargadas desde GET /activities.
 */
export function useActivities() {
  const {
    activities,
    loading,
    error,
    loaded,
    loadActivities,
    createActivity,
    updateActivity,
    deleteActivity,
  } = useActivitiesStore();

  useEffect(() => {
    if (!loaded && !loading) {
      void loadActivities();
    }
  }, [loaded, loading, loadActivities]);

  return {
    activities,
    loading,
    error,
    createActivity,
    updateActivity,
    deleteActivity,
    refresh: loadActivities,
  };
}
