ALTER TABLE "FlotaProspecto" ADD COLUMN IF NOT EXISTS "whatsappPushName" TEXT;
ALTER TABLE "FlotaProspecto" ADD COLUMN IF NOT EXISTS "whatsappNamePushed" TEXT;
ALTER TABLE "FlotaProspecto" ADD COLUMN IF NOT EXISTS "whatsappNamePushedAt" TIMESTAMP(3);
