/**
 * Reconcilia flota_prospecto.operador con el assignee actual en Chatwoot.
 * Cubre asignaciones hechas por Soporte u otros agentes directamente en Chatwoot.
 *
 * Uso (desde backend/):
 *   npm run scripts:backfill-operador-from-chatwoot
 *   DRY_RUN=true npm run scripts:backfill-operador-from-chatwoot
 *   MAX_CONVERSATIONS=500 npm run scripts:backfill-operador-from-chatwoot
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ChatwootOperadorSyncService } from '../src/chatwoot/chatwoot-operador-sync.service';

async function main() {
  const dryRun = process.env.DRY_RUN?.trim() === 'true';
  const maxConversations = process.env.MAX_CONVERSATIONS
    ? parseInt(process.env.MAX_CONVERSATIONS, 10)
    : 10_000;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const operadorSync = app.get(ChatwootOperadorSyncService);

  console.log('\n=== Backfill operador ← Chatwoot ===\n');
  console.log(`Dry-run: ${dryRun}`);
  console.log(`Max conversaciones (fase 2): ${maxConversations}\n`);

  const stats = await operadorSync.reconcileOperadoresFromChatwoot({
    dryRun,
    maxConversations,
  });

  console.log('\n=== Resumen ===');
  console.log(`  Prospectos revisados (fase 1): ${stats.prospectsChecked}`);
  console.log(`  Conversaciones revisadas (fase 2): ${stats.conversationsChecked}`);
  console.log(`  Operadores actualizados: ${dryRun ? '(dry-run)' : stats.updated}`);
  console.log(`  Ya correctos: ${stats.alreadyOk}`);
  console.log(`  Sin prospecto CRM: ${stats.noProspecto}`);
  console.log(`  Sin assignee Chatwoot: ${stats.noAssignee}`);
  console.log(`  Assignee sin match operador: ${stats.noOperadorMatch}`);
  console.log(`  Errores: ${stats.errors}`);
  console.log('\n✔ Hecho.\n');

  await app.close();
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
