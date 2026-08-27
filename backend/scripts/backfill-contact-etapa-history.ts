/**
 * One-shot: reconstruye `etapaHistory` de los contactos a partir de la
 * auditoría (AuditChangeSet/Entry, fieldKey='etapa'), para que el historial
 * de etapas quede completo retroactivamente (los cambios manuales de etapa
 * antes no se registraban en el historial).
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/backfill-contact-etapa-history.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Prisma } from '../src/generated/prisma';

type EtapaChange = { fecha: Date; oldValue: string; newValue: string };

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const prisma = app.get(PrismaService);

    const changeSets = await prisma.auditChangeSet.findMany({
      where: {
        entityType: 'Contacto',
        entries: { some: { fieldKey: 'etapa' } },
      },
      select: {
        entityId: true,
        createdAt: true,
        entries: {
          where: { fieldKey: 'etapa' },
          select: { oldValue: true, newValue: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const byContact = new Map<string, EtapaChange[]>();
    for (const cs of changeSets) {
      if (!cs.entityId) continue;
      for (const e of cs.entries) {
        const list = byContact.get(cs.entityId) ?? [];
        list.push({
          fecha: cs.createdAt,
          oldValue: e.oldValue,
          newValue: e.newValue,
        });
        byContact.set(cs.entityId, list);
      }
    }

    if (byContact.size === 0) {
      console.log('No hay cambios de etapa auditados para contactos.');
      return;
    }

    const contacts = await prisma.contact.findMany({
      where: { id: { in: [...byContact.keys()] } },
      select: { id: true, etapa: true, createdAt: true, etapaHistory: true },
    });

    let updated = 0;
    let skipped = 0;

    for (const c of contacts) {
      const changes = (byContact.get(c.id) ?? []).sort(
        (a, b) => a.fecha.getTime() - b.fecha.getTime(),
      );
      if (changes.length === 0) continue;

      const history: { etapa: string; fecha: string }[] = [];
      const seen = new Set<string>();
      const push = (etapa: string, fecha: string) => {
        const e = etapa.trim();
        if (!e || !fecha) return;
        const key = `${e}|${fecha}`;
        if (seen.has(key)) return;
        seen.add(key);
        history.push({ etapa: e, fecha });
      };

      if (Array.isArray(c.etapaHistory)) {
        for (const h of c.etapaHistory as {
          etapa?: string;
          fecha?: string;
        }[]) {
          if (h?.etapa && h.fecha) push(h.etapa, h.fecha);
        }
      }

      // Sin historial previo: sembrar la etapa inicial desde el primer cambio.
      if (history.length === 0 && changes[0] && changes[0].oldValue) {
        push(changes[0].oldValue, dayKey(c.createdAt));
      }

      for (const ch of changes) {
        push(ch.newValue, dayKey(ch.fecha));
      }

      const prevJson = JSON.stringify(c.etapaHistory);
      const nextJson = JSON.stringify(history);
      if (prevJson === nextJson) {
        skipped += 1;
        continue;
      }

      await prisma.contact.update({
        where: { id: c.id },
        data: { etapaHistory: history as Prisma.InputJsonValue },
      });
      updated += 1;
    }

    console.log(`Contactos con historial reconstruido: ${updated}`);
    console.log(`Contactos sin cambios necesarios: ${skipped}`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
