import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileArchive } from "lucide-react";
import { FileUploadArea } from "@/components/files/FileUploadArea";
import { FileListItem } from "@/components/files/FileListItem";
import { FilePreviewModal } from "@/components/files/FilePreviewModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { useFlotaArchivos } from "@/lib/useFlotaArchivos";
import type { FileAttachment } from "@/types";

interface ProspectoArchivosModalProps {
  prospectoId: string | null;
  prospectoNombre?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilesLoad?: (prospectoId: string, fileCount: number) => void;
}

export function ProspectoArchivosModal({
  prospectoId,
  prospectoNombre,
  open,
  onOpenChange,
  onFilesLoad,
}: ProspectoArchivosModalProps) {
  const {
    loading,
    files,
    handleUpload,
    handleView,
    handleDownload,
    handleDelete,
    previewFile,
    previewOpen,
    setPreviewOpen,
  } = useFlotaArchivos(open ? prospectoId : null);

  const [filePendingDelete, setFilePendingDelete] = useState<FileAttachment | null>(null);

  useEffect(() => {
    if (prospectoId && !loading) {
      onFilesLoad?.(prospectoId, files.length);
    }
  }, [prospectoId, loading, files.length, onFilesLoad]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Archivos del prospecto
            {prospectoNombre ? (
              <span className="font-normal text-muted-foreground text-sm">
                — {prospectoNombre}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Fotos, documentos y archivos subidos por el contacto o el operador.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4">
          <FileUploadArea onUpload={handleUpload} className="min-h-[100px]" />

          {loading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Cargando archivos…
            </p>
          ) : files.length === 0 ? (
            <EmptyState
              icon={FileArchive}
              title="No hay archivos adjuntos"
              description="Los archivos que subas quedarán asociados a este prospecto."
            />
          ) : (
            <div className="divide-y divide-border">
              {files.map((f) => (
                <FileListItem
                  key={f.id}
                  file={f}
                  onView={handleView}
                  onDownload={handleDownload}
                  onDelete={(file) => setFilePendingDelete(file)}
                  canDelete
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>

      <ConfirmDialog
        open={filePendingDelete !== null}
        onOpenChange={(v) => {
          if (!v) setFilePendingDelete(null);
        }}
        title="Eliminar Archivo"
        description="¿Estás seguro que deseas eliminar este archivo? Esta acción no se puede deshacer."
        onConfirm={() => {
          const f = filePendingDelete;
          if (f) void handleDelete(f);
        }}
        variant="destructive"
      />

      <FilePreviewModal
        file={previewFile}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onDownload={handleDownload}
      />
    </Dialog>
  );
}
