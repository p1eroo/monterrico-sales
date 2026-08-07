import { api } from '@/lib/api';

export type CrmOrganizationDto = {
  id: string;
  name: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  globalWeeklyGoal: number;
};

export type CrmCatalogDto = {
  leadSources: {
    id: string;
    slug: string;
    name: string;
    enabled: boolean;
    sortOrder: number;
  }[];
  stages: {
    id: string;
    slug: string;
    name: string;
    color: string;
    probability: number;
    enabled: boolean;
    sortOrder: number;
    isSystem: boolean;
  }[];
  priorities: {
    id: string;
    slug: string;
    name: string;
    color: string;
    description: string;
    enabled: boolean;
    sortOrder: number;
  }[];
  activityTypes: {
    id: string;
    slug: string;
    name: string;
    enabled: boolean;
    sortOrder: number;
  }[];
  rubros: {
    id: string;
    slug: string;
    name: string;
    enabled: boolean;
    sortOrder: number;
  }[];
};

export type CrmSalesGoalsDto = {
  globalWeekly: number;
  myWeekly: number;
  myMonthly: number;
  byUserId: Record<string, { weekly: number; monthly: number }>;
  /** Meta del equipo por YYYY-MM (UTC). Mes ausente = 0 en reportes. */
  monthlyByYm?: Record<string, number>;
  /** userId → meta por YYYY-MM (UTC) para reportes por asesor. */
  advisorMonthlyByYm?: Record<string, Record<string, number>>;
};

export type ActivityGoalTargets = {
  contacto: number;
  noContacto: number;
  reuniones: number;
  correos: number;
};

export function activityGoalTotal(targets: ActivityGoalTargets): number {
  return (
    targets.contacto +
    targets.noContacto +
    targets.reuniones +
    targets.correos
  );
}

export type CrmActivityGoalsDto = {
  weekStart: string;
  byUserId: Record<string, ActivityGoalTargets>;
  canEdit: boolean;
};

export type CrmConfigBundle = {
  organization: CrmOrganizationDto | null;
  catalog: CrmCatalogDto;
  salesGoals?: CrmSalesGoalsDto;
  permissions: {
    canEditConfig: boolean;
    canViewTeamGoals: boolean;
    canEditSalesGoals: boolean;
    canEditActivityGoals: boolean;
  };
};

export async function fetchCrmConfig(): Promise<CrmConfigBundle> {
  return api<CrmConfigBundle>('/crm-config');
}

export async function patchCrmOrganization(body: {
  name?: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}): Promise<CrmOrganizationDto> {
  return api<CrmOrganizationDto>('/crm-config/organization', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function putCrmLeadSources(
  items: { slug: string; name: string; enabled: boolean }[],
): Promise<CrmConfigBundle> {
  return api<CrmConfigBundle>('/crm-config/lead-sources', {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

export async function putCrmRubros(
  items: { slug: string; name: string; enabled: boolean }[],
): Promise<CrmConfigBundle> {
  return api<CrmConfigBundle>('/crm-config/rubros', {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

export async function putCrmStages(
  items: {
    slug: string;
    name: string;
    color: string;
    probability: number;
    enabled: boolean;
    isSystem?: boolean;
  }[],
): Promise<CrmConfigBundle> {
  return api<CrmConfigBundle>('/crm-config/stages', {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

export async function putCrmPriorities(
  items: {
    slug: string;
    name: string;
    color: string;
    description: string;
    enabled: boolean;
  }[],
): Promise<CrmConfigBundle> {
  return api<CrmConfigBundle>('/crm-config/priorities', {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

export async function putCrmActivityTypes(
  items: { slug: string; name: string; enabled: boolean }[],
): Promise<CrmConfigBundle> {
  return api<CrmConfigBundle>('/crm-config/activity-types', {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

export async function putCrmSalesGoals(body: {
  globalWeekly: number;
  byUserId: Record<string, { weekly?: number; monthly?: number }>;
  monthlyByYm?: Record<string, number>;
  advisorMonthlyByYm?: Record<string, Record<string, number>>;
}): Promise<CrmConfigBundle> {
  return api<CrmConfigBundle>('/crm-config/sales-goals', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function fetchCrmActivityGoals(
  weekStart: string,
): Promise<CrmActivityGoalsDto> {
  const q = new URLSearchParams({ weekStart: weekStart.slice(0, 10) });
  return api<CrmActivityGoalsDto>(`/crm-config/activity-goals?${q}`);
}

export async function putCrmActivityGoals(body: {
  weekStart: string;
  byUserId: Record<string, Partial<ActivityGoalTargets>>;
}): Promise<CrmActivityGoalsDto> {
  return api<CrmActivityGoalsDto>('/crm-config/activity-goals', {
    method: 'PUT',
    body: JSON.stringify({
      weekStart: body.weekStart.slice(0, 10),
      byUserId: body.byUserId,
    }),
  });
}

export type CrmDailyActivityGoalsDto = {
  dayStart: string;
  byUserId: Record<string, ActivityGoalTargets>;
  canEdit: boolean;
};

export async function fetchCrmDailyActivityGoals(
  dayStart: string,
): Promise<CrmDailyActivityGoalsDto> {
  const q = new URLSearchParams({ dayStart: dayStart.slice(0, 10) });
  return api<CrmDailyActivityGoalsDto>(`/crm-config/daily-activity-goals?${q}`);
}

export async function putCrmDailyActivityGoals(body: {
  dayStart: string;
  byUserId: Record<string, Partial<ActivityGoalTargets>>;
}): Promise<CrmDailyActivityGoalsDto> {
  return api<CrmDailyActivityGoalsDto>('/crm-config/daily-activity-goals', {
    method: 'PUT',
    body: JSON.stringify({
      dayStart: body.dayStart.slice(0, 10),
      byUserId: body.byUserId,
    }),
  });
}
