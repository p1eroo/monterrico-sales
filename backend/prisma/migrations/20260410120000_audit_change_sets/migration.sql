-- CreateTable
CREATE TABLE "AuditChangeSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditChangeSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditChangeEntry" (
    "id" TEXT NOT NULL,
    "changeSetId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "oldValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,

    CONSTRAINT "AuditChangeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditChangeSet_userId_idx" ON "AuditChangeSet"("userId");

-- CreateIndex
CREATE INDEX "AuditChangeSet_entityType_entityId_idx" ON "AuditChangeSet"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditChangeSet_module_createdAt_idx" ON "AuditChangeSet"("module", "createdAt");

-- CreateIndex
CREATE INDEX "AuditChangeSet_createdAt_idx" ON "AuditChangeSet"("createdAt");

-- CreateIndex
CREATE INDEX "AuditChangeEntry_changeSetId_idx" ON "AuditChangeEntry"("changeSetId");

-- AddForeignKey
ALTER TABLE "AuditChangeSet" ADD CONSTRAINT "AuditChangeSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditChangeEntry" ADD CONSTRAINT "AuditChangeEntry_changeSetId_fkey" FOREIGN KEY ("changeSetId") REFERENCES "AuditChangeSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
