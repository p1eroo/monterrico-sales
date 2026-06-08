import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import type { FileAttachment, FileEntityType } from '@/types';
import {
  fetchFiles,
  uploadFileToApi,
  deleteFileApi,
  fetchFileContentBlobUrl,
} from '@/lib/fileApi';

export interface UseEntityFilesArgs {
  entityType: FileEntityType;
  entityId: string;
  entityName?: string;
}

export interface UseEntityFilesReturn {
  entityIdValid: boolean;
  files: FileAttachment[];
  loading: boolean;
  canCreate: boolean;
  canDelete: boolean;
  handleUpload: (uploadedFiles: File[]) => Promise<void>;
  handleView: (file: FileAttachment) => void;
  handleDownload: (file: FileAttachment) => Promise<void>;
  handleDelete: (file: FileAttachment) => Promise<void>;
  previewFile: FileAttachment | null;
  previewOpen: boolean;
  setPreviewOpen: (open: boolean) => void;
}

export function useEntityFiles({
  entityType,
  entityId,
  entityName,
}: UseEntityFilesArgs): UseEntityFilesReturn {
  const { hasPermission } = usePermissions();
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const canCreate = hasPermission('archivos.crear');
  const canDelete = hasPermission('archivos.eliminar');
  const entityIdValid = !!entityId?.trim();

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
      toast.error(
        e instanceof Error ? e.message : 'No se pudieron cargar los archivos',
      );
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

  return {
    entityIdValid,
    files,
    loading,
    canCreate,
    canDelete,
    handleUpload,
    handleView,
    handleDownload,
    handleDelete,
    previewFile,
    previewOpen,
    setPreviewOpen,
  };
}
