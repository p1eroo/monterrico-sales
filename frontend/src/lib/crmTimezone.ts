import type { DateRange } from 'react-day-picker';

/** Alineado con `backend/src/common/crm-timezone.util.ts` (Perú, sin DST). */
export const CRM_TIMEZONE = 'America/Lima' as const;

const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;

export type LimaDateParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
};

export function instantToLimaParts(d: Date): LimaDateParts {
  const t = new Date(d.getTime() - LIMA_OFFSET_MS);
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth(),
    day: t.getUTCDate(),
    weekday: t.getUTCDay(),
  };
}

export function limaDayStart(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 5, 0, 0, 0));
}

export function parseDayStartLima(isoDate: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!m) return new Date(NaN);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return limaDayStart(y, mo - 1, d);
}

export function parseDayEndLima(isoDate: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!m) return new Date(NaN);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d + 1, 4, 59, 59, 999));
}

/** Día calendario elegido en un picker → YYYY-MM-DD (sin desfase UTC). */
export function calendarDateToLimaYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Instant → YYYY-MM-DD según calendario Lima. */
export function instantToLimaYmd(d: Date): string {
  const { year, month, day } = instantToLimaParts(d);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Rango de filtros CRM → fechas YYYY-MM-DD (día completo en Lima). */
export function dateRangeToLimaYmdBounds(range: DateRange | undefined): {
  from?: string;
  to?: string;
} {
  return {
    from: range?.from ? calendarDateToLimaYmd(range.from) : undefined,
    to: range?.to ? calendarDateToLimaYmd(range.to) : undefined,
  };
}

export function startOfWeekMondayLima(d: Date): Date {
  const { year, month, day, weekday } = instantToLimaParts(d);
  const diff = weekday === 0 ? 6 : weekday - 1;
  return limaDayStart(year, month, day - diff);
}

export function endOfWeekSundayLima(d: Date): Date {
  const monday = startOfWeekMondayLima(d);
  return new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
}

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

export function weekAxisLabelLima(monday: Date): string {
  const y = isoWeekYearLima(monday);
  const w = isoWeekNumberLima(monday);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

export function parseIsoWeekNumberFromLabel(name: string): number | null {
  const trimmed = name.trim();
  const direct = /^W?(\d{1,2})$/i.exec(trimmed);
  if (direct) return Number(direct[1]);
  const yearWeek = /(?:^|-)W(\d{1,2})$/i.exec(trimmed);
  if (yearWeek) return Number(yearWeek[1]);
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function formatIsoWeekLabel(weekNumber: number): string {
  return `W${String(weekNumber).padStart(2, '0')}`;
}

/** Instant Lima → Date de calendario local (mismo día civil que Lima). */
export function limaInstantToCalendarDate(d: Date): Date {
  const { year, month, day } = instantToLimaParts(d);
  return new Date(year, month, day);
}

/** Semana ISO (Lima, lun–dom) que contiene el día elegido en el picker. */
export function weekRangeFromCalendarDay(day: Date): DateRange {
  const anchor = parseDayStartLima(calendarDateToLimaYmd(day));
  return {
    from: limaInstantToCalendarDate(startOfWeekMondayLima(anchor)),
    to: limaInstantToCalendarDate(endOfWeekSundayLima(anchor)),
  };
}

export function currentLimaWeekCalendarRange(): DateRange {
  return weekRangeFromCalendarDay(new Date());
}

export function isoWeekLabelFromInstant(d: Date): string {
  return formatIsoWeekLabel(isoWeekNumberLima(d));
}

export function weekLabelFromStart(weekStartIso: string): string {
  const d = new Date(weekStartIso);
  if (Number.isNaN(d.getTime())) return '—';
  return isoWeekLabelFromInstant(d);
}

/** Etiqueta corta para ejes de gráficos semanales (W23, W28, …). */
export function weekAxisLabelFromWeekRow(week: {
  name?: string;
  weekStart: string;
}): string {
  const name = week.name?.trim() ?? '';
  if (/^W\d{1,2}$/i.test(name)) {
    const n = Number(name.slice(1));
    return formatIsoWeekLabel(n);
  }
  if (/^\d{1,2}$/.test(name)) return formatIsoWeekLabel(Number(name));
  const yearWeek = /(?:^|-)W(\d{1,2})$/i.exec(name);
  if (yearWeek) return formatIsoWeekLabel(Number(yearWeek[1]));
  return weekLabelFromStart(week.weekStart);
}

export function weekTooltipHeading(week: {
  name?: string;
  weekStart: string;
}): string {
  const label = weekAxisLabelFromWeekRow(week);
  return `Semana ${label.replace(/^W/i, '')}`;
}

/** Rango legible en calendario Lima (p. ej. tooltip de prospectos activos). */
export function formatWeekRangeLima(weekStartIso: string, weekEndIso: string): string {
  const start = new Date(weekStartIso);
  const end = new Date(weekEndIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
  const fmt = (d: Date) =>
    d.toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'short',
      timeZone: CRM_TIMEZONE,
    });
  return `${fmt(start)} – ${fmt(end)}`;
}
