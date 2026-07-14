import type { AnalyticsSummary } from '@/lib/analyticsApi';

export type TasksByAdvisorWeeklyApi = AnalyticsSummary['tasksByAdvisorWeekly'];

export type TasksByAdvisorStackedRow = {
  advisorId: string;
  advisorName: string;
  llamadas: number;
  reuniones: number;
  correos: number;
  whatsapp: number;
  total: number;
};

export type TasksByAdvisorStackedData = {
  advisors: TasksByAdvisorStackedRow[];
  totalTasks: number;
  weekLabel?: string;
};

function mapTasksAdvisorRow(
  advisor: TasksByAdvisorWeeklyApi['advisors'][number],
  weekIndex?: number,
): TasksByAdvisorStackedRow {
  if (weekIndex == null || weekIndex < 0) {
    return {
      advisorId: advisor.advisorId,
      advisorName: advisor.advisorName,
      llamadas: advisor.llamadas,
      reuniones: advisor.reuniones,
      correos: advisor.correos,
      whatsapp: advisor.whatsapp,
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
    whatsapp: week?.whatsapp ?? 0,
    total: week?.total ?? 0,
  };
}

export function buildTasksByAdvisorStackedData(
  snapshot: TasksByAdvisorWeeklyApi | null | undefined,
  weekIndex?: number,
): TasksByAdvisorStackedData {
  const advisors = (snapshot?.advisors ?? [])
    .map((row) => mapTasksAdvisorRow(row, weekIndex))
    .filter((row) => row.total > 0);
  const totalTasks = advisors.reduce((sum, row) => sum + row.total, 0);
  const weekLabel =
    weekIndex != null && weekIndex >= 0
      ? snapshot?.weeks?.[weekIndex]?.name
      : undefined;

  return { advisors, totalTasks, weekLabel };
}

export function tasksByAdvisorStackedHasData(
  data: TasksByAdvisorStackedData,
): boolean {
  return data.totalTasks > 0;
}
