/**
 * Sincroniza los contactos de Chatwoot (inbox 45) como FlotaProspecto
 * para los números que aún no tienen prospecto vinculado.
 *
 * Uso (desde backend/):
 *   npm run scripts:sync-chatwoot-contacts
 *
 * Modo dry-run (preview sin crear):
 *   DRY_RUN=true npm run scripts:sync-chatwoot-contacts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

interface ChatwootContact {
  id: number;
  name: string;
  phone_number: string;
  email?: string;
  thumbnail?: string;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const prisma = app.get(PrismaService);
  const config = app.get(ConfigService);
  const dryRun = process.env.DRY_RUN?.trim() === 'true';

  const baseUrl = config.get<string>('CHATWOOT_BASE_URL')!;
  const accountId = config.get<number>('CHATWOOT_ACCOUNT_ID')!;
  const inboxId = config.get<number>('CHATWOOT_INBOX_ID')!;
  const token = config.get<string>('CHATWOOT_API_TOKEN')!;

  const api = (path: string) =>
    fetch(`${baseUrl}/api/v1/accounts/${accountId}${path}`, {
      headers: { 'api_access_token': token, 'Content-Type': 'application/json' },
    }).then((r) => r.json());

  console.log(`\n=== Sync Chatwoot Contacts → FlotaProspecto ===\n`);
  console.log(`Inbox: ${inboxId} | Dry-run: ${dryRun}\n`);

  // Obtener conversaciones del inbox de Flota
  const convRes = await api(`/conversations?inbox_id=${inboxId}&status=all&sort_by=latest`);
  const conversations = convRes?.data?.payload ?? [];
  console.log(`Conversaciones encontradas: ${conversations.length}`);

  let creados = 0;
  let existentes = 0;
  let errores = 0;

  for (const conv of conversations) {
    const sender: ChatwootContact | undefined = conv.meta?.sender;
    if (!sender?.phone_number) continue;

    const phone = sender.phone_number.replace(/\D/g, '');
    const last9 = phone.slice(-9);
    if (!last9) continue;

    // Buscar si ya existe FlotaProspecto con este número
    const exists = await prisma.flotaProspecto.findFirst({
      where: {
        OR: [
          { celular: { contains: last9 } },
          { movil: { contains: last9 } },
        ],
      },
      select: { id: true, nombreCompleto: true },
    });

    if (exists) {
      existentes++;
      if (exists.nombreCompleto !== sender.name) {
        console.log(`  ⚠️ #${conv.id} ${sender.name} → ya existe como "${exists.nombreCompleto}" (${sender.phone_number})`);
      }
      continue;
    }

    const nombre = sender.name?.trim() || `Contacto ${last9}`;
    const celular = `51${last9}`;

    console.log(`  ➕ #${conv.id} Crear: ${nombre} - ${celular}`);

    if (!dryRun) {
      try {
        await prisma.flotaProspecto.create({
          data: {
            nombreCompleto: nombre,
            celular,
            estado: 'Nuevo',
            origen: 'CHATWOOT',
            chatwootContactId: sender.id,
            chatwootConversationId: conv.id,
          },
        });
        creados++;
      } catch (e) {
        console.error(`  ❌ Error: ${e instanceof Error ? e.message : e}`);
        errores++;
      }
    } else {
      creados++;
    }
  }

  console.log(`\n=== Resumen ===`);
  console.log(`  Total conversaciones: ${conversations.length}`);
  console.log(`  Ya existían: ${existentes}`);
  console.log(`  Creados: ${dryRun ? `${creados} (dry-run)` : creados}`);
  console.log(`  Errores: ${errores}`);
  console.log(`\n✔ Hecho.`);

  await app.close();
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
