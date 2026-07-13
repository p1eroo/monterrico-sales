import {
  Download,
  Eye,
  ExternalLink,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileTypeIcon } from './FileTypeIcon';
import { formatDate } from '@/lib/formatters';
import {
  FILE_ENTITY_TYPE_LABELS,
  formatFileSize,
  getFileExtension,
  isNavigableFileEntity,
} from '@/lib/fileUtils';
import { cn } from '@/lib/utils';
import type { FileAttachment } from '@/types';

interface FilesManagerGridProps {
  files: FileAttachment[];
  onView: (file: FileAttachment) => void;
  onDownload: (file: FileAttachment) => void;
  onDelete?: (file: FileAttachment) => void;
  onNavigateToEntity?: (file: FileAttachment) => void;
  canDelete?: boolean;
}

function entityBadgeClass(entityType: FileAttachment['entityType']): string {
  switch (entityType) {
    case 'contact':
      return 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-800';
    case 'company':
      return 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:border-violet-800';
    case 'opportunity':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

export function FilesManagerGrid({
  files,
  onView,
  onDownload,
  onDelete,
  onNavigateToEntity,
  canDelete = false,
}: FilesManagerGridProps) {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {files.map((file) => {
        const navigable = isNavigableFileEntity(file.entityType);

        return (
          <div
            key={file.id}
            className="group relative flex flex-col rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
          >
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
                onClick={() => onView(file)}
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted/80">
                  <FileTypeIcon mimeType={file.mimeType} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{file.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatFileSize(file.size)} · {formatDate(file.uploadedAt)}
                  </p>
                </div>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onView(file)}>
                    <Eye className="size-4" />
                    Ver
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDownload(file)}>
                    <Download className="size-4" />
                    Descargar
                  </DropdownMenuItem>
                  {navigable && onNavigateToEntity && (
                    <DropdownMenuItem onClick={() => onNavigateToEntity(file)}>
                      <ExternalLink className="size-4" />
                      Ir a entidad
                    </DropdownMenuItem>
                  )}
                  {canDelete && onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDelete(file)}
                      >
                        <Trash2 className="size-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-4 space-y-2 border-t pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px] uppercase">
                  {getFileExtension(file.name, file.mimeType)}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn('text-[10px] font-medium', entityBadgeClass(file.entityType))}
                >
                  {FILE_ENTITY_TYPE_LABELS[file.entityType]}
                </Badge>
              </div>
              {file.entityName && (
                navigable && onNavigateToEntity ? (
                  <button
                    type="button"
                    className="block w-full truncate text-left text-xs text-primary hover:underline"
                    onClick={() => onNavigateToEntity(file)}
                  >
                    {file.entityName}
                  </button>
                ) : (
                  <p className="truncate text-xs text-muted-foreground">{file.entityName}</p>
                )
              )}
              <p className="truncate text-xs text-muted-foreground">{file.uploadedByName}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
