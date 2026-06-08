/**
 * Vincula todos los contactos de cada empresa a su oportunidad.
 *
 * Uso (desde backend/, con .env cargado):
 *   npm run scripts:link-contacts-opp
 *
 * Modo dry-run (preview sin ejecutar):
 *   DRY_RUN=true npm run scripts:link-contacts-opp
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const prisma = app.get(PrismaService);
  const dryRun = process.env.DRY_RUN?.trim() === 'true';

  if (dryRun) {
    console.log('\n🔍 MODO DRY-RUN: Solo preview, sin ejecutar cambios\n');
  }

  try {
    console.log('📥 Cargando datos...');

    const [companyOpportunities, existingLinks] = await Promise.all([
      prisma.companyOpportunity.findMany({
        include: {
          opportunity: true,
          company: {
            include: {
              contacts: {
                include: {
                  contact: true,
                },
              },
            },
          },
        },
      }),
      prisma.contactOpportunity.findMany({
        select: { contactId: true, opportunityId: true },
      }),
    ]);

    const linkSet = new Set(
      existingLinks.map((l) => `${l.contactId}|${l.opportunityId}`)
    );

    console.log(`   ✓ ${companyOpportunities.length} oportunidades de empresa`);
    console.log(`   ✓ ${existingLinks.length} vínculos existentes`);

    const toCreate: Array<{ contactId: string; contactName: string; opportunityId: string; oppTitle: string; companyName: string }> = [];

    for (const co of companyOpportunities) {
      const companyName = co.company.name;
      const oppTitle = co.opportunity.title;

      if (co.company.contacts.length === 0) continue;

      for (const cc of co.company.contacts) {
        const key = `${cc.contactId}|${co.opportunityId}`;
        if (!linkSet.has(key)) {
          toCreate.push({
            contactId: cc.contactId,
            contactName: cc.contact.name,
            opportunityId: co.opportunityId,
            oppTitle,
            companyName,
          });
        }
      }
    }

    if (toCreate.length === 0) {
      console.log('\n✅ Ya están todos los contactos vinculados');
      return;
    }

    console.log(`\n🔗 ${toCreate.length} vínculos por crear`);

    if (dryRun) {
      const byCompany = new Map<string, string[]>();
      for (const t of toCreate) {
        const key = `${t.companyName}|${t.oppTitle}`;
        const list = byCompany.get(key) || [];
        list.push(t.contactName);
        byCompany.set(key, list);
      }
      for (const [company, contacts] of byCompany) {
        console.log(`  • ${company}: ${contacts.join(', ')}`);
      }
      console.log('\nEjecutar sin DRY_RUN para aplicar.');
    } else {
      let created = 0;
      for (const t of toCreate) {
        await prisma.contactOpportunity.create({
          data: { contactId: t.contactId, opportunityId: t.opportunityId },
        });
        created++;
        if (created % 50 === 0) {
          console.log(`   Progresando... ${created}/${toCreate.length}`);
        }
      }
      console.log(`\n✅ ${created} contactos vinculados`);
    }
  } finally {
    await app.close();
  }
}

main();