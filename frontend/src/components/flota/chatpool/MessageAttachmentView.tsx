import { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveAttachmentUrl } from './utils';
import { FileAttachmentCard } from './FileAttachmentCard';
import { PdfAttachmentCard } from './PdfAttachmentCard';
import { AudioMessageContent } from './AudioMessageContent';
import { isPdfFile } from './pdfUtils';
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
  const [imgError, setImgError] = useState(false);
  const src = resolveAttachmentUrl(message.fileUrl ?? message.attachmentUrl);

  useEffect(() => {
    setImgError(false);
  }, [src, message.id]);

  if (message.contentType === 'audio') {
    return (
      <AudioMessageContent
        src={src}
        isAgent={isAgent}
        durationSeconds={message.durationSeconds}
      />
    );
  }

  if (message.contentType === 'image' && src && !imgError) {
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
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
          isAgent ? 'text-white/80' : 'text-muted-foreground',
        )}
      >
        <ImageIcon className="h-4 w-4 shrink-0" />
        <span className="truncate">{message.fileName ?? 'Imagen no disponible'}</span>
      </div>
    );
  }

  const fileName = message.fileName ?? message.content ?? 'archivo';
  const variant = isAgent ? 'outgoing' : 'incoming';

  if (isPdfFile(fileName, message.mimeType)) {
    return (
      <PdfAttachmentCard
        messageId={message.id}
        fileName={fileName}
        fileSize={message.fileSize}
        fileUrl={src || undefined}
        attachmentId={message.attachmentId ?? message.id}
        variant={variant}
      />
    );
  }

  return (
    <FileAttachmentCard
      fileName={fileName}
      fileSize={message.fileSize}
      fileUrl={src || undefined}
      attachmentUrl={src || undefined}
      attachmentId={message.attachmentId ?? message.id}
      variant={variant}
    />
  );
}
