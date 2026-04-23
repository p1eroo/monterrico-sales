import type { User } from '@/types';

/** Respuesta típica de GET/PATCH/POST /users (sin passwordHash). */
export type ApiUserRecord = {
  id: string;
  username: string;
  name: string;
  role: string;
  roleId?: string | null;
  status: string;
  phone?: string | null;
  lastActivity?: string | null;
  joinedAt?: string | null;
};

/** Mapea roleId del RBAC (r1–r4) al campo `role` del modelo User en el CRM. */
export function roleIdToUserRole(roleId: string): User['role'] {
  if (roleId === 'r1') return 'admin';
  if (roleId === 'r2') return 'supervisor';
  if (roleId === 'r4') return 'solo_lectura';
  return 'asesor';
}

const SUPERVISOR_LIKE_SLUGS = new Set([
  'supervisor',
  'gerente',
  'gerente_comercial',
  'jefe_comercial',
  'jefe_comercial_ventas',
  'director_comercial',
]);

/** Normaliza el string `role` devuelto por la API al tipo User del front. */
export function mapApiRoleStringToUserRole(r: string): User['role'] {
  const x = r.trim().toLowerCase();
  if (x === 'admin') return 'admin';
  if (x === 'solo_lectura' || x === 'solo lectura') return 'solo_lectura';
  if (
    SUPERVISOR_LIKE_SLUGS.has(x) ||
    x.startsWith('jefe_') ||
    /** Roles de mando comercial (p. ej. gerente_comercial, gerente_regional). */
    x.startsWith('gerente_') ||
    x.endsWith('_supervisor') ||
    x.includes('jefe_comercial')
  ) {
    return 'supervisor';
  }
  return 'asesor';
}

/** roleId viene de la API como Role.id (cuid) o legacy r1–r4. */
export function inferRoleIdFromApiUser(
  role: string,
  roleId: string | null | undefined,
): string {
  if (roleId?.trim()) return roleId;
  const m = mapApiRoleStringToUserRole(role);
  if (m === 'admin') return 'r1';
  if (m === 'supervisor') return 'r2';
  if (m === 'solo_lectura') return 'r4';
  return 'r3';
}

export function joinedAtToDateString(joinedAt: string | Date | null | undefined): string {
  if (joinedAt == null) return new Date().toISOString().slice(0, 10);
  if (typeof joinedAt === 'string') return joinedAt.slice(0, 10);
  return new Date(joinedAt).toISOString().slice(0, 10);
}

/** Convierte fila de API a `User` para tablas del CRM (métricas mock 0 si no vienen). */
export function apiUserRecordToUser(row: ApiUserRecord): User {
  const roleId = inferRoleIdFromApiUser(row.role, row.roleId);
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    phone: typeof row.phone === 'string' && row.phone.trim() ? row.phone.trim() : undefined,
    role: mapApiRoleStringToUserRole(row.role),
    roleId,
    status: row.status === 'inactivo' ? 'inactivo' : 'activo',
    contactsAssigned: 0,
    opportunitiesActive: 0,
    salesClosed: 0,
    conversionRate: 0,
    joinedAt: joinedAtToDateString(row.joinedAt),
    lastActivity: row.lastActivity ?? undefined,
  };
}
