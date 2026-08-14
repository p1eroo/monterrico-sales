import {
  endOfWeekSundayLima,
  startOfWeekMondayLima,
} from '../common/crm-timezone.util';
import {
  callOutcomeGroupFromResult,
  callResultDetailLabel,
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

/** Etiqueta de métricas (filtros / toast al registrar llamada). */
export function callGoalKindMetricLabel(kind: CallGoalKind): string {
  if (kind === 'meta') return 'Cuentan para meta';
  if (kind === 'seguimiento') return 'Seguimiento';
  return 'No contacto';
}

export type CallGoalExplanation = {
  kind: CallGoalKind;
  label: string;
  reason: string;
};

export function explainCompanyContactGoalEligibility(
  company: CompanyContactGoalContext,
  activityCompletedAt: Date,
  getProb: (slug: string) => number,
  minProspectProbability = 10,
): { eligible: boolean; reason: string } {
  const activityWeekMonday = startOfWeekMondayLima(activityCompletedAt);
  const prevWeekMonday = addLimaWeeks(activityWeekMonday, -1);
  const prevWeekEnd = endOfWeekSundayLima(prevWeekMonday);
  const activityWeekEnd = endOfWeekSundayLima(activityWeekMonday);

  if (company.createdAt <= prevWeekEnd) {
    const probAtPrevClose = getProb(company.etapaFn(prevWeekEnd));
    if (probAtPrevClose < minProspectProbability) {
      return {
        eligible: true,
        reason:
          'Al cierre de la semana pasada la empresa seguía en lead (menos de 10 % de probabilidad).',
      };
    }
  }

  const clipStart = activityWeekMonday;
  const clipEnd = activityWeekEnd;

  const createdInWeek =
    company.createdAt >= clipStart && company.createdAt <= clipEnd;
  // Alta de esta semana: Lead (<10 %) o nuevo ingreso (≥10 %, cualquier etapa).
  if (createdInWeek) {
    return {
      eligible: true,
      reason: 'La empresa es un ingreso de esta semana.',
    };
  }

  const promoted = company.audits.some(
    (audit) =>
      audit.at >= clipStart &&
      audit.at <= clipEnd &&
      getProb(audit.oldSlug) < minProspectProbability &&
      getProb(audit.newSlug) >= minProspectProbability,
  );
  if (promoted) {
    return {
      eligible: true,
      reason: 'Esta semana la empresa pasó de lead a prospecto.',
    };
  }
  return {
    eligible: false,
    reason:
      'No es ingreso de esta semana ni un lead que entre a la meta: ya venía como prospecto o cliente de semanas anteriores.',
  };
}

export function isCompanyEligibleForContactGoal(
  company: CompanyContactGoalContext,
  activityCompletedAt: Date,
  getProb: (slug: string) => number,
  minProspectProbability = 10,
): boolean {
  return explainCompanyContactGoalEligibility(
    company,
    activityCompletedAt,
    getProb,
    minProspectProbability,
  ).eligible;
}

export function explainCallGoalKind(
  completedAt: Date,
  callResult: string | null | undefined,
  companies: CompanyContactGoalContext[],
  getProb: (slug: string) => number,
  minProspectProbability = 10,
): CallGoalExplanation {
  const kind = classifyCallGoalKind(
    completedAt,
    callResult,
    companies,
    getProb,
    minProspectProbability,
  );
  const label = callGoalKindMetricLabel(kind);
  const outcome: CallOutcomeGroup = callOutcomeGroupFromResult(callResult);
  if (outcome !== 'contacto') {
    const detail = callResultDetailLabel(callResult);
    return {
      kind,
      label,
      reason: detail
        ? `El resultado es «${detail}», no Contactado.`
        : 'No se eligió resultado Contactado, así que no cuenta como contacto.',
    };
  }
  if (companies.length === 0) {
    return {
      kind,
      label,
      reason:
        'Quedó como Contactado, pero no hay empresa comercial vinculada, así que cuenta como seguimiento.',
    };
  }
  const eligible = companies
    .map((company) =>
      explainCompanyContactGoalEligibility(
        company,
        completedAt,
        getProb,
        minProspectProbability,
      ),
    )
    .find((item) => item.eligible);
  if (eligible) {
    return { kind, label, reason: eligible.reason };
  }
  return {
    kind,
    label,
    reason: explainCompanyContactGoalEligibility(
      companies[0],
      completedAt,
      getProb,
      minProspectProbability,
    ).reason,
  };
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
