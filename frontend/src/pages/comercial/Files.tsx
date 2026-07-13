import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FileArchive,
  ChevronDown,
  X,
  HardDrive,
  Files,
  FileType2,
  Building2,
  UserCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { GlassCard } from '@/components/shared/GlassCard';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FilePreviewModal } from '@/components/files';
import { FilesManagerGrid } from '@/components/files/FilesManagerGrid';
import { FilesManagerTable } from '@/components/files/FilesManagerTable';
import { EmptyState } from '@/components/shared/EmptyState';
import { GhostTableSkeleton } from '@/components/shared/GhostTableSkeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { FileAttachment, FileEntityType } from '@/types';
import {
  companyDetailHref,
  contactDetailHref,
  opportunityDetailHref,
} from '@/lib/detailRoutes';
import { usePermissions } from '@/hooks/usePermissions';
import { useUsers } from '@/hooks/useUsers';
import { useIsMobile } from '@/hooks/use-mobile';
import { isCommercialFilesFilterRoleSlug } from '@/lib/userRoleMap';
import {
  FILE_ENTITY_TYPE_LABELS,
  FILE_TYPE_FILTER_OPTIONS,
  formatFileSize,
  matchesFileType,
  sortFiles,
  type FilesSortDir,
  type FilesSortKey,
} from '@/lib/fileUtils';
import {
  comercialProCommandClass,
  comercialProPopoverClass,
} from '@/lib/comercialFilterSurface';
import { fetchFiles, deleteFileApi, fetchFileContentBlobUrl } from '@/lib/fileApi';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const FILTER_BTN_BASE =
  '!h-12 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 px-3 text-sm hover:border-primary transition-colors shadow-none cursor-pointer flex items-center gap-1.5 text-left';

function filterBtnClass(active: boolean, width = 'w-[190px]') {
  return cn(
    FILTER_BTN_BASE,
    width,
    active ? 'text-black dark:text-gray-100' : 'text-[#8a9aab] dark:text-gray-400',
  );
}

