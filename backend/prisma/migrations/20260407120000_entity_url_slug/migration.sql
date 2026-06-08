-- Slug legible y único para URLs de detalle (oportunidad, contacto, empresa)

ALTER TABLE "Opportunity" ADD COLUMN "urlSlug" TEXT;
ALTER TABLE "Contact" ADD COLUMN "urlSlug" TEXT;
ALTER TABLE "Company" ADD COLUMN "urlSlug" TEXT;

CREATE UNIQUE INDEX "Opportunity_urlSlug_key" ON "Opportunity"("urlSlug");
CREATE UNIQUE INDEX "Contact_urlSlug_key" ON "Contact"("urlSlug");
CREATE UNIQUE INDEX "Company_urlSlug_key" ON "Company"("urlSlug");

-- Oportunidades: slug desde título + sufijo numérico si hay colisión
DO $$
DECLARE
  r RECORD;
  base text;
  candidate text;
  n int;
BEGIN
  FOR r IN SELECT id, title FROM "Opportunity" ORDER BY "createdAt" ASC LOOP
    base := trim(both '-' from regexp_replace(lower(trim(r.title)), '[^a-z0-9]+', '-', 'g'));
    IF base = '' OR base IS NULL THEN base := 'oportunidad'; END IF;
    IF length(base) > 80 THEN base := left(base, 80); END IF;
    candidate := base;
    n := 0;
    LOOP
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM "Opportunity" o2 WHERE o2."urlSlug" = candidate AND o2.id <> r.id
      );
      n := n + 1;
      candidate := base || '-' || n::text;
    END LOOP;
    UPDATE "Opportunity" SET "urlSlug" = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- Contactos: slug desde nombre
DO $$
DECLARE
  r RECORD;
  base text;
  candidate text;
  n int;
BEGIN
  FOR r IN SELECT id, name FROM "Contact" ORDER BY "createdAt" ASC LOOP
    base := trim(both '-' from regexp_replace(lower(trim(r.name)), '[^a-z0-9]+', '-', 'g'));
    IF base = '' OR base IS NULL THEN base := 'contacto'; END IF;
    IF length(base) > 80 THEN base := left(base, 80); END IF;
    candidate := base;
    n := 0;
    LOOP
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM "Contact" c2 WHERE c2."urlSlug" = candidate AND c2.id <> r.id
      );
      n := n + 1;
      candidate := base || '-' || n::text;
    END LOOP;
    UPDATE "Contact" SET "urlSlug" = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- Empresas: slug desde nombre comercial
DO $$
DECLARE
  r RECORD;
  base text;
  candidate text;
  n int;
BEGIN
  FOR r IN SELECT id, name FROM "Company" ORDER BY "createdAt" ASC LOOP
    base := trim(both '-' from regexp_replace(lower(trim(r.name)), '[^a-z0-9]+', '-', 'g'));
    IF base = '' OR base IS NULL THEN base := 'empresa'; END IF;
    IF length(base) > 80 THEN base := left(base, 80); END IF;
    candidate := base;
    n := 0;
    LOOP
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM "Company" c2 WHERE c2."urlSlug" = candidate AND c2.id <> r.id
      );
      n := n + 1;
      candidate := base || '-' || n::text;
    END LOOP;
    UPDATE "Company" SET "urlSlug" = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE "Opportunity" ALTER COLUMN "urlSlug" SET NOT NULL;
ALTER TABLE "Contact" ALTER COLUMN "urlSlug" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "urlSlug" SET NOT NULL;
