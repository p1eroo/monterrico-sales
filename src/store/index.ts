import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Campaign, CampaignMessageTemplate } from '@/types';

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
    phone?: string;
    cargo?: string;
    empresa?: string;
    status?: 'activo' | 'inactivo';
    createdAt?: string;
    lastActivity?: string;
  };
  updateCurrentUser: (data: Partial<AppState['currentUser']>) => void;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  /** Campañas enviadas en esta sesión (se agregan al mock) */
  sentCampaigns: Campaign[];
  addSentCampaign: (c: Campaign) => void;
  /** Plantillas creadas por el usuario (persisten en localStorage) */
  userTemplates: CampaignMessageTemplate[];
  addUserTemplate: (t: CampaignMessageTemplate) => void;
  removeUserTemplate: (id: string) => void;
  /** Preferencias del usuario */
  preferences: {
    language: string;
    timezone: string;
    dateFormat: string;
    theme: 'light' | 'dark' | 'system';
    emailNotifications: boolean;
    systemNotifications: boolean;
    reminders: boolean;
    activityAlerts: boolean;
  };
  updatePreferences: (data: Partial<AppState['preferences']>) => void;
  /** Gmail conectado (mock - luego vendrá del backend) */
  gmailConnected: boolean;
  setGmailConnected: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
  currentUser: {
    id: 'u1',
    name: 'Carlos Mendoza',
    email: 'carlos.mendoza@taximonterrico.com',
    role: 'Administrador',
    phone: '+51 999 111 222',
    cargo: 'Gerente Comercial',
    empresa: 'Taxi Monterrico',
    status: 'activo',
    createdAt: '2023-01-15',
    lastActivity: '2026-03-06T14:30:00',
  },
      updateCurrentUser: (data) =>
        set((s) => ({
          currentUser: { ...s.currentUser, ...data },
        })),
  isAuthenticated: false,
  login: () => set({ isAuthenticated: true }),
  logout: () => set({ isAuthenticated: false }),
  sentCampaigns: [],
      addSentCampaign: (c) => set((s) => ({ sentCampaigns: [...s.sentCampaigns, c] })),
      userTemplates: [],
      addUserTemplate: (t) =>
        set((s) => ({ userTemplates: [...s.userTemplates.filter((x) => x.id !== t.id), t] })),
      removeUserTemplate: (id) =>
        set((s) => ({ userTemplates: s.userTemplates.filter((x) => x.id !== id) })),
      preferences: {
        language: 'es',
        timezone: 'America/Lima',
        dateFormat: 'DD/MM/YYYY',
        theme: 'system',
        emailNotifications: true,
        systemNotifications: true,
        reminders: true,
        activityAlerts: true,
      },
      updatePreferences: (data) =>
        set((s) => ({
          preferences: { ...s.preferences, ...data },
        })),
      gmailConnected: false,
      setGmailConnected: (v) => set({ gmailConnected: v }),
    }),
    {
      name: 'campaign-store',
      partialize: (s) => ({
        userTemplates: s.userTemplates,
        currentUser: s.currentUser,
        preferences: s.preferences,
        gmailConnected: s.gmailConnected,
      }),
    }
  )
);
