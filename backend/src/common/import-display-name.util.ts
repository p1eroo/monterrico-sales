/**
 * Nombres legibles al importar: tipo título y orden RENIEC (apellidos, nombres → nombres apellidos).
 */

function toTitleCaseWords(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const lower = w.toLowerCase();
      if (!lower) return w;
      /** Guiones en nombres compuestos: MARÍA-ELENA → María-Elena */
      if (lower.includes('-')) {
        return lower
          .split('-')
          .map((p) =>
            p ? p.charAt(0).toUpperCase() + p.slice(1) : p,
          )
          .join('-');
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/**
 * RENIEC suele devolver "APELLIDO1 APELLIDO2, NOMBRE1 NOMBRE2" en mayúsculas.
 * Se muestra: nombres primero, luego apellidos, en formato título.
 */
export function formatImportedPersonName(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  const comma = t.indexOf(',');
  if (comma > 0 && comma < t.length - 1) {
    const apellidos = t.slice(0, comma).trim();
    const nombres = t.slice(comma + 1).trim();
    if (apellidos && nombres) {
      return `${toTitleCaseWords(nombres)} ${toTitleCaseWords(
        apellidos,
      )}`.replace(/\s+/g, ' ').trim();
    }
  }
  return toTitleCaseWords(t);
}

/** Razón social / nombre comercial desde SUNAT o CSV en mayúsculas. */
export function formatImportedCompanyName(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  let s = toTitleCaseWords(t);
  s = s.replace(/\s+S\.a\.c\.?\s*$/i, ' S.A.C.');
  s = s.replace(/\s+S\.a\.?\s*$/i, ' S.A.');
  s = s.replace(/\s+S\.r\.l\.?\s*$/i, ' S.R.L.');
  s = s.replace(/\s+E\.i\.r\.l\.?\s*$/i, ' E.I.R.L.');
  return s.trim();
}
