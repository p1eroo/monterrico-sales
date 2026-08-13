import { api, API_BASE } from '@/lib/api';

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
  questions: { key: string; label: string }[] | null;
  createdAt: string;
  updatedAt: string;
  account?: { id: string; pageName: string; lastSyncedAt: string | null };
}

export interface FacebookLead {
  id: string;
  facebookLeadId: string;
  formId: string;
  fieldData: { name: string; values: string[] }[];
  fullName: string | null;
  phone: string | null;
  email: string | null;
  adId: string | null;
  adName: string | null;
  platform: string | null;
  isOrganic: boolean | null;
  createdTime: string;
  importedAsContactId: string | null;
  importedAsCompanyId: string | null;
  importedAsOpportunityId: string | null;
  importedAsFlotaProspectoId: string | null;
  importedAt: string | null;
  createdAt: string;
  form: { id: string; name: string; facebookFormId: string };
}

export interface LeadTableColumn {
  key: string;
  label: string;
}

export interface FacebookLeadsResponse {
  data: FacebookLead[];
  total: number;
  page: number;
  limit: number;
  columns: LeadTableColumn[];
}

export interface FacebookStats {
  total: number;
  today: number;
  lastSync: string | null;
  formsCount: number;
  byForm: { id: string; name: string; leadsCount: number }[];
  byPlatform: { key: string; name: string; value: number }[];
}

export const FACEBOOK_PLATFORM_LABELS: Record<string, string> = {
  fb: 'Facebook',
  ig: 'Instagram',
  an: 'Audience Network',
  msg: 'Messenger',
};

export function facebookPlatformLabel(platform?: string | null): string {
  if (!platform) return 'Sin dato';
  return FACEBOOK_PLATFORM_LABELS[platform] ?? platform;
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

export function leadImportedToComercial(lead: Pick<FacebookLead, 'importedAsContactId' | 'importedAsCompanyId' | 'importedAsOpportunityId'>) {
  return !!(lead.importedAsContactId || lead.importedAsCompanyId || lead.importedAsOpportunityId);
}

export async function previewLeadImport(
  leadId: string,
  target: 'flota' | 'comercial',
  entity?: 'contacto' | 'empresa' | 'oportunidad',
): Promise<Record<string, string>> {
  const qs = new URLSearchParams({ target });
  if (entity) qs.set('entity', entity);
  return api<Record<string, string>>(
    `/facebook/leads/${encodeURIComponent(leadId)}/preview-import?${qs.toString()}`,
  );
}

export async function sendLeadToComercial(
  leadId: string,
  dto: {
    entityType: 'contacto' | 'empresa' | 'oportunidad';
    name?: string;
    telefono?: string;
    correo?: string;
    cargo?: string;
    notes?: string;
    ruc?: string;
    dominio?: string;
    distrito?: string;
    title?: string;
    amount?: string;
    etapa?: string;
    expectedCloseDate?: string;
    contactName?: string;
  },
): Promise<{ entityType: string; contactId?: string; companyId?: string; opportunityId?: string }> {
  return api(`/facebook/leads/${encodeURIComponent(leadId)}/send-to-comercial`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function sendLeadToFlota(
  leadId: string,
  dto: {
    nombreCompleto: string;
    celular: string;
    redSocial?: string;
    operador?: string;
    modalidad?: string;
    ciudad?: string;
    distrito?: string;
    edad?: string;
    anioVehiculo?: string;
    placa?: string;
    observaciones?: string;
  },
): Promise<{ flotaProspectoId: string }> {
  return api<{ flotaProspectoId: string }>(`/facebook/leads/${encodeURIComponent(leadId)}/send-to-flota`, {
    method: 'POST',
    body: JSON.stringify(dto),
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

// ─── Personal externo (Taxi Monterrico API) ───

export type ExternalClientRow = {
  idclienteempresa: number;
  razonsocial: string;
};

type ExternalApiResponse = {
  detalle: string;
  ARegistrados: ExternalClientRow[];
};

export type PersonalRow = {
  idpersonalempresa: number;
  nombres: string;
  apellidos: string;
  telefonoprincipal: string;
  empresa: string;
};

export async function fetchAllPersonal(agente: string): Promise<PersonalRow[]> {
  const clientsUrl = `https://api.taximonterrico.com/api/WClientes/Registrados?agente=${encodeURIComponent(agente)}&condicion=1`;
  const clientsRes = await fetch(clientsUrl);
  if (!clientsRes.ok) throw new Error('Error al obtener las empresas');
  const clientsData = (await clientsRes.json()) as ExternalApiResponse;
  const clients = clientsData.ARegistrados || [];

  const results = await Promise.allSettled(
    clients.map(async (client) => {
      const personalUrl = `https://api.taximonterrico.com/api/wpersonal/registrados?idcliente=${client.idclienteempresa}`;
      const personalRes = await fetch(personalUrl);
      if (!personalRes.ok) return [];
      const personalData = await personalRes.json() as { detalle?: string; ARegistrados?: any[] };
      const list = personalData.ARegistrados ?? [];
      return list.map((p: any) => ({
        idpersonalempresa: p.idpersonalempresa,
        nombres: p.nombres ?? '',
        apellidos: p.apellidos ?? '',
        telefonoprincipal: p.telefonoprincipal ?? '',
        empresa: client.razonsocial,
      }));
    }),
  );

  const all: PersonalRow[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }
  return all;
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
    webhookUrl: `${API_BASE}/api/webhooks/facebook`,
    campaigns: a.forms.map((f) => ({
      id: f.id,
      name: f.name,
      status: f.status as 'active' | 'inactive',
      leads: f.leadsCount,
    })),
  }));
}
