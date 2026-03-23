import type {
  Contact,
  ContactPriority,
  ContactSource,
  Etapa,
  Opportunity,
  OpportunityStatus,
} from '@/types';
import { etapaLabels, users } from '@/data/mock';

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
  assignedTo: string | null;
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
  const assignedId = row.assignedTo ?? '';
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
      users.find((u) => u.id === assignedId)?.name ??
      'Sin asignar',
    createdAt: row.createdAt.slice(0, 10),
  };
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
    assignedToName: users.find((u) => u.id === assignedTo)?.name ?? 'Sin asignar',
    estimatedValue: c.estimatedValue,
    createdAt: c.createdAt.slice(0, 10),
    nextAction: c.nextAction ?? '',
    nextFollowUp: c.nextFollowUp ? c.nextFollowUp.slice(0, 10) : '',
    notes: c.notes ?? undefined,
  };
}
