-- Fuente comercial en oportunidad (import por fila + copia desde empresa/contacto en alta manual).
ALTER TABLE "Opportunity" ADD COLUMN "fuente" TEXT NOT NULL DEFAULT 'base';
