-- RUC único: pendiente por duplicados en BD (ej. 20000000000).
-- Resolver duplicados antes de añadir:
--   CREATE UNIQUE INDEX "Company_ruc_key" ON "Company"("ruc") WHERE "ruc" IS NOT NULL;
SELECT 1;
