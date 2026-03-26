import type { PermissionKey } from '@/types';

type PathRule = {
  path: string;
  permission?: PermissionKey;
  anyOf?: readonly PermissionKey[];
};

function ruleAllows(hasPermission: (k: PermissionKey) => boolean, rule: PathRule): boolean {
  if (rule.anyOf?.length) return rule.anyOf.some((p) => hasPermission(p));
  if (rule.permission) return hasPermission(rule.permission);
  return false;
}

/** Orden para elegir la primera ruta accesible si la actual no está permitida */
export const ACCESSIBLE_PATH_ORDER: PathRule[] = [
  { path: '/dashboard', permission: 'dashboard.ver' },
  { path: '/contactos', permission: 'contactos.ver' },
  { path: '/empresas', permission: 'empresas.ver' },
  { path: '/opportunities', permission: 'oportunidades.ver' },
  { path: '/pipeline', permission: 'pipeline.ver' },
  { path: '/tareas', permission: 'actividades.ver' },
  { path: '/calendario', permission: 'actividades.ver' },
  { path: '/inbox', permission: 'correo.ver' },
  { path: '/campaigns', permission: 'campanas.ver' },
  { path: '/clients', permission: 'clientes.ver' },
  { path: '/reports', permission: 'reportes.ver' },
  { path: '/archivos', permission: 'archivos.ver' },
  { path: '/team', permission: 'equipo.ver' },
  { path: '/users', anyOf: ['usuarios.ver', 'roles.ver'] },
  { path: '/audit', permission: 'auditoria.ver' },
  { path: '/settings', permission: 'configuracion.ver' },
  { path: '/agentes-ia', anyOf: ['dashboard.ver', 'configuracion.ver'] },
];

/**
 * Permiso requerido para la ruta actual.
 * `null` = sin comprobación (p. ej. perfil).
 */
export function getRequiredPermissionForPath(
  pathname: string,
): PermissionKey | PermissionKey[] | null {
  if (pathname.startsWith('/profile')) return null;

  if (pathname.startsWith('/contactos')) return 'contactos.ver';
  if (pathname.startsWith('/empresas')) return 'empresas.ver';
  if (pathname.startsWith('/opportunities')) return 'oportunidades.ver';
  if (pathname.startsWith('/pipeline')) return 'pipeline.ver';
  if (pathname.startsWith('/tareas') || pathname.startsWith('/calendario')) {
    return 'actividades.ver';
  }
  if (pathname.startsWith('/inbox')) return 'correo.ver';
  if (pathname.startsWith('/campaigns')) return 'campanas.ver';
  if (pathname.startsWith('/clients')) return 'clientes.ver';
  if (pathname.startsWith('/reports')) return 'reportes.ver';
  if (pathname.startsWith('/archivos')) return 'archivos.ver';
  if (pathname.startsWith('/team')) return 'equipo.ver';
  if (pathname.startsWith('/users')) return ['usuarios.ver', 'roles.ver'];
  if (pathname.startsWith('/audit')) return 'auditoria.ver';
  if (pathname.startsWith('/settings')) return 'configuracion.ver';
  if (pathname.startsWith('/agentes-ia')) {
    return ['dashboard.ver', 'configuracion.ver'];
  }
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard')) {
    return 'dashboard.ver';
  }
  return null;
}

export function getFirstAccessiblePath(
  hasPermission: (k: PermissionKey) => boolean,
): string {
  for (const rule of ACCESSIBLE_PATH_ORDER) {
    if (ruleAllows(hasPermission, rule)) return rule.path;
  }
  return '/profile';
}
