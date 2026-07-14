import type { AnalyticsSummary } from '@/lib/analyticsApi';

export type ActivitiesByAdvisorWeeklyApi =
  AnalyticsSummary['activitiesByAdvisorWeekly'];

export type ActivitiesByAdvisorStackedRow = {
  advisorId: string;
  advisorName: string;
  llamadas: number;
  reuniones: number;
  correos: number;
  notas: number;
  total: number;
};

export type ActivitiesByAdvisorStackedData = {
  advisors: ActivitiesByAdvisorStackedRow[];
  totalActivities: number;
  weekLabel?: string;
};

function mapActivitiesAdvisorRow(
  advisor: ActivitiesByAdvisorWeeklyApi['advisors'][number],
  weekIndex?: number,
): ActivitiesByAdvisorStackedRow {
  if (weekIndex == null || weekIndex < 0) {
    return {
      advisorId: advisor.advisorId,
      advisorName: advisor.advisorName,
      llamadas: advisor.llamadas,
      reuniones: advisor.reuniones,
      correos: advisor.correos,
      notas: advisor.notas,
      total: advisor.total,
    };
  }

  const week = advisor.byWeek?.[weekIndex];
  return {
    advisorId: advisor.advisorId,
    advisorName: advisor.advisorName,
    llamadas: week?.llamadas ?? 0,
    reuniones: week?.reuniones ?? 0,
    correos: week?.correos ?? 0,
    notas: week?.notas ?? 0,
    total: week?.total ?? 0,
  };
}

export function buildActivitiesByAdvisorStackedData(
  snapshot: ActivitiesByAdvisorWeeklyApi | null | undefined,
  weekIndex?: number,
): ActivitiesByAdvisorStackedData {
  const advisors = (snapshot?.advisors ?? [])
    .map((row) => mapActivitiesAdvisorRow(row, weekIndex))
    .filter((row) => row.total > 0);
  const totalActivities = advisors.reduce((sum, row) => sum + row.total, 0);
  const weekLabel =
    weekIndex != null && weekIndex >= 0
      ? snapshot?.weeks?.[weekIndex]?.name
      : undefined;

  return { advisors, totalActivities, weekLabel };
}

export function activitiesByAdvisorStackedHasData(
  data: ActivitiesByAdvisorStackedData,
): boolean {
  return data.totalActivities > 0;
}
