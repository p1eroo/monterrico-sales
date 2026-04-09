-- Requiere extensión pgvector en la BD (CREATE EXTENSION vector; una vez por base de datos).
-- Dimensión 1536 alineada con text-embedding-3-small / text-embedding-ada-002 por defecto.

ALTER TABLE "AiKnowledgeChunk" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

CREATE INDEX IF NOT EXISTS "AiKnowledgeChunk_embedding_hnsw_idx"
ON "AiKnowledgeChunk"
USING hnsw ("embedding" vector_cosine_ops)
WHERE ("embedding" IS NOT NULL);
