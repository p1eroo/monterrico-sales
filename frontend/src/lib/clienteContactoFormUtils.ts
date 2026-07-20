import type { NewContactData } from '@/components/shared/NewContactWizard';
import type { Contact, ContactSource } from '@/types';
import type { CreateContactoClienteBody, ContactoClienteRow } from '@/lib/clienteCarteraApi';
import type { ContactEditSavePayload } from '@/components/shared/ContactEditDialog';

export function splitContactFullName(fullName: string): { nombres: string; apellidos?: string } {
  const trimmed = fullName.trim();
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx <= 0) return { nombres: trimmed };
  return {
    nombres: trimmed.slice(0, spaceIdx),
    apellidos: trimmed.slice(spaceIdx + 1).trim() || undefined,
  };
}

export function newContactDataToClienteBody(
  data: NewContactData,
  options?: { clienteEmpresaId?: string; isPrimary?: boolean },
): CreateContactoClienteBody {
  const { nombres, apellidos } = splitContactFullName(data.name);
  const empresaId = options?.clienteEmpresaId ?? data.companyId;
  return {
    nombres,
    apellidos,
    telefono: data.phone.trim() || undefined,
    email: data.email.trim() || undefined,
    cargo: data.cargo?.trim() || undefined,
    etapa: data.etapaCiclo,
    source: data.source,
    clienteRecuperado: data.clienteRecuperado,
    departamento: data.departamento?.trim() || undefined,
    provincia: data.provincia?.trim() || undefined,
    distrito: data.distrito?.trim() || undefined,
    direccion: data.direccion?.trim() || undefined,
    assignedTo: data.assignedTo,
    clienteEmpresaId: empresaId,
    isPrimary: empresaId ? (options?.isPrimary ?? true) : undefined,
  };
}

export function contactoClienteRowToContact(row: ContactoClienteRow): Contact {
  return {
    id: row.id,
    name: row.nombre,
    cargo: row.cargo,
    companies: row.empresas.map((e) => ({
      name: e.empresa,
      id: e.id,
    })),
    telefono: row.telefono ?? '',
    correo: row.email ?? '',
    fuente: (row.source ?? 'base') as ContactSource,
    etapa: row.etapa ?? 'lead',
    assignedTo: row.assignedTo,
    assignedToName: row.assignedToName,
    estimatedValue: 0,
    createdAt: row.createdAt,
    lastInteractionAt: row.lastInteractionAt,
  };
}

export function contactEditPayloadToClienteUpdate(
  payload: ContactEditSavePayload,
): Partial<CreateContactoClienteBody> {
  const { nombres, apellidos } = splitContactFullName(payload.name);
  return {
    nombres,
    apellidos,
    telefono: payload.telefono.trim() || undefined,
    email: payload.correo.trim() || undefined,
    cargo: payload.cargo.trim() || undefined,
    source: payload.fuente,
    assignedTo: payload.assignedTo,
  };
}
