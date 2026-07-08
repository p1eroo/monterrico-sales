import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from './api';

const CHANNEL = 'flota-prospectos';

/** Avisa a otras pestañas del mismo navegador que recarguen prospectos. */
export function notifyFlotaProspectosRefresh() {
  try {
    new BroadcastChannel(CHANNEL).postMessage({ type: 'refresh' });
  } catch {
    /* BroadcastChannel no soportado */
  }
}

/** Escucha cambios vía BroadcastChannel, Socket.IO y al volver a la pestaña. */
export function subscribeFlotaProspectosRefresh(onRefresh: () => void): () => void {
  const cleanups: (() => void)[] = [];

  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = (event) => {
      if (event.data?.type === 'refresh') onRefresh();
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
    socket.on('flota_prospecto', () => onRefresh());
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

export function useFlotaProspectosRealtime(onRefresh: () => void) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  useEffect(
    () => subscribeFlotaProspectosRefresh(() => onRefreshRef.current()),
    [],
  );
}
