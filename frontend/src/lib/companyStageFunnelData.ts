import type { FunnelStage } from '@/components/crm/FunnelChart';
import type { CrmConfigBundle } from '@/lib/crmConfigApi';
import type { ActiveProspectsWeekly, ActiveProspectsByAdvisorWeekly } from '@/lib/analyticsApi';
import { formatIsoWeekLabel, isoWeekNumberLima, parseIsoWeekNumberFromLabel } from '@/lib/crmTimezone';
import { etapaLabels, etapaProbabilidad } from '@/data/mock';

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

/** Etapas de prospecto (probabilidad 10 %–100 %), en orden ascendente. */
const PROSPECT_STAGE_SLUGS = [
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
] as const;

/** Conteos ficticios para vista previa del embudo de empresas (sin llamada al API). */
const MOCK_COMPANIES_FUNNEL_VALUES: Record<string, number> = {
  contacto: 318,
  reunion_agendada: 241,
  reunion_efectiva: 186,
  propuesta_economica: 142,
  negociacion: 98,
  licitacion: 74,
  licitacion_etapa_final: 52,
  cierre_ganado: 31,
  firma_contrato: 18,
  activo: 9,
};

/**
 * Embudo de empresas por etapa (10 %–100 %) con datos mock para carga rápida en reportes.
 * Sustituir por `buildCompaniesStageFunnelRows` cuando el endpoint esté listo.
 */
export function getMockCompaniesStageFunnelStages(
  bundle: CrmConfigBundle | null,
): FunnelStage[] {
  const catalogBySlug = new Map((bundle?.catalog?.stages ?? []).map((s) => [s.slug, s]));

  return PROSPECT_STAGE_SLUGS.map((slug) => {
    const cat = catalogBySlug.get(slug);
    const label = cat?.name ?? etapaLabels[slug] ?? slug;
    return {
      label,
      value: MOCK_COMPANIES_FUNNEL_VALUES[slug] ?? 0,
      color: pickStageFill(slug, cat?.color),
    };
  }).filter((s) => s.value > 0);
}

export type CompaniesByAdvisorColumn = {
  id: string;
  name: string;
  headerClass: string;
  cellClass: string;
  footerClass: string;
};

export type CompaniesByAdvisorStageRow = {
  slug: string;
  probability: number;
  shortLabel: string;
  counts: Record<string, number>;
};

export type CompaniesByAdvisorStageTableData = {
  advisors: CompaniesByAdvisorColumn[];
  stages: CompaniesByAdvisorStageRow[];
  estimatedBillingByAdvisor: Record<string, number>;
};

const STAGE_SHORT_LABELS: Record<string, string> = {
  contacto: 'Contacto',
  reunion_agendada: 'Reun. ag.',
  reunion_efectiva: 'Reun. efec.',
  propuesta_economica: 'Prop. econ.',
  negociacion: 'Negociación',
  licitacion: 'Licitación',
  licitacion_etapa_final: 'Licit. e. final',
  cierre_ganado: 'Cierre ganado',
  firma_contrato: 'Firma contr.',
  activo: 'Activo',
};

const MOCK_ADVISOR_COLUMNS: CompaniesByAdvisorColumn[] = [
  {
    id: 'cristian',
    name: 'Cristian',
    headerClass:
      'border-t-2 border-amber-500/50 bg-muted/60 text-foreground dark:border-amber-400/40',
    cellClass: '',
    footerClass: '',
  },
  {
    id: 'lila',
    name: 'Lila',
    headerClass:
      'border-t-2 border-violet-500/50 bg-muted/60 text-foreground dark:border-violet-400/40',
    cellClass: '',
    footerClass: '',
  },
  {
    id: 'mafer',
    name: 'Mafer',
    headerClass:
      'border-t-2 border-emerald-500/50 bg-muted/60 text-foreground dark:border-emerald-400/40',
    cellClass: '',
    footerClass: '',
  },
  {
    id: 'monica',
    name: 'Monica',
    headerClass:
      'border-t-2 border-sky-500/50 bg-muted/60 text-foreground dark:border-sky-400/40',
    cellClass: '',
    footerClass: '',
  },
];

