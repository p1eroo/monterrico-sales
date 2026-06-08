-- @updatedAt en Prisma no usa DEFAULT en PostgreSQL; el cliente rellena el valor.
ALTER TABLE "AiAssistantInstruction" ALTER COLUMN "updatedAt" DROP DEFAULT;
