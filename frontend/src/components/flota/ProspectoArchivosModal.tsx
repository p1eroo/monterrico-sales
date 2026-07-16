import { useEffect, useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EntityFilesTab } from "@/components/files/EntityFilesTab";
import { flotaProspectoConArchivos } from "@/lib/flotaProspectosApi";
import { Loader2 } from "lucide-react";

interface ProspectoArchivosModalProps {
  prospectoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProspectoArchivosModal({
  prospectoId,
  open,
  onOpenChange,
}: ProspectoArchivosModalProps) {
  const [prospectoNombre, setProspectoNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const loadNombre = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await flotaProspectoConArchivos(id);
      if (mountedRef.current) {
        setProspectoNombre(res.prospecto.nombreCompleto || "");
      }
    } catch {
      if (mountedRef.current) setProspectoNombre("");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!prospectoId || !open) {
      setProspectoNombre("");
      setLoading(false);
      return () => { mountedRef.current = false; };
    }
    void loadNombre(prospectoId);
    return () => { mountedRef.current = false; };
  }, [prospectoId, open, loadNombre]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Archivos del prospecto
            {loading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : prospectoNombre ? (
              <span className="font-normal text-muted-foreground text-sm">
                — {prospectoNombre}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Fotos, documentos y archivos subidos por el contacto o el operador.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {prospectoId && (
            <EntityFilesTab
              entityType="flota-prospecto"
              entityId={prospectoId}
              entityName={prospectoNombre}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
