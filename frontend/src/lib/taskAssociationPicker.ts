import type { Contact, Opportunity, TaskAssociation } from '@/types';
import { isLikelyCompanyCuid } from '@/lib/companyApi';
import {
  isTaskAssociationMatchingEmpresa,
  mergeCompaniesForTaskPicker,
} from '@/lib/taskAssociationsFromActivity';

export type TaskAssociationPickerCategory = 'contactos' | 'empresas' | 'negocios';
export type TaskAssociationPickerVariant = 'crm' | 'cliente-cartera';

export function taskPickerCompanyType(
  variant: TaskAssociationPickerVariant,
): TaskAssociation['type'] {
  return variant === 'cliente-cartera' ? 'cliente_empresa' : 'empresa';
}

export function taskPickerContactType(
  variant: TaskAssociationPickerVariant,
): TaskAssociation['type'] {
  return variant === 'cliente-cartera' ? 'cliente_contacto' : 'contacto';
}

export function resolveTaskPickerCompanyId(
  associations: TaskAssociation[],
  variant: TaskAssociationPickerVariant = 'crm',
): string | undefined {
  const companyType = taskPickerCompanyType(variant);
  const empresas = associations.filter((a) => a.type === companyType && a.id?.trim());
  if (variant === 'cliente-cartera') {
    return empresas[0]?.id;
  }
  return empresas.find((a) => isLikelyCompanyCuid(a.id))?.id ?? empresas[0]?.id;
}

export function pickClienteContactosForAssociationPicker(
  associations: TaskAssociation[],
  linkedContactos: Contact[],
): Contact[] {
  const byId = new Map(linkedContactos.map((c) => [c.id, c]));
  for (const assoc of associations) {
    if (assoc.type !== 'cliente_contacto' || byId.has(assoc.id)) continue;
    byId.set(assoc.id, { id: assoc.id, name: assoc.name, companies: [] } as unknown as Contact);
  }
  return [...byId.values()];
}

export function pickerTabsForVariant(variant: TaskAssociationPickerVariant) {
  if (variant === 'cliente-cartera') {
    return TASK_ASSOCIATION_PICKER_TABS.filter((tab) => tab.key !== 'negocios');
  }
  return TASK_ASSOCIATION_PICKER_TABS;
}

export const TASK_ASSOCIATION_PICKER_TABS: {
  key: TaskAssociationPickerCategory;
  label: string;
}[] = [
  { key: 'contactos', label: 'Contactos' },
  { key: 'empresas', label: 'Empresas' },
  { key: 'negocios', label: 'Oportunidades' },
];

export const TASK_LINKED_ENTITY_FETCH_LIMIT = 500;
export const TASK_ASSOCIATION_PICKER_PAGE_SIZE = 8;

export function resolveSelectedCompanyId(associations: TaskAssociation[]): string | undefined {
  const empresas = associations.filter(
    (a) => a.type === 'empresa' && a.id && isLikelyCompanyCuid(a.id),
  );
  return empresas[0]?.id;
}

export function contactBelongsToCompany(
  contact: Contact,
  companyId: string,
  companyName?: string,
): boolean {
  return (
    contact.companies?.some(
      (c) =>
        (c.id && c.id === companyId) ||
        (companyName && c.name.toLowerCase() === companyName.toLowerCase()),
    ) ?? false
  );
}

export function opportunityBelongsToCompany(opp: Opportunity, companyId: string): boolean {
  if (opp.linkedCompanyIds?.includes(companyId)) return true;
  return opp.clientId === companyId;
}

/** Contactos visibles en el picker: solo vinculados a la empresa seleccionada. */
export function pickContactsForAssociationPicker(
  associations: TaskAssociation[],
  contacts: Contact[],
  linkedContacts: Contact[],
  selectedCompanyId?: string,
): Contact[] {
  if (selectedCompanyId) {
    return mergeSelectedContactsIntoPicker(linkedContacts, associations, contacts);
  }
  const empresa = associations.find((a) => a.type === 'empresa');
  if (empresa && !isLikelyCompanyCuid(empresa.id)) {
    const filtered = contacts.filter((c) =>
      contactBelongsToCompany(c, empresa.id, empresa.name),
    );
    return mergeSelectedContactsIntoPicker(filtered, associations, contacts);
  }
  return mergeSelectedContactsIntoPicker([], associations, contacts);
}

