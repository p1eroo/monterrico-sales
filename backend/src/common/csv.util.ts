/** CSV RFC4180-ish: comas, comillas dobles, saltos de línea en campos. */

export function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '');
}

export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '_');
}

export function escapeCsvCell(v: string): string {
  const needs =
    v.includes(',') || v.includes('"') || v.includes('\n') || v.includes('\r');
  if (!needs) return v;
  return `"${v.replace(/"/g, '""')}"`;
}

export function stringifyCsvRow(fields: string[]): string {
  return fields.map(escapeCsvCell).join(',');
}

/** Devuelve filas; cada fila es lista de celdas (sin trim aplicado a comillas internas). */
export function parseCsv(text: string): string[][] {
  const s = stripBom(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };

  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < s.length) {
    const c = s[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      pushField();
      i += 1;
      continue;
    }
    if (c === '\r') {
      i += 1;
      continue;
    }
    if (c === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  pushField();
  if (row.length > 1 || (row[0] != null && row[0] !== '')) {
    rows.push(row);
  }
  return rows;
}

export function buildHeaderIndex(headerRow: string[]): Map<string, number> {
  const m = new Map<string, number>();
  headerRow.forEach((h, idx) => {
    const k = normalizeHeader(h);
    if (k && !m.has(k)) m.set(k, idx);
  });
  return m;
}

export function rowGet(
  row: string[],
  headerIndex: Map<string, number>,
  aliases: string[],
): string {
  for (const a of aliases) {
    const k = normalizeHeader(a);
    const idx = headerIndex.get(k);
    if (idx !== undefined && idx < row.length) {
      return (row[idx] ?? '').trim();
    }
  }
  return '';
}
