import { resolveLeadSourceSlug } from '../crm-config/lead-source-normalize.util';
import type { LeadSourceRow } from '../crm-config/lead-source-normalize.util';

/**
 * Normaliza fuente de oportunidad contra el catálogo CRM.
 * Preferir `CrmConfigService.normalizeLeadSource` en servicios inyectables.
 */
export function normalizeOpportunityFuenteWithCatalog(
  raw: string | null | undefined,
  catalog: LeadSourceRow[],
  fallback = 'base',
): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return fallback;
  return resolveLeadSourceSlug(trimmed, catalog) ?? fallback;
}
