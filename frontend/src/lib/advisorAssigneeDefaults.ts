import {
  canAssignCommercialModule,
  type CommercialAssignModule,
} from '@/data/rbac';
import type { PermissionKey } from '@/types';

type AdvisorUserRef = { id: string; name?: string; role?: string };

/** Resuelve el asesor a mostrar/guardar: prioriza el explícito; si no puede asignar a otros, usa al usuario actual. */
export function resolveAdvisorAssigneeId(
  preferredId: string | undefined | null,
  currentUser: AdvisorUserRef,
  canAssignOthers = false,
): string {
  const trimmed = preferredId?.trim();
  if (trimmed) return trimmed;
  if (!canAssignOthers && currentUser.id) {
    return currentUser.id;
  }
  return '';
}

/** Si resolveAdvisorAssigneeId queda vacío (p. ej. admin), usa fallbackId (primer asesor activo). */
export function resolveAdvisorAssigneeIdWithFallback(
  preferredId: string | undefined | null,
  currentUser: AdvisorUserRef,
  fallbackId?: string | null,
  canAssignOthers = false,
): string {
  return (
    resolveAdvisorAssigneeId(preferredId, currentUser, canAssignOthers) ||
    fallbackId?.trim() ||
    ''
  );
}

export function canUserReassignCommercialAdvisor(
  hasPermission: (key: PermissionKey) => boolean,
  module: CommercialAssignModule,
): boolean {
  return canAssignCommercialModule(hasPermission, module);
}
