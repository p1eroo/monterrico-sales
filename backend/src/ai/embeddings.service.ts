import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSION = 1536;
/** Caracteres por fragmento enviados al modelo de embeddings (límite ~8k tokens). */
const MAX_CHARS_PER_CHUNK = 28_000;
const BATCH_SIZE = 64;

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  isEnabled(): boolean {
    return !!this.config.get<string>('OPENAI_API_KEY')?.trim();
  }

  private getModel(): string {
    return (
      this.config.get<string>('OPENAI_EMBEDDING_MODEL')?.trim() ||
      DEFAULT_MODEL
    );
  }

  getExpectedDimensions(): number {
    const raw = this.config.get<string>('OPENAI_EMBEDDING_DIMENSION');
    const n = raw ? Number.parseInt(raw, 10) : DEFAULT_DIMENSION;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_DIMENSION;
  }

  private truncateForEmbed(text: string): string {
    const t = text.trim();
    if (t.length <= MAX_CHARS_PER_CHUNK) return t;
    return t.slice(0, MAX_CHARS_PER_CHUNK);
  }

  /**
   * Una llamada por lote a OpenAI. Devuelve vectores en el mismo orden que inputs.
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY no configurada');
    }
    if (texts.length === 0) return [];

    const expectedDim = this.getExpectedDimensions();
    const model = this.getModel();
    const out: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE).map((t) => this.truncateForEmbed(t));
      const res = await fetch(OPENAI_EMBEDDINGS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: batch,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        this.logger.warn({
          event: 'ai.openai.embeddings_http_error',
          status: res.status,
          body: errText.slice(0, 500),
        });
        throw new Error(`Embeddings HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const json = (await res.json()) as {
        data?: Array<{ embedding: number[]; index: number }>;
      };
      const rows = json.data ?? [];
      rows.sort((a, b) => a.index - b.index);
      for (const row of rows) {
        if (!row.embedding?.length) {
          throw new Error('Respuesta de embeddings sin vector');
        }
        if (row.embedding.length !== expectedDim) {
          this.logger.warn(
            `Dimensión embedding ${row.embedding.length} ≠ OPENAI_EMBEDDING_DIMENSION (${expectedDim}); ajusta migración o variable de entorno.`,
          );
        }
        out.push(row.embedding);
      }
      if (out.length !== i + batch.length) {
        throw new Error('Embeddings: recuento de vectores no coincide con el lote');
      }
    }

    return out;
  }

  /** Literal `vector` para PostgreSQL: `'[a,b,...]'::vector` */
  toPgVectorLiteral(embedding: number[]): string {
    const expectedDim = this.getExpectedDimensions();
    const vec = embedding.slice(0, expectedDim);
    while (vec.length < expectedDim) vec.push(0);
    return `[${vec.join(',')}]`;
  }

  async updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
    const expectedDim = this.getExpectedDimensions();
    if (embedding.length !== expectedDim) {
      this.logger.warn(
        `Chunk ${chunkId}: vector ${embedding.length}d, esperado ${expectedDim}; se trunca o rellena con ceros.`,
      );
    }
    const literal = this.toPgVectorLiteral(embedding);
    await this.prisma.$executeRawUnsafe(
      `UPDATE "AiKnowledgeChunk" SET embedding = $1::vector WHERE id = $2`,
      literal,
      chunkId,
    );
  }

  /**
   * Tras crear fragmentos en BD: genera embeddings y persiste (fallos solo se registran en log).
   */
  async persistEmbeddingsForNewChunks(
    items: { id: string; content: string }[],
  ): Promise<void> {
    if (!this.isEnabled() || items.length === 0) return;

    try {
      const vectors = await this.embedTexts(items.map((x) => x.content));
      for (let i = 0; i < items.length; i++) {
        await this.updateChunkEmbedding(items[i].id, vectors[i]);
      }
      this.logger.log({
        event: 'ai.knowledge.embeddings_ok',
        chunkCount: items.length,
      });
    } catch (e) {
      this.logger.warn({
        event: 'ai.knowledge.embeddings_failed',
        message: e instanceof Error ? e.message : String(e),
        chunkCount: items.length,
      });
    }
  }

  /**
   * Rellena embeddings en chunks existentes con `embedding IS NULL`.
   * Solo bases con estado `indexado`. Ejecutar: `npm run kb:backfill-embeddings` en el servidor.
   */
  async backfillMissingChunkEmbeddings(options?: {
    /** Filas traídas por query (default 120) */
    fetchLimit?: number;
    /** Pausa entre lotes completados (rate limits OpenAI) */
    delayMsBetweenBatches?: number;
    /** Máximo de chunks a actualizar en esta ejecución (omitir = sin techo) */
    maxTotal?: number;
  }): Promise<{
    updated: number;
    batches: number;
    stoppedEarly: boolean;
    remainingNullApprox: number;
  }> {
    if (!this.isEnabled()) {
      throw new Error(
        'OPENAI_API_KEY no configurada; no se pueden generar embeddings.',
      );
    }

    const fetchLimit = Math.min(
      500,
      Math.max(10, options?.fetchLimit ?? 120),
    );
    const delayMs = Math.max(0, options?.delayMsBetweenBatches ?? 0);
    const maxTotal = options?.maxTotal;

    let updated = 0;
    let batches = 0;
    let stoppedEarly = false;

    const sleep = (ms: number) =>
      new Promise<void>((r) => {
        setTimeout(r, ms);
      });

    while (true) {
      if (maxTotal !== undefined && updated >= maxTotal) {
        stoppedEarly = true;
        break;
      }

      const cap =
        maxTotal !== undefined
          ? Math.min(fetchLimit, maxTotal - updated)
          : fetchLimit;

      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ id: string; content: string }>
      >(
        `SELECT c.id, c.content
         FROM "AiKnowledgeChunk" c
         INNER JOIN "AiKnowledgeBase" kb ON kb.id = c."knowledgeBaseId"
         WHERE c.embedding IS NULL AND kb.status = $1
         ORDER BY c.id ASC
         LIMIT $2`,
        'indexado',
        cap,
      );

      const usable = rows.filter((r) => r.content?.trim().length > 0);
      if (usable.length === 0) {
        break;
      }

      batches += 1;
      try {
        const vectors = await this.embedTexts(usable.map((r) => r.content));
        for (let i = 0; i < usable.length; i++) {
          await this.updateChunkEmbedding(usable[i].id, vectors[i]);
        }
        updated += usable.length;
        this.logger.log({
          event: 'ai.knowledge.backfill_batch_ok',
          batch: batches,
          chunkCount: usable.length,
          updatedTotal: updated,
        });
      } catch (e) {
        this.logger.error({
          event: 'ai.knowledge.backfill_batch_failed',
          batch: batches,
          message: e instanceof Error ? e.message : String(e),
        });
        stoppedEarly = true;
        break;
      }

      if (delayMs > 0) {
        await sleep(delayMs);
      }

      if (rows.length < cap) {
        break;
      }
    }

    const remainingRow = await this.prisma.$queryRawUnsafe<
      Array<{ n: bigint }>
    >(
      `SELECT COUNT(*)::bigint AS n
       FROM "AiKnowledgeChunk" c
       INNER JOIN "AiKnowledgeBase" kb ON kb.id = c."knowledgeBaseId"
       WHERE c.embedding IS NULL AND kb.status = $1`,
      'indexado',
    );
    const remainingNullApprox = Number(remainingRow[0]?.n ?? 0n);

    return {
      updated,
      batches,
      stoppedEarly,
      remainingNullApprox,
    };
  }
}
