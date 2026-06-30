import { Injectable, Logger } from '@nestjs/common';
import { ChatwootClient } from './chatwoot.client';
import type {
  ChatwootConversationListItem,
  ChatwootMessage,
  ChatwootContact,
  ChatwootInbox,
  ChatwootAgent,
} from './chatwoot.types';

@Injectable()
export class ChatwootService {
  private readonly logger = new Logger(ChatwootService.name);

  constructor(private readonly client: ChatwootClient) {}

  getInboxId(): number {
    return this.client.getConfig().inboxId;
  }

  async listConversations(params?: {
    status?: string;
    q?: string;
    inbox_id?: number;
    page?: number;
  }): Promise<ChatwootConversationListItem[]> {
    return this.client.listConversations({
      inbox_id: params?.inbox_id ?? this.client.getConfig().inboxId,
      status: params?.status,
      q: params?.q,
      page: params?.page,
    });
  }

  async listMessages(
    conversationId: number,
    before?: number,
  ): Promise<ChatwootMessage[]> {
    return this.client.listMessages(conversationId, before);
  }

  async sendMessage(
    conversationId: number,
    content: string,
  ): Promise<ChatwootMessage> {
    return this.client.sendMessage(conversationId, content, 'outgoing');
  }

  async updateConversation(
    conversationId: number,
    data: { status?: string; assignee_id?: number },
  ) {
    if (data.assignee_id !== undefined) {
      return this.client.assignConversation(conversationId, data.assignee_id);
    }
    return this.client.updateConversation(conversationId, data);
  }

  async searchContacts(query: string): Promise<ChatwootContact[]> {
    const result = await this.client.searchContacts(query);
    return result.data ?? [];
  }

  async createContact(data: {
    name: string;
    phone_number?: string;
    email?: string;
  }): Promise<ChatwootContact> {
    const result = await this.client.createContact(data);
    return result.payload.contact;
  }

  async listInboxes(): Promise<ChatwootInbox[]> {
    return this.client.listInboxes();
  }

  async listAgents(): Promise<ChatwootAgent[]> {
    return this.client.listAgents();
  }

  async config() {
    return this.client.getConfig();
  }

  async createConversation(contactId: number) {
    return this.client.createConversation(contactId);
  }

  async sendTemplateMessage(
    conversationId: number,
    content: string,
    templateParams: {
      name: string;
      category: string;
      language: string;
      processed_params: Record<string, unknown>;
    },
  ) {
    return this.client.sendTemplateMessage(conversationId, content, templateParams);
  }

  async initiateConversation(data: {
    name: string;
    phone: string;
    templateName: string;
    templateCategory: string;
    templateLanguage: string;
    templateParams?: Record<string, unknown>;
  }): Promise<{ conversationId: number; contactId: number }> {
    // 1. Crear contacto en Chatwoot
    const contact = await this.createContact({
      name: data.name,
      phone_number: data.phone,
    });

    // 2. Crear conversación
    const conversation = await this.client.createConversation(contact.id);

    // 3. Enviar mensaje template
    await this.client.sendTemplateMessage(conversation.id, '', {
      name: data.templateName,
      category: data.templateCategory,
      language: data.templateLanguage,
      processed_params: data.templateParams ?? {},
    });

    return { conversationId: conversation.id, contactId: contact.id };
  }
}
