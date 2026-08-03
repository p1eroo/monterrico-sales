/**
 * Corrige completedAt mal parseado (YYYY-MM-DD → medianoche UTC).
 * Copia createdAt cuando completedAt quedó antes del instante real de creación.
 *
 * Uso (desde backend/):
 *   DRY_RUN=true npm run scripts:backfill-activity-completed-at
 *   npm run scripts:backfill-activity-completed-at
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const prisma = app.get(PrismaService);

  const candidates = await prisma.activity.findMany({
    where: {
      completedAt: { not: null },
      status: { in: ['completada', 'completado'] },
    },
    select: {
      id: true,
      title: true,
      type: true,
      completedAt: true,
      createdAt: true,
    },
  });

  const toFix = candidates.filter(
    (row) =>
      row.completedAt != null && row.completedAt.getTime() < row.createdAt.getTime(),
  );

  console.log(
    `Actividades completadas revisadas: ${candidates.length}; a corregir: ${toFix.length}`,
  );

  if (toFix.length === 0) {
    await app.close();
    return;
  }

  for (const row of toFix.slice(0, 10)) {
    console.log(
      `  · ${row.id} «${row.title}» (${row.type}): completedAt ${row.completedAt?.toISOString()} → ${row.createdAt.toISOString()}`,
    );
  }
  if (toFix.length > 10) {
    console.log(`  … y ${toFix.length - 10} más`);
  }

  if (DRY_RUN) {
    console.log('DRY_RUN=true — no se aplicaron cambios.');
    await app.close();
    return;
  }

  const result = await prisma.$executeRaw`
    UPDATE "Activity"
    SET "completedAt" = "createdAt", "updatedAt" = NOW()
    WHERE "completedAt" IS NOT NULL
      AND "status" IN ('completada', 'completado')
      AND "completedAt" < "createdAt"
  `;

  console.log(`Filas actualizadas: ${result}`);
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
