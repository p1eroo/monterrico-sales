import { useMemo } from 'react';
import { useAppStore } from '@/store';
import type { PermissionKey } from '@/types';
import { INITIAL_ROLES } from '@/data/rbac';

/**
 * Hook para simular permisos en frontend.
 * En producción, vendría del backend según el rol del usuario.
 */
export function usePermissions() {
  const currentUser = useAppStore((s) => s.currentUser);

  const permissions = useMemo(() => {
    const roleId = currentUser.id === 'u1' ? 'r1' : 'r3';
    const role = INITIAL_ROLES.find((r) => r.id === roleId);
    return role?.permissions ?? ({} as Record<PermissionKey, boolean>);
  }, [currentUser.id]);

  function hasPermission(key: PermissionKey): boolean {
    return permissions[key] ?? false;
  }

  function canAccess(module: string): boolean {
    return hasPermission(`${module}.ver` as PermissionKey);
  }

  return { permissions, hasPermission, canAccess };
}
