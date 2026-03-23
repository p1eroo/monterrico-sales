import { useMemo } from 'react';
import { useAppStore } from '@/store';
import type { PermissionKey } from '@/types';
import { getTemplatePermissions, roleStringToTemplateId } from '@/data/rbac';

/**
 * Permisos según el rol del usuario autenticado (string del backend / store).
 * Mapea a plantillas de `rbac.ts` (admin, supervisor, asesor, solo_lectura).
 */
export function usePermissions() {
  const currentUser = useAppStore((s) => s.currentUser);

  const permissions = useMemo(() => {
    const templateId = roleStringToTemplateId(currentUser.role ?? '');
    return getTemplatePermissions(templateId);
  }, [currentUser.role]);

  function hasPermission(key: PermissionKey): boolean {
    return permissions[key] ?? false;
  }

  function canAccess(module: string): boolean {
    return hasPermission(`${module}.ver` as PermissionKey);
  }

  return { permissions, hasPermission, canAccess };
}
