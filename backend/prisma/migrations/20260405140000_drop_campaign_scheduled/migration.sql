-- Quitar envío programado: cancelar pendientes y eliminar columna.
UPDATE "Campaign" SET status = 'cancelled' WHERE status IN ('scheduled', 'sending');

DROP INDEX IF EXISTS "Campaign_status_scheduledFor_idx";

ALTER TABLE "Campaign" DROP COLUMN IF EXISTS "scheduledFor";
