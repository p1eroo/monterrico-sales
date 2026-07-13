/** Zona horaria del CRM (Perú, sin horario de verano). */
export const CRM_TIMEZONE = 'America/Lima' as const;

/** Offset fijo UTC−5 (sin DST). */
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;

export type LimaDateParts = {
  year: number;
  /** 0-indexed (enero = 0). */
  month: number;
  day: number;
  /** 0 = domingo … 6 = sábado en calendario Lima. */
  weekday: number;
};

/** Partes de calendario Lima para un instante UTC. */
export function instantToLimaParts(d: Date): LimaDateParts {
  const t = new Date(d.getTime() - LIMA_OFFSET_MS);
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth(),
    day: t.getUTCDate(),
    weekday: t.getUTCDay(),
  };
}

/** Medianoche Lima del día calendario (month 0-indexed). */
export function limaDayStart(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 5, 0, 0, 0));
}

export function parseDayStartLima(isoDate: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error('from/to debe ser YYYY-MM-DD');
  }
  const [y, m, d] = isoDate.split('-').map(Number);
  return limaDayStart(y, m - 1, d);
}

export function parseDayEndLima(isoDate: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error('from/to debe ser YYYY-MM-DD');
  }
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, 4, 59, 59, 999));
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function limaYmdFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Inicio de día Lima desde YYYY-MM-DD o ISO (legacy). */
export function parseDateFilterStartLima(raw?: string | null): Date | null {
  const t = raw?.trim();
  if (!t) return null;
  if (YMD_RE.test(t)) {
    try {
      return parseDayStartLima(t);
    } catch {
      return null;
    }
  }
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  const { year, month, day } = instantToLimaParts(d);
  return limaDayStart(year, month, day);
}

/** Fin de día Lima desde YYYY-MM-DD o ISO (legacy). */
export function parseDateFilterEndLima(raw?: string | null): Date | null {
  const t = raw?.trim();
  if (!t) return null;
  if (YMD_RE.test(t)) {
    try {
      return parseDayEndLima(t);
    } catch {
      return null;
    }
  }
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  const { year, month, day } = instantToLimaParts(d);
  try {
    return parseDayEndLima(limaYmdFromParts(year, month, day));
  } catch {
    return null;
  }
}

/** Rango inclusivo 00:00–23:59:59.999 Lima; requiere ambos extremos. */
export function resolveLimaDayRange(
  fromRaw?: string | null,
  toRaw?: string | null,
): { from: Date; to: Date } | null {
  const from = parseDateFilterStartLima(fromRaw);
  const to = parseDateFilterEndLima(toRaw);
  if (!from || !to) return null;
  return { from, to };
}

/** Lunes 00:00 Lima de la semana que contiene `d`. */
export function startOfWeekMondayLima(d: Date): Date {
  const { year, month, day, weekday } = instantToLimaParts(d);
  const diff = weekday === 0 ? 6 : weekday - 1;
  return limaDayStart(year, month, day - diff);
}

/** Domingo 23:59:59.999 Lima de la semana que contiene `d`. */
export function endOfWeekSundayLima(d: Date): Date {
  const monday = startOfWeekMondayLima(d);
  return new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
}

/** Semana ISO (1–53) según calendario Lima. */
export function isoWeekNumberLima(d: Date): number {
  const { year, month, day } = instantToLimaParts(d);
  const x = new Date(Date.UTC(year, month, day));
  const dayNum = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil((x.getTime() - yearStart.getTime() + 86400000) / 86400000 / 7);
}

export function isoWeekYearLima(monday: Date): number {
  const { year, month, day } = instantToLimaParts(monday);
  const thu = new Date(Date.UTC(year, month, day + 3));
  return thu.getUTCFullYear();
}

export function weekShortAxisLabelLima(monday: Date): string {
  const { month, day } = instantToLimaParts(monday);
  return `${day}/${month + 1}`;
}

/** Etiqueta eje X de reportes: semana ISO en Lima (p. ej. W28). */
export function formatIsoWeekLabel(weekNumber: number): string {
  return `W${String(weekNumber).padStart(2, '0')}`;
}

export function isoWeekLabelFromInstant(d: Date): string {
  return formatIsoWeekLabel(isoWeekNumberLima(d));
}

export function weekAxisLabelLima(monday: Date): string {
  const y = isoWeekYearLima(monday);
  const w = isoWeekNumberLima(monday);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

export function monthKeyLima(d: Date): string {
  const { year, month } = instantToLimaParts(d);
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function startOfMonthLima(d: Date): Date {
  const { year, month } = instantToLimaParts(d);
  return limaDayStart(year, month, 1);
}

export function endOfMonthLima(d: Date): Date {
  const { year, month } = instantToLimaParts(d);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, lastDay + 1, 4, 59, 59, 999));
}

export function maxInstant(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

export function minInstant(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}
