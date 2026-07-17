import { api } from './api';
import type { ImportJob } from './importExportApi';

export const MODALIDAD_OPTIONS: { label: string; value: string }[] = [
  { label: 'ATU', value: 'ATU' },
  { label: 'PARTICULAR', value: 'PARTICULAR' },
  { label: 'SETARE', value: 'SETARE' },
];

export const MODALIDAD_VALUES = MODALIDAD_OPTIONS.map((o) => o.value);

export const CIUDAD_OPTIONS: { label: string; value: string }[] = [
  { label: 'Lima', value: 'Lima' },
  { label: 'Arequipa', value: 'Arequipa' },
];

export const CIUDAD_VALUES = CIUDAD_OPTIONS.map((o) => o.value);

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
  placa: string | null;
  aireAcondicionado: string | null;
  distrito: string | null;
  ciudad: string | null;
  asignadoAt?: string | null;
  fechaCita: string | null;
  asistencia: string | null;
  fechaAfiliacion: string | null;
  movil: string | null;
  observaciones: string | null;
  esDuplicado: boolean;
  origen: string;
  createdAt: string;
  updatedAt: string;
  chatwootContactId?: number | null;
  chatwootConversationId?: number | null;
  _count?: { llamadas: number; archivos?: number };
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
  operadores: string[];
  modalidades: string[];
  nuevosEsteMes: number;
  nuevosMesPasado: number;
}

export interface ImportSheetsResult {
  total: number;
  imported: number;
  updated: number;
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
  mesImport?: string;
  fechaRegistroDesde?: string;
  fechaRegistroHasta?: string;
  mesImportDesde?: string;
  mesImportHasta?: string;
  redSocial?: string;
  operador?: string;
  filters?: Record<string, string>;
  conLlamadas?: string;
  signal?: AbortSignal;
}): Promise<FlotaProspectosListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.search) qs.set('search', params.search);
  if (params.estado) qs.set('estado', params.estado);
  if (params.duplicados) qs.set('duplicados', 'true');
  if (params.mes) qs.set('mes', params.mes);
  if (params.mesImport) qs.set('mesImport', params.mesImport);
  if (params.fechaRegistroDesde) qs.set('fechaRegistroDesde', params.fechaRegistroDesde);
  if (params.fechaRegistroHasta) qs.set('fechaRegistroHasta', params.fechaRegistroHasta);
  if (params.mesImportDesde) qs.set('mesImportDesde', params.mesImportDesde);
  if (params.mesImportHasta) qs.set('mesImportHasta', params.mesImportHasta);
  if (params.redSocial) qs.set('redSocial', params.redSocial);
  if (params.operador) qs.set('operador', params.operador);
  if (params.filters) qs.set('filters', JSON.stringify(params.filters));
  if (params.conLlamadas) qs.set('conLlamadas', params.conLlamadas);
  return api<FlotaProspectosListResponse>(
    `/flota-prospectos?${qs.toString()}`,
    params.signal ? { signal: params.signal } : undefined,
  );
}

export interface SheetsSpreadsheet {
  id: string;
  name: string;
}

export async function flotaProspectosSpreadsheets(): Promise<{ spreadsheets: SheetsSpreadsheet[] }> {
  return api<{ spreadsheets: SheetsSpreadsheet[] }>('/flota/spreadsheets');
}

export async function flotaProspectosCounts(): Promise<FlotaProspectosCounts> {
  return api<FlotaProspectosCounts>('/flota-prospectos/counts');
}

