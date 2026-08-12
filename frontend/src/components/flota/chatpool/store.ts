import { create } from 'zustand';
import {
  fetchConversations,
  fetchFlotaInstances,
  fetchFlotaProspectoMessages,
  linkWhatsappProspecto,
  markConversationAsRead,
  sendFlotaWhatsappMessage,
  deleteFlotaConversation,
  uploadFlotaAudio,
  uploadFlotaDocument,
  uploadFlotaImage,
} from '@/lib/flotaWhatsappApi';
import type { WhatsappSocketPayload } from '@/lib/whatsappApi';
import { toast } from '@/lib/notify';
import { mapFlotaConversation, mapWhatsappMessage, sortConversations } from './mappers';
import { prospectoEstadoLabel } from './prospectoEstado';
import type { Conversation, Message } from './types';
import {
  flotaProspectoCreate,
  flotaProspectoSetEstado,
  flotaProspectoSetOperador,
  flotaProspectosDeleteMany,
  getOperatorDisplayName,
  type OperadorUser,
} from '@/lib/flotaProspectosApi';
import {
  conversationPhoneKey,
  isWaConversationId,
  phoneFromWaConversationId,
  phoneKey,
  resolveCanonicalConversationId,
  waConversationId,
} from './utils';

function findConversationByPhone(conversations: Conversation[], phone?: string | null): Conversation | undefined {
  const key = phoneKey(phone);
  if (key.length < 8) return undefined;
  return conversations.find((c) => phoneKey(c.contact.phone) === key);
}

function resolveConversationTarget(
  conversations: Conversation[],
  contactId: string,
  phone?: string | null,
): { conversationId: string; conversation?: Conversation } {
  const byId = conversations.find((c) => c.id === contactId);
  if (byId) return { conversationId: byId.id, conversation: byId };

  const byPhone = findConversationByPhone(conversations, phone);

  // Socket con id de prospecto CRM: promover wa- existente al id real del prospecto.
  if (!isWaConversationId(contactId)) {
    if (byPhone) {
      return {
        conversationId: contactId,
        conversation: {
          ...byPhone,
          id: contactId,
          contact: { ...byPhone.contact, id: contactId },
          prospectoActivo: byPhone.id === contactId ? byPhone.prospectoActivo !== false : true,
          labels: byPhone.labels?.length ? byPhone.labels : [prospectoEstadoLabel(contactId, 'Nuevo')],
        },
      };
    }
    return { conversationId: contactId };
  }

  if (byPhone) return { conversationId: byPhone.id, conversation: byPhone };

  if (isWaConversationId(contactId)) return { conversationId: contactId };

  const digits = phoneKey(phone);
  if (digits.length >= 8) return { conversationId: waConversationId(digits) };

  return { conversationId: contactId };
}

function isSameConversationPhone(a: Conversation | undefined, bPhone?: string | null): boolean {
  if (!a || !bPhone) return false;
  const ak = phoneKey(a.contact.phone);
  const bk = phoneKey(bPhone);
  return ak.length >= 8 && ak === bk;
}

