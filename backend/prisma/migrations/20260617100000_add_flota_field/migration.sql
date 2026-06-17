-- AlterTable: add importedAsFlotaProspectoId column
ALTER TABLE "FacebookLead" ADD COLUMN "importedAsFlotaProspectoId" TEXT;
CREATE INDEX "FacebookLead_importedAsFlotaProspectoId_idx" ON "FacebookLead"("importedAsFlotaProspectoId");
