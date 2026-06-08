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
  /** Overrides mensuales globales YYYY-MM (solo meses con fila en BD o editados en UI) */
  monthlyOrgByYm: Record<string, number>;
  /** Copia sincronizada con el servidor para detectar borrados al guardar */
  lastSyncedMonthlyByYm: Record<string, number>;
  /** Metas por mes por asesor: userId → YYYY-MM → monto */
  advisorMonthlyByYm: Record<string, Record<string, number>>;
  lastSyncedAdvisorMonthlyByYm: Record<string, Record<string, number>>;
  setGlobalWeeklyGoal: (amount: number) => void;
  setUserWeeklyGoal: (userId: string, amount: number) => void;
  getUserWeeklyGoal: (userId: string) => number;
  getGlobalWeeklyGoal: () => number;
  setMonthlyOrgForYm: (ym: string, amount: number | undefined) => void;
  setAdvisorMonthlyForUserYm: (
    userId: string,
    ym: string,
    amount: number | undefined,
  ) => void;
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  globalWeeklyGoal: 0,
  userWeeklyGoals: {},
  monthlyOrgByYm: {},
  lastSyncedMonthlyByYm: {},
  advisorMonthlyByYm: {},
  lastSyncedAdvisorMonthlyByYm: {},
  setGlobalWeeklyGoal: (amount) => set({ globalWeeklyGoal: amount }),
  setUserWeeklyGoal: (userId, amount) =>
    set((s) => ({
      userWeeklyGoals: { ...s.userWeeklyGoals, [userId]: amount },
    })),
  getUserWeeklyGoal: (userId) => get().userWeeklyGoals[userId] ?? 0,
  getGlobalWeeklyGoal: () => get().globalWeeklyGoal,
  setMonthlyOrgForYm: (ym, amount) =>
    set((s) => {
      const next = { ...s.monthlyOrgByYm };
      if (amount === undefined) delete next[ym];
      else next[ym] = amount;
      return { monthlyOrgByYm: next };
    }),
  setAdvisorMonthlyForUserYm: (userId, ym, amount) =>
    set((s) => {
      const next = { ...s.advisorMonthlyByYm };
      const inner = { ...(next[userId] ?? {}) };
      if (amount === undefined) delete inner[ym];
      else inner[ym] = amount;
      if (Object.keys(inner).length === 0) delete next[userId];
      else next[userId] = inner;
      return { advisorMonthlyByYm: next };
    }),
}));

function cloneAdvisorMonthlyMap(
  src: Record<string, Record<string, number>>,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const [uid, inner] of Object.entries(src)) {
    out[uid] = { ...inner };
  }
  return out;
}

/** Sincroniza metas desde GET /crm-config (después de login o al abrir perfil). */
export function hydrateGoalsFromBundle(bundle: CrmConfigBundle, currentUserId: string) {
  const sg = bundle.salesGoals;
  if (!sg) return;
  const { setGlobalWeeklyGoal, setUserWeeklyGoal } = useGoalsStore.getState();
  setGlobalWeeklyGoal(sg.globalWeekly);
  setUserWeeklyGoal(currentUserId, sg.myWeekly);
  if (bundle.permissions.canViewTeamGoals) {
    for (const [uid, v] of Object.entries(sg.byUserId)) {
      setUserWeeklyGoal(uid, v.weekly);
    }
  }
  const mo = sg.monthlyByYm ?? {};
  const advRaw = sg.advisorMonthlyByYm ?? {};
  useGoalsStore.setState({
    monthlyOrgByYm: { ...mo },
    lastSyncedMonthlyByYm: { ...mo },
    advisorMonthlyByYm: cloneAdvisorMonthlyMap(advRaw),
    lastSyncedAdvisorMonthlyByYm: cloneAdvisorMonthlyMap(advRaw),
  });
}
