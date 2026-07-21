-- RUC informativo: permite duplicados; la identidad de empresa es el dominio.
DROP INDEX IF EXISTS "Company_ruc_key";

CREATE INDEX IF NOT EXISTS "Company_ruc_idx" ON "Company"("ruc");
