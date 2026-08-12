import { useCallback, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { PanelRightOpen, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageList } from './MessageList';
import { ChatComposer } from './ChatComposer';
import { ImageLightbox } from './ImageLightbox';
import { useChatpoolStore } from './store';
import { getClipboardAttachmentFile, isAcceptedAttachmentFile } from './attachmentUtils';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';

export function ChatArea() {
  const activeConversationId = useChatpoolStore((s) => s.activeConversationId);
  const contactSidebarOpen = useChatpoolStore((s) => s.contactSidebarOpen);
  const connectionState = useChatpoolStore((s) => s.connectionState);
  const requestAttachFile = useChatpoolStore((s) => s.requestAttachFile);

  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const canAcceptDrop =
    Boolean(activeConversationId) && connectionState === 'ready';

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      if (!canAcceptDrop || !e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      setIsDragging(true);
    },
    [canAcceptDrop],
  );

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      if (!canAcceptDrop || !e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    [canAcceptDrop],
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);
      if (!canAcceptDrop) return;
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      if (!isAcceptedAttachmentFile(file)) {
        toast.error('Tipo de archivo no soportado');
        return;
      }
      requestAttachFile(file);
    },
    [canAcceptDrop, requestAttachFile],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (!canAcceptDrop) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('textarea') ||
        target?.closest('input') ||
        target?.isContentEditable
      ) {
        return;
      }
      const file = getClipboardAttachmentFile(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      requestAttachFile(file);
    },
    [canAcceptDrop, requestAttachFile],
  );

  return (
    <div
      className="relative flex h-full min-w-0 flex-1 flex-col bg-background"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      <MessageList />
      {activeConversationId ? <ChatComposer /> : null}
      <ImageLightbox />
      {!contactSidebarOpen && activeConversationId ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute right-3 top-16 z-10 h-8 w-8 shadow-sm"
          onClick={() => useChatpoolStore.getState().setContactSidebarOpen(true)}
          title="Abrir panel de contacto"
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
      ) : null}

      {isDragging ? (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-3',
            'border-2 border-dashed border-primary bg-background/85 backdrop-blur-[2px]',
          )}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Paperclip className="h-7 w-7" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Suelta el archivo aquí</p>
            <p className="text-xs text-muted-foreground">Imágenes, PDF, Word, Excel o audio</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
