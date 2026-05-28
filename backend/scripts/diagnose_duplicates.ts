/**
 * Diagnóstico de empresas duplicadas por RUC + contactos duplicados.
 *
 * Uso (desde backend/, con .env cargado):
 *   npm run scripts:diagnose-duplicates
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const prisma = app.get(PrismaService);

  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  DIAGNÓSTICO DE DUPLICADOS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const allCompanies = await prisma.company.findMany({
      where: { ruc: { not: null } },
      select: {
        id: true, name: true, razonSocial: true, ruc: true,
        telefono: true, correo: true, domain: true,
        rubro: true, tipo: true, departamento: true,
        provincia: true, distrito: true, direccion: true,
        fuente: true, etapa: true, facturacionEstimada: true,
        assignedTo: true, createdAt: true,
      },
      orderBy: { id: 'asc' },
    });

    // --- Empresas duplicadas por RUC ---
    const rucMap = new Map<string, typeof allCompanies>();
    for (const c of allCompanies) {
      const digits = (c.ruc ?? '').replace(/\D/g, '');
      if (!digits) continue;
      const group = rucMap.get(digits) ?? [];
      group.push(c);
      rucMap.set(digits, group);
    }

    const dupRucs = [...rucMap.entries()].filter(([, g]) => g.length > 1);

    if (dupRucs.length === 0) {
      console.log('✅ No hay empresas duplicadas por RUC.\n');
    } else {
      console.log(`🔴 ${dupRucs.length} RUC(s) con empresas duplicadas:\n`);

      for (const [ruc, group] of dupRucs) {
        console.log(`  RUC: ${ruc}`);
        for (let i = 0; i < group.length; i++) {
          const c = group[i];
          const role = i === 0 ? '← CONSERVAR (más antigua)' : '  → MERGEAR';
          console.log(`    ${role}`);
          console.log(`       ID: ${c.id}`);
          console.log(`       Nombre: ${c.name}`);
          console.log(`       R.Social: ${c.razonSocial ?? '—'}`);
          console.log(`       RUC (raw): ${c.ruc}`);
          console.log(`       Teléfono: ${c.telefono ?? '—'}`);
          console.log(`       Correo: ${c.correo ?? '—'}`);
          console.log(`       Domain: ${c.domain ?? '—'}`);
          console.log(`       Rubro: ${c.rubro ?? '—'}`);
          console.log(`       Tipo: ${c.tipo ?? '—'}`);
          console.log(`       Dpto/Prov/Dist: ${c.departamento ?? '—'}/${c.provincia ?? '—'}/${c.distrito ?? '—'}`);
          console.log(`       Dirección: ${c.direccion ?? '—'}`);
          console.log(`       Fuente: ${c.fuente ?? '—'}`);
          console.log(`       Etapa: ${c.etapa}`);
          console.log(`       Facturación: ${c.facturacionEstimada}`);
          console.log(`       Creada: ${c.createdAt.toISOString().split('T')[0]}`);

          const contactCount = await prisma.companyContact.count({ where: { companyId: c.id } });
          const oppCount = await prisma.companyOpportunity.count({ where: { companyId: c.id } });
          const activityCount = await prisma.companyActivity.count({ where: { companyId: c.id } });
          const hasClient = await prisma.client.findUnique({ where: { companyId: c.id } });

          console.log(`       Contactos vinculados: ${contactCount}`);
          console.log(`       Oportunidades vinculadas: ${oppCount}`);
          console.log(`       Actividades vinculadas: ${activityCount}`);
          console.log(`       Client record: ${hasClient ? 'SÍ' : 'No'}`);
          console.log();
        }
      }
    }

    // --- Contactos duplicados dentro de cada empresa ---
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  CONTACTOS DUPLICADOS (misma empresa)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const allCC = await prisma.companyContact.findMany({
      include: {
        contact: {
          select: { id: true, name: true, telefono: true, correo: true, cargo: true, createdAt: true },
        },
        company: { select: { id: true, name: true } },
      },
      orderBy: { contactId: 'asc' },
    });

    const byCompany = new Map<string, typeof allCC>();
    for (const cc of allCC) {
      const list = byCompany.get(cc.companyId) ?? [];
      list.push(cc);
      byCompany.set(cc.companyId, list);
    }

    let totalDupContacts = 0;

    for (const [companyId, list] of byCompany) {
      const companyName = list[0]?.company.name ?? companyId;
      const dupByName = new Map<string, typeof list>();

      for (const cc of list) {
        const c = cc.contact;
        const nameKey = `${c.name.trim().toLowerCase()}|${(c.telefono ?? '').trim()}`;
        if (c.name.trim() && c.telefono?.trim()) {
          const g = dupByName.get(nameKey) ?? [];
          g.push(cc);
          dupByName.set(nameKey, g);
        }
      }

      const realDupByName = [...dupByName.entries()].filter(([, g]) => g.length > 1);

      if (realDupByName.length > 0) {
        console.log(`\n  Empresa: ${companyName} (${companyId})`);

        for (const [key, g] of realDupByName) {
          console.log(`    Mismo nombre+teléfono (${g[0].contact.name} / ${g[0].contact.telefono}):`);
          for (let i = 0; i < g.length; i++) {
            const role = i === 0 ? '← CONSERVAR' : '→ MERGEAR';
            console.log(`      ${role} ${g[i].contact.name} (id: ${g[i].contact.id})`);
            console.log(`         Tel: ${g[i].contact.telefono}, Correo: ${g[i].contact.correo ?? '—'}, Cargo: ${g[i].contact.cargo ?? '—'}`);
          }
          totalDupContacts += g.length - 1;
        }
      }
    }

    if (totalDupContacts === 0) {
      console.log('✅ No hay contactos duplicados dentro de cada empresa.\n');
    } else {
      console.log(`\n  Total contactos duplicados a mergear: ${totalDupContacts}\n`);
    }
  } finally {
    await app.close();
  }
}

main();
