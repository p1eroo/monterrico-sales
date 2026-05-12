import { api } from './api';

export interface FlotaProspectoRow {
  id: string;
  fechaRegistro: string | null;
  redSocial: string | null;
  celular: string | null;
  nombreCompleto: string;
  edad: number | null;
  operador: string | null;
  estado: string;
  modalidad: string | null;
  anioVehiculo: number | null;
  distrito: string | null;
  fechaCita: string | null;
  asistencia: string | null;
  fechaAfiliacion: string | null;
  movil: string | null;
  observaciones: string | null;
  esDuplicado: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FlotaProspectosListResponse {
  data: FlotaProspectoRow[];
  total: number;
  page: number;
  limit: number;
}

export interface FlotaProspectosCounts {
  total: number;
  duplicados: number;
  estadoCounts: Record<string, number>;
  redesSociales: string[];
}

export interface ImportSheetsResult {
  total: number;
  imported: number;
  duplicates: number;
  skipped: number;
  errors: string[];
}

export async function flotaProspectosList(params: {
  page?: number;
  limit?: number;
  search?: string;
  estado?: string;
  duplicados?: boolean;
  mes?: string;
  redSocial?: string;
}): Promise<FlotaProspectosListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.search) qs.set('search', params.search);
  if (params.estado) qs.set('estado', params.estado);
  if (params.duplicados) qs.set('duplicados', 'true');
  if (params.mes) qs.set('mes', params.mes);
  if (params.redSocial) qs.set('redSocial', params.redSocial);
  return api<FlotaProspectosListResponse>(
    `/flota-prospectos?${qs.toString()}`,
  );
}

export async function flotaProspectosCounts(): Promise<FlotaProspectosCounts> {
  return api<FlotaProspectosCounts>('/flota-prospectos/counts');
}

export async function flotaProspectosImportSheets(
  sheetName?: string,
): Promise<ImportSheetsResult> {
  return api<ImportSheetsResult>('/flota/import/' + encodeURIComponent(sheetName || ''), {
    method: 'POST',
  });
}

export interface SheetPreviewResponse {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export async function flotaProspectosSheetPreview(
  sheetName: string,
): Promise<SheetPreviewResponse> {
  return api<SheetPreviewResponse>('/flota/preview/' + encodeURIComponent(sheetName));
}

export async function flotaProspectosSheetNames(): Promise<{ sheets: string[] }> {
  return api<{ sheets: string[] }>('/flota/sheets');
}

export async function flotaProspectoDetail(
  id: string,
): Promise<FlotaProspectoRow> {
  return api<FlotaProspectoRow>(`/flota-prospectos/${id}`);
}

export async function flotaProspectoUpdate(
  id: string,
  data: Partial<FlotaProspectoRow>,
): Promise<FlotaProspectoRow> {
  return api<FlotaProspectoRow>(`/flota-prospectos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function flotaProspectosDeleteMany(
  ids: string[],
): Promise<{ deleted: number }> {
  return api<{ deleted: number }>('/flota-prospectos/delete-many', {
    method: 'POST',
    body: JSON.stringify(ids),
  });
}

export async function flotaProspectoCreate(
  data: Partial<FlotaProspectoRow>,
): Promise<FlotaProspectoRow> {
  return api<FlotaProspectoRow>('/flota-prospectos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
