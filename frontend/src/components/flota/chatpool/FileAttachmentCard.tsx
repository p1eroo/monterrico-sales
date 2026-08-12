import { Download, Loader2, Paperclip, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadWhatsappAttachment } from '@/lib/whatsappApi';
import { toast } from '@/lib/notify';
import { useState } from 'react';
import {
  getFileTypeBadgeStyle,
  getFileTypeLabel,
  splitFileName,
  usesPaperclipIcon,
} from './fileUtils';
import { formatFileSize } from './utils';

interface FileAttachmentCardProps {
  fileName: string;
  fileSize?: number;
  fileUrl?: string;
  attachmentUrl?: string;
  attachmentId?: string;
  variant?: 'outgoing' | 'incoming' | 'composer';
  onRemove?: () => void;
}

export function FileAttachmentCard({
  fileName,
  fileSize,
  fileUrl,
  attachmentUrl,
  attachmentId,
  variant = 'outgoing',
  onRemove,
}: FileAttachmentCardProps) {
  const { base, extension } = splitFileName(fileName);
  const typeLabel = getFileTypeLabel(extension);
  const typeBadge = getFileTypeBadgeStyle(extension, variant === 'outgoing');
  const isOutgoing = variant === 'outgoing';
  const showPaperclip = usesPaperclipIcon(extension);
  const canDownload = Boolean(fileUrl || attachmentUrl);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!fileUrl && !attachmentUrl) return;
    setDownloading(true);
    try {
      await downloadWhatsappAttachment({
        id: attachmentId ?? fileName,
        name: fileName,
        url: (fileUrl || attachmentUrl)!,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo descargar');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3.5 py-3 min-w-[248px] max-w-[300px]',
        variant === 'outgoing' && 'bg-transparent border-white/25',
        (variant === 'incoming' || variant === 'composer') && 'bg-card border-border',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          showPaperclip
            ? isOutgoing
              ? 'bg-white/12'
              : 'bg-muted'
            : cn('text-[10px] font-bold tracking-wide', typeBadge.badge),
          !showPaperclip && isOutgoing && !extension && 'bg-white/12 text-white/90',
        )}
        title={typeLabel}
      >
        {showPaperclip ? (
          <Paperclip
            className={cn('h-[18px] w-[18px]', isOutgoing ? 'text-emerald-100' : 'text-muted-foreground')}
            strokeWidth={1.75}
          />
        ) : (
          typeBadge.label
        )}
      </div>

      <div className="min-w-0 flex-1 pr-1">
        <div
          className={cn(
            'flex min-w-0 items-baseline text-[13px] leading-snug',
            isOutgoing ? 'text-white/95' : 'text-foreground',
          )}
        >
          <span className="truncate">{base || fileName}</span>
          {extension ? <span className="shrink-0">.{extension}</span> : null}
        </div>
        <p className={cn('mt-0.5 text-[11px] leading-none', isOutgoing ? 'text-white/50' : 'text-muted-foreground')}>
          {typeLabel}
          {fileSize !== undefined ? ` · ${formatFileSize(fileSize)}` : ''}
        </p>
      </div>

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
            isOutgoing ? 'text-white/50 hover:text-white/90' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          title="Quitar archivo"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={!canDownload || downloading}
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-35',
            isOutgoing ? 'text-white/55 hover:text-white/90' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          title="Descargar"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-[17px] w-[17px]" strokeWidth={1.75} />
          )}
        </button>
      )}
    </div>
  );
}
