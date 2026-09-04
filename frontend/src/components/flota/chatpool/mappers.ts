import type { FlotaConversation, FlotaMasivoProspecto } from '@/lib/flotaWhatsappApi';
import type { WhatsappMessageItem } from '@/lib/whatsappApi';
import type { Conversation, Message } from './types';
import { prospectoEstadoLabel } from './prospectoEstado';

function operadorToAssignee(operador: string) {
  const name = operador.trim();
  return {
    id: `op-${name}`,
    name,
    avatar: name.slice(0, 2).toUpperCase(),
  };
}

function mapWaStatus(status?: string | null): Message['status'] {
  if (status === 'read') return 'read';
  if (status === 'delivered') return 'delivered';
  if (status === 'sent') return 'sent';
  if (status === 'failed') return 'failed';
  return status ? 'sent' : undefined;
}

export function mapFlotaConversation(item: FlotaConversation): Conversation {
  const lastAt = item.time ? new Date(item.time) : new Date();
  const preview = item.preview?.trim() || '';
  const hasPreview = preview.length > 0;
  const prospectoActivo = item.prospectoActivo !== false;

  return {
    id: item.id,
    inboxId: 'flota-whatsapp',
    contact: {
      id: item.id,
      inboxId: 'flota-whatsapp',
      name: item.name || item.phone || 'Sin nombre',
      phone: item.phone,
      lastSeen: item.direction === 'inbound' ? lastAt : undefined,
    },
    assignee: prospectoActivo && item.operador ? operadorToAssignee(item.operador) : undefined,
    operador: prospectoActivo ? (item.operador ?? null) : null,
    lastMessage: hasPreview
      ? {
          id: `preview-${item.id}`,
          conversationId: item.id,
          content: preview,
          senderType: item.direction === 'outbound' ? 'agent' : 'contact',
          senderName: item.lastSender,
          isPrivate: false,
          contentType: 'text',
          createdAt: lastAt,
        }
      : null,
    unreadCount: item.unread ?? 0,
    priority: 'none',
    labels:
      prospectoActivo && item.estado
        ? [{ id: `est-${item.id}`, name: item.estado, color: 'blue', inboxId: 'flota-whatsapp' }]
        : [],
    createdAt: lastAt,
    updatedAt: lastAt,
    lastMessageAt: lastAt,
    isTyping: false,
    channelType: 'whatsapp',
    prospectoActivo,
    fechaCita: prospectoActivo ? (item.fechaCita ?? null) : null,
    asistencia: prospectoActivo ? (item.asistencia ?? null) : null,
  };
}

export function mapWhatsappMessage(item: WhatsappMessageItem, conversationId: string): Message {
  const attachment = item.attachments?.[0];
  let contentType: Message['contentType'] = 'text';
  let content = item.body?.trim() || '';
  let fileName: string | undefined;
  let fileSize: number | undefined;
  let fileUrl: string | undefined;

  if (attachment) {
    if (attachment.mediaType === 'image') contentType = 'image';
    else if (attachment.mediaType === 'audio') contentType = 'audio';
    else contentType = 'file';
    fileName = attachment.name;
    fileSize = attachment.size;
    fileUrl = attachment.proxyUrl || attachment.downloadUrl || attachment.url || undefined;
    // No usar el nombre de archivo como body en audio/imagen (evita "audio-enviado.mp3" bajo el player)
    if (!content && fileName && contentType === 'file') content = fileName;
    if (!content && contentType === 'audio') content = '[Audio]';
    if (!content && contentType === 'image') content = '[Imagen]';
  }

  const resolvedUrl = fileUrl ? fileUrl : undefined;

  const senderName =
    item.direction === 'outbound'
      ? item.senderName?.trim() ||
        (item as { createdBy?: { name?: string | null } }).createdBy?.name?.trim() ||
        undefined
      : undefined;

  if (content === 'Este mensaje fue eliminado') {
    return {
      id: item.id,
      conversationId,
      content,
      senderType: item.direction === 'outbound' ? 'agent' : 'contact',
      senderName,
      isPrivate: false,
      contentType: 'text',
      createdAt: new Date(item.createdAt),
    };
  }

  return {
    id: item.id,
    conversationId,
    content,
    senderType: item.direction === 'outbound' ? 'agent' : 'contact',
    senderName,
    isPrivate: false,
    contentType,
    fileName,
    fileSize,
    fileUrl: resolvedUrl,
    attachmentUrl: resolvedUrl,
    attachmentId: attachment?.id,
    mimeType: attachment?.mimeType,
    durationSeconds: attachment?.durationSeconds ?? null,
    createdAt: new Date(item.createdAt),
    status: item.direction === 'outbound' ? mapWaStatus(item.waOutboundStatus) : 'read',
  };
}

export function mapProspectoToConversation(prospecto: FlotaMasivoProspecto): Conversation {
  const phone = prospecto.celular || '';
  const now = new Date();

  return {
    id: prospecto.id,
    inboxId: 'flota-whatsapp',
    contact: {
      id: prospecto.id,
      inboxId: 'flota-whatsapp',
      name: prospecto.nombreCompleto?.trim() || phone || 'Sin nombre',
      phone: phone || undefined,
    },
    assignee: prospecto.operador ? operadorToAssignee(prospecto.operador) : undefined,
    operador: prospecto.operador,
    lastMessage: null,
    unreadCount: 0,
    priority: 'none',
    labels: prospecto.estado ? [prospectoEstadoLabel(prospecto.id, prospecto.estado)] : [],
    createdAt: now,
    updatedAt: now,
    lastMessageAt: null,
    isTyping: false,
    channelType: 'whatsapp',
    prospectoActivo: true,
  };
}

export function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    const ta = (a.lastMessageAt ?? a.updatedAt).getTime();
    const tb = (b.lastMessageAt ?? b.updatedAt).getTime();
    return tb - ta;
  });
}
