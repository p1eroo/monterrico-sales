import { format, eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import type { OperadorStatsDailyRow, FlotaProspectoRow } from '@/lib/flotaProspectosApi';
import {
  calendarDateToLimaYmd,
  parseDayStartLima,
} from '@/lib/crmTimezone';
import {
  getLimaRangeYmd,
  FLOTA_TIME_SERIES_TOP_N,
  normalizeDistritoLabel,
  prospectAsignadoLimaYmd,
  type ProspectosTimeGranularity,
  type ProspectosTimeSeriesData,
  resolveProspectosTimeGranularity,
} from '@/lib/flotaProspectosReportUtils';

const ACTIVITY_SERIES = [
  { key: 'prospectosAsignados' as const, label: 'Asignados' },
  { key: 'chatsActivos' as const, label: 'Chats' },
  { key: 'mensajesEnviados' as const, label: 'Enviados' },
  { key: 'mensajesRecibidos' as const, label: 'Recibidos' },
  { key: 'llamadas' as const, label: 'Llamadas' },
  { key: 'citasProgramadas' as const, label: 'Citas programadas' },
];

export const OPERADOR_ACTIVITY_METRICS = ACTIVITY_SERIES;

export type OperadorActivityMetricKey = (typeof ACTIVITY_SERIES)[number]['key'];

function nextYmd(ymd: string): string {
  const start = parseDayStartLima(ymd);
  return calendarDateToLimaYmd(new Date(start.getTime() + 86_400_000));
}

function eachDayYmdInRange(from: string, to: string): string[] {
  const days: string[] = [];
  let cur = from;
  while (cur <= to) {
    days.push(cur);
    cur = nextYmd(cur);
  }
  return days;
}

function formatDayLabel(ymd: string): string {
  return format(parseDayStartLima(ymd), 'd MMM', { locale: es });
}

function eachMonthBucketsInRange(
  from: string,
  to: string,
): { label: string; fromYmd: string; toYmd: string }[] {
  const fromDate = parseDayStartLima(from);
  const toDate = parseDayStartLima(to);
  const months = eachMonthOfInterval({
    start: startOfMonth(fromDate),
    end: startOfMonth(toDate),
  });

  return months.map((m) => {
    const monthStartYmd = calendarDateToLimaYmd(startOfMonth(m));
    const monthEndYmd = calendarDateToLimaYmd(endOfMonth(m));
    return {
      label: format(m, 'MMM yyyy', { locale: es }),
      fromYmd: monthStartYmd > from ? monthStartYmd : from,
      toYmd: monthEndYmd < to ? monthEndYmd : to,
    };
  });
}

function emptyMetrics() {
  return {
    prospectosAsignados: 0,
    chatsActivos: 0,
    mensajesEnviados: 0,
    mensajesRecibidos: 0,
    llamadas: 0,
    citasProgramadas: 0,
  };
}

function aggregateRows(rows: OperadorStatsDailyRow[]) {
  const totals = emptyMetrics();
  for (const row of rows) {
    totals.prospectosAsignados += row.prospectosAsignados;
    totals.chatsActivos += row.chatsActivos;
    totals.mensajesEnviados += row.mensajesEnviados;
    totals.mensajesRecibidos += row.mensajesRecibidos;
    totals.llamadas += row.llamadas;
    totals.citasProgramadas += row.citasProgramadas;
  }
  return totals;
}

export function buildOperadorActivityTimeSeries(
  rows: OperadorStatsDailyRow[],
  selectedOperadores: Set<string>,
  dateRange: DateRange | undefined,
  granularity: ProspectosTimeGranularity = resolveProspectosTimeGranularity(
    dateRange,
  ),
): ProspectosTimeSeriesData {
  const empty: ProspectosTimeSeriesData = {
    categories: [],
    series: [],
    hasData: false,
  };

  const range = getLimaRangeYmd(dateRange);
  if (!range) return empty;

  const filtered = rows.filter((r) => selectedOperadores.has(r.operador));
  if (filtered.length === 0) return empty;

  let buckets: { label: string; match: (fecha: string) => boolean }[] = [];

  if (granularity === 'day') {
    buckets = eachDayYmdInRange(range.from, range.to).map((ymd) => ({
      label: formatDayLabel(ymd),
      match: (fecha) => fecha === ymd,
    }));
  } else {
    buckets = eachMonthBucketsInRange(range.from, range.to).map(
      ({ label, fromYmd, toYmd }) => ({
        label,
        match: (fecha) => fecha >= fromYmd && fecha <= toYmd,
      }),
    );
  }

  const matrix = buckets.map((bucket) =>
    aggregateRows(filtered.filter((r) => bucket.match(r.fecha))),
  );

  const series = ACTIVITY_SERIES.map(({ key, label }) => ({
    name: label,
    data: matrix.map((row) => row[key]),
  }));

  const hasData = series.some((s) => s.data.some((v) => v > 0));
  return {
    categories: buckets.map((b) => b.label),
    series,
    hasData,
  };
}

function dailyActivityCount(row: OperadorStatsDailyRow): number {
  return (
    row.prospectosAsignados +
    row.chatsActivos +
    row.mensajesEnviados +
    row.mensajesRecibidos +
    row.llamadas +
    row.citasProgramadas
  );
}

/** Actividad diaria apilada por operador (top N + Otros). */
export function buildOperadorActivityByOperatorDailySeries(
  rows: OperadorStatsDailyRow[],
  selectedOperadores: Set<string>,
  dateRange: DateRange | undefined,
  granularity: ProspectosTimeGranularity = resolveProspectosTimeGranularity(
    dateRange,
  ),
  topN = FLOTA_TIME_SERIES_TOP_N,
): ProspectosTimeSeriesData {
  const empty: ProspectosTimeSeriesData = {
    categories: [],
    series: [],
    hasData: false,
  };

  const range = getLimaRangeYmd(dateRange);
  if (!range) return empty;

  const filtered = rows.filter((r) => selectedOperadores.has(r.operador));
  if (filtered.length === 0) return empty;

  const operadorTotals = new Map<string, number>();
  for (const row of filtered) {
    operadorTotals.set(
      row.operador,
      (operadorTotals.get(row.operador) ?? 0) + dailyActivityCount(row),
    );
  }

  const topOperadores = [...operadorTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name);
  const topSet = new Set(topOperadores);
  const seriesNames =
    topOperadores.length > 0 ? [...topOperadores, 'Otros'] : [];

  let buckets: { label: string; match: (fecha: string) => boolean }[] = [];
  if (granularity === 'day') {
    buckets = eachDayYmdInRange(range.from, range.to).map((ymd) => ({
      label: formatDayLabel(ymd),
      match: (fecha) => fecha === ymd,
    }));
  } else {
    buckets = eachMonthBucketsInRange(range.from, range.to).map(
      ({ label, fromYmd, toYmd }) => ({
        label,
        match: (fecha) => fecha >= fromYmd && fecha <= toYmd,
      }),
    );
  }

  const matrix = new Map<string, number[]>(
    seriesNames.map((name) => [name, buckets.map(() => 0)]),
  );

  for (const bucketIdx of buckets.keys()) {
    const bucket = buckets[bucketIdx];
    const dayRows = filtered.filter((r) => bucket.match(r.fecha));
    for (const row of dayRows) {
      const seriesName = topSet.has(row.operador) ? row.operador : 'Otros';
      const values = matrix.get(seriesName);
      if (values) values[bucketIdx] += dailyActivityCount(row);
    }
  }

  const series = seriesNames.map((name) => ({
    name,
    data: matrix.get(name) ?? buckets.map(() => 0),
  }));

  const hasData = series.some((s) => s.data.some((v) => v > 0));
  return {
    categories: buckets.map((b) => b.label),
    series,
    hasData,
  };
}

function buildDayBuckets(
  dateRange: DateRange | undefined,
  granularity: ProspectosTimeGranularity,
): { label: string; match: (ymd: string) => boolean }[] {
  const range = getLimaRangeYmd(dateRange);
  if (!range) return [];

  if (granularity === 'day') {
    return eachDayYmdInRange(range.from, range.to).map((ymd) => ({
      label: formatDayLabel(ymd),
      match: (d: string) => d === ymd,
    }));
  }

  return eachMonthBucketsInRange(range.from, range.to).map(
    ({ label, fromYmd, toYmd }) => ({
      label,
      match: (d: string) => d >= fromYmd && d <= toYmd,
    }),
  );
}

export type OperadorZonaAsignacion = {
  zona: string;
  count: number;
};

export type OperadorAsignacionesDiaRow = {
  operador: string;
  total: number;
  zonas: OperadorZonaAsignacion[];
};

export type OperadorAsignacionesPorDia = {
  dayLabel: string;
  operadores: OperadorAsignacionesDiaRow[];
};

export type OperadorActividadDiaRow = {
  operador: string;
  prospectosAsignados: number;
  chatsActivos: number;
  mensajesEnviados: number;
  mensajesRecibidos: number;
  llamadas: number;
  citasProgramadas: number;
};

export type OperadorActividadPorDia = {
  dayLabel: string;
  operadores: OperadorActividadDiaRow[];
};

export type OperadorDetalleDiaRow = OperadorActividadDiaRow & {
  zonas: OperadorZonaAsignacion[];
};

export type OperadorDetallePorDia = {
  dayLabel: string;
  operadores: OperadorDetalleDiaRow[];
};

function actividadDiaTotal(row: OperadorActividadDiaRow): number {
  return (
    row.prospectosAsignados +
    row.chatsActivos +
    row.mensajesEnviados +
    row.mensajesRecibidos +
    row.llamadas +
    row.citasProgramadas
  );
}

const EMPTY_ACTIVIDAD = (): Omit<OperadorActividadDiaRow, 'operador'> => ({
  prospectosAsignados: 0,
  chatsActivos: 0,
  mensajesEnviados: 0,
  mensajesRecibidos: 0,
  llamadas: 0,
  citasProgramadas: 0,
});

export function buildOperadorActividadMetricasPorDia(
  rows: OperadorStatsDailyRow[],
  selectedOperadores: Set<string>,
  dateRange: DateRange | undefined,
  granularity: ProspectosTimeGranularity = resolveProspectosTimeGranularity(
    dateRange,
  ),
): OperadorActividadPorDia[] {
  const buckets = buildDayBuckets(dateRange, granularity);
  if (buckets.length === 0) return [];

  const byDay = buckets.map(
    () => new Map<string, OperadorActividadDiaRow>(),
  );

  for (const row of rows) {
    if (!selectedOperadores.has(row.operador)) continue;
    const idx = buckets.findIndex((b) => b.match(row.fecha));
    if (idx < 0) continue;

    const map = byDay[idx];
    const existing = map.get(row.operador) ?? {
      operador: row.operador,
      ...EMPTY_ACTIVIDAD(),
    };
    existing.prospectosAsignados += row.prospectosAsignados;
    existing.chatsActivos += row.chatsActivos;
    existing.mensajesEnviados += row.mensajesEnviados;
    existing.mensajesRecibidos += row.mensajesRecibidos;
    existing.llamadas += row.llamadas;
    existing.citasProgramadas += row.citasProgramadas;
    map.set(row.operador, existing);
  }

  return buckets.map((bucket, i) => ({
    dayLabel: bucket.label,
    operadores: [...byDay[i].values()]
      .filter((r) => actividadDiaTotal(r) > 0)
      .sort((a, b) => actividadDiaTotal(b) - actividadDiaTotal(a)),
  }));
}

export function mergeOperadorDetallePorDia(
  actividad: OperadorActividadPorDia[],
  asignaciones: OperadorAsignacionesPorDia[],
): OperadorDetallePorDia[] {
  const len = Math.max(actividad.length, asignaciones.length);
  const merged: OperadorDetallePorDia[] = [];

  for (let i = 0; i < len; i += 1) {
    const actDay = actividad[i];
    const asigDay = asignaciones[i];
    const dayLabel = actDay?.dayLabel ?? asigDay?.dayLabel ?? '';
    const names = new Set<string>([
      ...(actDay?.operadores.map((o) => o.operador) ?? []),
      ...(asigDay?.operadores.map((o) => o.operador) ?? []),
    ]);

    const operadores = [...names]
      .map((operador) => {
        const metrics = actDay?.operadores.find((o) => o.operador === operador);
        const zonas =
          asigDay?.operadores.find((o) => o.operador === operador)?.zonas ?? [];
        return metrics
          ? { ...metrics, zonas }
          : { operador, ...EMPTY_ACTIVIDAD(), zonas };
      })
      .filter((row) => actividadDiaTotal(row) > 0 || row.zonas.length > 0)
      .sort((a, b) => actividadDiaTotal(b) - actividadDiaTotal(a));

    merged.push({ dayLabel, operadores });
  }

  return merged;
}

export function buildOperadorAsignacionesPorDia(
  prospectos: FlotaProspectoRow[],
  dateRange: DateRange | undefined,
  selectedOperadores: Set<string>,
  resolveOperador: (raw: string | null) => string | null,
  granularity: ProspectosTimeGranularity = resolveProspectosTimeGranularity(
    dateRange,
  ),
): OperadorAsignacionesPorDia[] {
  const buckets = buildDayBuckets(dateRange, granularity);
  if (buckets.length === 0) return [];

  const byDayOperadorZona = buckets.map(() => new Map<string, Map<string, number>>());

  for (const p of prospectos) {
    const ymd = prospectAsignadoLimaYmd(p);
    if (!ymd) continue;
    const operador = resolveOperador(p.operador);
    if (!operador || !selectedOperadores.has(operador)) continue;
    const zonaRaw = p.distrito?.trim();
    if (!zonaRaw) continue;
    const zona = normalizeDistritoLabel(zonaRaw);
    if (!zona) continue;

    const bucketIdx = buckets.findIndex((b) => b.match(ymd));
    if (bucketIdx < 0) continue;

    const dayMap = byDayOperadorZona[bucketIdx];
    if (!dayMap.has(operador)) dayMap.set(operador, new Map());
    const zonaMap = dayMap.get(operador)!;
    zonaMap.set(zona, (zonaMap.get(zona) ?? 0) + 1);
  }

  return buckets.map((bucket, idx) => {
    const dayMap = byDayOperadorZona[idx];
    const operadores = [...dayMap.entries()]
      .map(([operador, zonaMap]) => {
        const zonas = [...zonaMap.entries()]
          .map(([zona, count]) => ({ zona, count }))
          .sort((a, b) => b.count - a.count);
        const total = zonas.reduce((s, z) => s + z.count, 0);
        return { operador, total, zonas };
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total);

    return { dayLabel: bucket.label, operadores };
  });
}

export const OPERADOR_ACTIVITY_COLORS = [
  '#065f46',
  '#059669',
  '#13944C',
  '#22c55e',
  '#4ade80',
  '#86efac',
] as const;
