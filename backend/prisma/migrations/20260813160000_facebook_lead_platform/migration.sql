-- AlterTable
ALTER TABLE "FacebookLead" ADD COLUMN "platform" TEXT;
ALTER TABLE "FacebookLead" ADD COLUMN "isOrganic" BOOLEAN;

-- CreateIndex
CREATE INDEX "FacebookLead_platform_idx" ON "FacebookLead"("platform");
