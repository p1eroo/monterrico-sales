import type { Client, ClientStatus } from '@/types';
import { api } from './api';

export type ClienteEmpresaRow = {
  id: string;
  externalId: number;
  empresa: string;
  ruc?: string;
  telefono?: string;
  email?: string;
  asesor: string;
  agenteSync?: string;
  assignedTo: string;
  assignedToName: string;
  fechaAlta: string;
  ingresos: number;
  ingresosAnual: number;
  mesActual?: string;
  logoUrl?: string;
  status: string;
  contactoNombre?: string;
  servicio?: string;
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

export type ContactoEmpresaRow = {
  id: string;
  externalId: number;
  nombre: string;
  nombres: string;
  apellidos?: string;
  empresa: string;
  empresaLogoUrl?: string;
  telefono?: string;
  email?: string;
  cargo?: string;
  asesor?: string;
  assignedTo: string;
  assignedToName: string;
  clienteEmpresaId: string;
};

export type RefreshEmpresasResponse = {
  ok: boolean;
  empresas: number;
  data: ClienteEmpresaRow[];
};

function parseStatus(raw: string): ClientStatus {
  if (raw === 'activo' || raw === 'inactivo' || raw === 'potencial') return raw;
  return 'activo';
}

export function mapClienteEmpresaToClient(row: ClienteEmpresaRow): Client {
  return {
    id: row.id,
    company: row.empresa,
    ruc: row.ruc,
    contactName: row.contactoNombre || '—',
    phone: row.telefono || '—',
    email: row.email || '—',
    status: parseStatus(row.status),
    assignedTo: row.assignedTo,
    assignedToName: row.assignedToName,
    service: row.servicio || '—',
    createdAt: row.fechaAlta,
    totalRevenue: 0,
    externalMonthName: row.mesActual,
    externalMonthAmount: row.ingresos,
    externalYearTotal: row.ingresosAnual,
    externalLogoUrl: row.logoUrl,
    mes1: row.mes1,
    monto1: row.monto1,
    mes2: row.mes2,
    monto2: row.monto2,
    mes3: row.mes3,
    monto3: row.monto3,
    mes4: row.mes4,
    monto4: row.monto4,
    mes5: row.mes5,
    monto5: row.monto5,
    notes: '',
  } as Client;
}

/** Lista WClientes, guarda en BD y devuelve el listado (como Clients.tsx + persistencia). */
export async function refreshClienteEmpresas(
  all = false,
): Promise<RefreshEmpresasResponse> {
  const qs = all ? '?all=true' : '';
  return api<RefreshEmpresasResponse>(`/cliente-cartera/empresas/refresh${qs}`, {
    method: 'POST',
  });
}

export async function fetchClienteEmpresas(): Promise<ClienteEmpresaRow[]> {
  return api<ClienteEmpresaRow[]>('/cliente-cartera/empresas');
}

export async function fetchContactosEmpresa(): Promise<ContactoEmpresaRow[]> {
  return api<ContactoEmpresaRow[]>('/cliente-cartera/contactos');
}
