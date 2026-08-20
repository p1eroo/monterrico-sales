-- AlterTable
ALTER TABLE "CampaignResendMessage" ADD COLUMN "subject" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CampaignResendMessage" ADD COLUMN "html" TEXT;
ALTER TABLE "CampaignResendMessage" ADD COLUMN "fromEmail" TEXT NOT NULL DEFAULT '';
