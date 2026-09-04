export type ChannelType = 'website' | 'email' | 'whatsapp' | 'facebook' | 'instagram' | 'telegram' | 'sms' | 'api';

export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export interface Agent {
  id: string;
  name: string;
  avatar: string;
}

export interface Inbox {
  id: string;
  name: string;
  channelType: ChannelType;
  unreadCount: number;
}

export interface Contact {
  id: string;
  inboxId: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  company?: string;
  waId?: string;
  avatar?: string;
  lastSeen?: Date;
  isBlocked?: boolean;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  inboxId: string;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  senderType: 'agent' | 'contact' | 'system' | 'bot';
  senderId?: string;
  senderName?: string;
  isPrivate: boolean;
  contentType: 'text' | 'image' | 'file' | 'audio' | 'sticker' | 'location';
  fileName?: string;
  fileSize?: number;
  fileUrl?: string;
  attachmentUrl?: string;
  attachmentId?: string;
  mimeType?: string;
  durationSeconds?: number | null;
  createdAt: Date;
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export interface Conversation {
  id: string;
  inboxId: string;
  contact: Contact;
  assignee?: Agent;
  lastMessage: Message | null;
  unreadCount: number;
  priority: Priority;
  labels: Label[];
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
  isTyping: boolean;
  channelType: ChannelType;
  operador?: string | null;
  prospectoActivo?: boolean;
  /** ISO datetime cuando el prospecto está citado */
  fechaCita?: string | null;
  asistencia?: string | null;
}
