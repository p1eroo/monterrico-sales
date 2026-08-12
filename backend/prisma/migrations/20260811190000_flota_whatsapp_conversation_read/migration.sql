-- CreateTable
CREATE TABLE "FlotaWhatsappConversationRead" (
    "id" TEXT NOT NULL,
    "evoInstanceName" TEXT NOT NULL,
    "phoneDigits" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlotaWhatsappConversationRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlotaWhatsappConversationRead_evoInstanceName_phoneDigits_idx" ON "FlotaWhatsappConversationRead"("evoInstanceName", "phoneDigits");

-- CreateIndex
CREATE UNIQUE INDEX "FlotaWhatsappConversationRead_evoInstanceName_phoneDigits_key" ON "FlotaWhatsappConversationRead"("evoInstanceName", "phoneDigits");
