-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'activo',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_companyId_key" ON "Client"("companyId");

-- CreateIndex
CREATE INDEX "Client_companyId_idx" ON "Client"("companyId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Empresas ya en cierre_ganado: alta como cliente (fecha alta = createdAt del registro Cliente)
INSERT INTO "Client" ("id", "companyId", "status", "notes", "createdAt", "updatedAt")
SELECT
  concat('cl', substring(md5(random()::text || c.id || clock_timestamp()::text) from 1 for 22)),
  c.id,
  'activo',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c
WHERE c.etapa = 'cierre_ganado'
  AND NOT EXISTS (SELECT 1 FROM "Client" cl WHERE cl."companyId" = c.id);
