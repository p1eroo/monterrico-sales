/**
 * Etiqueta de semana actual (lunes–domingo, zona local).
 * Ventas reales: store analytics (hidrata MainLayout vía /analytics/goal-progress).
 */
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

export function getCurrentWeekLabel(): string {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 });
  const end = endOfWeek(now, { weekStartsOn: 1 });
  return `${format(start, 'd MMM', { locale: es })} - ${format(end, 'd MMM yyyy', { locale: es })}`;
}
