/**
 * One-shot: migra la fuente de prospectos que vino de la web.
 * Antes el webhook guardaba redSocial='Web'; ahora usa 'Marketing'.
 * Actualiza los registros existentes.
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/backfill-flota-red-social-web.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const prisma = app.get(PrismaService);

    const where = {
      redSocial: { equals: 'Web', mode: 'insensitive' as const },
    };

    const count = await prisma.flotaProspecto.count({ where });
    console.log(`Prospectos con redSocial 'Web': ${count}`);

    if (count === 0) {
      console.log('Nada que actualizar.');
      return;
    }

    const result = await prisma.flotaProspecto.updateMany({
      where,
      data: { redSocial: 'Marketing' },
    });
    console.log(`Actualizados a 'Marketing': ${result.count}`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
