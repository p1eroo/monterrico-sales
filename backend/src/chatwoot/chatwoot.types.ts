export interface ChatwootConfig {
  baseUrl: string;
  accountId: number;
  apiToken: string;
  inboxId: number;
}

export interface ChatwootConversation {
  id: number;
  inbox_id: number;
  status: 'open' | 'resolved' | 'pending';
  contact_inbox: {
    source_id: string;
  };
  meta: {
    sender: ChatwootContact;
    assignee?: {
      id: number;
      name: string;
    };
  };
  messages: ChatwootMessage[];
  created_at: number;
  last_activity_at: number;
}

export interface ChatwootConversationListItem {
  id: number;
  inbox_id: number;
  status: string;
  meta: {
    sender: ChatwootContact;
    assignee?: { id: number; name: string; email?: string; role?: string };
  };
  last_activity_at: number;
  unread_count?: number;
}

export interface ChatwootContact {
  id: number;
  name: string;
  phone_number: string;
  email: string;
  identifier: string;
  additional_attributes: Record<string, unknown>;
  custom_attributes: Record<string, unknown>;
}

export interface ChatwootMessage {
  id: number;
  content: string;
  /** 0 = incoming, 1 = outgoing, 2 = activity */
  message_type: number;
  source_id: string;
  sender: {
    id: number;
    name: string;
    type: 'user' | 'contact' | 'agent_bot';
  };
  created_at: number;
  attachments: ChatwootAttachment[];
  conversation_id: number;
}

export interface ChatwootAttachment {
  id: number;
  file_type: string;
  file_url: string;
  data_url: string;
}

export interface ChatwootInbox {
  id: number;
  name: string;
  channel_type: string;
  phone_number?: string;
}

export interface ChatwootAgent {
  id: number;
  name: string;
  email: string;
  role: string;
  availability_status: string;
}

export interface ChatwootWebhookPayload {
  event: string;
  id: number;
  conversation?: ChatwootConversation;
  message?: ChatwootMessage;
  contact?: ChatwootContact;
  status?: string;
  assignee?: { id: number; name: string };
}
