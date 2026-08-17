import { isLikelyPrismaCuid, slugifyForUrl } from '@/lib/urlSlug';

export const APP_PATHS = {
  contacts: '/contacts',
  companies: '/companies',
  opportunities: '/opportunities',
  clientCompanies: '/clients/companies',
  clientContacts: '/clients/contacts',
  clientTasks: '/clients/tareas',
  clientReports: '/clients/reports',
} as const;

/**
 * Detalle contra API: acepta cuid o urlSlug en la ruta.
 * Excluye ids cortos del mock (l1, o5, u3).
 */
export function isApiDetailRouteParam(param: string): boolean {
  const p = param.trim();
  if (!p) return false;
  if (/^[lou]\d+$/i.test(p)) return false;
  return true;
}

function decodedRouteSegment(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}

/**
 * true si el segmento de ruta debe resolverse con GET /entities/:param (cuid o urlSlug del backend).
 * Excluye rutas locales por nombre (espacios, mayúsculas distintas del patrón slug).
 */
export function isEntityDetailApiParam(param: string): boolean {
  if (!isApiDetailRouteParam(param)) return false;
  const d = decodedRouteSegment(param);
  if (isLikelyPrismaCuid(d)) return true;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d);
}

/** Segmento de path para URLs amigables (el backend ya devuelve slug ASCII). */
export function encodeDetailPathSegment(slug: string): string {
  return encodeURIComponent(slug);
}

function entitySlug(urlSlug?: string | null, name?: string | null): string {
  const fromSlug = urlSlug?.trim();
  if (fromSlug) return fromSlug;
  const fromName = name?.trim();
  if (fromName) return slugifyForUrl(fromName);
  return 'item';
}

export function contactDetailPath(row: { urlSlug?: string | null; name?: string | null }): string {
  return `${APP_PATHS.contacts}/${encodeDetailPathSegment(entitySlug(row.urlSlug, row.name))}`;
}

export function companyDetailPath(row: { urlSlug?: string | null; name?: string | null }): string {
  return `${APP_PATHS.companies}/${encodeDetailPathSegment(entitySlug(row.urlSlug, row.name))}`;
}

export function opportunityDetailPath(row: { urlSlug?: string | null; title?: string | null; name?: string | null }): string {
  return `${APP_PATHS.opportunities}/${encodeDetailPathSegment(entitySlug(row.urlSlug, row.title ?? row.name))}`;
}

export function contactDetailHref(row: { urlSlug?: string; id: string; name?: string }): string {
  return contactDetailPath({ urlSlug: row.urlSlug, name: row.name });
}

export function companyDetailHref(row: { urlSlug?: string; id: string; name?: string }): string {
  return companyDetailPath({ urlSlug: row.urlSlug, name: row.name });
}

export function opportunityDetailHref(row: { urlSlug?: string; id: string; title?: string; name?: string }): string {
  return opportunityDetailPath({ urlSlug: row.urlSlug, title: row.title, name: row.name });
}

export function clienteEmpresaDetailPath(row: { empresa: string }): string {
  return `${APP_PATHS.clientCompanies}/${encodeDetailPathSegment(slugifyForUrl(row.empresa))}`;
}

export function clienteEmpresaDetailHref(row: { empresa: string }): string {
  return clienteEmpresaDetailPath(row);
}

export function clienteContactoDetailPath(row: { id: string }): string {
  return `${APP_PATHS.clientContacts}/${encodeURIComponent(row.id)}`;
}

export function clienteContactoDetailHref(row: { id: string }): string {
  return clienteContactoDetailPath(row);
}

/** Rutas de ficha (detalle) donde conviene menos padding superior respecto al Topbar global. */
export function isCrmEntityDetailPath(pathname: string): boolean {
  if (/^\/clients\/companies\/[^/]+$/.test(pathname)) return true;
  if (/^\/clients\/contacts\/[^/]+$/.test(pathname)) return true;
  return /^\/(contacts|companies|opportunities|users)\/[^/]+$/.test(pathname);
}
