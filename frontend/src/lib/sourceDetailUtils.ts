import type { CrmConfigBundle } from '@/lib/crmConfigApi';
import type { AnalyticsSummary } from '@/lib/analyticsApi';
import { getSourceLabelFromCatalog, getStageLabelFromCatalog } from '@/store/crmConfigStore';
import { contactSourceLabels } from '@/data/mock';
import type { SourceDetail, SourceStageSlice } from '@/lib/sourceDetailTypes';

export type ApiSourceDetail = AnalyticsSummary['sourcesDetail'][number];

const SOURCE_ACCENT_COLORS: Record<string, string> = {
  base: '#0f766e',
  feria: '#c2410c',
  masivo: '#4f46e5',
  referido: '#15803d',
  entorno: '#0369a1',
  apollo: '#7c3aed',
  facebook: '#1d4ed8',
};

const STAGE_COLOR_FALLBACK: Record<string, string> = {
  contacto: '#94a3b8',
  reunion_agendada: '#60a5fa',
  reunion_efectiva: '#22d3ee',
  propuesta_economica: '#f97316',
  negociacion: '#ef4444',
  licitacion: '#eab308',
  licitacion_etapa_final: '#ca8a04',
  cierre_ganado: '#22c55e',
  firma_contrato: '#16a34a',
  activo: '#15803d',
};

const STAGE_SHORT_LABELS: Record<string, string> = {
  contacto: 'Contacto',
  reunion_agendada: 'Reun.Agend.',
  reunion_efectiva: 'Reun.Efect.',
  propuesta_economica: 'Prop.Econ.',
  negociacion: 'Negociación',
  licitacion: 'Licitación',
  licitacion_etapa_final: 'Lic. final',
  cierre_ganado: 'Cierre gan.',
  firma_contrato: 'Firma contr.',
  activo: 'Activo',
};

function stageColor(slug: string, bundle: CrmConfigBundle | null): string {
  const fromCatalog = bundle?.catalog.stages.find((s) => s.slug === slug)?.color;
  return fromCatalog ?? STAGE_COLOR_FALLBACK[slug] ?? '#64748b';
}

function stageShortLabel(slug: string, label: string): string {
  return STAGE_SHORT_LABELS[slug] ?? label;
}

function mapStage(
  row: ApiSourceDetail['stages'][number],
  bundle: CrmConfigBundle | null,
): SourceStageSlice {
  const label = getStageLabelFromCatalog(row.slug, bundle);
  return {
    slug: row.slug,
    label,
    shortLabel: stageShortLabel(row.slug, label),
    count: row.count,
    color: stageColor(row.slug, bundle),
    probability: row.probability,
  };
}

export function mapSourcesDetailFromApi(
  rows: ApiSourceDetail[] | null | undefined,
  bundle: CrmConfigBundle | null,
): SourceDetail[] {
  if (!rows?.length) return [];

  return rows.map((row) => ({
    slug: row.slug,
    name: getSourceLabelFromCatalog(row.slug, bundle, contactSourceLabels),
    accentColor: SOURCE_ACCENT_COLORS[row.slug] ?? '#64748b',
    companyCount: row.companyCount,
    estimatedBilling: row.estimatedBilling,
    stages: row.stages.map((stage) => mapStage(stage, bundle)),
    hot70Count: row.hot70Count,
    hot70Billing: row.hot70Billing,
  }));
}
