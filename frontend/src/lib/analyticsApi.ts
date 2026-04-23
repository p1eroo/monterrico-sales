import { api } from '@/lib/api';
import type { DateRange } from 'react-day-picker';

export type AnalyticsSummary = {
  range: { from: string; to: string };
  kpis: {
    totalContacts: number;
    totalContactsPrev: number;
    newContactsInRange: number;
    activeOpportunities: number;
    closedSalesAmount: number;
    closedSalesPrev: number;
    conversionPct: number;
    pendingActivities: number;
    overdueFollowUps: number;
    pipelineValue: number;
    activitiesCompleted: number;
    changes: { contacts: string; sales: string };
  };
  salesByMonth: { name: string; ventas: number; meta: number }[];
  contactsBySource: { name: string; value: number }[];
  funnelByStage: { name: string; value: number }[];
  /** Empresas creadas en el rango, agrupadas por `etapa` (mismos filtros que contactos). */
  companiesByStage: { name: string; value: number }[];
  /** Por semana ISO (UTC): avance / nuevo / retroceso / sin cambios en cartera. */
  companiesWeeklyProgress: {
    name: string;
    avance: number;
    nuevoIngreso: number;
    retroceso: number;
    sinCambios: number;
  }[];
  performanceByAdvisor: { name: string; leads: number; ventas: number }[];
  pendingActivities: {
    id: string;
    title: string;
    type: string;
    taskKind: string | null;
    status: string;
    dueDate: string;
    contactName: string;
  }[];
  contactsByPeriod: { name: string; leads: number; nuevos: number }[];
  conversionByMonth: { name: string; tasa: number }[];
  activitiesByTypeData: {
    name: string;
    llamadas: number;
    reuniones: number;
    correos: number;
  }[];
  opportunitiesByStageData: { name: string; count: number; value: number }[];
  followUpsByMonth: { name: string; completados: number; pendientes: number }[];
};

export type AnalyticsGoalProgress = {
  weekStart: string;
  weekEnd: string;
  monthStart: string;
  monthEnd: string;
  teamWeeklyClosed: number;
  teamMonthlyClosed: number;
  myWeeklyClosed: number;
  myMonthlyClosed: number;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Fechas locales YYYY-MM-DD para el API */
export function formatLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function analyticsRangeFromPreset(
  preset: '7d' | '1m' | '3m' | '1y' | 'custom',
  custom?: DateRange,
): { from: string; to: string } {
  const to = new Date();
  const toStr = formatLocalISODate(to);
  if (preset === 'custom' && custom?.from && custom?.to) {
    return {
      from: formatLocalISODate(custom.from),
      to: formatLocalISODate(custom.to),
    };
  }
  const from = new Date(to);
  switch (preset) {
    case '7d':
      from.setDate(from.getDate() - 7);
      break;
    case '3m':
      from.setMonth(from.getMonth() - 3);
      break;
    case '1y':
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
      break;
    case '1m':
    default:
      from.setMonth(from.getMonth() - 1);
      break;
  }
  return { from: formatLocalISODate(from), to: toStr };
}

export async function fetchAnalyticsSummary(params: {
  from?: string;
  to?: string;
  advisorId?: string;
  source?: string;
}): Promise<AnalyticsSummary> {
  const q = new URLSearchParams();
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.advisorId) q.set('advisorId', params.advisorId);
  if (params.source) q.set('source', params.source);
  const qs = q.toString();
  return api<AnalyticsSummary>(`/analytics/summary${qs ? `?${qs}` : ''}`);
}

export async function fetchAnalyticsGoalProgress(
  advisorId?: string,
): Promise<AnalyticsGoalProgress> {
  const q = advisorId ? `?advisorId=${encodeURIComponent(advisorId)}` : '';
  return api<AnalyticsGoalProgress>(`/analytics/goal-progress${q}`);
}
