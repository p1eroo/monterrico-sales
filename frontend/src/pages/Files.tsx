import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutGrid,
  List,
  FileArchive,
  User,
  Filter,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { FileListItem } from '@/components/files';
import { FilePreviewModal } from '@/components/files';
import { EmptyState } from '@/components/shared/EmptyState';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FileAttachment, FileEntityType } from '@/types';
import {
  companyDetailHref,
  contactDetailHref,
  opportunityDetailHref,
} from '@/lib/detailRoutes';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchFiles, deleteFileApi, fetchFileContentBlobUrl } from '@/lib/fileApi';
import { toast } from 'sonner';

const ENTITY_TYPE_LABELS: Record<FileEntityType, string> = {
  contact: 'Contacto',
  company: 'Empresa',
  opportunity: 'Oportunidad',
  activity: 'Actividad',
  email: 'Correo',
  task: 'Tarea',
};

const FILE_TYPE_OPTIONS = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'application/pdf', label: 'PDF' },
  { value: 'image', label: 'Imágenes' },
  { value: 'document', label: 'Documentos' },
  { value: 'spreadsheet', label: 'Hojas de cálculo' },
];

function matchesFileType(file: FileAttachment, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'image') return file.mimeType.startsWith('image/');
  if (filter === 'document') return file.mimeType.includes('word') || file.mimeType.includes('document');
  if (filter === 'spreadsheet') return file.mimeType.includes('sheet') || file.mimeType.includes('excel');
  return file.mimeType === filter;
}

export default function FilesPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canDelete = hasPermission('archivos.eliminar');

  const [allFiles, setAllFiles] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchFiles();
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

  const filteredFiles = useMemo(() => {
    return allFiles.filter((file) => {
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
  }, [allFiles, search, typeFilter, entityFilter, userFilter]);

  const uniqueUsers = useMemo(() => {
    const seen = new Set<string>();
    return allFiles
      .filter((f) => !seen.has(f.uploadedBy) && (seen.add(f.uploadedBy), true))
      .map((f) => ({ id: f.uploadedBy, name: f.uploadedByName }));
  }, [allFiles]);

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
    <div className="space-y-6">
      <PageHeader
        title="Archivos"
        description="Todos los archivos adjuntos del CRM (almacenamiento seguro vía API)"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, entidad o usuario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="size-4 shrink-0" />
            <SelectValue placeholder="Tipo de archivo" />
          </SelectTrigger>
          <SelectContent>
            {FILE_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Entidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las entidades</SelectItem>
            {(Object.entries(ENTITY_TYPE_LABELS) as [FileEntityType, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <User className="size-4 shrink-0" />
            <SelectValue placeholder="Usuario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los usuarios</SelectItem>
            {uniqueUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="size-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="size-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Cargando archivos…</p>
      ) : filteredFiles.length === 0 ? (
        <EmptyState
          icon={FileArchive}
          title="No hay archivos"
          description={
            search || typeFilter !== 'all' || entityFilter !== 'all' || userFilter !== 'all'
              ? 'No se encontraron archivos con los filtros aplicados'
              : 'Sube archivos desde el detalle de un contacto, empresa u oportunidad'
          }
        />
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredFiles.map((file) => (
            <FileListItem
              key={file.id}
              file={file}
              variant="card"
              onView={handleView}
              onDownload={handleDownload}
              onDelete={canDelete ? handleDelete : undefined}
              canDelete={canDelete}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFiles.map((file) => (
            <FileListItem
              key={file.id}
              file={file}
              variant="list"
              onView={handleView}
              onDownload={handleDownload}
              onDelete={canDelete ? handleDelete : undefined}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}

      <FilePreviewModal
        file={previewFile}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onDownload={handleDownload}
        onNavigateToEntity={handleNavigateToEntity}
      />
    </div>
  );
}
