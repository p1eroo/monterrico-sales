import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  Car,
  IdCard,
  Languages,
  Loader2,
  MapPin,
  Settings2,
  Shield,
  User,
} from "lucide-react";
import {
  getConductorDetalle,
  type Conductor,
  type ConductorDatos,
} from "@/lib/flotaConductoresApi";
import { ConductorEstadoBadge } from "@/components/flota/ConductorEstadoBadge";
import { ConductorAvatar } from "@/components/flota/ConductorAvatar";
import {
  hasValidCoordinates,
  LocationMapEmbed,
} from "@/components/flota/LocationMapEmbed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDateDMY } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type ConductorDetailSheetProps = {
  conductor: Conductor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  const empty =
    value === null ||
    value === undefined ||
    value === "" ||
    value === "—" ||
    (typeof value === "string" && !value.trim());

  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="break-words text-[13px] text-[#0F172A] dark:text-gray-100">
        {empty ? "—" : value}
      </div>
    </div>
  );
}

function DetailSection({
  icon: Icon,
  title,
  badge,
  children,
  className,
  dimmed,
}: {
  icon: typeof User;
  title: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  dimmed?: boolean;
}) {
  return (
    <Card className={cn("gap-0 overflow-hidden py-0 shadow-none", className)}>
      <CardHeader className="border-b border-border/50 bg-muted/30 px-4 py-3">
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-semibold">
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-3.5" />
            </span>
            <span className="truncate">{title}</span>
          </span>
          {badge}
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2",
          dimmed && "opacity-60",
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}

function formatIdiomas(d: ConductorDatos): string | null {
  const langs: string[] = [];
  if (d.iingles) langs.push("Inglés");
  if (d.ialeman) langs.push("Alemán");
  if (d.iportugues) langs.push("Portugués");
  if (d.ichinomandarin) langs.push("Chino");
  if (d.ifrances) langs.push("Francés");
  return langs.length > 0 ? langs.join(", ") : null;
}

function formatTelefonos(principal?: string, secundario?: string): string | null {
  const parts = [principal, secundario].filter((t) => t && t !== "0");
  return parts.length > 0 ? parts.join(" / ") : null;
}

function formatVehiculoCompleto(
  placa?: string,
  marca?: string,
  modelo?: string,
  color?: string,
): string | null {
  const plate = placa?.trim();
  const vehiculo = [marca?.trim(), modelo?.trim()].filter(Boolean).join(" ");
  const paint = color?.trim();
  const parts = [plate, vehiculo || null, paint].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(" · ") : null;
}

function ConfigToggle({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          active ? "bg-emerald-500" : "bg-muted-foreground/30",
        )}
      />
      <span className="text-[13px] text-[#0F172A] dark:text-gray-100">{label}</span>
    </div>
  );
}

