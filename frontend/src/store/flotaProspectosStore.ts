import { create } from 'zustand';
import type {
  FlotaProspectoRow,
  FlotaProspectosCounts,
  OperadorUser,
} from '@/lib/flotaProspectosApi';

const LIST_STALE_MS = 30_000;
const COUNTS_STALE_MS = 60_000;
const OPERADORES_STALE_MS = 5 * 60_000;

export type FlotaProspectosListCacheKeyInput = {
  page: number;
  search: string;
  estado: string;
  duplicados: boolean;
  fechaRegistroDesde?: string;
  fechaRegistroHasta?: string;
  mesImportDesde?: string;
  mesImportHasta?: string;
  redSocial: string;
  operador: string;
  modalidad: string;
  ciudad: string;
  aireAcondicionado: string;
  conLlamadas: string;
  contactado: string;
  columnFilters: Record<string, string>;
};

export function buildFlotaProspectosListCacheKey(
  input: FlotaProspectosListCacheKeyInput,
): string {
  return JSON.stringify(input);
}

type ListCacheEntry = {
  cacheKey: string;
  prospectos: FlotaProspectoRow[];
  total: number;
  loadedAt: number;
};

type FlotaProspectosStoreState = {
  listCache: ListCacheEntry | null;
  counts: FlotaProspectosCounts | null;
  countsLoadedAt: number | null;
  operadores: OperadorUser[];
  operadoresLoadedAt: number | null;

  getListIfFresh: (cacheKey: string) => ListCacheEntry | null;
  setListCache: (
    cacheKey: string,
    prospectos: FlotaProspectoRow[],
    total: number,
  ) => void;
  getCountsIfFresh: () => FlotaProspectosCounts | null;
  setCounts: (counts: FlotaProspectosCounts) => void;
  getOperadoresIfFresh: () => OperadorUser[] | null;
  setOperadores: (operadores: OperadorUser[]) => void;
  invalidate: () => void;
};

export const useFlotaProspectosStore = create<FlotaProspectosStoreState>(
  (set, get) => ({
    listCache: null,
    counts: null,
    countsLoadedAt: null,
    operadores: [],
    operadoresLoadedAt: null,

    getListIfFresh: (cacheKey) => {
      const entry = get().listCache;
      if (!entry || entry.cacheKey !== cacheKey) return null;
      if (Date.now() - entry.loadedAt > LIST_STALE_MS) return null;
      return entry;
    },

    setListCache: (cacheKey, prospectos, total) => {
      set({
        listCache: {
          cacheKey,
          prospectos,
          total,
          loadedAt: Date.now(),
        },
      });
    },

    getCountsIfFresh: () => {
      const { counts, countsLoadedAt } = get();
      if (!counts || !countsLoadedAt) return null;
      if (Date.now() - countsLoadedAt > COUNTS_STALE_MS) return null;
      return counts;
    },

    setCounts: (counts) => {
      set({ counts, countsLoadedAt: Date.now() });
    },

    getOperadoresIfFresh: () => {
      const { operadores, operadoresLoadedAt } = get();
      if (!operadoresLoadedAt || operadores.length === 0) return null;
      if (Date.now() - operadoresLoadedAt > OPERADORES_STALE_MS) return null;
      return operadores;
    },

    setOperadores: (operadores) => {
      set({ operadores, operadoresLoadedAt: Date.now() });
    },

    invalidate: () => {
      set({
        listCache: null,
        countsLoadedAt: null,
      });
    },
  }),
);
