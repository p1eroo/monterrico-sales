import type { FunnelStage } from '@/components/crm/FunnelChart';
import type { CrmConfigBundle } from '@/lib/crmConfigApi';
import { etapaLabels } from '@/data/mock';

export type CompanyStageFunnelRow = {
  slug: string;
  name: string;
  value: number;
  fill: string;
};

const FALLBACK_STAGE_ORDER = [
  'lead',
  'contacto',
  'reunion_agendada',
  'reunion_efectiva',
  'propuesta_economica',
  'negociacion',
  'licitacion',
  'licitacion_etapa_final',
  'cierre_ganado',
  'firma_contrato',
  'activo',
  'cierre_perdido',
  'inactivo',
] as const;

const STAGE_FALLBACK_HEX: Record<string, string> = {
  lead: '#94a3b8',
  contacto: '#3b82f6',
  reunion_agendada: '#7c3aed',
  reunion_efectiva: '#0d9488',
  propuesta_economica: '#6366f1',
  negociacion: '#ea580c',
  licitacion: '#d97706',
  licitacion_etapa_final: '#eab308',
  cierre_ganado: '#22c55e',
  firma_contrato: '#16a34a',
  activo: '#15803d',
  cierre_perdido: '#ef4444',
  inactivo: '#a3a3a3',
};

function hexToRgb(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace(/^#/, '');
  if (!raw) return null;
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return [r, g, b];
  }
  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return [r, g, b];
  }
  return null;
}

function pickStageFill(slug: string, catalogColor?: string | null): string {
  const raw = catalogColor?.trim();
  if (raw) {
    const norm = raw.startsWith('#') ? raw : `#${raw}`;
    if (hexToRgb(norm)) return norm;
  }
  return STAGE_FALLBACK_HEX[slug] ?? '#64748b';
}

/**
 * Une conteos del API con el orden del catálogo CRM (sortOrder ascendente).
 * Solo incluye etapas con al menos una empresa; las etapas del catálogo sin datos se omiten.
 */
export function buildCompaniesStageFunnelRows(
  raw: { name: string; value: number }[],
  bundle: CrmConfigBundle | null,
): CompanyStageFunnelRow[] {
  const countMap = new Map(raw.map((x) => [x.name, x.value]));
  const ordered: { slug: string; name: string }[] =
    bundle?.catalog?.stages?.length ?
      [...bundle.catalog.stages]
        .filter((s) => s.enabled)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({ slug: s.slug, name: s.name }))
    : FALLBACK_STAGE_ORDER.map((slug) => ({
        slug,
        name: etapaLabels[slug] ?? slug,
      }));

  const catalogBySlug = new Map((bundle?.catalog?.stages ?? []).map((s) => [s.slug, s]));

  const rows: CompanyStageFunnelRow[] = [];
  const seen = new Set<string>();
  for (const st of ordered) {
    const value = countMap.get(st.slug) ?? 0;
    if (value <= 0) continue;
    seen.add(st.slug);
    const cat = catalogBySlug.get(st.slug);
    rows.push({
      slug: st.slug,
      name: st.name,
      value,
      fill: pickStageFill(st.slug, cat?.color),
    });
  }

  const extras: CompanyStageFunnelRow[] = [];
  for (const [slug, value] of countMap) {
    if (value <= 0 || seen.has(slug)) continue;
    extras.push({
      slug,
      name: etapaLabels[slug] ?? slug,
      value,
      fill: pickStageFill(slug, catalogBySlug.get(slug)?.color),
    });
  }
  extras.sort((a, b) => b.value - a.value);
  return [...rows, ...extras];
}

/**
 * Mismo criterio de orden que `buildCompaniesStageFunnelRows` (catálogo `sortOrder`),
 * para el embudo de oportunidades en el dashboard.
 */
export function buildOpportunitiesStageFunnelStages(
  raw: { name: string; count: number }[],
  bundle: CrmConfigBundle | null,
): FunnelStage[] {
  const countMap = new Map(raw.map((x) => [x.name, x.count]));
  const ordered: { slug: string; name: string }[] =
    bundle?.catalog?.stages?.length ?
      [...bundle.catalog.stages]
        .filter((s) => s.enabled)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({ slug: s.slug, name: s.name }))
    : FALLBACK_STAGE_ORDER.map((slug) => ({
        slug,
        name: etapaLabels[slug] ?? slug,
      }));

  const catalogBySlug = new Map((bundle?.catalog?.stages ?? []).map((s) => [s.slug, s]));

  const rows: FunnelStage[] = [];
  const seen = new Set<string>();
  for (const st of ordered) {
    const value = countMap.get(st.slug) ?? 0;
    if (value <= 0) continue;
    seen.add(st.slug);
    const cat = catalogBySlug.get(st.slug);
    rows.push({
      label: st.name,
      value,
      color: pickStageFill(st.slug, cat?.color),
    });
  }

  const extras: FunnelStage[] = [];
  for (const [slug, value] of countMap) {
    if (value <= 0 || seen.has(slug)) continue;
    extras.push({
      label: etapaLabels[slug] ?? slug,
      value,
      color: pickStageFill(slug, catalogBySlug.get(slug)?.color),
    });
  }
  extras.sort((a, b) => b.value - a.value);
  return [...rows, ...extras];
}
