-- CreateTable
CREATE TABLE "WhatsappInstance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "instanceApiKey" TEXT NOT NULL,
    "evoInstanceId" TEXT,
    "displayLineId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "qrCode" TEXT,
    "qrText" TEXT,
    "pairingCode" TEXT,
    "qrGeneratedAt" TIMESTAMP(3),
    "qrExpiresAt" TIMESTAMP(3),
    "lastConnectedAt" TIMESTAMP(3),
    "lastDisconnectedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappInstance_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CrmWhatsappMessage"
ADD COLUMN "whatsappInstanceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappInstance_userId_key" ON "WhatsappInstance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappInstance_instanceName_key" ON "WhatsappInstance"("instanceName");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappInstance_evoInstanceId_key" ON "WhatsappInstance"("evoInstanceId");

-- CreateIndex
CREATE INDEX "WhatsappInstance_status_idx" ON "WhatsappInstance"("status");

-- CreateIndex
CREATE INDEX "CrmWhatsappMessage_whatsappInstanceId_createdAt_idx" ON "CrmWhatsappMessage"("whatsappInstanceId", "createdAt");

-- AddForeignKey
ALTER TABLE "WhatsappInstance" ADD CONSTRAINT "WhatsappInstance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmWhatsappMessage" ADD CONSTRAINT "CrmWhatsappMessage_whatsappInstanceId_fkey" FOREIGN KEY ("whatsappInstanceId") REFERENCES "WhatsappInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
