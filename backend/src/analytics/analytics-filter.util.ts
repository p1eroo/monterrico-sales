import { Prisma } from '../generated/prisma';
import {
  applySimpleAdvisorFilter,
  companyAdvisorWhere,
  parseAdvisorFilterQuery,
  type ParsedAdvisorFilter,
} from '../common/advisor-filter.util';

export type AnalyticsScopeFilters = {
  assignedTo?: string;
  excludeAssignedTo?: string;
  /** CSV de IDs de asesores activos (para token __others__) */
  advisorPool?: string;
  sources: string[];
};

export function parseAnalyticsAdvisorFilter(
  filters: Pick<
    AnalyticsScopeFilters,
    'assignedTo' | 'excludeAssignedTo' | 'advisorPool'
  >,
): ParsedAdvisorFilter {
  return parseAdvisorFilterQuery({
    assignedTo: filters.assignedTo,
    excludeAssignedTo: filters.excludeAssignedTo,
    advisorPool: filters.advisorPool,
  });
}

export function applyAdvisorFilter(
  w: PortfolioEntityWhere,
  filters: Pick<
    AnalyticsScopeFilters,
    'assignedTo' | 'excludeAssignedTo' | 'advisorPool'
  >,
): void {
  applySimpleAdvisorFilter(w, parseAnalyticsAdvisorFilter(filters));
}

/** Filtro de asesor contact-aware para empresas (listados / analytics de cartera). */
export function applyCompanyAdvisorFilter(
  w: Prisma.CompanyWhereInput,
  filters: Pick<
    AnalyticsScopeFilters,
    'assignedTo' | 'excludeAssignedTo' | 'advisorPool'
  >,
): void {
  const clause = companyAdvisorWhere(parseAnalyticsAdvisorFilter(filters));
  if (!clause) return;
  const existingAnd = Array.isArray(w.AND)
    ? w.AND
    : w.AND
      ? [w.AND]
      : [];
  w.AND = [...existingAnd, clause];
}

type PortfolioEntityWhere =
  | Prisma.ContactWhereInput
  | Prisma.CompanyWhereInput
  | Prisma.OpportunityWhereInput;

export function applyActivityAdvisorFilter(
  w: Prisma.ActivityWhereInput,
  filters: Pick<
    AnalyticsScopeFilters,
    'assignedTo' | 'excludeAssignedTo' | 'advisorPool'
  >,
): void {
  applySimpleAdvisorFilter(w, parseAnalyticsAdvisorFilter(filters));
}

export function applySourceFilter(
  w: PortfolioEntityWhere,
  sources: string[],
): void {
  if (sources.length === 0) return;

  const wantsUnassigned = sources.some((s) => s.trim() === '__sin_fuente__');
  const catalog = sources.filter((s) => s.trim() !== '__sin_fuente__');
  const orParts: PortfolioEntityWhere[] = [];

  if (wantsUnassigned) {
    orParts.push({
      OR: [{ fuente: null }, { fuente: '' }],
    } as PortfolioEntityWhere);
  }

  if (catalog.length > 0) {
    const target = {} as {
      fuente?: Prisma.StringFilter | Prisma.StringNullableFilter;
    };
    if (catalog.length === 1) {
      target.fuente = { equals: catalog[0], mode: 'insensitive' };
    } else {
      target.fuente = { in: catalog, mode: 'insensitive' };
    }
    orParts.push(target as PortfolioEntityWhere);
  }

  if (orParts.length === 0) return;
  if (orParts.length === 1) {
    Object.assign(w, orParts[0]);
    return;
  }

  const clause = { OR: orParts } as PortfolioEntityWhere;
  const existingAnd = Array.isArray(w.AND)
    ? w.AND
    : w.AND
      ? [w.AND]
      : [];
  w.AND = [...existingAnd, clause] as typeof w.AND;
}

export function advisorWhereFromFilters(
  filters: AnalyticsScopeFilters,
): Prisma.OpportunityWhereInput {
  const w: Prisma.OpportunityWhereInput = {};
  applyAdvisorFilter(w, filters);
  return w;
}

export function performanceGroupByWhere(
  from: Date,
  to: Date,
  filters: AnalyticsScopeFilters,
): Prisma.ContactWhereInput {
  const w: Prisma.ContactWhereInput = {
    createdAt: { gte: from, lte: to },
  };
  if (
    filters.assignedTo?.trim() ||
    filters.excludeAssignedTo?.trim()
  ) {
    applyAdvisorFilter(w, filters);
  } else {
    w.assignedTo = { not: null };
  }
  return w;
}

/** Meta mensual por asesor solo cuando hay un único asesor incluido explícitamente. */
export function singleAdvisorIdForMeta(
  filters: AnalyticsScopeFilters,
): string | undefined {
  const parsed = parseAnalyticsAdvisorFilter(filters);
  if (parsed.unrestricted || parsed.matchNone || parsed.legacyExcludeIds) {
    return undefined;
  }
  if (parsed.includeUnassigned || parsed.includeOthers) return undefined;
  return parsed.userIds.length === 1 ? parsed.userIds[0] : undefined;
}
