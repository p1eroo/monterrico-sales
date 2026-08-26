/**
 * One-shot: pasa a estado Afiliado a los prospectos cuyo celular coincide con
 * un conductor registrado (API externa de conductores).
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/backfill-flota-afiliados.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { FlotaConductorMatchService } from '../src/flota-prospectos/flota-conductor-match.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const service = app.get(FlotaConductorMatchService);
    console.log('Backfill afiliación por match con conductores…');
    const result = await service.backfillAfiliados();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
