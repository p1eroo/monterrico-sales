/** True si hay al menos un valor numérico distinto de cero en las filas indicadas. */
export function chartHasAnyValue(
  rows: readonly Record<string, unknown>[],
  keys: string[],
): boolean {
  if (rows.length === 0) return false;
  return rows.some((row) =>
    keys.some((k) => {
      const v = row[k];
      return typeof v === 'number' && Number.isFinite(v) && v !== 0;
    }),
  );
}
