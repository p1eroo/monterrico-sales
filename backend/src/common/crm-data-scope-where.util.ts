import type { Prisma } from '../generated/prisma';
import type { CrmDataScope } from '../auth/crm-data-scope.service';

/** Filtro de empresas visibles cuando el rol no tiene `equipo.datos_completos`. */
export function companyScopeWhereInput(
  scope: CrmDataScope | undefined,
): Prisma.CompanyWhereInput | undefined {
  if (!scope || scope.unrestricted) return undefined;
  return {
    OR: [
      { assignedTo: scope.viewerUserId },
      {
        contacts: {
          some: { contact: { assignedTo: scope.viewerUserId } },
        },
      },
    ],
  };
}

export function mergeCompanyScope(
  where: Prisma.CompanyWhereInput,
  scope: CrmDataScope | undefined,
): Prisma.CompanyWhereInput {
  const extra = companyScopeWhereInput(scope);
  if (!extra) return where;
  return Object.keys(where).length === 0
    ? extra
    : { AND: [where, extra] };
}
