import { useEffect, useMemo } from 'react';
import { useUsersStore } from '@/store/usersStore';

/**
 * Usuarios cargados desde GET /users.
 * Compatible con el formato que usaban los componentes con users de mock.
 */
export function useUsers() {
  const { users, loading, error, loaded, loadUsers } = useUsersStore();

  useEffect(() => {
    if (!loaded && !loading) {
      void loadUsers();
    }
  }, [loaded, loading, loadUsers]);

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
