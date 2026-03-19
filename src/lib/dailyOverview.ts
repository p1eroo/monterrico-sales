const STORAGE_KEY = 'dailyOverviewLastShown';

export function shouldShowDailyOverview(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return true;
    const lastDate = new Date(stored);
    const today = new Date();
    return (
      lastDate.getFullYear() !== today.getFullYear() ||
      lastDate.getMonth() !== today.getMonth() ||
      lastDate.getDate() !== today.getDate()
    );
  } catch {
    return true;
  }
}

export function markDailyOverviewShown(): void {
  try {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // ignore
  }
}
