/**
 * Dominios de correo personal habituales: no se usan como dominio de empresa.
 */
const CONSUMER_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.es',
  'outlook.com',
  'outlook.es',
  'live.com',
  'live.com.mx',
  'yahoo.com',
  'yahoo.es',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'yandex.com',
  'msn.com',
  'aol.com',
  'zoho.com',
]);

/**
 * Extrae un dominio de sitio a partir del correo del contacto (parte tras @).
 * Devuelve undefined si el correo es inválido, falta host o es dominio de consumidor genérico.
 */
export function inferCompanyDomainFromContactEmail(
  email: string | undefined | null,
): string | undefined {
  const raw = (email ?? '').trim().toLowerCase();
  if (!raw || !raw.includes('@')) return undefined;
  const at = raw.lastIndexOf('@');
  if (at <= 0 || at === raw.length - 1) return undefined;
  let host = raw.slice(at + 1).trim().toLowerCase();
  if (!host) return undefined;
  if (host.startsWith('www.')) host = host.slice(4);
  /** Host tipo nombre.tld (sin caracteres raros) */
  if (
    !/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(host)
  ) {
    return undefined;
  }
  if (CONSUMER_EMAIL_DOMAINS.has(host)) return undefined;
  return host;
}