export async function flotaProspectosImportSheets(
  sheetName?: string,
  spreadsheetId?: string,
): Promise<ImportJob> {
  const qs = new URLSearchParams();
  if (spreadsheetId) qs.set('spreadsheetId', spreadsheetId);
  const qsStr = qs.toString();
  return api<ImportJob>(`/flota/import/${encodeURIComponent(sheetName || '')}${qsStr ? '?' + qsStr : ''}`, {
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
  spreadsheetId?: string,
): Promise<SheetPreviewResponse> {
  const qs = new URLSearchParams();
  if (spreadsheetId) qs.set('spreadsheetId', spreadsheetId);
  const qsStr = qs.toString();
  return api<SheetPreviewResponse>(`/flota/preview/${encodeURIComponent(sheetName)}${qsStr ? '?' + qsStr : ''}`);
}

export async function flotaProspectosImportRows(rows: any[][]): Promise<ImportJob> {
  return api<ImportJob>('/flota/import-rows', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
}

export async function flotaProspectosSheetNames(spreadsheetId?: string): Promise<{ sheets: string[] }> {
  const qs = new URLSearchParams();
  if (spreadsheetId) qs.set('spreadsheetId', spreadsheetId);
  const qsStr = qs.toString();
  return api<{ sheets: string[] }>(`/flota/sheets${qsStr ? '?' + qsStr : ''}`);
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

export interface FlotaFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  entityType: string;
  entityId: string;
  storageKey: string;
  createdAt: string;
  user?: { id: string; name: string };
}

export async function flotaProspectoFiles(prospectoId: string): Promise<FlotaFile[]> {
  const qs = `entityType=flota-prospecto&entityId=${encodeURIComponent(prospectoId)}`;
  return api<FlotaFile[]>(`/files?${qs}`);
}

export async function flotaProspectoFileContentUrl(fileId: string): Promise<{ url: string }> {
  return api<{ url: string }>(`/files/${fileId}/url`);
}

export async function flotaProspectoUploadFile(
  prospectoId: string,
  file: File,
): Promise<FlotaFile> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('entityType', 'flota-prospecto');
  formData.append('entityId', prospectoId);
  return api<FlotaFile>('/files', {
    method: 'POST',
    body: formData,
  });
}

export interface OperadorUser {
  id: string;
  name: string;
  username: string;
}

export async function fetchOperadores(): Promise<OperadorUser[]> {
  return api<OperadorUser[]>('/flota-prospectos/operadores');
}

export interface FlotaProspectoDetalle {
  id: string; nombreCompleto: string; celular: string | null; operador: string | null; estado: string;
  edad?: number | null; modalidad?: string | null; placa?: string | null; aireAcondicionado?: string | null; anioVehiculo?: number | null;
  distrito?: string | null; ciudad?: string | null; fechaCita?: string | null; movil?: string | null; observaciones?: string | null;
  asistencia?: string | null; llamadaCount?: number;
  eliminadoAt?: string | null;
}

export async function flotaProspectosByPhone(phone: string): Promise<{ found: boolean; prospecto: FlotaProspectoDetalle | null }> {
  return api(`/flota-prospectos/by-phone/${encodeURIComponent(phone)}`);
}

/** Busca el nombre canónico de un operador, matcheando por username, nombre completo o primer nombre */
export function getOperatorDisplayName(
  value: string | null | undefined,
  operadores: OperadorUser[],
): string {
  if (!value?.trim()) return '';
  const v = value.trim().toLowerCase();

  // 1. match exacto por username
  let match = operadores.find((op) => op.username?.toLowerCase() === v);
  if (match) return match.name;

  // 2. match exacto por nombre completo
  match = operadores.find((op) => op.name.toLowerCase() === v);
  if (match) return match.name;

  // 3. match por primer nombre (solo si hay 1 resultado para evitar ambigüedad)
  const firstNameMatches = operadores.filter((op) => {
    const first = op.name.toLowerCase().split(' ')[0];
    return first === v;
  });
  if (firstNameMatches.length === 1) return firstNameMatches[0].name;

  // 4. match parcial por username (ej: "pmedrano" → "pmedranop"), mínimo 3 caracteres
  if (v.length >= 3) {
    const partial = operadores.filter((op) => {
      const u = op.username?.toLowerCase();
      return u && (u.startsWith(v) || v.startsWith(u));
    });
    if (partial.length === 1) return partial[0].name;
  }

  // 5. match por fragmentos del nombre (ej: "pmedranop" contiene partes de "paul medrano")
  const fragmentMatch = operadores.filter((op) => {
    const opLower = op.name.toLowerCase();
    const opParts = opLower.split(/\s+/).filter(Boolean);
    const opNorm = opLower.replace(/\s+/g, '');
    const vNorm = v.replace(/\s+/g, '');
    // Check if normalized strings overlap significantly
    return (
      opNorm.startsWith(vNorm) || vNorm.startsWith(opNorm) ||
      opNorm.includes(vNorm) || vNorm.includes(opNorm) ||
      opParts.some(p => v.length >= 3 && v.includes(p)) ||
      opParts.some(p => p.length >= 3 && p.includes(v))
    );
  });
  if (fragmentMatch.length === 1) return fragmentMatch[0].name;

  // 6. sin match → devolver valor original capitalizando primera letra
  const raw = value.trim();
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

export interface OperadorStats {
  operador: string;
  prospectosAsignados: number;
  chatsActivos: number;
  mensajesEnviados: number;
  mensajesRecibidos: number;
  llamadas: number;
  citasProgramadas: number;
}

export interface OperadorStatsDailyRow extends OperadorStats {
  fecha: string;
}

export async function fetchOperadorStats(fecini: string, fecfin: string): Promise<OperadorStats[]> {
  return api(`/flota-prospectos/operador-stats?fecini=${fecini}&fecfin=${fecfin}`);
}

export async function fetchOperadorStatsDaily(
  fecini: string,
  fecfin: string,
): Promise<OperadorStatsDailyRow[]> {
  return api(`/flota-prospectos/operador-stats/daily?fecini=${fecini}&fecfin=${fecfin}`);
}

export interface FlotaLlamada {
  id: string;
  prospectoId: string;
  userName: string;
  notas: string | null;
  createdAt: string;
}

export async function flotaLlamadasList(prospectoId: string): Promise<FlotaLlamada[]> {
  return api(`/flota-prospectos/${prospectoId}/llamadas`);
}

export async function flotaLlamadaCreate(prospectoId: string, data: { notas?: string | null; createdAt?: string | null }): Promise<FlotaLlamada> {
  return api(`/flota-prospectos/${prospectoId}/llamadas`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface CalendarCita {
  id: string;
  nombreCompleto: string;
  celular: string | null;
  fechaCita: string;
  distrito: string | null;
  redSocial: string | null;
  modalidad: string | null;
  anioVehiculo: number | null;
  operador: string | null;
  asistencia: string | null;
}

export async function flotaCalendarCitas(): Promise<CalendarCita[]> {
  return api('/flota/calendario-citas');
}

export interface FlotaProspectoConArchivosResponse {
  prospecto: FlotaProspectoRow;
  archivos: FlotaFile[];
}

export async function flotaProspectoConArchivos(
  id: string,
): Promise<FlotaProspectoConArchivosResponse> {
  return api<FlotaProspectoConArchivosResponse>(`/flota-prospectos/${id}/con-archivos`);
}
