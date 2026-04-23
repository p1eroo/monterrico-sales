import { useEffect, useMemo } from 'react';
import { useUsersStore } from '@/store/usersStore';
import { useAppStore } from '@/store';

/**
 * Usuarios: GET /users con `usuarios.ver`, o GET /users/asesores-equipo solo con `equipo.ver`.
 */
export function useUsers() {
  const permissionKeys = useAppStore((s) => s.permissionKeys);
  const { users, loading, error, loadUsers } = useUsersStore();

  useEffect(() => {
    void loadUsers();
  }, [permissionKeys, loadUsers]);

  const activeUsers = useMemo(
    () => users.filter((u) => u.status === 'activo'),
    [users],
  );

  /** Usuarios activos con rol asesor (filtros y asignaciones comerciales). */
  const activeAdvisors = useMemo(
    () => activeUsers.filter((u) => u.role === 'asesor'),
    [activeUsers],
  );

  return {
    users,
    loading,
    error,
    /** Solo usuarios activos (cualquier rol) */
    activeUsers,
    /** Asesores activos: listas “por asesor”, pipeline, asignación a cartera */
    activeAdvisors,
  };
}
