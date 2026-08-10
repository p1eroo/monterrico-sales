import type { Activity, Contact, Opportunity, TaskAssociation } from '@/types';
import { isLikelyCompanyCuid } from '@/lib/companyApi';

/**
 * Reconstruye asociaciones del formulario de tarea a partir de la actividad
 * (p. ej. tarea completada) para reutilizar en la tarea de seguimiento.
 */
export function taskAssociationsFromActivity(a: Activity): TaskAssociation[] {
  const out: TaskAssociation[] = [];

  const contacts =
    a.linkedContacts?.length
      ? a.linkedContacts
      : a.contactId
        ? [{ id: a.contactId, name: a.contactName?.trim() || 'Contacto' }]
        : [];
  for (const c of contacts) {
    const raw = c.name?.trim() ?? '';
    const name = a.companyName?.trim()
      ? raw
      : raw.includes(' - ')
        ? raw.split(' - ')[0].trim()
        : raw;
    out.push({ type: 'contacto', id: c.id, name: name || raw || 'Contacto' });
  }

  const companies =
    a.linkedCompanies?.length
      ? a.linkedCompanies
      : a.companyId
        ? [{ id: a.companyId, name: a.companyName?.trim() || 'Empresa' }]
        : [];
  for (const company of companies) {
    let name = company.name?.trim();
    if (!name && companies.length === 1) {
      const cn = a.contactName?.trim();
      if (cn) {
        if (a.contactId && cn.includes(' - ')) {
          const rest = cn.split(' - ').slice(1).join(' - ').trim();
          if (rest) name = rest;
        } else if (!a.contactId) {
          name = cn;
        }
      }
    }
    out.push({ type: 'empresa', id: company.id, name: name || 'Empresa' });
  }

  const clienteEmpresas =
    a.linkedClienteEmpresas?.length
      ? a.linkedClienteEmpresas
      : a.clienteEmpresaId
        ? [{ id: a.clienteEmpresaId, name: a.clienteEmpresaName?.trim() || 'Empresa cliente' }]
        : [];
  for (const ce of clienteEmpresas) {
    out.push({
      type: 'cliente_empresa',
      id: ce.id,
      name: ce.name?.trim() || 'Empresa cliente',
    });
  }

  const contactosCliente =
    a.linkedContactosCliente?.length
      ? a.linkedContactosCliente
      : a.contactoClienteId
        ? [{
            id: a.contactoClienteId,
            name: a.contactoClienteName?.trim() || 'Contacto cliente',
          }]
        : [];
  for (const cc of contactosCliente) {
    out.push({
      type: 'cliente_contacto',
      id: cc.id,
      name: cc.name?.trim() || 'Contacto cliente',
    });
  }

  const opportunities =
    a.linkedOpportunities?.length
      ? a.linkedOpportunities
      : a.opportunityId
        ? [{ id: a.opportunityId, title: a.opportunityTitle?.trim() || 'Oportunidad' }]
        : [];
  for (const opp of opportunities) {
    out.push({
      type: 'negocio',
      id: opp.id,
      name: opp.title?.trim() || 'Oportunidad',
    });
  }

  return out;
}

/** Vínculos para tarea de seguimiento tras registrar actividad en calendario / acciones rápidas. */
export function taskAssociationsFromEntityCtx(
  ctx: {
    contactId?: string;
    companyId?: string;
    opportunityId?: string;
    clienteEmpresaId?: string;
    contactoClienteId?: string;
    contactoClienteName?: string;
  } | null | undefined,
  contacts: Contact[],
  companies: { name: string; id?: string }[],
  opportunities: Opportunity[],
  clienteEmpresas: { name: string; id?: string }[] = [],
): TaskAssociation[] {
  if (!ctx) return [];
  const out: TaskAssociation[] = [];
  if (ctx.contactId) {
    const c = contacts.find((x) => x.id === ctx.contactId);
    out.push({
      type: 'contacto',
      id: ctx.contactId,
      name: c?.name ?? 'Contacto',
    });
  }
  if (ctx.companyId) {
    const c = companies.find((x) => x.id === ctx.companyId);
    out.push({
      type: 'empresa',
      id: ctx.companyId,
      name: c?.name ?? 'Empresa',
    });
  }
  if (ctx.opportunityId) {
    const o = opportunities.find((x) => x.id === ctx.opportunityId);
    out.push({
      type: 'negocio',
      id: ctx.opportunityId,
      name: o?.title ?? 'Oportunidad',
    });
  }
  if (ctx.clienteEmpresaId) {
    const c = clienteEmpresas.find((x) => x.id === ctx.clienteEmpresaId);
    out.push({
      type: 'cliente_empresa',
      id: ctx.clienteEmpresaId,
      name: c?.name ?? 'Empresa cliente',
    });
  }
  if (ctx.contactoClienteId) {
    out.push({
      type: 'cliente_contacto',
      id: ctx.contactoClienteId,
      name: ctx.contactoClienteName ?? 'Contacto cliente',
    });
  }
  return out;
}

export function taskLinkBadgesFromActivity(
  a: Activity,
): Pick<TaskAssociation, 'type' | 'name'>[] {
  return taskAssociationsFromActivity(a).map((x) => ({ type: x.type, name: x.name }));
}

