import { useMemo } from 'react';
import { useAppStore } from '@/store';
import type { PermissionKey } from '@/types';
import {
  allValidPermissionKeys,
  getTemplatePermissions,
  roleStringToTemplateId,
} from '@/data/rbac';

/**
 * Permisos: `permissionKeys !== null` viene del backend (login o /auth/me).
 * `null` = fallback a plantillas `rbac.ts` por slug del rol.
 */
export function usePermissions() {
  const currentUser = useAppStore((s) => s.currentUser);
  const permissionKeys = useAppStore((s) => s.permissionKeys);

  const permissions = useMemo(() => {
    if (permissionKeys !== null) {
      const set = new Set(permissionKeys);
      const rec = {} as Record<PermissionKey, boolean>;
      for (const k of allValidPermissionKeys()) {
        rec[k] = set.has(k);
      }
      return rec;
    }
    const templateId = roleStringToTemplateId(currentUser.role ?? '');
    return getTemplatePermissions(templateId);
  }, [permissionKeys, currentUser.role]);

  function hasPermission(key: PermissionKey): boolean {
    if (permissionKeys !== null) {
      return permissionKeys.includes(key);
    }
    return permissions[key] ?? false;
  }

  function canAccess(module: string): boolean {
    return hasPermission(`${module}.ver` as PermissionKey);
  }

  return { permissions, hasPermission, canAccess };
}
