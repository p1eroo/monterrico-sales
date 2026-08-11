/** Solo se escribe al marcar "No mostrar este resumen hoy" y cerrar. */
const STORAGE_KEY = 'dailyBriefingSkipToday';
/** Primera apertura del día con conteo de cierre forzado (5 s). */
const CLOSE_LOCK_KEY = 'dailyBriefingCloseLockUsed';
/** Clave antigua: marcaba al cerrar siempre (comportamiento incorrecto). */
const LEGACY_STORAGE_KEY = 'dailyBriefingLastShown';

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function shouldShowDailyBriefing(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return true;
    const skippedOn = new Date(stored);
    const today = new Date();
    return !isSameCalendarDay(skippedOn, today);
  } catch {
    return true;
  }
}

export function markDailyBriefingShown(): void {
  try {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** true solo la primera vez que se abre el resumen en el día (p. ej. al ingresar). */
export function shouldApplyDailyBriefingCloseLock(): boolean {
  try {
    const stored = localStorage.getItem(CLOSE_LOCK_KEY);
    if (!stored) return true;
    const usedOn = new Date(stored);
    return !isSameCalendarDay(usedOn, new Date());
  } catch {
    return true;
  }
}

export function markDailyBriefingCloseLockUsed(): void {
  try {
    localStorage.setItem(CLOSE_LOCK_KEY, new Date().toISOString());
  } catch {
    // ignore
  }
}
