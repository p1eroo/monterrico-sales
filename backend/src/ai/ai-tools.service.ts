import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

function clampIntArg(
  raw: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n =
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.floor(raw)
      : typeof raw === 'string'
        ? Number.parseInt(raw, 10)
        : Number.NaN;
  if (!Number.isFinite(n) || Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

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

  /** Total de contactos asignados al usuario (misma visión que el listado “mis contactos”). */
  async countMyContacts(userId: string): Promise<Record<string, unknown>> {
    if (!(await this.userHasPermission(userId, 'contactos.ver'))) {
      return { error: 'Sin permiso para ver contactos' };
    }
    const count = await this.prisma.contact.count({
      where: { assignedTo: userId },
    });
    return { count, scope: 'contactos asignados a ti' };
  }

  /** Total de empresas asignadas al usuario. */
  async countMyCompanies(userId: string): Promise<Record<string, unknown>> {
    if (!(await this.userHasPermission(userId, 'empresas.ver'))) {
      return { error: 'Sin permiso para ver empresas' };
    }
    const count = await this.prisma.company.count({
      where: { assignedTo: userId },
    });
    return { count, scope: 'empresas asignadas a ti' };
  }

  /**
   * Total de empresas en el CRM (misma visión que el listado sin filtrar por asesor).
   * Quien tenga empresas.ver puede verlo en la UI con «Todos los asesores».
   */
  async countAllCompanies(userId: string): Promise<Record<string, unknown>> {
    if (!(await this.userHasPermission(userId, 'empresas.ver'))) {
      return { error: 'Sin permiso para ver empresas' };
    }
    const count = await this.prisma.company.count();
    return { count, scope: 'todas las empresas registradas en el CRM' };
  }

  /** Oportunidades abiertas asignadas al usuario. */
  async countMyOpenOpportunities(
    userId: string,
  ): Promise<Record<string, unknown>> {
    if (!(await this.userHasPermission(userId, 'oportunidades.ver'))) {
      return { error: 'Sin permiso para ver oportunidades' };
    }
    const count = await this.prisma.opportunity.count({
      where: { assignedTo: userId, status: 'abierta' },
    });
    return { count, scope: 'oportunidades abiertas asignadas a ti' };
  }

  /** Tareas no completadas asignadas al usuario. */
  async countMyPendingTasks(userId: string): Promise<Record<string, unknown>> {
    if (!(await this.userHasPermission(userId, 'actividades.ver'))) {
      return { error: 'Sin permiso para ver actividades' };
    }
    const count = await this.prisma.activity.count({
      where: {
        assignedTo: userId,
        status: { not: 'completada' },
      },
    });
    return { count, scope: 'tareas pendientes asignadas a ti' };
  }

  /**
   * Empresas tuyas sin cambios en el registro desde hace al menos N días (`updatedAt`).
   * Proxy de “inactividad” a nivel CRM (no incluye actividades vinculadas en esta versión).
   */
  async listMyCompaniesInactiveDays(
    userId: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!(await this.userHasPermission(userId, 'empresas.ver'))) {
      return { error: 'Sin permiso para ver empresas' };
    }
    const days = clampIntArg(args.min_days_inactive, 12, 1, 365);
    const limit = clampIntArg(args.limit, 15, 1, 25);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    const rows = await this.prisma.company.findMany({
      where: {
        assignedTo: userId,
        updatedAt: { lt: cutoff },
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
      select: {
        id: true,
        name: true,
        urlSlug: true,
        etapa: true,
        updatedAt: true,
      },
    });
    return {
      minDaysInactive: days,
      countReturned: rows.length,
      companies: rows,
      note: 'Criterio: última actualización del registro de empresa en el CRM (updatedAt).',
    };
  }

  /** Contactos tuyos sin actualización del registro desde hace al menos N días. */
  async listMyContactsInactiveDays(
    userId: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!(await this.userHasPermission(userId, 'contactos.ver'))) {
      return { error: 'Sin permiso para ver contactos' };
    }
    const days = clampIntArg(args.min_days_inactive, 12, 1, 365);
    const limit = clampIntArg(args.limit, 15, 1, 25);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    const rows = await this.prisma.contact.findMany({
      where: {
        assignedTo: userId,
        updatedAt: { lt: cutoff },
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
      select: {
        id: true,
        name: true,
        urlSlug: true,
        etapa: true,
        correo: true,
        updatedAt: true,
      },
    });
    return {
      minDaysInactive: days,
      countReturned: rows.length,
      contacts: rows,
      note: 'Criterio: última actualización del registro de contacto (updatedAt).',
    };
  }

  /**
   * Fragmentos de bases de conocimiento del usuario que contienen el texto (búsqueda simple, sin embeddings).
   */
  async searchMyKnowledge(
    userId: string,
    queryRaw: unknown,
  ): Promise<Record<string, unknown>> {
    const q =
      typeof queryRaw === 'string' ? queryRaw.trim().slice(0, 500) : '';
    if (q.length < 2) {
      return {
        error:
          'Indica una consulta de búsqueda de al menos 2 caracteres (palabras clave del documento)',
      };
    }

    const rows = await this.prisma.aiKnowledgeChunk.findMany({
      where: {
        knowledgeBase: { userId },
        content: { contains: q, mode: Prisma.QueryMode.insensitive },
      },
      take: 10,
      orderBy: [{ knowledgeBaseId: 'asc' }, { position: 'asc' }],
      select: {
        position: true,
        content: true,
        knowledgeBase: { select: { id: true, title: true } },
      },
    });

    const snippets = rows.map((r) => ({
      knowledgeBaseId: r.knowledgeBase.id,
      knowledgeTitle: r.knowledgeBase.title,
      chunkPosition: r.position,
      excerpt:
        r.content.length > 1_800
          ? `${r.content.slice(0, 1_800)}…`
          : r.content,
    }));

    return {
      query: q,
      matchCount: snippets.length,
      snippets,
      note:
        snippets.length === 0
          ? 'No hay coincidencias en tus bases indexadas. Crea o reindexa conocimiento en Agentes IA → Conocimiento.'
          : 'Usa estos extractos como contexto; no inventes datos fuera de ellos.',
    };
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
      case 'count_my_contacts':
        return this.countMyContacts(userId);
      case 'count_my_companies':
        return this.countMyCompanies(userId);
      case 'count_all_companies':
        return this.countAllCompanies(userId);
      case 'count_my_open_opportunities':
        return this.countMyOpenOpportunities(userId);
      case 'count_my_pending_tasks':
        return this.countMyPendingTasks(userId);
      case 'list_my_companies_inactive_days':
        return this.listMyCompaniesInactiveDays(userId, args);
      case 'list_my_contacts_inactive_days':
        return this.listMyContactsInactiveDays(userId, args);
      case 'search_my_knowledge': {
        const q =
          typeof args.query === 'string'
            ? args.query
            : typeof args.q === 'string'
              ? args.q
              : '';
        return this.searchMyKnowledge(userId, q);
      }
      default:
        return { error: `Herramienta desconocida: ${name}` };
    }
  }
}
