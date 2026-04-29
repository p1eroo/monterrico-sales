import {
  addWeeks,
  endOfISOWeek,
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
} from 'date-fns';

/** Máximo de columnas semana ISO en el export (evita CSV enorme). */
export const MAX_COMPANY_EXPORT_ISO_WEEKS = 120;

export type IsoWeekExportColumn = {
  /** Cabecera en español, ej. `Semana 15` o `Semana 1 (2027)` si el rango cruza años ISO. */
  key: string;
  /** Fin de la semana ISO (domingo 23:59:59.999, según date-fns / TZ del servidor). */
  weekEnd: Date;
  /** Lunes que inicia la semana ISO (para cabeceras y cálculos). */
  weekMonday: Date;
};

/**
 * Columnas semana ISO desde la semana de `minDate` hasta la de `maxDate` (inclusive).
 * Si hay más de {@link MAX_COMPANY_EXPORT_ISO_WEEKS}, se conservan las semanas más recientes.
 */
export function buildIsoWeekExportColumns(
  minDate: Date,
  maxDate: Date,
): IsoWeekExportColumn[] {
  const start = startOfISOWeek(minDate);
  const end = startOfISOWeek(maxDate);
  const raw: { weekMonday: Date; weekEnd: Date }[] = [];
  let cur = start;
  while (cur <= end) {
    raw.push({
      weekMonday: new Date(cur),
      weekEnd: endOfISOWeek(cur),
    });
    cur = addWeeks(cur, 1);
  }
  const trimmed =
    raw.length > MAX_COMPANY_EXPORT_ISO_WEEKS
      ? raw.slice(raw.length - MAX_COMPANY_EXPORT_ISO_WEEKS)
      : raw;

  const isoWeekYears = new Set(
    trimmed.map((r) => getISOWeekYear(r.weekMonday)),
  );
  const showYearInHeader = isoWeekYears.size > 1;

  return trimmed.map((r) => {
    const w = getISOWeek(r.weekMonday);
    const y = getISOWeekYear(r.weekMonday);
    const key = showYearInHeader ? `Semana ${w} (${y})` : `Semana ${w}`;
    return { key, weekEnd: r.weekEnd, weekMonday: r.weekMonday };
  });
}

export type EtapaStep = { t: Date; etapa: string };

/** Construye función escalón: etapa vigente en `instant` (último cambio con t <= instant). */
export function buildEtapaStepFunction(
  createdAt: Date,
  currentEtapa: string,
  etapaAudits: { at: Date; oldValue: string; newValue: string }[],
): (instant: Date) => string {
  const sorted = [...etapaAudits].sort((a, b) => a.at.getTime() - b.at.getTime());
  const initial =
    sorted.length > 0 && sorted[0].oldValue.trim()
      ? sorted[0].oldValue.trim()
      : currentEtapa.trim() || 'lead';
  const steps: EtapaStep[] = [{ t: createdAt, etapa: initial }];
  for (const a of sorted) {
    steps.push({ t: a.at, etapa: a.newValue.trim() || initial });
  }
  return (instant: Date) => {
    let cur = steps[0].etapa;
    for (let i = 1; i < steps.length; i++) {
      if (steps[i].t <= instant) cur = steps[i].etapa;
      else break;
    }
    return cur;
  };
}
