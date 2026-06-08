-- Agregar columna asignadoAt a FlotaProspecto para trackear cuándo se asignó el operador

ALTER TABLE "FlotaProspecto" ADD COLUMN "asignadoAt" DATE;

-- Backfill: para prospectos que ya tienen operador, usar createdAt como aproximación
UPDATE "FlotaProspecto" SET "asignadoAt" = "createdAt"::date
WHERE "operador" IS NOT NULL AND "asignadoAt" IS NULL;
