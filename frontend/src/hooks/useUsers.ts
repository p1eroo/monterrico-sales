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

  const currentArea = useAppStore((s) => s.area);
  /** Usuarios activos con rol asesor (filtros y asignaciones por área). */
  const activeAdvisors = useMemo(() => {
    return activeUsers.filter((u) => {
      if (u.role !== 'asesor') return false;
      // En Admin mostramos todos para gestión; en módulos específicos filtramos.
      if (currentArea === 'admin') return true;
      if (!currentArea) return true; // Fallback
      return u.allowedAreas.includes(currentArea as any);
    });
  }, [activeUsers, currentArea]);

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
