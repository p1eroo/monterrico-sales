import { create } from 'zustand';
import type { User } from '@/types';
import { api, asArray } from '@/lib/api';
import { apiUserRecordToUser, type ApiUserRecord } from '@/lib/userRoleMap';
import { useAppStore } from '@/store';

interface UsersState {
  users: User[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
  /** Último endpoint usado para evitar refetch redundante al mismo alcance */
  lastUsersPath: string | null;
  loadUsers: () => Promise<void>;
  getUserName: (userId: string) => string;
}

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  loading: false,
  error: null,
  loaded: false,
  lastUsersPath: null,

  loadUsers: async () => {
    const state = get();
    if (state.loading) return;

    const keys = useAppStore.getState().permissionKeys;
    if (keys === null) return;

    const path = keys.includes('usuarios.ver')
      ? '/users'
      : keys.includes('equipo.ver')
        ? '/users/asesores-equipo'
        : null;

    if (path === null) {
      set({ users: [], loaded: true, error: null, lastUsersPath: null });
      return;
    }

    if (state.loaded && state.lastUsersPath === path) return;

    set({ loading: true, error: null });
    try {
      const rows = await api<ApiUserRecord[]>(path);
      const users = asArray<ApiUserRecord>(rows).map(apiUserRecordToUser);
      set({ users, loaded: true, error: null, lastUsersPath: path });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'Error al cargar usuarios',
        users: [],
        loaded: true,
        lastUsersPath: null,
      });
    } finally {
      set({ loading: false });
    }
  },

  getUserName: (userId: string) => {
    const u = get().users.find((x) => x.id === userId);
    return u?.name ?? 'Sin asignar';
  },
}));
