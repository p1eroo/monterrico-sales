import { useState, useCallback, useEffect } from 'react';
import { toast } from '@/lib/notify';
import type { FileAttachment } from '@/types';
import { api, API_BASE } from '@/lib/api';
import {
  DOCUMENT_TIPO_LABELS,
  isExtractableDocumentFile,
} from '@/lib/fileUtils';
import {
  flotaProspectoUploadArchivo,
  type FlotaArchivoExtraction,
} from '@/lib/flotaProspectosApi';
import { notifyFlotaProspectosRefresh } from '@/lib/flotaProspectosRealtime';

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

export type FlotaUploadStatus = {
  message: string;
  current: number;
  total: number;
} | null;

function uploadMessage(file: File, index: number, total: number): string {
  const suffix = total > 1 ? ` (${index}/${total})` : '';
  if (isExtractableDocumentFile(file)) {
    return `Subiendo y analizando documento${suffix}…`;
  }
  return `Subiendo archivo${suffix}…`;
}

function toastExtraction(extraction: FlotaArchivoExtraction | null | undefined) {
  if (!extraction?.tipoDocumento || extraction.tipoDocumento === 'otro') return;
  const label =
    DOCUMENT_TIPO_LABELS[extraction.tipoDocumento] ?? extraction.tipoDocumento;
  toast.success(`Documento identificado: ${label}`);
}

export interface UseFlotaArchivosReturn {
  loading: boolean;
  uploadStatus: FlotaUploadStatus;
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
  const [uploadStatus, setUploadStatus] = useState<FlotaUploadStatus>(null);
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
      const total = uploadedFiles.length;
      let extracted = 0;
      try {
        for (let i = 0; i < uploadedFiles.length; i++) {
          const f = uploadedFiles[i];
          setUploadStatus({
            message: uploadMessage(f, i + 1, total),
            current: i + 1,
            total,
          });
          const res = await flotaProspectoUploadArchivo(prospectoId, f);
          if (res.extraction?.tipoDocumento && res.extraction.tipoDocumento !== 'otro') {
            extracted++;
            toastExtraction(res.extraction);
          }
        }
        const noun = total === 1 ? 'archivo' : 'archivos';
        toast.success(
          extracted > 0
            ? `${total} ${noun} subido(s); ${extracted} documento(s) analizado(s)`
            : `${total} ${noun} subido(s)`,
        );
        notifyFlotaProspectosRefresh(prospectoId);
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al subir');
      } finally {
        setUploadStatus(null);
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
    uploadStatus,
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
