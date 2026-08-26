import { useMemo, useEffect, useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, Loader2, X } from 'lucide-react';
import {
  formDialogNestedContentClass,
  formDialogNestedOverlayClass,
} from '@/components/ui/form-dialog';
import { SimpleImagePreviewDialog } from '@/components/shared/SimpleImagePreviewDialog';
import { cn } from '@/lib/utils';
import { FileTypeIcon } from './FileTypeIcon';
import type { FileAttachment } from '@/types';
import { fetchFileContentBlobUrl } from '@/lib/fileApi';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function looksLikePdf(file: FileAttachment): boolean {
  const mime = (file.mimeType || '').toLowerCase();
  if (mime === 'application/pdf' || mime === 'application/x-pdf') return true;
  if (mime.includes('pdf')) return true;
  return file.name.trim().toLowerCase().endsWith('.pdf');
}

function looksLikeImage(file: FileAttachment): boolean {
  if (looksLikePdf(file)) return false;
  const mime = file.mimeType || '';
  return mime.startsWith('image/');
}

interface FilePreviewModalProps {
  file: FileAttachment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload?: (file: FileAttachment) => void;
  onNavigateToEntity?: (file: FileAttachment) => void;
  fetchBlobUrl?: (fileId: string, disposition: string) => Promise<string>;
  nested?: boolean;
  overlayClassName?: string;
  contentClassName?: string;
}

export function FilePreviewModal({
  file,
  open,
  onOpenChange,
  onDownload,
  onNavigateToEntity,
  fetchBlobUrl,
  nested = false,
  overlayClassName,
  contentClassName,
}: FilePreviewModalProps) {
  const isImage = useMemo(
    () => (file ? looksLikeImage(file) : false),
    [file],
  );
  const isPdf = useMemo(() => (file ? looksLikePdf(file) : false), [file]);
  const canPreview = isImage || isPdf;

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !file || !canPreview) {
      setPreviewUrl((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    let blobUrl: string | null = null;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    const fetcher = fetchBlobUrl || fetchFileContentBlobUrl;
    void fetcher(file.id, 'inline')
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        blobUrl = url;
        setPreviewUrl(url);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setPreviewError(e instanceof Error ? e.message : 'No se pudo cargar la vista previa');
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
      if (blobUrl?.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
    };
  }, [open, file?.id, file?.mimeType, canPreview, fetchBlobUrl, file]);

  if (!file) return null;

  const handleDownload = () => {
    void onDownload?.(file);
  };

  const isEmbedded = nested;
  const metaLine = [
    formatFileSize(file.size),
    file.uploadedByName,
    new Date(file.uploadedAt).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
  ]
    .filter(Boolean)
    .join(' · ');

  if (isImage) {
    return (
      <SimpleImagePreviewDialog
        open={open}
        onOpenChange={onOpenChange}
        imageUrl={previewUrl}
        loading={previewLoading}
        alt={file.name}
        onDownload={onDownload ? handleDownload : undefined}
        nested={nested}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName={
          overlayClassName ?? (isEmbedded ? formDialogNestedOverlayClass : undefined)
        }
        {...(isEmbedded ? { 'data-dismiss-blocker': '' } : {})}
        className={cn(
          '!fixed flex h-[min(88vh,900px)] max-h-[92vh] w-[min(96vw,1400px)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-3xl border border-border/60 bg-background p-0 shadow-xl sm:max-w-[min(96vw,1400px)]',
          isEmbedded ? formDialogNestedContentClass : 'z-[201]',
          contentClassName,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-8 pt-8">
          <DialogHeader className="min-w-0 gap-1 p-0 text-left">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted/70 ring-1 ring-border/60">
                <FileTypeIcon mimeType={file.mimeType} className="size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="truncate text-xl font-bold tracking-tight text-foreground">
                  {file.name}
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                  {metaLine}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex shrink-0 items-center gap-2">
            {onNavigateToEntity && file.entityName ? (
              <Button variant="outline" size="sm" onClick={() => onNavigateToEntity(file)}>
                <ExternalLink className="size-4" />
                Ir a{' '}
                {file.entityType === 'contact'
                  ? 'contacto'
                  : file.entityType === 'company'
                    ? 'empresa'
                    : 'entidad'}
              </Button>
            ) : null}
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 rounded-full bg-muted/70 text-muted-foreground shadow-none hover:bg-muted"
              >
                <X className="size-4" />
                <span className="sr-only">Cerrar</span>
              </Button>
            </DialogClose>
          </div>
        </div>

        <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden px-8 pb-8">
          {isPdf ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
              {previewLoading ? (
                <div className="flex min-h-[min(50vh,400px)] flex-1 items-center justify-center p-12">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : null}
              {previewError ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <p className="mb-4 text-sm text-destructive">{previewError}</p>
                  {onDownload ? (
                    <Button variant="outline" onClick={handleDownload}>
                      <Download className="mr-2 size-4" />
                      Descargar PDF
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {!previewLoading && !previewError && previewUrl ? (
                <object
                  data={previewUrl}
                  type="application/pdf"
                  title={file.name}
                  className="min-h-[min(68vh,720px)] w-full flex-1 border-0 bg-white"
                >
                  <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                    <p className="max-w-md text-sm text-muted-foreground">
                      Este archivo no puede mostrarse aquí. Ábrelo en una pestaña nueva para
                      verlo.
                    </p>
                    <Button
                      variant="default"
                      onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="mr-2 size-4" />
                      Abrir PDF en nueva pestaña
                    </Button>
                  </div>
                </object>
              ) : null}
            </div>
          ) : null}

          {!canPreview ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-muted/20 p-12 text-center">
              <FileTypeIcon mimeType={file.mimeType} className="mb-4 size-16" />
              <p className="mb-4 text-sm text-muted-foreground">
                Vista previa no disponible para este tipo de archivo
              </p>
              {onDownload ? (
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="mr-2 size-4" />
                  Descargar archivo
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
