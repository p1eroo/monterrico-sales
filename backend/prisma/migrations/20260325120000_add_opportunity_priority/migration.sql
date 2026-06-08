-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'media';
