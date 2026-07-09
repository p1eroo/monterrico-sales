-- AlterTable: add aireAcondicionado column to FlotaProspecto
ALTER TABLE "FlotaProspecto" ADD COLUMN IF NOT EXISTS "aireAcondicionado" TEXT;
