import type { PrismaService } from '../prisma/prisma.service';
import { isCommercialAdvisorRoleSlug } from '../users/user-role-slug.util';

export type CommercialAdvisorUserRow = { id: string; name: string };

/**
 * Asesores comerciales alineados con `activeAdvisors` del frontend:
 * - status activo
 * - rol que mapea a asesor (`isCommercialAdvisorRoleSlug`, no solo slug `asesor`)
 * - opcionalmente filtrados por área (`allowedAreas`)
 */
export async function findCommercialAdvisorUsers(
  prisma: PrismaService,
  opts?: { area?: string },
): Promise<CommercialAdvisorUserRow[]> {
  const area = opts?.area?.trim();
  const rows = await prisma.user.findMany({
    where: {
      status: 'activo',
      role: { slug: { not: 'admin' } },
      ...(area ? { allowedAreas: { has: area } } : {}),
    },
    select: {
      id: true,
      name: true,
      role: { select: { slug: true } },
    },
    orderBy: { name: 'asc' },
    take: 200,
  });

  return rows
    .filter((r) => isCommercialAdvisorRoleSlug(r.role.slug))
    .map((r) => ({
      id: r.id,
      name: r.name.trim() || 'Sin nombre',
    }));
}
