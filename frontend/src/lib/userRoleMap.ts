import type { User } from '@/types';

/** Respuesta típica de GET/PATCH/POST /users (sin passwordHash). */
export type ApiUserRecord = {
  id: string;
  username: string;
  name: string;
  role: string;
  roleId?: string | null;
  status: string;
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

/** Normaliza el string `role` devuelto por la API al tipo User del front. */
export function mapApiRoleStringToUserRole(r: string): User['role'] {
  const x = r.trim().toLowerCase();
  if (x === 'admin') return 'admin';
  if (x === 'supervisor' || x === 'gerente') return 'supervisor';
  if (x === 'solo_lectura' || x === 'solo lectura') return 'solo_lectura';
  return 'asesor';
}

/** Si la API no envía roleId, infiérelo desde role (compat. con registros antiguos). */
export function inferRoleIdFromApiUser(
  role: string,
  roleId: string | null | undefined,
): string {
  if (roleId && ['r1', 'r2', 'r3', 'r4'].includes(roleId)) return roleId;
  const x = role.trim().toLowerCase();
  if (x === 'admin') return 'r1';
  if (x === 'supervisor' || x === 'gerente') return 'r2';
  if (x === 'solo_lectura') return 'r4';
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
