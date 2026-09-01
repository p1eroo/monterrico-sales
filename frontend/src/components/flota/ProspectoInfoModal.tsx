import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileArchive,
  History,
  Info,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormDialogActions,
  FormDialogField,
  FormDialogGrid,
  FormDialogShell,
  formDialogInputClass,
  formDialogNestedContentClass,
  formDialogNestedOverlayClass,
} from "@/components/ui/form-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimelinePanel } from "@/components/shared/TimelinePanel";
import { InlineEditCell } from "@/components/shared/InlineEditCell";
import { ProspectoArchivosPanel } from "@/components/flota/ProspectoArchivosPanel";
import { ProspectoLlamadasPanel } from "@/components/flota/ProspectoLlamadasPanel";
import { LlamadaSvgIcon } from "@/components/icons/LlamadaSvgIcon";
import { formatDateDMY } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/notify";
import {
  CIUDAD_OPTIONS,
  flotaProspectoDetail,
  flotaProspectoUpdate,
  getOperatorDisplayName,
  MODALIDAD_OPTIONS,
  type FlotaProspectoRow,
  type OperadorUser,
} from "@/lib/flotaProspectosApi";
import { notifyFlotaProspectosRefresh, useFlotaProspectosRealtime } from "@/lib/flotaProspectosRealtime";
import { buildProspectoHistorialEvents } from "@/components/flota/ProspectoHistorialModal";
import { useAppStore } from "@/store";

const ESTADO_OPTIONS = [
  { label: "Nuevo", value: "Nuevo" },
  { label: "Afiliado", value: "Afiliado" },
  { label: "Citado", value: "Citado" },
  { label: "Seguimiento", value: "Seguimiento" },
  { label: "Información", value: "Informacion" },
  { label: "Sin Requisitos", value: "Sin Requisitos" },
  { label: "No Responde", value: "No Responde" },
];

const AIRE_OPTIONS = [
  { label: "SI", value: "SI" },
  { label: "No", value: "No" },
];

const ASISTENCIA_OPTIONS = [
  { label: "Asistió", value: "Asistió" },
  { label: "No Asistió", value: "No Asistió" },
];

const estadoHeaderBadgeClass: Record<string, string> = {
  Nuevo: "border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200",
  Afiliado: "border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-200",
  Citado: "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
  Seguimiento: "border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950/60 dark:text-green-200",
  Informacion: "border-cyan-200 bg-cyan-100 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200",
  "Sin Requisitos": "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200",
  "No Responde": "border-yellow-200 bg-yellow-100 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-200",
};

