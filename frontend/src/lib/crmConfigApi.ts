import { api } from '@/lib/api';

export type CrmOrganizationDto = {
  id: string;
  name: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  globalWeeklyGoal: number;
  globalMonthlyGoal: number;
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
};

export type CrmSalesGoalsDto = {
  globalWeekly: number;
  globalMonthly: number;
  myWeekly: number;
  myMonthly: number;
  byUserId: Record<string, { weekly: number; monthly: number }>;
};

export type CrmConfigBundle = {
  organization: CrmOrganizationDto | null;
  catalog: CrmCatalogDto;
  salesGoals?: CrmSalesGoalsDto;
  permissions: {
    canEditConfig: boolean;
    canViewTeamGoals: boolean;
    canEditSalesGoals: boolean;
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
  globalMonthly: number;
  byUserId: Record<string, { weekly?: number; monthly?: number }>;
}): Promise<CrmConfigBundle> {
  return api<CrmConfigBundle>('/crm-config/sales-goals', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
