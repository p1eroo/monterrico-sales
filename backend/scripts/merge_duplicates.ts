/**
 * Merge de empresas duplicadas por RUC + contactos duplicados dentro de cada empresa.
 *
 * Estrategia:
 *   - Empresas: mismo RUC → conservar la más antigua, migrar relaciones y datos.
 *   - Contactos: mismo DNI (8 dígitos) o mismo nombre+teléfono dentro de una misma empresa.
 *
 * Uso (desde backend/, con .env cargado):
 *   DRY_RUN=true npm run scripts:merge-duplicates   → preview
 *   npm run scripts:merge-duplicates                 → ejecutar
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const DRY_RUN = process.env.DRY_RUN?.trim() === 'true';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const prisma = app.get(PrismaService);

  try {
    if (DRY_RUN) {
      console.log('\n🔍 MODO DRY-RUN: Solo preview, sin ejecutar cambios\n');
    }

    // ═══════════════════════════════════════
    // FASE 1: Merge empresas por RUC
    // ═══════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  FASE 1: EMPRESAS DUPLICADAS POR RUC');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const allCompanies = await prisma.company.findMany({
      where: { ruc: { not: null } },
      select: { id: true, name: true, ruc: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

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
      for (const [ruc, group] of dupRucs) {
        const principal = group[0];
        const duplicates = group.slice(1);

        console.log(`📌 RUC ${ruc}: ${principal.name} (${principal.id}) ← CONSERVAR`);
        for (const dup of duplicates) {
          console.log(`   → Mergeando: ${dup.name} (${dup.id})`);
          if (DRY_RUN) continue;

          await prisma.$transaction(async (tx) => {
            // 1. Migrar CompanyContact
            const ccToDelete = await tx.companyContact.findMany({
              where: { companyId: dup.id, contactId: { in: (await tx.companyContact.findMany({ where: { companyId: principal.id }, select: { contactId: true } })).map(x => x.contactId) } },
            });
            for (const cc of ccToDelete) {
              await tx.companyContact.delete({ where: { id: cc.id } });
            }
            await tx.companyContact.updateMany({
              where: { companyId: dup.id },
              data: { companyId: principal.id },
            });

            // 2. Migrar CompanyOpportunity
            const coToDelete = await tx.companyOpportunity.findMany({
              where: { companyId: dup.id, opportunityId: { in: (await tx.companyOpportunity.findMany({ where: { companyId: principal.id }, select: { opportunityId: true } })).map(x => x.opportunityId) } },
            });
            for (const co of coToDelete) {
              await tx.companyOpportunity.delete({ where: { id: co.id } });
            }
            await tx.companyOpportunity.updateMany({
              where: { companyId: dup.id },
              data: { companyId: principal.id },
            });

            // 3. Migrar CompanyActivity
            const caToDelete = await tx.companyActivity.findMany({
              where: { companyId: dup.id, activityId: { in: (await tx.companyActivity.findMany({ where: { companyId: principal.id }, select: { activityId: true } })).map(x => x.activityId) } },
            });
            for (const ca of caToDelete) {
              await tx.companyActivity.delete({ where: { id: ca.id } });
            }
            await tx.companyActivity.updateMany({
              where: { companyId: dup.id },
              data: { companyId: principal.id },
            });

            // 4. Migrar CompanyCompany (links a otras empresas)
            //    - companyId → principal
            const ccLinksFrom = await tx.companyCompany.findMany({
              where: { companyId: dup.id, linkedId: { not: principal.id } },
            });
            const ccLinkedFrom = new Set((await tx.companyCompany.findMany({ where: { companyId: principal.id }, select: { linkedId: true } })).map(x => x.linkedId));
            for (const link of ccLinksFrom) {
              if (ccLinkedFrom.has(link.linkedId)) {
                await tx.companyCompany.delete({ where: { id: link.id } });
              } else {
                await tx.companyCompany.update({ where: { id: link.id }, data: { companyId: principal.id } });
                ccLinkedFrom.add(link.linkedId);
              }
            }
            //    - linkedId → principal
            const ccLinksTo = await tx.companyCompany.findMany({
              where: { linkedId: dup.id, companyId: { not: principal.id } },
            });
            const ccLinkedTo = new Set((await tx.companyCompany.findMany({ where: { linkedId: principal.id }, select: { companyId: true } })).map(x => x.companyId));
            for (const link of ccLinksTo) {
              if (ccLinkedTo.has(link.companyId)) {
                await tx.companyCompany.delete({ where: { id: link.id } });
              } else {
                await tx.companyCompany.update({ where: { id: link.id }, data: { linkedId: principal.id } });
                ccLinkedTo.add(link.companyId);
              }
            }
            //    - self-link (principal↔dup)
            const selfLink1 = await tx.companyCompany.findUnique({ where: { companyId_linkedId: { companyId: principal.id, linkedId: dup.id } } });
            if (selfLink1) await tx.companyCompany.delete({ where: { id: selfLink1.id } });
            const selfLink2 = await tx.companyCompany.findUnique({ where: { companyId_linkedId: { companyId: dup.id, linkedId: principal.id } } });
            if (selfLink2) await tx.companyCompany.delete({ where: { id: selfLink2.id } });

            // 5. Migrar Client
            const dupClient = await tx.client.findUnique({ where: { companyId: dup.id } });
            if (dupClient) {
              const principalClient = await tx.client.findUnique({ where: { companyId: principal.id } });
              if (principalClient) {
                await tx.client.delete({ where: { id: dupClient.id } });
              } else {
                await tx.client.update({ where: { id: dupClient.id }, data: { companyId: principal.id } });
              }
            }

            // 6. Copiar campos no nulos de la duplicada a la principal
            const dupData = await tx.company.findUnique({ where: { id: dup.id } });
            const principalData = await tx.company.findUnique({ where: { id: principal.id } });
            if (dupData && principalData) {
              const fieldsToCopy: Array<keyof typeof principalData> = [
                'telefono', 'domain', 'rubro', 'tipo', 'linkedin',
                'correo', 'distrito', 'provincia', 'departamento',
                'direccion', 'fuente',
              ];
              const updates: Record<string, unknown> = {};
              for (const field of fieldsToCopy) {
                if (!principalData[field] && dupData[field]) {
                  updates[field] = dupData[field];
                }
              }
              if (Object.keys(updates).length > 0) {
                await tx.company.update({ where: { id: principal.id }, data: updates });
              }
            }

            // 7. Eliminar empresa duplicada
            await tx.company.delete({ where: { id: dup.id } });
          });

          console.log('     ✅ Mergeado');
        }
      }
    }

    // ═══════════════════════════════════════
    // FASE 2: Merge contactos duplicados
    // ═══════════════════════════════════════
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  FASE 2: CONTACTOS DUPLICADOS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const allCompanyContacts = await prisma.companyContact.findMany({
      include: {
        contact: { select: { id: true, name: true, telefono: true, createdAt: true } },
      },
      orderBy: [{ contact: { createdAt: 'asc' } }, { contactId: 'asc' }],
    });

    const contactsByCompany = new Map<string, typeof allCompanyContacts>();
    for (const cc of allCompanyContacts) {
      const list = contactsByCompany.get(cc.companyId) ?? [];
      list.push(cc);
      contactsByCompany.set(cc.companyId, list);
    }

    const contactGroupsToMerge: Array<{
      principalId: string;
      duplicateIds: string[];
      reason: string;
      companyId: string;
    }> = [];

    for (const [companyId, ccList] of contactsByCompany) {
      // --- Por nombre + teléfono ---
      const byNamePhone = new Map<string, typeof ccList>();
      for (const cc of ccList) {
        const key = `${cc.contact.name.trim().toLowerCase()}|${(cc.contact.telefono ?? '').trim()}`;
        if (!cc.contact.name.trim() || !cc.contact.telefono?.trim()) continue;
        const g = byNamePhone.get(key) ?? [];
        g.push(cc);
        byNamePhone.set(key, g);
      }
      for (const [, g] of byNamePhone) {
        if (g.length > 1) {
          contactGroupsToMerge.push({
            principalId: g[0].contactId,
            duplicateIds: g.slice(1).map(x => x.contactId),
            reason: `mismo nombre+teléfono (${g[0].contact.name}, ${g[0].contact.telefono})`,
            companyId,
          });
        }
      }
    }

    if (contactGroupsToMerge.length === 0) {
      console.log('✅ No hay contactos duplicados para mergear.\n');
    } else {
      console.log(`📌 ${contactGroupsToMerge.length} grupo(s) de contactos duplicados:\n`);

      for (const g of contactGroupsToMerge) {
        console.log(`   Razón: ${g.reason}`);
        console.log(`   Empresa: ${g.companyId}`);
        console.log(`   Principal: ${g.principalId}`);
        console.log(`   Duplicados: ${g.duplicateIds.join(', ')}`);

        if (DRY_RUN) continue;

        await prisma.$transaction(async (tx) => {
          const principalId = g.principalId;

          for (const dupId of g.duplicateIds) {

            // a. Migrar CompanyContact (misma empresa, evitar unique conflict)
            const ccToDelete = await tx.companyContact.findFirst({
              where: { companyId: g.companyId, contactId: principalId },
            });
            if (ccToDelete) {
              await tx.companyContact.deleteMany({
                where: { companyId: g.companyId, contactId: dupId },
              });
            } else {
              await tx.companyContact.updateMany({
                where: { companyId: g.companyId, contactId: dupId },
                data: { contactId: principalId },
              });
            }

            // b. Migrar ContactOpportunity
            const coConflicts = await tx.contactOpportunity.findMany({
              where: { contactId: dupId, opportunityId: { in: (await tx.contactOpportunity.findMany({ where: { contactId: principalId }, select: { opportunityId: true } })).map(x => x.opportunityId) } },
            });
            for (const co of coConflicts) {
              await tx.contactOpportunity.delete({ where: { id: co.id } });
            }
            await tx.contactOpportunity.updateMany({
              where: { contactId: dupId },
              data: { contactId: principalId },
            });

            // c. Migrar ContactActivity
            const caConflicts = await tx.contactActivity.findMany({
              where: { contactId: dupId, activityId: { in: (await tx.contactActivity.findMany({ where: { contactId: principalId }, select: { activityId: true } })).map(x => x.activityId) } },
            });
            for (const ca of caConflicts) {
              await tx.contactActivity.delete({ where: { id: ca.id } });
            }
            await tx.contactActivity.updateMany({
              where: { contactId: dupId },
              data: { contactId: principalId },
            });

            // d. Migrar ContactContact (links a otros contactos)
            const fromLinks = await tx.contactContact.findMany({ where: { contactId: dupId } });
            const toLinks = await tx.contactContact.findMany({ where: { linkedId: dupId } });
            const principalFromSet = new Set((await tx.contactContact.findMany({ where: { contactId: principalId } })).map(x => x.linkedId));
            const principalToSet = new Set((await tx.contactContact.findMany({ where: { linkedId: principalId } })).map(x => x.contactId));

            for (const link of fromLinks) {
              if (principalFromSet.has(link.linkedId)) {
                await tx.contactContact.delete({ where: { id: link.id } });
              } else {
                await tx.contactContact.update({ where: { id: link.id }, data: { contactId: principalId } });
              }
            }
            for (const link of toLinks) {
              if (principalToSet.has(link.contactId)) {
                await tx.contactContact.delete({ where: { id: link.id } });
              } else {
                await tx.contactContact.update({ where: { id: link.id }, data: { linkedId: principalId } });
              }
            }

            // e. Migrar CrmWhatsappMessage
            await tx.crmWhatsappMessage.updateMany({
              where: { contactId: dupId },
              data: { contactId: principalId },
            });

            // f. Copiar campos no nulos del contacto duplicado al principal
            const dupContact = await tx.contact.findUnique({ where: { id: dupId } });
            const principalContact = await tx.contact.findUnique({ where: { id: principalId } });
            if (dupContact && principalContact) {
              const fieldsToCopy: Array<keyof typeof principalContact> = [
                'cargo', 'telefono', 'correo', 'departamento',
                'provincia', 'distrito', 'direccion',
              ];
              const updates: Record<string, unknown> = {};
              for (const field of fieldsToCopy) {
                if (!principalContact[field] && dupContact[field]) {
                  updates[field] = dupContact[field];
                }
              }
              if (Object.keys(updates).length > 0) {
                await tx.contact.update({ where: { id: principalId }, data: updates });
              }
            }

            // g. Eliminar contacto duplicado
            await tx.contact.delete({ where: { id: dupId } });
          }
        });

        console.log('     ✅ Mergeado');
      }
    }

    // ═══════════════════════════════════════
    // RESUMEN
    // ═══════════════════════════════════════
    if (!DRY_RUN) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('  COMPLETADO');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log(`   Empresas mergeadas: ${dupRucs.reduce((a, [, g]) => a + g.length - 1, 0)}`);
      console.log(`   Contactos mergeados: ${contactGroupsToMerge.reduce((a, g) => a + g.duplicateIds.length, 0)}`);

      // Verificar que no queden duplicados
      const remaining = await prisma.company.findMany({
        where: { ruc: { not: null } },
        select: { id: true, name: true, ruc: true },
      });
      const rucCheck = new Map<string, number>();
      for (const c of remaining) {
        const d = (c.ruc ?? '').replace(/\D/g, '');
        if (d) rucCheck.set(d, (rucCheck.get(d) ?? 0) + 1);
      }
      const stillDup = [...rucCheck.entries()].filter(([, c]) => c > 1);
      if (stillDup.length > 0) {
        console.log(`\n⚠️  Quedan ${stillDup.length} RUC con duplicados (verificar manualmente):`);
        for (const [ruc, count] of stillDup) {
          console.log(`     ${ruc}: ${count} empresa(s)`);
        }
      } else {
        console.log('✅ No quedan empresas duplicadas.');
      }

      console.log('\n▶ Ejecutar ahora la migración para agregar @unique en RUC:');
      console.log('   npx prisma migrate dev --name add_company_ruc_unique\n');
    }
  } finally {
    await app.close();
  }
}

main();
