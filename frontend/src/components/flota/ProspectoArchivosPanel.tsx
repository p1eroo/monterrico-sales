import { useState, useEffect, useRef } from "react";
import { FileArchive, Loader2 } from "lucide-react";
import { FileUploadArea } from "@/components/files/FileUploadArea";
import { FilePreviewModal } from "@/components/files/FilePreviewModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SimpleImagePreviewDialog } from "@/components/shared/SimpleImagePreviewDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FlotaArchivoPreviewCard } from "@/components/flota/FlotaArchivoPreviewCard";
import { useFlotaArchivos } from "@/lib/useFlotaArchivos";
import type { FileAttachment } from "@/types";

function isImageFile(file: FileAttachment): boolean {
  return file.mimeType.startsWith("image/");
}

interface ProspectoArchivosPanelProps {
  prospectoId: string | null;
  enabled?: boolean;
  onFilesLoad?: (prospectoId: string, fileCount: number) => void;
  onBlockDismissChange?: (blocked: boolean) => void;
}

export function ProspectoArchivosPanel({
  prospectoId,
  enabled = true,
  onFilesLoad,
  onBlockDismissChange,
}: ProspectoArchivosPanelProps) {
  const activeId = enabled && prospectoId ? prospectoId : null;
  const {
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
  } = useFlotaArchivos(activeId);

  const [filePendingDelete, setFilePendingDelete] = useState<FileAttachment | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const onFilesLoadRef = useRef(onFilesLoad);
  const previewUrlsRef = useRef<Record<string, string>>({});

  const previewIsImage = previewFile ? isImageFile(previewFile) : false;
  const pdfPreviewOpen = previewOpen && previewFile && !previewIsImage;

  useEffect(() => {
    onFilesLoadRef.current = onFilesLoad;
  });

  useEffect(() => {
    if (prospectoId && !loading) {
      onFilesLoadRef.current?.(prospectoId, files.length);
    }
  }, [prospectoId, loading, files.length]);

  useEffect(() => {
    onBlockDismissChange?.(filePendingDelete !== null || previewOpen || !!uploadStatus);
  }, [filePendingDelete, previewOpen, uploadStatus, onBlockDismissChange]);

  useEffect(() => {
    if (!enabled || loading || files.length === 0) {
      setPreviewUrls((prev) => {
        Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
        previewUrlsRef.current = {};
        return {};
      });
      return;
    }

    let cancelled = false;
    const imageFiles = files.filter((f) => f.mimeType.startsWith("image/"));

    void Promise.all(
      imageFiles.map(async (file) => {
        try {
          const url = await fetchBlobUrl(file.id, "inline");
          return [file.id, url] as const;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      if (cancelled) {
        entries.forEach((entry) => {
          if (entry) URL.revokeObjectURL(entry[1]);
        });
        return;
      }
      setPreviewUrls((prev) => {
        Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
        const next: Record<string, string> = {};
        for (const entry of entries) {
          if (entry) next[entry[0]] = entry[1];
        }
        previewUrlsRef.current = next;
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, loading, files, fetchBlobUrl]);

  useEffect(() => {
    return () => {
      Object.values(previewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setPreviewOpen(false);
      setPreviewImageUrl(null);
      setFilePendingDelete(null);
    }
  }, [enabled, setPreviewOpen]);

  useEffect(() => {
    if (!previewOpen || !previewFile || !previewIsImage) {
      setPreviewImageUrl(null);
      setPreviewLoading(false);
      return;
    }

    const cached = previewUrls[previewFile.id];
    if (cached) {
      setPreviewImageUrl(cached);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    void fetchBlobUrl(previewFile.id, "inline")
      .then((url) => {
        if (!cancelled) setPreviewImageUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewImageUrl(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [previewOpen, previewFile, previewIsImage, previewUrls, fetchBlobUrl]);

  return (
    <>
      <FileUploadArea
        onUpload={handleUpload}
        disabled={loading || !activeId}
        busy={!!uploadStatus}
        busyMessage={uploadStatus?.message}
        className="min-h-[88px] rounded-xl border-dashed border-border/80 p-4"
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <p className="text-sm">Cargando archivos…</p>
        </div>
      ) : files.length === 0 ? (
        <EmptyState
          icon={FileArchive}
          title="No hay archivos adjuntos"
          description="Sube fotos, documentos o PDFs asociados a este prospecto."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {files.map((file) => (
            <FlotaArchivoPreviewCard
              key={file.id}
              file={file}
              previewUrl={previewUrls[file.id]}
              onView={handleView}
              onDownload={handleDownload}
              onDelete={(f) => setFilePendingDelete(f)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={filePendingDelete !== null}
        onOpenChange={(v) => {
          if (!v) setFilePendingDelete(null);
        }}
        title="Eliminar archivo"
        description="¿Estás seguro que deseas eliminar este archivo? Esta acción no se puede deshacer."
        onConfirm={() => {
          const f = filePendingDelete;
          if (f) void handleDelete(f);
        }}
        variant="destructive"
        nested
      />

      <SimpleImagePreviewDialog
        nested
        open={previewOpen && previewIsImage}
        onOpenChange={setPreviewOpen}
        imageUrl={previewImageUrl}
        loading={previewLoading}
        alt={previewFile?.name}
        onDownload={previewFile ? () => void handleDownload(previewFile) : undefined}
      />

      <FilePreviewModal
        file={previewFile}
        open={!!pdfPreviewOpen}
        onOpenChange={setPreviewOpen}
        onDownload={handleDownload}
        fetchBlobUrl={fetchBlobUrl}
      />
    </>
  );
}
