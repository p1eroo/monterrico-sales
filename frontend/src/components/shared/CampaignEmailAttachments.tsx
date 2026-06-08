import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Paperclip, Trash2, Upload } from 'lucide-react';
import type { CampaignAttachment } from '@/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MAX_FILES = 15;
const MAX_BYTES_PER_FILE = 12 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(file);
  });
}

type Props = {
  attachments: CampaignAttachment[];
  onChange: (next: CampaignAttachment[]) => void;
};

export function CampaignEmailAttachments({ attachments, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const ingestFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter(Boolean);
      if (files.length === 0) return;

      const room = MAX_FILES - attachments.length;
      if (room <= 0) {
        toast.error(`Máximo ${MAX_FILES} archivos adjuntos.`);
        return;
      }

      const slice = files.slice(0, room);
      if (files.length > room) {
        toast.message('Algunos archivos no se añadieron', {
          description: `Solo caben ${MAX_FILES} adjuntos en total.`,
        });
      }

      const valid = slice.filter((f) => f.size <= MAX_BYTES_PER_FILE);
      const oversized = slice.filter((f) => f.size > MAX_BYTES_PER_FILE);
      if (oversized.length > 0) {
        toast.error(
          `${oversized.length} archivo(s) superan el máximo de ${formatBytes(MAX_BYTES_PER_FILE)}.`,
        );
      }
      if (valid.length === 0) return;

      setBusy(true);
      try {
        const nextItems: CampaignAttachment[] = [];
        for (const file of valid) {
          const dataUrl = await readAsDataUrl(file);
          nextItems.push({
            id:
              typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            dataUrl,
          });
        }
        onChange([...attachments, ...nextItems]);
        if (nextItems.length > 0) {
          toast.success(
            nextItems.length === 1
              ? 'Archivo adjuntado'
              : `${nextItems.length} archivos adjuntados`,
          );
        }
      } catch {
        toast.error('No se pudieron leer uno o más archivos.');
      } finally {
        setBusy(false);
      }
    },
    [attachments, onChange],
  );

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    e.target.value = '';
    if (list?.length) void ingestFiles(list);
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files?.length) void ingestFiles(e.dataTransfer.files);
  };

  const remove = (id: string) => {
    onChange(attachments.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Archivos adjuntos</Label>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragOver && 'border-primary bg-primary/5',
          !dragOver && 'border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/40',
          busy && 'pointer-events-none opacity-60',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={onInputChange}
          disabled={busy}
        />
        <Upload className="size-8 text-muted-foreground" aria-hidden />
        <p className="mt-2 text-sm font-medium text-foreground">
          Arrastra archivos aquí o haz clic para elegir
        </p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          Hasta {MAX_FILES} archivos · máx. {formatBytes(MAX_BYTES_PER_FILE)} cada uno
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 pointer-events-none"
          tabIndex={-1}
        >
          <Paperclip className="size-4" />
          Añadir archivos
        </Button>
      </div>

      {attachments.length > 0 && (
        <ul
          className="space-y-1.5 rounded-md border bg-muted/20 p-2"
          onClick={(e) => e.stopPropagation()}
        >
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-md bg-background px-2 py-1.5 text-sm"
            >
              <span className="min-w-0 truncate" title={a.fileName}>
                {a.fileName}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatBytes(a.sizeBytes)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Quitar ${a.fileName}`}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(a.id);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
