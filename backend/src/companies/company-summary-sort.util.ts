import type { Prisma } from '../generated/prisma';

const ALLOWED_SORT_FIELDS = new Set([
  'name',
  'etapa',
  'fuente',
  'rubro',
  'tipo',
  'clienteRecuperado',
  'asesor',
  'createdAt',
  'contactCount',
]);

export function buildCompanySummaryOrderBy(
  sortBy?: string,
  sortDir?: string,
): Prisma.CompanyOrderByWithRelationInput {
  const field = sortBy?.trim();
  const dir: Prisma.SortOrder = sortDir === 'asc' ? 'asc' : 'desc';

  if (!field || !ALLOWED_SORT_FIELDS.has(field)) {
    return { updatedAt: 'desc' };
  }

  switch (field) {
    case 'name':
      return { name: dir };
    case 'etapa':
      return { etapa: dir };
    case 'fuente':
      return { fuente: dir };
    case 'rubro':
      return { rubro: dir };
    case 'tipo':
      return { tipo: dir };
    case 'clienteRecuperado':
      return { clienteRecuperado: dir };
    case 'asesor':
      return { user: { name: dir } };
    case 'createdAt':
      return { createdAt: dir };
    case 'contactCount':
      return { contacts: { _count: dir } };
    default:
      return { updatedAt: 'desc' };
  }
}
