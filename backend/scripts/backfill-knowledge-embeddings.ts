/**
 * Rellena columnas embedding (pgvector) en chunks existentes sin vector.
 *
 * Uso (desde backend/, con .env cargado):
 *   npm run kb:backfill-embeddings
 *
 * Variables opcionales:
 *   KB_BACKFILL_MAX        máximo de chunks a procesar (por ejecución)
 *   KB_BACKFILL_FETCH      tamaño de página SQL (10–500, default 120)
 *   KB_BACKFILL_DELAY_MS   pausa en ms entre lotes (rate limits)
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EmbeddingsService } from '../src/ai/embeddings.service';

function envInt(name: string): number | undefined {
  const v = process.env[name]?.trim();
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const embeddings = app.get(EmbeddingsService);
    if (!embeddings.isEnabled()) {
      console.error(
        'Abortado: falta OPENAI_API_KEY (misma variable que el chat).',
      );
      process.exitCode = 1;
      return;
    }

    const result = await embeddings.backfillMissingChunkEmbeddings({
      maxTotal: envInt('KB_BACKFILL_MAX'),
      fetchLimit: envInt('KB_BACKFILL_FETCH'),
      delayMsBetweenBatches: envInt('KB_BACKFILL_DELAY_MS'),
    });

    console.log(
      JSON.stringify(
        {
          ...result,
          hint:
            result.remainingNullApprox > 0
              ? 'Quedan chunks sin vector: vuelve a ejecutar o sube el KB_BACKFILL_MAX.'
              : 'Ningún chunk indexado pendiente de embedding.',
        },
        null,
        2,
      ),
    );

    if (result.stoppedEarly && result.updated === 0) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

void main();
