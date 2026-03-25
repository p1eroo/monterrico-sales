import { create } from 'zustand';
import type { User } from '@/types';
import { api, asArray } from '@/lib/api';
import { apiUserRecordToUser, type ApiUserRecord } from '@/lib/userRoleMap';

interface UsersState {
  users: User[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
  loadUsers: () => Promise<void>;
  getUserName: (userId: string) => string;
}

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  loading: false,
  error: null,
  loaded: false,

  loadUsers: async () => {
    const state = get();
    if (state.loading || state.loaded) return;
    set({ loading: true, error: null });
    try {
      const rows = await api<ApiUserRecord[]>('/users');
      const users = asArray<ApiUserRecord>(rows).map(apiUserRecordToUser);
      set({ users, loaded: true, error: null });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'Error al cargar usuarios',
        users: [],
        loaded: true, // Evita reintentos infinitos cuando falla
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
