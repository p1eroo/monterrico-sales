import { PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageList } from './MessageList';
import { ChatComposer } from './ChatComposer';
import { ImageLightbox } from './ImageLightbox';
import { useChatpoolStore } from './store';

export function ChatArea() {
  const activeConversationId = useChatpoolStore((s) => s.activeConversationId);
  const contactSidebarOpen = useChatpoolStore((s) => s.contactSidebarOpen);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background h-full relative">
      <MessageList />
      {activeConversationId && <ChatComposer />}
      <ImageLightbox />
      {!contactSidebarOpen && activeConversationId && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute right-3 top-16 z-10 h-8 w-8 shadow-sm"
          onClick={() => useChatpoolStore.getState().setContactSidebarOpen(true)}
          title="Abrir panel de contacto"
        >
          <PanelRightOpen className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
