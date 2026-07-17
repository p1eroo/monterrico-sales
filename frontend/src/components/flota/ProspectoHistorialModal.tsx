import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { FormDialogShell } from "@/components/ui/form-dialog";
import { TimelinePanel } from "@/components/shared/TimelinePanel";
import {
  getOperatorDisplayName,
  type FlotaProspectoRow,
  type OperadorUser,
} from "@/lib/flotaProspectosApi";
import type { TimelineEvent } from "@/types";

interface ProspectoHistorialModalProps {
  prospecto: FlotaProspectoRow | null;
  operadores: OperadorUser[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatEventDate(date: string | Date): string {
  return new Date(date).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildMockHistorial(
  prospecto: FlotaProspectoRow,
  operadores: OperadorUser[],
): TimelineEvent[] {
  const operador =
    getOperatorDisplayName(prospecto.operador, operadores) ||
    prospecto.operador ||
    "Operador";
  const created = new Date(prospecto.createdAt);
  const updated = new Date(prospecto.updatedAt);
  const events: TimelineEvent[] = [
    {
      id: `${prospecto.id}-crear`,
      type: "crear",
      title: "Registro en el sistema",
      description:
        prospecto.origen === "IMPORTADO"
          ? "Prospecto importado desde planilla de Google Sheets."
          : "Prospecto creado manualmente desde el formulario.",
      user: "Sistema",
      date: formatEventDate(created),
    },
  ];

  if (prospecto.operador) {
    events.push({
      id: `${prospecto.id}-asignar`,
      type: "asignar",
      title: "Asignación de operador",
      description: `El prospecto fue asignado a ${operador}.`,
      user: "Coordinación",
      date: formatEventDate(prospecto.asignadoAt || created),
    });
  }

  if (prospecto.estado && prospecto.estado !== "Nuevo") {
    events.push({
      id: `${prospecto.id}-estado`,
      type: "cambio_estado",
      title: "Cambio de estado",
      description: `Estado actualizado a «${prospecto.estado}».`,
      user: operador,
      date: formatEventDate(updated),
    });
  }

  if (prospecto.fechaCita) {
    events.push({
      id: `${prospecto.id}-cita`,
      type: "tarea",
      title: "Cita programada",
      description: `Cita agendada para el ${formatEventDate(prospecto.fechaCita)}.`,
      user: operador,
      date: formatEventDate(prospecto.fechaCita),
    });
  }

  if ((prospecto._count?.llamadas ?? 0) > 0) {
    events.push({
      id: `${prospecto.id}-llamada`,
      type: "llamada",
      title: "Llamada registrada",
      description: `Se registró contacto telefónico con el prospecto (${prospecto._count?.llamadas} llamada(s) en total).`,
      user: operador,
      date: formatEventDate(updated),
    });
  }

  events.push({
    id: `${prospecto.id}-whatsapp`,
    type: "whatsapp",
    title: "Mensaje de WhatsApp",
    description: "Se envió plantilla de bienvenida y requisitos de afiliación.",
    user: operador,
    date: formatEventDate(new Date(created.getTime() + 2 * 60 * 60 * 1000)),
  });

  if (prospecto.observaciones?.trim()) {
    events.push({
      id: `${prospecto.id}-nota`,
      type: "nota",
      title: "Nota agregada",
      description: prospecto.observaciones.split("\n---\n").pop()?.trim() || prospecto.observaciones,
      user: operador,
      date: formatEventDate(updated),
    });
  }

  if ((prospecto._count?.archivos ?? 0) > 0) {
    events.push({
      id: `${prospecto.id}-archivo`,
      type: "archivo",
      title: "Documentos subidos",
      description: `${prospecto._count?.archivos} archivo(s) adjunto(s) al expediente.`,
      user: operador,
      date: formatEventDate(updated),
    });
  }

  if (prospecto.fechaAfiliacion) {
    events.push({
      id: `${prospecto.id}-afiliacion`,
      type: "actualizar",
      title: "Afiliación completada",
      description: `Prospecto afiliado el ${formatEventDate(prospecto.fechaAfiliacion)}.`,
      user: operador,
      date: formatEventDate(prospecto.fechaAfiliacion),
    });
  }

  return events.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export function ProspectoHistorialModal({
  prospecto,
  operadores,
  open,
  onOpenChange,
}: ProspectoHistorialModalProps) {
  const events = useMemo(
    () => (prospecto ? buildMockHistorial(prospecto, operadores) : []),
    [prospecto, operadores],
  );

  if (!prospecto) return null;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Historial del prospecto"
      description={prospecto.nombreCompleto}
      maxWidthClassName="sm:max-w-xl"
      bodyClassName="pb-4"
      footer={null}
    >
      <Badge variant="secondary" className="mb-4 text-[10px] font-normal">
        Vista previa — eventos simulados
      </Badge>
      <TimelinePanel events={events} />
    </FormDialogShell>
  );
}
