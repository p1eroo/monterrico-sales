import {
  endOfWeekSundayLima,
  startOfWeekMondayLima,
} from '../common/crm-timezone.util';
import {
  callOutcomeGroupFromResult,
  parseCallResultFromDescription,
  type CallOutcomeGroup,
} from './call-result.util';

export type CallGoalKind = 'meta' | 'seguimiento' | 'no_contacto';

export type CompanyEtapaAudit = {
  at: Date;
  oldSlug: string;
  newSlug: string;
};

export type CompanyContactGoalContext = {
  id: string;
  createdAt: Date;
  etapaFn: (instant: Date) => string;
  audits: CompanyEtapaAudit[];
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function addLimaWeeks(monday: Date, weeks: number): Date {
  return new Date(monday.getTime() + weeks * WEEK_MS);
}

export function callGoalKindLabel(kind: CallGoalKind): string {
  if (kind === 'meta') return 'Contacto';
  if (kind === 'seguimiento') return 'Seguimiento';
  return 'No contacto';
}

export function isCompanyEligibleForContactGoal(
  company: CompanyContactGoalContext,
  activityCompletedAt: Date,
  getProb: (slug: string) => number,
  minProspectProbability = 10,
): boolean {
  const activityWeekMonday = startOfWeekMondayLima(activityCompletedAt);
  const prevWeekMonday = addLimaWeeks(activityWeekMonday, -1);
  const prevWeekEnd = endOfWeekSundayLima(prevWeekMonday);
  const activityWeekEnd = endOfWeekSundayLima(activityWeekMonday);

  if (company.createdAt <= prevWeekEnd) {
    const probAtPrevClose = getProb(company.etapaFn(prevWeekEnd));
    if (probAtPrevClose < minProspectProbability) return true;
  }

  const clipStart = activityWeekMonday;
  const clipEnd = activityWeekEnd;

  const createdInWeek =
    company.createdAt >= clipStart && company.createdAt <= clipEnd;
  if (createdInWeek) {
    const probAtCreate = getProb(company.etapaFn(company.createdAt));
    if (probAtCreate < minProspectProbability) return true;
  }

  const promoted = company.audits.some(
    (audit) =>
      audit.at >= clipStart &&
      audit.at <= clipEnd &&
      getProb(audit.oldSlug) < minProspectProbability &&
      getProb(audit.newSlug) >= minProspectProbability,
  );
  return promoted;
}

export function classifyCallGoalKind(
  completedAt: Date,
  callResult: string | null | undefined,
  companies: CompanyContactGoalContext[],
  getProb: (slug: string) => number,
  minProspectProbability = 10,
): CallGoalKind {
  const outcome: CallOutcomeGroup = callOutcomeGroupFromResult(callResult);
  if (outcome !== 'contacto') return 'no_contacto';
  if (companies.length === 0) return 'seguimiento';
  const eligible = companies.some((company) =>
    isCompanyEligibleForContactGoal(
      company,
      completedAt,
      getProb,
      minProspectProbability,
    ),
  );
  return eligible ? 'meta' : 'seguimiento';
}

export function activityCountKeyWithContactGoalRules(
  type: string | null | undefined,
  description: string | null | undefined,
  completedAt: Date,
  companyIds: string[],
  companyById: Map<string, CompanyContactGoalContext>,
  getProb: (slug: string) => number,
  minProspectProbability = 10,
):
  | 'llamadas_contacto'
  | 'llamadas_seguimiento'
  | 'llamadas_no_contacto'
  | 'reuniones'
  | 'correos'
  | null {
  const t = type?.toLowerCase().trim() ?? '';
  if (t === 'llamada') {
    const result = parseCallResultFromDescription(description);
    const companies = companyIds
      .map((id) => companyById.get(id))
      .filter((c): c is CompanyContactGoalContext => Boolean(c));
    const kind = classifyCallGoalKind(
      completedAt,
      result,
      companies,
      getProb,
      minProspectProbability,
    );
    if (kind === 'meta') return 'llamadas_contacto';
    if (kind === 'seguimiento') return 'llamadas_seguimiento';
    return 'llamadas_no_contacto';
  }
  if (t === 'reunion' || t === 'reunión') return 'reuniones';
  if (t === 'correo') return 'correos';
  return null;
}
