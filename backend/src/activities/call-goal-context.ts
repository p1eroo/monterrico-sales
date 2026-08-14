import { STAGE_PROBABILITY_FALLBACK } from '../crm-config/crm-config.constants';
import { buildEtapaStepFunction } from '../import-export/company-export-weeks.util';
import { PrismaService } from '../prisma/prisma.service';
import type { CompanyContactGoalContext } from './call-goal-kind.util';

/** Etapa histórica de empresas vinculadas a llamadas (reglas de meta de contacto). */
export async function loadContactGoalCompanyContext(
  prisma: PrismaService,
  companyIds: string[],
  referenceTo: Date,
): Promise<{
  getProb: (slug: string) => number;
  byCompanyId: Map<string, CompanyContactGoalContext>;
}> {
  const uniqueIds = [...new Set(companyIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    const getProb = (_slug: string) => 0;
    return { getProb, byCompanyId: new Map() };
  }

  const [stages, companies, auditRows] = await Promise.all([
    prisma.crmStage.findMany({
      where: { enabled: true },
      select: { slug: true, probability: true },
    }),
    prisma.company.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, createdAt: true, etapa: true },
    }),
    prisma.auditChangeSet.findMany({
      where: {
        module: 'empresas',
        entityType: 'Empresa',
        entityId: { in: uniqueIds },
        createdAt: { lte: referenceTo },
        entries: { some: { fieldKey: 'etapa' } },
      },
      include: {
        entries: {
          where: { fieldKey: 'etapa' },
          select: { oldValue: true, newValue: true },
        },
      },
    }),
  ]);

  const stageInfo = new Map<string, number>();
  for (const stage of stages) {
    stageInfo.set(stage.slug, stage.probability);
  }
  const getProb = (slug: string): number => {
    const key = slug.trim();
    if (stageInfo.has(key)) return stageInfo.get(key)!;
    return STAGE_PROBABILITY_FALLBACK[key] ?? 0;
  };

  type AuditEv = { at: Date; oldSlug: string; newSlug: string };
  const auditsByCompany = new Map<string, AuditEv[]>();
  for (const row of auditRows) {
    const id = row.entityId;
    if (!id) continue;
    const entry = row.entries[0];
    if (!entry) continue;
    const oldSlug = entry.oldValue.trim();
    const newSlug = entry.newValue.trim();
    if (!oldSlug && !newSlug) continue;
    const list = auditsByCompany.get(id) ?? [];
    list.push({ at: row.createdAt, oldSlug, newSlug });
    auditsByCompany.set(id, list);
  }
  for (const [, list] of auditsByCompany) {
    list.sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  const byCompanyId = new Map<string, CompanyContactGoalContext>();
  for (const company of companies) {
    const audits = auditsByCompany.get(company.id) ?? [];
    byCompanyId.set(company.id, {
      id: company.id,
      createdAt: company.createdAt,
      etapaFn: buildEtapaStepFunction(
        company.createdAt,
        company.etapa,
        audits.map((audit) => ({
          at: audit.at,
          oldValue: audit.oldSlug,
          newValue: audit.newSlug,
        })),
      ),
      audits,
    });
  }

  return { getProb, byCompanyId };
}
