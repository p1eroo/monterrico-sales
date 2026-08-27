import type { Client, ClientStatus, CompanyRubro, CompanyTipo } from '@/types';
import { api } from './api';

export type ApiClientRow = {
  id: string;
  companyId: string;
  companyUrlSlug: string;
  company: string;
  ruc?: string;
  companyRubro?: string;
  companyTipo?: string;
  contactName: string;
  phone: string;
  email: string;
  status: string;
  assignedTo: string;
  assignedToName: string;
  service: string;
  createdAt: string;
  totalRevenue: number;
  notes?: string;
  lastActivity?: string;
};

function parseTipo(raw: string | undefined): CompanyTipo | undefined {
  if (raw === 'A' || raw === 'B' || raw === 'C') return raw;
  return undefined;
}

function parseStatus(raw: string): ClientStatus {
  if (raw === 'activo' || raw === 'inactivo' || raw === 'potencial') return raw;
  return 'activo';
}

export function mapApiClientRow(row: ApiClientRow): Client {
  const rubro = row.companyRubro?.trim();
  return {
    id: row.id,
    companyId: row.companyId,
    companyUrlSlug: row.companyUrlSlug,
    company: row.company,
    ruc: row.ruc?.trim() || undefined,
    companyRubro: rubro ? (rubro as CompanyRubro) : undefined,
    companyTipo: parseTipo(row.companyTipo?.trim()),
    contactName: row.contactName ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    status: parseStatus(row.status),
    assignedTo: row.assignedTo,
    assignedToName: row.assignedToName,
    service: row.service ?? '',
    createdAt: row.createdAt,
    totalRevenue: row.totalRevenue,
    notes: row.notes,
    lastActivity: row.lastActivity,
  };
}

export async function fetchClients(): Promise<Client[]> {
  const rows = await api<ApiClientRow[]>('/clients');
  return rows.map(mapApiClientRow);
}

export async function updateClientApi(
  id: string,
  payload: { status?: ClientStatus; notes?: string | null },
): Promise<Client> {
  const row = await api<ApiClientRow>(`/clients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return mapApiClientRow(row);
}

export type ExternalClientRow = {
  idclienteempresa: number;
  codigoempresa: string;
  rucempresa?: string;
  logoempresa?: string;
  razonsocial: string;
  nombrecomercial: string;
  contacto: string;
  contactoemail: string;
  telefono?: string;
  asesorresponsable: string;
  fechor: string;
  tipopagodetalle?: string;
  idcondicion?: boolean;
  monto?: number;
  mes1?: string;
  monto1?: number;
  mes2?: string;
  monto2?: number;
  mes3?: string;
  monto3?: number;
  mes4?: string;
  monto4?: number;
  mes5?: string;
  monto5?: number;
};

export type ClienteEmpresaFullExportRow = {
  Empresa: string;
  RUC: string;
  Contacto: string;
  Telefono: string;
  Email: string;
  Estado: string;
};

export type ExternalApiResponse = {
  detalle: string;
  ARegistrados: ExternalClientRow[];
};

const EXTERNAL_CLIENTES_URL =
  'https://api.taximonterrico.com/api/WClientes/Registrados';

/** Usuarios con acceso a exportación full de cartera (hardcodeado). */
const CLIENTE_EMPRESAS_FULL_EXPORT_USERS = new Set(['asystem', 'latoche']);

export function canClienteEmpresasFullExport(username?: string | null): boolean {
  const normalized = username?.trim().toLowerCase();
  return !!normalized && CLIENTE_EMPRESAS_FULL_EXPORT_USERS.has(normalized);
}

/** Incluye RUC 10, 20, etc.; solo excluye el placeholder `0` de la API externa. */
export function isExportableClienteRuc(ruc?: string | null): boolean {
  return (ruc ?? '').trim() !== '0';
}

function mapExternalClientEstado(idcondicion?: boolean): string {
  return idcondicion === false ? 'Inactivo' : 'Activo';
}

export function mapExternalClientToFullExportRow(
  row: ExternalClientRow,
): ClienteEmpresaFullExportRow {
  return {
    Empresa: row.nombrecomercial?.trim() || row.razonsocial?.trim() || '',
    RUC: row.rucempresa?.trim() || '',
    Contacto: row.contacto?.trim() || '',
    Telefono: row.telefono?.trim() || '',
    Email: row.contactoemail?.trim() || '',
    Estado: mapExternalClientEstado(row.idcondicion),
  };
}

async function fetchExternalClientRows(
  agente: string,
  condicion: 1 | 2,
): Promise<ExternalClientRow[]> {
  const url = `${EXTERNAL_CLIENTES_URL}?agente=${encodeURIComponent(agente)}&condicion=${condicion}&limit=5000`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error API externa: ${response.statusText}`);
  }
  const data = (await response.json()) as ExternalApiResponse;
  return data.ARegistrados ?? [];
}

/**
 * Obtiene clientes activos desde la API externa de Taxi Monterrico.
 */
export async function fetchExternalClients(agente: string): Promise<ExternalClientRow[]> {
  try {
    return await fetchExternalClientRows(agente, 1);
  } catch (error) {
    console.error('Error fetching external clients:', error);
    // Devolvemos array vacío para no bloquear la carga de clientes locales si falla la externa
    return [];
  }
}

/**
 * Obtiene clientes activos e inactivos (condicion=2) para exportación full.
 */
export async function fetchExternalClientsFull(
  agente: string,
): Promise<ExternalClientRow[]> {
  return fetchExternalClientRows(agente, 2);
}
