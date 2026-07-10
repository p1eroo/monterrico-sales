import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_BASE } from '@/lib/api';
import { fetchUnreadSummary, CHATWOOT_MESSAGE_TYPE } from '@/lib/chatwootApi';
import { CHATWOOT_UNREAD_CHANGED } from '@/lib/chatwootUnreadEvents';
import ChatwootInboxPanel from '@/components/flota/ChatwootInboxPanel';

const POLL_MS = 90_000;
const REFRESH_DEBOUNCE_MS = 600;

export default function FlotaNotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const refreshInFlightRef = useRef(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async (force = false) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const summary = await fetchUnreadSummary({ force });
      setUnreadCount(summary.conversationCount);
    } catch {
      // silently fail
    } finally {
      refreshInFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  const scheduleRefresh = useCallback((force = true) => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      void refresh(force);
    }, REFRESH_DEBOUNCE_MS);
  }, [refresh]);

  useEffect(() => {
    void refresh(false);
    const interval = setInterval(() => void refresh(false), POLL_MS);
    return () => {
      clearInterval(interval);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, [refresh]);

  useEffect(() => {
    const onUnreadChanged = () => scheduleRefresh(true);
    window.addEventListener(CHATWOOT_UNREAD_CHANGED, onUnreadChanged);
    return () => window.removeEventListener(CHATWOOT_UNREAD_CHANGED, onUnreadChanged);
  }, [scheduleRefresh]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) return;

    const socket = io(`${API_BASE}/chatwoot`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('chatwoot', (payload: { event: string; data?: { message?: { message_type?: number | string; sender?: { type?: string } } } }) => {
      if (payload.event !== 'message_created') return;
      const msg = payload.data?.message;
      if (!msg) return;
      const isIncoming =
        msg.message_type === CHATWOOT_MESSAGE_TYPE.INCOMING
        || msg.message_type === 'incoming'
        || msg.sender?.type === 'contact';
      if (isIncoming) {
        scheduleRefresh(true);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [scheduleRefresh]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        title="Mensajes Chatwoot"
        onClick={() => setPanelOpen(true)}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <MessageCircle className="size-4" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>
      <ChatwootInboxPanel
        open={panelOpen}
        onOpenChange={(open) => {
          setPanelOpen(open);
          if (!open) void refresh(true);
        }}
      />
    </>
  );
}
