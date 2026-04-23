export type LeadSourceRow = { slug: string; name: string };

/**
 * Resuelve texto libre o variante de mayúsculas al `slug` canónico del catálogo.
 * Coincide por `slug` o por `name` (comparación sin distinguir mayúsculas).
 */
export function resolveLeadSourceSlug(
  input: string,
  catalog: LeadSourceRow[],
): string | null {
  const t = input.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  for (const r of catalog) {
    if (r.slug.toLowerCase() === lower) return r.slug;
    if (r.name.trim().toLowerCase() === lower) return r.slug;
  }
  return null;
}

/** Para reportes: unifica variantes; si no hay match, conserva el valor recortado. */
export function resolveLeadSourceKeyLoose(
  rawFuente: string,
  catalog: LeadSourceRow[],
): string {
  const trimmed = rawFuente.trim();
  if (!trimmed) return trimmed;
  return resolveLeadSourceSlug(trimmed, catalog) ?? trimmed;
}
