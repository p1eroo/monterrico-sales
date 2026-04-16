import { API_BASE } from '@/lib/api';
import {
  buildTemplateWorkbookBuffer,
  normalizeImportSpreadsheetFile,
  parseSpreadsheetDelimitedText,
} from '@/lib/importSpreadsheet';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export type BulkImportResult = {
  totalRows: number;
  created: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

export type ImportJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type ImportJob = {
  id: string;
  entity: 'contacts' | 'companies' | 'opportunities';
  filename?: string;
  status: ImportJobStatus;
  totalRows: number;
  processedRows: number;
  created: number;
  skipped: number;
  errorCount: number;
  percent: number;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  result?: BulkImportResult;
  errorMessage?: string;
};

export type ContactImportPreviewRow = {
  row: number;
  nombre: string;
  telefono: string;
  correo: string;
  fuente: string;
  etapa: string;
  valorEstimado: number;
  empresaNombre: string;
  empresaRuc: string;
  empresaResumen: string;
  ok: boolean;
  error?: string;
  csvColumns: Record<string, string>;
};

export type ContactImportPreviewResult = {
  totalRows: number;
  skipped: number;
  rows: ContactImportPreviewRow[];
  okCount: number;
  errorCount: number;
};

export type CompanyImportPreviewRow = {
  row: number;
  empresaNombre: string;
  empresaRuc: string;
  empresaResumen: string;
  contactoVista: string;
  etapa: string;
  facturacionEstimada: number;
  ok: boolean;
  error?: string;
  csvColumns: Record<string, string>;
};

export type CompanyImportPreviewResult = {
  totalRows: number;
  skipped: number;
  rows: CompanyImportPreviewRow[];
  okCount: number;
  errorCount: number;
};

async function buildImportFormData(file: File): Promise<FormData> {
  const normalized = await normalizeImportSpreadsheetFile(file);
  const fd = new FormData();
  fd.append('file', normalized, normalized.name);
  return fd;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function templateSheetName(
  entity: 'contacts' | 'companies' | 'opportunities',
): string {
  if (entity === 'contacts') return 'Contactos';
  if (entity === 'companies') return 'Empresas';
  return 'Oportunidades';
}

function templateRequiredHeaders(
  entity: 'contacts' | 'companies' | 'opportunities',
): string[] {
  if (entity === 'contacts') {
    return ['nombre', 'doc_numero', 'valor_estimado'];
  }
  if (entity === 'companies') {
    return ['nombre', 'razon_social', 'ruc'];
  }
  return ['titulo', 'monto', 'etapa'];
}

/** Descarga CSV (plantilla vacía o export con datos). */
export async function downloadImportExportCsv(
  entity: 'contacts' | 'companies' | 'opportunities',
  kind: 'template' | 'export',
): Promise<void> {
  const token = getToken();
  const path =
    kind === 'template'
      ? `/import-export/${entity}/template`
      : `/import-export/${entity}/export`;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText;
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      if (typeof j.message === 'string') msg = j.message;
      else if (Array.isArray(j.message)) msg = j.message.join(', ');
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new Error(msg);
  }
  if (kind === 'template') {
    const text = await res.text();
    const rows = parseSpreadsheetDelimitedText(text);
    const bytes = await buildTemplateWorkbookBuffer({
      rows,
      sheetName: templateSheetName(entity),
      requiredHeaders: templateRequiredHeaders(entity),
    });
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const name = `plantilla-${entity === 'contacts' ? 'contactos' : entity === 'companies' ? 'empresas' : 'oportunidades'}.xlsx`;
    triggerBlobDownload(blob, name);
    return;
  }
  const blob = await res.blob();
  const name = `${entity === 'contacts' ? 'contactos' : entity === 'companies' ? 'empresas' : 'oportunidades'}-export.csv`;
  triggerBlobDownload(blob, name);
}

/** Vista previa de importación de contactos (sin persistir). */
export async function previewContactsImportCsv(
  file: File,
): Promise<ContactImportPreviewResult> {
  const token = getToken();
  const fd = await buildImportFormData(file);
  const res = await fetch(`${API_BASE}/import-export/contacts/preview`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const text = await res.text();
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { message: text };
    }
  }
  if (!res.ok) {
    const err = body as { message?: string | string[] };
    const msg = Array.isArray(err.message)
      ? err.message.join(', ')
      : typeof err.message === 'string'
        ? err.message
        : 'Error al generar vista previa';
    throw new Error(msg);
  }
  return body as ContactImportPreviewResult;
}

/** Vista previa de importación de empresas (sin persistir). */
export async function previewCompaniesImportCsv(
  file: File,
): Promise<CompanyImportPreviewResult> {
  const token = getToken();
  const fd = await buildImportFormData(file);
  const res = await fetch(`${API_BASE}/import-export/companies/preview`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const text = await res.text();
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { message: text };
    }
  }
  if (!res.ok) {
    const err = body as { message?: string | string[] };
    const msg = Array.isArray(err.message)
      ? err.message.join(', ')
      : typeof err.message === 'string'
        ? err.message
        : 'Error al generar vista previa';
    throw new Error(msg);
  }
  return body as CompanyImportPreviewResult;
}

/** Inicia importación asíncrona y devuelve el job creado. */
export async function startImportJob(
  entity: 'contacts' | 'companies' | 'opportunities',
  file: File,
): Promise<ImportJob> {
  const token = getToken();
  const fd = await buildImportFormData(file);
  const res = await fetch(`${API_BASE}/import-export/${entity}/import`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const text = await res.text();
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { message: text };
    }
  }
  if (!res.ok) {
    const err = body as { message?: string | string[] };
    const msg = Array.isArray(err.message)
      ? err.message.join(', ')
      : typeof err.message === 'string'
        ? err.message
        : 'Error al importar';
    throw new Error(msg);
  }
  return body as ImportJob;
}

export async function getImportJob(jobId: string): Promise<ImportJob> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/import-export/jobs/${encodeURIComponent(jobId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { message: text };
    }
  }
  if (!res.ok) {
    const err = body as { message?: string | string[] };
    const msg = Array.isArray(err.message)
      ? err.message.join(', ')
      : typeof err.message === 'string'
        ? err.message
        : 'No se pudo consultar la importación';
    throw new Error(msg);
  }
  return body as ImportJob;
}
