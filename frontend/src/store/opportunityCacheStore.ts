import { create } from 'zustand';
import { opportunityListAll, type ApiOpportunityListRow } from '@/lib/opportunityApi';

const CACHE_TTL_MS = 30_000;

type OpportunityCacheState = {
  opportunities: ApiOpportunityListRow[];
  loadedAt: number | null;
  loading: boolean;
  load: () => Promise<ApiOpportunityListRow[]>;
  isStale: () => boolean;
  updateRow: (id: string, updater: (row: ApiOpportunityListRow) => ApiOpportunityListRow) => void;
};

export const useOpportunityCacheStore = create<OpportunityCacheState>((set, get) => ({
  opportunities: [],
  loadedAt: null,
  loading: false,

  load: async () => {
    const state = get();
    if (!state.isStale() || state.loading) return state.opportunities;

    set({ loading: true });
    try {
      const list = await opportunityListAll();
      set({ opportunities: list, loadedAt: Date.now(), loading: false });
      return list;
    } catch {
      set({ loading: false });
      return [];
    }
  },

  isStale: () => {
    const { loadedAt } = get();
    if (!loadedAt) return true;
    return Date.now() - loadedAt > CACHE_TTL_MS;
  },

  updateRow: (id, updater) => {
    set((state) => ({
      opportunities: state.opportunities.map((r) =>
        r.id === id ? updater(r) : r,
      ),
    }));
  },
}));
