-- CreateTable
CREATE TABLE "CrmNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "important" BOOLEAN NOT NULL DEFAULT false,
    "notifType" TEXT NOT NULL DEFAULT 'info',
    "priority" TEXT NOT NULL DEFAULT 'media',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmNotification_userId_createdAt_idx" ON "CrmNotification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmNotification_userId_dedupeKey_key" ON "CrmNotification"("userId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "CrmNotification" ADD CONSTRAINT "CrmNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
