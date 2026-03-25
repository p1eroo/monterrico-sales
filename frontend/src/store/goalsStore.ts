import { create } from 'zustand';
import type { CrmConfigBundle } from '@/lib/crmConfigApi';

/**
 * Metas de ventas: fuente de verdad es GET /crm-config (salesGoals).
 * No persistimos en localStorage: el middleware persist rehidrataba después
 * de MainLayout y sobrescribía los valores recién cargados del servidor.
 */
interface GoalsState {
  /** Meta global del equipo (soles/semana) */
  globalWeeklyGoal: number;
  /** Metas por asesor: userId -> amount (semanal) */
  userWeeklyGoals: Record<string, number>;
  /** Meta global del equipo (soles/mes) */
  globalMonthlyGoal: number;
  /** Metas por asesor: userId -> amount (mensual) */
  userMonthlyGoals: Record<string, number>;
  setGlobalWeeklyGoal: (amount: number) => void;
  setUserWeeklyGoal: (userId: string, amount: number) => void;
  getUserWeeklyGoal: (userId: string) => number;
  getGlobalWeeklyGoal: () => number;
  setGlobalMonthlyGoal: (amount: number) => void;
  setUserMonthlyGoal: (userId: string, amount: number) => void;
  getUserMonthlyGoal: (userId: string) => number;
  getGlobalMonthlyGoal: () => number;
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  globalWeeklyGoal: 0,
  userWeeklyGoals: {},
  globalMonthlyGoal: 0,
  userMonthlyGoals: {},
  setGlobalWeeklyGoal: (amount) => set({ globalWeeklyGoal: amount }),
  setUserWeeklyGoal: (userId, amount) =>
    set((s) => ({
      userWeeklyGoals: { ...s.userWeeklyGoals, [userId]: amount },
    })),
  getUserWeeklyGoal: (userId) => get().userWeeklyGoals[userId] ?? 0,
  getGlobalWeeklyGoal: () => get().globalWeeklyGoal,
  setGlobalMonthlyGoal: (amount) => set({ globalMonthlyGoal: amount }),
  setUserMonthlyGoal: (userId, amount) =>
    set((s) => ({
      userMonthlyGoals: { ...s.userMonthlyGoals, [userId]: amount },
    })),
  getUserMonthlyGoal: (userId) => get().userMonthlyGoals[userId] ?? 0,
  getGlobalMonthlyGoal: () => get().globalMonthlyGoal,
}));

/** Sincroniza metas desde GET /crm-config (después de login o al abrir perfil). */
export function hydrateGoalsFromBundle(bundle: CrmConfigBundle, currentUserId: string) {
  const sg = bundle.salesGoals;
  if (!sg) return;
  const {
    setGlobalWeeklyGoal,
    setGlobalMonthlyGoal,
    setUserWeeklyGoal,
    setUserMonthlyGoal,
  } = useGoalsStore.getState();
  setGlobalWeeklyGoal(sg.globalWeekly);
  setGlobalMonthlyGoal(sg.globalMonthly);
  setUserWeeklyGoal(currentUserId, sg.myWeekly);
  setUserMonthlyGoal(currentUserId, sg.myMonthly);
  if (bundle.permissions.canViewTeamGoals) {
    for (const [uid, v] of Object.entries(sg.byUserId)) {
      setUserWeeklyGoal(uid, v.weekly);
      setUserMonthlyGoal(uid, v.monthly);
    }
  }
}
