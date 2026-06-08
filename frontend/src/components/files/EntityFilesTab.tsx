import { useState } from 'react';
import { FileArchive } from 'lucide-react';
import type { FileEntityType, FileAttachment } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FileUploadArea } from './FileUploadArea';
import { FileListItem } from './FileListItem';
import { FilePreviewModal } from './FilePreviewModal';
import { useEntityFiles, type UseEntityFilesReturn } from './useEntityFiles';

interface EntityFilesTabProps {
  entityType: FileEntityType;
  entityId: string;
  entityName?: string;
}

export function EntityFilesListSection({
  state,
  emptyVariant = 'full',
}: {
  state: UseEntityFilesReturn;
  emptyVariant?: 'full' | 'compact';
}) {
  const {
    loading,
    files,
    canDelete,
    handleView,
    handleDownload,
    handleDelete,
    previewFile,
    previewOpen,
    setPreviewOpen,
  } = state;

  const [filePendingDelete, setFilePendingDelete] = useState<FileAttachment | null>(
    null,
  );

  if (loading) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Cargando archivos…
      </p>
    );
  }

  if (files.length === 0) {
    if (emptyVariant === 'compact') {
      return (
        <p className="py-2 text-sm text-muted-foreground">Sin archivos adjuntos</p>
      );
    }
    return (
      <EmptyState
        icon={FileArchive}
        title="No hay archivos adjuntos"
        description={
          state.canCreate
            ? 'Los archivos que subas quedarán asociados a este registro y se listarán aquí'
            : 'Aún no hay archivos para esta entidad'
        }
      />
    );
  }

  return (
    <>
      <div className="divide-y divide-border">
        {files.map((f) => (
          <FileListItem
            key={f.id}
            file={f}
            onView={handleView}
            onDownload={handleDownload}
            onDelete={canDelete ? (file) => setFilePendingDelete(file) : undefined}
            canDelete={canDelete}
          />
        ))}
      </div>
      <ConfirmDialog
        open={filePendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setFilePendingDelete(null);
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
    </>
  );
}

/** Solo zona de arrastre / selección (p. ej. pestaña Archivos en detalle de contacto). */
export function EntityFilesUploadSection({
  state,
}: {
  state: UseEntityFilesReturn;
}) {
  const { entityIdValid, canCreate, handleUpload } = state;

  if (!entityIdValid) {
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
    </div>
  );
}

export function EntityFilesTab({
  entityType,
  entityId,
  entityName,
}: EntityFilesTabProps) {
  const state = useEntityFiles({ entityType, entityId, entityName });

  if (!state.entityIdValid) {
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
      {state.canCreate && (
        <FileUploadArea onUpload={state.handleUpload} className="min-h-[120px]" />
      )}
      <EntityFilesListSection state={state} emptyVariant="full" />
    </div>
  );
}
