import type {
  CompanyRubro,
  CompanyTipo,
  Contact,
  ContactSource,
  Etapa,
  LinkedCompany,
} from '@/types';
import { companyRubroLabels, etapaLabels } from '@/data/mock';
import { api } from '@/lib/api';
import { useUsersStore } from '@/store/usersStore';
import { isLikelyCompanyCuid } from './companyApi';
import type { ApiOpportunityListRow } from './opportunityApi';
import { mapApiOpportunityToOpportunity } from './opportunityApi';

export const isLikelyContactCuid = isLikelyCompanyCuid;

export type ApiCompanyInContact = {
  id: string;
  urlSlug?: string;
  name: string;
  razonSocial?: string | null;
  ruc?: string | null;
  telefono?: string | null;
  domain?: string | null;
  rubro?: string | null;
  tipo?: string | null;
};

export type ApiContactCompanyRow = {
  isPrimary: boolean;
  company: ApiCompanyInContact;
};

/** Contacto anidado (vínculos) con empresas cargadas */
export type ApiContactNested = {
  id: string;
  urlSlug: string;
  name: string;
  cargo?: string | null;
  telefono: string;
  correo: string;
  fuente: string;
  etapa: string;
  assignedTo?: string | null;
  estimatedValue: number;
  docType?: string | null;
  docNumber?: string | null;
  departamento?: string | null;
  provincia?: string | null;
  distrito?: string | null;
  direccion?: string | null;
  clienteRecuperado?: string | null;
  etapaHistory?: unknown;
  createdAt: string;
  companies?: ApiContactCompanyRow[];
};

export type ApiContactListRow = {
  id: string;
  urlSlug: string;
  name: string;
  cargo?: string | null;
  telefono: string;
  correo: string;
  fuente: string;
  etapa: string;
  assignedTo?: string | null;
  estimatedValue: number;
  docType?: string | null;
  docNumber?: string | null;
  departamento?: string | null;
  provincia?: string | null;
  distrito?: string | null;
  direccion?: string | null;
  clienteRecuperado?: string | null;
  etapaHistory?: unknown;
  createdAt: string;
  updatedAt: string;
  companies: ApiContactCompanyRow[];
  user?: { id: string; name: string } | null;
};

export type ApiContactDetail = ApiContactListRow & {
  contacts: { linked: ApiContactNested }[];
  linkedBy: { contact: ApiContactNested }[];
  opportunities: { opportunity: ApiOpportunityListRow & { contacts?: ApiOpportunityListRow['contacts'] } }[];
};

function parseRubro(s: string | null | undefined): CompanyRubro | undefined {
  if (!s) return undefined;
  return s in companyRubroLabels ? (s as CompanyRubro) : undefined;
}

function parseTipo(s: string | null | undefined): CompanyTipo | undefined {
  if (!s) return undefined;
  return s === 'A' || s === 'B' || s === 'C' ? s : undefined;
}

function parseEtapa(raw: string): Etapa {
  return raw in etapaLabels ? (raw as Etapa) : 'lead';
}

function parseSource(raw: string): ContactSource {
  const valid: ContactSource[] = ['referido', 'base', 'entorno', 'feria', 'masivo'];
  return valid.includes(raw as ContactSource) ? (raw as ContactSource) : 'base';
}

function mapCompanies(rows: ApiContactCompanyRow[] | undefined): LinkedCompany[] {
  if (!rows?.length) return [];
  return rows.map((r) => ({
    name: r.company.name,
    id: r.company.id,
    urlSlug: r.company.urlSlug,
    domain: r.company.domain ?? undefined,
    rubro: parseRubro(r.company.rubro),
    tipo: parseTipo(r.company.tipo),
    isPrimary: r.isPrimary,
  }));
}

function parseEtapaHistory(raw: unknown): Contact['etapaHistory'] {
  if (!Array.isArray(raw)) return undefined;
  const out: NonNullable<Contact['etapaHistory']> = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === 'object' &&
      'etapa' in item &&
      'fecha' in item &&
      typeof (item as { etapa: string }).etapa === 'string' &&
      typeof (item as { fecha: string }).fecha === 'string'
    ) {
      const et = (item as { etapa: string }).etapa;
      if (et in etapaLabels) {
        out.push({ etapa: et as Etapa, fecha: (item as { fecha: string }).fecha });
      }
    }
  }
  return out.length ? out : undefined;
}

