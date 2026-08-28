-- AlterTable
ALTER TABLE "WhatsAppBulkCampaign" ADD COLUMN "scheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "WhatsAppBulkCampaign_status_scheduledAt_idx" ON "WhatsAppBulkCampaign"("status", "scheduledAt");
