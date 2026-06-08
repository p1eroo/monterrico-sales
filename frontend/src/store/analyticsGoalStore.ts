import { create } from 'zustand';
import type { AnalyticsGoalProgress } from '@/lib/analyticsApi';

type State = AnalyticsGoalProgress & {
  loaded: boolean;
  setProgress: (p: AnalyticsGoalProgress) => void;
  reset: () => void;
};

const empty: AnalyticsGoalProgress = {
  weekStart: '',
  weekEnd: '',
  monthStart: '',
  monthEnd: '',
  teamWeeklyClosed: 0,
  teamMonthlyClosed: 0,
  myWeeklyClosed: 0,
  myMonthlyClosed: 0,
};

export const useAnalyticsGoalStore = create<State>((set) => ({
  ...empty,
  loaded: false,
  setProgress: (p) => set({ ...p, loaded: true }),
  reset: () => set({ ...empty, loaded: false }),
}));