function parseClienteRec(s: string | null | undefined): 'si' | 'no' | undefined {
  if (s === 'si' || s === 'no') return s;
  return undefined;
}

export function mapApiContactRowToContact(row: ApiContactListRow | ApiContactNested): Contact {
  const assignedId =
    (row as ApiContactListRow).user?.id ?? row.assignedTo ?? '';
  return {
    id: row.id,
    urlSlug: row.urlSlug,
    name: row.name,
    cargo: row.cargo ?? undefined,
    companies: mapCompanies(row.companies),
    telefono: row.telefono,
    correo: row.correo,
    fuente: parseSource(row.fuente),
    etapa: parseEtapa(row.etapa),
    assignedTo: assignedId,
    assignedToName:
      (row as ApiContactListRow).user?.name ??
      useUsersStore.getState().getUserName(assignedId),
    estimatedValue: row.estimatedValue,
    createdAt: row.createdAt.slice(0, 10),
    docType:
      row.docType === 'dni' || row.docType === 'cee' ? row.docType : undefined,
    docNumber: row.docNumber ?? undefined,
    departamento: row.departamento ?? undefined,
    provincia: row.provincia ?? undefined,
    distrito: row.distrito ?? undefined,
    direccion: row.direccion ?? undefined,
    clienteRecuperado: parseClienteRec(row.clienteRecuperado),
    etapaHistory: parseEtapaHistory(row.etapaHistory),
  };
}

export function mapApiContactDetailToContact(row: ApiContactDetail): Contact {
  const base = mapApiContactRowToContact(row);
  const linkedIds = linkedContactIdsFromDetail(row);
  return {
    ...base,
    linkedContactIds: linkedIds.length ? linkedIds : undefined,
  };
}

export function linkedContactIdsFromDetail(row: ApiContactDetail): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const l of row.contacts ?? []) {
    if (l.linked?.id && !seen.has(l.linked.id)) {
      seen.add(l.linked.id);
      ids.push(l.linked.id);
    }
  }
  for (const l of row.linkedBy ?? []) {
    if (l.contact?.id && !seen.has(l.contact.id)) {
      seen.add(l.contact.id);
      ids.push(l.contact.id);
    }
  }
  return ids;
}

/** Contactos vinculados listos para LinkedContactsCard */
export function linkedContactsFromApiDetail(row: ApiContactDetail): Contact[] {
  const out: Contact[] = [];
  const seen = new Set<string>();
  for (const l of row.contacts ?? []) {
    if (l.linked && !seen.has(l.linked.id)) {
      seen.add(l.linked.id);
      out.push(mapApiContactRowToContact(l.linked));
    }
  }
  for (const l of row.linkedBy ?? []) {
    if (l.contact && !seen.has(l.contact.id)) {
      seen.add(l.contact.id);
      out.push(mapApiContactRowToContact(l.contact));
    }
  }
  return out;
}

export function opportunitiesFromApiContactDetail(row: ApiContactDetail) {
  return (row.opportunities ?? []).map((co) =>
    mapApiOpportunityToOpportunity(co.opportunity as Parameters<typeof mapApiOpportunityToOpportunity>[0]),
  );
}

/** Empresa principal del contacto según el detalle devuelto por el API. */
export function primaryCompanyIdFromApiContact(
  row: Pick<ApiContactListRow, 'companies'> | Pick<ApiContactNested, 'companies'>,
): string | undefined {
  const list = row.companies;
  if (!list?.length) return undefined;
  const primary = list.find((c) => c.isPrimary);
  return (primary ?? list[0])?.company.id;
}

