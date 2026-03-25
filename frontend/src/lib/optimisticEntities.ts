import type { Contact, ContactSource, Etapa, Opportunity } from '@/types';
import { etapaProbabilidad } from '@/data/mock';
import { useUsersStore } from '@/store/usersStore';
import type { NewContactData } from '@/components/shared/NewContactWizard';
import type { NewOpportunityFormValues } from '@/components/shared/NewOpportunityFormDialog';
import { isLikelyContactCuid } from '@/lib/contactApi';

/** Construye un contacto de solo UI para mostrarlo antes de que responda POST /contacts. */
export function buildOptimisticContact(
  clientId: string,
  data: NewContactData,
  options?: { companyDisplayName?: string },
): Contact {
  const etapa = data.etapaCiclo as Etapa;
  const today = new Date().toISOString().slice(0, 10);
  const assignedTo =
    data.assignedTo && isLikelyContactCuid(data.assignedTo) ? data.assignedTo : '';
  const assignedToName = useUsersStore.getState().getUserName(assignedTo) || 'Sin asignar';
  const companies =
    options?.companyDisplayName?.trim()
      ? [{ name: options.companyDisplayName.trim() }]
      : data.company.trim()
        ? [{ name: data.company.trim() }]
        : [];

  return {
    id: clientId,
    name: data.name.trim(),
    cargo: data.cargo?.trim(),
    companies,
    telefono: data.phone.trim(),
    correo: data.email.trim(),
    fuente: data.source as ContactSource,
    etapa,
    assignedTo,
    assignedToName,
    estimatedValue: data.estimatedValue,
    createdAt: today,
    etapaHistory: [{ etapa, fecha: today }],
    clienteRecuperado: data.clienteRecuperado,
  };
}

/** Construye una oportunidad de solo UI antes de POST /opportunities. */
export function buildOptimisticOpportunity(
  clientId: string,
  data: NewOpportunityFormValues,
  options?: { contactName?: string; clientName?: string },
): Opportunity {
  const etapa = data.etapa as Etapa;
  const assignedTo = data.assignedTo?.trim() ?? '';
  const assignedToName =
    useUsersStore.getState().getUserName(assignedTo) || 'Sin asignar';

  return {
    id: clientId,
    title: data.title.trim(),
    contactId: data.contactId?.trim() || undefined,
    contactName: options?.contactName,
    clientId: data.companyId?.trim() || undefined,
    clientName: options?.clientName,
    amount: data.amount,
    probability: etapaProbabilidad[etapa] ?? 0,
    etapa,
    status: 'abierta',
    priority: data.priority,
    expectedCloseDate: data.expectedCloseDate,
    assignedTo,
    assignedToName,
    createdAt: new Date().toISOString().slice(0, 10),
  };
}
