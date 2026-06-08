/**
 * Unifica valores de "cliente recuperado" a `si`, `no` o null.
 * Acepta mayúsculas/minúsculas, tilde en la i, y alias (yes/no, true/false, 1/0, etc.).
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

/** Import CSV: undefined = omitir el campo (mismo criterio que antes). */
export function normalizeClienteRecuperadoForCsv(
  raw: string | undefined,
): 'si' | 'no' | undefined {
  const v = normalizeClienteRecuperado(raw);
  return v ?? undefined;
}
