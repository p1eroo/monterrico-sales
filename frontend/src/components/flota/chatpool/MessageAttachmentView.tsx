import { useEffect, useState, type MouseEvent } from 'react';
import { Download, FileText, ImageIcon, Loader2, Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadWhatsappAttachment } from '@/lib/whatsappApi';
import { toast } from '@/lib/notify';
import { formatFileSize, resolveAttachmentUrl } from './utils';
import type { Message } from './types';

interface MessageAttachmentViewProps {
  message: Message;
  isAgent: boolean;
  onImageClick?: (messageId: string) => void;
  compact?: boolean;
}

export function MessageAttachmentView({
  message,
  isAgent,
  onImageClick,
  compact = false,
}: MessageAttachmentViewProps) {
  const [downloading, setDownloading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const src = resolveAttachmentUrl(message.fileUrl ?? message.attachmentUrl);

  useEffect(() => {
    setImgError(false);
  }, [src, message.id]);

  async function handleDownload(e?: MouseEvent) {
    e?.stopPropagation();
    if (downloading || !src) return;
    setDownloading(true);
    try {
      await downloadWhatsappAttachment({
        id: message.attachmentId ?? message.id,
        name: message.fileName ?? 'archivo',
        url: src,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo descargar');
    } finally {
      setDownloading(false);
    }
  }

  if (!src) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
          isAgent ? 'bg-black/10 text-white/80' : 'bg-black/5 text-muted-foreground',
        )}
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate">{message.fileName ?? 'Archivo no disponible'}</span>
      </div>
    );
  }

  if (message.contentType === 'image' && !imgError) {
    const fileName = message.fileName || message.content || 'Imagen';

    return (
      <button
        type="button"
        onClick={() => onImageClick?.(message.id)}
        className={cn(
          'block overflow-hidden rounded-lg transition-opacity',
          compact ? 'max-w-[160px]' : 'max-w-[220px]',
          onImageClick ? 'cursor-pointer hover:opacity-95' : 'cursor-default',
          isAgent ? 'ring-1 ring-white/20' : 'ring-1 ring-border',
        )}
        title="Ver imagen"
      >
        <img
          key={src}
          src={src}
          alt={fileName}
          onError={() => setImgError(true)}
          className={cn(
            'aspect-[4/3] w-full bg-muted object-cover',
            compact ? 'max-w-[160px]' : 'max-w-[220px]',
          )}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </button>
    );
  }

  if (message.contentType === 'image' && imgError) {
    return (
      <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-xs', isAgent ? 'text-white/80' : 'text-muted-foreground')}>
        <ImageIcon className="h-4 w-4 shrink-0" />
        <span className="truncate">{message.fileName ?? 'Imagen no disponible'}</span>
      </div>
    );
  }

  if (message.contentType === 'audio') {
    return (
      <div className={cn('rounded-lg px-3 py-2', isAgent ? 'bg-black/10' : 'bg-black/5')}>
        <div className={cn('mb-2 flex items-center gap-2 text-xs', isAgent ? 'text-white/80' : 'text-muted-foreground')}>
          <Music2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{message.fileName ?? 'Audio'}</span>
        </div>
        <audio controls preload="metadata" className="w-full max-w-[240px]" src={src} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleDownload()}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition',
        isAgent ? 'bg-black/10 text-white hover:bg-black/20' : 'bg-black/5 text-foreground hover:bg-black/10',
      )}
    >
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', isAgent ? 'bg-white/20' : 'bg-background')}>
        <FileText className={cn('h-5 w-5', isAgent ? 'text-white' : 'text-muted-foreground')} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{message.fileName ?? message.content}</p>
        {message.fileSize ? (
          <p className={cn('text-xs', isAgent ? 'text-white/70' : 'text-muted-foreground')}>
            {formatFileSize(message.fileSize)}
          </p>
        ) : null}
      </div>
      {downloading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Download className="h-4 w-4 shrink-0" />}
    </button>
  );
}
