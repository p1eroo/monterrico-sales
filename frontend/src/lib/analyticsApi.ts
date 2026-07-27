import { api } from '@/lib/api';
import type { DateRange } from 'react-day-picker';
import { calendarDateToLimaYmd } from '@/lib/crmTimezone';
import { addCalendarDaysLocalIso, formatTodayPeruYmd } from '@/lib/formatters';

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
    changes: { contacts: string; opportunities: string; sales: string };
  };
  salesByMonth: {
    name: string;
    ventas: number;
    meta: number;
    /** Oportunidades con status ganada en ese mes (mismo criterio que `ventas`). */
    oportunidadesGanadas: {
      id: string;
      title: string;
      amount: number;
      companyName: string | null;
    }[];
  }[];
  /** Contactos creados en el rango, por fuente (solo etapas 10%–100%). */
  contactsBySource: { name: string; value: number }[];
  /** Oportunidades creadas en el rango, por fuente (solo etapas 10%–100%). */
  opportunitiesBySource: { name: string; value: number }[];
  /** Empresas creadas en el rango, por fuente (solo etapas 10%–100%). */
  companiesBySource: { name: string; value: number }[];
  /** Últimas 6 semanas: empresas acumuladas por fuente (1 ene → cierre semana, etapa histórica 10%–100%). */
  companiesBySourceWeekly: {
    weeks: {
      name: string;
      weekStart: string;
      weekEnd: string;
      sources: { slug: string; value: number }[];
    }[];
  };
  /** Detalle por fuente (cards): empresas acumuladas del 1 ene al cierre de la semana ISO anterior, etapas 10%–100%. */
  sourcesDetail: {
    week: { name: string; weekStart: string; weekEnd: string };
    sources: {
      slug: string;
      companyCount: number;
      estimatedBilling: number;
      stages: {
        slug: string;
        name: string;
        probability: number;
        count: number;
      }[];
      hot70Count: number;
      hot70Billing: number;
    }[];
  };
  /** Últimas 5 semanas ISO: detalle por fuente + desglose por asesor (filtro local en modal). */
  sourcesDetailWeekly: {
    weeks: {
      week: { name: string; weekStart: string; weekEnd: string };
      sources: AnalyticsSummary['sourcesDetail']['sources'];
      byAdvisor: Record<string, AnalyticsSummary['sourcesDetail']['sources']>;
    }[];
  };
  funnelByStage: { name: string; value: number }[];
  /** Empresas creadas en el rango, agrupadas por `etapa` (mismos filtros que contactos). */
  companiesByStage: { name: string; value: number }[];
  opportunitiesByStage: { name: string; count: number }[];
  /** Por semana ISO (UTC): avance / nuevo / atraso / sin cambios en cartera de empresas. */
  companiesWeeklyProgress: {
    name: string;
    avance: number;
    nuevoIngreso: number;
    atraso: number;
    sinCambios: number;
  }[];
  /** Por semana ISO (UTC): avance / nuevo / atraso / sin cambios en oportunidades. */
  opportunitiesWeeklyProgress: {
    name: string;
    avance: number;
    nuevoIngreso: number;
    atraso: number;
    sinCambios: number;
  }[];
  /** Sparkline KPI dashboard: una barra por semana ISO en el rango del filtro */
  contactsWeekly: { name: string; value: number }[];
  salesWeekly: { name: string; value: number }[];
  wonOpportunitiesWeekly: { name: string; value: number }[];
  activitiesCompletedWeekly: { name: string; value: number }[];
  opportunitiesWeeklySparkline: { name: string; value: number }[];
  performanceByAdvisor: { name: string; oportunidades: number; contactos: number; empresas: number }[];
  pendingActivities: {
    id: string;
    title: string;
    type: string;
    taskKind: string | null;
    status: string;
    dueDate: string;
    contactName: string;
  }[];
  contactsVsOpportunitiesByMonth: { name: string; contactos: number; oportunidades: number }[];
  conversionByMonth: { name: string; tasa: number }[];
  activitiesByTypeData: {
    name: string;
    llamadas: number;
    reuniones: number;
    correos: number;
  }[];
  /** Últimas 6 semanas ISO: actividades completadas por tipo (llamada, reunión, etc.). */
  activitiesByTypeWeekly: {
    weeks: { name: string; weekStart: string; weekEnd: string }[];
    types: {
      key: 'llamadas' | 'reuniones' | 'correos';
      label: string;
      counts: number[];
      total: number;
    }[];
    maxCount: number;
  };
  /** Últimas 6 semanas ISO: actividades completadas por asesor y tipo. */
  activitiesByAdvisorWeekly: {
    weeks: { name: string; weekStart: string; weekEnd: string }[];
    advisors: {
      advisorId: string;
      advisorName: string;
      llamadas: number;
      reuniones: number;
      correos: number;
      notas: number;
      total: number;
      byWeek: {
        llamadas: number;
        reuniones: number;
        correos: number;
        notas: number;
        total: number;
      }[];
    }[];
  };
  /** Últimas 6 semanas ISO: tareas completadas por tipo (taskKind). */
  tasksByKindWeekly: {
    weeks: { name: string; weekStart: string; weekEnd: string }[];
    kinds: {
      key: 'llamadas' | 'reuniones' | 'correos';
      label: string;
      counts: number[];
      total: number;
    }[];
    maxCount: number;
  };
  /** Últimas 6 semanas ISO: tareas completadas por asesor y tipo. */
  tasksByAdvisorWeekly: {
    weeks: { name: string; weekStart: string; weekEnd: string }[];
    advisors: {
      advisorId: string;
      advisorName: string;
      llamadas: number;
      reuniones: number;
      correos: number;
      whatsapp: number;
      total: number;
      byWeek: {
        llamadas: number;
        reuniones: number;
        correos: number;
        whatsapp: number;
        total: number;
      }[];
    }[];
  };
  opportunitiesByStageData: { name: string; count: number; value: number }[];
  followUpsByMonth: { name: string; completados: number; pendientes: number }[];
  opportunitiesInteraction: { withInteraction: number; withoutInteraction: number };
  /** Últimas 6 semanas: empresas creadas en el año (1 ene) en etapas 10–100 %. */
  activeProspectsWeekly: {
    weeks: {
      name: string;
      weekStart: string;
      weekEnd: string;
      total: number;
      byStage: {
        slug: string;
        name: string;
        probability: number;
        count: number;
      }[];
    }[];
    currentTotal: number;
    changePct: number | null;
  };
  /** Últimas 6 semanas: matriz asesor × etapa (10–100 %), empresas del año en curso. */
  activeProspectsByAdvisorWeekly: {
    weeks: {
      name: string;
      weekStart: string;
      weekEnd: string;
      advisors: { id: string; name: string }[];
      stages: {
        slug: string;
        name: string;
        probability: number;
        countsByAdvisor: Record<string, number>;
      }[];
      estimatedBillingByAdvisor: Record<string, number>;
    }[];
  };
  /** Movimiento del embudo por asesor (últimas 4 parejas de semanas ISO). */
  companiesAdvisorFunnelMovement: {
    currentWeekLabel: string;
    periods: {
      fromWeekNumber: number;
      toWeekNumber: number;
      fromWeekLabel: string;
      toWeekLabel: string;
      title: string;
      advisors: {
        id: string;
        name: string;
        activeProspects: number;
        metrics: {
          nuevoIngreso: number;
          avance: number;
          atraso: number;
          sinCambios: number;
        };
      }[];
    }[];
  };
  /** Últimas 6 semanas: empresas creadas en el año (1 ene) en etapas 30–100 %. */
  advancedContactsWeekly: {
    weeks: {
      name: string;
      weekStart: string;
      weekEnd: string;
      total: number;
      byStage: {
        slug: string;
        name: string;
        probability: number;
        count: number;
      }[];
    }[];
    currentTotal: number;
    changePct: number | null;
  };
  /** Últimas 6 semanas: facturación estimada del año (1 ene), etapas 10–100 %. */
  estimatedBillingWeekly: {
    weeks: {
      name: string;
      weekStart: string;
      weekEnd: string;
      total: number;
      byStage: {
        slug: string;
        name: string;
        probability: number;
        amount: number;
      }[];
    }[];
    currentTotal: number;
    changePct: number | null;
  };
  /** Prospectos calientes al cierre de la semana ISO anterior (empresas). */
  hotProspects: {
    week: {
      name: string;
      weekStart: string;
      weekEnd: string;
    };
    totalCalientes: number;
    pipelineCaliente: number;
    enCierre: number;
    yaActivos: number;
    topProspects: {
      id: string;
      urlSlug: string;
      name: string;
      etapa: string;
      etapaLabel: string;
      probability: number;
      assignedToName: string | null;
      facturacionEstimada: number;
    }[];
    weeklyTrend: {
      weeks: { name: string; weekStart: string; weekEnd: string }[];
      totalCalientes: number[];
      pipelineCaliente: number[];
      enCierre: number[];
      yaActivos: number[];
    };
  };
};

