import type { Opportunity } from '@/types';

export function sortOpportunitiesByPriority(opportunities: Opportunity[]): Opportunity[] {
  return [...opportunities].sort((a, b) => {
    const pa = a.probability ?? 0;
    const pb = b.probability ?? 0;
    if (pb !== pa) return pb - pa;
    const amta = Number(a.amount) || 0;
    const amtb = Number(b.amount) || 0;
    if (amtb !== amta) return amtb - amta;
    return a.id.localeCompare(b.id);
  });
}

export function getHighestPriorityOpportunity(opportunities: Opportunity[]): Opportunity | undefined {
  return sortOpportunitiesByPriority(opportunities)[0];
}

export function getHighestPriorityOpportunityEtapa(opportunities: Opportunity[]): string | undefined {
  return getHighestPriorityOpportunity(opportunities)?.etapa;
}
