import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink } from 'lucide-react';
import { FileTypeIcon } from './FileTypeIcon';
import type { FileAttachment } from '@/types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    () => file?.mimeType.startsWith('image/') ?? false,
    [file?.mimeType]
  );
  const isPdf = useMemo(
    () => file?.mimeType === 'application/pdf',
    [file?.mimeType]
  );
  const canPreview = isImage || isPdf;

  if (!file) return null;

  const handleDownload = () => {
    onDownload?.(file);
    // Mock: crear blob y descargar
    const blob = new Blob(['Mock file content'], { type: file.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FileTypeIcon mimeType={file.mimeType} className="size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base truncate">{file.name}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(file.size)} · {file.uploadedByName} · {new Date(file.uploadedAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onNavigateToEntity && file.entityName && (
                <Button variant="outline" size="sm" onClick={() => onNavigateToEntity(file)}>
                  <ExternalLink className="size-4" />
                  Ir a {file.entityType === 'contact' ? 'contacto' : file.entityType === 'company' ? 'empresa' : 'entidad'}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="size-4" />
                Descargar
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-[300px] max-h-[70vh] overflow-auto bg-muted/30">
          {isImage && (
            <div className="flex items-center justify-center p-6">
              <img
                src={file.url ?? `https://placehold.co/600x400?text=${encodeURIComponent(file.name)}`}
                alt={file.name}
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm"
              />
            </div>
          )}
          {isPdf && (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <FileTypeIcon mimeType="application/pdf" className="size-16 mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Vista previa de PDF no disponible en modo demo
              </p>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="size-4 mr-2" />
                Descargar PDF
              </Button>
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
