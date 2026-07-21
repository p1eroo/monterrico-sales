import { Prisma } from '../generated/prisma';

/** Mensaje legible en español para errores Prisma/HTTP en import y altas. */
export function prismaErrorToSpanishMessage(
  e: unknown,
  fallback = 'Error al guardar',
): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      const target = e.meta?.target;
      const fields = Array.isArray(target)
        ? target.map(String)
        : target != null
          ? [String(target)]
          : [];
      const joined = fields.join(', ').toLowerCase();
      if (joined.includes('domain')) {
        return 'Ya existe una empresa con el mismo dominio.';
      }
      if (joined.includes('urlslug') || joined.includes('url_slug')) {
        return 'Ya existe una empresa con un nombre muy similar (conflicto de enlace URL).';
      }
      if (joined.includes('ruc')) {
        return 'Conflicto de RUC duplicado en base de datos.';
      }
      return 'Ya existe un registro duplicado en el sistema.';
    }
  }
  if (e instanceof Error) {
    const m = e.message;
    if (m.includes('Unique constraint') && m.includes('domain')) {
      return 'Ya existe una empresa con el mismo dominio.';
    }
    if (m.includes('Unique constraint') && m.includes('ruc')) {
      return 'Conflicto de RUC duplicado en base de datos.';
    }
    return m;
  }
  return fallback;
}
