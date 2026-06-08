import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Si el rol no tiene este permiso, los listados CRM se acotan al usuario logueado. */
export const CRM_PERM_VER_DATOS_EQUIPO = 'equipo.datos_completos' as const;

export type CrmDataScope = {
  viewerUserId: string;
  /** true = misma visión que hoy (filtros opcionales por asesor, etc.) */
  unrestricted: boolean;
};

@Injectable()
export class CrmDataScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async mayViewAllTeamCrmData(roleId: string | undefined): Promise<boolean> {
    if (!roleId) return false;
    const row = await this.prisma.authority.findFirst({
      where: { roleId, permission: CRM_PERM_VER_DATOS_EQUIPO },
      select: { id: true },
    });
    return !!row;
  }

  async buildScope(
    viewerUserId: string,
    roleId: string | undefined,
  ): Promise<CrmDataScope> {
    const unrestricted = await this.mayViewAllTeamCrmData(roleId);
    return { viewerUserId, unrestricted };
  }
}
