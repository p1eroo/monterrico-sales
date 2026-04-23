import type {
  Contact,
  ContactPriority,
  ContactSource,
  Etapa,
  Opportunity,
  OpportunityStatus,
} from '@/types';
import { etapaLabels } from '@/data/mock';
import { useUsersStore } from '@/store/usersStore';
import { api } from '@/lib/api';

/** Misma heurística que empresas (cuid Prisma) */
export function isLikelyOpportunityCuid(value: string): boolean {
  const v = value.trim();
  if (v.length < 20 || v.length > 32) return false;
  return /^c[a-z0-9]+$/i.test(v);
}

export type ApiContactFromOpportunity = {
  id: string;
  urlSlug?: string;
  name: string;
  cargo?: string | null;
  telefono: string;
  correo: string;
  fuente: string;
  etapa: string;
  priority?: string | null;
  assignedTo?: string | null;
  estimatedValue: number;
  nextAction?: string | null;
  nextFollowUp?: string | null;
  notes?: string | null;
  createdAt: string;
};

export type ApiOpportunityListRow = {
  id: string;
  urlSlug: string;
  title: string;
  amount: number;
  probability: number;
  etapa: string;
  status: string;
  priority?: string | null;
  expectedCloseDate: string | null;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string } | null;
  contacts?: { contact: { id: string; name: string } }[];
  companies?: { company: { id: string; name: string } }[];
};

export type ApiOpportunityDetail = ApiOpportunityListRow & {
  contacts: { contact: ApiContactFromOpportunity }[];
  companies: { company: { id: string; name: string } }[];
};

function parseEtapa(raw: string): Etapa {
  return raw in etapaLabels ? (raw as Etapa) : 'lead';
}

function parseStatus(raw: string): OpportunityStatus {
  if (raw === 'abierta' || raw === 'ganada' || raw === 'perdida' || raw === 'suspendida') {
    return raw;
  }
  return 'abierta';
}

function parseOpportunityPriority(raw: string | null | undefined): ContactPriority {
  const p = raw?.trim().toLowerCase();
  if (p === 'alta' || p === 'media' || p === 'baja') {
    return p;
  }
  return 'media';
}

function parseFuente(raw: string | null | undefined): ContactSource {
  const valid: ContactSource[] = ['referido', 'base', 'entorno', 'feria', 'masivo'];
  const v = raw?.trim() ?? '';
  return valid.includes(v as ContactSource) ? (v as ContactSource) : 'base';
}

export function mapApiOpportunityToOpportunity(
  row: ApiOpportunityListRow | ApiOpportunityDetail,
): Opportunity {
  const first = row.contacts?.[0]?.contact;
  const companyRows = row.companies ?? [];
  const firstCompany = companyRows[0]?.company;
  const linkedCompanyIds = companyRows
    .map((c) => c.company?.id)
    .filter((id): id is string => !!id);
  const close = row.expectedCloseDate
    ? row.expectedCloseDate.slice(0, 10)
    : '';
  const assignedId =
    row.user?.id ?? (row as ApiOpportunityListRow).assignedTo ?? '';
  return {
    id: row.id,
    urlSlug: row.urlSlug,
    title: row.title,
    contactId: first?.id,
    contactName: first?.name,
    clientId: firstCompany?.id,
    clientName: firstCompany?.name,
    linkedCompanyIds: linkedCompanyIds.length ? linkedCompanyIds : undefined,
    amount: row.amount,
    probability: row.probability,
    etapa: parseEtapa(row.etapa),
    status: parseStatus(row.status),
    priority: parseOpportunityPriority(row.priority),
    expectedCloseDate: close,
    assignedTo: assignedId,
    assignedToName:
      row.user?.name ??
      useUsersStore.getState().getUserName(assignedId),
    createdAt: row.createdAt.slice(0, 10),
    fuente: parseFuente((first as ApiContactFromOpportunity | undefined)?.fuente),
  };
}

/** Respuesta paginada de GET /opportunities */
export type OpportunityListPaginatedResponse = {
  data: ApiOpportunityListRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/** Listar oportunidades paginado */
export async function opportunityListPaginated(params?: {
  page?: number;
  limit?: number;
  search?: string;
  etapa?: string;
  status?: string;
  assignedTo?: string;
}): Promise<OpportunityListPaginatedResponse> {
  const sp = new URLSearchParams();
  if (params?.page != null) sp.set('page', String(params.page));
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.search?.trim()) sp.set('search', params.search.trim());
  if (params?.etapa?.trim()) sp.set('etapa', params.etapa.trim());
  if (params?.status?.trim()) sp.set('status', params.status.trim());
  if (params?.assignedTo?.trim()) sp.set('assignedTo', params.assignedTo.trim());
  const qs = sp.toString();
  const url = qs ? `/opportunities?${qs}` : '/opportunities';
  return api<OpportunityListPaginatedResponse>(url);
}

/** Listar todas las oportunidades (hasta 5000) */
export async function opportunityListAll(opts?: {
  etapa?: string;
  status?: string;
  assignedTo?: string;
}): Promise<ApiOpportunityListRow[]> {
  const sp = new URLSearchParams();
  sp.set('limit', '5000');
  sp.set('page', '1');
  if (opts?.etapa?.trim()) sp.set('etapa', opts.etapa.trim());
  if (opts?.status?.trim()) sp.set('status', opts.status.trim());
  if (opts?.assignedTo?.trim()) sp.set('assignedTo', opts.assignedTo.trim());
  const res = await api<OpportunityListPaginatedResponse>(
    `/opportunities?${sp.toString()}`,
  );
  return res.data;
}

export function mapApiContactToContact(c: ApiContactFromOpportunity): Contact {
  const assignedTo = c.assignedTo ?? '';
  return {
    id: c.id,
    urlSlug: c.urlSlug,
    name: c.name,
    cargo: c.cargo ?? undefined,
    companies: [],
    telefono: c.telefono,
    correo: c.correo,
    fuente: (c.fuente as ContactSource) || 'base',
    etapa: parseEtapa(c.etapa),
    assignedTo,
    assignedToName: useUsersStore.getState().getUserName(assignedTo),
    estimatedValue: c.estimatedValue,
    createdAt: c.createdAt.slice(0, 10),
  };
}
