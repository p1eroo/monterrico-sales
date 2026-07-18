ALTER TABLE "ClienteEmpresa" ADD COLUMN "agenteSync" TEXT;

UPDATE "ClienteEmpresa" SET "agenteSync" = "asesor" WHERE "agenteSync" IS NULL;

ALTER TABLE "ClienteEmpresa" ALTER COLUMN "agenteSync" SET NOT NULL;

CREATE INDEX "ClienteEmpresa_agenteSync_idx" ON "ClienteEmpresa"("agenteSync");
