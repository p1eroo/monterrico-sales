import { useEffect } from 'react';
import { useAppStore } from '@/store';
import { ConversationList } from './ConversationList';
import { ChatArea } from './ChatArea';
import { ContactDetails } from './ContactDetails';
import { useChatpoolStore } from './store';
import { useFlotaWhatsappRealtime } from './useFlotaWhatsappRealtime';

export function ChatpoolInbox() {
  const currentUserName = useAppStore((s) => s.currentUser.name);
  const connectionState = useChatpoolStore((s) => s.connectionState);
  const bootstrap = useChatpoolStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap(currentUserName);
  }, [bootstrap, currentUserName]);

  useFlotaWhatsappRealtime(connectionState === 'ready');

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;

      const state = useChatpoolStore.getState();
      if (state.lightboxMessageId) return;

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

  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      <ConversationList />
      <div className="flex-1 flex min-w-0 relative">
        <ChatArea />
      </div>
      <ContactDetails />
    </div>
  );
}
