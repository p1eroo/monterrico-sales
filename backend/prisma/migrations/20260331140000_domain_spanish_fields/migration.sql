-- Dominio en español: fuente, correo/telefono en Contact; clienteRecuperado en Company

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "clienteRecuperado" TEXT;

ALTER TABLE "Company" RENAME COLUMN "source" TO "fuente";

ALTER TABLE "Contact" RENAME COLUMN "phone" TO "telefono";
ALTER TABLE "Contact" RENAME COLUMN "email" TO "correo";
ALTER TABLE "Contact" RENAME COLUMN "source" TO "fuente";

ALTER TABLE "Opportunity" RENAME COLUMN "source" TO "fuente";