export type ActiveProspectsWeekly = AnalyticsSummary['activeProspectsWeekly'];

export type ActiveProspectsByAdvisorWeekly =
  AnalyticsSummary['activeProspectsByAdvisorWeekly'];

export type AdvancedContactsWeekly = AnalyticsSummary['advancedContactsWeekly'];

export type EstimatedBillingWeekly = AnalyticsSummary['estimatedBillingWeekly'];

export type HotProspectsSummary = AnalyticsSummary['hotProspects'];
export type HotProspectRow = HotProspectsSummary['topProspects'][number];

export type GoalChartPoint = {
  name: string;
  meta: number;
  avance: number;
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
  weeklyChart: GoalChartPoint[];
  monthlyChart: GoalChartPoint[];
};

/** Fecha calendario Lima YYYY-MM-DD para el API de analytics. */
export function formatLocalISODate(d: Date): string {
  return calendarDateToLimaYmd(d);
}

/** Año en curso: 1 ene → hoy (gráficos de tendencia en Reportes). */
export function analyticsYearToDateRange(now = new Date()): { from: string; to: string } {
  const to = formatTodayPeruYmd();
  const year = calendarDateToLimaYmd(now).slice(0, 4);
  return {
    from: `${year}-01-01`,
    to,
  };
}

export function analyticsRangeFromPreset(
  preset: '7d' | '1m' | '3m' | '1y' | 'custom',
  custom?: DateRange,
): { from: string; to: string } {
  const toStr = formatTodayPeruYmd();
  if (preset === 'custom' && custom?.from && custom?.to) {
    return {
      from: formatLocalISODate(custom.from),
      to: formatLocalISODate(custom.to),
    };
  }
  switch (preset) {
    case '7d':
      return { from: addCalendarDaysLocalIso(-7), to: toStr };
    case '3m':
      return { from: addCalendarDaysLocalIso(-90), to: toStr };
    case '1y':
      return { from: `${toStr.slice(0, 4)}-01-01`, to: toStr };
    case '1m':
    default:
      return { from: addCalendarDaysLocalIso(-30), to: toStr };
  }
}

