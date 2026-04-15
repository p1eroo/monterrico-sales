import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

export const IMPORT_SPREADSHEET_ACCEPT =
  '.csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '');
}

function escapeCsvCell(value: string): string {
  const needsQuotes =
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r');
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function stringifyCsvRow(fields: string[]): string {
  return fields.map(escapeCsvCell).join(',');
}

function detectDelimiter(text: string): ',' | ';' | '\t' {
  const sample = stripBom(text).split(/\r?\n/, 1)[0] ?? '';
  const counts: Array<{ delimiter: ',' | ';' | '\t'; count: number }> = [
    { delimiter: ',', count: (sample.match(/,/g) ?? []).length },
    { delimiter: ';', count: (sample.match(/;/g) ?? []).length },
    { delimiter: '\t', count: (sample.match(/\t/g) ?? []).length },
  ];
  counts.sort((a, b) => b.count - a.count);
  return counts[0]?.count ? counts[0].delimiter : ',';
}

function parseDelimitedText(text: string, delimiter: ',' | ';' | '\t'): string[][] {
  const input = stripBom(text);
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

  while (i < input.length) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  pushField();
  if (row.length > 1 || (row[0] != null && row[0] !== '')) {
    rows.push(row);
  }
  return rows;
}

function rowsToCsv(rows: unknown[][]): string {
  return rows
    .map((row) =>
      stringifyCsvRow(
        row.map((cell) => (cell == null ? '' : String(cell))),
      ),
    )
    .join('\n');
}

export function parseSpreadsheetDelimitedText(text: string): string[][] {
  return parseDelimitedText(text, detectDelimiter(text));
}

export function spreadsheetRowsToWorkbook(
  rows: unknown[][],
  sheetName: string,
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  return workbook;
}

export async function buildTemplateWorkbookBuffer(params: {
  rows: unknown[][];
  sheetName: string;
  requiredHeaders?: string[];
}): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(params.sheetName.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  const required = new Set(
    (params.requiredHeaders ?? []).map((header) => header.trim().toLowerCase()),
  );

  params.rows.forEach((sourceRow, index) => {
    const row = worksheet.addRow(
      sourceRow.map((cell) => (cell == null ? '' : String(cell))),
    );
    if (index === 0) {
      row.eachCell((cell) => {
        const header = String(cell.value ?? '').trim().toLowerCase();
        const isRequired = required.has(header);
        cell.font = {
          bold: true,
          ...(isRequired ? { color: { argb: 'FF15803D' } } : {}),
        };
      });
    }
  });

  const headerRow = params.rows[0] ?? [];
  worksheet.columns = headerRow.map((cell, index) => {
    const header = cell == null ? '' : String(cell);
    const longestValue = params.rows.reduce((max, row) => {
      const current = row[index] == null ? '' : String(row[index]);
      return Math.max(max, current.length);
    }, header.length);
    return { width: Math.min(Math.max(longestValue + 2, 12), 28) };
  });

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

function decodeTextWithFallback(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function replaceImportExtension(name: string): string {
  return name.replace(/\.[^.]+$/u, '') + '.csv';
}

function normalizeCsvText(text: string): string {
  const rows = parseDelimitedText(text, detectDelimiter(text));
  return rowsToCsv(rows);
}

function workbookToCsv(buffer: ArrayBuffer): string {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array' });
  } catch {
    throw new Error('No se pudo leer el archivo Excel.');
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('El libro Excel no tiene hojas.');
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
  if (rows.length === 0) {
    throw new Error('La hoja Excel está vacía.');
  }
  return rowsToCsv(rows);
}

export async function normalizeImportSpreadsheetFile(file: File): Promise<File> {
  const lowerName = file.name.toLowerCase();
  let csvText: string;

  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    csvText = workbookToCsv(await file.arrayBuffer());
  } else if (lowerName.endsWith('.csv')) {
    const decoded = decodeTextWithFallback(await file.arrayBuffer());
    csvText = normalizeCsvText(decoded);
  } else {
    throw new Error('Usa un archivo CSV o Excel (.xlsx / .xls).');
  }

  return new File([`\uFEFF${csvText}`], replaceImportExtension(file.name), {
    type: 'text/csv;charset=utf-8',
  });
}
