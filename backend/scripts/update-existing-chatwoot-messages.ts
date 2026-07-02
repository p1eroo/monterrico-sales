/**
 * Vincula los mensajes existentes de Chatwoot (sin createdByUserId)
 * al User correcto según el operador del prospecto.
 *
 * Uso (desde backend/):
 *   npm run scripts:update-chatwoot-messages
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const result = await prisma.$executeRawUnsafe(`
    UPDATE "CrmWhatsappMessage" m
    SET "createdByUserId" = u.id
    FROM "FlotaProspecto" p
    JOIN "User" u ON u.name = p.operador
    WHERE m."flotaProspectoId" = p.id
      AND m."evoInstanceName" = 'chatwoot'
      AND m."createdByUserId" IS NULL
      AND m.direction = 'outbound'
      AND p.operador IS NOT NULL
  `);

  console.log(`Mensajes actualizados: ${result}`);
  await app.close();
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
