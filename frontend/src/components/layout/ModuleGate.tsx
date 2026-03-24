import { Outlet, useLocation, Navigate } from 'react-router-dom';
import type { PermissionKey } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import {
  getRequiredPermissionForPath,
  getFirstAccessiblePath,
} from '@/lib/routePermissions';

export function ModuleGate() {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const req = getRequiredPermissionForPath(location.pathname);
  if (req === null) {
    return <Outlet />;
  }
  const ok = Array.isArray(req)
    ? req.some((p) => hasPermission(p))
    : hasPermission(req as PermissionKey);
  if (ok) {
    return <Outlet />;
  }
  const to = getFirstAccessiblePath(hasPermission);
  return <Navigate to={to} replace />;
}
