-- Cartera de clientes (dominio aparte del CRM)

CREATE TABLE "ClienteEmpresa" (
    "id" TEXT NOT NULL,
    "externalId" INTEGER NOT NULL,
    "empresa" TEXT NOT NULL,
    "ruc" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "asesor" TEXT NOT NULL,
    "fechaAlta" TIMESTAMP(3) NOT NULL,
    "ingresos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ingresosAnual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mesActual" TEXT,
    "logoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'activo',
    "contactoNombre" TEXT,
    "servicio" TEXT,
    "mes1" TEXT,
    "monto1" DOUBLE PRECISION,
    "mes2" TEXT,
    "monto2" DOUBLE PRECISION,
    "mes3" TEXT,
    "monto3" DOUBLE PRECISION,
    "mes4" TEXT,
    "monto4" DOUBLE PRECISION,
    "mes5" TEXT,
    "monto5" DOUBLE PRECISION,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClienteEmpresa_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactoEmpresa" (
    "id" TEXT NOT NULL,
    "externalId" INTEGER NOT NULL,
    "clienteEmpresaId" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "cargo" TEXT,
    "empresaNombre" TEXT,
    "asesor" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactoEmpresa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClienteEmpresa_externalId_key" ON "ClienteEmpresa"("externalId");
CREATE INDEX "ClienteEmpresa_asesor_idx" ON "ClienteEmpresa"("asesor");
CREATE INDEX "ClienteEmpresa_ruc_idx" ON "ClienteEmpresa"("ruc");
CREATE INDEX "ClienteEmpresa_status_idx" ON "ClienteEmpresa"("status");
CREATE INDEX "ClienteEmpresa_fechaAlta_idx" ON "ClienteEmpresa"("fechaAlta");

CREATE UNIQUE INDEX "ContactoEmpresa_externalId_key" ON "ContactoEmpresa"("externalId");
CREATE INDEX "ContactoEmpresa_clienteEmpresaId_idx" ON "ContactoEmpresa"("clienteEmpresaId");
CREATE INDEX "ContactoEmpresa_asesor_idx" ON "ContactoEmpresa"("asesor");

ALTER TABLE "ContactoEmpresa" ADD CONSTRAINT "ContactoEmpresa_clienteEmpresaId_fkey" FOREIGN KEY ("clienteEmpresaId") REFERENCES "ClienteEmpresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
