-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "scheduledFor" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Campaign_status_scheduledFor_idx" ON "Campaign"("status", "scheduledFor");
