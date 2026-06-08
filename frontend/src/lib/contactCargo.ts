/** Alineado con backend: "0" en import/Excel se trata como sin cargo. */
export function optionalContactCargoFromApi(
  value: string | null | undefined,
): string | undefined {
  if (value == null) return undefined;
  const t = value.trim();
  if (t === '' || t === '0') return undefined;
  return t;
}