/** Conteos ficticios por asesor y etapa (vista amplia del embudo de empresas). */
const MOCK_ADVISOR_STAGE_COUNTS: Record<string, Record<string, number>> = {
  contacto: { cristian: 9, lila: 0, mafer: 0, monica: 0 },
  reunion_agendada: { cristian: 24, lila: 10, mafer: 19, monica: 20 },
  reunion_efectiva: { cristian: 23, lila: 20, mafer: 20, monica: 19 },
  propuesta_economica: { cristian: 10, lila: 46, mafer: 12, monica: 12 },
  negociacion: { cristian: 9, lila: 0, mafer: 0, monica: 8 },
  licitacion: { cristian: 0, lila: 9, mafer: 0, monica: 0 },
  licitacion_etapa_final: { cristian: 1, lila: 3, mafer: 0, monica: 5 },
  cierre_ganado: { cristian: 0, lila: 0, mafer: 2, monica: 3 },
  firma_contrato: { cristian: 2, lila: 5, mafer: 1, monica: 4 },
  activo: { cristian: 4, lila: 9, mafer: 1, monica: 2 },
};

const MOCK_ADVISOR_ESTIMATED_BILLING: Record<string, number> = {
  cristian: 424_000,
  lila: 1_621_000,
  mafer: 287_000,
  monica: 637_000,
};

/**
 * Tabla mock de empresas por asesor y etapa (10 %–100 %).
 * Sustituir por datos del API cuando esté disponible.
 */
export function getMockCompaniesByAdvisorStageTable(
  bundle: CrmConfigBundle | null,
): CompaniesByAdvisorStageTableData {
  const catalogBySlug = new Map((bundle?.catalog?.stages ?? []).map((s) => [s.slug, s]));

  const stages: CompaniesByAdvisorStageRow[] = PROSPECT_STAGE_SLUGS.map((slug) => {
    const cat = catalogBySlug.get(slug);
    const fullName = cat?.name ?? etapaLabels[slug] ?? slug;
    const probability = cat?.probability ?? etapaProbabilidad[slug] ?? 0;
    const shortFromCatalog = fullName.length > 14 ? (STAGE_SHORT_LABELS[slug] ?? fullName) : fullName;
    return {
      slug,
      probability,
      shortLabel: STAGE_SHORT_LABELS[slug] ?? shortFromCatalog,
      counts: { ...MOCK_ADVISOR_STAGE_COUNTS[slug] },
    };
  });

  return {
    advisors: MOCK_ADVISOR_COLUMNS,
    stages,
    estimatedBillingByAdvisor: { ...MOCK_ADVISOR_ESTIMATED_BILLING },
  };
}

export type CompaniesWeekSnapshot = {
  weekNumber: number;
  weekLabel: string;
  funnelStages: FunnelStage[];
  table: CompaniesByAdvisorStageTableData;
};

export type CompaniesWeeklyComparison = {
  referenceWeekNumber: number;
  referenceWeekLabel: string;
  /** Cartera actual (última semana del API al cierre de `referenceTo`). */
  totalFunnelStages: FunnelStage[];
  currentWeek: CompaniesWeekSnapshot;
  previousWeek: CompaniesWeekSnapshot;
};

export type CompaniesStagePanelData = {
  totalFunnelStages: FunnelStage[];
  weeklyComparison: CompaniesWeeklyComparison | null;
};

type ProspectWeekRow = ActiveProspectsWeekly['weeks'][number];

function weekMetaFromStart(weekStartIso: string, weekName?: string): { weekNumber: number; weekLabel: string } {
  const fromName = weekName ? parseIsoWeekNumberFromLabel(weekName) : null;
  const weekNumber =
    fromName ??
    isoWeekNumberLima(new Date(weekStartIso));
  return { weekNumber, weekLabel: formatIsoWeekLabel(weekNumber) };
}

