import type { NewContactData } from '@/components/shared/NewContactWizard';
import {
  contactCreate,
  isLikelyContactCuid,
  mapApiContactDetailToContact,
} from '@/lib/contactApi';

export async function createContactFromWizardForCompany(
  data: NewContactData,
  companyId: string,
  options?: { defaultAssignedTo?: string },
) {
  const assignedTo = data.assignedTo?.trim() || options?.defaultAssignedTo?.trim() || '';
  const body: Record<string, unknown> = {
    name: data.name.trim(),
    telefono: (data.phone || '').trim() || '000000000',
    correo: (data.email || '').trim() || `noreply-${Date.now()}@temp.local`,
    fuente: data.source,
    etapa: data.etapaCiclo || 'lead',
    estimatedValue: 0,
    companyId,
    cargo: data.cargo?.trim() || undefined,
    clienteRecuperado: data.clienteRecuperado,
    departamento: data.departamento?.trim() || undefined,
    provincia: data.provincia?.trim() || undefined,
    distrito: data.distrito?.trim() || undefined,
    direccion: data.direccion?.trim() || undefined,
  };
  if (assignedTo && isLikelyContactCuid(assignedTo)) {
    body.assignedTo = assignedTo;
  }

  const created = await contactCreate(body);
  return mapApiContactDetailToContact(created);
}
