-- Mark Flota prospectos as "contactado" after successful Meta Cloud bulk sends.
ALTER TABLE "WhatsAppBulkRecipient" ADD COLUMN IF NOT EXISTS "flotaProspectoId" TEXT;
CREATE INDEX IF NOT EXISTS "WhatsAppBulkRecipient_flotaProspectoId_idx" ON "WhatsAppBulkRecipient"("flotaProspectoId");
