import { api } from '@/lib/api';

// ─── Tipos Facebook ───

export interface FacebookAccount {
  id: string;
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  pageTokenExpiresAt: string | null;
  instagramId: string | null;
  connectedById: string;
  active: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  forms: FacebookForm[];
}

export interface FacebookForm {
  id: string;
  facebookFormId: string;
  name: string;
  pageId: string;
  accountId: string;
  locale: string | null;
  status: string;
  leadsCount: number;
  lastLeadAt: string | null;
  createdAt: string;
  updatedAt: string;
  account?: { id: string; pageName: string; lastSyncedAt: string | null };
}

export interface FacebookLead {
  id: string;
  facebookLeadId: string;
  formId: string;
  fieldData: Record<string, string[]>[];
  fullName: string | null;
  phone: string | null;
  email: string | null;
  adId: string | null;
  adName: string | null;
  createdTime: string;
  importedAsContactId: string | null;
  importedAsFlotaProspectoId: string | null;
  importedAt: string | null;
  createdAt: string;
  form: { id: string; name: string; facebookFormId: string };
}

export interface FacebookLeadsResponse {
  data: FacebookLead[];
  total: number;
  page: number;
  limit: number;
}

export interface FacebookStats {
  total: number;
  today: number;
  lastSync: string | null;
  formsCount: number;
  byForm: { id: string; name: string; leadsCount: number }[];
}

export interface ConnectAccountDto {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  pageTokenExpiresAt?: string;
  instagramId?: string;
}

// ─── API calls ───

export async function connectFacebookAccount(dto: ConnectAccountDto): Promise<FacebookAccount> {
  return api<FacebookAccount>('/facebook/connect', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function fetchFacebookAccounts(): Promise<FacebookAccount[]> {
  return api<FacebookAccount[]>('/facebook/accounts');
}

export async function disconnectFacebookAccount(id: string): Promise<{ disconnected: boolean }> {
  return api<{ disconnected: boolean }>(`/facebook/accounts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function syncFacebookForms(accountId: string): Promise<FacebookForm[]> {
  return api<FacebookForm[]>(`/facebook/accounts/${encodeURIComponent(accountId)}/sync-forms`, {
    method: 'POST',
  });
}

export async function syncFacebookLeads(accountId: string, formId?: string): Promise<{ imported: number }> {
  return api<{ imported: number }>(`/facebook/accounts/${encodeURIComponent(accountId)}/sync-leads`, {
    method: 'POST',
    body: JSON.stringify({ formId }),
  });
}

export async function fetchFacebookLeads(params?: {
  page?: number;
  limit?: number;
  search?: string;
  formId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<FacebookLeadsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.search) searchParams.set('search', params.search);
  if (params?.formId) searchParams.set('formId', params.formId);
  if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
  if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
  const qs = searchParams.toString();
  return api<FacebookLeadsResponse>(`/facebook/leads${qs ? `?${qs}` : ''}`);
}

export async function fetchFacebookStats(): Promise<FacebookStats> {
  return api<FacebookStats>('/facebook/stats');
}

export async function fetchFacebookForms(): Promise<FacebookForm[]> {
  return api<FacebookForm[]>('/facebook/forms');
}

export async function sendLeadToComercial(leadId: string): Promise<{ contactId: string }> {
  return api<{ contactId: string }>(`/facebook/leads/${encodeURIComponent(leadId)}/send-to-comercial`, {
    method: 'POST',
  });
}

export async function sendLeadToFlota(leadId: string): Promise<{ flotaProspectoId: string }> {
  return api<{ flotaProspectoId: string }>(`/facebook/leads/${encodeURIComponent(leadId)}/send-to-flota`, {
    method: 'POST',
  });
}

export async function deleteFacebookLead(leadId: string): Promise<{ deleted: boolean }> {
  return api<{ deleted: boolean }>(`/facebook/leads/${encodeURIComponent(leadId)}`, {
    method: 'DELETE',
  });
}

export async function bulkDeleteFacebookLeads(params: {
  ids?: string[];
  selectAll?: boolean;
  formId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ deleted: number }> {
  return api<{ deleted: number }>('/facebook/leads/bulk-delete', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ─── Mantener compatibilidad con tipos existentes ───

export interface MarketingLead {
  id: string;
  source: 'facebook' | 'tiktok';
  fullName: string;
  phone: string;
  email: string;
  campaignName: string;
  formId: string;
  createdAt: string;
}

export interface MarketingIntegration {
  id: string;
  name: string;
  icon: string;
  status: 'active' | 'inactive' | 'coming_soon';
  campaigns: { id: string; name: string; status: 'active' | 'inactive'; leads: number }[];
  webhookUrl?: string;
}

export async function fetchLeads(params?: { page?: number; campaign?: string }): Promise<{ data: MarketingLead[]; total: number }> {
  const res = await fetchFacebookLeads({ page: params?.page, limit: 50 });
  const mapped: MarketingLead[] = res.data.map((l) => ({
    id: l.id,
    source: 'facebook',
    fullName: l.fullName || 'Sin nombre',
    phone: l.phone || '',
    email: l.email || '',
    campaignName: l.form.name,
    formId: l.form.facebookFormId,
    createdAt: l.createdTime,
  }));
  let filtered = mapped;
  if (params?.campaign) {
    filtered = mapped.filter((l) => l.campaignName === params.campaign);
  }
  return { data: filtered, total: filtered.length };
}

export async function fetchIntegrations(): Promise<MarketingIntegration[]> {
  const accounts = await fetchFacebookAccounts();
  return accounts.map((a) => ({
    id: a.id,
    name: a.pageName,
    icon: 'facebook',
    status: a.active ? 'active' : 'inactive' as const,
    webhookUrl: `${window.location.origin}/api/webhooks/facebook`,
    campaigns: a.forms.map((f) => ({
      id: f.id,
      name: f.name,
      status: f.status as 'active' | 'inactive',
      leads: f.leadsCount,
    })),
  }));
}
