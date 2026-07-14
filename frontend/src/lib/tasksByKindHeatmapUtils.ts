import type { AnalyticsSummary } from '@/lib/analyticsApi';

export type TasksByKindWeeklyApi = AnalyticsSummary['tasksByKindWeekly'];

export type TasksByKindHeatmapData = {
  weeks: string[];
  series: { name: string; data: { x: string; y: number }[] }[];
  maxCount: number;
  totalTasks: number;
};

export function buildTasksByKindHeatmapData(
  snapshot: TasksByKindWeeklyApi | null | undefined,
): TasksByKindHeatmapData {
  const weeks = snapshot?.weeks?.map((week) => week.name) ?? [];
  const kinds = snapshot?.kinds ?? [];

  const series = kinds.map((kindRow) => ({
    name: kindRow.label,
    data: weeks.map((weekName, index) => ({
      x: weekName,
      y: kindRow.counts[index] ?? 0,
    })),
  }));

  const totalTasks = kinds.reduce((sum, row) => sum + row.total, 0);

  return {
    weeks,
    series,
    maxCount: snapshot?.maxCount ?? 0,
    totalTasks,
  };
}

export function tasksByKindHeatmapHasData(data: TasksByKindHeatmapData): boolean {
  return data.totalTasks > 0;
}