export type AnalyticsKPIs = {
  range: { from: string; to: string };
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
  changes: { contacts: string; opportunities: string; sales: string };
};

export type AnalyticsQueryFilters = {
  from?: string;
  to?: string;
  /** @deprecated Prefer assignedTo / excludeAssignedTo */
  advisorId?: string;
  assignedTo?: string;
  excludeAssignedTo?: string;
  advisorPool?: string;
  source?: string;
  area?: string;
  /** Semanas para sparklines KPI (8 dashboard, 10 reportes). */
  sparklineWeeks?: number;
};

function appendAnalyticsFilters(q: URLSearchParams, params: AnalyticsQueryFilters) {
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.assignedTo) q.set('assignedTo', params.assignedTo);
  else if (params.advisorId) q.set('advisorId', params.advisorId);
  if (params.excludeAssignedTo) q.set('excludeAssignedTo', params.excludeAssignedTo);
  if (params.advisorPool) q.set('advisorPool', params.advisorPool);
  if (params.source) q.set('source', params.source);
  if (params.area) q.set('area', params.area);
  if (params.sparklineWeeks != null) q.set('sparklineWeeks', String(params.sparklineWeeks));
}

export async function fetchAnalyticsKPIs(
  params: AnalyticsQueryFilters,
): Promise<AnalyticsKPIs> {
  const q = new URLSearchParams();
  appendAnalyticsFilters(q, params);
  const qs = q.toString();
  return api<AnalyticsKPIs>(`/analytics/kpis${qs ? `?${qs}` : ''}`);
}

export async function fetchAnalyticsSummary(
  params: AnalyticsQueryFilters,
): Promise<AnalyticsSummary> {
  const q = new URLSearchParams();
  appendAnalyticsFilters(q, params);
  const qs = q.toString();
  return api<AnalyticsSummary>(`/analytics/summary${qs ? `?${qs}` : ''}`);
}

