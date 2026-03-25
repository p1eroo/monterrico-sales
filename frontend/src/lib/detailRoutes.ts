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

function isLikelyPrismaCuid(value: string): boolean {
  const v = value.trim();
  if (v.length < 20 || v.length > 32) return false;
  return /^c[a-z0-9]+$/i.test(v);
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

export function contactDetailPath(row: { urlSlug: string }): string {
  return `/contactos/${encodeDetailPathSegment(row.urlSlug)}`;
}

export function companyDetailPath(row: { urlSlug: string }): string {
  return `/empresas/${encodeDetailPathSegment(row.urlSlug)}`;
}

export function opportunityDetailPath(row: { urlSlug: string }): string {
  return `/opportunities/${encodeDetailPathSegment(row.urlSlug)}`;
}

export function contactDetailHref(row: { urlSlug?: string; id: string }): string {
  return row.urlSlug
    ? contactDetailPath({ urlSlug: row.urlSlug })
    : `/contactos/${encodeDetailPathSegment(row.id)}`;
}

export function companyDetailHref(row: { urlSlug?: string; id: string }): string {
  return row.urlSlug
    ? companyDetailPath({ urlSlug: row.urlSlug })
    : `/empresas/${encodeDetailPathSegment(row.id)}`;
}

export function opportunityDetailHref(row: { urlSlug?: string; id: string }): string {
  return row.urlSlug
    ? opportunityDetailPath({ urlSlug: row.urlSlug })
    : `/opportunities/${encodeDetailPathSegment(row.id)}`;
}
