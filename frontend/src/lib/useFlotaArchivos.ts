import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { FileAttachment } from '@/types';
import { api, API_BASE } from '@/lib/api';
import { fetchFileContentBlobUrl } from '@/lib/fileApi';

export interface UseFlotaArchivosReturn {
  loading: boolean;
  files: FileAttachment[];
  handleUpload: (uploadedFiles: File[]) => Promise<void>;
  handleView: (file: FileAttachment) => void;
  handleDownload: (file: FileAttachment) => Promise<void>;
  handleDelete: (file: FileAttachment) => Promise<void>;
  previewFile: FileAttachment | null;
  previewOpen: boolean;
  setPreviewOpen: (open: boolean) => void;
}

export function useFlotaArchivos(prospectoId: string | null): UseFlotaArchivosReturn {
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(async () => {
    if (!prospectoId) {
      setFiles([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await api<FileAttachment[]>(
        `/flota-prospectos/${prospectoId}/archivos`,
      );
      setFiles(rows);
    } catch {
      toast.error('No se pudieron cargar los archivos');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [prospectoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = useCallback(
    async (uploadedFiles: File[]) => {
      if (!prospectoId) {
        toast.error('Falta el identificador del prospecto');
        return;
      }
      try {
        for (const f of uploadedFiles) {
          const fd = new FormData();
          fd.append('file', f);

          const token = localStorage.getItem('accessToken');
          const headers = new Headers();
          if (token) headers.set('Authorization', `Bearer ${token}`);

          const res = await fetch(
            `${API_BASE}/flota-prospectos/${prospectoId}/archivos`,
            { method: 'POST', headers, body: fd },
          );
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(text || 'Error al subir');
          }
        }
        toast.success(`${uploadedFiles.length} archivo(s) subido(s)`);
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al subir');
      }
    },
    [prospectoId, load],
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
      if (!prospectoId) return;
      try {
        await api(
          `/flota-prospectos/${prospectoId}/archivos/${file.id}`,
          { method: 'DELETE' },
        );
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
    [prospectoId, load, previewFile?.id],
  );

  return {
    loading,
    files,
    handleUpload,
    handleView,
    handleDownload,
    handleDelete,
    previewFile,
    previewOpen,
    setPreviewOpen,
  };
}
