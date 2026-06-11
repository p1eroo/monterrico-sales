import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { API_BASE } from '@/lib/api';
import { fetchConversations, type FlotaConversation } from '@/lib/flotaWhatsappApi';

export default function FlotaNotificationBell() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<FlotaConversation[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const list = await fetchConversations();
      setConversations(list.filter((c) => c.unread > 0).slice(0, 10));
      setUnreadCount(list.reduce((sum, c) => sum + c.unread, 0));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Socket en tiempo real
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) return;
    const socket = io(`${API_BASE}/whatsapp`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socket.on('connect', () => void refresh());
    socket.on('whatsapp', () => void refresh());
    return () => { socket.disconnect(); };
  }, [refresh]);

  // Polling + visibilidad + BroadcastChannel
  useEffect(() => {
    void refresh();
    const interval = setInterval(refresh, 30000);
    const onVis = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVis);
    try {
      const bc = new BroadcastChannel("flota-notificaciones");
      bc.onmessage = () => void refresh();
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', onVis);
        bc.close();
      };
    } catch {
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', onVis);
      };
    }
  }, [refresh]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Mensajes de WhatsApp">
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
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="p-3 border-b border-border">
          <p className="text-sm font-semibold">Mensajes sin leer</p>
          <p className="text-xs text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} mensaje${unreadCount !== 1 ? 's' : ''} sin leer`
              : 'No hay mensajes nuevos'}
          </p>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No hay mensajes sin leer
            </div>
          ) : (
            <div className="divide-y divide-border">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    navigate(`/flota/prospectos?chat=${c.id}`);
                  }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.preview || c.phone}</p>
                  </div>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {c.unread}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
