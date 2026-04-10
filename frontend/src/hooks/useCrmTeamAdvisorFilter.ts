import { useEffect } from 'react';
import { useAppStore } from '@/store';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Alinea el filtro “todos los asesores” con el backend: sin `equipo.datos_completos`
 * solo puede verse la cartera del usuario actual.
 */
export function useCrmTeamAdvisorFilter(
  filterValue: string,
  setFilter: (v: string) => void,
  allToken: string,
) {
  const { hasPermission } = usePermissions();
  const currentUserId = useAppStore((s) => s.currentUser.id);
  const canSeeAllAdvisors = hasPermission('equipo.datos_completos');

  useEffect(() => {
    if (!canSeeAllAdvisors && filterValue === allToken) {
      setFilter(currentUserId);
    }
  }, [allToken, canSeeAllAdvisors, currentUserId, filterValue, setFilter]);

  return { canSeeAllAdvisors, currentUserId };
}
