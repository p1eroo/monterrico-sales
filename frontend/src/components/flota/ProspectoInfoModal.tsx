import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Car,
  ClipboardList,
  FileArchive,
  History,
  Info,
  MapPin,
  User,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FormDialogShell } from "@/components/ui/form-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimelinePanel } from "@/components/shared/TimelinePanel";
import { ProspectoArchivosPanel } from "@/components/flota/ProspectoArchivosPanel";
import { ProspectoLlamadasPanel } from "@/components/flota/ProspectoLlamadasPanel";
import { LlamadaSvgIcon } from "@/components/icons/LlamadaSvgIcon";
import { formatDateDMY } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  flotaProspectoDetail,
  getOperatorDisplayName,
  type FlotaProspectoRow,
  type OperadorUser,
} from "@/lib/flotaProspectosApi";
import { useFlotaProspectosRealtime } from "@/lib/flotaProspectosRealtime";
import { buildProspectoHistorialEvents } from "@/components/flota/ProspectoHistorialModal";

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
  onFilesLoad?: (prospectoId: string, fileCount: number) => void;
}

function InfoField({
  label,
  value,
  className,
  fullWidth,
}: {
  label: string;
  value: string;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={`min-w-0 ${fullWidth ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-sm text-foreground break-words ${className ?? ""}`}>
        {value || "—"}
      </dd>
    </div>
  );
}

function SectionIcon({
  icon: Icon,
  wrapClass,
  iconClass,
}: {
  icon: LucideIcon;
  wrapClass: string;
  iconClass: string;
}) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
        wrapClass,
      )}
    >
      <Icon className={cn("size-3.5", iconClass)} />
    </span>
  );
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
  icon,
  iconWrapClass,
  iconClass,
  children,
}: {
  title: string;
  icon: LucideIcon;
  iconWrapClass: string;
  iconClass: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2 border-b border-border/60 pb-1.5">
        <SectionIcon icon={icon} wrapClass={iconWrapClass} iconClass={iconClass} />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      </div>
      <dl className="grid grid-cols-1 gap-y-3">{children}</dl>
    </section>
  );
}

export function ProspectoInfoModal({
  prospecto: prospectoProp,
  operadores,
  open,
  onOpenChange,
  onFilesLoad,
}: ProspectoInfoModalProps) {
  const [prospecto, setProspecto] = useState<FlotaProspectoRow | null>(prospectoProp);
  const [activeTab, setActiveTab] = useState("info");
  const [archivosDismissBlocked, setArchivosDismissBlocked] = useState(false);
  const [archivosCount, setArchivosCount] = useState(0);
  const [llamadasCount, setLlamadasCount] = useState(0);

  useEffect(() => {
    setProspecto(prospectoProp);
    setArchivosCount(prospectoProp?._count?.archivos ?? 0);
    setLlamadasCount(prospectoProp?._count?.llamadas ?? 0);
  }, [prospectoProp]);

  useEffect(() => {
    if (!open) {
      setActiveTab("info");
      setArchivosDismissBlocked(false);
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

  if (!prospecto) return null;

  const operador =
    getOperatorDisplayName(prospecto.operador, operadores) ||
    prospecto.operador ||
    "—";
  const estadoClass = estadoColors[prospecto.estado] || "";
  const fechaCitaLabel = prospecto.fechaCita
    ? `${formatDateDMY(prospecto.fechaCita)} ${new Date(prospecto.fechaCita).toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Lima",
      })}`
    : "—";
  const observaciones =
    (prospecto.observaciones || "").replace(/\n---\n/g, "\n").trim() || "—";

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Información del prospecto"
      description={prospecto.nombreCompleto}
      maxWidthClassName={activeTab === "archivos" ? "sm:max-w-3xl" : "sm:max-w-2xl"}
      bodyClassName="pb-2"
      footer={null}
      suspendOutsideDismiss={activeTab === "archivos" && archivosDismissBlocked}
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
            <InfoSection
              title="Datos personales"
              icon={User}
              iconWrapClass="bg-info/18 ring-info/35"
              iconClass="text-info"
            >
              <InfoField
                label="Nombres y apellidos"
                value={prospecto.nombreCompleto}
                className="font-medium"
                fullWidth
              />
              <InfoField label="DNI" value={prospecto.dni || "—"} />
              <InfoField
                label="Edad"
                value={prospecto.edad != null ? String(prospecto.edad) : "—"}
              />
              <InfoField label="Celular" value={prospecto.celular || "—"} />
              <InfoField label="Móvil" value={prospecto.movil || "—"} />
            </InfoSection>

            <InfoSection
              title="Vehículo"
              icon={Car}
              iconWrapClass="bg-chart-3/18 ring-chart-3/40"
              iconClass="text-chart-3"
            >
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
            </InfoSection>

            <InfoSection
              title="Ubicación y seguimiento"
              icon={MapPin}
              iconWrapClass="bg-success/18 ring-success/35"
              iconClass="text-success"
            >
              <InfoField
                label="Estado"
                value={prospecto.estado}
                className={`font-medium ${estadoClass}`}
              />
              <InfoField label="Distrito" value={prospecto.distrito || "—"} />
              <InfoField label="Ciudad" value={prospecto.ciudad || "—"} />
              <InfoField label="Operador" value={operador} />
              <InfoField label="Red social / fuente" value={prospecto.redSocial || "—"} />
              <InfoField
                label="F. registro"
                value={prospecto.fechaRegistro ? formatDateDMY(prospecto.fechaRegistro) : "—"}
              />
              <InfoField label="F. cita" value={fechaCitaLabel} />
              <InfoField label="Asistencia" value={prospecto.asistencia || "—"} />
              <InfoField
                label="F. afiliación"
                value={
                  prospecto.fechaAfiliacion ? formatDateDMY(prospecto.fechaAfiliacion) : "—"
                }
              />
              <InfoField
                label="Llamadas registradas"
                value={String(prospecto._count?.llamadas ?? 0)}
              />
            </InfoSection>

            <InfoSection
              title="Información adicional"
              icon={ClipboardList}
              iconWrapClass="bg-activity-note/20 ring-activity-note/35"
              iconClass="text-activity-note"
            >
              {prospecto.esDuplicado ? (
                <InfoField label="Duplicado" value="Sí marcado como duplicado" className="text-destructive" />
              ) : null}
              <InfoField label="Observaciones" value={observaciones} fullWidth />
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
  );
}
