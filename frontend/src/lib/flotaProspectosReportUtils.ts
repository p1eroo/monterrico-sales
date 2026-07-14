import { parseISO, eachMonthOfInterval, startOfMonth, endOfMonth, format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import type { FlotaProspectoRow } from '@/lib/flotaProspectosApi';
import {
  calendarDateToLimaYmd,
  dateRangeToLimaYmdBounds,
  instantToLimaYmd,
  parseDayStartLima,
} from '@/lib/crmTimezone';

export const FLOTA_ZONA_CHART_TOP_N = 10;
export const FLOTA_FUENTE_CHART_TOP_N = 10;
export const FLOTA_TIME_SERIES_TOP_N = 5;

export type ProspectosTimeGranularity = 'day' | 'month';

export const FLOTA_DAY_CHART_MAX_DAYS = 45;

export function prospectLimaYmd(p: FlotaProspectoRow): string {
  if (p.fechaRegistro) {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(p.fechaRegistro.trim());
    if (m) return m[1];
    return instantToLimaYmd(parseISO(p.fechaRegistro));
  }
  return instantToLimaYmd(new Date(p.createdAt));
}

export function prospectAfiliacionLimaYmd(p: FlotaProspectoRow): string | null {
  if (!p.fechaAfiliacion) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(p.fechaAfiliacion.trim());
  if (m) return m[1];
  return instantToLimaYmd(parseISO(p.fechaAfiliacion));
}

export function prospectAsignadoLimaYmd(p: FlotaProspectoRow): string | null {
  if (!p.asignadoAt) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(p.asignadoAt).trim());
  if (m) return m[1];
  return instantToLimaYmd(parseISO(String(p.asignadoAt)));
}

export function getLimaRangeYmd(
  dateRange: DateRange | undefined,
): { from: string; to: string } | null {
  const bounds = dateRangeToLimaYmdBounds(dateRange);
  if (!bounds.from || !bounds.to) return null;
  return { from: bounds.from, to: bounds.to };
}

export function isYmdInInclusiveRange(
  ymd: string,
  from: string,
  to: string,
): boolean {
  return ymd >= from && ymd <= to;
}

export function filterProspectosInLimaRange(
  prospectos: FlotaProspectoRow[],
  dateRange: DateRange | undefined,
): FlotaProspectoRow[] {
  const range = getLimaRangeYmd(dateRange);
  if (!range) return [];
  return prospectos.filter((p) =>
    isYmdInInclusiveRange(prospectLimaYmd(p), range.from, range.to),
  );
}

/** Unifica variantes de texto (SURCO / surco → Surco). */
export function normalizeDistritoLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export type ProspectosCountRow = { name: string; count: number };

export type ProspectosByZonaBarData = {
  chartRows: ProspectosCountRow[];
  allZones: ProspectosCountRow[];
  totalInRange: number;
};

export function buildProspectosByZonaBarData(
  prospectos: FlotaProspectoRow[],
  dateRange: DateRange | undefined,
  topN = FLOTA_ZONA_CHART_TOP_N,
): ProspectosByZonaBarData {
  const empty: ProspectosByZonaBarData = {
    chartRows: [],
    allZones: [],
    totalInRange: 0,
  };

  const filtered = filterProspectosInLimaRange(prospectos, dateRange);
  if (filtered.length === 0) return empty;

  const map = new Map<string, number>();
  for (const p of filtered) {
    if (!p.distrito?.trim()) continue;
    const zona = normalizeDistritoLabel(p.distrito);
    if (!zona) continue;
    map.set(zona, (map.get(zona) ?? 0) + 1);
  }

  const allZones = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  if (allZones.length === 0) return empty;

  let chartRows: ProspectosCountRow[];
  if (allZones.length > topN) {
    const top = allZones.slice(0, topN);
    const othersCount = allZones.slice(topN).reduce((sum, z) => sum + z.count, 0);
    const othersLabel = `Otros (${allZones.length - topN} zonas)`;
    chartRows = [...top, { name: othersLabel, count: othersCount }];
  } else {
    chartRows = allZones;
  }

  return {
    chartRows,
    allZones,
    totalInRange: filtered.length,
  };
}

export function prospectosByZonaBarHasData(data: ProspectosByZonaBarData): boolean {
  return data.allZones.length > 0;
}

export type ProspectosByFuenteBarData = {
  chartRows: ProspectosCountRow[];
  allFuentes: ProspectosCountRow[];
  totalInRange: number;
};

