/**
 * Repara 8 casos Lila Borges: sync etapa sin audit en empresa/contacto.
 *
 * Uso (desde backend/):
 *   DRY_RUN=true npm run scripts:repair-lila-etapa-sync
 *   npm run scripts:repair-lila-etapa-sync
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const LILA = {
  userId: 'cmnq78i0y000x2yvqtukpqp88',
  userName: 'Lila Borges',
};

type RepairCase = {
  label: string;
  companyId: string;
  opportunityId: string;
  etapa: string;
  backfillAt: Date;
  fixEtapa: boolean;
  deleteOppAuditIds: string[];
  deleteActivityLogIds: string[];
};

const CASES: RepairCase[] = [
  {
    label: 'Apu Corp S.A.C.',
    companyId: 'cmrttlaan0056y7ptuep56m7f',
    opportunityId: 'cmrttlbyx0058y7ptyfc7bvi4',
    etapa: 'contacto',
    backfillAt: new Date('2026-07-30T19:34:33.363Z'),
    fixEtapa: true,
    deleteOppAuditIds: [],
    deleteActivityLogIds: [],
  },
  {
    label: 'Maq Depot S.A.C.',
    companyId: 'cmrttysa200moy7pt4w4r47ql',
    opportunityId: 'cmrttytye00mqy7ptgx7eogra',
    etapa: 'contacto',
    backfillAt: new Date('2026-07-30T22:41:51.867Z'),
    fixEtapa: false,
    deleteOppAuditIds: ['cmsda5ta208ayst7d6qdpzvhc'],
    deleteActivityLogIds: ['cmsda5tji08b2st7d8kry8kv1'],
  },
  {
    label: 'Movitecnica S A',
    companyId: 'cmrttsnuo00eny7pttzlurg0l',
    opportunityId: 'cmrttspiz00epy7pt8xfsw6n0',
    etapa: 'lead',
    backfillAt: new Date('2026-07-31T22:38:58.704Z'),
    fixEtapa: false,
    deleteOppAuditIds: ['cmsdag77008iast7d5gdsq1mk'],
    deleteActivityLogIds: ['cmsdag7gf08iest7d5loj0x5i'],
  },
  {
    label: 'On Empresas',
    companyId: 'cmrttsd5200eey7ptj2nl9ac6',
    opportunityId: 'cmrttsetg00egy7pttqjpm2p7',
    etapa: 'reunion_agendada',
    backfillAt: new Date('2026-07-30T13:32:20.577Z'),
    fixEtapa: true,
    deleteOppAuditIds: [],
    deleteActivityLogIds: [],
  },
  {
    label: 'San Miguel Industrias -Ism',
    companyId: 'cmrtts0p000e0y7pt2gnk0qru',
    opportunityId: 'cmrtts2da00e2y7ptxyse598d',
    etapa: 'contacto',
    backfillAt: new Date('2026-07-31T22:47:46.325Z'),
    fixEtapa: true,
    deleteOppAuditIds: [],
    deleteActivityLogIds: [],
  },
  {
    label: 'Shougang Hierro Peru S.a.a.',
    companyId: 'cmo0h1dqv01qs457d8yrulr9i',
    opportunityId: 'cmorobvnt01uwc07dz0moxql4',
    etapa: 'lead',
    backfillAt: new Date('2026-07-30T21:40:22.988Z'),
    fixEtapa: false,
    deleteOppAuditIds: [],
    deleteActivityLogIds: [],
  },
  {
    label: 'Tumi Contratistas Mineros S.A.C.',
    companyId: 'cmrttux4o00hny7ptqx6gz8ns',
    opportunityId: 'cmrttuyt000hpy7ptydgo7mo8',
    etapa: 'contacto',
    backfillAt: new Date('2026-07-27T15:48:40.720Z'),
    fixEtapa: true,
    deleteOppAuditIds: [],
    deleteActivityLogIds: [],
  },
  {
    label: 'Volcan',
    companyId: 'cmo7eq4fq07m4457dqpgc1809',
    opportunityId: 'cmo7eq69607m8457dc6uzhqgc',
    etapa: 'lead',
    backfillAt: new Date('2026-07-30T22:58:46.497Z'),
    fixEtapa: false,
    deleteOppAuditIds: ['cmsda1rxa087wst7dhqf8yh0b'],
    deleteActivityLogIds: ['cmsda1s6p0880st7dc5n32u5h'],
  },
];

function statusFromEtapa(etapa: string): string {
  if (etapa === 'activo') return 'ganada';
  if (['cierre_perdido', 'inactivo'].includes(etapa)) return 'perdida';
  return 'abierta';
}

function etapaDescription(
  entityType: 'Empresa' | 'Contacto',
  oldEtapa: string,
  newEtapa: string,
): string {
  return entityType === 'Empresa'
    ? `Etapa de la empresa: ${oldEtapa} → ${newEtapa}`
    : `Etapa del contacto: ${oldEtapa} → ${newEtapa}`;
}

async function insertEtapaBackfill(
  prisma: PrismaService,
  opts: {
    module: 'empresas' | 'contactos';
    entityType: 'Empresa' | 'Contacto';
    entityId: string;
    entityName: string;
    oldEtapa: string;
    newEtapa: string;
    at: Date;
  },
) {
  await prisma.auditChangeSet.create({
    data: {
      userId: LILA.userId,
      userName: LILA.userName,
      action: 'cambiar_etapa',
      module: opts.module,
      entityType: opts.entityType,
      entityId: opts.entityId,
      entityName: opts.entityName,
      createdAt: opts.at,
      entries: {
        create: {
          fieldKey: 'etapa',
          fieldLabel: 'Etapa',
          oldValue: opts.oldEtapa,
          newValue: opts.newEtapa,
        },
      },
    },
  });
  await prisma.activityLog.create({
    data: {
      userId: LILA.userId,
      userName: LILA.userName,
      action: 'cambiar_etapa',
      module: opts.module,
      entityType: opts.entityType,
      entityId: opts.entityId,
      entityName: opts.entityName,
      description: etapaDescription(opts.entityType, opts.oldEtapa, opts.newEtapa),
      createdAt: opts.at,
    },
  });
}

async function main() {
  const dryRun = process.env.DRY_RUN?.trim() === 'true';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const prisma = app.get(PrismaService);

  console.log(dryRun ? '\n🔍 DRY RUN — sin cambios en BD\n' : '\n⚙️  Aplicando reparación…\n');

  const stageRows = await prisma.crmStage.findMany({
    where: { enabled: true },
    select: { slug: true, probability: true },
  });
  const probBySlug = new Map(stageRows.map((s) => [s.slug, s.probability]));

  const run = async () => {
    for (const row of CASES) {
      console.log(`— ${row.label}`);

      for (const auditId of row.deleteOppAuditIds) {
        console.log(`   borrar AuditChangeSet opp: ${auditId}`);
        if (!dryRun) {
          await prisma.auditChangeSet.delete({ where: { id: auditId } });
        }
      }
      for (const logId of row.deleteActivityLogIds) {
        console.log(`   borrar ActivityLog opp: ${logId}`);
        if (!dryRun) {
          await prisma.activityLog.delete({ where: { id: logId } });
        }
      }

      if (row.fixEtapa) {
        const probability = probBySlug.get(row.etapa) ?? 0;
        const status = statusFromEtapa(row.etapa);
        console.log(`   restaurar etapas → ${row.etapa} (${status})`);
        if (!dryRun) {
          await prisma.company.update({
            where: { id: row.companyId },
            data: { etapa: row.etapa },
          });
          await prisma.opportunity.update({
            where: { id: row.opportunityId },
            data: { etapa: row.etapa, status, probability },
          });
          const links = await prisma.companyContact.findMany({
            where: { companyId: row.companyId },
            select: { contactId: true },
          });
          if (links.length > 0) {
            await prisma.contact.updateMany({
              where: { id: { in: links.map((l) => l.contactId) } },
              data: { etapa: row.etapa },
            });
          }
        }
      }

      const company = await prisma.company.findUnique({
        where: { id: row.companyId },
        select: { name: true, etapa: true },
      });
      if (!company) throw new Error(`Empresa no encontrada: ${row.companyId}`);

      const hasCompanyEtapaAudit = await prisma.auditChangeSet.findFirst({
        where: {
          entityId: row.companyId,
          module: 'empresas',
          entries: { some: { fieldKey: 'etapa' } },
        },
        select: { id: true },
      });

      if (!hasCompanyEtapaAudit) {
        console.log(
          `   backfill empresa: inactivo → ${row.etapa} @ ${row.backfillAt.toISOString()}`,
        );
        if (!dryRun) {
          await insertEtapaBackfill(prisma, {
            module: 'empresas',
            entityType: 'Empresa',
            entityId: row.companyId,
            entityName: company.name,
            oldEtapa: 'inactivo',
            newEtapa: row.etapa,
            at: row.backfillAt,
          });
        }
      } else {
        console.log('   empresa: ya tiene audit de etapa — omitido');
      }

      const contacts = await prisma.companyContact.findMany({
        where: { companyId: row.companyId },
        include: { contact: { select: { id: true, name: true, etapa: true } } },
      });
      for (const link of contacts) {
        const c = link.contact;
        const hasContactAudit = await prisma.auditChangeSet.findFirst({
          where: {
            entityId: c.id,
            module: 'contactos',
            entries: { some: { fieldKey: 'etapa' } },
          },
          select: { id: true },
        });
        if (hasContactAudit) continue;
        const oldEtapa = row.fixEtapa ? 'inactivo' : c.etapa === row.etapa ? 'inactivo' : c.etapa;
        if (oldEtapa === row.etapa) continue;
        console.log(
          `   backfill contacto ${c.name}: ${oldEtapa} → ${row.etapa}`,
        );
        if (!dryRun) {
          if (c.etapa !== row.etapa) {
            await prisma.contact.update({
              where: { id: c.id },
              data: { etapa: row.etapa },
            });
          }
          await insertEtapaBackfill(prisma, {
            module: 'contactos',
            entityType: 'Contacto',
            entityId: c.id,
            entityName: c.name,
            oldEtapa,
            newEtapa: row.etapa,
            at: row.backfillAt,
          });
        }
      }
    }
  };

  if (dryRun) {
    await run();
    console.log('\n✅ Dry run completado. Ejecuta sin DRY_RUN para aplicar.\n');
  } else {
    await prisma.$transaction(
      async () => {
        await run();
      },
      { maxWait: 60_000, timeout: 120_000 },
    );
    console.log('\n✅ Reparación aplicada.\n');
  }

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
