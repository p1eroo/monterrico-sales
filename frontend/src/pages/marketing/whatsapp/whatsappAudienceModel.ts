import { contactListPaginated, type ApiContactListRow } from '@/lib/contactApi';
import {
  flotaProspectosList,
  type FlotaProspectoRow,
} from '@/lib/flotaProspectosApi';
import { normalizeWhatsAppPhone } from './whatsappAudienceExcel';
import type { WhatsAppContact } from './mockData';

export type CrmAudienceSource = 'flota' | 'comercial';

export type CrmAudienceListFilters = {
  search?: string;
  estado?: string;
  contactado?: string;
  filters?: Record<string, string>;
  etapa?: string;
};

/** Audiencia explícita (Excel o filas marcadas a mano). */
export type ExplicitWhatsAppAudience = {
  mode: 'explicit';
  contacts: WhatsAppContact[];
  fileName: string | null;
};

/**
 * "Seleccionar todos" del filtro CRM: no materializa los miles de filas
 * hasta el envío (o hasta que se pida resolve).
 */
export type CrmSelectAllWhatsAppAudience = {
  mode: 'crmSelectAll';
  source: CrmAudienceSource;
  filters: CrmAudienceListFilters;
  total: number;
  preview: WhatsAppContact[];
  fileName: string;
};

export type WhatsAppAudience = ExplicitWhatsAppAudience | CrmSelectAllWhatsAppAudience;

export function emptyWhatsAppAudience(): ExplicitWhatsAppAudience {
  return { mode: 'explicit', contacts: [], fileName: null };
}

export function audienceCount(audience: WhatsAppAudience): number {
  return audience.mode === 'explicit' ? audience.contacts.length : audience.total;
}

export function audienceFileName(audience: WhatsAppAudience): string | null {
  return audience.fileName;
}

export function audiencePreviewContacts(
  audience: WhatsAppAudience,
  max = 40,
): WhatsAppContact[] {
  if (audience.mode === 'explicit') return audience.contacts.slice(0, max);
  return audience.preview.slice(0, max);
}

export function flotaRowToWhatsAppContact(row: FlotaProspectoRow): WhatsAppContact | null {
  const name = (row.nombreCompleto ?? '').trim();
  const phone = normalizeWhatsAppPhone(row.celular ?? row.movil ?? '');
  if (!name || !phone) return null;
  return {
    id: row.id,
    name,
    phone,
    city: row.ciudad?.trim() || undefined,
    source: 'crm',
    hasWhatsApp: true,
    flotaProspectoId: row.id,
  };
}

export function comercialRowToWhatsAppContact(row: ApiContactListRow): WhatsAppContact | null {
  const name = (row.name ?? '').trim();
  const phone = normalizeWhatsAppPhone(row.telefono ?? '');
  if (!name || !phone) return null;
  return {
    id: row.id,
    name,
    phone,
    source: 'crm',
    hasWhatsApp: true,
  };
}

/** Una sola petición lean (hasta 20k) — sin conteos ni archivos. */
async function resolveFlotaSelectAll(
  filters: CrmAudienceListFilters,
): Promise<WhatsAppContact[]> {
  const res = await flotaProspectosList({
    page: 1,
    limit: 20000,
    lean: true,
    search: filters.search,
    estado: filters.estado,
    contactado: filters.contactado,
    filters: filters.filters,
  });
  const contacts: WhatsAppContact[] = [];
  const seenPhones = new Set<string>();
  for (const row of res.data) {
    const contact = flotaRowToWhatsAppContact(row);
    if (!contact) continue;
    if (seenPhones.has(contact.phone)) continue;
    seenPhones.add(contact.phone);
    contacts.push(contact);
  }
  return contacts;
}

/** Comercial permite hasta 5000 por página; pagina si hace falta. */
async function resolveComercialSelectAll(
  filters: CrmAudienceListFilters,
): Promise<WhatsAppContact[]> {
  const limit = 5000;
  const contacts: WhatsAppContact[] = [];
  const seenPhones = new Set<string>();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const res = await contactListPaginated({
      page,
      limit,
      search: filters.search,
      etapa: filters.etapa,
    });
    totalPages = Math.max(1, Math.ceil(res.total / limit));
    for (const row of res.data) {
      const contact = comercialRowToWhatsAppContact(row);
      if (!contact) continue;
      if (seenPhones.has(contact.phone)) continue;
      seenPhones.add(contact.phone);
      contacts.push(contact);
    }
    page += 1;
  }

  return contacts;
}

/** Materializa contactos listos para el envío. */
export async function resolveWhatsAppAudienceContacts(
  audience: WhatsAppAudience,
): Promise<WhatsAppContact[]> {
  if (audience.mode === 'explicit') return audience.contacts;

  if (audience.source === 'flota') {
    return resolveFlotaSelectAll(audience.filters);
  }
  return resolveComercialSelectAll(audience.filters);
}
