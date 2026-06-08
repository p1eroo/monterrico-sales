/** Solo dígitos; útil para comparar teléfonos del CRM con JIDs de WhatsApp. */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Normaliza un número peruano típico para enviar a Evolution GO (`number` en /send/text).
 * Si ya incluye 51 y es largo suficiente, se deja; si son 9 dígitos se antepone 51.
 */
export function normalizePeWaNumber(input: string): string {
  const d = digitsOnly(input);
  if (d.length === 0) return d;
  if (d.length >= 11 && d.startsWith('51')) return d;
  if (d.length === 9) return `51${d}`;
  return d;
}