interface ProspectoInfoModalProps {
  prospecto: FlotaProspectoRow | null;
  operadores: OperadorUser[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilesLoad?: (prospectoId: string, fileCount: number) => void;
  /** Notifica al padre tras un guardado inline (p. ej. refrescar fila de la tabla). */
  onUpdated?: (row: FlotaProspectoRow) => void;
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  const time = d.toLocaleTimeString("en-GB", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date}T${time}`;
}

function latestObservacion(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  return raw.split("\n---\n")[0]?.replace(/^(?:\[.+?\]\s*)+/, "").trim() ?? "";
}

function ProspectoModalTabIcon({
  icon: Icon,
  llamada,
  wrapClass,
  iconClass,
}: {
  icon?: LucideIcon;
  llamada?: boolean;
  wrapClass: string;
  iconClass: string;
}) {
  return (
    <span
      className={cn(
        "tab-icon flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-all duration-200",
        wrapClass,
      )}
    >
      {llamada ? (
        <LlamadaSvgIcon className={cn("size-3.5", iconClass)} />
      ) : Icon ? (
        <Icon className={cn("size-3.5", iconClass)} />
      ) : null}
    </span>
  );
}

function ProspectoModalTabTrigger({
  value,
  label,
  icon,
  llamada,
  wrapClass,
  iconClass,
  activeAccentClass,
  count,
}: {
  value: string;
  label: string;
  icon?: LucideIcon;
  llamada?: boolean;
  wrapClass: string;
  iconClass: string;
  activeAccentClass: string;
  count?: number;
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "group/tab relative flex flex-1 flex-row items-center justify-center gap-2 rounded-none px-1.5 py-2.5",
        "border-b-2 border-transparent -mb-px",
        "text-[11px] font-medium leading-none text-muted-foreground sm:px-2.5 sm:text-xs",
        "transition-colors duration-200",
        "hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-2",
        "data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none",
        "data-[state=inactive]:[&_.tab-icon]:opacity-70",
        "group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:px-1.5 group-data-[variant=line]/tabs-list:py-2.5",
        "group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none",
        activeAccentClass,
      )}
    >
      <ProspectoModalTabIcon
        icon={icon}
        llamada={llamada}
        wrapClass={wrapClass}
        iconClass={iconClass}
      />
      <span className="flex items-center gap-1">
        <span className="truncate">{label}</span>
        {count != null && count > 0 ? (
          <span
            className={cn(
              "tab-badge inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1",
              "bg-muted/90 text-[10px] font-semibold tabular-nums text-muted-foreground",
            )}
          >
            {count}
          </span>
        ) : null}
      </span>
    </TabsTrigger>
  );
}

function InfoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2.5 text-[13px] font-semibold text-foreground">{title}</h3>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function EditableField({
  label,
  value,
  fieldId,
  fieldKey,
  type = "text",
  options,
  className,
  fullWidth,
  readonly,
  display,
  onSaved,
  onSaveOverride,
}: {
  label: string;
  value: string | number | null | undefined;
  fieldId: string;
  fieldKey: string;
  type?: "text" | "number" | "select" | "date" | "datetime-local" | "readonly";
  options?: { label: string; value: string }[];
  className?: string;
  fullWidth?: boolean;
  readonly?: boolean;
  display?: React.ReactNode;
  onSaved?: (fieldKey: string, newValue: string | null) => void;
  onSaveOverride?: (rawValue: string) => Promise<void>;
}) {
  return (
    <div className={cn("min-w-0 space-y-2", fullWidth && "sm:col-span-2")}>
      <dt className="text-xs font-medium leading-none text-muted-foreground">{label}</dt>
      <dd>
        <InlineEditCell
          value={value}
          fieldId={fieldId}
          fieldKey={fieldKey}
          type={readonly ? "readonly" : type}
          options={options}
          className={className}
          onSaved={onSaved}
          onSaveOverride={onSaveOverride}
        >
          {display}
        </InlineEditCell>
      </dd>
    </div>
  );
}

export function ProspectoInfoModal({
  prospecto: prospectoProp,
  operadores,
  open,
  onOpenChange,
  onFilesLoad,
  onUpdated,
}: ProspectoInfoModalProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const [prospecto, setProspecto] = useState<FlotaProspectoRow | null>(prospectoProp);
  const [activeTab, setActiveTab] = useState("info");
  const [archivosDismissBlocked, setArchivosDismissBlocked] = useState(false);
  const [archivosCount, setArchivosCount] = useState(0);
  const [llamadasCount, setLlamadasCount] = useState(0);
  const [citadoDialogOpen, setCitadoDialogOpen] = useState(false);
  const [citadoDate, setCitadoDate] = useState("");
  const [citadoTime, setCitadoTime] = useState("09:00");
  const [savingCitado, setSavingCitado] = useState(false);

  useEffect(() => {
    setProspecto(prospectoProp);
    setArchivosCount(prospectoProp?._count?.archivos ?? 0);
    setLlamadasCount(prospectoProp?._count?.llamadas ?? 0);
  }, [prospectoProp]);

  useEffect(() => {
    if (!open) {
      setActiveTab("info");
      setArchivosDismissBlocked(false);
      setCitadoDialogOpen(false);
      setCitadoDate("");
      setCitadoTime("09:00");
    }
  }, [open]);

  const fetchDetail = useCallback(
    (id: string) =>
      flotaProspectoDetail(id)
        .then((row) => {
          setProspecto(row);
          return row;
        })
        .catch(() => {
          setProspecto(prospectoProp);
          return null;
        }),
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
    void fetchDetail(prospectoProp.id);
  });

  const historialEvents = useMemo(
    () => (prospecto ? buildProspectoHistorialEvents(prospecto, operadores) : []),
    [prospecto, operadores],
  );

  const operadorOptions = useMemo(
    () => operadores.map((op) => ({ label: op.name, value: op.name })),
    [operadores],
  );

  const canAssignOperador =
    currentUser.role !== "operador" || !prospecto?.operador;

  const handleFieldSaved = useCallback(
    (fieldKey: string, newValue: string | null) => {
      setProspecto((prev) => {
        if (!prev) return prev;
        const next: FlotaProspectoRow = { ...prev };
        const patch = next as unknown as Record<string, unknown>;
        if (fieldKey === "edad" || fieldKey === "anioVehiculo") {
          const n = newValue != null && newValue !== "" ? Number(newValue) : null;
          patch[fieldKey] = Number.isFinite(n as number) ? n : null;
        } else if (fieldKey === "fechaCita" && newValue) {
          next.fechaCita = new Date(newValue).toISOString();
        } else if (fieldKey === "contactado") {
          patch[fieldKey] = newValue === "true";
        } else {
          patch[fieldKey] = newValue;
        }
        onUpdated?.(next);
        return next;
      });
      notifyFlotaProspectosRefresh(prospectoProp?.id);
    },
    [onUpdated, prospectoProp?.id],
  );

  const saveObservaciones = useCallback(
    async (rawValue: string) => {
      if (!prospecto) return;
      const original = prospecto.observaciones ?? "";
      const currentLatest = latestObservacion(original);
      const trimmed = rawValue.trim();
      let bodyValue: string | null;
      if (trimmed && trimmed !== currentLatest) {
        const dateStr = new Date().toLocaleString("es-PE", { timeZone: "America/Lima" });
        bodyValue = `[${dateStr}] ${trimmed}\n---\n${original}`;
      } else {
        bodyValue = original || trimmed || null;
      }
      const updated = await flotaProspectoUpdate(prospecto.id, {
        observaciones: bodyValue,
      } as Partial<FlotaProspectoRow>);
      setProspecto(updated);
      onUpdated?.(updated);
      notifyFlotaProspectosRefresh(prospecto.id);
    },
    [prospecto, onUpdated],
  );

  const saveFechaCita = useCallback(
    async (rawValue: string) => {
      if (!prospecto) return;
      const trimmed = rawValue.trim();
      const iso = trimmed ? new Date(trimmed).toISOString() : null;
      const updated = await flotaProspectoUpdate(prospecto.id, {
        fechaCita: iso,
      } as Partial<FlotaProspectoRow>);
      setProspecto(updated);
      onUpdated?.(updated);
      notifyFlotaProspectosRefresh(prospecto.id);
    },
    [prospecto, onUpdated],
  );

  if (!prospecto) return null;

  const operadorDisplay =
    getOperatorDisplayName(prospecto.operador, operadores) ||
    prospecto.operador ||
    "";
  const obsLatest = latestObservacion(prospecto.observaciones);
  const fechaCitaLocal = toDatetimeLocalValue(prospecto.fechaCita);
  const isCitado = prospecto.estado === "Citado";
  const showFechaAfiliacion = prospecto.estado === "Afiliado" || !!prospecto.fechaAfiliacion;
  const estadoHeaderClass =
    estadoHeaderBadgeClass[prospecto.estado] ||
    "border-border bg-muted text-foreground";

  const applyUpdated = (updated: FlotaProspectoRow) => {
    setProspecto(updated);
    onUpdated?.(updated);
    notifyFlotaProspectosRefresh(prospecto.id);
  };

  const saveEstado = async (next: string) => {
    if (!next || next === prospecto.estado) return;
    if (next === "Citado") {
      setCitadoDate("");
      setCitadoTime("09:00");
      setCitadoDialogOpen(true);
      return;
    }
    try {
      const updated = await flotaProspectoUpdate(prospecto.id, {
        estado: next,
      } as Partial<FlotaProspectoRow>);
      applyUpdated(updated);
      toast.success("Estado actualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar estado");
    }
  };

  const handleSaveCitado = async () => {
    if (!citadoDate.trim()) return;
    setSavingCitado(true);
    try {
      const time = citadoTime.trim() || "00:00";
      const iso = new Date(`${citadoDate}T${time}:00`).toISOString();
      const updated = await flotaProspectoUpdate(prospecto.id, {
        estado: "Citado",
        fechaCita: iso,
      } as Partial<FlotaProspectoRow>);
      applyUpdated(updated);
      setCitadoDialogOpen(false);
      toast.success("Cita programada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al programar la cita");
    } finally {
      setSavingCitado(false);
    }
  };

  return (
    <>
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Información del prospecto"
      description={
        <>
          {prospecto.nombreCompleto}
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            Haz clic en un valor para editarlo
          </span>
        </>
      }
      maxWidthClassName={activeTab === "archivos" ? "sm:max-w-3xl" : "sm:max-w-2xl"}
      bodyClassName="pb-2"
      footer={null}
      suspendOutsideDismiss={
        (activeTab === "archivos" && archivosDismissBlocked) || citadoDialogOpen
      }
      headerActions={
        <Select value={prospecto.estado || undefined} onValueChange={(v) => void saveEstado(v)}>
          <SelectTrigger
            aria-label="Estado del prospecto"
            className={cn(
              "h-9 w-auto min-w-[7.5rem] max-w-[11rem] gap-1.5 rounded-full border px-3 text-xs font-semibold shadow-none",
              "focus-visible:ring-1 focus-visible:ring-ring/25 data-[size=default]:h-9",
              estadoHeaderClass,
            )}
          >
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent align="end">
            {ESTADO_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
            {prospecto.estado &&
            !ESTADO_OPTIONS.some((o) => o.value === prospecto.estado) ? (
              <SelectItem value={prospecto.estado}>{prospecto.estado}</SelectItem>
            ) : null}
          </SelectContent>
        </Select>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-5">
        <TabsList
          variant="line"
          className="!h-auto grid w-full grid-cols-4 gap-0 rounded-none border-0 border-b border-border/60 bg-transparent p-0 shadow-none"
        >
          <ProspectoModalTabTrigger
            value="info"
            label="Información"
            icon={Info}
            wrapClass="bg-info/15 ring-info/30"
            iconClass="text-info"
            activeAccentClass="data-[state=active]:border-info data-[state=active]:[&_.tab-icon]:bg-info/22 data-[state=active]:[&_.tab-icon]:ring-info/45"
          />
          <ProspectoModalTabTrigger
            value="historial"
            label="Historial"
            icon={History}
            wrapClass="bg-chart-4/15 ring-chart-4/35"
            iconClass="text-chart-4"
            activeAccentClass="data-[state=active]:border-chart-4 data-[state=active]:[&_.tab-icon]:bg-chart-4/22 data-[state=active]:[&_.tab-icon]:ring-chart-4/45"
          />
          <ProspectoModalTabTrigger
            value="llamadas"
            label="Llamadas"
            llamada
            wrapClass="bg-activity-call/15 ring-activity-call/30"
            iconClass="text-activity-call"
            count={llamadasCount}
            activeAccentClass="data-[state=active]:border-activity-call data-[state=active]:[&_.tab-icon]:bg-activity-call/22 data-[state=active]:[&_.tab-icon]:ring-activity-call/45 data-[state=active]:[&_.tab-badge]:bg-activity-call/15 data-[state=active]:[&_.tab-badge]:text-activity-call"
          />
          <ProspectoModalTabTrigger
            value="archivos"
            label="Archivos"
            icon={FileArchive}
            wrapClass="bg-muted/80 ring-border/70"
            iconClass="text-muted-foreground"
            count={archivosCount}
            activeAccentClass="data-[state=active]:border-foreground/35 data-[state=active]:[&_.tab-icon]:bg-muted data-[state=active]:[&_.tab-icon]:ring-border data-[state=active]:[&_.tab-badge]:bg-foreground/10 data-[state=active]:[&_.tab-badge]:text-foreground"
          />
        </TabsList>

        <TabsContent value="info" className="mt-1">
          <div className="flex flex-col gap-5">
            <InfoSection title="Datos personales">
              <EditableField
                label="Nombres y apellidos"
                value={prospecto.nombreCompleto}
                fieldId={prospecto.id}
                fieldKey="nombreCompleto"
                className="font-medium"
                fullWidth
                onSaved={handleFieldSaved}
              />
              <EditableField
                label="DNI"
                value={prospecto.dni}
                fieldId={prospecto.id}
                fieldKey="dni"
                onSaved={handleFieldSaved}
              />
              <EditableField
                label="Edad"
                value={prospecto.edad}
                fieldId={prospecto.id}
                fieldKey="edad"
                type="number"
                onSaved={handleFieldSaved}
              />
              <EditableField
                label="Celular"
                value={prospecto.celular}
                fieldId={prospecto.id}
                fieldKey="celular"
                onSaved={handleFieldSaved}
              />
              <EditableField
                label="Contacto"
                value={
                  prospecto.contactado === true ? 'true' : 'false'
                }
                fieldId={prospecto.id}
                fieldKey="contactado"
                type="select"
                options={[
                  { label: 'Contactado', value: 'true' },
                  { label: 'Sin contactar', value: 'false' },
                ]}
                onSaved={handleFieldSaved}
              />
            </InfoSection>

            <InfoSection title="Vehículo">
              <EditableField
                label="Placa"
                value={prospecto.placa}
                fieldId={prospecto.id}
                fieldKey="placa"
                onSaved={handleFieldSaved}
              />
              <EditableField
                label="Año vehículo"
                value={prospecto.anioVehiculo}
                fieldId={prospecto.id}
                fieldKey="anioVehiculo"
                type="number"
                onSaved={handleFieldSaved}
              />
              <EditableField
                label="Modalidad"
                value={prospecto.modalidad}
                fieldId={prospecto.id}
                fieldKey="modalidad"
                type="select"
                options={MODALIDAD_OPTIONS}
                onSaved={handleFieldSaved}
              />
              <EditableField
                label="Aire acondicionado"
                value={prospecto.aireAcondicionado}
                fieldId={prospecto.id}
                fieldKey="aireAcondicionado"
                type="select"
                options={AIRE_OPTIONS}
                onSaved={handleFieldSaved}
              />
              <EditableField
                label="Categoría"
                value={prospecto.categoriaVehiculo}
                fieldId={prospecto.id}
                fieldKey="categoriaVehiculo"
                onSaved={handleFieldSaved}
              />
              <EditableField
                label="Marca"
                value={prospecto.marca}
                fieldId={prospecto.id}
                fieldKey="marca"
                onSaved={handleFieldSaved}
              />
              <EditableField
                label="Modelo"
                value={prospecto.modelo}
                fieldId={prospecto.id}
                fieldKey="modelo"
                onSaved={handleFieldSaved}
              />
              <EditableField
                label="Color"
                value={prospecto.color}
                fieldId={prospecto.id}
                fieldKey="color"
                onSaved={handleFieldSaved}
              />
              <EditableField
                label="Combustible"
                value={prospecto.combustible}
                fieldId={prospecto.id}
                fieldKey="combustible"
                onSaved={handleFieldSaved}
              />
            </InfoSection>

            <InfoSection title="Ubicación y seguimiento">
              <EditableField
                label="Operador"
                value={operadorDisplay}
                fieldId={prospecto.id}
                fieldKey="operador"
                type="select"
                options={operadorOptions}
                readonly={!canAssignOperador}
                onSaved={handleFieldSaved}
              />
              <EditableField
                label="Distrito"
                value={prospecto.distrito}
                fieldId={prospecto.id}
                fieldKey="distrito"
                onSaved={handleFieldSaved}
              />
              <EditableField
                label="Ciudad"
                value={prospecto.ciudad}
                fieldId={prospecto.id}
                fieldKey="ciudad"
                type="select"
                options={CIUDAD_OPTIONS}
                onSaved={handleFieldSaved}
              />
              <EditableField
                label="Red social / fuente"
                value={prospecto.redSocial}
                fieldId={prospecto.id}
                fieldKey="redSocial"
                onSaved={handleFieldSaved}
              />
              <EditableField
                label="F. registro"
                value={prospecto.fechaRegistro ? formatDateDMY(prospecto.fechaRegistro) : "—"}
                fieldId={prospecto.id}
                fieldKey="fechaRegistro"
                readonly
              />
              <EditableField
                label="Llamadas registradas"
                value={String(prospecto._count?.llamadas ?? 0)}
                fieldId={prospecto.id}
                fieldKey="llamadas"
                readonly
              />
            </InfoSection>

            {isCitado ? (
              <InfoSection title="Cita">
                <EditableField
                  label="F. cita"
                  value={fechaCitaLocal}
                  fieldId={prospecto.id}
                  fieldKey="fechaCita"
                  type="datetime-local"
                  onSaveOverride={saveFechaCita}
                  display={
                    fechaCitaLocal
                      ? `${formatDateDMY(prospecto.fechaCita!)} ${new Date(
                          prospecto.fechaCita!,
                        ).toLocaleTimeString("es-PE", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "America/Lima",
                        })}`
                      : undefined
                  }
                />
                <EditableField
                  label="Asistencia"
                  value={prospecto.asistencia}
                  fieldId={prospecto.id}
                  fieldKey="asistencia"
                  type="select"
                  options={ASISTENCIA_OPTIONS}
                  onSaved={handleFieldSaved}
                />
              </InfoSection>
            ) : null}

            {showFechaAfiliacion ? (
              <InfoSection title="Afiliación">
                <EditableField
                  label="F. afiliación"
                  value={
                    prospecto.fechaAfiliacion ? formatDateDMY(prospecto.fechaAfiliacion) : "—"
                  }
                  fieldId={prospecto.id}
                  fieldKey="fechaAfiliacion"
                  readonly
                  fullWidth
                />
              </InfoSection>
            ) : null}

            <InfoSection title="Información adicional">
              {prospecto.esDuplicado ? (
                <EditableField
                  label="Duplicado"
                  value="Sí marcado como duplicado"
                  fieldId={prospecto.id}
                  fieldKey="esDuplicado"
                  className="text-destructive"
                  readonly
                />
              ) : null}
              <EditableField
                label="Observaciones"
                value={obsLatest}
                fieldId={prospecto.id}
                fieldKey="observaciones"
                fullWidth
                onSaveOverride={saveObservaciones}
              />
            </InfoSection>
          </div>
        </TabsContent>

        <TabsContent value="historial" className="mt-1">
          <Badge variant="secondary" className="mb-3 text-[10px] font-normal">
            Vista previa — eventos simulados
          </Badge>
          <TimelinePanel events={historialEvents} />
        </TabsContent>

        <TabsContent value="llamadas" className="mt-1">
          <ProspectoLlamadasPanel
            prospectoId={prospecto.id}
            enabled={open && activeTab === "llamadas"}
            onCountChange={setLlamadasCount}
          />
        </TabsContent>

        <TabsContent value="archivos" className="mt-1 space-y-4">
          <p className="text-xs text-muted-foreground">
            Fotos, documentos y PDFs del expediente del prospecto.
          </p>
          <ProspectoArchivosPanel
            prospectoId={prospecto.id}
            enabled={open && activeTab === "archivos"}
            onFilesLoad={(id, count) => {
              setArchivosCount(count);
              onFilesLoad?.(id, count);
            }}
            onBlockDismissChange={setArchivosDismissBlocked}
          />
        </TabsContent>
      </Tabs>
    </FormDialogShell>

    <FormDialogShell
      open={citadoDialogOpen}
      onOpenChange={setCitadoDialogOpen}
      title="Programar cita"
      description="Indica fecha y hora para agendar al prospecto. Aparecerá en el calendario de Flota."
      maxWidthClassName="sm:max-w-md"
      bodyClassName="pb-2"
      overlayClassName={formDialogNestedOverlayClass}
      contentClassName={formDialogNestedContentClass}
      footer={
        <FormDialogActions
          showCancel
          onCancel={() => setCitadoDialogOpen(false)}
          onSubmit={() => void handleSaveCitado()}
          submitLabel="Guardar cita"
          submitting={savingCitado}
          submitDisabled={!citadoDate.trim()}
        />
      }
    >
      <FormDialogGrid className="gap-y-4">
        <FormDialogField label="Fecha" required>
          <Input
            type="date"
            className={formDialogInputClass}
            value={citadoDate}
            onChange={(e) => setCitadoDate(e.target.value)}
          />
        </FormDialogField>
        <FormDialogField label="Hora">
          <Input
            type="time"
            className={formDialogInputClass}
            value={citadoTime}
            onChange={(e) => setCitadoTime(e.target.value)}
          />
        </FormDialogField>
      </FormDialogGrid>
    </FormDialogShell>
    </>
  );
}