export function isTaskAssociationMatchingContact(
  assoc: TaskAssociation,
  contactId: string,
): boolean {
  return assoc.type === 'contacto' && assoc.id === contactId;
}

export function isTaskAssociationMatchingEmpresa(
  assoc: TaskAssociation,
  company: { id?: string; name: string },
): boolean {
  if (assoc.type !== 'empresa') return false;
  const rowId = company.id ?? company.name;
  if (assoc.id === rowId) return true;
  if (company.id && assoc.id === company.id) return true;
  return assoc.name.trim().toLowerCase() === company.name.trim().toLowerCase();
}

export function isTaskAssociationMatchingNegocio(
  assoc: TaskAssociation,
  opportunityId: string,
): boolean {
  return assoc.type === 'negocio' && assoc.id === opportunityId;
}

/** Empresas disponibles en el buscador del formulario de tarea (base + vínculos prellenados). */
export function mergeCompaniesForTaskPicker(
  base: { name: string; id?: string }[],
  extraAssociations: TaskAssociation[] = [],
): { name: string; id?: string }[] {
  const result = base.map((c) => ({ name: c.name, id: c.id }));
  const keys = new Set(
    result.map((c) => (c.id?.trim() ? `id:${c.id.trim()}` : `n:${c.name.trim().toLowerCase()}`)),
  );
  for (const a of extraAssociations) {
    if ((a.type !== 'empresa' && a.type !== 'cliente_empresa') || !a.name?.trim()) continue;
    const id = a.id?.trim();
    const key = id ? `id:${id}` : `n:${a.name.trim().toLowerCase()}`;
    if (keys.has(key)) continue;
    keys.add(key);
    result.push({ name: a.name.trim(), id: id || undefined });
  }
  return result;
}

/** Misma lógica visual que en tarjetas (contacto, empresa, negocio) para tarea optimista. */
export function contactLineFromTaskAssociations(assocs: TaskAssociation[] | undefined): string | undefined {
  if (!assocs?.length) return undefined;
  const contactNames = assocs.filter((a) => a.type === 'contacto').map((a) => a.name);
  const companyNames = assocs.filter((a) => a.type === 'empresa').map((a) => a.name);
  if (contactNames.length && companyNames.length) {
    return `${contactNames.join(', ')} - ${companyNames[0]}`.trim();
  }
  if (contactNames.length) return contactNames.join(', ');
  const cc = assocs.find((a) => a.type === 'cliente_contacto');
  if (cc) return cc.name;
  const ce = assocs.find((a) => a.type === 'cliente_empresa');
  if (ce) return ce.name;
  const e = assocs.find((a) => a.type === 'empresa');
  if (e) return e.name;
  const n = assocs.find((a) => a.type === 'negocio');
  if (n) return n.name;
  return undefined;
}

/** Empresa vinculada usable para crear contacto desde formularios de tarea/actividad. */
export function resolveLinkedCompanyFromTaskContext(
  associations: TaskAssociation[],
  fallbackCompanyId?: string,
  fallbackCompanyName?: string,
): { id?: string; name?: string } {
  const fromAssoc = associations.find(
    (a) => a.type === 'empresa' && a.id && isLikelyCompanyCuid(a.id),
  );
  if (fromAssoc) {
    return { id: fromAssoc.id, name: fromAssoc.name };
  }
  if (fallbackCompanyId && isLikelyCompanyCuid(fallbackCompanyId)) {
    return { id: fallbackCompanyId, name: fallbackCompanyName ?? 'Empresa' };
  }
  return {};
}

/** Asociaciones mínimas cuando la tarea no trae vínculos explícitos (p. ej. pestaña de entidad). */
export function fallbackTaskAssociationsFromEntityContext(ctx: {
  contactId?: string;
  contactName?: string;
  companyId?: string;
  companyName?: string;
  opportunityId?: string;
  opportunityTitle?: string;
  clienteEmpresaId?: string;
  clienteEmpresaName?: string;
  contactoClienteId?: string;
  contactoClienteName?: string;
}): TaskAssociation[] {
  const out: TaskAssociation[] = [];
  if (ctx.companyId && isLikelyCompanyCuid(ctx.companyId)) {
    out.push({
      type: 'empresa',
      id: ctx.companyId,
      name: ctx.companyName ?? 'Empresa',
    });
  }
  if (ctx.contactId) {
    out.push({
      type: 'contacto',
      id: ctx.contactId,
      name: ctx.contactName ?? 'Contacto',
    });
  }
  if (ctx.opportunityId) {
    out.push({
      type: 'negocio',
      id: ctx.opportunityId,
      name: ctx.opportunityTitle ?? 'Oportunidad',
    });
  }
  if (ctx.clienteEmpresaId) {
    out.push({
      type: 'cliente_empresa',
      id: ctx.clienteEmpresaId,
      name: ctx.clienteEmpresaName ?? 'Empresa cliente',
    });
  }
  if (ctx.contactoClienteId) {
    out.push({
      type: 'cliente_contacto',
      id: ctx.contactoClienteId,
      name: ctx.contactoClienteName ?? 'Contacto cliente',
    });
  }
  return out;
}
