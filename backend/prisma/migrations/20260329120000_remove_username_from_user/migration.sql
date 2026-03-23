-- Eliminar username de User (se obtiene de Account.providerId para provider='credentials')
ALTER TABLE "User" DROP COLUMN IF EXISTS "username";
