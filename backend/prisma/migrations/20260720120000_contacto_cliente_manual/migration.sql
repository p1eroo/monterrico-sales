DROP TABLE IF EXISTS "ContactoEmpresa";

CREATE TABLE "ContactoCliente" (
    "id" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "cargo" TEXT,
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactoCliente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClienteEmpresaContacto" (
    "id" TEXT NOT NULL,
    "clienteEmpresaId" TEXT NOT NULL,
    "contactoClienteId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClienteEmpresaContacto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactoCliente_assignedTo_idx" ON "ContactoCliente"("assignedTo");

CREATE UNIQUE INDEX "ClienteEmpresaContacto_clienteEmpresaId_contactoClienteId_key" ON "ClienteEmpresaContacto"("clienteEmpresaId", "contactoClienteId");
CREATE INDEX "ClienteEmpresaContacto_clienteEmpresaId_idx" ON "ClienteEmpresaContacto"("clienteEmpresaId");
CREATE INDEX "ClienteEmpresaContacto_contactoClienteId_idx" ON "ClienteEmpresaContacto"("contactoClienteId");

ALTER TABLE "ContactoCliente" ADD CONSTRAINT "ContactoCliente_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClienteEmpresaContacto" ADD CONSTRAINT "ClienteEmpresaContacto_clienteEmpresaId_fkey" FOREIGN KEY ("clienteEmpresaId") REFERENCES "ClienteEmpresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClienteEmpresaContacto" ADD CONSTRAINT "ClienteEmpresaContacto_contactoClienteId_fkey" FOREIGN KEY ("contactoClienteId") REFERENCES "ContactoCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
