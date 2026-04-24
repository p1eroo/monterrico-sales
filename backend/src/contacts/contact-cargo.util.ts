/**
 * Trata "0" (típico de CSV/Excel) como vacío.
 */
export function normalizeContactCargo(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const t = value.trim();
  if (t === '' || t === '0') return null;
  return t;
}
