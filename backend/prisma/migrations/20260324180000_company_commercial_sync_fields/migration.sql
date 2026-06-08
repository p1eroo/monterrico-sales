-- Commercial fields on Company + source on Opportunity (account-level sync)

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "facturacionEstimada" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "etapa" TEXT NOT NULL DEFAULT 'lead';
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "assignedTo" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Company_assignedTo_fkey'
  ) THEN
    ALTER TABLE "Company"
      ADD CONSTRAINT "Company_assignedTo_fkey"
      FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Company_assignedTo_idx" ON "Company"("assignedTo");
CREATE INDEX IF NOT EXISTS "Company_etapa_idx" ON "Company"("etapa");

ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "source" TEXT;
