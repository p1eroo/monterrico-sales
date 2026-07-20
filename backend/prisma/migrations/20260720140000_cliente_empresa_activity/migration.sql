CREATE TABLE "ClienteEmpresaActivity" (
    "id" TEXT NOT NULL,
    "clienteEmpresaId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,

    CONSTRAINT "ClienteEmpresaActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClienteEmpresaActivity_clienteEmpresaId_activityId_key" ON "ClienteEmpresaActivity"("clienteEmpresaId", "activityId");
CREATE INDEX "ClienteEmpresaActivity_clienteEmpresaId_idx" ON "ClienteEmpresaActivity"("clienteEmpresaId");
CREATE INDEX "ClienteEmpresaActivity_activityId_idx" ON "ClienteEmpresaActivity"("activityId");

ALTER TABLE "ClienteEmpresaActivity" ADD CONSTRAINT "ClienteEmpresaActivity_clienteEmpresaId_fkey" FOREIGN KEY ("clienteEmpresaId") REFERENCES "ClienteEmpresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClienteEmpresaActivity" ADD CONSTRAINT "ClienteEmpresaActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
