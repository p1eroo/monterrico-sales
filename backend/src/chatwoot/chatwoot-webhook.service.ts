import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatwootClient } from './chatwoot.client';
import { ChatwootGateway } from './chatwoot.gateway';
import type { ChatwootWebhookPayload } from './chatwoot.types';

@Injectable()
export class ChatwootWebhookService {
  private readonly logger = new Logger(ChatwootWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: ChatwootClient,
    private readonly gateway: ChatwootGateway,
  ) {}

  async handle(payload: ChatwootWebhookPayload) {
    this.logger.debug(`Webhook event: ${payload.event}`);

    switch (payload.event) {
      case 'message_created':
        return this.handleMessageCreated(payload);
      case 'conversation_created':
        return this.handleConversationCreated(payload);
      case 'conversation_status_changed':
        return this.handleStatusChanged(payload);
      case 'contact_created':
      case 'contact_updated':
        return this.handleContactSync(payload);
      case 'conversation_updated':
        this.gateway.emitGlobal('conversation_updated', {
          conversationId: payload.id,
          assignee: payload.assignee,
          status: payload.status,
        });
        return { received: true };
      default:
        this.gateway.emitGlobal(payload.event, payload);
        return { received: true };
    }
  }

  private async handleMessageCreated(payload: ChatwootWebhookPayload) {
    const message = payload.message;
    if (!message || message.message_type === 2) return { received: true };

    const conversation = payload.conversation;
    if (!conversation) return { received: true };

    const sender = message.sender;
    const phone = sender?.type === 'contact'
      ? conversation.meta?.sender?.phone_number
      : null;

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

    this.gateway.emitMessage(conversation.id, 'message_created', {
      conversationId: conversation.id,
      message,
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

    this.gateway.emitGlobal('conversation_created', conversation);
    return { received: true };
  }

  private async handleStatusChanged(payload: ChatwootWebhookPayload) {
    this.gateway.emitGlobal('conversation_status_changed', {
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

  private async findOrCreateProspecto(
    phone: string,
    name?: string,
  ) {
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
            celular: phone,
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
