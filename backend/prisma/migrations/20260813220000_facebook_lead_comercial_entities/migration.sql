-- AlterTable
ALTER TABLE "FacebookLead" ADD COLUMN "importedAsCompanyId" TEXT;
ALTER TABLE "FacebookLead" ADD COLUMN "importedAsOpportunityId" TEXT;

-- CreateIndex
CREATE INDEX "FacebookLead_importedAsCompanyId_idx" ON "FacebookLead"("importedAsCompanyId");
CREATE INDEX "FacebookLead_importedAsOpportunityId_idx" ON "FacebookLead"("importedAsOpportunityId");
