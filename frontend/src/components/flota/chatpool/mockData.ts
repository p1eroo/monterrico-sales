import type { Agent, Conversation, Inbox, Label, Message } from './types';

export const currentAgent: Agent = {
  id: 'agent-carmen',
  name: 'Carmen Camargo',
  avatar: 'CC',
};

export const inbox: Inbox = {
  id: 'inbox-facturacion',
  name: 'Facturación',
  channelType: 'whatsapp',
  unreadCount: 0,
};

const labels: Label[] = [
  { id: 'label-fact', name: 'facturación', color: 'blue', inboxId: inbox.id },
  { id: 'label-consulta', name: 'consulta', color: 'green', inboxId: inbox.id },
];

const now = Date.now();

function msg(
  id: string,
  conversationId: string,
  content: string,
  senderType: Message['senderType'],
  createdAt: Date,
  extra: Partial<Message> = {},
): Message {
  return {
    id,
    conversationId,
    content,
    senderType,
    senderId: senderType === 'agent' ? currentAgent.id : `contact-${conversationId}`,
    senderName: senderType === 'agent' ? currentAgent.name : undefined,
    isPrivate: false,
    contentType: 'text',
    createdAt,
    status: senderType === 'agent' ? 'read' : 'read',
    ...extra,
  };
}

export function getMessages(conversationId: string): Message[] {
  if (conversationId === 'conv-oscar') {
    return [
      msg('m1', conversationId, 'La conversación fue marcada como resuelta por Carmen Camargo', 'system', new Date(now - 7200000)),
      msg('m2', conversationId, 'La conversación fue reabierta por Carmen Camargo', 'system', new Date(now - 5400000)),
      msg('m3', conversationId, 'Buenas tardes', 'contact', new Date(now - 4800000), {
        senderName: 'Oscar Alvarez',
        status: 'read',
      }),
      msg('m4', conversationId, 'Buenas tardes, Oscar. ¿En qué podemos ayudarte?', 'agent', new Date(now - 4700000), {
        status: 'read',
      }),
      msg('m5', conversationId, 'Necesito la factura del mes pasado por favor', 'contact', new Date(now - 3600000), {
        senderName: 'Oscar Alvarez',
        status: 'read',
      }),
      msg('m6', conversationId, 'Claro, te envío el comprobante en PDF.', 'agent', new Date(now - 3500000), {
        status: 'read',
      }),
      msg('m7', conversationId, 'Factura_202602.pdf', 'agent', new Date(now - 3400000), {
        contentType: 'file',
        fileName: 'Factura_202602.pdf',
        fileSize: 245760,
        status: 'read',
      }),
      msg('m8', conversationId, 'Gracias, recibido', 'contact', new Date(now - 900000), {
        senderName: 'Oscar Alvarez',
        status: 'read',
      }),
    ];
  }

  if (conversationId === 'conv-maria') {
    return [
      msg('m1', conversationId, 'Hola, soy el encargado de la empresa y necesito ayuda con una factura pendiente.', 'contact', new Date(now - 780000), {
        senderName: 'Maria Lopez',
      }),
    ];
  }

  if (conversationId === 'conv-trans') {
    return [
      msg('m1', conversationId, 'hola que proced', 'contact', new Date(now - 3600000), {
        senderName: 'Transmeridian M',
      }),
    ];
  }

  return [];
}

const mariaLast = getMessages('conv-maria').at(-1)!;
const transLast = getMessages('conv-trans').at(-1)!;
const oscarLast = getMessages('conv-oscar').at(-1)!;

export const conversations: Conversation[] = [
  {
    id: 'conv-maria',
    inboxId: inbox.id,
    contact: {
      id: 'contact-maria',
      inboxId: inbox.id,
      name: 'Maria Lopez',
      phone: '+51 987 654 321',
      email: 'maria@email.com',
      lastSeen: new Date(now - 780000),
    },
    assignee: currentAgent,
    lastMessage: mariaLast,
    unreadCount: 0,
    priority: 'medium',
    labels: [labels[0]],
    createdAt: new Date(now - 86400000),
    updatedAt: new Date(now - 780000),
    lastMessageAt: mariaLast.createdAt,
    isTyping: false,
    channelType: 'whatsapp',
  },
  {
    id: 'conv-trans',
    inboxId: inbox.id,
    contact: {
      id: 'contact-trans',
      inboxId: inbox.id,
      name: 'Transmeridian M',
      phone: '+51 912 345 678',
      lastSeen: new Date(now - 3600000),
    },
    assignee: undefined,
    lastMessage: transLast,
    unreadCount: 0,
    priority: 'low',
    labels: [],
    createdAt: new Date(now - 172800000),
    updatedAt: new Date(now - 3600000),
    lastMessageAt: transLast.createdAt,
    isTyping: false,
    channelType: 'whatsapp',
  },
  {
    id: 'conv-oscar',
    inboxId: inbox.id,
    contact: {
      id: 'contact-oscar',
      inboxId: inbox.id,
      name: 'Oscar Alvarez',
      phone: '+51 923 111 222',
      email: 'oscar@email.com',
      lastSeen: new Date(now - 60000),
    },
    assignee: currentAgent,
    lastMessage: oscarLast,
    unreadCount: 0,
    priority: 'medium',
    labels: [labels[1]],
    createdAt: new Date(now - 259200000),
    updatedAt: new Date(now - 900000),
    lastMessageAt: oscarLast.createdAt,
    isTyping: false,
    channelType: 'whatsapp',
  },
];
