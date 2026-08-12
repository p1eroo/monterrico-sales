import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { downloadWhatsappAttachment } from '@/lib/whatsappApi';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { useChatpoolStore } from './store';
import { resolveAttachmentUrl } from './utils';
import type { Message } from './types';

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

function getImageFileName(message: Message): string {
  return message.fileName || message.content || 'Imagen';
}

function getImageUrl(message: Message): string {
  return resolveAttachmentUrl(message.fileUrl ?? message.attachmentUrl);
}

export function ImageLightbox() {
  const lightboxMessageId = useChatpoolStore((s) => s.lightboxMessageId);
  const closeLightbox = useChatpoolStore((s) => s.closeLightbox);
  const openLightbox = useChatpoolStore((s) => s.openLightbox);
  const activeConversationId = useChatpoolStore((s) => s.activeConversationId);
  const allMessages = useChatpoolStore((s) => s.messages);

  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const imageMessages = useMemo(() => {
    if (!activeConversationId) return [];
    return (allMessages[activeConversationId] ?? []).filter((message) => {
      if (message.contentType !== 'image') return false;
      return getImageUrl(message).length > 0;
    });
  }, [activeConversationId, allMessages]);

  const currentIndex = useMemo(() => {
    if (!lightboxMessageId) return -1;
    return imageMessages.findIndex((message) => message.id === lightboxMessageId);
  }, [imageMessages, lightboxMessageId]);

  const currentMessage = currentIndex >= 0 ? imageMessages[currentIndex] : null;
  const currentUrl = currentMessage ? getImageUrl(currentMessage) : '';

  useEffect(() => {
    setScale(1);
    setRotation(0);
  }, [lightboxMessageId]);

  useEffect(() => {
    if (!lightboxMessageId) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLightbox();
        return;
      }
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        openLightbox(imageMessages[currentIndex - 1].id);
      }
      if (e.key === 'ArrowRight' && currentIndex < imageMessages.length - 1) {
        openLightbox(imageMessages[currentIndex + 1].id);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [lightboxMessageId, closeLightbox, currentIndex, imageMessages, openLightbox]);

  if (!lightboxMessageId || !currentMessage || !currentUrl) return null;

  const fileName = getImageFileName(currentMessage);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < imageMessages.length - 1;

  const goPrev = () => {
    if (!hasPrev) return;
    openLightbox(imageMessages[currentIndex - 1].id);
  };

  const goNext = () => {
    if (!hasNext) return;
    openLightbox(imageMessages[currentIndex + 1].id);
  };

  const handleDownload = () => {
    if (downloading) return;
    setDownloading(true);
    void downloadWhatsappAttachment({
      id: currentMessage.attachmentId ?? currentMessage.id,
      name: fileName,
      url: currentUrl,
    })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'No se pudo descargar la imagen');
      })
      .finally(() => setDownloading(false));
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] animate-in fade-in bg-black/70 backdrop-blur-md">
      <div className="absolute inset-x-0 top-0 z-10 flex h-12 items-center justify-center border-b border-white/10 bg-black/45 px-14">
        <p className="max-w-[50%] truncate text-sm text-white/90">{fileName}</p>

        <div className="absolute right-3 flex items-center gap-0.5">
          <ToolbarButton
            title="Acercar"
            onClick={() => setScale((value) => Math.min(MAX_SCALE, value + SCALE_STEP))}
          >
            <ZoomIn className="h-[18px] w-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            title="Alejar"
            onClick={() => setScale((value) => Math.max(MIN_SCALE, value - SCALE_STEP))}
          >
            <ZoomOut className="h-[18px] w-[18px]" />
          </ToolbarButton>
          <ToolbarButton title="Girar a la izquierda" onClick={() => setRotation((value) => value - 90)}>
            <RotateCcw className="h-[18px] w-[18px]" />
          </ToolbarButton>
          <ToolbarButton title="Girar a la derecha" onClick={() => setRotation((value) => value + 90)}>
            <RotateCw className="h-[18px] w-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            title={downloading ? 'Descargando…' : 'Descargar'}
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin" />
            ) : (
              <Download className="h-[18px] w-[18px]" />
            )}
          </ToolbarButton>
          <ToolbarButton title="Cerrar" onClick={closeLightbox}>
            <X className="h-[18px] w-[18px]" />
          </ToolbarButton>
        </div>
      </div>

      {hasPrev ? (
        <button
          type="button"
          onClick={goPrev}
          className="absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/90 transition-colors hover:bg-black/70"
          title="Imagen anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : null}

      {hasNext ? (
        <button
          type="button"
          onClick={goNext}
          className="absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/90 transition-colors hover:bg-black/70"
          title="Imagen siguiente"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      ) : null}

      <div className="flex h-full items-center justify-center px-16 pb-16 pt-12">
        <img
          src={currentUrl}
          alt={fileName}
          className="max-h-full max-w-full object-contain transition-transform duration-200 ease-out select-none"
          style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}
          draggable={false}
        />
      </div>

      {imageMessages.length > 1 ? (
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs tabular-nums text-white/90">
          {currentIndex + 1} / {imageMessages.length}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function ToolbarButton({
  children,
  title,
  onClick,
  disabled,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/10 hover:text-white',
        disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
      )}
    >
      {children}
    </button>
  );
}
