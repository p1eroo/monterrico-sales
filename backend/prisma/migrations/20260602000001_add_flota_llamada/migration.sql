-- CreateTable
CREATE TABLE "FlotaLlamada" (
    "id" TEXT NOT NULL,
    "prospectoId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlotaLlamada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlotaLlamada_prospectoId_idx" ON "FlotaLlamada"("prospectoId");

-- AddForeignKey
ALTER TABLE "FlotaLlamada" ADD CONSTRAINT "FlotaLlamada_prospectoId_fkey" FOREIGN KEY ("prospectoId") REFERENCES "FlotaProspecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
