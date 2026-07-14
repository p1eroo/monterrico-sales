import type { AnalyticsSummary } from '@/lib/analyticsApi';

export type ActivitiesByTypeWeeklyApi =
  AnalyticsSummary['activitiesByTypeWeekly'];

export type ActivitiesByTypeHeatmapData = {
  weeks: string[];
  series: { name: string; data: { x: string; y: number }[] }[];
  maxCount: number;
  totalActivities: number;
};

export function buildActivitiesByTypeHeatmapData(
  snapshot: ActivitiesByTypeWeeklyApi | null | undefined,
): ActivitiesByTypeHeatmapData {
  const weeks = snapshot?.weeks?.map((week) => week.name) ?? [];
  const types = snapshot?.types ?? [];

  const series = types.map((typeRow) => ({
    name: typeRow.label,
    data: weeks.map((weekName, index) => ({
      x: weekName,
      y: typeRow.counts[index] ?? 0,
    })),
  }));

  const totalActivities = types.reduce((sum, row) => sum + row.total, 0);

  return {
    weeks,
    series,
    maxCount: snapshot?.maxCount ?? 0,
    totalActivities,
  };
}

export function activitiesByTypeHeatmapHasData(
  data: ActivitiesByTypeHeatmapData,
): boolean {
  return data.totalActivities > 0;
}
