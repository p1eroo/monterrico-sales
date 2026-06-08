import * as XLSX from 'xlsx';
import type { CampaignRecipient, Etapa } from '@/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Mapea cabeceras flexibles (ES/EN) a campos */
function headerToField(h: string): 'name' | 'email' | 'company' | 'etapa' | 'phone' | null {
  const k = normKey(h);
  if (!k) return null;
  if (['nombre', 'name', 'contacto', 'contact'].includes(k)) return 'name';
  if (['email', 'correo', 'e-mail', 'mail'].includes(k)) return 'email';
  if (['empresa', 'company', 'organizacion', 'organización', 'compania', 'compañía'].includes(k)) {
    return 'company';
  }
  if (['etapa', 'estado', 'stage'].includes(k)) return 'etapa';
  if (['telefono', 'teléfono', 'phone', 'movil', 'móvil', 'celular'].includes(k)) return 'phone';
  return null;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && ch === delimiter) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function detectDelimiter(headerLine: string): string {
  const comma = (headerLine.match(/,/g) ?? []).length;
  const semi = (headerLine.match(/;/g) ?? []).length;
  return semi > comma ? ';' : ',';
}

const ETAPA_VALUES = new Set<string>([
  'lead',
  'contacto',
  'reunion_agendada',
  'reunion_efectiva',
  'propuesta_economica',
  'negociacion',
  'licitacion',
  'licitacion_etapa_final',
  'cierre_ganado',
  'firma_contrato',
  'activo',
  'cierre_perdido',
  'inactivo',
]);

function normalizeEtapa(raw: string): Etapa | undefined {
  const v = normKey(raw).replace(/\s+/g, '_');
  if (ETAPA_VALUES.has(v)) return v as Etapa;
  const slug = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '_');
  if (ETAPA_VALUES.has(slug)) return slug as Etapa;
  return undefined;
}

export type CampaignImportParseResult = {
  recipients: CampaignRecipient[];
  skipped: number;
  errors: string[];
};

function rowToRecipient(
  row: Record<string, string>,
  rowIndex: number,
  idPrefix: string,
): CampaignRecipient | null {
  const name = (row.name ?? '').trim();
  const email = (row.email ?? '').trim();
  if (!name || !email) {
    return null;
  }
  const hasInvalidEmail = !EMAIL_RE.test(email);
  const etapaRaw = (row.etapa ?? '').trim();
  const etapa = etapaRaw ? normalizeEtapa(etapaRaw) : undefined;
  return {
    id: `${idPrefix}-${rowIndex}-${email.toLowerCase().slice(0, 24)}`,
    name,
    email,
    phone: row.phone?.trim() || undefined,
    company: row.company?.trim() || undefined,
    etapa,
    hasInvalidEmail,
  };
}

/** Texto CSV (p. ej. export interno) con cabecera: nombre|name, email|correo, opcional empresa|company, etapa, teléfono */
export function parseCampaignRecipientsFromCsv(text: string): CampaignImportParseResult {
  const raw = text.replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { recipients: [], skipped: 0, errors: ['El archivo debe tener cabecera y al menos una fila.'] };
  }
  const delimiter = detectDelimiter(lines[0]);
  const headerCells = parseCsvLine(lines[0], delimiter);
  const fieldByCol: (ReturnType<typeof headerToField>)[] = headerCells.map((h) => headerToField(h));
  if (!fieldByCol.some((f) => f === 'name') || !fieldByCol.some((f) => f === 'email')) {
    return {
      recipients: [],
      skipped: 0,
      errors: [
        'Cabeceras requeridas: columna de nombre (nombre / name) y email (email / correo).',
      ],
    };
  }

  const recipients: CampaignRecipient[] = [];
  let skipped = 0;
  const prefix = `imp-${Date.now()}`;
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    fieldByCol.forEach((field, colIdx) => {
      if (!field) return;
      row[field] = cells[colIdx] ?? '';
    });
    const rec = rowToRecipient(row, i, prefix);
    if (rec) recipients.push(rec);
    else skipped++;
  }
  return { recipients, skipped, errors: [] };
}

/** Primera hoja del libro Excel */
export function parseCampaignRecipientsFromXlsx(buffer: ArrayBuffer): CampaignImportParseResult {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array' });
  } catch {
    return { recipients: [], skipped: 0, errors: ['No se pudo leer el archivo Excel.'] };
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { recipients: [], skipped: 0, errors: ['El libro no tiene hojas.'] };
  }
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });
  if (rows.length === 0) {
    return { recipients: [], skipped: 0, errors: ['La hoja está vacía.'] };
  }

  const headerKeys = Object.keys(rows[0]);
  const originalKeyByField = new Map<
    'name' | 'email' | 'company' | 'etapa' | 'phone',
    string
  >();
  for (const k of headerKeys) {
    const f = headerToField(k);
    if (f && !originalKeyByField.has(f)) originalKeyByField.set(f, k);
  }
  if (!originalKeyByField.has('name') || !originalKeyByField.has('email')) {
    const sample = headerKeys.slice(0, 8).join(', ');
    return {
      recipients: [],
      skipped: 0,
      errors: [
        `Cabeceras requeridas: nombre y email. Columnas detectadas: ${sample || '(ninguna)'}.`,
      ],
    };
  }

  const recipients: CampaignRecipient[] = [];
  let skipped = 0;
  const prefix = `imp-${Date.now()}`;
  rows.forEach((rawRow, idx) => {
    const pick = (field: 'name' | 'email' | 'company' | 'etapa' | 'phone') => {
      const orig = originalKeyByField.get(field);
      if (!orig) return '';
      const v = rawRow[orig];
      return v == null ? '' : String(v).trim();
    };
    const row: Record<string, string> = {
      name: pick('name'),
      email: pick('email'),
      company: pick('company'),
      etapa: pick('etapa'),
      phone: pick('phone'),
    };
    const rec = rowToRecipient(row, idx + 1, prefix);
    if (rec) recipients.push(rec);
    else skipped++;
  });
  return { recipients, skipped, errors: [] };
}
