import type { PrismaService } from '../prisma/prisma.service';

export async function resolveAdvisorDisplayName(
  prisma: PrismaService,
  userId: string | null | undefined,
): Promise<string | null> {
  const id = userId?.trim();
  if (!id) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { name: true },
  });
  return user?.name?.trim() || id;
}

/** Texto del historial al cambiar el asesor asignado. */
export function formatReassignmentDescription(
  newAdvisorName: string | null,
  previousAdvisorName?: string | null,
): string {
  const prev = previousAdvisorName?.trim() || null;
  const next = newAdvisorName?.trim() || null;

  if (!next && prev) {
    return `Se quitó la asignación de asesor (antes: ${prev}).`;
  }
  if (next && !prev) {
    return `Se asignó a ${next}.`;
  }
  if (next && prev && prev !== next) {
    return `Se reasignó de ${prev} a ${next}.`;
  }
  if (next) {
    return `Se reasignó a ${next}.`;
  }
  return 'Asesor actualizado.';
}
