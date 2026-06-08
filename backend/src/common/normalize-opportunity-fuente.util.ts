const VALID_FUENTE = new Set([
  'referido',
  'base',
  'entorno',
  'feria',
  'masivo',
]);

/** Slug de fuente comercial alineado con Contact / Company / catálogo CRM. */
export function normalizeOpportunityFuente(raw?: string | null): string {
  const v = raw?.trim().toLowerCase() ?? '';
  return VALID_FUENTE.has(v) ? v : 'base';
}
