import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from './api';

const DEBOUNCE_MS = 400;

export type ComercialNotificationSocketPayload = {
  kind?: string;
  ts?: number;
};

/**
 * Campana Comercial: Socket.IO `/notifications`.
 * Al conectar, reconectar o recibir `crm_notification`, recarga la lista.
 */
export function subscribeComercialNotifications(
  onRefresh: (payload?: ComercialNotificationSocketPayload) => void,
): () => void {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (!token) return () => {};

  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = (payload?: ComercialNotificationSocketPayload) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => onRefresh(payload), DEBOUNCE_MS);
  };

  const socket = io(`${API_BASE}/notifications`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
  });

  socket.on('crm_notification', (payload: ComercialNotificationSocketPayload) => {
    schedule(payload);
  });
  socket.on('connect', () => {
    schedule({ kind: 'connected' });
  });

  return () => {
    if (timer) clearTimeout(timer);
    socket.disconnect();
  };
}

export function useComercialNotificationsRealtime(
  onRefresh: (payload?: ComercialNotificationSocketPayload) => void,
) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  useEffect(
    () =>
      subscribeComercialNotifications((payload) =>
        onRefreshRef.current(payload),
      ),
    [],
  );
}