/** Oportunidades visibles en el picker: solo vinculadas a la empresa seleccionada. */
export function pickOpportunitiesForAssociationPicker(
  associations: TaskAssociation[],
  opportunities: Opportunity[],
  linkedOpportunities: Opportunity[],
  selectedCompanyId?: string,
): Opportunity[] {
  if (selectedCompanyId) {
    return mergeSelectedOpportunitiesIntoPicker(linkedOpportunities, associations, opportunities);
  }
  const empresa = associations.find((a) => a.type === 'empresa');
  if (empresa && !isLikelyCompanyCuid(empresa.id)) {
    const filtered = opportunities.filter(
      (o) =>
        opportunityBelongsToCompany(o, empresa.id) ||
        (empresa.name && o.clientName?.toLowerCase() === empresa.name.toLowerCase()),
    );
    return mergeSelectedOpportunitiesIntoPicker(filtered, associations, opportunities);
  }
  return mergeSelectedOpportunitiesIntoPicker([], associations, opportunities);
}

/** Empresas visibles en el picker; en edición, solo la ya seleccionada si `onlySelectedCompany`. */
export function pickCompaniesForAssociationPicker(
  associations: TaskAssociation[],
  baseCompanies: { name: string; id?: string }[],
  options?: { onlySelectedCompany?: boolean },
): { name: string; id?: string }[] {
  const merged = mergeCompaniesForTaskPicker(baseCompanies, associations);
  if (!options?.onlySelectedCompany) return merged;

  const empresas = associations.filter((a) => a.type === 'empresa');
  if (empresas.length === 0) return merged;

  const selected = merged.filter((c) =>
    empresas.some((e) => isTaskAssociationMatchingEmpresa(e, c)),
  );
  if (selected.length > 0) return selected;

  return empresas.map((e) => ({ name: e.name, id: e.id?.trim() || undefined }));
}

function mergeSelectedContactsIntoPicker(
  picker: Contact[],
  associations: TaskAssociation[],
  allContacts: Contact[],
): Contact[] {
  const byId = new Map(picker.map((c) => [c.id, c]));
  for (const assoc of associations) {
    if (assoc.type !== 'contacto' || byId.has(assoc.id)) continue;
    const found = allContacts.find((c) => c.id === assoc.id);
    if (found) {
      byId.set(found.id, found);
    } else {
      byId.set(assoc.id, { id: assoc.id, name: assoc.name, companies: [] } as unknown as Contact);
    }
  }
  return [...byId.values()];
}

function mergeSelectedOpportunitiesIntoPicker(
  picker: Opportunity[],
  associations: TaskAssociation[],
  allOpportunities: Opportunity[],
): Opportunity[] {
  const byId = new Map(picker.map((o) => [o.id, o]));
  for (const assoc of associations) {
    if (assoc.type !== 'negocio' || byId.has(assoc.id)) continue;
    const found = allOpportunities.find((o) => o.id === assoc.id);
    if (found) {
      byId.set(found.id, found);
    } else {
      byId.set(assoc.id, { id: assoc.id, title: assoc.name } as unknown as Opportunity);
    }
  }
  return [...byId.values()];
}

export function selectedCompanyNameFromAssociations(
  associations: TaskAssociation[],
  selectedCompanyId?: string,
  variant: TaskAssociationPickerVariant = 'crm',
): string | undefined {
  if (!selectedCompanyId) return undefined;
  const companyType = taskPickerCompanyType(variant);
  return associations.find((a) => a.type === companyType && a.id === selectedCompanyId)?.name;
}
