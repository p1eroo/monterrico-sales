/**
 * Interpreta fechas enviadas desde inputs type="date" (solo "YYYY-MM-DD").
 * Evita el desfase de `new Date("YYYY-MM-DD")` (medianoche UTC → día distinto en Perú).
 */
export function parseDateOnlyToUtcNoon(raw: string): Date {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map((x) => Number(x));
    if (
      !Number.isFinite(y) ||
      !Number.isFinite(m) ||
      !Number.isFinite(d) ||
      m < 1 ||
      m > 12 ||
      d < 1 ||
      d > 31
    ) {
      return new Date(NaN);
    }
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  }
  return new Date(s);
}

function toUtcNoon(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

function excelSerialToUtcNoon(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const utcDays = Math.floor(serial - 25569);
  const base = new Date(utcDays * 86400 * 1000);
  if (Number.isNaN(base.getTime())) return null;
  return toUtcNoon(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate(),
  );
}

/**
 * Interpreta fechas de celdas en importaciones (Excel/CSV).
 * Soporta serial Excel (46227), dd/mm/yy, dd/mm/yyyy e ISO yyyy-mm-dd.
 */
export function parseImportDateCell(raw: string | undefined | null): Date | null {
  const input = (raw ?? '').trim();
  if (!input) return null;

  const asNumber = Number(input.replace(/\s+/g, ''));
  if (/^\d+(?:\.\d+)?$/.test(input.replace(/\s+/g, '')) && asNumber > 1000) {
    const fromSerial = excelSerialToUtcNoon(asNumber);
    if (fromSerial) return fromSerial;
  }

  const isoMatch = input.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      const d = toUtcNoon(year, month - 1, day);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  const dmyMatch = input.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const yearPart = dmyMatch[3];
    const year = yearPart
      ? Number(yearPart) < 100
        ? 2000 + Number(yearPart)
        : Number(yearPart)
      : new Date().getFullYear();
    if (
      Number.isFinite(day) &&
      Number.isFinite(month) &&
      Number.isFinite(year) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      const d = toUtcNoon(year, month - 1, day);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  const iso = new Date(input);
  if (!Number.isNaN(iso.getTime())) {
    return toUtcNoon(iso.getFullYear(), iso.getMonth(), iso.getDate());
  }

  return null;
}
