import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

const DEFAULT_GLOBAL_WEEKLY = 60000;
const DEFAULT_GLOBAL_MONTHLY = 240000;
const DEFAULT_USER_WEEKLY: Record<string, number> = {
  u1: 15000,
  u2: 12000,
  u3: 10000,
  u4: 10000,
  u5: 8000,
  u6: 5000,
};
const DEFAULT_USER_MONTHLY: Record<string, number> = {
  u1: 60000,
  u2: 48000,
  u3: 40000,
  u4: 40000,
  u5: 32000,
  u6: 20000,
};

export const useGoalsStore = create<GoalsState>()(
  persist(
    (set, get) => ({
      globalWeeklyGoal: DEFAULT_GLOBAL_WEEKLY,
      userWeeklyGoals: DEFAULT_USER_WEEKLY,
      globalMonthlyGoal: DEFAULT_GLOBAL_MONTHLY,
      userMonthlyGoals: DEFAULT_USER_MONTHLY,
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
    }),
    { name: 'taxi-monterrico-goals' }
  )
);
