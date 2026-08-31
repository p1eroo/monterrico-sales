/** Tipos cuya fecha del formulario es cuándo ocurrió (no un vencimiento). */
export function usesOccurredDate(type: string | undefined): boolean {
  const t = (type ?? '').trim().toLowerCase();
  return t === 'llamada' || t === 'reunion';
}

/** Etiqueta de la fecha principal según el tipo de actividad. */
export function activityDateFieldLabel(type: string | undefined): string {
  switch ((type ?? '').trim().toLowerCase()) {
    case 'llamada':
      return 'Fecha de la llamada';
    case 'reunion':
      return 'Fecha de la reunión';
    case 'correo':
      return 'Fecha del correo';
    case 'whatsapp':
      return 'Fecha del mensaje';
    case 'nota':
      return 'Fecha';
    default:
      return 'Fecha de vencimiento';
  }
}
