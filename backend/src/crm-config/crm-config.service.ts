import {
  BadRequestException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SEED_ACTIVITY_TYPES,
  SEED_LEAD_SOURCES,
  SEED_PRIORITIES,
  SEED_STAGES,
  STAGE_PROBABILITY_FALLBACK,
  SYSTEM_ACTIVITY_SLUGS,
  SYSTEM_PRIORITY_SLUGS,
  SYSTEM_STAGE_SLUGS,
} from './crm-config.constants';
import { resolveLeadSourceSlug } from './lead-source-normalize.util';

const ORG_ID = 'default';

function yearMonthToUtcFirstDay(ym: string): Date | null {
  if (!/^\d{4}-\d{2}$/.test(ym)) return null;
  const [y, m] = ym.split('-').map(Number);
  if (!y || m < 1 || m > 12) return null;
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
}

function periodStartToYearMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

@Injectable()
export class CrmConfigService implements OnModuleInit {
  private seedPromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.seedPromise = this.ensureSeedData();
    await this.seedPromise;
  }

  private async ensureReady() {
    if (this.seedPromise) {
      await this.seedPromise;
    }
  }

  private async ensureSeedData() {
    await this.prisma.crmOrganizationProfile.upsert({
      where: { id: ORG_ID },
      create: {
        id: ORG_ID,
        name: 'Taxi Monterrico',
        description:
          'Servicio de transporte ejecutivo corporativo en Lima, Perú. Ofrecemos soluciones de movilidad premium para empresas, hoteles, embajadas y organizaciones.',
        contactEmail: 'info@taximonterrico.com',
        contactPhone: '+51 1 234 5678',
        address: 'Av. Javier Prado Este 4600, Santiago de Surco, Lima, Perú',
        globalWeeklyGoal: 60000,
      },
      update: {},
    });

    const ls = await this.prisma.crmLeadSource.count();
    if (ls === 0) {
      await this.prisma.crmLeadSource.createMany({
        data: SEED_LEAD_SOURCES.map((s, i) => ({
          slug: s.slug,
          name: s.name,
          enabled: true,
          sortOrder: i,
        })),
      });
    }

    const st = await this.prisma.crmStage.count();
    if (st === 0) {
      await this.prisma.crmStage.createMany({
        data: SEED_STAGES.map((s, i) => ({
          slug: s.slug,
          name: s.name,
          color: s.color,
          probability: s.probability,
          enabled: true,
          sortOrder: i,
          isSystem: s.isSystem,
        })),
      });
    }

    const pr = await this.prisma.crmPriority.count();
    if (pr === 0) {
      await this.prisma.crmPriority.createMany({
        data: SEED_PRIORITIES.map((p, i) => ({
          slug: p.slug,
          name: p.name,
          color: p.color,
          description: p.description,
          enabled: true,
          sortOrder: i,
        })),
      });
    }

    const at = await this.prisma.crmActivityType.count();
    if (at === 0) {
      await this.prisma.crmActivityType.createMany({
        data: SEED_ACTIVITY_TYPES.map((a, i) => ({
          slug: a.slug,
          name: a.name,
          enabled: true,
          sortOrder: i,
        })),
      });
    }
  }

  private async userHasPermission(userId: string, permission: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roleId: true },
    });
    if (!u?.roleId) return false;
    const row = await this.prisma.authority.findFirst({
      where: { roleId: u.roleId, permission },
    });
    return !!row;
  }

  private async assertCanEditSalesGoals(userId: string) {
    if (await this.userHasPermission(userId, 'configuracion.editar')) {
      return;
    }
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: { select: { slug: true, name: true } } },
    });
    const slug = row?.role?.slug?.toLowerCase().trim() ?? '';
    const name = row?.role?.name?.toLowerCase().trim() ?? '';
    const supervisorLike =
      slug.includes('supervisor') ||
      slug.includes('gerente') ||
      name.includes('supervisor') ||
      name.includes('gerente');
    if (
      supervisorLike &&
      (await this.userHasPermission(userId, 'oportunidades.editar'))
    ) {
      return;
    }
    throw new BadRequestException('Sin permiso para editar metas de ventas');
  }

  async getBundle(userId: string) {
    await this.ensureReady();

    const [orgRow, myGoal, hasConfigVer, hasConfigEdit, hasOppEdit] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          role: { select: { slug: true, name: true } },
        },
      }),
      this.prisma.crmUserSalesGoal.findUnique({ where: { userId } }),
      this.userHasPermission(userId, 'configuracion.ver'),
      this.userHasPermission(userId, 'configuracion.editar'),
      this.userHasPermission(userId, 'oportunidades.editar'),
    ]);

    const slug = orgRow?.role?.slug?.toLowerCase().trim() ?? '';
    const name = orgRow?.role?.name?.toLowerCase().trim() ?? '';
    const supervisorLike =
      slug.includes('supervisor') ||
      slug.includes('gerente') ||
      name.includes('supervisor') ||
      name.includes('gerente');

    /** Ver/editar metas del equipo: configuración, o supervisor/gerente con oportunidades.editar */
    const canSeeTeamGoals =
      hasConfigVer || (supervisorLike && hasOppEdit);
    const canEditSalesGoals = hasConfigEdit || (supervisorLike && hasOppEdit);

    const [
      org,
      leadSources,
      stages,
      priorities,
      activityTypes,
    ] = await Promise.all([
      this.prisma.crmOrganizationProfile.findUnique({ where: { id: ORG_ID } }),
      this.prisma.crmLeadSource.findMany({
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.crmStage.findMany({
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.crmPriority.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.crmActivityType.findMany({ orderBy: { sortOrder: 'asc' } }),
    ]);

    const orgDto = org
      ? {
          id: org.id,
          name: org.name,
          description: org.description,
          contactEmail: org.contactEmail,
          contactPhone: org.contactPhone,
          address: org.address,
          globalWeeklyGoal: org.globalWeeklyGoal,
        }
      : null;

    let salesGoals:
      | {
          globalWeekly: number;
          myWeekly: number;
          myMonthly: number;
          byUserId: Record<string, { weekly: number; monthly: number }>;
          monthlyByYm: Record<string, number>;
          advisorMonthlyByYm: Record<string, Record<string, number>>;
        }
      | undefined;

    const monthlyRows = org
      ? await this.prisma.crmMonthlySalesTarget.findMany({
          where: { organizationId: ORG_ID },
          orderBy: { periodStart: 'asc' },
          select: { periodStart: true, amount: true },
        })
      : [];
    const monthlyByYm: Record<string, number> = {};
    for (const r of monthlyRows) {
      monthlyByYm[periodStartToYearMonth(r.periodStart)] = r.amount;
    }

    let advisorMonthRows: { userId: string; periodStart: Date; amount: number }[] =
      [];
    if (org) {
      if (canSeeTeamGoals) {
        advisorMonthRows = await this.prisma.crmUserMonthlySalesTarget.findMany({
          orderBy: [{ userId: 'asc' }, { periodStart: 'asc' }],
          select: { userId: true, periodStart: true, amount: true },
        });
      } else {
        advisorMonthRows = await this.prisma.crmUserMonthlySalesTarget.findMany({
          where: { userId },
          orderBy: { periodStart: 'asc' },
          select: { userId: true, periodStart: true, amount: true },
        });
      }
    }
    const advisorMonthlyByYm: Record<string, Record<string, number>> = {};
    for (const r of advisorMonthRows) {
      const ym = periodStartToYearMonth(r.periodStart);
      if (!advisorMonthlyByYm[r.userId]) advisorMonthlyByYm[r.userId] = {};
      advisorMonthlyByYm[r.userId][ym] = r.amount;
    }

    if (org && canSeeTeamGoals) {
      const rows = await this.prisma.crmUserSalesGoal.findMany();
      const byUserId: Record<string, { weekly: number; monthly: number }> = {};
      for (const r of rows) {
        byUserId[r.userId] = { weekly: r.weeklyTarget, monthly: r.monthlyTarget };
      }
      salesGoals = {
        globalWeekly: org.globalWeeklyGoal,
        myWeekly: myGoal?.weeklyTarget ?? 0,
        myMonthly: myGoal?.monthlyTarget ?? 0,
        byUserId,
        monthlyByYm,
        advisorMonthlyByYm,
      };
    } else if (org) {
      salesGoals = {
        globalWeekly: org.globalWeeklyGoal,
        myWeekly: myGoal?.weeklyTarget ?? 0,
        myMonthly: myGoal?.monthlyTarget ?? 0,
        byUserId: {},
        monthlyByYm,
        advisorMonthlyByYm,
      };
    }

    return {
      organization: orgDto,
      catalog: {
        leadSources: leadSources.map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          enabled: r.enabled,
          sortOrder: r.sortOrder,
        })),
        stages: stages.map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          color: r.color,
          probability: r.probability,
          enabled: r.enabled,
          sortOrder: r.sortOrder,
          isSystem: r.isSystem,
        })),
        priorities: priorities.map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          color: r.color,
          description: r.description,
          enabled: r.enabled,
          sortOrder: r.sortOrder,
        })),
        activityTypes: activityTypes.map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          enabled: r.enabled,
          sortOrder: r.sortOrder,
        })),
      },
      salesGoals,
      permissions: {
        canEditConfig: hasConfigEdit,
        canViewTeamGoals: canSeeTeamGoals,
        canEditSalesGoals,
      },
    };
  }

  async patchOrganization(userId: string, body: {
    name?: string;
    description?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
  }) {
    await this.ensureReady();
    const ok = await this.userHasPermission(userId, 'configuracion.editar');
    if (!ok) {
      throw new BadRequestException('Sin permiso para editar configuración');
    }
    const org = await this.prisma.crmOrganizationProfile.update({
      where: { id: ORG_ID },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description.trim() }),
        ...(body.contactEmail !== undefined && { contactEmail: body.contactEmail.trim() }),
        ...(body.contactPhone !== undefined && { contactPhone: body.contactPhone.trim() }),
        ...(body.address !== undefined && { address: body.address.trim() }),
      },
    });
    return {
      id: org.id,
      name: org.name,
      description: org.description,
      contactEmail: org.contactEmail,
      contactPhone: org.contactPhone,
      address: org.address,
      globalWeeklyGoal: org.globalWeeklyGoal,
    };
  }

  async putLeadSources(
    userId: string,
    items: { slug: string; name: string; enabled: boolean }[],
  ) {
    await this.ensureReady();
    const ok = await this.userHasPermission(userId, 'configuracion.editar');
    if (!ok) {
      throw new BadRequestException('Sin permiso para editar configuración');
    }
    const incoming = new Set(items.map((i) => i.slug));
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const slug = it.slug.trim().toLowerCase();
        if (!slug) {
          throw new BadRequestException('Slug de fuente inválido');
        }
        await tx.crmLeadSource.upsert({
          where: { slug },
          create: {
            slug,
            name: it.name.trim(),
            enabled: it.enabled,
            sortOrder: i,
          },
          update: {
            name: it.name.trim(),
            enabled: it.enabled,
            sortOrder: i,
          },
        });
      }
      const existing = await tx.crmLeadSource.findMany({ select: { slug: true } });
      for (const { slug } of existing) {
        if (incoming.has(slug)) continue;
        const cnt = await tx.contact.count({ where: { fuente: slug } });
        if (cnt > 0) {
          throw new BadRequestException(
            `No se puede quitar la fuente "${slug}": hay ${cnt} contacto(s) con esa fuente`,
          );
        }
        await tx.crmLeadSource.delete({ where: { slug } });
      }
    });
    return this.getBundle(userId);
  }

  async assertEtapaAssignable(rawEtapa: string): Promise<void> {
    await this.ensureReady();
    const slug = rawEtapa.trim().toLowerCase();
    if (!slug) {
      throw new BadRequestException('La etapa no puede estar vacía');
    }
    const row = await this.prisma.crmStage.findUnique({
      where: { slug },
      select: { enabled: true },
    });
    if (!row) {
      throw new BadRequestException(
        `La etapa "${slug}" no existe en el catálogo del CRM`,
      );
    }
    if (!row.enabled) {
      throw new BadRequestException(
        `La etapa "${slug}" está deshabilitada en configuración`,
      );
    }
  }

  /**
   * Normaliza fuente de contacto/empresa al `slug` del catálogo (mayúsculas, nombre visible o slug).
   */
  async normalizeLeadSource(raw: string): Promise<string> {
    await this.ensureReady();
    const trimmed = raw?.trim() ?? '';
    if (!trimmed) {
      throw new BadRequestException('La fuente no puede estar vacía');
    }
    const rows = await this.prisma.crmLeadSource.findMany({
      where: { enabled: true },
      select: { slug: true, name: true },
    });
    const slug = resolveLeadSourceSlug(trimmed, rows);
    if (!slug) {
      throw new BadRequestException(
        `Fuente no válida: "${trimmed}". Usa una fuente del catálogo CRM.`,
      );
    }
    return slug;
  }

  /** Probabilidad comercial según catálogo; fallback si el slug no está en BD. */
  async resolveOpportunityProbability(etapa: string): Promise<number> {
    await this.ensureReady();
    const slug = etapa.trim().toLowerCase();
    const row = await this.prisma.crmStage.findUnique({
      where: { slug },
      select: { probability: true },
    });
    if (row) return row.probability;
    return STAGE_PROBABILITY_FALLBACK[slug] ?? 0;
  }

  async putStages(
    userId: string,
    items: {
      slug: string;
      name: string;
      color: string;
      probability: number;
      enabled: boolean;
      isSystem?: boolean;
    }[],
  ) {
    await this.ensureReady();
    const ok = await this.userHasPermission(userId, 'configuracion.editar');
    if (!ok) {
      throw new BadRequestException('Sin permiso para editar configuración');
    }
    const incomingSlugs = new Set(items.map((i) => i.slug));
    for (const req of SYSTEM_STAGE_SLUGS) {
      if (!incomingSlugs.has(req)) {
        throw new BadRequestException(
          `La etapa del sistema "${req}" debe permanecer en la lista`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const slug = it.slug.trim().toLowerCase();
        if (!slug) throw new BadRequestException('Slug de etapa inválido');
        const prev = await tx.crmStage.findUnique({ where: { slug } });
        const lockSystem = prev?.isSystem === true || SYSTEM_STAGE_SLUGS.has(slug);
        const isSystem = lockSystem ? true : (it.isSystem ?? false);
        await tx.crmStage.upsert({
          where: { slug },
          create: {
            slug,
            name: it.name.trim(),
            color: it.color.trim() || '#64748b',
            probability: Math.round(Number(it.probability) || 0),
            enabled: it.enabled,
            sortOrder: i,
            isSystem,
          },
          update: {
            name: it.name.trim(),
            color: it.color.trim() || '#64748b',
            probability: Math.round(Number(it.probability) || 0),
            enabled: it.enabled,
            sortOrder: i,
            isSystem,
          },
        });
      }

      const existing = await tx.crmStage.findMany({
        select: { slug: true, isSystem: true },
      });
      for (const row of existing) {
        if (incomingSlugs.has(row.slug)) continue;
        if (row.isSystem || SYSTEM_STAGE_SLUGS.has(row.slug)) {
          throw new BadRequestException(
            `No se puede eliminar la etapa sistema "${row.slug}" desde la lista`,
          );
        }
        const [cc, co, op] = await Promise.all([
          tx.contact.count({ where: { etapa: row.slug } }),
          tx.company.count({ where: { etapa: row.slug } }),
          tx.opportunity.count({ where: { etapa: row.slug } }),
        ]);
        if (cc + co + op > 0) {
          throw new BadRequestException(
            `No se puede eliminar "${row.slug}": hay registros en esa etapa`,
          );
        }
        await tx.crmStage.delete({ where: { slug: row.slug } });
      }
    });
    return this.getBundle(userId);
  }

  async putPriorities(
    userId: string,
    items: {
      slug: string;
      name: string;
      color: string;
      description: string;
      enabled: boolean;
    }[],
  ) {
    await this.ensureReady();
    const ok = await this.userHasPermission(userId, 'configuracion.editar');
    if (!ok) {
      throw new BadRequestException('Sin permiso para editar configuración');
    }
    const incoming = new Set(items.map((i) => i.slug));
    for (const req of SYSTEM_PRIORITY_SLUGS) {
      if (!incoming.has(req)) {
        throw new BadRequestException(`La prioridad "${req}" debe permanecer en la lista`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const slug = it.slug.trim().toLowerCase();
        await tx.crmPriority.upsert({
          where: { slug },
          create: {
            slug,
            name: it.name.trim(),
            color: it.color.trim(),
            description: (it.description ?? '').trim(),
            enabled: it.enabled,
            sortOrder: i,
          },
          update: {
            name: it.name.trim(),
            color: it.color.trim(),
            description: (it.description ?? '').trim(),
            enabled: it.enabled,
            sortOrder: i,
          },
        });
      }

      const existing = await tx.crmPriority.findMany({ select: { slug: true } });
      for (const { slug } of existing) {
        if (incoming.has(slug)) continue;
        if (SYSTEM_PRIORITY_SLUGS.has(slug)) {
          throw new BadRequestException(`No se puede eliminar la prioridad sistema "${slug}"`);
        }
        const cnt = await tx.opportunity.count({ where: { priority: slug } });
        if (cnt > 0) {
          throw new BadRequestException(
            `No se puede quitar "${slug}": hay oportunidades con esa prioridad`,
          );
        }
        await tx.crmPriority.delete({ where: { slug } });
      }
    });
    return this.getBundle(userId);
  }

  async putActivityTypes(
    userId: string,
    items: { slug: string; name: string; enabled: boolean }[],
  ) {
    await this.ensureReady();
    const ok = await this.userHasPermission(userId, 'configuracion.editar');
    if (!ok) {
      throw new BadRequestException('Sin permiso para editar configuración');
    }
    const incoming = new Set(items.map((i) => i.slug));
    for (const req of SYSTEM_ACTIVITY_SLUGS) {
      if (!incoming.has(req)) {
        throw new BadRequestException(`El tipo de actividad "${req}" debe permanecer en la lista`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const slug = it.slug.trim().toLowerCase();
        await tx.crmActivityType.upsert({
          where: { slug },
          create: {
            slug,
            name: it.name.trim(),
            enabled: it.enabled,
            sortOrder: i,
          },
          update: {
            name: it.name.trim(),
            enabled: it.enabled,
            sortOrder: i,
          },
        });
      }

      const existing = await tx.crmActivityType.findMany({ select: { slug: true } });
      for (const { slug } of existing) {
        if (incoming.has(slug)) continue;
        if (SYSTEM_ACTIVITY_SLUGS.has(slug)) {
          throw new BadRequestException(`No se puede eliminar el tipo sistema "${slug}"`);
        }
        const cnt = await tx.activity.count({ where: { type: slug } });
        if (cnt > 0) {
          throw new BadRequestException(
            `No se puede quitar "${slug}": hay actividades con ese tipo`,
          );
        }
        await tx.crmActivityType.delete({ where: { slug } });
      }
    });
    return this.getBundle(userId);
  }

  async putSalesGoals(
    userId: string,
    body: {
      globalWeekly: number;
      byUserId: Record<string, { weekly?: number; monthly?: number }>;
      /** YYYY-MM → monto. Valor ≤0 elimina la fila (mes sin meta explícita). */
      monthlyByYm?: Record<string, number>;
      /** userId → (YYYY-MM → monto). Valor ≤0 elimina la fila de meta mensual del asesor. */
      advisorMonthlyByYm?: Record<string, Record<string, number>>;
    },
  ) {
    await this.ensureReady();
    await this.assertCanEditSalesGoals(userId);
    const gw = Math.max(0, Number(body.globalWeekly) || 0);

    await this.prisma.$transaction(async (tx) => {
      await tx.crmOrganizationProfile.update({
        where: { id: ORG_ID },
        data: {
          globalWeeklyGoal: gw,
        },
      });

      const ids = Object.keys(body.byUserId ?? {});
      for (const uid of ids) {
        const v = body.byUserId[uid];
        if (!v) continue;
        const hasWeekly = v.weekly !== undefined;
        const hasMonthly = v.monthly !== undefined;
        if (!hasWeekly && !hasMonthly) continue;
        const w = hasWeekly ? Math.max(0, Number(v.weekly) || 0) : undefined;
        const m = hasMonthly ? Math.max(0, Number(v.monthly) || 0) : undefined;
        const exists = await tx.user.findUnique({
          where: { id: uid },
          select: { id: true },
        });
        if (!exists) continue;
        await tx.crmUserSalesGoal.upsert({
          where: { userId: uid },
          create: {
            userId: uid,
            weeklyTarget: w ?? 0,
            monthlyTarget: m ?? 0,
          },
          update: {
            ...(w !== undefined ? { weeklyTarget: w } : {}),
            ...(m !== undefined ? { monthlyTarget: m } : {}),
          },
        });
      }

      if (
        body.monthlyByYm != null &&
        typeof body.monthlyByYm === 'object' &&
        !Array.isArray(body.monthlyByYm)
      ) {
        for (const [ym, raw] of Object.entries(body.monthlyByYm)) {
          const d = yearMonthToUtcFirstDay(ym);
          if (!d) continue;
          const amt = Math.max(0, Number(raw) || 0);
          if (amt <= 0) {
            await tx.crmMonthlySalesTarget.deleteMany({
              where: { organizationId: ORG_ID, periodStart: d },
            });
          } else {
            await tx.crmMonthlySalesTarget.upsert({
              where: {
                organizationId_periodStart: {
                  organizationId: ORG_ID,
                  periodStart: d,
                },
              },
              create: { organizationId: ORG_ID, periodStart: d, amount: amt },
              update: { amount: amt },
            });
          }
        }
      }

      if (
        body.advisorMonthlyByYm != null &&
        typeof body.advisorMonthlyByYm === 'object' &&
        !Array.isArray(body.advisorMonthlyByYm)
      ) {
        for (const [uid, inner] of Object.entries(body.advisorMonthlyByYm)) {
          if (inner == null || typeof inner !== 'object' || Array.isArray(inner)) {
            continue;
          }
          const existsUser = await tx.user.findUnique({
            where: { id: uid },
            select: { id: true },
          });
          if (!existsUser) continue;
          for (const [ym, raw] of Object.entries(inner)) {
            const d = yearMonthToUtcFirstDay(ym);
            if (!d) continue;
            const amt = Math.max(0, Number(raw) || 0);
            if (amt <= 0) {
              await tx.crmUserMonthlySalesTarget.deleteMany({
                where: { userId: uid, periodStart: d },
              });
            } else {
              await tx.crmUserMonthlySalesTarget.upsert({
                where: {
                  userId_periodStart: {
                    userId: uid,
                    periodStart: d,
                  },
                },
                create: { userId: uid, periodStart: d, amount: amt },
                update: { amount: amt },
              });
            }
          }
        }
      }
    });
    return this.getBundle(userId);
  }

  /** Filas de etapa para importación CSV (solo habilitadas). */
  async listEnabledStagesForImport(): Promise<
    {
      slug: string;
      name: string;
      probability: number;
      sortOrder: number;
    }[]
  > {
    await this.ensureReady();
    return this.prisma.crmStage.findMany({
      where: { enabled: true },
      select: { slug: true, name: true, probability: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Resuelve la columna `etapa` del CSV: slug, nombre visible (p. ej. «Reunión Agendada»),
   * o porcentaje (`0`, `0%`, `10`, `10%`, `-1`…) según la probabilidad del catálogo.
   */
  resolveEtapaSlugFromCsvCell(
    stages: {
      slug: string;
      name: string;
      probability: number;
      sortOrder: number;
    }[],
    raw: string,
  ): { ok: true; slug: string } | { ok: false; message: string } {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) {
      return { ok: true, slug: 'lead' };
    }

    const fold = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/_/g, ' ')
        .trim();

    const tLower = trimmed.toLowerCase();
    const tFold = fold(trimmed);

    const bySlug = stages.find((s) => s.slug.toLowerCase() === tLower);
    if (bySlug) return { ok: true, slug: bySlug.slug };

    const slugish = tLower.replace(/\s+/g, '_');
    const bySlugish = stages.find((s) => s.slug.toLowerCase() === slugish);
    if (bySlugish) return { ok: true, slug: bySlugish.slug };

    const byName = stages.find((s) => fold(s.name) === tFold);
    if (byName) return { ok: true, slug: byName.slug };

    const pctClean = trimmed.replace(/%/g, '').trim().replace(',', '.');
    const pctNum = Number.parseFloat(pctClean);
    if (Number.isFinite(pctNum)) {
      const rounded = Math.round(pctNum);
      const matches = stages.filter((s) => s.probability === rounded);
      if (matches.length === 0) {
        return {
          ok: false,
          message: `etapa: ninguna etapa habilitada tiene probabilidad ${rounded}%`,
        };
      }
      const best = matches.reduce((a, b) =>
        a.sortOrder <= b.sortOrder ? a : b,
      );
      return { ok: true, slug: best.slug };
    }

    return {
      ok: false,
      message: `etapa no reconocida: "${trimmed}" (slug, nombre o porcentaje del catálogo)`,
    };
  }
}
