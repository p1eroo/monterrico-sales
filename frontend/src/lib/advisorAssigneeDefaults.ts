import { canReassignCommercialAdvisor } from '@/data/rbac';

type AdvisorUserRef = { id: string; name?: string; role?: string };

/** Resuelve el asesor a mostrar/guardar: prioriza el explícito; si no puede reasignar, usa al usuario actual. */
export function resolveAdvisorAssigneeId(
  preferredId: string | undefined | null,
  currentUser: AdvisorUserRef,
): string {
  const trimmed = preferredId?.trim();
  if (trimmed) return trimmed;
  if (!canReassignCommercialAdvisor(currentUser.role ?? '') && currentUser.id) {
    return currentUser.id;
  }
  return '';
}

export function canUserReassignCommercialAdvisor(role?: string): boolean {
  return canReassignCommercialAdvisor(role ?? '');
}
