-- CreateTable
CREATE TABLE "CrmFile" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "relatedEntityName" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmFile_storageKey_key" ON "CrmFile"("storageKey");

-- CreateIndex
CREATE INDEX "CrmFile_entityType_entityId_idx" ON "CrmFile"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "CrmFile_uploadedBy_idx" ON "CrmFile"("uploadedBy");

-- CreateIndex
CREATE INDEX "CrmFile_createdAt_idx" ON "CrmFile"("createdAt");

-- AddForeignKey
ALTER TABLE "CrmFile" ADD CONSTRAINT "CrmFile_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
