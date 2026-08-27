/** Retorna la fecha actual a medianoche UTC usando la fecha local de Lima.
 *  Evita que Prisma/PostgreSQL desfase el día por la timezone del servidor. */
export function limaDate(): Date {
  const dateStr = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Lima',
  });
  return new Date(dateStr + 'T00:00:00.000Z');
}

const ESTADOS_VALIDOS = [
  'Nuevo',
  'Afiliado',
  'Citado',
  'Seguimiento',
  'Informacion',
  'Sin Requisitos',
  'No Responde',
];

export function normalizeEstado(raw: string): string {
  const cleaned = raw.trim();
  if (!cleaned) return 'Nuevo';
  const match = ESTADOS_VALIDOS.find(
    (e) => e.toLowerCase() === cleaned.toLowerCase(),
  );
  return match || 'Nuevo';
}

/** Valores CSV en query (p. ej. estado=Nuevo,Afiliado). */
export function splitCsvQueryParam(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
