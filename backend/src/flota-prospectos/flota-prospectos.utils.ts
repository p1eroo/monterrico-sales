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

/** Token para filtrar prospectos sin ciudad asignada (null o vacío). */
export const CIUDAD_FILTER_EMPTY = '__empty__';

const CIUDAD_EMPTY_WHERE = {
  OR: [{ ciudad: null }, { ciudad: '' }],
} as const;

/** Filtro de ciudad en listados (soporta CSV y «sin ciudad»). */
export function buildCiudadWhereClause(
  ciudades: string[],
): Record<string, unknown> | null {
  const hasEmpty = ciudades.includes(CIUDAD_FILTER_EMPTY);
  const named = ciudades.filter((c) => c !== CIUDAD_FILTER_EMPTY);
  if (!hasEmpty && named.length === 0) return null;
  if (hasEmpty && named.length === 0) {
    return { ...CIUDAD_EMPTY_WHERE };
  }
  if (hasEmpty) {
    return {
      OR: [
        { ciudad: { in: named } },
        { ciudad: null },
        { ciudad: '' },
      ],
    };
  }
  if (named.length > 1) {
    return { ciudad: { in: named } };
  }
  return { ciudad: { equals: named[0], mode: 'insensitive' } };
}
