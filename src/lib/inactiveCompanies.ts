import type { Contact, Etapa, CompanyRubro, CompanyTipo } from '@/types';
import { etapaProbabilidad } from '@/data/mock';

const INACTIVE_ETAPAS: Etapa[] = ['inactivo', 'cierre_perdido'];

export interface InactiveCompany {
  id: string;
  company: string;
  domain?: string;
  companyRubro?: CompanyRubro;
  companyTipo?: CompanyTipo;
  assignedTo: string;
  assignedToName: string;
  etapa: Etapa;
  contactIds: string[];
}

const etapaOrder: Etapa[] = [
  'lead', 'contacto', 'reunion_agendada', 'reunion_efectiva',
  'propuesta_economica', 'negociacion', 'licitacion', 'licitacion_etapa_final',
  'cierre_ganado', 'firma_contrato', 'activo', 'cierre_perdido', 'inactivo',
];

export function getInactiveCompanies(contacts: Contact[]): InactiveCompany[] {
  const map = new Map<string, InactiveCompany>();

  for (const contact of contacts) {
    for (const comp of contact.companies ?? []) {
      const key = comp.name.trim().toLowerCase();
      const isInactive = INACTIVE_ETAPAS.includes(contact.etapa);

      if (!isInactive) continue;

      const existing = map.get(key);
      const contactProb = etapaProbabilidad[contact.etapa];

      if (existing) {
        if (!existing.contactIds.includes(contact.id)) {
          existing.contactIds.push(contact.id);
          if (contactProb > etapaProbabilidad[existing.etapa]) {
            existing.etapa = contact.etapa;
            existing.assignedTo = contact.assignedTo;
            existing.assignedToName = contact.assignedToName;
          }
        }
      } else {
        map.set(key, {
          id: key,
          company: comp.name,
          domain: comp.domain,
          companyRubro: comp.rubro,
          companyTipo: comp.tipo,
          assignedTo: contact.assignedTo,
          assignedToName: contact.assignedToName,
          etapa: contact.etapa,
          contactIds: [contact.id],
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const idxA = etapaOrder.indexOf(a.etapa);
    const idxB = etapaOrder.indexOf(b.etapa);
    return idxA - idxB;
  });
}

export function slugifyCompany(company: string): string {
  return encodeURIComponent(company.trim());
}
