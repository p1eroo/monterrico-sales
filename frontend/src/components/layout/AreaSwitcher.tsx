import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronsUpDown, LayoutGrid, Shield } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import { ComercialAreaSvgIcon } from "@/components/icons/ComercialAreaSvgIcon";
import { FlotaAreaSvgIcon } from "@/components/icons/FlotaAreaSvgIcon";
import { MarketingAreaSvgIcon } from "@/components/icons/MarketingAreaSvgIcon";

type SwitchableArea = "comercial" | "flota" | "marketing";

const AREA_OPTIONS: {
  id: SwitchableArea;
  name: string;
  home: string;
  Icon: typeof ComercialAreaSvgIcon;
}[] = [
  { id: "comercial", name: "Comercial", home: "/dashboard", Icon: ComercialAreaSvgIcon },
  { id: "flota", name: "Flota", home: "/flota", Icon: FlotaAreaSvgIcon },
  { id: "marketing", name: "Marketing", home: "/marketing", Icon: MarketingAreaSvgIcon },
];

function areaLabel(area: string): string {
  if (area === "admin") return "Administrador";
  return AREA_OPTIONS.find((a) => a.id === area)?.name ?? "Área";
}

const TRIGGER_ICON_CLASS = "size-6 shrink-0 rounded-[4px]";
const MENU_ICON_CLASS = "size-5 shrink-0 rounded-[4px]";

function areaIcon(area: string, className = TRIGGER_ICON_CLASS) {
  const opt = AREA_OPTIONS.find((a) => a.id === area);
  if (!opt) return null;
  const { Icon } = opt;
  return <Icon className={className} />;
}

export function AreaSwitcher() {
  const navigate = useNavigate();
  const { area, setArea, currentUser } = useAppStore();
  const [open, setOpen] = useState(false);

  const isAdmin =
    currentUser.role === "Administrador" || currentUser.role === "admin";
  const allowedAreas = currentUser.allowedAreas ?? [];
  const availableOptions = AREA_OPTIONS.filter(
    (opt) => isAdmin || allowedAreas.includes(opt.id),
  );
  const canSwitch = isAdmin || availableOptions.length > 1;
  const currentOption = AREA_OPTIONS.find((a) => a.id === area);

  const handleSelect = (areaId: SwitchableArea) => {
    if (!isAdmin && !allowedAreas.includes(areaId)) {
      toast.error("Acceso restringido: No tienes permisos para esta área.");
      return;
    }
    setArea(areaId);
    const home = AREA_OPTIONS.find((a) => a.id === areaId)?.home ?? "/dashboard";
    navigate(home);
    setOpen(false);
  };

  const triggerIcon =
    area === "admin" ? (
      <Shield className="size-6 shrink-0 text-muted-foreground" />
    ) : (
      areaIcon(area)
    );

  if (!canSwitch) {
    return (
      <span className="flex items-center gap-2 text-muted-foreground">
        {triggerIcon}
        <span>{areaLabel(area)}</span>
      </span>
    );
  }

  const CurrentIcon = currentOption?.Icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg border border-dashed border-[#e8ecf0] bg-card/30 px-2.5",
            "transition-colors hover:border-primary dark:border-gray-700",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-label={`Área actual: ${areaLabel(area)}. Cambiar área`}
        >
          {area === "admin" ? (
            <Shield className="size-6 shrink-0 text-muted-foreground" />
          ) : CurrentIcon ? (
            <CurrentIcon className={TRIGGER_ICON_CLASS} />
          ) : null}
          <span>{areaLabel(area)}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div className="flex flex-col gap-0.5">
          {availableOptions.map(({ id, name, Icon }) => {
            const isActive = area === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelect(id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                  isActive ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <Icon className={MENU_ICON_CLASS} />
                <span className="flex-1 text-left text-sm">{name}</span>
                {isActive && <Check className="size-4 text-muted-foreground" />}
              </button>
            );
          })}
        </div>
        <div className="my-1 border-t border-dashed border-border" />
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            navigate("/area-select");
          }}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <LayoutGrid className="size-4" />
          <span className="flex-1 text-left">Ver todas las áreas</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
