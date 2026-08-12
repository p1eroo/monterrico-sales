import { Plus, X } from 'lucide-react';
import { FileAttachmentCard } from './FileAttachmentCard';
import { MAX_PENDING_IMAGES } from './attachmentUtils';
import { cn } from '@/lib/utils';

export interface ComposerPendingAttachment {
  id: string;
  file: File;
  url: string;
}

interface ComposerPendingAttachmentsProps {
  attachments: ComposerPendingAttachment[];
  onRemove: (id: string) => void;
  onAddImages: () => void;
}

export function ComposerPendingAttachments({
  attachments,
  onRemove,
  onAddImages,
}: ComposerPendingAttachmentsProps) {
  if (attachments.length === 0) return null;

  const allImages = attachments.every((item) => item.file.type.startsWith('image/'));
  const canAddMore = allImages && attachments.length < MAX_PENDING_IMAGES;

  if (!allImages) {
    const item = attachments[0];
    return (
      <div className="mb-2 px-1">
        <FileAttachmentCard
          fileName={item.file.name}
          fileSize={item.file.size}
          variant="composer"
          onRemove={() => onRemove(item.id)}
        />
      </div>
    );
  }

  return (
    <div className="mb-2 px-1">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {attachments.map((item) => (
          <div key={item.id} className="relative shrink-0">
            <div className="overflow-hidden rounded-xl border border-border">
              <img
                src={item.url}
                alt={item.file.name}
                className="h-24 w-24 object-cover"
                draggable={false}
              />
            </div>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
              title="Quitar imagen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {canAddMore ? (
          <button
            type="button"
            onClick={onAddImages}
            className={cn(
              'flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border',
              'bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            )}
            title="Agregar más imágenes"
          >
            <Plus className="h-5 w-5" />
            <span className="text-[10px] tabular-nums">
              {attachments.length}/{MAX_PENDING_IMAGES}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
