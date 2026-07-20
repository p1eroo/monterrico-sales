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

export type ClienteEmpresaLinkedContacto = {
  id: string;
  nombre: string;
  nombres: string;
  apellidos?: string;
  telefono?: string;
  email?: string;
  cargo?: string;
  assignedTo?: string;
  assignedToName: string;
  isPrimary: boolean;
};

export type ClienteEmpresaDetail = ClienteEmpresaRow & {
  contactos: ClienteEmpresaLinkedContacto[];
};

export type ContactoClienteEmpresaLink = {
  id: string;
  empresa: string;
  logoUrl?: string;
  isPrimary: boolean;
};

export type ContactoClienteRow = {
  id: string;
  nombre: string;
  nombres: string;
  apellidos?: string;
  telefono?: string;
  email?: string;
  cargo?: string;
  etapa?: string;
  source?: string;
  clienteRecuperado?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
  assignedTo: string;
  assignedToName: string;
  createdAt: string;
  lastInteractionAt: string;
  empresas: ContactoClienteEmpresaLink[];
};

export type CreateContactoClienteBody = {
  nombres: string;
  apellidos?: string;
  telefono?: string;
  email?: string;
  cargo?: string;
  etapa?: string;
  source?: string;
  clienteRecuperado?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
  assignedTo?: string;
  clienteEmpresaId?: string;
  isPrimary?: boolean;
};

export type UpdateContactoClienteBody = Partial<CreateContactoClienteBody>;

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

export async function fetchClienteEmpresaById(
  id: string,
): Promise<ClienteEmpresaDetail> {
  return api<ClienteEmpresaDetail>(`/cliente-cartera/empresas/${encodeURIComponent(id)}`);
}

export async function fetchContactosCliente(): Promise<ContactoClienteRow[]> {
  return api<ContactoClienteRow[]>('/cliente-cartera/contactos');
}

export async function fetchContactoClienteById(
  id: string,
): Promise<ContactoClienteRow> {
  return api<ContactoClienteRow>(
    `/cliente-cartera/contactos/${encodeURIComponent(id)}`,
  );
}

export async function createContactoCliente(
  body: CreateContactoClienteBody,
): Promise<ContactoClienteRow> {
  return api<ContactoClienteRow>('/cliente-cartera/contactos', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateContactoCliente(
  id: string,
  body: UpdateContactoClienteBody,
): Promise<ContactoClienteRow> {
  return api<ContactoClienteRow>(
    `/cliente-cartera/contactos/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );
}

export async function deleteContactoCliente(id: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(
    `/cliente-cartera/contactos/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

export async function linkContactoToClienteEmpresa(
  empresaId: string,
  contactoClienteId: string,
  isPrimary = false,
): Promise<ClienteEmpresaDetail> {
  return api<ClienteEmpresaDetail>(
    `/cliente-cartera/empresas/${encodeURIComponent(empresaId)}/contactos`,
    {
      method: 'POST',
      body: JSON.stringify({ contactoClienteId, isPrimary }),
    },
  );
}

export async function unlinkContactoFromClienteEmpresa(
  empresaId: string,
  contactoClienteId: string,
): Promise<ClienteEmpresaDetail> {
  return api<ClienteEmpresaDetail>(
    `/cliente-cartera/empresas/${encodeURIComponent(empresaId)}/contactos/${encodeURIComponent(contactoClienteId)}`,
    { method: 'DELETE' },
  );
}

/** @deprecated usar fetchContactosCliente */
export async function fetchContactosEmpresa(): Promise<ContactoClienteRow[]> {
  return fetchContactosCliente();
}

/** @deprecated usar ContactoClienteRow */
export type ContactoEmpresaRow = ContactoClienteRow;
