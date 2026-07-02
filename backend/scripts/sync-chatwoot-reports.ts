/**
 * Sincroniza mensajes de Chatwoot en crm_whasapp_message para reportes.
 * Recorre todas las conversaciones y guarda los mensajes que falten.
 *
 * Uso (desde backend/):
 *   npm run scripts:sync-chatwoot-reports
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ChatwootClient } from '../src/chatwoot/chatwoot.client';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const client = app.get(ChatwootClient);

  const inboxId = client.getConfig().inboxId;
  let totalConvs = 0;
  let totalSaved = 0;
  let totalSkipped = 0;

  // Obtener agentes de Chatwoot para mapear assignee_id -> User
  const agents = await client.listAgents();
  const agentUserMap = new Map<number, string>();
  for (const a of agents) {
    const user = await prisma.user.findFirst({ where: { name: a.name } });
    if (user) agentUserMap.set(a.id, user.id);
  }
  console.log(`Agentes mapeados: ${agentUserMap.size}/${agents.length}`);

  // Iterar páginas de conversaciones
  let page = 1;
  while (true) {
    const convs = await client.listConversations({ inbox_id: inboxId, page });
    if (convs.length === 0) break;

    for (const conv of convs) {
      totalConvs++;
      const phone = (conv as any).meta?.sender?.phone_number || (conv as any).source_id || '';
      const assigneeId = (conv as any).meta?.assignee?.id as number | undefined;
      const convId = conv.id;

      if (!phone) continue;

      // Buscar prospecto por teléfono
      const digits = phone.replace(/\D/g, '');
      const prospecto = await prisma.flotaProspecto.findFirst({
        where: {
          OR: [
            { celular: { endsWith: digits } },
            { movil: { endsWith: digits } },
          ],
        },
      });

      if (!prospecto) continue;

      // Asignar operador si no tiene
      if (!prospecto.operador && assigneeId) {
        const userId = agentUserMap.get(assigneeId);
        if (userId) {
          const agent = agents.find((a: any) => a.id === assigneeId);
          if (agent) {
            await prisma.flotaProspecto.update({
              where: { id: prospecto.id },
              data: { operador: agent.name },
            });
            console.log(`  Operador asignado: ${agent.name} -> ${prospecto.nombreCompleto || phone}`);
          }
        }
      }

      // Obtener mensajes de la conversación
      let beforeId: number | undefined;
      let convMessages: any[] = [];
      while (true) {
        const msgs = await client.listMessages(convId, beforeId);
        if (msgs.length === 0) break;
        convMessages = [...msgs, ...convMessages];
        beforeId = msgs[0].id;
      }

      // Guardar mensajes que falten
      for (const msg of convMessages) {
        const createdAt = new Date(msg.created_at * 1000);
        const content = typeof msg.content === 'string' ? msg.content.slice(0, 500) : '[sin texto]';
        const isInbound = msg.message_type === 0;

        // Verificar si ya existe (dedup por flotaProspectoId + createdAt)
        const exists = await prisma.crmWhatsappMessage.findFirst({
          where: {
            flotaProspectoId: prospecto.id,
            createdAt,
            body: content,
          },
        });
        if (exists) {
          totalSkipped++;
          continue;
        }

        const userId = isInbound ? null : (assigneeId ? agentUserMap.get(assigneeId) || null : null);

        await prisma.crmWhatsappMessage.create({
          data: {
            direction: isInbound ? 'inbound' : 'outbound',
            evoInstanceId: 'chatwoot',
            evoInstanceName: 'chatwoot',
            fromWaId: phone,
            toWaId: phone,
            body: content,
            flotaProspectoId: prospecto.id,
            createdByUserId: userId,
            createdAt,
          },
        });
        totalSaved++;
      }
    }

    console.log(`Página ${page}: ${convs.length} conversaciones, ${totalSaved} mensajes guardados`);
    page++;
  }

  console.log(`\nResumen:`);
  console.log(`  Conversaciones procesadas: ${totalConvs}`);
  console.log(`  Mensajes guardados: ${totalSaved}`);
  console.log(`  Mensajes saltados (ya existían): ${totalSkipped}`);

  await app.close();
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
