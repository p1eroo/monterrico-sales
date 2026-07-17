import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { FileAttachment } from '@/types';
import { api, API_BASE } from '@/lib/api';

async function flotaFileContentBlobUrl(
  prospectoId: string,
  fileId: string,
  disposition: 'inline' | 'attachment',
): Promise<string> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(
    `${API_BASE}/flota-prospectos/${prospectoId}/archivos/${fileId}/content?disposition=${disposition}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = text || res.statusText || 'Error al obtener el archivo';
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(j.message)) msg = j.message.join(', ');
      else if (typeof j.message === 'string') msg = j.message;
    } catch {
      /* usar text */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

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
  fetchBlobUrl: (fileId: string, disposition: string) => Promise<string>;
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

  const fetchBlobUrl = useCallback(
    async (fileId: string, disposition: string) => {
      if (!prospectoId) throw new Error('Falta el identificador del prospecto');
      return flotaFileContentBlobUrl(
        prospectoId,
        fileId,
        disposition as 'inline' | 'attachment',
      );
    },
    [prospectoId],
  );

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
      if (!prospectoId) throw new Error('Falta el identificador del prospecto');
      const url = await flotaFileContentBlobUrl(prospectoId, file.id, 'attachment');
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
  }, [prospectoId]);

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
    fetchBlobUrl,
  };
}
