/**
 * Etiqueta del mes calendario actual (zona local).
 * Ventas reales: store analytics (hidrata MainLayout vía /analytics/goal-progress).
 */
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function getCurrentMonthLabel(): string {
  return format(new Date(), 'MMMM yyyy', { locale: es });
}
