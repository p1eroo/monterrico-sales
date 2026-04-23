/**
 * Alineado con `mapApiRoleStringToUserRole` en el frontend:
 * usuarios listados en Equipo comercial = rol que mapea a `asesor`.
 */
const SUPERVISOR_LIKE_SLUGS = new Set([
  'supervisor',
  'gerente',
  'gerente_comercial',
  'jefe_comercial',
  'jefe_comercial_ventas',
  'director_comercial',
]);

export function isCommercialAdvisorRoleSlug(slug: string): boolean {
  const x = slug.trim().toLowerCase();
  if (x === 'admin' || x === 'solo_lectura' || x === 'solo lectura') {
    return false;
  }
  if (SUPERVISOR_LIKE_SLUGS.has(x)) return false;
  if (x.startsWith('jefe_')) return false;
  if (x.startsWith('gerente_')) return false;
  if (x.endsWith('_supervisor')) return false;
  if (x.includes('jefe_comercial')) return false;
  return true;
}
