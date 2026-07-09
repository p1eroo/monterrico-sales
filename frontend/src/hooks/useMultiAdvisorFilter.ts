import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUsers } from '@/hooks/useUsers';
import { useCrmTeamAdvisorFilter } from '@/hooks/useCrmTeamAdvisorFilter';

/** Tokens especiales del filtro multi-asesor (alineados con el backend). */
export const ADVISOR_UNASSIGNED = '__unassigned__';
export const ADVISOR_OTHERS = '__others__';
export const ADVISOR_NONE = '__none__';

export const ADVISOR_SPECIAL_OPTIONS = [
  { id: ADVISOR_UNASSIGNED, name: 'Sin asignar' },
  { id: ADVISOR_OTHERS, name: 'Otros' },
] as const;

export type AdvisorListQueryParams = {
  assignedTo?: string;
  excludeAssignedTo?: string;
  /** CSV de IDs de asesores activos (necesario para token __others__). */
  advisorPool?: string;
};

/**
 * Filtro multi-asesor unificado:
 * - inicia con todos los asesores + Sin asignar + Otros marcados
 * - desmarcar = no incluir esa categoría (inclusión estricta vía assignedTo)
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

  const allSelectableIds = useMemo(
    () =>
      canSeeAllAdvisors
        ? [...allAdvisorIds, ADVISOR_UNASSIGNED, ADVISOR_OTHERS]
        : allAdvisorIds,
    [canSeeAllAdvisors, allAdvisorIds],
  );

  const allAdvisorsSelected =
    canSeeAllAdvisors &&
    allSelectableIds.length > 0 &&
    selectedIds.length === allSelectableIds.length &&
    allSelectableIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    if (!canSeeAllAdvisors) {
      if (!initialized) setInitialized(true);
      return;
    }
    if (allAdvisorIds.length === 0) return;
    if (initialized) return;
    setSelectedIds([
      ...allAdvisorIds,
      ADVISOR_UNASSIGNED,
      ADVISOR_OTHERS,
    ]);
    setInitialized(true);
  }, [canSeeAllAdvisors, allAdvisorIds, initialized]);

  // Si llegan asesores nuevos tras init y el filtro sigue en “todos”, incluirlos.
  useEffect(() => {
    if (!canSeeAllAdvisors || !initialized) return;
    if (allAdvisorIds.length === 0) return;
    setSelectedIds((prev) => {
      const specialsSelected =
        prev.includes(ADVISOR_UNASSIGNED) && prev.includes(ADVISOR_OTHERS);
      const prevAdvisors = prev.filter(
        (id) => id !== ADVISOR_UNASSIGNED && id !== ADVISOR_OTHERS,
      );
      const missing = allAdvisorIds.filter((id) => !prevAdvisors.includes(id));
      if (missing.length === 0) return prev;
      const onlyKnownAdvisors = prevAdvisors.every((id) =>
        allAdvisorIds.includes(id),
      );
      // “Todos” ≈ todos los asesores conocidos + ambos especiales
      if (
        specialsSelected &&
        onlyKnownAdvisors &&
        prevAdvisors.length === allAdvisorIds.length - missing.length
      ) {
        return [...allAdvisorIds, ADVISOR_UNASSIGNED, ADVISOR_OTHERS];
      }
      return prev;
    });
  }, [canSeeAllAdvisors, initialized, allAdvisorIds]);

  const isActive = canSeeAllAdvisors
    ? initialized && (selectedIds.length === 0 || !allAdvisorsSelected)
    : false;

  const queryParams: AdvisorListQueryParams = useMemo(() => {
    if (!canSeeAllAdvisors) {
      return {
        assignedTo: selectedIds.length > 0 ? selectedIds.join(',') : undefined,
        excludeAssignedTo: undefined,
        advisorPool: undefined,
      };
    }
    if (!initialized || allAdvisorIds.length === 0 || allAdvisorsSelected) {
      return {
        assignedTo: undefined,
        excludeAssignedTo: undefined,
        advisorPool: undefined,
      };
    }
    if (selectedIds.length === 0) {
      return {
        assignedTo: ADVISOR_NONE,
        excludeAssignedTo: undefined,
        advisorPool: allAdvisorIds.join(','),
      };
    }
    return {
      assignedTo: selectedIds.join(','),
      excludeAssignedTo: undefined,
      advisorPool: allAdvisorIds.join(','),
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
      if (selectedIds.length === 0) return false;

      const includeUnassigned = selectedIds.includes(ADVISOR_UNASSIGNED);
      const includeOthers = selectedIds.includes(ADVISOR_OTHERS);
      const selectedAdvisorIds = selectedIds.filter(
        (id) => id !== ADVISOR_UNASSIGNED && id !== ADVISOR_OTHERS,
      );

      if (!assignedTo) return includeUnassigned;
      if (selectedAdvisorIds.includes(assignedTo)) return true;
      if (includeOthers && !allAdvisorIds.includes(assignedTo)) return true;
      return false;
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
    setSelectedIds(
      canSeeAllAdvisors
        ? [...allAdvisorIds, ADVISOR_UNASSIGNED, ADVISOR_OTHERS]
        : [currentUserId],
    );
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
