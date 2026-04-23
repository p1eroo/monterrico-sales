-- Empresas en etapa Activo o con etapa CRM habilitada al 100 %: alta como Cliente si aún no existe.
INSERT INTO "Client" ("id", "companyId", "status", "notes", "createdAt", "updatedAt")
SELECT
  concat('cl', substring(md5(random()::text || c.id || clock_timestamp()::text) from 1 for 22)),
  c.id,
  'activo',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c
WHERE NOT EXISTS (SELECT 1 FROM "Client" cl WHERE cl."companyId" = c.id)
  AND (
    trim(c.etapa) = 'activo'
    OR EXISTS (
      SELECT 1
      FROM "CrmStage" s
      WHERE s."enabled" = true
        AND s."probability" = 100
        AND s.slug = trim(c.etapa)
    )
  );
