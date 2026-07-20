/** Etiqueta legible para URL: minúsculas, guiones, sin caracteres especiales. */
export function slugifyForUrl(raw: string, maxLen = 80): string {
  const base = raw
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/^-+|-+$/g, '');
  return base || 'item';
}

export function isLikelyPrismaCuid(value: string): boolean {
  const v = value.trim();
  if (v.length < 20 || v.length > 32) return false;
  return /^c[a-z0-9]+$/i.test(v);
}
