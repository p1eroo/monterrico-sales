/**
 * One-shot: backfill FlotaOperadorStatsDaily from ActivityLog (asignados)
 * + live metrics for other fields.
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/backfill-flota-operador-stats.ts [fecini] [fecfin]
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { FlotaProspectosService } from '../src/flota-prospectos/flota-prospectos.service';

async function main() {
  const fecini = process.argv[2] || '2026-06-29';
  const fecfin = process.argv[3] || '2026-07-05';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const service = app.get(FlotaProspectosService);
    console.log(`Backfill operador-stats from ActivityLog: ${fecini} → ${fecfin}`);
    const result = await service.backfillOperadorStatsFromActivityLog(fecini, fecfin);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
