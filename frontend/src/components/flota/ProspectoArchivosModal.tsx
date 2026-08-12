import { FormDialogShell } from "@/components/ui/form-dialog";
import { ProspectoArchivosPanel } from "@/components/flota/ProspectoArchivosPanel";
import { useState } from "react";

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
  const [dismissBlocked, setDismissBlocked] = useState(false);

  const title = prospectoNombre
    ? `Archivos — ${prospectoNombre}`
    : "Archivos del prospecto";

  const handleOpenChange = (next: boolean) => {
    if (!next && dismissBlocked) return;
    onOpenChange(next);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description="Fotos, documentos y archivos subidos por el contacto o el operador."
      maxWidthClassName="sm:max-w-4xl"
      bodyClassName="space-y-5 pb-4"
      footer={null}
      suspendOutsideDismiss={dismissBlocked}
    >
      <ProspectoArchivosPanel
        prospectoId={prospectoId}
        enabled={open}
        onFilesLoad={onFilesLoad}
        onBlockDismissChange={setDismissBlocked}
      />
    </FormDialogShell>
  );
}
