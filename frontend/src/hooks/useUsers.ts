import { useEffect } from 'react';
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

  return {
    users,
    loading,
    error,
    /** Solo usuarios activos (para selects de asignación) */
    activeUsers: users.filter((u) => u.status === 'activo'),
  };
}
