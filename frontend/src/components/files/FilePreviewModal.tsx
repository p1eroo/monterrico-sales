import { useMemo, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
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
}

export function FilePreviewModal({
  file,
  open,
  onOpenChange,
  onDownload,
  onNavigateToEntity,
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
    void fetchFileContentBlobUrl(file.id, 'inline')
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
  }, [open, file?.id, file?.mimeType, canPreview]);

  if (!file) return null;

  const handleDownload = () => {
    void onDownload?.(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(88vh,900px)] max-h-[92vh] w-[min(96vw,1400px)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1400px)]">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FileTypeIcon mimeType={file.mimeType} className="size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base truncate">{file.name}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(file.size)} · {file.uploadedByName} ·{' '}
                  {new Date(file.uploadedAt).toLocaleDateString('es-PE', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onNavigateToEntity && file.entityName && (
                <Button variant="outline" size="sm" onClick={() => onNavigateToEntity(file)}>
                  <ExternalLink className="size-4" />
                  Ir a{' '}
                  {file.entityType === 'contact'
                    ? 'contacto'
                    : file.entityType === 'company'
                      ? 'empresa'
                      : 'entidad'}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="size-4" />
                Descargar
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-muted/30">
          {isImage && (
            <div className="flex min-h-[min(60vh,480px)] flex-col items-center justify-center p-6">
              {previewLoading && (
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              )}
              {previewError && (
                <p className="text-sm text-destructive text-center">{previewError}</p>
              )}
              {!previewLoading && !previewError && previewUrl && (
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="max-h-[min(75vh,720px)] max-w-full object-contain rounded-lg shadow-sm"
                />
              )}
            </div>
          )}
          {isPdf && (
            <div className="flex min-h-0 flex-1 flex-col">
              {previewLoading && (
                <div className="flex min-h-[min(50vh,400px)] flex-1 items-center justify-center p-12">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              )}
              {previewError && (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <p className="text-sm text-destructive mb-4">{previewError}</p>
                  <Button variant="outline" onClick={handleDownload}>
                    <Download className="size-4 mr-2" />
                    Descargar PDF
                  </Button>
                </div>
              )}
              {!previewLoading && !previewError && previewUrl && (
                <div className="flex min-h-0 flex-1 flex-col bg-white">
                  <object
                    data={previewUrl}
                    type="application/pdf"
                    title={file.name}
                    className="min-h-[min(72vh,780px)] w-full flex-1 border-0"
                  >
                    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                      <p className="text-sm text-muted-foreground max-w-md">
                        Este archivo no puede mostrarse aquí (el alojamiento puede bloquear vistas
                        embebidas). Ábrelo en una pestaña nueva para verlo.
                      </p>
                      <Button
                        variant="default"
                        onClick={() =>
                          window.open(previewUrl, '_blank', 'noopener,noreferrer')
                        }
                      >
                        <ExternalLink className="size-4 mr-2" />
                        Abrir PDF en nueva pestaña
                      </Button>
                    </div>
                  </object>
                </div>
              )}
            </div>
          )}
          {!canPreview && (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <FileTypeIcon mimeType={file.mimeType} className="size-16 mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Vista previa no disponible para este tipo de archivo
              </p>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="size-4 mr-2" />
                Descargar archivo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
