import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatwootClient } from './chatwoot.client';
import { ChatwootEventService } from './chatwoot-event.service';
import type { ChatwootWebhookPayload } from './chatwoot.types';

@Injectable()
export class ChatwootWebhookService {
  private readonly logger = new Logger(ChatwootWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: ChatwootClient,
    private readonly events: ChatwootEventService,
  ) {}

  private emit(event: string, data: unknown) {
    const ns = this.events.namespace;
    if (!ns) {
      this.logger.warn(`⚠️ Socket.IO /chatwoot no disponible (event=${event})`);
      return;
    }
    ns.emit('chatwoot', { event, data });
    this.logger.log(`✅ Evento emitido: ${event}`);
  }

  async handle(payload: ChatwootWebhookPayload) {
    this.logger.log(`📩 Webhook event: ${payload.event}`);

    try {
      switch (payload.event) {
        case 'message_created':
          return await this.handleMessageCreated(payload as unknown as Record<string, unknown>);
        case 'conversation_created':
          return await this.handleConversationCreated(payload);
        case 'conversation_status_changed':
          return this.handleStatusChanged(payload);
        case 'contact_created':
        case 'contact_updated':
          return await this.handleContactSync(payload);
        case 'conversation_updated':
          this.emit('conversation_updated', {
            conversationId: payload.id,
            assignee: payload.assignee,
            status: payload.status,
          });
          return { received: true };
        default:
          this.emit(payload.event, payload);
          return { received: true };
      }
    } catch (e) {
      this.logger.error(`❌ Error en webhook ${payload.event}: ${e instanceof Error ? e.message : e}`);
      return { received: true };
    }
  }

  private async handleMessageCreated(payload: Record<string, unknown>) {
    const messageType = payload.message_type as number | undefined;
    if (messageType === 2) return { received: true };

    const conversation = payload.conversation as { id?: number; meta?: { sender?: { phone_number?: string; id?: number; name?: string } } } | undefined;
    if (!conversation) return { received: true };

    const sender = payload.sender as { id?: number; name?: string; type?: string } | undefined;
    const assigneeId = (conversation as any)?.assignee_id as number | undefined;
    const contactPhone = ((conversation as any)?.meta?.sender?.phone_number
      || (conversation as any)?.contact_inbox?.source_id) as string | undefined;
    const contactSenderId = (conversation as any)?.meta?.sender?.id as number | undefined;

    try {
      if (contactPhone) {
        const isInbound = sender?.type === 'contact';
        const name = isInbound ? (sender?.name || '') : (conversation as any)?.meta?.sender?.name || '';
        const prospecto = await this.findOrCreateProspecto(contactPhone, name);
        if (prospecto) {
          await this.prisma.flotaProspecto.update({
            where: { id: prospecto.id },
            data: {
              chatwootContactId: isInbound ? (sender?.id ?? 0) : (contactSenderId ?? 0),
              chatwootConversationId: conversation.id,
            },
          });
          // Vincular mensaje al User y asignar operador por assignee_id
          let createdByUserId: string | null = null;
          if (assigneeId) {
            try {
              const agents = await this.client.listAgents();
              const agent = agents.find((a: any) => a.id === assigneeId);
              if (agent) {
                const user = await this.prisma.user.findFirst({ where: { name: agent.name } });
                if (user) {
                  createdByUserId = user.id;
                  if (!prospecto.operador) {
                    await this.prisma.flotaProspecto.update({
                      where: { id: prospecto.id },
                      data: { operador: agent.name, asignadoAt: new Date() },
                    });
                  }
                }
              }
            } catch { /* ignorar */ }
          }
          // Fallback: si no hay assignee_id, buscar por sender.id en listAgents
          if (!createdByUserId && !isInbound && sender?.id) {
            try {
              const agents = await this.client.listAgents();
              const agent = agents.find((a: any) => a.id === sender.id);
              if (agent) {
                const user = await this.prisma.user.findFirst({ where: { name: agent.name } });
                if (user) createdByUserId = user.id;
              }
            } catch { /* ignorar */ }
          }
          // Último fallback: si aún no hay, intentar por sender.name
          if (!createdByUserId && !isInbound && sender?.name?.trim()) {
            try {
              const user = await this.prisma.user.findFirst({ where: { name: sender.name.trim() } });
              if (user) createdByUserId = user.id;
            } catch { /* ignorar */ }
          }

          // Guardar en crm_whatsapp_message para reportes
          const content = typeof payload.content === 'string' ? payload.content.slice(0, 500) : '[sin texto]';
          const createdAt = typeof payload.created_at === 'number' ? new Date(payload.created_at * 1000) : new Date();
          await this.prisma.crmWhatsappMessage.create({
            data: {
              direction: isInbound ? 'inbound' : 'outbound',
              evoInstanceId: 'chatwoot',
              evoInstanceName: 'chatwoot',
              fromWaId: contactPhone,
              toWaId: contactPhone,
              body: content,
              flotaProspectoId: prospecto.id,
              createdByUserId,
              createdAt,
            },
          });
        }
      }
    } catch (e) {
      this.logger.warn(`Error en BD: ${e instanceof Error ? e.message : e}`);
    }

    this.emit('message_created', {
      conversationId: conversation.id,
      message: payload,
      phone: contactPhone,
    });

    return { received: true };
  }

