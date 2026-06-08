/**
 * Etiqueta del mes calendario actual (zona local).
 * Ventas reales: store analytics (hidrata MainLayout vía /analytics/goal-progress).
 */
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function getCurrentMonthLabel(): string {
  return format(new Date(), 'MMMM yyyy', { locale: es });
}

/** YYYY-MM en UTC (alineado con metas mensuales del CRM y reportes). */
export function utcYearMonthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
