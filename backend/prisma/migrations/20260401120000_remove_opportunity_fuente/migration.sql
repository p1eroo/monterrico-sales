-- Fuente comercial solo en Contact y Company; no en Opportunity.
ALTER TABLE "Opportunity" DROP COLUMN IF EXISTS "fuente";
