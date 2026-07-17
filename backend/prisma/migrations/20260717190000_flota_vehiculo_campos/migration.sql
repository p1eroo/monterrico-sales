-- Renombrar licencia → categoría vehicular (TIVE) y añadir datos del vehículo
ALTER TABLE "FlotaProspecto" RENAME COLUMN "licencia" TO "categoriaVehiculo";
ALTER TABLE "FlotaProspecto" ADD COLUMN "marca" TEXT;
ALTER TABLE "FlotaProspecto" ADD COLUMN "modelo" TEXT;
ALTER TABLE "FlotaProspecto" ADD COLUMN "color" TEXT;
ALTER TABLE "FlotaProspecto" ADD COLUMN "combustible" TEXT;
