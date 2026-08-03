import type { Activity } from '@/types';

export function contactIdsFromActivity(a: Activity): string[] {
  if (a.linkedContacts?.length) {
    return a.linkedContacts.map((c) => c.id).filter(Boolean);
  }
  return a.contactId ? [a.contactId] : [];
}

export function companyIdsFromActivity(a: Activity): string[] {
  if (a.linkedCompanies?.length) {
    return a.linkedCompanies.map((c) => c.id).filter(Boolean);
  }
  return a.companyId ? [a.companyId] : [];
}

export function opportunityIdsFromActivity(a: Activity): string[] {
  if (a.linkedOpportunities?.length) {
    return a.linkedOpportunities.map((o) => o.id).filter(Boolean);
  }
  return a.opportunityId ? [a.opportunityId] : [];
}

export function clienteEmpresaIdsFromActivity(a: Activity): string[] {
  if (a.linkedClienteEmpresas?.length) {
    return a.linkedClienteEmpresas.map((c) => c.id).filter(Boolean);
  }
  return a.clienteEmpresaId ? [a.clienteEmpresaId] : [];
}

export function contactoClienteIdsFromActivity(a: Activity): string[] {
  if (a.linkedContactosCliente?.length) {
    return a.linkedContactosCliente.map((c) => c.id).filter(Boolean);
  }
  return a.contactoClienteId ? [a.contactoClienteId] : [];
}

export function activityIsLinkedToContact(a: Activity, contactId: string): boolean {
  return contactIdsFromActivity(a).includes(contactId);
}

export function activityIsLinkedToCompany(a: Activity, companyId: string): boolean {
  return companyIdsFromActivity(a).includes(companyId);
}

export function activityIsLinkedToOpportunity(a: Activity, opportunityId: string): boolean {
  return opportunityIdsFromActivity(a).includes(opportunityId);
}

export function activityIsLinkedToClienteEmpresa(
  a: Activity,
  clienteEmpresaId: string,
): boolean {
  return clienteEmpresaIdsFromActivity(a).includes(clienteEmpresaId);
}

export function activityIsLinkedToContactoCliente(
  a: Activity,
  contactoClienteId: string,
): boolean {
  return contactoClienteIdsFromActivity(a).includes(contactoClienteId);
}

export interface ActivityEntityFilterCtx {
  contactId?: string;
  companyId?: string;
  opportunityId?: string;
  clienteEmpresaId?: string;
  contactoClienteId?: string;
  primaryCompanyId?: string;
  companyContactIds?: string[];
}

export function activityMatchesEntityFilter(
  a: Activity,
  ctx: ActivityEntityFilterCtx,
): boolean {
  if (ctx.contactId && activityIsLinkedToContact(a, ctx.contactId)) return true;
  if (ctx.companyId && activityIsLinkedToCompany(a, ctx.companyId)) return true;
  if (ctx.opportunityId && activityIsLinkedToOpportunity(a, ctx.opportunityId)) return true;
  if (ctx.clienteEmpresaId && activityIsLinkedToClienteEmpresa(a, ctx.clienteEmpresaId)) {
    return true;
  }
  if (ctx.contactoClienteId && activityIsLinkedToContactoCliente(a, ctx.contactoClienteId)) {
    return true;
  }
  if (ctx.primaryCompanyId && activityIsLinkedToCompany(a, ctx.primaryCompanyId)) {
    return true;
  }
  if (ctx.companyContactIds?.length) {
    const linked = contactIdsFromActivity(a);
    if (linked.some((id) => ctx.companyContactIds!.includes(id))) return true;
  }
  return false;
}

export function activityMatchesTasksTabContext(
  a: Activity,
  ctx: Pick<
    ActivityEntityFilterCtx,
    'contactId' | 'companyId' | 'opportunityId' | 'clienteEmpresaId' | 'contactoClienteId'
  >,
): boolean {
  const hasScope = !!(
    ctx.contactId ||
    ctx.companyId ||
    ctx.opportunityId ||
    ctx.clienteEmpresaId ||
    ctx.contactoClienteId
  );
  if (!hasScope) return false;
  return activityMatchesEntityFilter(a, ctx);
}

export function linkIdsFromActivity(a: Activity): {
  contactIds: string[];
  companyIds: string[];
  opportunityIds: string[];
  clienteEmpresaIds: string[];
  contactoClienteIds: string[];
} {
  return {
    contactIds: contactIdsFromActivity(a),
    companyIds: companyIdsFromActivity(a),
    opportunityIds: opportunityIdsFromActivity(a),
    clienteEmpresaIds: clienteEmpresaIdsFromActivity(a),
    contactoClienteIds: contactoClienteIdsFromActivity(a),
  };
}
