/**
 * Datos mock de ventas semanales por usuario.
 * En producción vendría del backend.
 */
import { opportunities } from '@/data/mock';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/** Ventas cerradas esta semana por usuario (mock) */
export function getWeeklySalesByUser(): Record<string, number> {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const byUser: Record<string, number> = {};

  for (const opp of opportunities) {
    if (opp.status !== 'ganada') continue;
    try {
      const closeDate = parseISO(opp.expectedCloseDate + 'T12:00:00');
      if (!isWithinInterval(closeDate, { start: weekStart, end: weekEnd })) continue;
    } catch {
      continue;
    }
    const userId = opp.assignedTo;
    byUser[userId] = (byUser[userId] ?? 0) + opp.amount;
  }

  // Mock: datos base para que siempre haya algo que mostrar
  const baseMock: Record<string, number> = {
    u1: 18500,
    u2: 14200,
    u3: 9800,
    u4: 7200,
    u5: 5100,
  };

  for (const [uid, amount] of Object.entries(baseMock)) {
    byUser[uid] = (byUser[uid] ?? 0) + amount;
  }

  return byUser;
}

/** Total de ventas semanales del equipo */
export function getTotalWeeklySales(): number {
  const byUser = getWeeklySalesByUser();
  return Object.values(byUser).reduce((a, b) => a + b, 0);
}

/** Ventas semanales de un usuario */
export function getUserWeeklySales(userId: string): number {
  return getWeeklySalesByUser()[userId] ?? 0;
}

/** Etiqueta de la semana actual */
export function getCurrentWeekLabel(): string {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 });
  const end = endOfWeek(now, { weekStartsOn: 1 });
  return `${format(start, 'd MMM', { locale: es })} - ${format(end, 'd MMM yyyy', { locale: es })}`;
}