  private async handleConversationCreated(payload: ChatwootWebhookPayload) {
    const conversation = payload.conversation;
    if (!conversation) return { received: true };

    const sender = conversation.meta?.sender;
    const phone = sender?.phone_number;

    if (phone) {
      const prospecto = await this.findOrCreateProspecto(phone, sender.name);
      if (prospecto) {
        await this.prisma.flotaProspecto.update({
          where: { id: prospecto.id },
          data: {
            chatwootContactId: sender.id,
            chatwootConversationId: conversation.id,
          },
        });
      }
    }

    this.emit('conversation_created', conversation);
    return { received: true };
  }

  private async handleStatusChanged(payload: ChatwootWebhookPayload) {
    this.emit('conversation_status_changed', {
      conversationId: payload.id,
      status: payload.status,
    });
    return { received: true };
  }

  private async handleContactSync(payload: ChatwootWebhookPayload) {
    if (!payload.contact) return { received: true };
    const phone = payload.contact.phone_number;
    if (phone) {
      const prospecto = await this.findOrCreateProspecto(phone, payload.contact.name);
      if (prospecto) {
        await this.prisma.flotaProspecto.update({
          where: { id: prospecto.id },
          data: { chatwootContactId: payload.contact.id },
        });
      }
    }
    return { received: true };
  }

  private async findOrCreateProspecto(phone: string, name?: string) {
    const cleaned = phone.replace(/\D/g, '').slice(-9);
    if (!cleaned) return null;

    let prospecto = await this.prisma.flotaProspecto.findFirst({
      where: {
        OR: [
          { celular: { contains: cleaned } },
          { movil: { contains: cleaned } },
        ],
      },
    });

    // Actualizar nombre con el que envía Chatwoot (siempre)
    if (prospecto && name) {
      prospecto = await this.prisma.flotaProspecto.update({
        where: { id: prospecto.id },
        data: { nombreCompleto: name },
      });
    }

    // Si existe pero está eliminado, no reactivar — solo actualizar nombre si aplica
    if (prospecto?.eliminadoAt) {
      if (name) {
        prospecto = await this.prisma.flotaProspecto.update({
          where: { id: prospecto.id },
          data: { nombreCompleto: name },
        });
      }
      return prospecto;
    }

    if (!prospecto && name) {
      try {
        prospecto = await this.prisma.flotaProspecto.create({
          data: {
            nombreCompleto: name,
            celular: '51' + cleaned,
            estado: 'Nuevo',
            origen: 'CHATWOOT',
          },
        });
      } catch {
        return null;
      }
    }

    return prospecto;
  }
}
