import { useCallback, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadAreaProps {
  onUpload: (files: File[]) => void | Promise<void>;
  disabled?: boolean;
  busy?: boolean;
  busyMessage?: string;
  className?: string;
}

export function FileUploadArea({
  onUpload,
  disabled,
  busy,
  busyMessage,
  className,
}: FileUploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const isDisabled = disabled || busy;

  const runUpload = useCallback(
    async (files: File[]) => {
      if (!files.length || isDisabled) return;
      await onUpload(files);
    },
    [onUpload, isDisabled],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (isDisabled) return;
      const files = Array.from(e.dataTransfer.files);
      void runUpload(files);
    },
    [runUpload, isDisabled],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!isDisabled) setIsDragging(true);
    },
    [isDisabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      void runUpload(files);
      e.target.value = '';
    },
    [runUpload],
  );

  return (
    <label
      className={cn(
        'relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
        isDragging && !isDisabled && 'border-primary bg-primary/5',
        isDisabled && 'cursor-not-allowed opacity-50',
        !isDisabled && 'hover:border-primary/50 hover:bg-muted/50',
        className,
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        disabled={isDisabled}
      />
      {busy ? (
        <div className="flex flex-col items-center justify-center py-2">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {busyMessage ?? 'Procesando…'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground text-center max-w-xs">
            Puede tardar unos segundos mientras se analiza el documento.
          </p>
        </div>
      ) : (
        <>
          <Upload className="size-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Arrastra archivos aquí o haz clic para seleccionar
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, imágenes, documentos, hojas de cálculo
          </p>
        </>
      )}
    </label>
  );
}
