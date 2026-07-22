import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store";
import { ArrowRight, Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { ComercialAreaSvgIcon } from "@/components/icons/ComercialAreaSvgIcon";
import { FlotaAreaSvgIcon } from "@/components/icons/FlotaAreaSvgIcon";
import { MarketingAreaSvgIcon } from "@/components/icons/MarketingAreaSvgIcon";
import { ShieldUpSvgIcon } from "@/components/icons/ShieldUpSvgIcon";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { cardVariants } from "@/components/ui/card";

type AreaId = "comercial" | "flota" | "marketing" | "admin";

const areas: {
  id: AreaId;
  name: string;
  description: string;
  Icon: typeof ComercialAreaSvgIcon;
  iconClass: string;
  iconWrapClass: string;
}[] = [
  {
    id: "comercial",
    name: "Comercial",
    description: "Ventas, pipeline, contactos y oportunidades.",
    Icon: ComercialAreaSvgIcon,
    iconClass: "text-[#13944C] dark:text-[#2ECC87]",
    iconWrapClass: "bg-[#13944C]/12 dark:bg-[#13944C]/20",
  },
  {
    id: "flota",
    name: "Flota",
    description: "Prospectos, conductores y operación de flota.",
    Icon: FlotaAreaSvgIcon,
    iconClass: "text-[#0d9488] dark:text-[#2dd4bf]",
    iconWrapClass: "bg-[#0d9488]/12 dark:bg-[#0d9488]/20",
  },
  {
    id: "marketing",
    name: "Marketing",
    description: "Campañas, leads e integraciones.",
    Icon: MarketingAreaSvgIcon,
    iconClass: "text-[#1DB954] dark:text-[#4ade80]",
    iconWrapClass: "bg-[#1DB954]/12 dark:bg-[#1DB954]/20",
  },
  {
    id: "admin",
    name: "Administración",
    description: "Usuarios, roles, auditoría y configuración del sistema.",
    Icon: ShieldUpSvgIcon,
    iconClass: "text-[#475569] dark:text-[#94a3b8]",
    iconWrapClass: "bg-slate-500/12 dark:bg-slate-400/15",
  },
];

export default function AreaSelect() {
  const navigate = useNavigate();
  const setArea = useAppStore((s) => s.setArea);
  const currentUser = useAppStore((s) => s.currentUser);
  const [selecting, setSelecting] = useState(false);
  const [selectedId, setSelectedId] = useState<AreaId | null>(null);
  const [hoveredId, setHoveredId] = useState<AreaId | null>(null);

  const isAdmin =
    currentUser.role === "Administrador" || currentUser.role === "admin";
  const userAllowedAreas = currentUser.allowedAreas || [];

  const visibleAreas = areas.filter(
    (area) => area.id !== "admin" || isAdmin,
  );

  const isAreaAllowed = (areaId: AreaId) => {
    if (areaId === "admin") return isAdmin;
    return isAdmin || userAllowedAreas.includes(areaId);
  };

  const handleSelect = (areaId: AreaId) => {
    if (!isAreaAllowed(areaId)) {
      toast.error("Acceso restringido: No tienes permisos para esta área.");
      return;
    }

    setSelecting(true);
    setSelectedId(areaId);
    setArea(areaId);
    if (areaId === "admin") {
      navigate("/admin");
    } else if (areaId === "marketing") {
      navigate("/marketing");
    } else {
      navigate(areaId === "flota" ? "/flota" : "/dashboard");
    }
  };

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-background",
        "bg-gradient-to-b from-[#f8f8f9] via-[#f0f0f2] to-[#e8e8ec]",
        "dark:from-background dark:via-background dark:to-background",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-15"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 40%, rgba(220, 252, 231, 0.45) 0%, transparent 55%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-100 dark:opacity-10"
        style={{
          background:
            "radial-gradient(ellipse 100% 60% at 80% 90%, rgba(187, 247, 208, 0.25) 0%, transparent 55%)",
        }}
      />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative z-10 mx-auto flex h-full w-full flex-col items-center justify-center overflow-y-auto px-4 py-20 sm:px-6 sm:py-24">
        <header className="mb-10 max-w-2xl text-center">
          {currentUser.name ? (
            <p className="text-xl text-muted-foreground">
              Hola, {currentUser.name}
            </p>
          ) : null}
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            ¿A qué área quieres entrar?
          </h1>
        </header>

        <div
          className={cn(
            "grid w-full gap-5 sm:grid-cols-2",
            visibleAreas.length === 4
              ? "max-w-6xl lg:grid-cols-4"
              : "max-w-5xl lg:grid-cols-3",
          )}
        >
          {visibleAreas.map((area) => {
            const isSelected = selectedId === area.id;
            const isHovered = hoveredId === area.id;
            const isAllowed = isAreaAllowed(area.id);
            const { Icon } = area;

            return (
              <button
                key={area.id}
                type="button"
                onClick={() => handleSelect(area.id)}
                onMouseEnter={() => setHoveredId(area.id)}
                onMouseLeave={() => setHoveredId(null)}
                disabled={selecting || !isAllowed}
                className={cn(
                  cardVariants({ variant: "surface" }),
                  "group relative flex min-h-[220px] flex-col p-6 text-left transition-all duration-300",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isAllowed && !selecting && "hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.35)]",
                  isSelected && "ring-2 ring-primary/30",
                  !isAllowed && "cursor-not-allowed opacity-50",
                )}
              >
                <div
                  className={cn(
                    "flex size-14 items-center justify-center rounded-xl transition-transform duration-300",
                    area.iconWrapClass,
                    isHovered && isAllowed && "scale-105",
                  )}
                >
                  <Icon className={cn("size-8", area.iconClass)} />
                </div>

                <div className="mt-5 flex flex-1 flex-col">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    {area.name}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {area.description}
                  </p>

                  <div
                    className={cn(
                      "mt-6 flex items-center gap-2 text-sm font-medium transition-colors",
                      isHovered && isAllowed
                        ? "text-primary"
                        : "text-foreground",
                    )}
                  >
                    {isSelected && selecting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Entrando...</span>
                      </>
                    ) : isAllowed ? (
                      <>
                        <span>Acceder al área</span>
                        <ArrowRight
                          className={cn(
                            "size-4 transition-transform",
                            isHovered && "translate-x-0.5",
                          )}
                        />
                      </>
                    ) : (
                      <span className="text-muted-foreground">No disponible</span>
                    )}
                  </div>
                </div>

                {!isAllowed && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[14px] bg-background/80 backdrop-blur-[2px]">
                    <Lock className="size-7 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Acceso restringido
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
