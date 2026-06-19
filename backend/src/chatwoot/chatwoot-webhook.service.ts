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

    const conversation = payload.conversation as { id?: number; meta?: { sender?: { phone_number?: string } } } | undefined;
    if (!conversation) return { received: true };

    const sender = payload.sender as { id?: number; name?: string; type?: string } | undefined;
    const phone = sender?.type === 'contact'
      ? (conversation as any)?.meta?.sender?.phone_number
      : null;

    try {
      if (phone) {
        const prospecto = await this.findOrCreateProspecto(phone, sender?.name || '');
        if (prospecto) {
          await this.prisma.flotaProspecto.update({
            where: { id: prospecto.id },
            data: {
              chatwootContactId: sender?.id ?? 0,
              chatwootConversationId: conversation.id,
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
      phone,
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
