-- DropUnique: un usuario puede tener varios hilos de chat
ALTER TABLE "AiConversation" DROP CONSTRAINT IF EXISTS "AiConversation_userId_key";
DROP INDEX IF EXISTS "AiConversation_userId_key";

-- Título para lista lateral
ALTER TABLE "AiConversation" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT 'Nuevo chat';

CREATE INDEX IF NOT EXISTS "AiConversation_userId_updatedAt_idx" ON "AiConversation"("userId", "updatedAt");
