-- CreateTable
CREATE TABLE "ResendInboundEmail" (
    "id" TEXT NOT NULL,
    "resendEmailId" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "toEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ccEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT NOT NULL DEFAULT '',
    "html" TEXT,
    "text" TEXT,
    "messageId" TEXT,
    "attachmentsJson" JSONB NOT NULL DEFAULT '[]',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResendInboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResendInboundEmail_resendEmailId_key" ON "ResendInboundEmail"("resendEmailId");

-- CreateIndex
CREATE INDEX "ResendInboundEmail_receivedAt_idx" ON "ResendInboundEmail"("receivedAt");
