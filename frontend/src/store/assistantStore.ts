import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AiChatAction, AiChatLink } from '@/lib/aiChatApi';

export type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  /** Texto enviado al modelo (puede incluir archivos adjuntos en bloque). */
  content: string;
  /** Texto visible en burbuja (p. ej. solo la pregunta si `content` lleva adjuntos). */
  displayContent?: string;
  createdAt: number;
  links?: AiChatLink[];
  actions?: AiChatAction[];
};

type AssistantState = {
  isOpen: boolean;
  isMinimized: boolean;
  /** Panel ancho tipo “ampliar chat”. */
  chatPanelExpanded: boolean;
  /** Hilo activo en servidor (multi-chat). */
  activeConversationId: string | null;
  messages: AssistantMessage[];
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setMinimized: (v: boolean) => void;
  setChatPanelExpanded: (v: boolean) => void;
  setActiveConversationId: (id: string | null) => void;
  addMessage: (m: Omit<AssistantMessage, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => void;
  /** Reemplaza el hilo (p. ej. hidratación desde el servidor). */
  hydrateMessages: (messages: AssistantMessage[]) => void;
  clearMessages: () => void;
};

const MAX_MESSAGES = 40;

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set) => ({
      isOpen: false,
      isMinimized: false,
      chatPanelExpanded: false,
      activeConversationId: null,
      messages: [],
      setOpen: (open) => set({ isOpen: open }),
      toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
      setMinimized: (v) => set({ isMinimized: v }),
      setChatPanelExpanded: (v) => set({ chatPanelExpanded: v }),
      setActiveConversationId: (id) => set({ activeConversationId: id }),
      addMessage: (m) =>
        set((s) => {
          const msg: AssistantMessage = {
            id: m.id ?? crypto.randomUUID(),
            role: m.role,
            content: m.content,
            displayContent: m.displayContent,
            createdAt: m.createdAt ?? Date.now(),
            links: m.links,
            actions: m.actions,
          };
          const next = [...s.messages, msg];
          return {
            messages:
              next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next,
          };
        }),
      hydrateMessages: (messages) =>
        set({
          messages:
            messages.length > MAX_MESSAGES
              ? messages.slice(-MAX_MESSAGES)
              : messages,
        }),
      clearMessages: () => set({ messages: [] }),
    }),
    {
      name: 'crm-ai-assistant',
      partialize: (s) => ({
        messages: s.messages,
        isOpen: s.isOpen,
        isMinimized: s.isMinimized,
        chatPanelExpanded: s.chatPanelExpanded,
        activeConversationId: s.activeConversationId,
      }),
    },
  ),
);