function mergeMessagesById(...lists: Message[][]): Message[] {
  const map = new Map<string, Message>();
  for (const list of lists) {
    for (const msg of list) map.set(msg.id, msg);
  }
  return [...map.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function mergeMessageUpdate(prev: Message, next: Message): Message {
  const fileUrl = next.fileUrl ?? prev.fileUrl;
  const attachmentUrl = next.attachmentUrl ?? prev.attachmentUrl;
  return {
    ...prev,
    ...next,
    fileUrl,
    attachmentUrl,
    attachmentId: next.attachmentId ?? prev.attachmentId,
    mimeType: next.mimeType ?? prev.mimeType,
    fileName: next.fileName ?? prev.fileName,
    fileSize: next.fileSize ?? prev.fileSize,
    contentType: next.contentType !== 'text' ? next.contentType : prev.contentType,
  };
}

function resolveMessageBucketId(activeId: string | null, resolvedId: string, isActive: boolean): string {
  if (isActive && activeId) return activeId;
  if (!isWaConversationId(resolvedId)) return resolvedId;
  return resolvedId;
}

export type AssigneeFilter = 'mine' | 'unassigned' | 'all';
export type ReadFilter = 'all' | 'unread';
export type ConnectionState = 'loading' | 'ready' | 'no-inbox' | 'disconnected';

interface ChatpoolState {
  inboxName: string;
  connectionState: ConnectionState;
  conversationsLoading: boolean;
  messagesLoading: Record<string, boolean>;
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  filterAssignee: AssigneeFilter;
  filterRead: ReadFilter;
  filterEstado: string | null;
  contactSidebarOpen: boolean;
  currentAgentName: string | null;
  lightboxMessageId: string | null;

  bootstrap: (currentAgentName?: string | null) => Promise<void>;
  refreshConversations: () => Promise<void>;
  openConversation: (id: string, opts?: { skipListRefresh?: boolean }) => Promise<void>;
  selectConversation: (id: string | null) => void;
  setFilterAssignee: (assignee: AssigneeFilter) => void;
  setFilterRead: (filter: ReadFilter) => void;
  setFilterEstado: (estado: string | null) => void;
  setContactSidebarOpen: (open: boolean) => void;
  openLightbox: (messageId: string) => void;
  closeLightbox: () => void;
  updateOperador: (prospectoId: string, operador: string | null, operadores: OperadorUser[]) => Promise<void>;
  updateEstado: (prospectoId: string, estado: string, extra?: { fechaCita?: string }) => Promise<void>;
  applyProspectoPatch: (
    prospectoId: string,
    patch: { name?: string; phone?: string | null; operador?: string | null; estado?: string },
  ) => void;
  createProspectoFromConversation: (conversationId: string) => Promise<void>;
  removeProspectoFromConversation: (prospectoId: string) => Promise<void>;
  deleteConversation: (conversationId: string, opts?: { removeProspecto?: boolean }) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  sendMediaMessage: (
    conversationId: string,
    params: {
      type: 'image' | 'audio' | 'document';
      file: File;
      caption?: string;
    },
  ) => Promise<void>;
  applySocketPayload: (payload: WhatsappSocketPayload) => void;
}

function patchConversation(
  list: Conversation[],
  prospectoId: string,
  patch: Partial<Conversation>,
): Conversation[] {
  return list.map((c) => (c.id === prospectoId ? { ...c, ...patch } : c));
}

function operadorToAssignee(operador: string) {
  const name = operador.trim();
  return { id: `op-${name}`, name, avatar: name.slice(0, 2).toUpperCase() };
}

function upsertConversation(list: Conversation[], next: Conversation): Conversation[] {
  const idx = list.findIndex((c) => c.id === next.id);
  if (idx === -1) return sortConversations([next, ...list]);
  const copy = [...list];
  copy[idx] = { ...copy[idx], ...next };
  return sortConversations(copy);
}

function mapWaStatus(status?: string | null): Message['status'] {
  if (status === 'read') return 'read';
  if (status === 'delivered') return 'delivered';
  if (status === 'sent') return 'sent';
  if (status === 'failed') return 'failed';
  return status ? 'sent' : undefined;
}

export const useChatpoolStore = create<ChatpoolState>((set, get) => ({
  inboxName: 'WhatsApp',
  connectionState: 'loading',
  conversationsLoading: true,
  messagesLoading: {},
  conversations: [],
  activeConversationId: null,
  messages: {},
  filterAssignee: 'all',
  filterRead: 'all',
  filterEstado: null,
  contactSidebarOpen: true,
  currentAgentName: null,
  lightboxMessageId: null,

  bootstrap: async (currentAgentName) => {
    set({ connectionState: 'loading', conversationsLoading: true, currentAgentName: currentAgentName ?? null });
    try {
      const instances = await fetchFlotaInstances();
      const inboxInstance = instances.find((i) => i.useForInbox);
      if (!inboxInstance) {
        set({
          connectionState: 'no-inbox',
          inboxName: 'WhatsApp',
          conversations: [],
          conversationsLoading: false,
        });
        return;
      }
      set({ inboxName: inboxInstance.instanceName || 'WhatsApp' });
      if (!inboxInstance.isConnected) {
        set({
          connectionState: 'disconnected',
          conversations: [],
          conversationsLoading: false,
        });
        return;
      }
      set({ connectionState: 'ready' });
      await get().refreshConversations();
    } catch {
      set({ connectionState: 'disconnected', conversations: [], conversationsLoading: false });
      toast.error('No se pudo cargar WhatsApp');
    }
  },

  refreshConversations: async () => {
    if (get().connectionState !== 'ready') return;
    set({ conversationsLoading: true });
    try {
      const data = await fetchConversations();
      const conversations = sortConversations(data.map(mapFlotaConversation));

      // Re-leer tras el await: evita pisar un chat recién abierto por refrescos concurrentes.
      const { activeConversationId, messages } = get();
      let nextActiveId = activeConversationId;
      let nextMessages = messages;

      const migrateMessages = (fromId: string, toId: string) => {
        if (fromId === toId) return;
        const oldMsgs = nextMessages[fromId] ?? [];
        if (!oldMsgs.length) return;
        const existing = nextMessages[toId] ?? [];
        const { [fromId]: _removed, ...rest } = nextMessages;
        nextMessages = {
          ...rest,
          [toId]: mergeMessagesById(existing, oldMsgs).map((m) => ({ ...m, conversationId: toId })),
        };
      };

      if (nextActiveId) {
        const inList = conversations.some((c) => c.id === nextActiveId);
        if (!inList) {
          const prevConv = get().conversations.find((c) => c.id === nextActiveId);
          const digits = isWaConversationId(nextActiveId)
            ? phoneFromWaConversationId(nextActiveId)
            : phoneKey(prevConv?.contact.phone);
          if (digits.length >= 8) {
            const match = conversations.find((c) => conversationPhoneKey(c) === digits);
            if (match) {
              migrateMessages(nextActiveId, match.id);
              nextActiveId = match.id;
            } else {
              nextActiveId = null;
            }
          } else {
            nextActiveId = null;
          }
        } else if (isWaConversationId(nextActiveId)) {
          const digits = phoneFromWaConversationId(nextActiveId);
          const match = conversations.find((c) => phoneKey(c.contact.phone) === digits);
          if (match && match.id !== nextActiveId) {
            migrateMessages(nextActiveId, match.id);
            nextActiveId = match.id;
          }
        }
      }

      set({
        conversations: nextActiveId
          ? conversations.map((c) => (c.id === nextActiveId ? { ...c, unreadCount: 0 } : c))
          : conversations,
        activeConversationId: nextActiveId,
        messages: nextMessages,
        conversationsLoading: false,
      });
    } catch {
      set({ conversationsLoading: false });
      toast.error('No se pudieron cargar las conversaciones');
    }
  },

  openConversation: async (id, opts) => {
    const state = get();
    const fetchId = resolveCanonicalConversationId(state.conversations, id);
    const hasCache = state.messages[id] !== undefined;

    set({
      activeConversationId: id,
      conversations: state.conversations.map((c) =>
        c.id === id || c.id === fetchId ? { ...c, unreadCount: 0 } : c,
      ),
    });

    void markConversationAsRead(fetchId).catch(() => {});

    if (!hasCache) {
      set((s) => ({ messagesLoading: { ...s.messagesLoading, [id]: true } }));
    }

    try {
      const { items } = await fetchFlotaProspectoMessages(fetchId);
      const mapped = items.map((item) => mapWhatsappMessage(item, id));
      set((s) => ({
        messages: {
          ...s.messages,
          [id]: mapped,
        },
        messagesLoading: { ...s.messagesLoading, [id]: false },
      }));
    } catch {
      set((s) => ({
        messagesLoading: { ...s.messagesLoading, [id]: false },
      }));
      if (!hasCache && get().activeConversationId === id) {
        toast.error('No se pudieron cargar los mensajes');
      }
    }
  },

  selectConversation: (id) => {
    if (id) {
      void get().openConversation(id);
    } else {
      set({ activeConversationId: null });
    }
  },

  setFilterAssignee: (assignee) => set({ filterAssignee: assignee }),
  setFilterRead: (filter) => set({ filterRead: filter }),
  setFilterEstado: (estado) => set({ filterEstado: estado }),
  setContactSidebarOpen: (open) => set({ contactSidebarOpen: open }),
  openLightbox: (messageId) => set({ lightboxMessageId: messageId }),
  closeLightbox: () => set({ lightboxMessageId: null }),

  updateOperador: async (prospectoId, operador, operadores) => {
    if (isWaConversationId(prospectoId)) {
      toast.error('Agrega el contacto al CRM antes de asignar operador');
      return;
    }
    const conv = get().conversations.find((c) => c.id === prospectoId);
    if (conv?.prospectoActivo === false) {
      toast.error('Este contacto no está en el CRM');
      return;
    }
    try {
      await flotaProspectoSetOperador(prospectoId, operador);
      const displayName = operador ? getOperatorDisplayName(operador, operadores) || operador : null;
      set((s) => ({
        conversations: patchConversation(s.conversations, prospectoId, {
          operador: displayName,
          assignee: displayName ? operadorToAssignee(displayName) : undefined,
        }),
      }));
      toast.success(displayName ? `Operador asignado: ${displayName}` : 'Operador removido');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar operador');
      throw e;
    }
  },

  updateEstado: async (prospectoId, estado, extra) => {
    if (isWaConversationId(prospectoId)) {
      toast.error('Agrega el contacto al CRM antes de cambiar estado');
      return;
    }
    const conv = get().conversations.find((c) => c.id === prospectoId);
    if (conv?.prospectoActivo === false) {
      toast.error('Este contacto no está en el CRM');
      return;
    }
    try {
      await flotaProspectoSetEstado(prospectoId, estado, extra);
      set((s) => ({
        conversations: patchConversation(s.conversations, prospectoId, {
          labels: [prospectoEstadoLabel(prospectoId, estado)],
        }),
      }));
      toast.success(`Estado actualizado a ${estado}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el estado');
      throw e;
    }
  },

  applyProspectoPatch: (prospectoId, patch) => {
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c.id !== prospectoId) return c;
        return {
          ...c,
          contact: {
            ...c.contact,
            ...(patch.name ? { name: patch.name } : {}),
            ...(patch.phone !== undefined ? { phone: patch.phone ?? undefined } : {}),
          },
          ...(patch.operador !== undefined
            ? {
                operador: patch.operador,
                assignee: patch.operador ? operadorToAssignee(patch.operador) : undefined,
              }
            : {}),
          ...(patch.estado ? { labels: [prospectoEstadoLabel(prospectoId, patch.estado)] } : {}),
        };
      }),
    }));
  },

  createProspectoFromConversation: async (conversationId) => {
    const conv = get().conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    const phoneDigits =
      conv.contact.phone?.replace(/\D/g, '') ||
      (isWaConversationId(conversationId) ? phoneFromWaConversationId(conversationId) : '');

    if (phoneDigits.length < 8) {
      toast.error('El contacto no tiene un teléfono válido');
      return;
    }

    try {
      const created = await flotaProspectoCreate({
        nombreCompleto: conv.contact.name,
        celular: phoneDigits,
      });
      await linkWhatsappProspecto(created.id, phoneDigits);

      const estado = created.estado ?? 'Nuevo';
      const oldMessages = get().messages[conversationId] ?? [];
      const remappedMessages = oldMessages.map((m) => ({ ...m, conversationId: created.id }));

      set((s) => {
        const withoutOld = s.conversations.filter((c) => c.id !== conversationId);
        const updatedConv: Conversation = {
          ...conv,
          id: created.id,
          contact: {
            ...conv.contact,
            id: created.id,
            name: created.nombreCompleto,
            phone: created.celular ?? conv.contact.phone,
          },
          prospectoActivo: true,
          operador: created.operador ?? null,
          assignee: created.operador ? operadorToAssignee(created.operador) : undefined,
          labels: [prospectoEstadoLabel(created.id, estado)],
        };

        const { [conversationId]: _removed, ...restMessages } = s.messages;

        return {
          conversations: sortConversations([...withoutOld, updatedConv]),
          activeConversationId: s.activeConversationId === conversationId ? created.id : s.activeConversationId,
          messages: { ...restMessages, [created.id]: remappedMessages },
        };
      });

      toast.success('Prospecto agregado al CRM');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear el prospecto');
      throw e;
    }
  },

  removeProspectoFromConversation: async (prospectoId) => {
    if (isWaConversationId(prospectoId)) return;

    try {
      await flotaProspectosDeleteMany([prospectoId]);
      set((s) => ({
        conversations: patchConversation(s.conversations, prospectoId, {
          prospectoActivo: false,
          labels: [],
          operador: null,
          assignee: undefined,
        }),
      }));
      toast.success('Prospecto eliminado del CRM');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar el prospecto');
      throw e;
    }
  },

  deleteConversation: async (conversationId, opts) => {
    try {
      const result = await deleteFlotaConversation(conversationId, opts);
      set((s) => {
        const phoneKey = (() => {
          const conv = s.conversations.find((c) => c.id === conversationId);
          if (conv?.contact.phone) return conv.contact.phone.replace(/\D/g, '').slice(-9);
          if (isWaConversationId(conversationId)) return phoneFromWaConversationId(conversationId);
          return '';
        })();

        const nextMessages = { ...s.messages };
        delete nextMessages[conversationId];
        if (phoneKey.length >= 8) {
          for (const [key, list] of Object.entries(nextMessages)) {
            if (isWaConversationId(key) && phoneFromWaConversationId(key) === phoneKey) {
              delete nextMessages[key];
            }
          }
        }

        const nextConversations = s.conversations.filter((c) => {
          if (c.id === conversationId) return false;
          if (phoneKey.length >= 8 && c.contact.phone?.replace(/\D/g, '').slice(-9) === phoneKey) return false;
          return true;
        });

        return {
          conversations: nextConversations,
          activeConversationId: s.activeConversationId === conversationId ? null : s.activeConversationId,
          messages: nextMessages,
        };
      });
      await get().refreshConversations();
      toast.success(
        result.removedProspecto
          ? `Chat eliminado (${result.deletedMessages} mensajes). Prospecto quitado del CRM.`
          : `Chat eliminado (${result.deletedMessages} mensajes).`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar el chat');
      throw e;
    }
  },

  sendMessage: async (conversationId, content) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const state = get();
    const optimisticId = `opt:${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      conversationId,
      content: trimmed,
      senderType: 'agent',
      senderName: state.currentAgentName ?? undefined,
      isPrivate: false,
      contentType: 'text',
      createdAt: new Date(),
      status: 'pending',
    };

    const existingConv = state.conversations.find((c) => c.id === conversationId);
    const msgs = [...(state.messages[conversationId] ?? []), optimistic];

    set({
      messages: { ...state.messages, [conversationId]: msgs },
      conversations: existingConv
        ? upsertConversation(
            state.conversations.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
            {
              ...existingConv,
              lastMessage: optimistic,
              lastMessageAt: optimistic.createdAt,
              updatedAt: optimistic.createdAt,
            },
          )
        : state.conversations,
    });

    try {
      await sendFlotaWhatsappMessage(conversationId, trimmed);
      markConversationAsRead(conversationId).catch(() => {});
    } catch (e) {
      set((s) => ({
        messages: {
          ...s.messages,
          [conversationId]: (s.messages[conversationId] ?? []).filter((m) => m.id !== optimisticId),
        },
      }));
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar el mensaje');
    }
  },

  sendMediaMessage: async (conversationId, params) => {
    const state = get();
    const optimisticId = `opt:${Date.now()}`;
    const caption = params.caption?.trim() ?? '';
    const previewUrl = params.type === 'image' ? URL.createObjectURL(params.file) : undefined;
    const contentType = params.type === 'image' ? 'image' : params.type === 'audio' ? 'audio' : 'file';

    const optimistic: Message = {
      id: optimisticId,
      conversationId,
      content: caption,
      senderType: 'agent',
      senderName: state.currentAgentName ?? undefined,
      isPrivate: false,
      contentType,
      fileName: params.file.name,
      fileSize: params.file.size,
      fileUrl: previewUrl,
      attachmentUrl: previewUrl,
      mimeType: params.file.type,
      createdAt: new Date(),
      status: 'pending',
    };

    const existingConv = state.conversations.find((c) => c.id === conversationId);
    set({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] ?? []), optimistic],
      },
      conversations: existingConv
        ? upsertConversation(
            state.conversations.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
            {
              ...existingConv,
              lastMessage: optimistic,
              lastMessageAt: optimistic.createdAt,
              updatedAt: optimistic.createdAt,
            },
          )
        : state.conversations,
    });

    try {
      let url: string;
      if (params.type === 'image') url = await uploadFlotaImage(params.file);
      else if (params.type === 'audio') url = await uploadFlotaAudio(params.file);
      else url = await uploadFlotaDocument(params.file);

      await sendFlotaWhatsappMessage(
        conversationId,
        caption,
        params.type === 'image' ? url : undefined,
        params.type === 'audio' ? url : undefined,
        params.type === 'document' ? url : undefined,
        params.type === 'document' ? params.file.name : undefined,
        params.type === 'document' ? params.file.type : undefined,
      );
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      markConversationAsRead(conversationId).catch(() => {});
    } catch (e) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      set((s) => ({
        messages: {
          ...s.messages,
          [conversationId]: (s.messages[conversationId] ?? []).filter((m) => m.id !== optimisticId),
        },
      }));
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar el archivo');
      throw e;
    }
  },

  applySocketPayload: (payload) => {
    const state = get();
    if (state.connectionState !== 'ready') return;

    if (payload.type === 'message') {
      const itemPhone =
        payload.item.direction === 'inbound'
          ? String(payload.item.fromWaId ?? '')
          : String(payload.item.toWaId ?? '');

      set((s) => {
        const { conversationId: resolvedId, conversation: existingConv } = resolveConversationTarget(
          s.conversations,
          payload.contactId,
          itemPhone,
        );
        const mapped = mapWhatsappMessage(payload.item, resolvedId);
        const activeId = s.activeConversationId;
        const activeConv = activeId ? s.conversations.find((c) => c.id === activeId) : undefined;
        const isActive =
          resolvedId === activeId ||
          isSameConversationPhone(activeConv, itemPhone) ||
          (activeId ? isSameConversationPhone(s.conversations.find((c) => c.id === activeId), itemPhone) : false);

        const bucketId = resolveMessageBucketId(activeId, resolvedId, isActive);
        const existing = s.messages[bucketId] ?? [];
        const withoutOpt = existing.filter((m) => !m.id.startsWith('opt:') || m.content !== mapped.content);
        const deduped = withoutOpt.filter((m) => m.id !== mapped.id);
        const previous = existing.find((m) => m.id === mapped.id);
        const mappedForBucket = {
          ...(previous ? mergeMessageUpdate(previous, mapped) : mapped),
          conversationId: bucketId,
        };

        if (isActive) {
          const nextMessages = [...deduped, mappedForBucket];
          nextMessages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

          const nextMessageState = { ...s.messages, [bucketId]: nextMessages };
          if (resolvedId !== bucketId) delete nextMessageState[resolvedId];

          const conv =
            existingConv ??
            s.conversations.find((c) => c.id === resolvedId) ??
            s.conversations.find((c) => c.id === bucketId) ??
            mapFlotaConversation({
              id: resolvedId,
              name: itemPhone || resolvedId,
              phone: itemPhone,
              preview: mapped.content,
              time: mapped.createdAt.toISOString(),
              direction: payload.item.direction,
              unread: 0,
              prospectoActivo: !isWaConversationId(resolvedId),
            });

          const updated: Conversation = {
            ...conv,
            id: resolvedId,
            prospectoActivo: isWaConversationId(resolvedId)
              ? Boolean(conv.prospectoActivo)
              : conv.prospectoActivo !== false,
            lastMessage: mappedForBucket,
            lastMessageAt: mappedForBucket.createdAt,
            updatedAt: mappedForBucket.createdAt,
            unreadCount: 0,
          };

          if (payload.item.direction === 'inbound') {
            markConversationAsRead(bucketId).catch(() => {});
          }

          const nextConversations = upsertConversation(
            s.conversations.filter((c) => {
              if (c.id === resolvedId || c.id === bucketId) return true;
              if (c.id === payload.contactId && payload.contactId !== resolvedId) return false;
              if (isSameConversationPhone(c, itemPhone) && c.id !== resolvedId && c.id !== bucketId) return false;
              return true;
            }),
            updated,
          );

          return {
            messages: nextMessageState,
            conversations: nextConversations,
          };
        }

        const conv =
          existingConv ??
          s.conversations.find((c) => c.id === resolvedId) ??
          mapFlotaConversation({
            id: resolvedId,
            name: itemPhone || resolvedId,
            phone: itemPhone,
            preview: mapped.content,
            time: mapped.createdAt.toISOString(),
            direction: payload.item.direction,
            unread: 1,
            prospectoActivo: !isWaConversationId(resolvedId),
          });

        const updated: Conversation = {
          ...conv,
          id: resolvedId,
          prospectoActivo: isWaConversationId(resolvedId)
            ? Boolean(conv.prospectoActivo)
            : conv.prospectoActivo !== false,
          lastMessage: mappedForBucket,
          lastMessageAt: mappedForBucket.createdAt,
          updatedAt: mappedForBucket.createdAt,
          unreadCount: conv.unreadCount + (payload.item.direction === 'inbound' ? 1 : 0),
        };

        const nextConversations = upsertConversation(
          s.conversations.filter((c) => {
            if (c.id === resolvedId) return true;
            if (c.id === payload.contactId && payload.contactId !== resolvedId) return false;
            if (isSameConversationPhone(c, itemPhone) && c.id !== resolvedId) return false;
            return true;
          }),
          updated,
        );

        return {
          messages: { ...s.messages, [resolvedId]: [...deduped, mappedForBucket] },
          conversations: nextConversations,
        };
      });

      return;
    }

    if (payload.type === 'prospecto_updated') {
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === payload.contactId
            ? { ...c, contact: { ...c.contact, name: payload.name } }
            : c,
        ),
      }));
      return;
    }

    if (payload.type === 'status') {
      set((s) => {
        let changed = false;
        const nextMessages = { ...s.messages };
        for (const [key, list] of Object.entries(s.messages)) {
          if (!list.some((m) => m.id === payload.id)) continue;
          nextMessages[key] = list.map((m) =>
            m.id === payload.id ? { ...m, status: mapWaStatus(payload.waOutboundStatus) } : m,
          );
          changed = true;
        }
        if (!changed) return s;
        return { messages: nextMessages };
      });
      return;
    }

    if (payload.type === 'delete') {
      set((s) => {
        let changed = false;
        const nextMessages = { ...s.messages };
        for (const [key, list] of Object.entries(s.messages)) {
          if (!list.some((m) => m.id === payload.messageId)) continue;
          nextMessages[key] = payload.forEveryone
            ? list.map((m) =>
                m.id === payload.messageId
                  ? {
                      ...m,
                      content: 'Este mensaje fue eliminado',
                      contentType: 'text' as const,
                      fileName: undefined,
                      fileUrl: undefined,
                    }
                  : m,
              )
            : list.filter((m) => m.id !== payload.messageId);
          changed = true;
        }
        if (!changed) return s;
        return { messages: nextMessages };
      });
    }
  },
}));
