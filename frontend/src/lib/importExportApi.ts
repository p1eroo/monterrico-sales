import { API_BASE } from '@/lib/api';

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
  const blob = await res.blob();
  const name =
    kind === 'template'
      ? `plantilla-${entity === 'contacts' ? 'contactos' : entity === 'companies' ? 'empresas' : 'oportunidades'}.csv`
      : `${entity === 'contacts' ? 'contactos' : entity === 'companies' ? 'empresas' : 'oportunidades'}-export.csv`;
  triggerBlobDownload(blob, name);
}

/** Vista previa de importación de contactos (sin persistir). */
export async function previewContactsImportCsv(
  file: File,
): Promise<ContactImportPreviewResult> {
  const token = getToken();
  const fd = new FormData();
  fd.append('file', file);
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
  const fd = new FormData();
  fd.append('file', file);
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

/** Sube CSV y devuelve resumen de filas creadas / errores. */
export async function uploadImportCsv(
  entity: 'contacts' | 'companies' | 'opportunities',
  file: File,
): Promise<BulkImportResult> {
  const token = getToken();
  const fd = new FormData();
  fd.append('file', file);
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
  return body as BulkImportResult;
}
