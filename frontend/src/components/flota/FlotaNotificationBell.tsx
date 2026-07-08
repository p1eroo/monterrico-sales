import { useState, useEffect } from 'react';
import { MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchUnreadSummary } from '@/lib/chatwootApi';
import ChatwootInboxPanel from '@/components/flota/ChatwootInboxPanel';

export default function FlotaNotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);

  const refresh = async () => {
    try {
      const summary = await fetchUnreadSummary();
      setUnreadCount(summary.totalUnread);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

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
        onOpenChange={setPanelOpen}
      />
    </>
  );
}
