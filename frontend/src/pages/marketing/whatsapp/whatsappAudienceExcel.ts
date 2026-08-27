import * as XLSX from 'xlsx';
import type { WhatsAppContact } from './mockData';

function normKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function headerToField(h: string): 'name' | 'phone' | 'company' | null {
  const k = normKey(h);
  if (!k) return null;
  if (['nombre', 'name', 'contacto', 'contact', 'cliente'].includes(k)) return 'name';
  if (
    ['telefono', 'teléfono', 'phone', 'movil', 'móvil', 'celular', 'whatsapp', 'numero', 'número', 'cel'].includes(k)
  ) {
    return 'phone';
  }
  if (['empresa', 'company', 'organizacion', 'organización', 'compania', 'compañía', 'formulario'].includes(k)) {
    return 'company';
  }
  return null;
}

/** Normaliza a dígitos locales Perú (9 dígitos) o cadena internacional para el backend. */
export function normalizeWhatsAppPhone(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('51')) return digits.slice(2);
  if (digits.length === 9 && digits.startsWith('9')) return digits;
  if (digits.length === 10 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

export function formatWhatsAppPhoneDisplay(phone: string | null | undefined): string {
  if (phone == null || !String(phone).trim()) return '—';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '—';
  if (digits.length === 9) {
    return `+51 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('51')) {
    const local = digits.slice(2);
    return `+51 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return phone.startsWith('+') ? phone : `+${digits}`;
}

export type WhatsAppAudienceParseResult = {
  contacts: WhatsAppContact[];
  skipped: number;
  errors: string[];
};

export function downloadWhatsAppAudienceTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['nombre', 'telefono', 'empresa'],
    ['Juan Pérez', '987654321', 'Empresa ABC'],
    ['María García', '51912345678', ''],
  ]);
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Audiencia');
  XLSX.writeFile(wb, 'plantilla-whatsapp-masivo.xlsx');
}

export async function parseWhatsAppAudienceFromFile(file: File): Promise<WhatsAppAudienceParseResult> {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
    return { contacts: [], skipped: 0, errors: ['Usa un archivo Excel (.xlsx o .xls).'] };
  }

  const buffer = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array' });
  } catch {
    return { contacts: [], skipped: 0, errors: ['No se pudo leer el archivo Excel.'] };
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { contacts: [], skipped: 0, errors: ['El libro no tiene hojas.'] };
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], {
    defval: '',
    raw: false,
  });

  if (rows.length === 0) {
    return { contacts: [], skipped: 0, errors: ['La hoja está vacía.'] };
  }

  const headerKeys = Object.keys(rows[0]);
  const keyByField = new Map<'name' | 'phone' | 'company', string>();
  for (const k of headerKeys) {
    const field = headerToField(k);
    if (field && !keyByField.has(field)) keyByField.set(field, k);
  }

  if (!keyByField.has('name') || !keyByField.has('phone')) {
    const sample = headerKeys.slice(0, 8).join(', ');
    return {
      contacts: [],
      skipped: 0,
      errors: [
        `Columnas requeridas: nombre y teléfono. Detectadas: ${sample || '(ninguna)'}.`,
      ],
    };
  }

  const contacts: WhatsAppContact[] = [];
  let skipped = 0;
  const seenPhones = new Set<string>();
  const prefix = `xl-${Date.now()}`;

  rows.forEach((rawRow, idx) => {
    const pick = (field: 'name' | 'phone' | 'company') => {
      const key = keyByField.get(field);
      if (!key) return '';
      const v = rawRow[key];
      return v == null ? '' : String(v).trim();
    };

    const name = pick('name');
    const phoneRaw = pick('phone');
    const company = pick('company') || undefined;
    const phone = normalizeWhatsAppPhone(phoneRaw);

    if (!name || !phone) {
      skipped += 1;
      return;
    }

    const dedupeKey = phone.length === 9 ? `51${phone}` : phone;
    if (seenPhones.has(dedupeKey)) {
      skipped += 1;
      return;
    }
    seenPhones.add(dedupeKey);

    contacts.push({
      id: `${prefix}-${idx}`,
      name,
      phone,
      company,
      source: 'excel',
      hasWhatsApp: true,
    });
  });

  if (contacts.length === 0) {
    return {
      contacts: [],
      skipped,
      errors: ['No se encontraron filas válidas con nombre y teléfono.'],
    };
  }

  return { contacts, skipped, errors: [] };
}
