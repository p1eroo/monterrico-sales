import type { LucideIcon } from 'lucide-react';
import { Building2, FileText } from 'lucide-react';
import type { CampaignArea, CampaignRecipient, Etapa } from '@/types';
import { contactListAll, type ApiContactListRow } from '@/lib/contactApi';
import { fetchFacebookForms, fetchFacebookLeads } from '@/lib/marketingApi';
import { etapaLabels } from '@/data/mock';

/**
 * Fuente de candidatos para armar la audiencia de una campaña.
 * Comercial usa contactos del CRM; Marketing usa leads de Facebook.
 */

export type CampaignAudienceKind = 'crm' | 'leads';

export type CampaignAudienceFilterControl =
  | { type: 'search'; key: 'search'; placeholder: string }
  | {
      type: 'select';
      key: 'etapa';
      options: { value: string; label: string }[];
      placeholder: string;
    }
  | { type: 'text'; key: 'empresa'; placeholder: string; icon: LucideIcon };

export type CampaignAudienceFilters = Record<string, string>;

export type CampaignAudienceSource = {
  kind: CampaignAudienceKind;
  /** Área del apartado: comercial o marketing. Aísla las campañas por área. */
  area: CampaignArea;
  /** Etiqueta del origen en el selector de audiencia (tab, textos). */
  sourceLabel: string;
  sheetDescription: string;
  pickerHeaderLabel: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  filterControls: CampaignAudienceFilterControl[];
  defaultFilters: CampaignAudienceFilters;
  loadCandidates: () => Promise<CampaignRecipient[]>;
};

function mapApiContactToCampaignRecipient(row: ApiContactListRow): CampaignRecipient {
  const companies = row.companies ?? [];
  const primary = companies.find((c) => c.isPrimary)?.company ?? companies[0]?.company;
  return {
    id: `crm-${row.id}`,
    name: row.name,
    email: (row.correo ?? '').trim(),
    phone: row.telefono?.trim() || undefined,
    company: primary?.name,
    etapa: row.etapa as Etapa,
    contactId: row.id,
  };
}

export const crmAudienceSource: CampaignAudienceSource = {
  kind: 'crm',
  area: 'comercial',
  sourceLabel: 'CRM',
  sheetDescription:
    'Arma la audiencia desde el CRM o un Excel. El correo se personaliza con ' +
    '{{nombre}}, {{empresa}} y {{email}}.',
  pickerHeaderLabel: 'Contactos',
  emptyStateTitle: 'No hay contactos con estos filtros.',
  emptyStateDescription: 'Ajusta los filtros para encontrar contactos.',
  filterControls: [
    { type: 'search', key: 'search', placeholder: 'Buscar nombre, email o empresa' },
    {
      type: 'select',
      key: 'etapa',
      placeholder: 'Etapa',
      options: Object.entries(etapaLabels).map(([value, label]) => ({ value, label })),
    },
    { type: 'text', key: 'empresa', placeholder: 'Empresa', icon: Building2 },
  ],
  defaultFilters: { search: '', etapa: '', empresa: '' },
  loadCandidates: async () => (await contactListAll()).map(mapApiContactToCampaignRecipient),
};

async function loadLeadRecipients(): Promise<CampaignRecipient[]> {
  const forms = await fetchFacebookForms();
  const all: CampaignRecipient[] = [];
  const seen = new Set<string>();
  for (const form of forms) {
    const res = await fetchFacebookLeads({ formId: form.id, page: 1, limit: 200 });
    for (const lead of res.data) {
      const email = (lead.email ?? '').trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      all.push({
        id: `lead-${lead.id}`,
        name: lead.fullName?.trim() || 'Sin nombre',
        email,
        phone: lead.phone?.trim() || undefined,
        company: form.name,
        contactId: lead.id,
      });
    }
  }
  return all;
}

export const leadsAudienceSource: CampaignAudienceSource = {
  kind: 'leads',
  area: 'marketing',
  sourceLabel: 'Leads',
  sheetDescription:
    'Arma la audiencia desde los leads de Facebook o un Excel. El correo se personaliza con ' +
    '{{nombre}}, {{empresa}} y {{email}}.',
  pickerHeaderLabel: 'Leads',
  emptyStateTitle: 'No hay leads con estos filtros.',
  emptyStateDescription: 'Sincroniza los formularios en Facebook para ver tus leads.',
  filterControls: [
    { type: 'search', key: 'search', placeholder: 'Buscar nombre, email o teléfono' },
    { type: 'text', key: 'empresa', placeholder: 'Formulario', icon: FileText },
  ],
  defaultFilters: { search: '', empresa: '' },
  loadCandidates: loadLeadRecipients,
};
