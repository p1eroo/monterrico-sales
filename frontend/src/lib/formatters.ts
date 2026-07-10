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

/** Fecha local para mostrar; evita desfase UTC en campos de "solo fecha". */
function parseDateForDisplay(dateStr: string): Date {
  const t = dateStr.trim();
  // Si es YYYY-MM-DD
  if (DATE_ONLY_YMD.test(t)) {
    return new Date(`${t}T00:00:00`);
  }
  // Si viene del backend como ISO con medianoche UTC (ej: 2026-01-29T00:00:00.000Z)
  // lo tratamos como fecha local para que no salte al día anterior en zonas horarias negativas (Perú).
  if (t.includes('T00:00:00')) {
    return new Date(t.split('T')[0] + 'T00:00:00');
  }
  return new Date(dateStr);
}


/** Formatea una fecha en formato corto: "15 mar 2026" */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return parseDateForDisplay(dateStr).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Formatea una fecha en formato DD/MM/YYYY */
export function formatDateDMY(dateStr: string): string {
  if (!dateStr) return '—';
  const d = parseDateForDisplay(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Formato muy corto: "15 mar" (sin año, para listas) */
export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '—';
  return parseDateForDisplay(dateStr).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
  });
}

/** Para strings solo-fecha (ej: "2026-03-05") - evita desfase por UTC */
export function formatDateShortLocal(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr.trim()}T00:00:00`);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

/** Suma días al calendario local y devuelve `YYYY-MM-DD` (para defaults de cierre, etc.). */
export function addCalendarDaysLocalIso(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Formatea fecha y hora: "15 mar 2026, 14:30" */
export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Para agrupar fechas en auditoría: "Hoy", "Ayer", "Esta semana" o fecha */
export function formatDateGroup(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 7);
  d.setHours(0, 0, 0, 0);

  if (d.getTime() === today.getTime()) return 'Hoy';
  if (d.getTime() === yesterday.getTime()) return 'Ayer';
  if (d >= weekStart) return 'Esta semana';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Zona usada en el CRM (Lima, sin horario de verano). */
export const CRM_TIMEZONE_PERU = 'America/Lima' as const;

/**
 * “Hoy” en Perú en formato YYYY-MM-DD (inputs type="date").
 * Evita el desfase de `toISOString().slice(0,10)` (medianoche UTC).
 */
export function formatTodayPeruYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: CRM_TIMEZONE_PERU });
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
