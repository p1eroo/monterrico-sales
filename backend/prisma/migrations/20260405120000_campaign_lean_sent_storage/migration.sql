-- Almacenamiento ligero para campañas enviadas: sin cuerpo HTML ni lista de destinatarios en JSON.
ALTER TABLE "Campaign" ADD COLUMN "subjectSnapshot" TEXT;

ALTER TABLE "Campaign" ALTER COLUMN "messageJson" DROP NOT NULL;
ALTER TABLE "Campaign" ALTER COLUMN "recipientsJson" DROP NOT NULL;

-- Rellenar asunto desde JSON histórico (enviadas) para listados y detalle.
UPDATE "Campaign"
SET "subjectSnapshot" = LEFT(COALESCE(TRIM("messageJson"->>'subject'), ''), 500)
WHERE "status" = 'sent' AND "subjectSnapshot" IS NULL AND "messageJson" IS NOT NULL;
