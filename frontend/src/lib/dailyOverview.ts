/** Solo se escribe al marcar "No mostrar este resumen hoy" y cerrar. */
const STORAGE_KEY = 'dailyBriefingSkipToday';
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
