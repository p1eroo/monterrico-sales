import type { Client, ClientStatus, CompanyRubro, CompanyTipo } from '@/types';
import { companyRubroLabels } from '@/data/mock';
import { api } from './api';

const RUBRO_KEYS = new Set<string>(Object.keys(companyRubroLabels));

export type ApiClientRow = {
  id: string;
  companyId: string;
  companyUrlSlug: string;
  company: string;
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
    companyRubro:
      rubro && RUBRO_KEYS.has(rubro) ? (rubro as CompanyRubro) : undefined,
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
  razonsocial: string;
  nombrecomercial: string;
  contacto: string;
  contactoemail: string;
  telefono?: string;
  asesorresponsable: string;
  fechor: string;
  tipopagodetalle?: string;
  monto?: number;
};

export type ExternalApiResponse = {
  detalle: string;
  ARegistrados: ExternalClientRow[];
};

/**
 * Obtiene clientes registrados desde la API externa de Taxi Monterrico.
 */
export async function fetchExternalClients(agente: string): Promise<ExternalClientRow[]> {
  try {
    // Añadimos un intento de límite alto por si la API lo soporta, para traer "todos"
    const url = `https://api.taximonterrico.com/api/WClientes/Registrados?agente=${agente}&condicion=1&limit=5000`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error API externa: ${response.statusText}`);
    }
    const data = (await response.json()) as ExternalApiResponse;
    return data.ARegistrados || [];
  } catch (error) {
    console.error('Error fetching external clients:', error);
    // Devolvemos array vacío para no bloquear la carga de clientes locales si falla la externa
    return [];
  }
}
