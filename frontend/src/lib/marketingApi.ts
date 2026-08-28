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

export async function syncFacebookForms(accountId: string): Promise<{ forms: FacebookForm[]; removedForms: number }> {
  return api<{ forms: FacebookForm[]; removedForms: number }>(`/facebook/accounts/${encodeURIComponent(accountId)}/sync-forms`, {
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

export type BulkLeadSelectParams = {
  ids?: string[];
  selectAll?: boolean;
  formId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type BulkLeadImportColumn = { key: string; label: string };

export type BulkLeadImportPreviewRow = {
  leadId: string;
  row: number;
  ok: boolean;
  error?: string;
  columns: Record<string, string>;
};

export type BulkLeadImportPreview = {
  target: 'flota' | 'comercial';
  entity?: 'contacto' | 'empresa';
  columns: BulkLeadImportColumn[];
  rows: BulkLeadImportPreviewRow[];
  totalRows: number;
  okCount: number;
  errorCount: number;
  truncated?: boolean;
};

export type BulkLeadImportResult = {
  sent: number;
  skipped: number;
  failed: number;
  errors: { leadId: string; error: string }[];
  truncated?: boolean;
};

export async function previewBulkLeadImport(
  params: BulkLeadSelectParams & {
    target: 'flota' | 'comercial';
    entity?: 'contacto' | 'empresa';
  },
): Promise<BulkLeadImportPreview> {
  return api<BulkLeadImportPreview>('/facebook/leads/bulk-preview', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function sendBulkLeadImport(
  params: BulkLeadSelectParams & {
    target: 'flota' | 'comercial';
    entity?: 'contacto' | 'empresa';
  },
): Promise<BulkLeadImportResult> {
  return api<BulkLeadImportResult>('/facebook/leads/bulk-send', {
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

// ─── WhatsApp Cloud API (Marketing Masivo) ───

export interface WhatsAppCloudAccount {
  id: string;
  displayName: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  isDefault: boolean;
  active: boolean;
  templateCount: number;
  approvedCount: number;
  marketingCount: number;
  utilityCount: number;
  lastSyncedAt: string | null;
  graphApiVersion: string;
  hasToken: boolean;
}

export interface ConnectWhatsAppCloudDto {
  displayName: string;
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  graphApiVersion?: string;
  setAsDefault?: boolean;
}

export interface WhatsAppBulkRecipientResult {
  id: string;
  phone: string;
  name: string | null;
  company: string | null;
  source: string | null;
  status: string;
  metaMessageId: string | null;
  error: string | null;
  sentAt: string | null;
}

export interface WhatsAppEstimatedCost {
  billableCount: number;
  amountPen: number;
  ratePen: number;
  templateCategory: 'marketing' | 'utility' | 'authentication';
  currency: 'PEN';
}

export interface WhatsAppBulkCampaignSummary {
  id: string;
  name: string | null;
  status: string;
  total: number;
  sent: number;
  failed: number;
  createdAt: string;
  completedAt: string | null;
  startedAt: string | null;
  templateName: string;
  templateCategory: string;
  accountId: string;
  estimatedCost: WhatsAppEstimatedCost;
}

export interface WhatsAppBulkCampaign {
  id: string;
  name: string | null;
  status: string;
  total: number;
  sent: number;
  failed: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  accountId: string;
  templateId: string;
  templateName: string;
  templateCategory: string;
  estimatedCost: WhatsAppEstimatedCost;
  variableMapping: Record<string, string>;
  recipients: WhatsAppBulkRecipientResult[];
}

export interface CreateWhatsAppCampaignDto {
  accountId: string;
  templateId: string;
  variableMapping: Record<string, string>;
  recipients: Array<{
    phone: string;
    name?: string;
    company?: string;
    source?: string;
    /** Prospecto Flota: al enviar OK se marca como contactado. */
    flotaProspectoId?: string;
  }>;
  name?: string;
}

export async function connectWhatsAppCloud(dto: ConnectWhatsAppCloudDto): Promise<WhatsAppCloudAccount> {
  return api<WhatsAppCloudAccount>('/whatsapp-cloud/connect', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function testWhatsAppCloudConnection(
  dto: Pick<ConnectWhatsAppCloudDto, 'wabaId' | 'accessToken' | 'graphApiVersion'>,
): Promise<{ ok: true; templateCount: number; approvedCount: number }> {
  return api<{ ok: true; templateCount: number; approvedCount: number }>('/whatsapp-cloud/test-connection', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function testWhatsAppCloudAccount(id: string): Promise<{ ok: true; templateCount: number; approvedCount: number }> {
  return api<{ ok: true; templateCount: number; approvedCount: number }>(
    `/whatsapp-cloud/accounts/${encodeURIComponent(id)}/test-connection`,
    { method: 'POST' },
  );
}

export async function fetchWhatsAppCloudAccounts(): Promise<WhatsAppCloudAccount[]> {
  return api<WhatsAppCloudAccount[]>('/whatsapp-cloud/accounts');
}

export async function disconnectWhatsAppCloud(id: string): Promise<{ disconnected: boolean }> {
  return api<{ disconnected: boolean }>(`/whatsapp-cloud/accounts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function updateWhatsAppCloudToken(id: string, accessToken: string): Promise<{ updated: boolean }> {
  return api<{ updated: boolean }>(`/whatsapp-cloud/accounts/${encodeURIComponent(id)}/token`, {
    method: 'PATCH',
    body: JSON.stringify({ accessToken }),
  });
}

/** Canal usado en WhatsApp Masivo (preferencia local; el predeterminado del servidor gana al cargar). */
export const WHATSAPP_ACTIVE_CHANNEL_KEY = 'marketing_whatsapp_active_channel_v1';

export function setWhatsAppActiveChannelId(accountId: string) {
  localStorage.setItem(WHATSAPP_ACTIVE_CHANNEL_KEY, accountId);
}

export async function setDefaultWhatsAppCloudAccount(id: string): Promise<WhatsAppCloudAccount[]> {
  const accounts = await api<WhatsAppCloudAccount[]>(
    `/whatsapp-cloud/accounts/${encodeURIComponent(id)}/default`,
    { method: 'POST' },
  );
  setWhatsAppActiveChannelId(id);
  return accounts;
}

export async function syncWhatsAppCloudTemplates(accountId: string): Promise<import('@/pages/marketing/whatsapp/mockData').WhatsAppTemplate[]> {
  return api<import('@/pages/marketing/whatsapp/mockData').WhatsAppTemplate[]>(
    `/whatsapp-cloud/accounts/${encodeURIComponent(accountId)}/sync-templates`,
    { method: 'POST' },
  );
}

export async function fetchWhatsAppCloudTemplates(
  accountId: string,
): Promise<import('@/pages/marketing/whatsapp/mockData').WhatsAppTemplate[]> {
  return api<import('@/pages/marketing/whatsapp/mockData').WhatsAppTemplate[]>(
    `/whatsapp-cloud/templates?accountId=${encodeURIComponent(accountId)}`,
  );
}

export async function updateWhatsAppTemplateDailyLimit(
  templateId: string,
  dailySendLimit: number | null,
): Promise<import('@/pages/marketing/whatsapp/mockData').WhatsAppTemplate> {
  return api<import('@/pages/marketing/whatsapp/mockData').WhatsAppTemplate>(
    `/whatsapp-cloud/templates/${encodeURIComponent(templateId)}/daily-limit`,
    {
      method: 'PATCH',
      body: JSON.stringify({ dailySendLimit }),
    },
  );
}

export async function fetchWhatsAppBulkCampaigns(
  accountId?: string,
): Promise<WhatsAppBulkCampaignSummary[]> {
  const qs = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
  return api<WhatsAppBulkCampaignSummary[]>(`/whatsapp-cloud/campaigns${qs}`);
}

export async function createWhatsAppBulkCampaign(dto: CreateWhatsAppCampaignDto): Promise<WhatsAppBulkCampaign> {
  return api<WhatsAppBulkCampaign>('/whatsapp-cloud/campaigns', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function sendWhatsAppBulkCampaign(campaignId: string): Promise<WhatsAppBulkCampaign> {
  return api<WhatsAppBulkCampaign>(`/whatsapp-cloud/campaigns/${encodeURIComponent(campaignId)}/send`, {
    method: 'POST',
  });
}

export async function fetchWhatsAppBulkCampaign(campaignId: string): Promise<WhatsAppBulkCampaign> {
  return api<WhatsAppBulkCampaign>(`/whatsapp-cloud/campaigns/${encodeURIComponent(campaignId)}`);
}

export type MarketingLeadsByWeekRow = {
  date: string;
  leads: number;
  contactados: number;
};

/** Marketing: leads y contactados por semana (flota + comercial). */
export async function fetchMarketingLeadsByWeek(
  weeks = 8,
): Promise<{ weeks: MarketingLeadsByWeekRow[] }> {
  return api<{ weeks: MarketingLeadsByWeekRow[] }>(
    `/analytics/marketing/leads-by-week?weeks=${weeks}`,
  );
}

export function formatRelativeSync(iso: string | null): string {
  if (!iso) return 'Nunca';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}