/** Crear contacto: POST /contacts */
export async function contactCreate(body: Record<string, unknown>): Promise<ApiContactDetail> {
  return api<ApiContactDetail>('/contacts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Actualizar contacto: PATCH /contacts/:id */
export async function contactUpdate(
  contactId: string,
  updates: { etapa?: string; assignedTo?: string; [key: string]: unknown },
): Promise<ApiContactDetail> {
  return api<ApiContactDetail>(`/contacts/${contactId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/** Vincular empresa a contacto: POST /contacts/:id/companies */
export async function contactAddCompany(
  contactId: string,
  companyId: string,
  isPrimary = false,
): Promise<ApiContactDetail> {
  return api<ApiContactDetail>(`/contacts/${contactId}/companies`, {
    method: 'POST',
    body: JSON.stringify({ companyId, isPrimary }),
  });
}

/** Desvincular empresa: DELETE /contacts/:id/companies/:companyId */
export async function contactRemoveCompany(
  contactId: string,
  companyId: string,
): Promise<ApiContactDetail> {
  return api<ApiContactDetail>(`/contacts/${contactId}/companies/${companyId}`, {
    method: 'DELETE',
  });
}

/** Vincular contacto a contacto: POST /contacts/:id/links */
export async function contactAddLinkedContact(
  contactId: string,
  linkedContactId: string,
): Promise<ApiContactDetail> {
  return api<ApiContactDetail>(`/contacts/${contactId}/links`, {
    method: 'POST',
    body: JSON.stringify({ linkedContactId }),
  });
}

/** Desvincular contacto: DELETE /contacts/:id/links/:linkedId */
export async function contactRemoveLinkedContact(
  contactId: string,
  linkedId: string,
): Promise<ApiContactDetail> {
  return api<ApiContactDetail>(`/contacts/${contactId}/links/${linkedId}`, {
    method: 'DELETE',
  });
}

/** Respuesta paginada de GET /contacts */
export type ContactListPaginatedResponse = {
  data: ApiContactListRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/** Listar contactos paginado: GET /contacts?page=&limit=&search=&etapa=&fuente=&assignedTo= */
export async function contactListPaginated(params?: {
  page?: number;
  limit?: number;
  search?: string;
  etapa?: string;
  fuente?: string;
  assignedTo?: string;
}): Promise<ContactListPaginatedResponse> {
  const sp = new URLSearchParams();
  if (params?.page != null) sp.set('page', String(params.page));
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.search?.trim()) sp.set('search', params.search.trim());
  if (params?.etapa?.trim()) sp.set('etapa', params.etapa.trim());
  if (params?.fuente?.trim()) sp.set('fuente', params.fuente.trim());
  if (params?.assignedTo?.trim()) sp.set('assignedTo', params.assignedTo.trim());
  const qs = sp.toString();
  const url = qs ? `/contacts?${qs}` : '/contacts';
  return api<ContactListPaginatedResponse>(url);
}

/** Conteos por etapa para pestañas del listado (mismos filtros que GET /contacts salvo etapa). */
export async function contactListEtapaCounts(params?: {
  search?: string;
  fuente?: string;
  assignedTo?: string;
}): Promise<{ counts: Record<string, number> }> {
  const sp = new URLSearchParams();
  if (params?.search?.trim()) sp.set('search', params.search.trim());
  if (params?.fuente?.trim()) sp.set('fuente', params.fuente.trim());
  if (params?.assignedTo?.trim()) sp.set('assignedTo', params.assignedTo.trim());
  const qs = sp.toString();
  return api<{ counts: Record<string, number> }>(
    qs ? `/contacts/etapa-counts?${qs}` : '/contacts/etapa-counts',
  );
}

/** Listar todos los contactos (hasta 5000) para Pipeline, Empresas, etc. */
export async function contactListAll(opts?: {
  etapa?: string;
  fuente?: string;
  assignedTo?: string;
}): Promise<ApiContactListRow[]> {
  const sp = new URLSearchParams();
  sp.set('limit', '5000');
  sp.set('page', '1');
  if (opts?.etapa?.trim()) sp.set('etapa', opts.etapa.trim());
  if (opts?.fuente?.trim()) sp.set('fuente', opts.fuente.trim());
  if (opts?.assignedTo?.trim()) sp.set('assignedTo', opts.assignedTo.trim());
  const res = await api<ContactListPaginatedResponse>(`/contacts?${sp.toString()}`);
  return res.data;
}
