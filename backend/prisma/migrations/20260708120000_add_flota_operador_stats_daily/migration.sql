-- Historial diario de métricas Actividad por Operador
CREATE TABLE "FlotaOperadorStatsDaily" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "operador" TEXT NOT NULL,
    "prospectosAsignados" INTEGER NOT NULL DEFAULT 0,
    "chatsActivos" INTEGER NOT NULL DEFAULT 0,
    "mensajesEnviados" INTEGER NOT NULL DEFAULT 0,
    "mensajesRecibidos" INTEGER NOT NULL DEFAULT 0,
    "llamadas" INTEGER NOT NULL DEFAULT 0,
    "citasProgramadas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlotaOperadorStatsDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FlotaOperadorStatsDaily_fecha_operador_key" ON "FlotaOperadorStatsDaily"("fecha", "operador");
CREATE INDEX "FlotaOperadorStatsDaily_fecha_idx" ON "FlotaOperadorStatsDaily"("fecha");
CREATE INDEX "FlotaOperadorStatsDaily_operador_idx" ON "FlotaOperadorStatsDaily"("operador");
