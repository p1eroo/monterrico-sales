import { Download, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface SimpleImagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  loading?: boolean;
  alt?: string;
  onDownload?: () => void;
  /** Encima de FormDialogShell (overlay z-200 / content z-201). */
  nested?: boolean;
}

const fullScreenContentClass =
  '!fixed inset-0 top-0 left-0 z-[220] flex h-[100dvh] w-[100vw] max-w-none translate-x-0 translate-y-0 items-center justify-center gap-0 border-0 bg-transparent p-0 shadow-none outline-none sm:max-w-none data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100';

export function SimpleImagePreviewDialog({
  open,
  onOpenChange,
  imageUrl,
  loading = false,
  alt = 'Vista ampliada',
  onDownload,
  nested = false,
}: SimpleImagePreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName={nested ? 'z-[219] bg-black/90' : undefined}
        className={cn(
          nested
            ? fullScreenContentClass
            : 'max-h-[90vh] max-w-[90vw] border-0 bg-black/95 p-2',
        )}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-1.5 text-white transition-colors hover:bg-white/20"
          title="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
        {onDownload ? (
          <button
            type="button"
            onClick={onDownload}
            className="absolute right-12 top-3 z-10 rounded-full bg-white/10 p-1.5 text-white transition-colors hover:bg-white/20"
            title="Descargar"
          >
            <Download className="h-5 w-5" />
          </button>
        ) : null}
        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="size-10 animate-spin text-white/70" />
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] select-none object-contain"
            draggable={false}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
