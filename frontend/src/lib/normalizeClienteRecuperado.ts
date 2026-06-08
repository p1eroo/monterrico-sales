/**
 * Igual criterio que `backend/src/common/normalize-cliente-recuperado.ts`
 * (mantener alineados si cambia la regla).
 */
export function normalizeClienteRecuperado(
  raw: string | null | undefined,
): 'si' | 'no' | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  const n = t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (['si', 's', 'yes', 'y', '1', 'true', 'verdadero'].includes(n)) {
    return 'si';
  }
  if (['no', 'n', '0', 'false', 'falso', 'falsa'].includes(n)) {
    return 'no';
  }
  return null;
}