export function ConductorDetailSheet({
  conductor,
  open,
  onOpenChange,
}: ConductorDetailSheetProps) {
  const [datos, setDatos] = useState<ConductorDatos | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !conductor?.idasociado) {
      setDatos(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getConductorDetalle(conductor.idasociado)
      .then((response) => {
        if (cancelled) return;
        setDatos(response.ODatos);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDatos(null);
        setError(err instanceof Error ? err.message : "Error al cargar el detalle");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, conductor?.idasociado]);

  const headerConductor = useMemo((): Conductor | null => {
    if (!conductor) return null;
    if (!datos) return conductor;
    return {
      ...conductor,
      imaasoc: datos.imaasoc ?? conductor.imaasoc,
      nombres: datos.nombres ?? conductor.nombres,
      apellidos: datos.apellidos ?? conductor.apellidos,
    };
  }, [conductor, datos]);

  if (!conductor || !headerConductor) return null;

  const d = datos;
  const nombreCompleto =
    `${d?.nombres ?? conductor.nombres ?? ""} ${d?.apellidos ?? conductor.apellidos ?? ""}`.trim() ||
    "Conductor";
  const telefono = formatTelefonos(d?.telefonop, d?.telefonos);
  const placa = d?.placa ?? conductor.nplaca;
  const vehiculoCompleto = formatVehiculoCompleto(
    placa,
    conductor.marca,
    conductor.modelo,
    conductor.color,
  );
  const showMap = hasValidCoordinates(d?.latitude, d?.longitude);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex w-full flex-col gap-0 overflow-hidden p-0",
          "border-l border-border/60 bg-gradient-to-br from-sky-50/80 via-background to-background",
          "shadow-[-4px_0_24px_-4px_rgba(0,0,0,0.12)] dark:from-sky-950/40 dark:via-background dark:to-background",
          "sm:max-w-xl md:max-w-2xl lg:max-w-4xl",
        )}
      >
        <SheetHeader className="shrink-0 space-y-0 border-b border-border/50 px-5 py-4 text-left">
          <div className="flex items-start gap-4 pr-8">
            <ConductorAvatar conductor={headerConductor} size="lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <SheetTitle className="text-lg leading-tight">{nombreCompleto}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="text-foreground/80">{conductor.codigo || "—"}</span>
                <ConductorEstadoBadge estado={conductor.estado} />
              </SheetDescription>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {conductor.agente ? <span>Agente: {conductor.agente}</span> : null}
                {conductor.fechorregistro ? (
                  <span>Registro: {formatDateDMY(conductor.fechorregistro)}</span>
                ) : null}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
              <p className="text-sm">Cargando ficha del conductor…</p>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : d ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <DetailSection icon={User} title="Datos personales">
                <DetailField label="Tipo documento" value={d.tipodocumento} />
                <DetailField label="Nº documento" value={d.ndni} />
                <DetailField label="Nombres" value={d.nombres} />
                <DetailField label="Apellidos" value={d.apellidos} />
                <DetailField label="Teléfono principal" value={telefono} />
                <DetailField label="Email" value={d.email} />
                <DetailField label="Sexo" value={d.sexo} />
                <DetailField
                  label="Fecha de nacimiento"
                  value={d.fecnac ? formatDateDMY(d.fecnac) : null}
                />
                <DetailField label="Departamento" value={d.departamento} />
              </DetailSection>

              <DetailSection icon={MapPin} title="Dirección domicilio">
                {showMap && d ? (
                  <div className="sm:col-span-2">
                    <LocationMapEmbed
                      latitude={d.latitude!}
                      longitude={d.longitude!}
                      className="[&_iframe]:h-[280px]"
                    />
                  </div>
                ) : (
                  <p className="sm:col-span-2 text-[13px] text-muted-foreground">
                    Ubicación no disponible
                  </p>
                )}
              </DetailSection>

              <DetailSection icon={IdCard} title="Licencia de conducir">
                <DetailField label="Nº licencia" value={d.brevete} />
                <DetailField label="Categoría" value={d.brevetecategoria} />
                <DetailField
                  label="Vencimiento"
                  value={d.brevetefec ? formatDateDMY(d.brevetefec) : null}
                />
                <DetailField
                  label="Fecha emisión"
                  value={d.brevetefecemision ? formatDateDMY(d.brevetefecemision) : null}
                />
                <DetailField
                  label="Fecha expedición"
                  value={d.breveteexpedicion ? formatDateDMY(d.breveteexpedicion) : null}
                />
                <DetailField label="Centro emisión" value={d.brevetecentroemision} />
                <DetailField label="Restricciones" value={d.breveterestriccion} />
                <DetailField label="Estado" value={d.breveteestado} />
                <DetailField label="Infracciones" value={d.breveteinfraccionacumulado} />
                <DetailField label="Puntos" value={d.brevetepuntosacumulados} />
                {d.brevetemensaje?.trim() ? (
                  <div className="sm:col-span-2">
                    <DetailField label="Mensaje" value={d.brevetemensaje.trim()} />
                  </div>
                ) : null}
              </DetailSection>

              <DetailSection
                icon={Building2}
                title="Credencial ATU"
                dimmed={!d.atu}
                badge={
                  <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                    {d.atu ? "Activa" : "Inactiva"}
                  </span>
                }
              >
                <DetailField label="Nº credencial" value={d.atucredencial} />
                <DetailField
                  label="Emisión"
                  value={d.atuemision ? formatDateDMY(d.atuemision) : null}
                />
                <DetailField
                  label="Vencimiento"
                  value={d.atuvencimiento ? formatDateDMY(d.atuvencimiento) : null}
                />
                <DetailField label="Condición" value={d.atucondicion} />
                <DetailField label="Modalidad" value={d.atumodalidad} />
              </DetailSection>

              <DetailSection icon={Car} title="Vehículo y turno">
                <div className="sm:col-span-2">
                  <DetailField label="Vehículo" value={vehiculoCompleto ?? placa} />
                </div>
                <DetailField label="Tipo móvil" value={d.tipomovil} />
                <DetailField label="Turno" value={d.turno ?? conductor.turno} />
              </DetailSection>

              <DetailSection
                icon={Shield}
                title="Carné seguridad vial"
                dimmed={!d.carneseguridadvial}
                badge={
                  <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                    {d.carneseguridadvial ? "Vigente" : "No registrado"}
                  </span>
                }
              >
                <DetailField
                  label="Vencimiento"
                  value={
                    d.carneseguridadvialfecven
                      ? formatDateDMY(d.carneseguridadvialfecven)
                      : null
                  }
                />
              </DetailSection>

              <DetailSection icon={Languages} title="Idiomas">
                <div className="sm:col-span-2">
                  <DetailField label="Idiomas" value={formatIdiomas(d)} />
                </div>
              </DetailSection>

              <DetailSection icon={Settings2} title="Configuraciones" className="lg:col-span-2">
                <div className="grid grid-cols-1 gap-2 sm:col-span-2 sm:grid-cols-2 lg:grid-cols-3">
                  <ConfigToggle label="Auto-asignación" active={d.autoasignacion} />
                  <ConfigToggle label="Fin de semana" active={d.findesemana} />
                  <ConfigToggle label="Pago inmediato" active={d.pagoinmediato} />
                  <ConfigToggle label="FexSunat" active={d.sunat} />
                  <ConfigToggle label="Asignación manual" active={d.manuals} />
                  <ConfigToggle label="Separación servicio" active={d.separacionservicio} />
                  <ConfigToggle label="FexLan" active={d.fexlan} />
                </div>
              </DetailSection>

              {d.observaciones?.trim() ? (
                <DetailSection icon={User} title="Observaciones" className="lg:col-span-2">
                  <div className="sm:col-span-2">
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#475569] dark:text-gray-400">
                      {d.observaciones.trim()}
                    </p>
                  </div>
                </DetailSection>
              ) : null}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
