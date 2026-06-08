import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from './companies.service';
import type { ActivityActor } from '../activity-logs/activity-logs.types';
import type { CrmDataScope } from '../auth/crm-data-scope.service';
import { mergeCompanyScope } from '../common/crm-data-scope-where.util';

/** Probabilidades de etapa CRM (empresa) consideradas “tempranas”. */
const STALE_ETAPA_PROBABILITIES = [0, 10, 30] as const;

/** Etapas terminales: no entran en alertas ni en el cron de auto-inactivo por antigüedad. */
const EXCLUDED_FROM_STALE_TRACKING = new Set<string>(['cierre_perdido']);

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Semanas sin cambio de `etapa` antes de pasar a notificaciones (panel / tarjeta). */
export const NOTIFICATION_STALE_WEEKS = 11;

/** Semanas sin cambio antes del auto-paso a etapa `inactivo` (cron). */
export const AUTO_INACTIVO_STALE_WEEKS = 12;

const SYSTEM_ACTOR: ActivityActor = {
  userId: 'system',
  userName: `Automático (${AUTO_INACTIVO_STALE_WEEKS} semanas sin cambio de etapa)`,
};

export type CompanySinCambioEtapaAlertItem = {
  id: string;
  urlSlug: string;
  name: string;
  etapa: string;
  lastEtapaChangeAt: string;
  assignedToName: string | null;
};

@Injectable()
export class CompanyStaleEtapaService {
  private readonly logger = new Logger(CompanyStaleEtapaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
  ) {}

  private async earlyStageSlugsExcludingInactivo(): Promise<string[]> {
    const inactivoStage = await this.prisma.crmStage.findFirst({
      where: { slug: 'inactivo', enabled: true },
      select: { slug: true },
    });
    const earlyStages = await this.prisma.crmStage.findMany({
      where: {
        enabled: true,
        probability: { in: [...STALE_ETAPA_PROBABILITIES] },
      },
      select: { slug: true },
    });
    const inactivoSlug = inactivoStage?.slug;
    const exclude = new Set(EXCLUDED_FROM_STALE_TRACKING);
    if (inactivoSlug) exclude.add(inactivoSlug);
    return [...new Set(earlyStages.map((s) => s.slug))].filter((s) => !exclude.has(s));
  }

  private async lastEtapaAuditByCompanyIds(
    entityIds: string[],
  ): Promise<Map<string, Date>> {
    if (entityIds.length === 0) return new Map();
    const auditGroups = await this.prisma.auditChangeSet.groupBy({
      by: ['entityId'],
      where: {
        module: 'empresas',
        entityType: 'Empresa',
        entityId: { in: entityIds },
        entries: { some: { fieldKey: 'etapa' } },
      },
      _max: { createdAt: true },
    });
    return new Map(
      auditGroups
        .filter((g) => g.entityId && g._max.createdAt)
        .map((g) => [g.entityId!, g._max.createdAt!] as const),
    );
  }

  /**
   * Empresas visibles para el usuario: etapa con probabilidad 0/10/30 % (excluye
   * `inactivo` y `cierre_perdido`) y sin cambio de `etapa` (auditoría o `createdAt`)
   * desde al menos {@link NOTIFICATION_STALE_WEEKS} semanas.
   */
  async listSinCambioEtapaAlert(
    scope: CrmDataScope,
  ): Promise<{ count: number; items: CompanySinCambioEtapaAlertItem[] }> {
    const earlySlugs = await this.earlyStageSlugsExcludingInactivo();
    if (earlySlugs.length === 0) {
      return { count: 0, items: [] };
    }

    const companies = await this.prisma.company.findMany({
      where: mergeCompanyScope({ etapa: { in: earlySlugs } }, scope),
      select: {
        id: true,
        name: true,
        urlSlug: true,
        etapa: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    });
    if (companies.length === 0) {
      return { count: 0, items: [] };
    }

    const lastEtapaAudit = await this.lastEtapaAuditByCompanyIds(
      companies.map((c) => c.id),
    );
    const cutoff = new Date(Date.now() - NOTIFICATION_STALE_WEEKS * MS_PER_WEEK);

    const items: CompanySinCambioEtapaAlertItem[] = [];
    for (const c of companies) {
      const lastChange = lastEtapaAudit.get(c.id) ?? c.createdAt;
      if (lastChange > cutoff) continue;
      items.push({
        id: c.id,
        urlSlug: c.urlSlug,
        name: c.name,
        etapa: c.etapa,
        lastEtapaChangeAt: lastChange.toISOString(),
        assignedToName: c.user?.name ?? null,
      });
    }

    items.sort((a, b) => a.lastEtapaChangeAt.localeCompare(b.lastEtapaChangeAt));

    return { count: items.length, items };
  }

  /**
   * Empresas en etapas con probabilidad 0 %, 10 % o 30 % (excluye `inactivo` y
   * `cierre_perdido`) cuya última modificación del campo `etapa` (auditoría) es
   * anterior a {@link AUTO_INACTIVO_STALE_WEEKS} semanas → `inactivo`.
   * Si nunca hubo auditoría de `etapa`, se usa `createdAt` de la empresa.
   */
  async applyStaleInactivo(): Promise<{ scanned: number; updated: number }> {
    if (process.env.DISABLE_STALE_ETAPA_CRON === '1') {
      this.logger.verbose('DISABLE_STALE_ETAPA_CRON=1 — omitido');
      return { scanned: 0, updated: 0 };
    }

    const inactivoStage = await this.prisma.crmStage.findFirst({
      where: { slug: 'inactivo', enabled: true },
      select: { slug: true },
    });
    if (!inactivoStage) {
      this.logger.warn('No existe etapa `inactivo` habilitada; no se aplica auto-inactivo');
      return { scanned: 0, updated: 0 };
    }

    const earlySlugs = await this.earlyStageSlugsExcludingInactivo();
    if (earlySlugs.length === 0) {
      this.logger.warn('No hay etapas con probabilidad 0/10/30; no se aplica auto-inactivo');
      return { scanned: 0, updated: 0 };
    }

    const cutoff = new Date(Date.now() - AUTO_INACTIVO_STALE_WEEKS * MS_PER_WEEK);

    const companies = await this.prisma.company.findMany({
      where: { etapa: { in: earlySlugs } },
      select: { id: true, name: true, etapa: true, createdAt: true },
    });
    if (companies.length === 0) {
      return { scanned: 0, updated: 0 };
    }

    const lastEtapaAudit = await this.lastEtapaAuditByCompanyIds(
      companies.map((c) => c.id),
    );

    let updated = 0;
    for (const c of companies) {
      const lastChange = lastEtapaAudit.get(c.id) ?? c.createdAt;
      if (lastChange > cutoff) continue;

      try {
        await this.companiesService.update(
          c.id,
          { etapa: inactivoStage.slug },
          SYSTEM_ACTOR,
          undefined,
        );
        updated += 1;
        this.logger.log(
          `Empresa ${c.name} (${c.id}): ${c.etapa} → ${inactivoStage.slug} (sin cambio de etapa desde ${lastChange.toISOString()})`,
        );
      } catch (e) {
        this.logger.warn(`No se pudo inactivar empresa ${c.id}: ${e}`);
      }
    }

    this.logger.log(
      `Auto-inactivo: ${updated}/${companies.length} empresas actualizadas (corte ${cutoff.toISOString()})`,
    );

    return { scanned: companies.length, updated };
  }
}
