import {
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  MoreVertical,
} from 'lucide-react';
import { EyeSvgIcon } from '@/components/icons/EyeSvgIcon';
import { FileDownloadSvgIcon } from '@/components/icons/FileDownloadSvgIcon';
import { SquareTopUpSvgIcon } from '@/components/icons/SquareTopUpSvgIcon';
import { TrashSvgIcon } from '@/components/icons/TrashSvgIcon';
import { Badge } from '@/components/ui/badge';
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
  type FilesSortDir,
  type FilesSortKey,
} from '@/lib/fileUtils';
import { cn } from '@/lib/utils';
import {
  crmTableBodyRowClassInteractive,
  crmTableFooterClass,
  crmTableHeaderRowClassTall,
} from '@/lib/crmTableSurface';
import type { FileAttachment } from '@/types';

interface FilesManagerTableProps {
  files: FileAttachment[];
  sortKey: FilesSortKey;
  sortDir: FilesSortDir;
  onSort: (key: FilesSortKey) => void;
  onView: (file: FileAttachment) => void;
  onDownload: (file: FileAttachment) => void;
  onDelete?: (file: FileAttachment) => void;
  onNavigateToEntity?: (file: FileAttachment) => void;
  canDelete?: boolean;
}

const TH_SORT =
  'cursor-pointer select-none px-3 align-middle hover:text-[#1f2933] dark:hover:text-gray-100';

function SortableTh({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  column: FilesSortKey;
  sortKey: FilesSortKey;
  sortDir: FilesSortDir;
  onSort: (key: FilesSortKey) => void;
  className?: string;
}) {
  return (
    <th className={cn(TH_SORT, className)} onClick={() => onSort(column)}>
      <div className="flex items-center gap-1">
        {label}
        <SortIcon column={column} sortKey={sortKey} sortDir={sortDir} />
      </div>
    </th>
  );
}

function SortIcon({
  column,
  sortKey,
  sortDir,
}: {
  column: FilesSortKey;
  sortKey: FilesSortKey;
  sortDir: FilesSortDir;
}) {
  if (sortKey !== column) {
    return <ChevronsUpDown className="size-3 shrink-0 text-[#94A3B8] dark:text-gray-500" />;
  }
  return sortDir === 'asc' ? (
    <ChevronUp className="size-3 shrink-0" />
  ) : (
    <ChevronDown className="size-3 shrink-0" />
  );
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

export function FilesManagerTable({
  files,
  sortKey,
  sortDir,
  onSort,
  onView,
  onDownload,
  onDelete,
  onNavigateToEntity,
  canDelete = false,
}: FilesManagerTableProps) {
  return (
    <div className="overflow-auto scrollbar-thin max-h-[calc(100vh-330px)]">
      <table className="w-full min-w-[720px] table-fixed">
        <thead>
          <tr className={cn('h-11 text-left', crmTableHeaderRowClassTall)}>
            <th className="w-10 px-1" />
            <SortableTh
              label="Nombre"
              column="name"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className="min-w-[14rem]"
            />
            <th className="w-[72px] px-3 align-middle">Tipo</th>
            <SortableTh
              label="Tamaño"
              column="size"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className="w-[88px]"
            />
            <SortableTh
              label="Entidad"
              column="entityName"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className="hidden min-w-[11rem] sm:table-cell"
            />
            <th className="hidden min-w-[9rem] px-3 align-middle lg:table-cell">Origen</th>
            <SortableTh
              label="Subido por"
              column="uploadedByName"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className="hidden min-w-[8rem] md:table-cell"
            />
            <SortableTh
              label="Fecha"
              column="uploadedAt"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className="w-[108px]"
            />
            <th className="w-10 px-1" />
          </tr>
        </thead>
        <tbody>
          {files.map((file) => {
            const navigable = isNavigableFileEntity(file.entityType);
            const relatedLabel =
              file.relatedEntityType != null
                ? FILE_ENTITY_TYPE_LABELS[file.relatedEntityType]
                : null;

            return (
              <tr
                key={file.id}
                className={cn('h-14 last:border-b-0', crmTableBodyRowClassInteractive)}
                onClick={() => onView(file)}
              >
                <td className="px-1 align-middle" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <MoreVertical className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => onView(file)}>
                        <EyeSvgIcon />
                        Ver
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDownload(file)}>
                        <FileDownloadSvgIcon />
                        Descargar
                      </DropdownMenuItem>
                      {navigable && onNavigateToEntity && (
                        <DropdownMenuItem onClick={() => onNavigateToEntity(file)}>
                          <SquareTopUpSvgIcon />
                          Ir a {FILE_ENTITY_TYPE_LABELS[file.entityType].toLowerCase()}
                        </DropdownMenuItem>
                      )}
                      {canDelete && onDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onDelete(file)}
                          >
                            <TrashSvgIcon />
                            Eliminar
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
                <td className="min-w-0 px-3 align-middle">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/80">
                      <FileTypeIcon mimeType={file.mimeType} className="size-4" />
                    </div>
                    <p className="truncate text-sm font-medium text-[#1f2933] dark:text-gray-100">
                      {file.name}
                    </p>
                  </div>
                </td>
                <td className="px-3 align-middle">
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">
                    {getFileExtension(file.name, file.mimeType)}
                  </Badge>
                </td>
                <td className="px-3 align-middle text-sm text-muted-foreground">
                  {formatFileSize(file.size)}
                </td>
                <td className="hidden min-w-0 px-3 align-middle sm:table-cell">
                  <div className="flex min-w-0 flex-col gap-1">
                    <Badge
                      variant="outline"
                      className={cn('w-fit text-[10px] font-medium', entityBadgeClass(file.entityType))}
                    >
                      {FILE_ENTITY_TYPE_LABELS[file.entityType]}
                    </Badge>
                    {file.entityName ? (
                      navigable && onNavigateToEntity ? (
                        <button
                          type="button"
                          className="inline-flex max-w-full items-center gap-1 truncate text-left text-sm text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToEntity(file);
                          }}
                        >
                          <span className="truncate">{file.entityName}</span>
                          <SquareTopUpSvgIcon className="size-3 shrink-0" />
                        </button>
                      ) : (
                        <span className="truncate text-sm text-muted-foreground">
                          {file.entityName}
                        </span>
                      )
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
                <td className="hidden min-w-0 px-3 align-middle lg:table-cell">
                  {file.relatedEntityName ? (
                    <div className="min-w-0">
                      {relatedLabel && (
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {relatedLabel}
                        </p>
                      )}
                      <p className="truncate text-sm">{file.relatedEntityName}</p>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </td>
                <td className="hidden px-3 align-middle md:table-cell">
                  <span className="truncate text-sm">{file.uploadedByName}</span>
                </td>
                <td className="px-3 align-middle text-sm text-muted-foreground">
                  {formatDate(file.uploadedAt)}
                </td>
                <td className="px-1" />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
