/**
 * Interpreta fechas enviadas desde inputs type="date" (solo "YYYY-MM-DD").
 * Evita el desfase de `new Date("YYYY-MM-DD")` (medianoche UTC → día distinto en Perú).
 */
export function parseDateOnlyToUtcNoon(raw: string): Date {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map((x) => Number(x));
    if (
      !Number.isFinite(y) ||
      !Number.isFinite(m) ||
      !Number.isFinite(d) ||
      m < 1 ||
      m > 12 ||
      d < 1 ||
      d > 31
    ) {
      return new Date(NaN);
    }
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  }
  return new Date(s);
}