/** Embudo por etapa desde un corte semanal de `activeProspectsWeekly`. */
export function buildFunnelStagesFromProspectWeek(
  week: ProspectWeekRow | null | undefined,
  bundle: CrmConfigBundle | null,
): FunnelStage[] {
  if (!week) return [];

  const catalogBySlug = new Map((bundle?.catalog?.stages ?? []).map((s) => [s.slug, s]));
  const countBySlug = new Map(week.byStage.map((row) => [row.slug, row.count]));

  const stages: FunnelStage[] = [];
  const seen = new Set<string>();

  for (const slug of PROSPECT_STAGE_SLUGS) {
    const value = countBySlug.get(slug) ?? 0;
    if (value <= 0) continue;
    seen.add(slug);
    const cat = catalogBySlug.get(slug);
    stages.push({
      label: cat?.name ?? etapaLabels[slug] ?? slug,
      value,
      color: pickStageFill(slug, cat?.color),
    });
  }

  for (const row of week.byStage) {
    if (seen.has(row.slug) || row.count <= 0) continue;
    const cat = catalogBySlug.get(row.slug);
    stages.push({
      label: row.name || cat?.name || etapaLabels[row.slug] || row.slug,
      value: row.count,
      color: pickStageFill(row.slug, cat?.color),
    });
  }

  return stages;
}

const ADVISOR_HEADER_BORDERS = [
  'border-t-2 border-amber-500/50 bg-muted/60 text-foreground dark:border-amber-400/40',
  'border-t-2 border-violet-500/50 bg-muted/60 text-foreground dark:border-violet-400/40',
  'border-t-2 border-emerald-500/50 bg-muted/60 text-foreground dark:border-emerald-400/40',
  'border-t-2 border-sky-500/50 bg-muted/60 text-foreground dark:border-sky-400/40',
  'border-t-2 border-rose-500/50 bg-muted/60 text-foreground dark:border-rose-400/40',
  'border-t-2 border-orange-500/50 bg-muted/60 text-foreground dark:border-orange-400/40',
] as const;

export function buildAdvisorColumnsFromApi(
  advisors: { id: string; name: string }[],
): CompaniesByAdvisorColumn[] {
  return advisors.map((advisor, index) => ({
    id: advisor.id,
    name: advisor.name,
    headerClass:
      ADVISOR_HEADER_BORDERS[index % ADVISOR_HEADER_BORDERS.length] ??
      'border-t-2 border-border bg-muted/60 text-foreground',
    cellClass: '',
    footerClass: '',
  }));
}

type AdvisorWeekRow = ActiveProspectsByAdvisorWeekly['weeks'][number];

export function buildAdvisorStageTableFromWeek(
  week: AdvisorWeekRow | null | undefined,
  bundle: CrmConfigBundle | null,
): CompaniesByAdvisorStageTableData {
  if (!week || week.advisors.length === 0) {
    return { advisors: [], stages: [], estimatedBillingByAdvisor: {} };
  }

  const catalogBySlug = new Map((bundle?.catalog?.stages ?? []).map((s) => [s.slug, s]));
  const advisors = buildAdvisorColumnsFromApi(week.advisors);

  const stages: CompaniesByAdvisorStageRow[] = week.stages.map((row) => {
    const cat = catalogBySlug.get(row.slug);
    const fullName = row.name || cat?.name || etapaLabels[row.slug] || row.slug;
    const probability = row.probability ?? cat?.probability ?? etapaProbabilidad[row.slug] ?? 0;
    const shortFromCatalog =
      fullName.length > 14 ? (STAGE_SHORT_LABELS[row.slug] ?? fullName) : fullName;
    return {
      slug: row.slug,
      probability,
      shortLabel: STAGE_SHORT_LABELS[row.slug] ?? shortFromCatalog,
      counts: { ...row.countsByAdvisor },
    };
  });

  return {
    advisors,
    stages,
    estimatedBillingByAdvisor: { ...week.estimatedBillingByAdvisor },
  };
}

function findAdvisorWeekByStart(
  byAdvisor: ActiveProspectsByAdvisorWeekly | null | undefined,
  weekStart: string | undefined,
): AdvisorWeekRow | undefined {
  if (!byAdvisor?.weeks?.length || !weekStart) return undefined;
  return byAdvisor.weeks.find((w) => w.weekStart === weekStart);
}

