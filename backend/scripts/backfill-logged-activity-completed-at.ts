/**
 * Alinea completedAt de llamadas y reuniones completadas con la fecha/hora
 * de la actividad (cuándo ocurrió), no con el instante en que se registró.
 *
 * Uso (desde backend/):
 *   DRY_RUN=true npm run scripts:backfill-logged-activity-completed-at
 *   npm run scripts:backfill-logged-activity-completed-at
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { instantFromLimaDayAndTime } from '../src/common/crm-timezone.util';

const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const prisma = app.get(PrismaService);

  const rows = await prisma.activity.findMany({
    where: {
      type: { in: ['llamada', 'reunion'] },
      status: { in: ['completada', 'completado'] },
    },
    select: {
      id: true,
      title: true,
      type: true,
      dueDate: true,
      startDate: true,
      startTime: true,
      completedAt: true,
    },
  });

  const updates: { id: string; title: string; type: string; from: string; to: string }[] =
    [];

  for (const row of rows) {
    const next = instantFromLimaDayAndTime(
      row.startDate ?? row.dueDate,
      row.startTime,
    );
    if (row.completedAt && row.completedAt.getTime() === next.getTime()) {
      continue;
    }
    updates.push({
      id: row.id,
      title: row.title,
      type: row.type,
      from: row.completedAt?.toISOString() ?? 'null',
      to: next.toISOString(),
    });
    if (!DRY_RUN) {
      await prisma.activity.update({
        where: { id: row.id },
        data: { completedAt: next },
      });
    }
  }

  console.log(
    `${DRY_RUN ? '[dry-run] ' : ''}Llamadas/reuniones a alinear: ${updates.length} de ${rows.length}`,
  );
  for (const row of updates.slice(0, 40)) {
    console.log(
      `  · ${row.id} «${row.title}» (${row.type}): ${row.from} → ${row.to}`,
    );
  }
  if (updates.length > 40) {
    console.log(`  · … y ${updates.length - 40} más`);
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
