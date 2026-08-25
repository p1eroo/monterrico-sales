-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "area" TEXT NOT NULL DEFAULT 'comercial';

-- CreateIndex
CREATE INDEX "Campaign_area_idx" ON "Campaign"("area");