/**
 * Embudo (total + semanas W-1 / W-2) desde analytics; tabla por asesora desde el API.
 */
export function buildCompaniesStagePanelData(
  activeProspects: ActiveProspectsWeekly | null | undefined,
  byAdvisorWeekly: ActiveProspectsByAdvisorWeekly | null | undefined,
  bundle: CrmConfigBundle | null,
): CompaniesStagePanelData {
  const weeks = activeProspects?.weeks ?? [];
  const totalWeek = weeks.length > 0 ? weeks[weeks.length - 1] : undefined;
  const totalFunnelStages = buildFunnelStagesFromProspectWeek(totalWeek, bundle);

  if (weeks.length < 2) {
    return { totalFunnelStages, weeklyComparison: null };
  }

  const comparePrimaryWeek = weeks[weeks.length - 2];
  const comparePreviousWeek = weeks.length >= 3 ? weeks[weeks.length - 3] : undefined;
  const primaryAdvisorWeek = findAdvisorWeekByStart(
    byAdvisorWeekly,
    comparePrimaryWeek.weekStart,
  );
  const previousAdvisorWeek = comparePreviousWeek
    ? findAdvisorWeekByStart(byAdvisorWeekly, comparePreviousWeek.weekStart)
    : undefined;

  const primaryMeta = weekMetaFromStart(comparePrimaryWeek.weekStart, comparePrimaryWeek.name);
  const previousMeta = comparePreviousWeek
    ? weekMetaFromStart(comparePreviousWeek.weekStart, comparePreviousWeek.name)
    : {
        weekNumber: primaryMeta.weekNumber - 1,
        weekLabel: formatIsoWeekLabel(primaryMeta.weekNumber - 1),
      };

  const referenceWeekNumber = isoWeekNumberLima(new Date());

  return {
    totalFunnelStages,
    weeklyComparison: {
      referenceWeekNumber,
      referenceWeekLabel: formatIsoWeekLabel(referenceWeekNumber),
      totalFunnelStages,
      currentWeek: {
        weekNumber: primaryMeta.weekNumber,
        weekLabel: primaryMeta.weekLabel,
        funnelStages: buildFunnelStagesFromProspectWeek(comparePrimaryWeek, bundle),
        table: buildAdvisorStageTableFromWeek(primaryAdvisorWeek, bundle),
      },
      previousWeek: {
        weekNumber: previousMeta.weekNumber,
        weekLabel: previousMeta.weekLabel,
        funnelStages: buildFunnelStagesFromProspectWeek(comparePreviousWeek, bundle),
        table: buildAdvisorStageTableFromWeek(previousAdvisorWeek, bundle),
      },
    },
  };
}

function sumAdvisorCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((acc, v) => acc + v, 0);
}

function mockPreviousWeekAdvisorCounts(
  current: Record<string, number>,
  slug: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [advisorId, value] of Object.entries(current)) {
    if (value <= 0) {
      out[advisorId] = 0;
      continue;
    }
    const hash = `${slug}:${advisorId}`.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const drop = 1 + (hash % 3);
    out[advisorId] = Math.max(0, value - drop);
  }
  return out;
}

function buildAdvisorStageTableFromCounts(
  bundle: CrmConfigBundle | null,
  advisorCountsBySlug: Record<string, Record<string, number>>,
  estimatedBillingByAdvisor: Record<string, number>,
): CompaniesByAdvisorStageTableData {
  const catalogBySlug = new Map((bundle?.catalog?.stages ?? []).map((s) => [s.slug, s]));

  const stages: CompaniesByAdvisorStageRow[] = PROSPECT_STAGE_SLUGS.map((slug) => {
    const cat = catalogBySlug.get(slug);
    const fullName = cat?.name ?? etapaLabels[slug] ?? slug;
    const probability = cat?.probability ?? etapaProbabilidad[slug] ?? 0;
    const shortFromCatalog =
      fullName.length > 14 ? (STAGE_SHORT_LABELS[slug] ?? fullName) : fullName;
    return {
      slug,
      probability,
      shortLabel: STAGE_SHORT_LABELS[slug] ?? shortFromCatalog,
      counts: { ...(advisorCountsBySlug[slug] ?? {}) },
    };
  });

  return {
    advisors: MOCK_ADVISOR_COLUMNS,
    stages,
    estimatedBillingByAdvisor: { ...estimatedBillingByAdvisor },
  };
}

