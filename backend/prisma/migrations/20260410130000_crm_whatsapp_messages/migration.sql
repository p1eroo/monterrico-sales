-- CreateTable
CREATE TABLE "CrmWhatsappMessage" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "evoInstanceId" TEXT NOT NULL,
    "evoInstanceName" TEXT,
    "waMessageId" TEXT,
    "fromWaId" TEXT NOT NULL,
    "toWaId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payloadJson" JSONB,
    "contactId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmWhatsappMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmWhatsappMessage_contactId_createdAt_idx" ON "CrmWhatsappMessage"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "CrmWhatsappMessage_evoInstanceId_waMessageId_idx" ON "CrmWhatsappMessage"("evoInstanceId", "waMessageId");

-- AddForeignKey
ALTER TABLE "CrmWhatsappMessage" ADD CONSTRAINT "CrmWhatsappMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmWhatsappMessage" ADD CONSTRAINT "CrmWhatsappMessage_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
