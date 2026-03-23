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
  name: string;
  cargo?: string | null;
  phone: string;
  email: string;
  source: string;
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

export function mapApiOpportunityToOpportunity(
  row: ApiOpportunityListRow | ApiOpportunityDetail,
): Opportunity {
  const first = row.contacts?.[0]?.contact;
  const close = row.expectedCloseDate
    ? row.expectedCloseDate.slice(0, 10)
    : '';
  const assignedId =
    row.user?.id ?? (row as ApiOpportunityListRow).assignedTo ?? '';
  return {
    id: row.id,
    title: row.title,
    contactId: first?.id,
    contactName: first?.name,
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
    name: c.name,
    cargo: c.cargo ?? undefined,
    companies: [],
    phone: c.phone,
    email: c.email,
    source: (c.source as ContactSource) || 'base',
    etapa: parseEtapa(c.etapa),
    assignedTo,
    assignedToName: useUsersStore.getState().getUserName(assignedTo),
    estimatedValue: c.estimatedValue,
    createdAt: c.createdAt.slice(0, 10),
    nextAction: c.nextAction ?? '',
    nextFollowUp: c.nextFollowUp ? c.nextFollowUp.slice(0, 10) : '',
    notes: c.notes ?? undefined,
  };
}
