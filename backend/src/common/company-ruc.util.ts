/** RUC en BD: trim + espacios Unicode; sin validar dígitos ni unicidad. */
export function storeCompanyRucValue(ruc?: string | null): string | null {
  if (ruc == null) return null;
  const t = String(ruc).replace(/\u00a0/g, ' ').trim();
  return t.length > 0 ? t : null;
}

/** Solo dígitos (consulta SUNAT / búsqueda flexible). */
export function companyRucDigits(ruc?: string | null): string {
  return (storeCompanyRucValue(ruc) ?? '').replace(/\D/g, '');
}
