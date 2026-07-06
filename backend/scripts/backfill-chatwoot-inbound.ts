/**
 * Recupera mensajes inbound de Chatwoot que el webhook no guardó por no encontrar
 * el teléfono del contacto (bug en contactPhone fallback).
 *
 * Estrategia:
 *   - Itera sobre cada FlotaProspecto que tiene chatwootConversationId
 *   - Obtiene TODOS los mensajes de esa conversación (paginando con ?before=)
 *   - Detecta inbound faltantes (message_type === 0, sender.type === 'contact')
 *   - Inserta los que no existan en CrmWhatsappMessage
 *
 * Uso (desde backend/):
 *   npx ts-node --project tsconfig.json scripts/backfill-chatwoot-inbound.ts
 *   DRY_RUN=true npx ts-node --project tsconfig.json scripts/backfill-chatwoot-inbound.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

interface ChatwootMessageRaw {
  id: number;
  content: string;
  message_type: number;
  created_at: number;
  source_id: string;
  sender: {
    id: number;
    name: string;
    type: 'user' | 'contact' | 'agent_bot';
  };
  conversation_id: number;
}

interface ChatwootMessagesResponse {
  payload?: ChatwootMessageRaw[];
  data?: { payload?: ChatwootMessageRaw[] };
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
  const token = config.get<string>('CHATWOOT_API_TOKEN')!;

  const api = async (path: string): Promise<any> => {
    const res = await fetch(`${baseUrl}/api/v1/accounts/${accountId}${path}`, {
      headers: { api_access_token: token, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err: any = new Error(`Chatwoot API ${res.status}: ${text.slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  };

  console.log(`\n=== Backfill Chatwoot Inbound Messages ===\n`);
  console.log(`Dry-run: ${dryRun}\n`);

  // 1. Obtener prospectos con conversación vinculada
  const prospectos = await prisma.flotaProspecto.findMany({
    where: {
      chatwootConversationId: { not: null },
      eliminadoAt: null,
    },
    select: {
      id: true,
      nombreCompleto: true,
      celular: true,
      chatwootConversationId: true,
    },
  });

  console.log(`Prospectos con conversación Chatwoot: ${prospectos.length}\n`);

  let totalProcesadas = 0;
  let totalFaltantes = 0;
  let totalInsertados = 0;
  let totalErrores = 0;
  let totalSaltados = 0;

  for (const p of prospectos) {
    const convId = p.chatwootConversationId!;
    totalProcesadas++;

    try {
      // 2. Obtener todos los mensajes de esta conversación (paginación)
      const allMessages: ChatwootMessageRaw[] = [];
      let before: number | undefined;

      while (true) {
        const path = `/conversations/${convId}/messages${before ? `?before=${before}` : ''}`;
        const raw = await api(path);
        // Chatwoot puede devolver { payload: [...] } o [...]
        const batch: ChatwootMessageRaw[] =
          raw?.payload ??
          raw?.data?.payload ??
          raw?.data ??
          (Array.isArray(raw) ? raw : []);

        if (!batch || batch.length === 0) break;

        allMessages.push(...batch);

        if (batch.length < 15) break; // última página

        // Obtener el ID más bajo para paginar hacia atrás
        before = Math.min(...batch.map((m) => m.id));
      }

      // 3. Filtrar mensajes inbound (contacto → nosotros)
      const inboundMessages = allMessages.filter(
        (m) => m.message_type === 0 && m.sender?.type === 'contact',
      );

      if (inboundMessages.length === 0) continue;

      // 4. Para cada inbound, verificar si ya existe en nuestra DB
      for (const msg of inboundMessages) {
        const createdAt = new Date(msg.created_at * 1000);

        // Buscar duplicado por mismo prospecto + mismo contenido + dirección + ventana ±5s
        const existing = await prisma.crmWhatsappMessage.findFirst({
          where: {
            flotaProspectoId: p.id,
            direction: 'inbound',
            body: msg.content?.slice(0, 500) ?? '[sin texto]',
            createdAt: {
              gte: new Date(createdAt.getTime() - 5000),
              lte: new Date(createdAt.getTime() + 5000),
            },
          },
          select: { id: true },
        });

        if (existing) {
          totalSaltados++;
          continue;
        }

        totalFaltantes++;
        const phone = p.celular?.replace(/\D/g, '') || '';

        if (!dryRun) {
          try {
            await prisma.crmWhatsappMessage.create({
              data: {
                direction: 'inbound',
                evoInstanceId: 'chatwoot',
                evoInstanceName: 'chatwoot',
                fromWaId: phone ? `+${phone}` : 'unknown',
                toWaId: phone ? `+${phone}` : 'unknown',
                body: msg.content?.slice(0, 500) ?? '[sin texto]',
                flotaProspectoId: p.id,
                createdAt,
              },
            });
            totalInsertados++;
          } catch (e: any) {
            totalErrores++;
            if (totalErrores <= 5) {
              console.error(`  ❌ Error prospecto ${p.id}: ${e.message}`);
            }
          }
        } else {
          totalInsertados++;
        }
      }

      if (totalProcesadas % 50 === 0) {
        console.log(`  Progreso: ${totalProcesadas}/${prospectos.length} conversaciones (${totalInsertados} nuevos)…`);
      }
    } catch (e: any) {
      totalErrores++;
      if (e.status === 404) {
        // Conversación eliminada o inaccesible
        continue;
      }
      if (totalErrores <= 10) {
        console.error(`  ❌ Error conv ${convId}: ${e.message}`);
      }
    }
  }

  console.log(`\n=== Resumen ===`);
  console.log(`  Conversaciones procesadas: ${totalProcesadas}`);
  console.log(`  Mensajes inbound faltantes encontrados: ${totalFaltantes}`);
  console.log(`  Insertados: ${dryRun ? `${totalInsertados} (dry-run)` : totalInsertados}`);
  console.log(`  Ya existían: ${totalSaltados}`);
  console.log(`  Errores: ${totalErrores}`);
  console.log(`\n✔ Hecho.`);

  await app.close();
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
