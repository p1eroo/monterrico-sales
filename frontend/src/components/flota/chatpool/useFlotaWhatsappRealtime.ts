import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '@/lib/api';
import type { WhatsappSocketPayload } from '@/lib/whatsappApi';
import { useChatpoolStore } from './store';

export function useFlotaWhatsappRealtime(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) return;

    const socket = io(`${API_BASE}/whatsapp`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      void useChatpoolStore.getState().refreshConversations();
    });

    socket.on('whatsapp', (payload: WhatsappSocketPayload) => {
      useChatpoolStore.getState().applySocketPayload(payload);
    });

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void useChatpoolStore.getState().refreshConversations();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      socket.disconnect();
    };
  }, [enabled]);
}
