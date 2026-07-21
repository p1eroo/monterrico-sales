import { useMemo } from 'react';
import { create } from 'zustand';
import type { CrmConfigBundle } from '@/lib/crmConfigApi';
import { contactSourceLabels } from '@/data/mock';

type CrmConfigState = {
  bundle: CrmConfigBundle | null;
  setBundle: (b: CrmConfigBundle | null) => void;
};

export const useCrmConfigStore = create<CrmConfigState>((set) => ({
  bundle: null,
  setBundle: (b) => set({ bundle: b }),
}));

export type LeadSourceOption = { value: string; label: string };
export type RubroOption = { value: string; label: string };

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
  fallback: Record<string, string> = contactSourceLabels,
): string {
  if (slug === '__sin_fuente__') return 'Sin fuente';
  const s = bundle?.catalog.leadSources.find((x) => x.slug === slug);
  if (s) return s.name;
  return fallback[slug] ?? slug;
}

export function getRubroLabelFromCatalog(
  slug: string,
  bundle: CrmConfigBundle | null,
): string {
  const r = bundle?.catalog.rubros.find((x) => x.slug === slug);
  if (r) return r.name;
  return slug;
}

/** Mapa slug → etiqueta para filtros (incluye rubros desactivados del catálogo). */
export function getRubroLabelsMapFromCatalog(
  bundle: CrmConfigBundle | null,
): Record<string, string> {
  const fromCatalog = bundle?.catalog.rubros;
  if (!fromCatalog?.length) return {};
  const map: Record<string, string> = {};
  for (const r of [...fromCatalog].sort((a, b) => a.sortOrder - b.sortOrder)) {
    map[r.slug] = r.name;
  }
  return map;
}

/** Opciones de fuente para selects y filtros (catálogo CRM → fallback mock). */
export function getLeadSourceOptionsFromCatalog(
  bundle: CrmConfigBundle | null,
  fallback: Record<string, string> = contactSourceLabels,
): LeadSourceOption[] {
  const fromCatalog = bundle?.catalog.leadSources
    .filter((x) => x.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (fromCatalog?.length) {
    return fromCatalog.map((s) => ({ value: s.slug, label: s.name }));
  }
  return Object.entries(fallback).map(([value, label]) => ({ value, label }));
}

export function getRubroOptionsFromCatalog(
  bundle: CrmConfigBundle | null,
  opts?: { includeDisabled?: boolean },
): RubroOption[] {
  const includeDisabled = opts?.includeDisabled ?? false;
  const fromCatalog = bundle?.catalog.rubros
    ?.filter((x) => includeDisabled || x.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (!fromCatalog?.length) return [];
  return fromCatalog.map((r) => ({ value: r.slug, label: r.name }));
}

export function useLeadSourceOptions(
  fallback: Record<string, string> = contactSourceLabels,
): LeadSourceOption[] {
  const bundle = useCrmConfigStore((s) => s.bundle);
  return useMemo(
    () => getLeadSourceOptionsFromCatalog(bundle, fallback),
    [bundle, fallback],
  );
}

export function useRubroOptions(
  opts?: { includeDisabled?: boolean },
): RubroOption[] {
  const bundle = useCrmConfigStore((s) => s.bundle);
  return useMemo(
    () => getRubroOptionsFromCatalog(bundle, opts),
    [bundle, opts?.includeDisabled],
  );
}

export function useRubroLabelsMap(): Record<string, string> {
  const bundle = useCrmConfigStore((s) => s.bundle);
  return useMemo(
    () => getRubroLabelsMapFromCatalog(bundle),
    [bundle],
  );
}

export function useSourceLabel(
  slug: string | null | undefined,
  fallback: Record<string, string> = contactSourceLabels,
): string {
  const bundle = useCrmConfigStore((s) => s.bundle);
  return useMemo(() => {
    const s = slug?.trim();
    if (!s) return '—';
    return getSourceLabelFromCatalog(s, bundle, fallback);
  }, [slug, bundle, fallback]);
}

export function useRubroLabel(
  slug: string | null | undefined,
): string {
  const bundle = useCrmConfigStore((s) => s.bundle);
  return useMemo(() => {
    const s = slug?.trim();
    if (!s) return '—';
    return getRubroLabelFromCatalog(s, bundle);
  }, [slug, bundle]);
}