export async function fetchAnalyticsGoalProgress(
  advisorId?: string,
  area?: string,
): Promise<AnalyticsGoalProgress> {
  const q = new URLSearchParams();
  if (advisorId) q.set('advisorId', advisorId);
  if (area) q.set('area', area);
  const qs = q.toString();
  return api<AnalyticsGoalProgress>(`/analytics/goal-progress${qs ? `?${qs}` : ''}`);
}

export type AdvisorFunnelMovementMetricKey =
  | 'nuevoIngreso'
  | 'avance'
  | 'atraso'
  | 'sinCambios';

export type AdvisorFunnelMovementCompanyRow = {
  id: string;
  name: string;
  urlSlug: string;
  etapa: string;
  etapaLabel: string;
};

export type AdvisorFunnelMovementCompaniesPage = {
  data: AdvisorFunnelMovementCompanyRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type AdvisorFunnelMovementCompaniesQuery = AnalyticsQueryFilters & {
  advisorId: string;
  metric: AdvisorFunnelMovementMetricKey;
  toWeekNumber: number;
  page?: number;
  limit?: number;
};

export type AdvisorFunnelMovementDetailQuery = Pick<
  AdvisorFunnelMovementCompaniesQuery,
  'to' | 'assignedTo' | 'excludeAssignedTo' | 'advisorPool' | 'source' | 'area'
>;

export async function fetchAdvisorFunnelMovementCompanies(
  params: AdvisorFunnelMovementCompaniesQuery,
): Promise<AdvisorFunnelMovementCompaniesPage> {
  const q = new URLSearchParams();
  appendAnalyticsFilters(q, params);
  q.set('advisorId', params.advisorId);
  q.set('metric', params.metric);
  q.set('toWeekNumber', String(params.toWeekNumber));
  if (params.page != null) q.set('page', String(params.page));
  if (params.limit != null) q.set('limit', String(params.limit));
  return api<AdvisorFunnelMovementCompaniesPage>(
    `/analytics/advisor-funnel-movement/companies?${q.toString()}`,
  );
}

export type ActivitiesByAdvisorDetailEntity = {
  id: string;
  name: string;
  urlSlug: string;
};

export type ActivitiesByAdvisorDetailRow = {
  id: string;
  type: string;
  typeLabel: string;
  title: string;
  completedAt: string;
  companies: ActivitiesByAdvisorDetailEntity[];
  contacts: ActivitiesByAdvisorDetailEntity[];
  opportunities: { id: string; title: string; urlSlug: string }[];
};

export type ActivitiesByAdvisorDetailsPage = {
  data: ActivitiesByAdvisorDetailRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  advisorName: string;
  weekLabel: string;
};

export type ActivitiesByAdvisorDetailsQuery = AnalyticsQueryFilters & {
  advisorId: string;
  weekStart: string;
  weekEnd: string;
  page?: number;
  limit?: number;
};

export async function fetchActivitiesByAdvisorDetails(
  params: ActivitiesByAdvisorDetailsQuery,
): Promise<ActivitiesByAdvisorDetailsPage> {
  const q = new URLSearchParams();
  appendAnalyticsFilters(q, params);
  q.set('advisorId', params.advisorId);
  q.set('weekStart', params.weekStart);
  q.set('weekEnd', params.weekEnd);
  if (params.page != null) q.set('page', String(params.page));
  if (params.limit != null) q.set('limit', String(params.limit));
  return api<ActivitiesByAdvisorDetailsPage>(
    `/analytics/activities-by-advisor/details?${q.toString()}`,
  );
}

export async function fetchTasksByAdvisorDetails(
  params: ActivitiesByAdvisorDetailsQuery,
): Promise<ActivitiesByAdvisorDetailsPage> {
  const q = new URLSearchParams();
  appendAnalyticsFilters(q, params);
  q.set('advisorId', params.advisorId);
  q.set('weekStart', params.weekStart);
  q.set('weekEnd', params.weekEnd);
  if (params.page != null) q.set('page', String(params.page));
  if (params.limit != null) q.set('limit', String(params.limit));
  return api<ActivitiesByAdvisorDetailsPage>(
    `/analytics/tasks-by-advisor/details?${q.toString()}`,
  );
}