export default function FilesPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { hasPermission } = usePermissions();
  const { activeUsers } = useUsers();
  const canDelete = hasPermission('archivos.eliminar');

  const [allFiles, setAllFiles] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<FilesSortKey>('uploadedAt');
  const [sortDir, setSortDir] = useState<FilesSortDir>('desc');
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [filePendingDelete, setFilePendingDelete] = useState<FileAttachment | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchFiles({ scope: 'comercial' });
      setAllFiles(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron cargar los archivos');
      setAllFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const comercialUsers = useMemo(() => {
    const seen = new Set<string>();
    return activeUsers
      .filter(
        (u) =>
          u.allowedAreas?.includes('comercial') &&
          u.roleSlug != null &&
          isCommercialFilesFilterRoleSlug(u.roleSlug),
      )
      .filter((u) => !seen.has(u.id) && (seen.add(u.id), true))
      .map((u) => ({ id: u.id, name: u.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [activeUsers]);

  const filteredFiles = useMemo(() => {
    const rows = allFiles.filter((file) => {
      const matchesSearch =
        !search ||
        file.name.toLowerCase().includes(search.toLowerCase()) ||
        file.entityName?.toLowerCase().includes(search.toLowerCase()) ||
        file.uploadedByName.toLowerCase().includes(search.toLowerCase());
      const matchesType = matchesFileType(file, typeFilter);
      const matchesEntity = entityFilter === 'all' || file.entityType === entityFilter;
      const matchesUser = userFilter === 'all' || file.uploadedBy === userFilter;
      return matchesSearch && matchesType && matchesEntity && matchesUser;
    });
    return sortFiles(rows, sortKey, sortDir);
  }, [allFiles, search, typeFilter, entityFilter, userFilter, sortKey, sortDir]);

  const totalBytes = useMemo(
    () => filteredFiles.reduce((sum, file) => sum + file.size, 0),
    [filteredFiles],
  );

  const hasActiveFilters =
    typeFilter !== 'all' || entityFilter !== 'all' || userFilter !== 'all';

  const typeFilterLabel =
    FILE_TYPE_FILTER_OPTIONS.find((o) => o.value === typeFilter)?.label ?? 'Tipo';
  const entityFilterLabel =
    entityFilter === 'all'
      ? 'Entidad'
      : FILE_ENTITY_TYPE_LABELS[entityFilter as FileEntityType];
  const userFilterLabel =
    userFilter === 'all'
      ? 'Usuario'
      : (comercialUsers.find((u) => u.id === userFilter)?.name ?? 'Usuario');

  const handleSort = (key: FilesSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'uploadedAt' || key === 'size' ? 'desc' : 'asc');
  };

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setEntityFilter('all');
    setUserFilter('all');
  };

  const handleView = (file: FileAttachment) => {
    setPreviewFile(file);
    setPreviewOpen(true);
  };

  const handleDownload = async (file: FileAttachment) => {
    try {
      const url = await fetchFileContentBlobUrl(file.id, 'attachment');
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.rel = 'noopener noreferrer';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo descargar');
    }
  };

  const handleDelete = async (file: FileAttachment) => {
    if (!canDelete) return;
    try {
      await deleteFileApi(file.id);
      toast.success('Archivo eliminado');
      if (previewFile?.id === file.id) {
        setPreviewOpen(false);
        setPreviewFile(null);
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  };

  const confirmDeleteFile = () => {
    const f = filePendingDelete;
    if (f) void handleDelete(f);
  };

  const handleNavigateToEntity = (file: FileAttachment) => {
    if (file.entityType === 'contact') {
      navigate(contactDetailHref({ id: file.entityId }));
    } else if (file.entityType === 'company') {
      navigate(companyDetailHref({ id: file.entityId }));
    } else if (file.entityType === 'opportunity') {
      navigate(opportunityDetailHref({ id: file.entityId }));
    }
    setPreviewOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Archivos"
        description="Archivos de contactos, empresas y oportunidades del área comercial"
        className="mb-6"
      />

      <GlassCard>
        <div className="flex min-w-0 flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
          <div className="relative w-full min-w-0 max-w-[400px]">
            <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-[#8a9aab] dark:text-gray-400" />
            <Input
              placeholder="Buscar por nombre, entidad o usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="!h-12 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 pl-10 text-[15px] text-black dark:text-gray-100 placeholder:text-[#8a9aab] dark:placeholder:text-gray-400 transition-colors hover:border-primary focus-visible:ring-1 shadow-none"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={filterBtnClass(typeFilter !== 'all')}
              >
                <FileType2 className="size-5 shrink-0 text-[#8a9aab] dark:text-gray-400" />
                <span className="truncate flex-1">{typeFilterLabel}</span>
                <ChevronDown className="size-3.5 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(comercialProPopoverClass, 'w-[220px] p-1.5')}
              align="start"
              sideOffset={8}
            >
              <Command className={comercialProCommandClass}>
                <CommandList className="max-h-[260px] overflow-y-auto">
                  <CommandGroup>
                    {FILE_TYPE_FILTER_OPTIONS.map((opt) => (
                      <CommandItem key={opt.value} onSelect={() => setTypeFilter(opt.value)}>
                        <span className="[&_svg]:!text-primary-foreground">
                          <Checkbox
                            checked={typeFilter === opt.value}
                            className="mr-2 h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                          />
                        </span>
                        <span>{opt.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={filterBtnClass(entityFilter !== 'all')}
              >
                <Building2 className="size-5 shrink-0 text-[#8a9aab] dark:text-gray-400" />
                <span className="truncate flex-1">{entityFilterLabel}</span>
                <ChevronDown className="size-3.5 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(comercialProPopoverClass, 'w-[220px] p-1.5')}
              align="start"
              sideOffset={8}
            >
              <Command className={comercialProCommandClass}>
                <CommandList className="max-h-[260px] overflow-y-auto">
                  <CommandGroup>
                    <CommandItem onSelect={() => setEntityFilter('all')}>
                      <span className="[&_svg]:!text-primary-foreground">
                        <Checkbox
                          checked={entityFilter === 'all'}
                          className="mr-2 h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                        />
                      </span>
                      <span>Todas las entidades</span>
                    </CommandItem>
                    {(Object.entries(FILE_ENTITY_TYPE_LABELS) as [FileEntityType, string][]).map(
                      ([k, v]) => (
                        <CommandItem key={k} onSelect={() => setEntityFilter(k)}>
                          <span className="[&_svg]:!text-primary-foreground">
                            <Checkbox
                              checked={entityFilter === k}
                              className="mr-2 h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                            />
                          </span>
                          <span>{v}</span>
                        </CommandItem>
                      ),
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={filterBtnClass(userFilter !== 'all')}
              >
                <UserCircle className="size-5 shrink-0 text-[#8a9aab] dark:text-gray-400" />
                <span className="truncate flex-1">{userFilterLabel}</span>
                <ChevronDown className="size-3.5 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(comercialProPopoverClass, 'w-[240px] p-1.5')}
              align="start"
              sideOffset={8}
            >
              <Command className={comercialProCommandClass}>
                <CommandList className="max-h-[260px] overflow-y-auto">
                  <CommandGroup>
                    <CommandItem onSelect={() => setUserFilter('all')}>
                      <span className="[&_svg]:!text-primary-foreground">
                        <Checkbox
                          checked={userFilter === 'all'}
                          className="mr-2 h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                        />
                      </span>
                      <span>Todos los usuarios</span>
                    </CommandItem>
                    {comercialUsers.map((u) => (
                      <CommandItem key={u.id} onSelect={() => setUserFilter(u.id)}>
                        <span className="[&_svg]:!text-primary-foreground">
                          <Checkbox
                            checked={userFilter === u.id}
                            className="mr-2 h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                          />
                        </span>
                        <span>{u.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {(hasActiveFilters || search) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" />
              Limpiar
            </Button>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground lg:ml-auto">
            <span className="inline-flex items-center gap-1.5">
              <Files className="size-4" />
              {loading
                ? 'Cargando…'
                : `${filteredFiles.length} archivo${filteredFiles.length === 1 ? '' : 's'}`}
              {!loading && allFiles.length !== filteredFiles.length && (
                <span className="text-xs">de {allFiles.length}</span>
              )}
            </span>
            {!loading && (
              <span className="inline-flex items-center gap-1.5">
                <HardDrive className="size-4" />
                {formatFileSize(totalBytes)} en total
              </span>
            )}
          </div>
        </div>

        {loading ? (
          isMobile ? (
            <div className="space-y-3 border-t border-border/40 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-md bg-muted/60" />
              ))}
            </div>
          ) : (
            <div className="border-t border-border/40">
              <GhostTableSkeleton
                columns={[
                  { label: '', width: 40 },
                  { label: 'Nombre', width: 280 },
                  { label: 'Tipo', width: 72 },
                  { label: 'Tamaño', width: 88 },
                  { label: 'Entidad', width: 180, className: 'hidden sm:table-cell' },
                  { label: 'Origen', width: 140, className: 'hidden lg:table-cell' },
                  { label: 'Subido por', width: 120, className: 'hidden md:table-cell' },
                  { label: 'Fecha', width: 108 },
                ]}
                rows={8}
              />
            </div>
          )
        ) : filteredFiles.length === 0 ? (
          <div className="border-t border-border/40 p-8">
            <EmptyState
              icon={FileArchive}
              title="No hay archivos"
              description={
                search || hasActiveFilters
                  ? 'No se encontraron archivos con los filtros aplicados'
                  : 'Sube archivos desde el detalle de un contacto, empresa u oportunidad'
              }
            />
          </div>
        ) : isMobile ? (
          <div className="border-t border-border/40">
            <FilesManagerGrid
              files={filteredFiles}
              onView={handleView}
              onDownload={handleDownload}
              onDelete={canDelete ? (file) => setFilePendingDelete(file) : undefined}
              onNavigateToEntity={handleNavigateToEntity}
              canDelete={canDelete}
            />
          </div>
        ) : (
          <div className="border-t border-border/40">
            <FilesManagerTable
              files={filteredFiles}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onView={handleView}
              onDownload={handleDownload}
              onDelete={canDelete ? (file) => setFilePendingDelete(file) : undefined}
              onNavigateToEntity={handleNavigateToEntity}
              canDelete={canDelete}
            />
          </div>
        )}
      </GlassCard>

      <FilePreviewModal
        file={previewFile}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onDownload={handleDownload}
        onNavigateToEntity={handleNavigateToEntity}
      />

      <ConfirmDialog
        open={filePendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setFilePendingDelete(null);
        }}
        title="Eliminar Archivo"
        description="¿Estás seguro que deseas eliminar este archivo? Esta acción no se puede deshacer."
        onConfirm={confirmDeleteFile}
        variant="destructive"
      />
    </div>
  );
}
