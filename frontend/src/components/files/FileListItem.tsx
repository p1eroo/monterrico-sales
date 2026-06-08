import { Eye, Download, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileTypeIcon } from './FileTypeIcon';
import { formatDate } from '@/lib/formatters';
import type { FileAttachment } from '@/types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileListItemProps {
  file: FileAttachment;
  onView: (file: FileAttachment) => void;
  onDownload: (file: FileAttachment) => void;
  onDelete?: (file: FileAttachment) => void;
  canDelete?: boolean;
  variant?: 'list' | 'card';
}

export function FileListItem({
  file,
  onView,
  onDownload,
  onDelete,
  canDelete = true,
  variant = 'list',
}: FileListItemProps) {
  if (variant === 'card') {
    return (
      <div
        className="group flex flex-col rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 cursor-pointer"
        onClick={() => onView(file)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <FileTypeIcon mimeType={file.mimeType} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(file); }}>
                <Eye className="size-4" />
                Ver
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(file); }}>
                <Download className="size-4" />
                Descargar
              </DropdownMenuItem>
              {canDelete && onDelete && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(file); }}
                >
                  <Trash2 className="size-4" />
                  Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="mt-2 truncate text-sm font-medium">{file.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(file.uploadedAt)}</p>
        {file.relatedEntityName && (
          <p className="mt-1 text-xs text-muted-foreground truncate">
            {file.relatedEntityType === 'activity' && 'Actividad: '}
            {file.relatedEntityType === 'email' && 'Correo: '}
            {file.relatedEntityType === 'task' && 'Tarea: '}
            {file.relatedEntityName}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-between gap-3 px-0 py-2.5 sm:py-3 transition-colors hover:bg-muted/40">
      <div
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
        onClick={() => onView(file)}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/80">
          <FileTypeIcon mimeType={file.mimeType} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0 text-xs text-muted-foreground">
            <span>{formatDate(file.uploadedAt)}</span>
            <span>{file.uploadedByName}</span>
            {file.relatedEntityName && (
              <span className="truncate">
                {file.relatedEntityType === 'activity' && 'Actividad: '}
                {file.relatedEntityType === 'email' && 'Correo: '}
                {file.relatedEntityType === 'task' && 'Tarea: '}
                {file.relatedEntityName}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => onView(file)}>
          <Eye className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => onDownload(file)}>
          <Download className="size-4" />
        </Button>
        {canDelete && onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(file)}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
