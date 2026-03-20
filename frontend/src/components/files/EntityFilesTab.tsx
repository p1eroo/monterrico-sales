import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { FileArchive } from 'lucide-react';
import { useFilesStore } from '@/store/filesStore';
import { useAppStore } from '@/store';
import type { FileAttachment, FileEntityType } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { FileUploadArea } from './FileUploadArea';
import { FileListItem } from './FileListItem';
import { FilePreviewModal } from './FilePreviewModal';

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
  const { currentUser } = useAppStore();
  const { getFilesByEntity, addFile, deleteFile } = useFilesStore();
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const files = getFilesByEntity(entityType, entityId);

  const handleUpload = useCallback(
    (uploadedFiles: File[]) => {
      for (const f of uploadedFiles) {
        addFile({
          name: f.name,
          size: f.size,
          mimeType: f.type || 'application/octet-stream',
          entityType,
          entityId,
          entityName,
          uploadedBy: currentUser.id,
        });
      }
      toast.success(`${uploadedFiles.length} archivo(s) subido(s)`);
    },
    [addFile, entityType, entityId, entityName, currentUser.id]
  );

  const handleView = useCallback((file: FileAttachment) => {
    setPreviewFile(file);
    setPreviewOpen(true);
  }, []);

  const handleDownload = useCallback((file: FileAttachment) => {
    const blob = new Blob(['Mock file content'], { type: file.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Descarga iniciada');
  }, []);

  const handleDelete = useCallback(
    (file: FileAttachment) => {
      deleteFile(file.id);
      toast.success('Archivo eliminado');
      if (previewFile?.id === file.id) {
        setPreviewOpen(false);
        setPreviewFile(null);
      }
    },
    [deleteFile, previewFile]
  );

  return (
    <div className="space-y-4">
      <FileUploadArea onUpload={handleUpload} className="min-h-[120px]" />

      {files.length === 0 ? (
        <EmptyState
          icon={FileArchive}
          title="No hay archivos adjuntos"
          description="Los archivos que subas aparecerán aquí"
        />
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <FileListItem
              key={file.id}
              file={file}
              onView={handleView}
              onDownload={handleDownload}
              onDelete={handleDelete}
              canDelete
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
