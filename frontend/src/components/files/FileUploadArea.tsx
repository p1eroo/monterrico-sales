import { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadAreaProps {
  onUpload: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
}

export function FileUploadArea({ onUpload, disabled, className }: FileUploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length) onUpload(files);
    },
    [onUpload, disabled]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length) onUpload(files);
      e.target.value = '';
    },
    [onUpload]
  );

  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
        isDragging && !disabled && 'border-primary bg-primary/5',
        disabled && 'cursor-not-allowed opacity-50',
        !disabled && 'hover:border-primary/50 hover:bg-muted/50',
        className
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
        disabled={disabled}
      />
      <Upload className="size-8 text-muted-foreground" />
      <p className="mt-2 text-sm font-medium text-muted-foreground">
        Arrastra archivos aquí o haz clic para seleccionar
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        PDF, imágenes, documentos, hojas de cálculo
      </p>
    </label>
  );
}
