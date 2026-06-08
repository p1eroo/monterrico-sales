import type { CalendarEvent } from '@/types';
import {
  companyDetailHref,
  contactDetailHref,
  opportunityDetailHref,
} from '@/lib/detailRoutes';

/** Datos de vínculos CRM resueltos para UI (contacto + empresa u oportunidad). */
export type ResolvedCalendarEventLinks = {
  contactId?: string;
  contactName?: string;
  companyId?: string;
  companyName?: string;
  opportunityId?: string;
  opportunityTitle?: string;
};

export function companyHrefByIdOrName(id?: string, name?: string): string | null {
  if (id) return companyDetailHref({ id });
  if (name?.trim()) return `/empresas/${encodeURIComponent(name.trim())}`;
  return null;
}

export type CalendarEventNavLinks = ResolvedCalendarEventLinks & {
  contactPath: string | null;
  companyPath: string | null;
  opportunityPath: string | null;
};

/**
 * Normaliza nombres para el calendario: API nueva (contacto + empresa aparte),
 * o texto legado `Contacto - Empresa` en `relatedEntityName`.
 */
export function resolveCalendarEventLinks(event: CalendarEvent): ResolvedCalendarEventLinks {
  if (event.relatedEntityType === 'opportunity') {
    return {
      opportunityId: event.relatedEntityId,
      opportunityTitle: event.relatedEntityName,
    };
  }
  if (event.relatedEntityType === 'company') {
    return {
      companyId: event.relatedEntityId,
      companyName: event.relatedEntityName,
    };
  }
  if (event.relatedEntityType === 'contact') {
    const full = (event.relatedEntityName ?? '').trim();
    let contactName = full;
    let companyName = (event.relatedCompanyName ?? '').trim();
    let companyId = event.relatedCompanyId;

    if (!companyName && full.includes(' - ')) {
      const idx = full.indexOf(' - ');
      contactName = full.slice(0, idx).trim();
      companyName = full.slice(idx + 3).trim();
    }

    return {
      contactId: event.relatedEntityId,
      contactName: contactName || undefined,
      companyId,
      companyName: companyName || undefined,
    };
  }
  return {};
}

/** Rutas listas para `navigate()` a partir del evento del calendario. */
export function getCalendarEventNavPaths(event: CalendarEvent): CalendarEventNavLinks {
  const resolved = resolveCalendarEventLinks(event);
  const contactPath = resolved.contactId ? contactDetailHref({ id: resolved.contactId }) : null;
  const companyPath = companyHrefByIdOrName(resolved.companyId, resolved.companyName);
  const opportunityPath = resolved.opportunityId
    ? opportunityDetailHref({ id: resolved.opportunityId })
    : null;
  return { ...resolved, contactPath, companyPath, opportunityPath };
}
