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
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const { activeConversationId, selectConversation } = useChatpoolStore.getState();
      if (!activeConversationId) return;
      e.preventDefault();
      selectConversation(null);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
