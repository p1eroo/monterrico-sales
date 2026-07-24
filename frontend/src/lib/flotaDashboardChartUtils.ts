import type { DateRange } from 'react-day-picker';
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  getISOWeek,
  parseISO,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { Conductor } from '@/lib/flotaConductoresApi';
import type { ConductoresWeeklyRow } from '@/components/flota/ConductoresWeeklyAreaChart';
import type { SunatDailyRow } from '@/components/flota/SunatDailyMixedChart';

const SUNAT_CLIENTS = new Set(['SUNAT', 'SUNAT INTENDENCIA LIMA']);
const AUTHORIZED_PREFIXES = ['0S', '1S', '3S', '5S', '9S'];

export type SunatMetrics = {
  servicios: number;
  autorizados: number;
  noAutorizados: number;
  penalizados: number;
  porAutorizar: number;
  nuevosIngresos: number;
};

export function buildConductoresWeeklyData(
  conductores: Conductor[],
): ConductoresWeeklyRow[] {
  if (!conductores.length) return [];

  const weekMap = new Map<
    string,
    {
      nuevos: number;
      nuevosActivos: number;
      weekStart: Date;
      weekEnd: Date;
      weekNum: number;
    }
  >();

  for (const c of conductores) {
    if (!c.fechorregistro) continue;
    let regDate: Date;
    try {
      regDate = parseISO(c.fechorregistro);
      if (Number.isNaN(regDate.getTime())) continue;
    } catch {
      continue;
    }

    const wStart = startOfWeek(regDate, { weekStartsOn: 1 });
    const wEnd = endOfWeek(regDate, { weekStartsOn: 1 });
    const weekNum = getISOWeek(regDate);
    const key = format(wStart, 'yyyy-MM-dd');

    const existing = weekMap.get(key) ?? {
      nuevos: 0,
      nuevosActivos: 0,
      weekStart: wStart,
      weekEnd: wEnd,
      weekNum,
    };
    existing.nuevos += 1;
    if (c.estado !== 'RETIRADO') {
      existing.nuevosActivos += 1;
    }
    weekMap.set(key, existing);
  }

  return Array.from(weekMap.values())
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
    .map((w) => ({
      semana: `Sem ${w.weekNum}`,
      rango: `${format(w.weekStart, 'dd MMM', { locale: es })} - ${format(w.weekEnd, 'dd MMM', { locale: es })}`,
      nuevos: w.nuevos,
      nuevosActivos: w.nuevosActivos,
      weekStartTs: w.weekStart.getTime(),
    }));
}

export function filterConductoresWeeklyByRange(
  weeklyData: ConductoresWeeklyRow[],
  dateRange: DateRange | undefined,
): ConductoresWeeklyRow[] {
  if (!dateRange?.from || !dateRange?.to) return weeklyData;
  const start = dateRange.from.getTime();
  const end = dateRange.to.getTime() + 86400000;
  return weeklyData.filter((w) => w.weekStartTs >= start && w.weekStartTs <= end);
}

export function filterSunatHistory<T extends { cliente?: string | null }>(
  sunatHistory: T[],
): T[] {
  return sunatHistory.filter((s) => SUNAT_CLIENTS.has(s.cliente ?? ''));
}

export function buildSunatChartData(
  sunatFiltered: Array<{
    fechareserva?: string | null;
    fechorregistro?: string | null;
    movil?: string | null;
  }>,
  sunatDateRange: DateRange | undefined,
): SunatDailyRow[] {
  if (!sunatDateRange?.from || !sunatDateRange?.to) return [];

  const interval = eachDayOfInterval({
    start: sunatDateRange.from,
    end: sunatDateRange.to,
  });

  const historyMap = new Map<string, { servicios: number; autorizados: Set<string> }>();
  for (const item of sunatFiltered) {
    const d = item.fechareserva ?? item.fechorregistro;
    if (!d) continue;
    const dateKey = d.split('T')[0];
    const current = historyMap.get(dateKey) ?? {
      servicios: 0,
      autorizados: new Set<string>(),
    };
    current.servicios += 1;
    const movil = item.movil;
    if (movil && AUTHORIZED_PREFIXES.some((p) => movil.startsWith(p))) {
      current.autorizados.add(movil);
    }
    historyMap.set(dateKey, current);
  }

  return interval.map((date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dataPoint = historyMap.get(dateKey);
    return {
      name: format(date, 'EEE dd', { locale: es }),
      servicios: dataPoint?.servicios ?? 0,
      autorizados: dataPoint?.autorizados.size ?? 0,
    };
  });
}

export function buildSunatMetrics(
  sunatFiltered: Array<{ movil?: string | null }>,
  conductores: Conductor[],
  sunatDateRange: DateRange | undefined,
  porAutorizarCount: number,
  loadingSunat: boolean,
): SunatMetrics {
  if (sunatFiltered.length === 0 && !loadingSunat) {
    return {
      servicios: 0,
      autorizados: 0,
      noAutorizados: 0,
      penalizados: 0,
      porAutorizar: porAutorizarCount,
      nuevosIngresos: 0,
    };
  }

  const uniqueMobiles = new Set(
    sunatFiltered.map((s) => s.movil).filter((m): m is string => Boolean(m)),
  );
  let autorizadosCount = 0;
  let noAutorizadosCount = 0;

  uniqueMobiles.forEach((m) => {
    if (AUTHORIZED_PREFIXES.some((p) => m.startsWith(p))) {
      autorizadosCount += 1;
    } else {
      noAutorizadosCount += 1;
    }
  });

  const penalizados = sunatFiltered.filter((s) => {
    const m = s.movil ?? '';
    return !AUTHORIZED_PREFIXES.some((p) => m.startsWith(p));
  }).length;

  const rangeStart = sunatDateRange?.from;
  const rangeEnd = sunatDateRange?.to;
  const nuevosIngresos = conductores.filter((c) => {
    if (!rangeStart || !rangeEnd || !c.fechorregistro) return false;
    const regDate = new Date(c.fechorregistro);
    return regDate >= rangeStart && regDate <= rangeEnd;
  }).length;

  return {
    servicios: sunatFiltered.length,
    autorizados: autorizadosCount,
    noAutorizados: noAutorizadosCount,
    penalizados,
    porAutorizar: porAutorizarCount,
    nuevosIngresos,
  };
}
