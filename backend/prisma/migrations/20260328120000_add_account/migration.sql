-- CreateTable: Account (credenciales / métodos de login por usuario)
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Account_provider_providerId_key" ON "Account"("provider", "providerId");

ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrar credenciales existentes de User a Account
INSERT INTO "Account" ("id", "userId", "provider", "providerId", "passwordHash", "createdAt", "updatedAt")
SELECT
    'c' || substr(md5(u."id" || 'credentials'), 1, 24),
    u."id",
    'credentials',
    u."username",
    u."passwordHash",
    COALESCE(u."createdAt", NOW()),
    COALESCE(u."updatedAt", NOW())
FROM "User" u
WHERE u."passwordHash" IS NOT NULL AND u."passwordHash" != '';

-- Eliminar passwordHash de User
ALTER TABLE "User" DROP COLUMN "passwordHash";
