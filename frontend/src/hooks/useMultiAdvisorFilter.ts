import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUsers } from '@/hooks/useUsers';
import { useCrmTeamAdvisorFilter } from '@/hooks/useCrmTeamAdvisorFilter';

export type AdvisorListQueryParams = {
  assignedTo?: string;
  excludeAssignedTo?: string;
};

/**
 * Filtro multi-asesor unificado:
 * - inicia con todos marcados (quien puede ver equipo)
 * - desmarcar = excluir esos IDs; sin asignar / ex-asesores siguen visibles
 * - todos marcados = sin filtro de asesor
 */
export function useMultiAdvisorFilter() {
  const { activeAdvisors } = useUsers();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const { canSeeAllAdvisors, currentUserId } = useCrmTeamAdvisorFilter(
    selectedIds,
    setSelectedIds,
  );

  const allAdvisorIds = useMemo(
    () => activeAdvisors.map((u) => u.id),
    [activeAdvisors],
  );

  const allAdvisorsSelected =
    canSeeAllAdvisors &&
    allAdvisorIds.length > 0 &&
    selectedIds.length === allAdvisorIds.length &&
    allAdvisorIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    if (!canSeeAllAdvisors) {
      if (!initialized) setInitialized(true);
      return;
    }
    if (allAdvisorIds.length === 0) return;
    if (initialized) return;
    setSelectedIds(allAdvisorIds);
    setInitialized(true);
  }, [canSeeAllAdvisors, allAdvisorIds, initialized]);

  const isActive = canSeeAllAdvisors
    ? initialized && (selectedIds.length === 0 || !allAdvisorsSelected)
    : false;

  const queryParams: AdvisorListQueryParams = useMemo(() => {
    if (!canSeeAllAdvisors) {
      return {
        assignedTo: selectedIds.length > 0 ? selectedIds.join(',') : undefined,
        excludeAssignedTo: undefined,
      };
    }
    if (!initialized || allAdvisorIds.length === 0 || allAdvisorsSelected) {
      return { assignedTo: undefined, excludeAssignedTo: undefined };
    }
    const excluded = allAdvisorIds.filter((id) => !selectedIds.includes(id));
    return {
      assignedTo: undefined,
      excludeAssignedTo: excluded.length > 0 ? excluded.join(',') : undefined,
    };
  }, [
    canSeeAllAdvisors,
    selectedIds,
    allAdvisorIds,
    allAdvisorsSelected,
    initialized,
  ]);

  const matchesAssignee = useCallback(
    (assignedTo: string | null | undefined): boolean => {
      if (!canSeeAllAdvisors) {
        return (
          selectedIds.length === 0 ||
          (!!assignedTo && selectedIds.includes(assignedTo))
        );
      }
      if (!initialized || allAdvisorIds.length === 0 || allAdvisorsSelected) {
        return true;
      }
      const excluded = allAdvisorIds.filter((id) => !selectedIds.includes(id));
      if (excluded.length === 0) return true;
      return !assignedTo || !excluded.includes(assignedTo);
    },
    [
      canSeeAllAdvisors,
      selectedIds,
      initialized,
      allAdvisorIds,
      allAdvisorsSelected,
    ],
  );

  const reset = useCallback(() => {
    setSelectedIds(canSeeAllAdvisors ? allAdvisorIds : [currentUserId]);
  }, [canSeeAllAdvisors, allAdvisorIds, currentUserId]);

  return {
    selectedIds,
    setSelectedIds,
    canSeeAllAdvisors,
    currentUserId,
    activeAdvisors,
    allAdvisorIds,
    allAdvisorsSelected,
    isInitialized: initialized,
    isActive,
    queryParams,
    matchesAssignee,
    reset,
  };
}
