import type { HotProspectsSummary } from '@/lib/analyticsApi';

export type HotProspectSparkline = {
  data: number[];
  labels?: string[];
  color: string;
  variant?: 'bar' | 'area';
};

const SPARKLINE_STYLES: Record<
  'total' | 'pipeline' | 'cierre' | 'activos',
  Pick<HotProspectSparkline, 'color' | 'variant'>
> = {
  total: { color: '#f97316', variant: 'area' },
  pipeline: { color: '#ef4444', variant: 'area' },
  cierre: { color: '#22c55e', variant: 'bar' },
  activos: { color: '#15803d', variant: 'bar' },
};

export function mapHotProspectsSparklines(
  summary: HotProspectsSummary | null | undefined,
): Partial<
  Record<'total' | 'pipeline' | 'cierre' | 'activos', HotProspectSparkline>
> | undefined {
  const trend = summary?.weeklyTrend;
  if (!trend?.weeks?.length) return undefined;

  const labels = trend.weeks.map((w) => w.name);

  return {
    total: {
      ...SPARKLINE_STYLES.total,
      data: trend.totalCalientes,
      labels,
    },
    pipeline: {
      ...SPARKLINE_STYLES.pipeline,
      data: trend.pipelineCaliente,
      labels,
    },
    cierre: {
      ...SPARKLINE_STYLES.cierre,
      data: trend.enCierre,
      labels,
    },
    activos: {
      ...SPARKLINE_STYLES.activos,
      data: trend.yaActivos,
      labels,
    },
  };
}
