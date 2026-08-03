/**
 * Funciones de formato centralizadas para todo el proyecto.
 * Usa locale es-PE (Perú) por defecto.
 */

/** Formatea un número como moneda (PEN por defecto) */
export function formatCurrency(value: number, currency = 'PEN'): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Formato corto: "S/ 1,234" sin decimales (para metas, reportes) */
export function formatCurrencyShort(amount: number): string {
  return `S/ ${amount.toLocaleString('es-PE')}`;
}

/** Formato compacto: S/424K, S/1,621K, S/2.97M */
export function formatCurrencyCompact(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    const formatted =
      v % 1 === 0 ? String(v) : v.toFixed(2).replace(/\.?0+$/, '');
    return `${sign}S/${formatted}M`;
  }
  if (abs >= 1_000) {
    const v = Math.round(abs / 1_000);
    return `${sign}S/${v.toLocaleString('es-PE')}K`;
  }
  return `${sign}S/ ${abs.toLocaleString('es-PE')}`;
}

const DATE_ONLY_YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Zona usada en el CRM (Lima, sin horario de verano). */
export const CRM_TIMEZONE_PERU = 'America/Lima' as const;

function parseDateInput(dateStr: string): Date {
  const t = dateStr.trim();
  if (DATE_ONLY_YMD.test(t)) {
    return new Date(`${t}T12:00:00-05:00`);
  }
  if (t.includes('T00:00:00')) {
    return new Date(`${t.split('T')[0]}T12:00:00-05:00`);
  }
  return new Date(t);
}

function formatInLimaCalendar(
  d: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return d.toLocaleDateString('es-PE', {
    ...options,
    timeZone: CRM_TIMEZONE_PERU,
  });
}

/** Formatea una fecha en formato corto: "15 mar 2026" */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = parseDateInput(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return formatInLimaCalendar(d, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Formatea una fecha en formato DD/MM/YYYY */
export function formatDateDMY(dateStr: string): string {
  if (!dateStr) return '—';
  const d = parseDateInput(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CRM_TIMEZONE_PERU,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d);
  const day = parts.find((p) => p.type === 'day')?.value ?? '00';
  const month = parts.find((p) => p.type === 'month')?.value ?? '00';
  const year = parts.find((p) => p.type === 'year')?.value ?? '0000';
  return `${day}/${month}/${year}`;
}

/** Formato muy corto: "15 mar" (sin año, para listas) */
export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '—';
  const d = parseDateInput(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return formatInLimaCalendar(d, { day: '2-digit', month: 'short' });
}

/** Para strings solo-fecha (ej: "2026-03-05") — calendario Lima. */
export function formatDateShortLocal(dateStr: string): string {
  return formatDateShort(dateStr);
}

/**
 * “Hoy” en Perú en formato YYYY-MM-DD (inputs type="date").
 * Evita el desfase de `toISOString().slice(0,10)` (medianoche UTC).
 */
export function formatTodayPeruYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: CRM_TIMEZONE_PERU });
}

/** Instant ISO al completar actividad/tarea (reportes + historial alineados). */
export function completedAtNowIso(): string {
  return new Date().toISOString();
}

/** Suma días al calendario Lima y devuelve `YYYY-MM-DD`. */
export function addCalendarDaysLocalIso(days: number): string {
  const base = formatTodayPeruYmd();
  const [y, m, d] = base.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return shifted.toLocaleDateString('en-CA', { timeZone: CRM_TIMEZONE_PERU });
}

/** Formatea fecha y hora: "15 mar 2026, 14:30" */
export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: CRM_TIMEZONE_PERU,
  });
}

/** Para agrupar fechas en auditoría: "Hoy", "Ayer", "Esta semana" o fecha */
export function formatDateGroup(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dYmd = d.toLocaleDateString('en-CA', { timeZone: CRM_TIMEZONE_PERU });
  if (dYmd === formatTodayPeruYmd()) return 'Hoy';
  if (dYmd === addCalendarDaysLocalIso(-1)) return 'Ayer';
  if (dYmd >= addCalendarDaysLocalIso(-7)) return 'Esta semana';
  return formatDate(iso);
}

/**
 * Hora actual en Perú (HH:mm 24 h) para inputs type="time".
 * No usa la hora programada de la tarea, sino el momento de registro.
 */
export function formatNowPeruTimeHHmm(): string {
  const d = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CRM_TIMEZONE_PERU,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '0';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '0';
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}
