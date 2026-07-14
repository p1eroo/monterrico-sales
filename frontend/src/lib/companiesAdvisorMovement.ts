export type AdvisorFunnelMovementMetrics = {
  nuevoIngreso: number;
  avance: number;
  atraso: number;
  sinCambios: number;
};

export type AdvisorFunnelMovementCardData = {
  id: string;
  name: string;
  activeProspects: number;
  metrics: AdvisorFunnelMovementMetrics;
  accentClass: string;
};

export type AdvisorFunnelMovementSnapshot = {
  fromWeekNumber: number;
  toWeekNumber: number;
  fromWeekLabel: string;
  toWeekLabel: string;
  currentWeekLabel?: string;
  title: string;
  advisors: AdvisorFunnelMovementCardData[];
};

export type AdvisorFunnelMovementBundle = {
  currentWeekLabel: string;
  periods: AdvisorFunnelMovementSnapshot[];
};

export type CompaniesAdvisorFunnelMovementPeriodApi = {
  fromWeekNumber: number;
  toWeekNumber: number;
  fromWeekLabel: string;
  toWeekLabel: string;
  title: string;
  advisors: {
    id: string;
    name: string;
    activeProspects: number;
    metrics: AdvisorFunnelMovementMetrics;
  }[];
};

export type CompaniesAdvisorFunnelMovementApi = {
  currentWeekLabel: string;
  periods: CompaniesAdvisorFunnelMovementPeriodApi[];
};

const ADVISOR_ACCENT_CLASSES = [
  'bg-amber-500/15 text-amber-800 ring-amber-500/25 dark:text-amber-200',
  'bg-emerald-500/15 text-emerald-800 ring-emerald-500/25 dark:text-emerald-200',
  'bg-sky-500/15 text-sky-800 ring-sky-500/25 dark:text-sky-200',
  'bg-violet-500/15 text-violet-800 ring-violet-500/25 dark:text-violet-200',
  'bg-rose-500/15 text-rose-800 ring-rose-500/25 dark:text-rose-200',
  'bg-orange-500/15 text-orange-800 ring-orange-500/25 dark:text-orange-200',
] as const;

const EMPTY_BUNDLE: AdvisorFunnelMovementBundle = {
  currentWeekLabel: '—',
  periods: [],
};

function mapPeriodToSnapshot(
  period: CompaniesAdvisorFunnelMovementPeriodApi,
  currentWeekLabel: string,
): AdvisorFunnelMovementSnapshot {
  return {
    fromWeekNumber: period.fromWeekNumber,
    toWeekNumber: period.toWeekNumber,
    fromWeekLabel: period.fromWeekLabel,
    toWeekLabel: period.toWeekLabel,
    currentWeekLabel,
    title: period.title,
    advisors: (period.advisors ?? []).map((advisor, index) => ({
      ...advisor,
      metrics: { ...advisor.metrics },
      accentClass:
        ADVISOR_ACCENT_CLASSES[index % ADVISOR_ACCENT_CLASSES.length] ??
        'bg-muted text-foreground ring-border',
    })),
  };
}

export function buildAdvisorFunnelMovementBundle(
  api: CompaniesAdvisorFunnelMovementApi | null | undefined,
): AdvisorFunnelMovementBundle {
  if (!api?.periods?.length) {
    return {
      currentWeekLabel: api?.currentWeekLabel ?? '—',
      periods: [],
    };
  }

  const currentWeekLabel = api.currentWeekLabel;
  return {
    currentWeekLabel,
    periods: api.periods.map((period) => mapPeriodToSnapshot(period, currentWeekLabel)),
  };
}

/** @deprecated Usar `buildAdvisorFunnelMovementBundle`; conserva el primer periodo. */
export function buildAdvisorFunnelMovementView(
  api: CompaniesAdvisorFunnelMovementApi | null | undefined,
): AdvisorFunnelMovementSnapshot {
  const bundle = buildAdvisorFunnelMovementBundle(api);
  return (
    bundle.periods[0] ?? {
      fromWeekNumber: 0,
      toWeekNumber: 0,
      fromWeekLabel: '—',
      toWeekLabel: '—',
      currentWeekLabel: bundle.currentWeekLabel,
      title: 'Movimiento del funnel',
      advisors: [],
    }
  );
}

export function advisorFunnelPeriodFilterLabel(period: AdvisorFunnelMovementSnapshot): string {
  return `${period.fromWeekLabel} → ${period.toWeekLabel}`;
}
