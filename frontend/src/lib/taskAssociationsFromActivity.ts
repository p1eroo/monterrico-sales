import type { Activity, TaskAssociation } from '@/types';

/**
 * Reconstruye asociaciones del formulario de tarea a partir de la actividad
 * (p. ej. tarea completada) para reutilizar en la tarea de seguimiento.
 */
export function taskAssociationsFromActivity(a: Activity): TaskAssociation[] {
  const out: TaskAssociation[] = [];
  if (a.contactId) {
    const raw = a.contactName?.trim() ?? '';
    const name = raw.includes(' - ') ? raw.split(' - ')[0].trim() : raw;
    out.push({ type: 'contacto', id: a.contactId, name: name || raw || 'Contacto' });
  }
  if (a.companyId) {
    let name = 'Empresa';
    const cn = a.contactName?.trim();
    if (cn) {
      if (a.contactId && cn.includes(' - ')) {
        const rest = cn.split(' - ').slice(1).join(' - ').trim();
        if (rest) name = rest;
      } else if (!a.contactId) {
        name = cn;
      }
    }
    out.push({ type: 'empresa', id: a.companyId, name });
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

export function taskLinkBadgesFromActivity(
  a: Activity,
): { type: 'contacto' | 'empresa' | 'negocio'; name: string }[] {
  return taskAssociationsFromActivity(a).map((x) => ({ type: x.type, name: x.name }));
}

/** Misma lógica visual que en tarjetas (contacto, empresa, negocio) para tarea optimista. */
export function contactLineFromTaskAssociations(assocs: TaskAssociation[] | undefined): string | undefined {
  if (!assocs?.length) return undefined;
  const c = assocs.find((a) => a.type === 'contacto');
  const e = assocs.find((a) => a.type === 'empresa');
  const n = assocs.find((a) => a.type === 'negocio');
  if (c && e) return `${c.name} - ${e.name}`.trim();
  if (c) return c.name;
  if (e) return e.name;
  if (n) return n.name;
  return undefined;
}
