import { useEffect, useState } from "react";
import { Eye, FileText, Loader2 } from "lucide-react";
import type { Conductor } from "@/lib/flotaConductoresApi";
import {
  CONDUCTOR_DOCUMENTO_ITEMS,
  getConductorDocumentacion,
  type ConductorDocumentacion,
} from "@/lib/flotaConductoresApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConductorDocumentosDialogProps = {
  conductor: Conductor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type DocumentPreview = {
  url: string;
  label: string;
};

function hasDocumentUrl(url?: string): url is string {
  return Boolean(url?.trim());
}

function DocumentCard({
  label,
  url,
  onView,
}: {
  label: string;
  url?: string;
  onView: (url: string, label: string) => void;
}) {
  const available = hasDocumentUrl(url);

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-card shadow-none">
      <p className="border-b border-border/50 px-3 py-2 text-[12px] font-medium text-foreground">
        {label}
      </p>
      <button
        type="button"
        disabled={!available}
        onClick={() => available && onView(url, label)}
        className={cn(
          "flex aspect-[4/3] w-full items-center justify-center bg-muted/30 p-3 transition-colors",
          available && "cursor-pointer hover:bg-muted/50",
          !available && "cursor-default",
        )}
      >
        {available ? (
          <img
            src={url}
            alt={label}
            className="max-h-full max-w-full rounded object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <FileText className="size-8 opacity-40" />
            <span className="text-[11px]">Sin documento</span>
          </div>
        )}
      </button>
      <div className="grid grid-cols-1 border-t border-border/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!available}
          onClick={() => available && onView(url, label)}
          className="h-9 rounded-none text-[12px] text-muted-foreground hover:text-foreground"
        >
          <Eye className="size-3.5" />
          Ver
        </Button>
      </div>
    </div>
  );
}

export function ConductorDocumentosDialog({
  conductor,
  open,
  onOpenChange,
}: ConductorDocumentosDialogProps) {
  const [documentacion, setDocumentacion] = useState<ConductorDocumentacion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);

  useEffect(() => {
    if (!open || !conductor?.idasociado) {
      setDocumentacion(null);
      setError(null);
      setPreview(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getConductorDocumentacion(conductor.idasociado)
      .then((response) => {
        if (cancelled) return;
        setDocumentacion(response.ODocumentacion);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDocumentacion(null);
        setError(err instanceof Error ? err.message : "Error al cargar documentos");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, conductor?.idasociado]);

  if (!conductor) return null;

  const nombreCompleto =
    `${conductor.nombres ?? ""} ${conductor.apellidos ?? ""}`.trim() || "Conductor";
  const subtitle = [nombreCompleto, conductor.codigo].filter(Boolean).join(" · ");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] w-[min(96vw,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 border-b border-border/50 px-5 py-4 text-left">
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FileText className="size-4" />
              </span>
              Documentos
            </DialogTitle>
            <DialogDescription className="text-[13px]">{subtitle}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
                <p className="text-sm">Cargando documentos…</p>
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            ) : documentacion ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {CONDUCTOR_DOCUMENTO_ITEMS.map(({ key, label }) => (
                  <DocumentCard
                    key={key}
                    label={label}
                    url={documentacion[key]}
                    onView={(url, docLabel) => setPreview({ url, label: docLabel })}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={preview != null} onOpenChange={() => setPreview(null)}>
        <DialogContent className="flex max-h-[95vh] w-[min(96vw,48rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border/50 px-5 py-3 text-left">
            <DialogTitle className="text-sm">{preview?.label}</DialogTitle>
            <DialogDescription className="sr-only">Vista ampliada del documento</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-[50vh] items-center justify-center overflow-auto bg-muted/20 p-4">
            {preview ? (
              <img
                src={preview.url}
                alt={preview.label}
                className="max-h-[80vh] max-w-full rounded object-contain"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
