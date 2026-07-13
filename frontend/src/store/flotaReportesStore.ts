import { create } from 'zustand';
import { getConductores, type Conductor } from '@/lib/flotaConductoresApi';
import {
  flotaProspectosList,
  fetchOperadorStats,
  fetchOperadores,
  getOperatorDisplayName,
  type FlotaProspectoRow,
  type OperadorStats,
} from '@/lib/flotaProspectosApi';
import { getSunatHistorial } from '@/lib/flotaSunatApi';

function rangeKey(fecini: string, fecfin: string): string {
  return `${fecini}|${fecfin}`;
}

/** Mínimo entre refrescos en background (evita ráfagas por socket/visibilidad). */
const MIN_BASE_REFRESH_MS = 5 * 60 * 1000;

let baseFetchPromise: Promise<void> | null = null;
let operadorFetchPromise: Promise<void> | null = null;
let sunatFetchPromise: Promise<void> | null = null;

interface FlotaReportesState {
  conductores: Conductor[];
  prospectos: FlotaProspectoRow[];
  baseLoaded: boolean;
  baseLoading: boolean;
  baseLastFetchedAt: number | null;

  operadorStats: OperadorStats[];
  operadorNames: string[];
  operadorStatsRange: string | null;
  operadorStatsLoading: boolean;

  sunatHistory: Record<string, unknown>[];
  sunatRange: string | null;
  sunatLoading: boolean;

  loadBaseData: (opts?: { force?: boolean }) => Promise<void>;
  loadOperadorStats: (
    fecini: string,
    fecfin: string,
    opts?: { force?: boolean },
  ) => Promise<void>;
  loadSunatHistory: (
    fecini: string,
    fecfin: string,
    opts?: { force?: boolean },
  ) => Promise<void>;
}

export const useFlotaReportesStore = create<FlotaReportesState>((set, get) => ({
  conductores: [],
  prospectos: [],
  baseLoaded: false,
  baseLoading: false,
  baseLastFetchedAt: null,

  operadorStats: [],
  operadorNames: [],
  operadorStatsRange: null,
  operadorStatsLoading: false,

  sunatHistory: [],
  sunatRange: null,
  sunatLoading: false,

  loadBaseData: async (opts) => {
    if (baseFetchPromise) return baseFetchPromise;

    const force = opts?.force ?? false;
    const state = get();
    if (state.baseLoaded && !force) return;

    if (
      force &&
      state.baseLastFetchedAt != null &&
      Date.now() - state.baseLastFetchedAt < MIN_BASE_REFRESH_MS
    ) {
      return;
    }

    const hasData =
      state.baseLoaded &&
      (state.conductores.length > 0 || state.prospectos.length > 0);
    if (!hasData) set({ baseLoading: true });

    baseFetchPromise = (async () => {
      try {
        const [conds, pros] = await Promise.all([
          getConductores(),
          flotaProspectosList({ limit: 10000 }),
        ]);
        set({
          conductores: Array.isArray(conds) ? conds : [],
          prospectos: Array.isArray(pros.data) ? pros.data : [],
          baseLoaded: true,
          baseLastFetchedAt: Date.now(),
        });
      } catch (err) {
        console.error('Error loading flota report base data:', err);
        if (!hasData) {
          set({ conductores: [], prospectos: [] });
        }
      } finally {
        set({ baseLoading: false });
        baseFetchPromise = null;
      }
    })();

    return baseFetchPromise;
  },

  loadOperadorStats: async (fecini, fecfin, opts) => {
    if (operadorFetchPromise) return operadorFetchPromise;

    const force = opts?.force ?? false;
    const key = rangeKey(fecini, fecfin);
    const state = get();
    if (state.operadorStatsRange === key && !force) return;

    const hasData =
      state.operadorStatsRange === key && state.operadorStats.length > 0;
    if (!hasData) set({ operadorStatsLoading: true });

    operadorFetchPromise = (async () => {
      try {
        const [rawStats, operadores] = await Promise.all([
          fetchOperadorStats(fecini, fecfin),
          fetchOperadores(),
        ]);

        const unified = new Map<string, OperadorStats>();
        for (const s of rawStats) {
          const canonical =
            getOperatorDisplayName(s.operador, operadores) || s.operador;
          const existing = unified.get(canonical);
          if (existing) {
            existing.prospectosAsignados += s.prospectosAsignados;
            existing.chatsActivos += s.chatsActivos;
            existing.mensajesEnviados += s.mensajesEnviados;
            existing.mensajesRecibidos += s.mensajesRecibidos;
            existing.llamadas += s.llamadas;
            existing.citasProgramadas += s.citasProgramadas;
          } else {
            unified.set(canonical, { ...s, operador: canonical });
          }
        }

        const names = Array.from(unified.keys());
        set({
          operadorNames: names,
          operadorStats: Array.from(unified.values()),
          operadorStatsRange: key,
        });
      } catch (err) {
        console.error('Error loading operator stats:', err);
        if (!hasData) {
          set({ operadorStats: [], operadorNames: [], operadorStatsRange: key });
        }
      } finally {
        set({ operadorStatsLoading: false });
        operadorFetchPromise = null;
      }
    })();

    return operadorFetchPromise;
  },

  loadSunatHistory: async (fecini, fecfin, opts) => {
    if (sunatFetchPromise) return sunatFetchPromise;

    const force = opts?.force ?? false;
    const key = rangeKey(fecini, fecfin);
    const state = get();
    if (state.sunatRange === key && !force) return;

    const hasData = state.sunatRange === key && state.sunatHistory.length > 0;
    if (!hasData) set({ sunatLoading: true });

    sunatFetchPromise = (async () => {
      try {
        const history = await getSunatHistorial(fecini, fecfin);
        set({ sunatHistory: history, sunatRange: key });
      } catch (err) {
        console.error('Error loading SUNAT history:', err);
        if (!hasData) {
          set({ sunatHistory: [], sunatRange: key });
        }
      } finally {
        set({ sunatLoading: false });
        sunatFetchPromise = null;
      }
    })();

    return sunatFetchPromise;
  },
}));