function buildFunnelStagesFromAdvisorCounts(
  bundle: CrmConfigBundle | null,
  advisorCountsBySlug: Record<string, Record<string, number>>,
  weekComparison?: {
    currentWeekLabel: string;
    previousWeekLabel: string;
    previousAdvisorCountsBySlug: Record<string, Record<string, number>>;
  },
): FunnelStage[] {
  const catalogBySlug = new Map((bundle?.catalog?.stages ?? []).map((s) => [s.slug, s]));

  return PROSPECT_STAGE_SLUGS.map((slug) => {
    const cat = catalogBySlug.get(slug);
    const label = cat?.name ?? etapaLabels[slug] ?? slug;
    const value = sumAdvisorCounts(advisorCountsBySlug[slug] ?? {});
    const previousValue = weekComparison
      ? sumAdvisorCounts(weekComparison.previousAdvisorCountsBySlug[slug] ?? {})
      : 0;
    return {
      label,
      value,
      color: pickStageFill(slug, cat?.color),
      weekComparison: weekComparison
        ? {
            currentWeekLabel: weekComparison.currentWeekLabel,
            previousWeekLabel: weekComparison.previousWeekLabel,
            previousValue,
          }
        : undefined,
    };
  }).filter((s) => s.value > 0 || (s.weekComparison?.previousValue ?? 0) > 0);
}

/**
 * Mock de comparación semanal: semana anterior (W27) vs penúltima (W26).
 * La semana de referencia es la ISO actual (p. ej. W28).
 */
export function getMockCompaniesWeeklyComparison(
  bundle: CrmConfigBundle | null,
): CompaniesWeeklyComparison {
  const referenceWeekNumber = isoWeekNumberLima(new Date());
  const currentWeekNumber = referenceWeekNumber - 1;
  const previousWeekNumber = referenceWeekNumber - 2;
  const currentWeekLabel = formatIsoWeekLabel(currentWeekNumber);
  const previousWeekLabel = formatIsoWeekLabel(previousWeekNumber);

  const w27Counts = { ...MOCK_ADVISOR_STAGE_COUNTS };
  const w26Counts = Object.fromEntries(
    Object.entries(w27Counts).map(([slug, counts]) => [
      slug,
      mockPreviousWeekAdvisorCounts(counts, slug),
    ]),
  );

  const w27Billing = { ...MOCK_ADVISOR_ESTIMATED_BILLING };
  const w26Billing = Object.fromEntries(
    Object.entries(w27Billing).map(([advisorId, amount]) => {
      const hash = advisorId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const factor = 0.9 + (hash % 7) * 0.01;
      return [advisorId, Math.round(amount * factor)];
    }),
  );

  const currentTable = buildAdvisorStageTableFromCounts(bundle, w27Counts, w27Billing);
  const previousTable = buildAdvisorStageTableFromCounts(bundle, w26Counts, w26Billing);

  return {
    referenceWeekNumber,
    referenceWeekLabel: formatIsoWeekLabel(referenceWeekNumber),
    totalFunnelStages: getMockCompaniesStageFunnelStages(bundle),
    currentWeek: {
      weekNumber: currentWeekNumber,
      weekLabel: currentWeekLabel,
      funnelStages: buildFunnelStagesFromAdvisorCounts(bundle, w27Counts),
      table: currentTable,
    },
    previousWeek: {
      weekNumber: previousWeekNumber,
      weekLabel: previousWeekLabel,
      funnelStages: buildFunnelStagesFromAdvisorCounts(bundle, w26Counts),
      table: previousTable,
    },
  };
}
