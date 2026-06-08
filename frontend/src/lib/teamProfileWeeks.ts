import {
  getISOWeek,
  getISOWeekYear,
  getISOWeeksInYear,
  setISOWeek,
  startOfISOWeek,
  endOfISOWeek,
} from 'date-fns';
import { formatLocalISODate } from '@/lib/analyticsApi';

export type TeamProfileWeekOption = {
  weekIndex: number;
  from: string;
  to: string;
  label: string;
};

/**
 * Semanas ISO (lun–dom) del año, hasta la semana calendario actual (si es el año en curso).
 * La semana en curso se etiqueta "Semana actual".
 */
export function getWeeksInYearForTeamProfile(
  isoYear: number,
  now: Date = new Date(),
): TeamProfileWeekOption[] {
  const yNow = getISOWeekYear(now);
  const wNow = getISOWeek(now);
  const anyInYear = new Date(isoYear, 5, 15);
  const maxWeekInYear = getISOWeeksInYear(anyInYear);
  let lastW: number;
  if (isoYear < yNow) lastW = maxWeekInYear;
  else if (isoYear > yNow) lastW = 0;
  else lastW = wNow;
  if (lastW < 1) return [];

  const anchor = new Date(isoYear, 0, 4);
  const out: TeamProfileWeekOption[] = [];
  for (let w = 1; w <= lastW; w += 1) {
    const start = startOfISOWeek(setISOWeek(anchor, w));
    const end = endOfISOWeek(setISOWeek(anchor, w));
    out.push({
      weekIndex: w,
      from: formatLocalISODate(start),
      to: formatLocalISODate(end),
      label: isoYear === yNow && w === wNow ? 'Semana actual' : `Semana ${w}`,
    });
  }
  return out;
}

export function teamProfileYearOptions(now: Date = new Date()): number[] {
  const y = getISOWeekYear(now);
  return [y - 1, y].filter((n, i, a) => a.indexOf(n) === i);
}
