import type { Activity, Contact, Opportunity, TaskAssociation } from '@/types';

/**
 * Reconstruye asociaciones del formulario de tarea a partir de la actividad
 * (p. ej. tarea completada) para reutilizar en la tarea de seguimiento.
 */
export function taskAssociationsFromActivity(a: Activity): TaskAssociation[] {
  const out: TaskAssociation[] = [];
  if (a.contactId) {
    const raw = a.contactName?.trim() ?? '';
    const name = a.companyName?.trim()
      ? raw
      : raw.includes(' - ')
        ? raw.split(' - ')[0].trim()
        : raw;
    out.push({ type: 'contacto', id: a.contactId, name: name || raw || 'Contacto' });
  }
  if (a.companyId) {
    let name = a.companyName?.trim();
    if (!name) {
      const cn = a.contactName?.trim();
      if (cn) {
        if (a.contactId && cn.includes(' - ')) {
          const rest = cn.split(' - ').slice(1).join(' - ').trim();
          if (rest) name = rest;
        } else if (!a.contactId) {
          name = cn;
        }
      }
      if (!name) name = 'Empresa';
    }
    out.push({ type: 'empresa', id: a.companyId, name });
  }
  if (a.clienteEmpresaId) {
    out.push({
      type: 'cliente_empresa',
      id: a.clienteEmpresaId,
      name: a.clienteEmpresaName?.trim() || 'Empresa cliente',
    });
  }
  if (a.opportunityId) {
    out.push({
      type: 'negocio',
      id: a.opportunityId,
      name: a.opportunityTitle?.trim() || 'Oportunidad',
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
  return out;
}

export function taskLinkBadgesFromActivity(
  a: Activity,
): Pick<TaskAssociation, 'type' | 'name'>[] {
  return taskAssociationsFromActivity(a).map((x) => ({ type: x.type, name: x.name }));
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
    if (a.type !== 'empresa' || !a.name?.trim()) continue;
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
  const c = assocs.find((a) => a.type === 'contacto');
  const e = assocs.find((a) => a.type === 'empresa');
  const ce = assocs.find((a) => a.type === 'cliente_empresa');
  const n = assocs.find((a) => a.type === 'negocio');
  if (c && e) return `${c.name} - ${e.name}`.trim();
  if (c && ce) return `${c.name} - ${ce.name}`.trim();
  if (c) return c.name;
  if (e) return e.name;
  if (ce) return ce.name;
  if (n) return n.name;
  return undefined;
}
