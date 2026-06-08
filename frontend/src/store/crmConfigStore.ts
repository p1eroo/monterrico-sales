import { create } from 'zustand';
import type { CrmConfigBundle } from '@/lib/crmConfigApi';

type CrmConfigState = {
  bundle: CrmConfigBundle | null;
  setBundle: (b: CrmConfigBundle | null) => void;
};

export const useCrmConfigStore = create<CrmConfigState>((set) => ({
  bundle: null,
  setBundle: (b) => set({ bundle: b }),
}));

/** Etiqueta de etapa desde el catálogo en memoria, o fallback a mock. */
export function getStageLabelFromCatalog(
  slug: string,
  bundle: CrmConfigBundle | null,
  fallback?: Record<string, string>,
): string {
  const st = bundle?.catalog.stages.find((s) => s.slug === slug);
  if (st) return st.name;
  return fallback?.[slug] ?? slug;
}

export function getSourceLabelFromCatalog(
  slug: string,
  bundle: CrmConfigBundle | null,
  fallback?: Record<string, string>,
): string {
  const s = bundle?.catalog.leadSources.find((x) => x.slug === slug);
  if (s) return s.name;
  return fallback?.[slug] ?? slug;
}
