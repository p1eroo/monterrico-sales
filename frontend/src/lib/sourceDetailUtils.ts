import type { CrmConfigBundle } from '@/lib/crmConfigApi';
import type { AnalyticsSummary } from '@/lib/analyticsApi';
import { getSourceLabelFromCatalog, getStageLabelFromCatalog } from '@/store/crmConfigStore';
import { contactSourceLabels } from '@/data/mock';
import type { SourceDetail, SourceStageSlice } from '@/lib/sourceDetailTypes';
import {
  ADVISOR_OTHERS,
  ADVISOR_UNASSIGNED,
} from '@/hooks/useMultiAdvisorFilter';

export type ApiSourceDetail = AnalyticsSummary['sourcesDetail']['sources'][number];
export type ApiSourcesDetailWeek = AnalyticsSummary['sourcesDetail']['week'];
export type ApiSourcesDetailWeekly =
  AnalyticsSummary['sourcesDetailWeekly'];
export type ApiSourcesDetailWeekRow =
  ApiSourcesDetailWeekly['weeks'][number];

const SOURCE_ACCENT_COLORS: Record<string, string> = {
  base: '#0f766e',
  feria: '#c2410c',
  masivo: '#4f46e5',
  referido: '#15803d',
  entorno: '#0369a1',
  apollo: '#7c3aed',
  facebook: '#1d4ed8',
  __sin_fuente__: '#94a3b8',
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
  snapshot: AnalyticsSummary['sourcesDetail'] | null | undefined,
  bundle: CrmConfigBundle | null,
): SourceDetail[] {
  const rows = snapshot?.sources;
  if (!rows?.length) return [];

  return rows.map((row) => mapApiSourceRow(row, bundle));
}

function mapApiSourceRow(
  row: ApiSourceDetail,
  bundle: CrmConfigBundle | null,
): SourceDetail {
  return {
    slug: row.slug,
    name: getSourceLabelFromCatalog(row.slug, bundle, contactSourceLabels),
    accentColor: SOURCE_ACCENT_COLORS[row.slug] ?? '#64748b',
    companyCount: row.companyCount,
    estimatedBilling: row.estimatedBilling,
    stages: row.stages.map((stage) => mapStage(stage, bundle)),
    hot70Count: row.hot70Count,
    hot70Billing: row.hot70Billing,
  };
}

export function mapSourcesDetailWeeklyFromApi(
  snapshot: ApiSourcesDetailWeekly | null | undefined,
  bundle: CrmConfigBundle | null,
): Array<{
  week: ApiSourcesDetailWeek;
  details: SourceDetail[];
  byAdvisor: Record<string, SourceDetail[]>;
}> {
  const weeks = snapshot?.weeks;
  if (!weeks?.length) return [];

  return weeks.map((weekRow) => ({
    week: weekRow.week,
    details: weekRow.sources.map((row) => mapApiSourceRow(row, bundle)),
    byAdvisor: Object.fromEntries(
      Object.entries(weekRow.byAdvisor ?? {}).map(([advisorId, rows]) => [
        advisorId,
        rows.map((row) => mapApiSourceRow(row, bundle)),
      ]),
    ),
  }));
}

function mergeStageSlices(stages: SourceStageSlice[]): SourceStageSlice[] {
  const bySlug = new Map<string, SourceStageSlice>();
  for (const stage of stages) {
    const prev = bySlug.get(stage.slug);
    if (!prev) {
      bySlug.set(stage.slug, { ...stage });
      continue;
    }
    bySlug.set(stage.slug, {
      ...prev,
      count: prev.count + stage.count,
    });
  }
  return [...bySlug.values()].sort(
    (a, b) => (b.probability ?? 0) - (a.probability ?? 0),
  );
}

export function mergeSourceDetails(details: SourceDetail[]): SourceDetail[] {
  const bySlug = new Map<string, SourceDetail>();
  for (const detail of details) {
    const prev = bySlug.get(detail.slug);
    if (!prev) {
      bySlug.set(detail.slug, { ...detail, stages: [...detail.stages] });
      continue;
    }
    bySlug.set(detail.slug, {
      ...prev,
      companyCount: prev.companyCount + detail.companyCount,
      estimatedBilling: prev.estimatedBilling + detail.estimatedBilling,
      hot70Count: prev.hot70Count + detail.hot70Count,
      hot70Billing: prev.hot70Billing + detail.hot70Billing,
      stages: mergeStageSlices([...prev.stages, ...detail.stages]),
    });
  }
  return [...bySlug.values()].sort((a, b) => b.companyCount - a.companyCount);
}

export function resolveSourcesDetailForFilters(
  weekRow:
    | {
        details: SourceDetail[];
        byAdvisor: Record<string, SourceDetail[]>;
      }
    | undefined,
  selectedAdvisorIds: string[],
  allAdvisorsSelected: boolean,
): SourceDetail[] {
  if (!weekRow) return [];
  if (allAdvisorsSelected) {
    return weekRow.details;
  }
  if (selectedAdvisorIds.length === 0) return [];

  const selectedAdvisorIdsOnly = selectedAdvisorIds.filter(
    (id) => id !== ADVISOR_UNASSIGNED && id !== ADVISOR_OTHERS,
  );
  const includeUnassigned = selectedAdvisorIds.includes(ADVISOR_UNASSIGNED);
  const includeOthers = selectedAdvisorIds.includes(ADVISOR_OTHERS);
  const slices: SourceDetail[] = [];

  for (const advisorId of selectedAdvisorIdsOnly) {
    const rows = weekRow.byAdvisor[advisorId];
    if (rows?.length) slices.push(...rows);
  }
  if (includeUnassigned) {
    const rows = weekRow.byAdvisor[ADVISOR_UNASSIGNED];
    if (rows?.length) slices.push(...rows);
  }
  if (includeOthers) {
    const rows = weekRow.byAdvisor[ADVISOR_OTHERS];
    if (rows?.length) slices.push(...rows);
  }

  if (slices.length === 0) return [];
  return mergeSourceDetails(slices);
}
