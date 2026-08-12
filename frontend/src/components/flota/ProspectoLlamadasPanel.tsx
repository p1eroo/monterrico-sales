import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { LlamadaSvgIcon } from "@/components/icons/LlamadaSvgIcon";
import { flotaLlamadasList, type FlotaLlamada } from "@/lib/flotaProspectosApi";
import { toast } from "@/lib/notify";
import { cn } from "@/lib/utils";

function formatLlamadaDate(iso: string): string {
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ProspectoLlamadasPanelProps {
  prospectoId: string;
  enabled?: boolean;
  onCountChange?: (count: number) => void;
}

export function ProspectoLlamadasPanel({
  prospectoId,
  enabled = true,
  onCountChange,
}: ProspectoLlamadasPanelProps) {
  const [llamadas, setLlamadas] = useState<FlotaLlamada[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLlamadas = useCallback(async () => {
    if (!prospectoId) return;
    setLoading(true);
    try {
      const data = await flotaLlamadasList(prospectoId);
      const sorted = [...data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setLlamadas(sorted);
      onCountChange?.(sorted.length);
    } catch {
      toast.error("No se pudieron cargar las llamadas");
    } finally {
      setLoading(false);
    }
  }, [prospectoId, onCountChange]);

  useEffect(() => {
    if (enabled && prospectoId) {
      void fetchLlamadas();
    }
  }, [enabled, prospectoId, fetchLlamadas]);

  return (
    <div>
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : llamadas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/15 px-6 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-activity-call/15 ring-1 ring-inset ring-activity-call/30">
            <LlamadaSvgIcon className="size-6 text-activity-call" />
          </span>
          <p className="mt-3 text-sm font-medium text-foreground">Sin llamadas registradas</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Aún no hay llamadas guardadas para este prospecto.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {llamadas.map((llamada) => (
            <article
              key={llamada.id}
              className="rounded-xl border border-border/70 bg-muted/20 p-3.5 sm:p-4"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                    "bg-activity-call/15 ring-1 ring-inset ring-activity-call/30",
                  )}
                >
                  <LlamadaSvgIcon className="size-4 text-activity-call" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {llamada.userName || "Operador"}
                    </p>
                    <time
                      className="text-[11px] tabular-nums text-muted-foreground"
                      dateTime={llamada.createdAt}
                    >
                      {formatLlamadaDate(llamada.createdAt)}
                    </time>
                  </div>
                  {llamada.notas?.trim() ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {llamada.notas.trim()}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm italic text-muted-foreground">Sin notas</p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
