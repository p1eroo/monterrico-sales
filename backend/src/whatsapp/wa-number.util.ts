/** Solo dígitos; útil para comparar teléfonos del CRM con JIDs de WhatsApp. */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, '');
}

/** Celular Perú: 9 dígitos empezando en 9 (con o sin prefijo 51). */
export function extractPeMobile9(input: string): string | null {
  const d = digitsOnly(input);
  if (d.length === 9 && d.startsWith('9')) return d;
  if (d.length >= 11 && d.startsWith('51')) {
    const mobile = d.slice(-9);
    if (mobile.length === 9 && mobile.startsWith('9')) return mobile;
  }
  return null;
}

export function isPeruvianMobilePhone(input: string): boolean {
  return extractPeMobile9(input) !== null;
}

/** IDs internos @lid de Meta (14+ dígitos, no son teléfonos reales). */
export function isWhatsappLidDigits(input: string): boolean {
  const d = digitsOnly(input);
  if (d.length < 14) return false;
  if (isPeruvianMobilePhone(d)) return false;
  return true;
}

export function formatPeCelularE164(input: string): string | null {
  const mobile = extractPeMobile9(input);
  return mobile ? `+51${mobile}` : null;
}

/**
 * Normaliza un número peruano típico para enviar a Evolution GO (`number` en /send/text).
 * Si ya incluye 51 y es largo suficiente, se deja; si son 9 dígitos se antepone 51.
 */
export function normalizePeWaNumber(input: string): string {
  const d = digitsOnly(input);
  if (d.length === 0) return d;
  if (d.length >= 11 && d.startsWith('51')) return d;
  const mobile = extractPeMobile9(d);
  if (mobile) return `51${mobile}`;
  if (d.length === 9) return `51${d}`;
  return d;
}
