import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from './api';

const CHANNEL = 'flota-prospectos';

export type FlotaProspectosRefreshEvent = {
  type: 'refresh';
  prospectoId?: string;
};

/** Avisa al navegador (misma pestaña y otras) que recarguen prospectos. */
export function notifyFlotaProspectosRefresh(prospectoId?: string) {
  const payload: FlotaProspectosRefreshEvent = { type: 'refresh', prospectoId };
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage(payload);
    bc.close();
  } catch {
    /* BroadcastChannel no soportado */
  }
}

export type FlotaProspectosRefreshHandler = (
  event?: FlotaProspectosRefreshEvent,
) => void;

/** Escucha cambios vía BroadcastChannel, Socket.IO y al volver a la pestaña. */
export function subscribeFlotaProspectosRefresh(
  onRefresh: FlotaProspectosRefreshHandler,
): () => void {
  const cleanups: (() => void)[] = [];

  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = (event) => {
      if (event.data?.type === 'refresh') {
        onRefresh(event.data as FlotaProspectosRefreshEvent);
      }
    };
    cleanups.push(() => bc.close());
  } catch {
    /* BroadcastChannel no soportado */
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (token) {
    const socket = io(`${API_BASE}/flota-prospectos`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socket.on('flota_prospecto', (payload: { prospectoId?: string }) => {
      onRefresh({ type: 'refresh', prospectoId: payload?.prospectoId });
    });
    cleanups.push(() => {
      socket.disconnect();
    });
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') onRefresh();
  };
  document.addEventListener('visibilitychange', onVisible);
  cleanups.push(() => document.removeEventListener('visibilitychange', onVisible));

  return () => {
    for (const fn of cleanups) fn();
  };
}

export function useFlotaProspectosRealtime(onRefresh: FlotaProspectosRefreshHandler) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  useEffect(
    () => subscribeFlotaProspectosRefresh((event) => onRefreshRef.current(event)),
    [],
  );
}
