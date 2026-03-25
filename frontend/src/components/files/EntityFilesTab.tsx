import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { FileArchive } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import type { FileAttachment, FileEntityType } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { FileUploadArea } from './FileUploadArea';
import { FileListItem } from './FileListItem';
import { FilePreviewModal } from './FilePreviewModal';
import {
  fetchFiles,
  uploadFileToApi,
  deleteFileApi,
  fetchFileContentBlobUrl,
} from '@/lib/fileApi';

interface EntityFilesTabProps {
  entityType: FileEntityType;
  entityId: string;
  entityName?: string;
}

export function EntityFilesTab({
  entityType,
  entityId,
  entityName,
}: EntityFilesTabProps) {
  const { hasPermission } = usePermissions();
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const canCreate = hasPermission('archivos.crear');
  const canDelete = hasPermission('archivos.eliminar');

  const load = useCallback(async () => {
    if (!entityId?.trim()) {
      setFiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchFiles({ entityType, entityId: entityId.trim() });
      setFiles(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron cargar los archivos');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = useCallback(
    async (uploadedFiles: File[]) => {
      if (!entityId?.trim()) {
        toast.error('Falta el identificador de la entidad para adjuntar archivos');
        return;
      }
      if (!canCreate) {
        toast.error('No tienes permiso para subir archivos');
        return;
      }
      try {
        for (const f of uploadedFiles) {
          await uploadFileToApi(f, {
            entityType,
            entityId: entityId.trim(),
            entityName,
          });
        }
        toast.success(`${uploadedFiles.length} archivo(s) subido(s)`);
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al subir');
      }
    },
    [entityType, entityId, entityName, canCreate, load],
  );

  const handleView = useCallback((file: FileAttachment) => {
    setPreviewFile(file);
    setPreviewOpen(true);
  }, []);

  const handleDownload = useCallback(async (file: FileAttachment) => {
    try {
      const url = await fetchFileContentBlobUrl(file.id, 'attachment');
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.rel = 'noopener noreferrer';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Descarga iniciada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo descargar');
    }
  }, []);

  const handleDelete = useCallback(
    async (file: FileAttachment) => {
      if (!canDelete) {
        toast.error('No tienes permiso para eliminar archivos');
        return;
      }
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
    },
    [canDelete, previewFile?.id, load],
  );

  if (!entityId?.trim()) {
    return (
      <EmptyState
        icon={FileArchive}
        title="Adjuntos no disponibles"
        description="No se pudo determinar el identificador de esta entidad en el servidor. Abre el detalle desde el listado conectado a la API."
      />
    );
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <FileUploadArea onUpload={handleUpload} className="min-h-[120px]" />
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Cargando archivos…</p>
      ) : files.length === 0 ? (
        <EmptyState
          icon={FileArchive}
          title="No hay archivos adjuntos"
          description={
            canCreate
              ? 'Los archivos que subas quedarán asociados a este registro y se listarán aquí'
              : 'Aún no hay archivos para esta entidad'
          }
        />
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <FileListItem
              key={f.id}
              file={f}
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
      />
    </div>
  );
}
