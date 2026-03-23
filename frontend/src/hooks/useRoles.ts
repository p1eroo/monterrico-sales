import { useState, useCallback, useEffect } from 'react';
import { api } from '@/lib/api';

export type ApiRole = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount?: number;
};

export function useRoles() {
  const [state, setState] = useState<{
    roles: ApiRole[];
    loading: boolean;
    error: string | null;
  }>({ roles: [], loading: false, error: null });

  const loadRoles = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const list = await api<ApiRole[]>('/roles');
      setState((s) => ({ ...s, roles: list, loading: false }));
    } catch (e) {
      setState((s) => ({
        ...s,
        error: e instanceof Error ? e.message : 'Error al cargar roles',
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  return {
    roles: state.roles,
    loading: state.loading,
    error: state.error,
    loadRoles,
    asesorRoleId: state.roles.find((r) => r.slug === 'asesor')?.id,
  };
}
