-- CreateTable
CREATE TABLE "AiKnowledgeBase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'documentos',
    "sourceMode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "chunkSize" INTEGER NOT NULL DEFAULT 400,
    "overlap" INTEGER NOT NULL DEFAULT 64,
    "linkedAgentId" TEXT,
    "linkedAgentName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "sourceJson" JSONB,
    "indexError" TEXT,
    "indexedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiKnowledgeChunk" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiKnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiKnowledgeBase_userId_idx" ON "AiKnowledgeBase"("userId");

-- CreateIndex
CREATE INDEX "AiKnowledgeBase_userId_updatedAt_idx" ON "AiKnowledgeBase"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AiKnowledgeChunk_knowledgeBaseId_position_idx" ON "AiKnowledgeChunk"("knowledgeBaseId", "position");

-- AddForeignKey
ALTER TABLE "AiKnowledgeBase" ADD CONSTRAINT "AiKnowledgeBase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeChunk" ADD CONSTRAINT "AiKnowledgeChunk_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "AiKnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
