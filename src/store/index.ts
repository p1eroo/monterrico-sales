import { create } from 'zustand';

interface AppState {
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  toggleSidebar: () => void;
  setSidebarMobileOpen: (open: boolean) => void;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
  };
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
  currentUser: {
    id: 'u1',
    name: 'Carlos Mendoza',
    email: 'carlos.mendoza@taximonterrico.com',
    role: 'Administrador',
  },
  isAuthenticated: false,
  login: () => set({ isAuthenticated: true }),
  logout: () => set({ isAuthenticated: false }),
}));
