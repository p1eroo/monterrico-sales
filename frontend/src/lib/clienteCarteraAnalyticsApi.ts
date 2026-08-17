import { api } from '@/lib/api';

export type ClienteCarteraWeeklyPoint = {
  name: string;
  value: number;
};

export type ClienteCarteraActivitiesByTypeWeekly = {
  weeks: { name: string; weekStart: string; weekEnd: string }[];
  types: {
    key: 'llamadas_contacto' | 'llamadas_no_contacto' | 'reuniones' | 'correos';
    label: string;
    counts: number[];
    total: number;
  }[];
  maxCount: number;
};

export type ClienteCarteraTasksByKindWeekly = {
  weeks: { name: string; weekStart: string; weekEnd: string }[];
  kinds: {
    key: 'llamadas' | 'reuniones' | 'correos';
    label: string;
    counts: number[];
    total: number;
  }[];
  maxCount: number;
};

export type ClienteCarteraAnalyticsSummary = {
  range: { from: string; to: string };
  kpis: {
    totalEmpresas: number;
    empresasActivas: number;
    empresasInactivas: number;
    empresasPotenciales: number;
    altasInRange: number;
    ingresos: number;
    ingresosAnual: number;
    contactosCreated: number;
    tasksCompleted: number;
    tasksPending: number;
    changes: { altas: string; contactos: string; tasks: string };
  };
  byStatus: { key: string; name: string; value: number }[];
  altasByMonth: { name: string; empresas: number; contactos: number }[];
  monthlyBilling: { name: string; amount: number }[];
  ingresosByAdvisor: {
    advisorId: string;
    advisorName: string;
    empresas: number;
    ingresos: number;
  }[];
  byAdvisor: {
    advisorId: string;
    advisorName: string;
    empresas: number;
    contactos: number;
    tareas: number;
  }[];
  altasWeekly: ClienteCarteraWeeklyPoint[];
  contactosWeekly: ClienteCarteraWeeklyPoint[];
  tasksWeekly: ClienteCarteraWeeklyPoint[];
  activitiesByTypeWeekly: ClienteCarteraActivitiesByTypeWeekly;
  tasksByKindWeekly: ClienteCarteraTasksByKindWeekly;
};

export type ClienteCarteraAnalyticsQuery = {
  from?: string;
  to?: string;
  assignedTo?: string;
  excludeAssignedTo?: string;
  advisorPool?: string;
};

export async function fetchClienteCarteraAnalyticsSummary(
  params: ClienteCarteraAnalyticsQuery,
): Promise<ClienteCarteraAnalyticsSummary> {
  const q = new URLSearchParams();
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.assignedTo) q.set('assignedTo', params.assignedTo);
  if (params.excludeAssignedTo) q.set('excludeAssignedTo', params.excludeAssignedTo);
  if (params.advisorPool) q.set('advisorPool', params.advisorPool);
  const qs = q.toString();
  return api<ClienteCarteraAnalyticsSummary>(
    `/cliente-cartera/analytics/summary${qs ? `?${qs}` : ''}`,
  );
}
