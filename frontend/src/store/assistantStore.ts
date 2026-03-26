import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AiChatAction, AiChatLink } from '@/lib/aiChatApi';

export type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  links?: AiChatLink[];
  actions?: AiChatAction[];
};

type AssistantState = {
  isOpen: boolean;
  isMinimized: boolean;
  pinned: boolean;
  messages: AssistantMessage[];
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setMinimized: (v: boolean) => void;
  setPinned: (v: boolean) => void;
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
      pinned: false,
      messages: [],
      setOpen: (open) => set({ isOpen: open }),
      toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
      setMinimized: (v) => set({ isMinimized: v }),
      setPinned: (v) => set({ pinned: v }),
      addMessage: (m) =>
        set((s) => {
          const msg: AssistantMessage = {
            id: m.id ?? crypto.randomUUID(),
            role: m.role,
            content: m.content,
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
        pinned: s.pinned,
        isOpen: s.isOpen,
        isMinimized: s.isMinimized,
      }),
    },
  ),
);
