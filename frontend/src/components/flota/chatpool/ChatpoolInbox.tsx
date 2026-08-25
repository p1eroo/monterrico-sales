import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store';
import { ConversationList } from './ConversationList';
import { ChatArea } from './ChatArea';
import { ContactDetails } from './ContactDetails';
import { useChatpoolStore } from './store';
import { useFlotaWhatsappRealtime } from './useFlotaWhatsappRealtime';

/** Lista (320) + detalles (340) + chat usable (~520) — bajo esto, 3 columnas aprietan. */
const CONTACT_SIDEBAR_MIN_INBOX_WIDTH = 1180;

export function ChatpoolInbox() {
  const currentUserName = useAppStore((s) => s.currentUser.name);
  const connectionState = useChatpoolStore((s) => s.connectionState);
  const bootstrap = useChatpoolStore((s) => s.bootstrap);
  const inboxRef = useRef<HTMLDivElement>(null);
  const wasCompactRef = useRef<boolean | null>(null);

  useEffect(() => {
    void bootstrap(currentUserName);
  }, [bootstrap, currentUserName]);

  useFlotaWhatsappRealtime(connectionState === 'ready');

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;

      const state = useChatpoolStore.getState();
      if (state.lightboxMessageId) return;
      if (state.pdfViewerMessageId) return;

      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      if (document.querySelector('[role="alertdialog"][data-state="open"]')) return;
      if (document.querySelector('[data-radix-select-viewport]')) return;

      if (!state.activeConversationId) return;

      e.preventDefault();
      state.closeActiveChat();
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  // En pantallas medias/estrechas, cerrar el panel derecho para no ahogar el chat.
  // Solo actúa al entrar en modo compacto (o al montar); no pelea si el usuario lo abre a mano.
  useEffect(() => {
    const el = inboxRef.current;
    if (!el) return;

    const apply = (width: number) => {
      const compact = width < CONTACT_SIDEBAR_MIN_INBOX_WIDTH;
      const prev = wasCompactRef.current;
      wasCompactRef.current = compact;
      if (compact && prev !== true) {
        useChatpoolStore.getState().setContactSidebarOpen(false);
      }
    };

    apply(el.getBoundingClientRect().width);

    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (typeof width === 'number') apply(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={inboxRef} className="flex flex-1 min-h-0 min-w-0">
      <ConversationList />
      <div className="flex-1 flex min-w-0 relative">
        <ChatArea />
      </div>
      <ContactDetails />
    </div>
  );
}