export function buildProspectosByFuenteBarData(
  prospectos: FlotaProspectoRow[],
  dateRange: DateRange | undefined,
  topN = FLOTA_FUENTE_CHART_TOP_N,
): ProspectosByFuenteBarData {
  const empty: ProspectosByFuenteBarData = {
    chartRows: [],
    allFuentes: [],
    totalInRange: 0,
  };

  const filtered = filterProspectosInLimaRange(prospectos, dateRange);
  if (filtered.length === 0) return empty;

  const map = new Map<string, number>();
  for (const p of filtered) {
    if (!p.redSocial?.trim()) continue;
    const fuente = p.redSocial.trim();
    map.set(fuente, (map.get(fuente) ?? 0) + 1);
  }

  const allFuentes = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  if (allFuentes.length === 0) return empty;

  let chartRows: ProspectosCountRow[];
  if (allFuentes.length > topN) {
    const top = allFuentes.slice(0, topN);
    const othersCount = allFuentes.slice(topN).reduce((sum, f) => sum + f.count, 0);
    const othersLabel = `Otros (${allFuentes.length - topN} fuentes)`;
    chartRows = [...top, { name: othersLabel, count: othersCount }];
  } else {
    chartRows = allFuentes;
  }

  return {
    chartRows,
    allFuentes,
    totalInRange: filtered.length,
  };
}

export function prospectosByFuenteBarHasData(
  data: ProspectosByFuenteBarData,
): boolean {
  return data.allFuentes.length > 0;
}

export type ProspectosTimeSeriesData = {
  categories: string[];
  series: { name: string; data: number[] }[];
  hasData: boolean;
};

