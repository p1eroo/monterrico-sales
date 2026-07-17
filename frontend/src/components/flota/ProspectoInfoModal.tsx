import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { FormDialogShell } from "@/components/ui/form-dialog";
import { formatDateDMY } from "@/lib/formatters";
import {
  flotaProspectoDetail,
  getOperatorDisplayName,
  type FlotaProspectoRow,
  type OperadorUser,
} from "@/lib/flotaProspectosApi";
import { useFlotaProspectosRealtime } from "@/lib/flotaProspectosRealtime";

const estadoColors: Record<string, string> = {
  Nuevo: "text-gray-700 dark:text-gray-300",
  Afiliado: "text-purple-700 dark:text-purple-300",
  Citado: "text-blue-700 dark:text-blue-300",
  Seguimiento: "text-green-700 dark:text-green-300",
  Informacion: "text-cyan-700 dark:text-cyan-300",
  "Sin Requisitos": "text-red-700 dark:text-red-300",
  "No Responde": "text-yellow-700 dark:text-yellow-300",
};

interface ProspectoInfoModalProps {
  prospecto: FlotaProspectoRow | null;
  operadores: OperadorUser[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function InfoField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-semibold text-foreground/90">{label}</dt>
      <dd className={`mt-1 text-sm text-muted-foreground break-words ${className ?? ""}`}>
        {value || "—"}
      </dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60 pb-2">
        {title}
      </h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        {children}
      </dl>
    </section>
  );
}

export function ProspectoInfoModal({
  prospecto: prospectoProp,
  operadores,
  open,
  onOpenChange,
}: ProspectoInfoModalProps) {
  const [prospecto, setProspecto] = useState<FlotaProspectoRow | null>(prospectoProp);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setProspecto(prospectoProp);
  }, [prospectoProp]);

  const fetchDetail = useCallback(
    (id: string, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      return flotaProspectoDetail(id)
        .then((row) => {
          setProspecto(row);
          return row;
        })
        .catch(() => {
          setProspecto(prospectoProp);
          return null;
        })
        .finally(() => {
          if (!opts?.silent) setLoading(false);
        });
    },
    [prospectoProp],
  );

  useEffect(() => {
    if (!open || !prospectoProp?.id) return;
    let cancelled = false;
    void fetchDetail(prospectoProp.id).finally(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [open, prospectoProp?.id, fetchDetail]);

  useFlotaProspectosRealtime((event) => {
    if (!open || !prospectoProp?.id) return;
    if (event?.prospectoId && event.prospectoId !== prospectoProp.id) return;
    void fetchDetail(prospectoProp.id, { silent: true });
  });

  if (!prospecto) return null;

  const operador =
    getOperatorDisplayName(prospecto.operador, operadores) ||
    prospecto.operador ||
    "—";
  const estadoClass = estadoColors[prospecto.estado] || "";

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Información del prospecto"
      description={prospecto.nombreCompleto}
      maxWidthClassName="sm:max-w-2xl"
      bodyClassName="space-y-6 pb-4"
      footer={null}
    >
      <div className="flex flex-wrap items-center gap-2">
        {loading ? (
          <Badge variant="secondary" className="text-[10px] font-normal">
            Actualizando…
          </Badge>
        ) : null}
        <Badge variant="outline" className={`text-xs font-medium ${estadoClass}`}>
          {prospecto.estado}
        </Badge>
        {prospecto.esDuplicado && (
          <Badge variant="destructive" className="text-xs">
            Duplicado
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          Origen: {prospecto.origen}
        </span>
      </div>

      <Section title="Datos personales">
        <InfoField
          label="Nombres y apellidos"
          value={prospecto.nombreCompleto}
          className="font-medium text-foreground"
        />
        <InfoField label="DNI" value={prospecto.dni || "—"} />
        <InfoField label="Edad" value={prospecto.edad != null ? String(prospecto.edad) : "—"} />
        <InfoField label="Celular" value={prospecto.celular || "—"} />
      </Section>

      <Section title="Proceso y seguimiento">
        <InfoField label="Operador" value={operador} />
        <InfoField label="Red social / fuente" value={prospecto.redSocial || "—"} />
        <InfoField
          label="F. registro"
          value={prospecto.fechaRegistro ? formatDateDMY(prospecto.fechaRegistro) : "—"}
        />
        <InfoField
          label="F. cita"
          value={
            prospecto.fechaCita
              ? `${formatDateDMY(prospecto.fechaCita)} ${new Date(prospecto.fechaCita).toLocaleTimeString("es-PE", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "America/Lima",
                })}`
              : "—"
          }
        />
        <InfoField label="Asistencia" value={prospecto.asistencia || "—"} />
        <InfoField
          label="Llamadas registradas"
          value={String(prospecto._count?.llamadas ?? 0)}
        />
      </Section>

      <Section title="Vehículo">
        <InfoField label="Modalidad" value={prospecto.modalidad || "—"} />
        <InfoField label="Placa" value={prospecto.placa || "—"} />
        <InfoField
          label="Año vehículo"
          value={prospecto.anioVehiculo != null ? String(prospecto.anioVehiculo) : "—"}
        />
        <InfoField label="Aire acondicionado" value={prospecto.aireAcondicionado || "—"} />
        <InfoField label="Categoría" value={prospecto.categoriaVehiculo || "—"} />
        <InfoField label="Marca" value={prospecto.marca || "—"} />
        <InfoField label="Modelo" value={prospecto.modelo || "—"} />
        <InfoField label="Color" value={prospecto.color || "—"} />
        <InfoField label="Combustible" value={prospecto.combustible || "—"} />
      </Section>

      <Section title="Ubicación">
        <InfoField label="Distrito" value={prospecto.distrito || "—"} />
        <InfoField label="Ciudad" value={prospecto.ciudad || "—"} />
      </Section>

      <Section title="Información adicional">
        <InfoField
          label="Archivos adjuntos"
          value={String(prospecto._count?.archivos ?? 0)}
        />
        <div className="sm:col-span-2">
          <InfoField
            label="Observaciones"
            value={(prospecto.observaciones || "").replace(/\n---\n/g, "\n").trim() || "—"}
          />
        </div>
      </Section>
    </FormDialogShell>
  );
}
