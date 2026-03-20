/**
 * Datos mock de ventas mensuales por usuario.
 * En producción vendría del backend.
 */
import { opportunities } from '@/data/mock';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/** Ventas cerradas este mes por usuario (mock) */
export function getMonthlySalesByUser(): Record<string, number> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const byUser: Record<string, number> = {};

  for (const opp of opportunities) {
    if (opp.status !== 'ganada') continue;
    try {
      const closeDate = parseISO(opp.expectedCloseDate + 'T12:00:00');
      if (!isWithinInterval(closeDate, { start: monthStart, end: monthEnd })) continue;
    } catch {
      continue;
    }
    const userId = opp.assignedTo;
    byUser[userId] = (byUser[userId] ?? 0) + opp.amount;
  }

  // Mock: datos base para que siempre haya algo que mostrar
  const baseMock: Record<string, number> = {
    u1: 72000,
    u2: 56000,
    u3: 39000,
    u4: 29000,
    u5: 20000,
  };

  for (const [uid, amount] of Object.entries(baseMock)) {
    byUser[uid] = (byUser[uid] ?? 0) + amount;
  }

  return byUser;
}

/** Total de ventas mensuales del equipo */
export function getTotalMonthlySales(): number {
  const byUser = getMonthlySalesByUser();
  return Object.values(byUser).reduce((a, b) => a + b, 0);
}

/** Ventas mensuales de un usuario */
export function getUserMonthlySales(userId: string): number {
  return getMonthlySalesByUser()[userId] ?? 0;
}

/** Etiqueta del mes actual */
export function getCurrentMonthLabel(): string {
  const now = new Date();
  return format(now, "MMMM yyyy", { locale: es });
}