function nextYmd(ymd: string): string {
  const start = parseDayStartLima(ymd);
  return instantToLimaYmd(new Date(start.getTime() + 86_400_000));
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

function countDaysInLimaRange(from: string, to: string): number {
  return eachDayYmdInRange(from, to).length;
}

/** Día a día si el rango es corto; por mes si abarca muchos días. */
export function resolveProspectosTimeGranularity(
  dateRange: DateRange | undefined,
): ProspectosTimeGranularity {
  const range = getLimaRangeYmd(dateRange);
  if (!range) return 'day';
  return countDaysInLimaRange(range.from, range.to) > FLOTA_DAY_CHART_MAX_DAYS
    ? 'month'
    : 'day';
}

export function prospectosTimeGranularityLabel(
  granularity: ProspectosTimeGranularity,
): string {
  return granularity === 'day' ? 'por día' : 'por mes';
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

function buildProspectosTimeSeries(
  filtered: FlotaProspectoRow[],
  granularity: ProspectosTimeGranularity,
  range: { from: string; to: string },
  getCategory: (p: FlotaProspectoRow) => string | null,
  topN = FLOTA_TIME_SERIES_TOP_N,
): ProspectosTimeSeriesData {
  const empty: ProspectosTimeSeriesData = {
    categories: [],
    series: [],
    hasData: false,
  };

  const catTotals = new Map<string, number>();
  for (const p of filtered) {
    const cat = getCategory(p);
    if (!cat) continue;
    catTotals.set(cat, (catTotals.get(cat) ?? 0) + 1);
  }

  const topCats = [...catTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name);
  const topSet = new Set(topCats);

  if (granularity === 'day') {
    const days = eachDayYmdInRange(range.from, range.to);
    const categories = days.map(formatDayLabel);
    const buckets = days.map((ymd) => ({ fromYmd: ymd, toYmd: ymd }));
    return aggregateTimeBuckets(filtered, categories, buckets, getCategory, topSet, topCats);
  }

  const months = eachMonthBucketsInRange(range.from, range.to);
  const categories = months.map((m) => m.label);
  const buckets = months.map((m) => ({ fromYmd: m.fromYmd, toYmd: m.toYmd }));
  return aggregateTimeBuckets(filtered, categories, buckets, getCategory, topSet, topCats);
}

function aggregateTimeBuckets(
  filtered: FlotaProspectoRow[],
  categories: string[],
  buckets: { fromYmd: string; toYmd: string }[],
  getCategory: (p: FlotaProspectoRow) => string | null,
  topSet: Set<string>,
  topCats: string[],
): ProspectosTimeSeriesData {
  const seriesNames = topCats.length > 0 ? [...topCats, 'Otros'] : [];
  const matrix = new Map<string, number[]>(
    seriesNames.map((name) => [name, buckets.map(() => 0)]),
  );

  for (const p of filtered) {
    const cat = getCategory(p);
    if (!cat) continue;
    const ymd = prospectLimaYmd(p);
    const bucketIdx = buckets.findIndex(
      (b) => ymd >= b.fromYmd && ymd <= b.toYmd,
    );
    if (bucketIdx < 0) continue;
    const seriesName = topSet.has(cat) ? cat : 'Otros';
    const row = matrix.get(seriesName);
    if (row) row[bucketIdx] += 1;
  }

  const series = seriesNames.map((name) => ({
    name,
    data: matrix.get(name) ?? buckets.map(() => 0),
  }));

  return {
    categories,
    series,
    hasData: series.some((s) => s.data.some((v) => v > 0)),
  };
}

export function buildProspectosByFuenteTimeSeries(
  prospectos: FlotaProspectoRow[],
  dateRange: DateRange | undefined,
  granularity?: ProspectosTimeGranularity,
): ProspectosTimeSeriesData {
  const range = getLimaRangeYmd(dateRange);
  if (!range) {
    return { categories: [], series: [], hasData: false };
  }

  const filtered = filterProspectosInLimaRange(prospectos, dateRange).filter(
    (p) => p.redSocial?.trim(),
  );

  return buildProspectosTimeSeries(
    filtered,
    granularity ?? resolveProspectosTimeGranularity(dateRange),
    range,
    (p) => p.redSocial?.trim() ?? null,
  );
}

export function buildProspectosByZonaTimeSeries(
  prospectos: FlotaProspectoRow[],
  dateRange: DateRange | undefined,
  granularity?: ProspectosTimeGranularity,
): ProspectosTimeSeriesData {
  const range = getLimaRangeYmd(dateRange);
  if (!range) {
    return { categories: [], series: [], hasData: false };
  }

  const filtered = filterProspectosInLimaRange(prospectos, dateRange).filter(
    (p) => p.distrito?.trim(),
  );

  return buildProspectosTimeSeries(
    filtered,
    granularity ?? resolveProspectosTimeGranularity(dateRange),
    range,
    (p) => {
      if (!p.distrito?.trim()) return null;
      return normalizeDistritoLabel(p.distrito);
    },
  );
}

export type DailyConversionData = {
  categories: string[];
  nuevos: number[];
  conversiones: number[];
  hasData: boolean;
};

export function buildDailyConversionTimeSeries(
  prospectos: FlotaProspectoRow[],
  dateRange: DateRange | undefined,
): DailyConversionData {
  const empty: DailyConversionData = {
    categories: [],
    nuevos: [],
    conversiones: [],
    hasData: false,
  };

  const range = getLimaRangeYmd(dateRange);
  if (!range) return empty;

  const granularity = resolveProspectosTimeGranularity(dateRange);

  if (granularity === 'day') {
    const days = eachDayYmdInRange(range.from, range.to);
    const categories = days.map(formatDayLabel);
    const nuevos = days.map((ymd) =>
      prospectos.filter((p) => prospectLimaYmd(p) === ymd).length,
    );
    const conversiones = days.map((ymd) =>
      prospectos.filter((p) => {
        if (p.estado?.toLowerCase() !== 'afiliado') return false;
        const afYmd = prospectAfiliacionLimaYmd(p);
        return afYmd === ymd;
      }).length,
    );
    const hasData = nuevos.some((v) => v > 0) || conversiones.some((v) => v > 0);
    return { categories, nuevos, conversiones, hasData };
  }

  const months = eachMonthBucketsInRange(range.from, range.to);
  const categories = months.map((m) => m.label);
  const nuevos = months.map(({ fromYmd, toYmd }) =>
    prospectos.filter((p) => {
      const ymd = prospectLimaYmd(p);
      return isYmdInInclusiveRange(ymd, fromYmd, toYmd);
    }).length,
  );
  const conversiones = months.map(({ fromYmd, toYmd }) =>
    prospectos.filter((p) => {
      if (p.estado?.toLowerCase() !== 'afiliado') return false;
      const ymd = prospectAfiliacionLimaYmd(p);
      if (!ymd) return false;
      return isYmdInInclusiveRange(ymd, fromYmd, toYmd);
    }).length,
  );
  const hasData = nuevos.some((v) => v > 0) || conversiones.some((v) => v > 0);
  return { categories, nuevos, conversiones, hasData };
}

export type MonthlyProspectsRow = {
  name: string;
  nuevos: number;
  conversion: number;
};

export function buildMonthlyProspectsData(
  prospectos: FlotaProspectoRow[],
  dateRange: DateRange | undefined,
): MonthlyProspectsRow[] {
  if (!dateRange?.from || !dateRange?.to) return [];

  const rangeYmd = getLimaRangeYmd(dateRange);
  if (!rangeYmd) return [];

  const months = eachMonthOfInterval({
    start: startOfMonth(dateRange.from),
    end: startOfMonth(dateRange.to),
  });

  return months.map((m) => {
    const monthStartYmd = calendarDateToLimaYmd(startOfMonth(m));
    const monthEndYmd = calendarDateToLimaYmd(endOfMonth(m));
    const effectiveFrom =
      monthStartYmd > rangeYmd.from ? monthStartYmd : rangeYmd.from;
    const effectiveTo =
      monthEndYmd < rangeYmd.to ? monthEndYmd : rangeYmd.to;

    const nuevos = prospectos.filter((p) => {
      const ymd = prospectLimaYmd(p);
      return isYmdInInclusiveRange(ymd, effectiveFrom, effectiveTo);
    }).length;

    const conversion = prospectos.filter((p) => {
      if (p.estado?.toLowerCase() !== 'afiliado') return false;
      const ymd = prospectAfiliacionLimaYmd(p);
      if (!ymd) return false;
      return isYmdInInclusiveRange(ymd, effectiveFrom, effectiveTo);
    }).length;

    return {
      name: format(m, 'MMM', { locale: es }),
      nuevos,
      conversion,
    };
  });
}
