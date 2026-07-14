export const ADVISOR_WEEKLY_FILTER_COUNT = 5;

export type WeekMeta = { name: string; weekStart?: string; weekEnd?: string };

/** Últimas N semanas, más reciente primero (W28, W27, …). */
export function buildWeeklyPillOptions(
  weeks: WeekMeta[] | null | undefined,
  limit = ADVISOR_WEEKLY_FILTER_COUNT,
): { name: string; sourceIndex: number }[] {
  const source = weeks ?? [];
  if (source.length === 0) return [];

  const start = Math.max(0, source.length - limit);
  return source
    .slice(start)
    .map((week, offset) => ({
      name: week.name,
      sourceIndex: start + offset,
    }))
    .reverse();
}
