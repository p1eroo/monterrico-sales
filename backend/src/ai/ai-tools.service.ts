import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiToolsService {
  constructor(private readonly prisma: PrismaService) {}

  async userHasPermission(
    userId: string,
    permission: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roleId: true },
    });
    if (!user?.roleId) return false;
    const a = await this.prisma.authority.findFirst({
      where: { roleId: user.roleId, permission },
    });
    return !!a;
  }

  async listMyTasks(
    userId: string,
    scope: 'today' | 'overdue' | 'week',
  ): Promise<Record<string, unknown>> {
    if (!(await this.userHasPermission(userId, 'actividades.ver'))) {
      return { error: 'Sin permiso para ver actividades' };
    }
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    let where: Prisma.ActivityWhereInput = {
      assignedTo: userId,
      status: { not: 'completada' },
    };

    if (scope === 'today') {
      where = {
        ...where,
        dueDate: { gte: startOfToday, lt: endOfToday },
      };
    } else if (scope === 'overdue') {
      where = {
        ...where,
        dueDate: { lt: startOfToday },
      };
    } else {
      where = {
        ...where,
        dueDate: { gte: startOfToday, lt: endOfWeek },
      };
    }

    const rows = await this.prisma.activity.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      take: 20,
      select: {
        id: true,
        title: true,
        type: true,
        taskKind: true,
        status: true,
        dueDate: true,
      },
    });
    return { tasks: rows };
  }

  async countOpportunitiesByStage(
    userId: string,
  ): Promise<Record<string, unknown>> {
    if (!(await this.userHasPermission(userId, 'oportunidades.ver'))) {
      return { error: 'Sin permiso para ver oportunidades' };
    }
    const groups = await this.prisma.opportunity.groupBy({
      by: ['etapa'],
      where: {
        assignedTo: userId,
        status: 'abierta',
      },
      _count: { _all: true },
    });
    return {
      byStage: groups.map((g) => ({
        etapa: g.etapa,
        count: g._count._all,
      })),
    };
  }

  async getCompanySummary(
    userId: string,
    companyId: string,
  ): Promise<Record<string, unknown>> {
    if (!(await this.userHasPermission(userId, 'empresas.ver'))) {
      return { error: 'Sin permiso para ver empresas' };
    }
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, assignedTo: userId },
      select: {
        id: true,
        name: true,
        etapa: true,
        ruc: true,
        telefono: true,
        rubro: true,
        facturacionEstimada: true,
        user: { select: { name: true } },
      },
    });
    if (!company) {
      return {
        error:
          'Empresa no encontrada o no está asignada a tu usuario (solo ves empresas asignadas a ti)',
      };
    }
    return { company };
  }

  /** Contactos asignados al usuario, más recientes por actualización. */
  async listMyRecentContacts(
    userId: string,
    limitRaw: unknown,
  ): Promise<Record<string, unknown>> {
    if (!(await this.userHasPermission(userId, 'contactos.ver'))) {
      return { error: 'Sin permiso para ver contactos' };
    }
    const n =
      typeof limitRaw === 'number' && Number.isFinite(limitRaw)
        ? Math.floor(limitRaw)
        : typeof limitRaw === 'string'
          ? Number.parseInt(limitRaw, 10)
          : 15;
    const take = Math.min(25, Math.max(1, Number.isNaN(n) ? 15 : n));

    const rows = await this.prisma.contact.findMany({
      where: { assignedTo: userId },
      orderBy: { updatedAt: 'desc' },
      take,
      select: {
        id: true,
        name: true,
        etapa: true,
        correo: true,
        telefono: true,
        estimatedValue: true,
        updatedAt: true,
        urlSlug: true,
      },
    });
    return { contacts: rows };
  }

  /** Oportunidad asignada al usuario (solo si eres el asesor asignado). */
  async getOpportunitySummary(
    userId: string,
    opportunityId: string,
  ): Promise<Record<string, unknown>> {
    if (!(await this.userHasPermission(userId, 'oportunidades.ver'))) {
      return { error: 'Sin permiso para ver oportunidades' };
    }
    const opp = await this.prisma.opportunity.findFirst({
      where: { id: opportunityId, assignedTo: userId },
      select: {
        id: true,
        urlSlug: true,
        title: true,
        amount: true,
        etapa: true,
        status: true,
        probability: true,
        priority: true,
        expectedCloseDate: true,
        updatedAt: true,
        contacts: {
          take: 3,
          select: {
            contact: {
              select: { id: true, name: true, urlSlug: true },
            },
          },
        },
      },
    });
    if (!opp) {
      return {
        error:
          'Oportunidad no encontrada o no asignada a tu usuario (solo ves oportunidades donde eres el asesor asignado)',
      };
    }
    return { opportunity: opp };
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>,
    userId: string,
  ): Promise<Record<string, unknown>> {
    switch (name) {
      case 'list_my_tasks': {
        const raw = typeof args.scope === 'string' ? args.scope : 'today';
        const scope =
          raw === 'overdue' || raw === 'week' || raw === 'today'
            ? raw
            : 'today';
        return this.listMyTasks(userId, scope);
      }
      case 'count_opportunities_by_stage':
        return this.countOpportunitiesByStage(userId);
      case 'get_company_summary': {
        const companyId =
          typeof args.companyId === 'string' ? args.companyId.trim() : '';
        if (!companyId) {
          return { error: 'companyId es obligatorio' };
        }
        return this.getCompanySummary(userId, companyId);
      }
      case 'list_my_recent_contacts':
        return this.listMyRecentContacts(userId, args.limit);
      case 'get_opportunity_summary': {
        const opportunityId =
          typeof args.opportunityId === 'string'
            ? args.opportunityId.trim()
            : '';
        if (!opportunityId) {
          return { error: 'opportunityId es obligatorio' };
        }
        return this.getOpportunitySummary(userId, opportunityId);
      }
      default:
        return { error: `Herramienta desconocida: ${name}` };
    }
  }
}
