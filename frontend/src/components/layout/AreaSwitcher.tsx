import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, Shield } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { comercialProPopoverClass } from "@/lib/comercialFilterSurface";
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

const TRIGGER_ICON_CLASS = "size-8 shrink-0 rounded-[4px]";
const MENU_ICON_CLASS = "size-7 shrink-0 rounded-[4px]";

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
      <Shield className="size-8 shrink-0 text-muted-foreground" />
    ) : (
      areaIcon(area)
    );

  if (!canSwitch) {
    return (
      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
        {triggerIcon}
        <span className="hidden truncate rounded-md bg-neutral-200 px-2 py-0.5 text-sm font-semibold text-foreground dark:bg-neutral-700 md:inline">
          {areaLabel(area)}
        </span>
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
            "flex h-9 items-center justify-center gap-2 rounded-lg border-0 bg-transparent px-1",
            "transition-colors hover:bg-surface-hover",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-label={`Área actual: ${areaLabel(area)}. Cambiar área`}
        >
          {area === "admin" ? (
            <Shield className="size-8 shrink-0 text-muted-foreground" />
          ) : CurrentIcon ? (
            <CurrentIcon className={TRIGGER_ICON_CLASS} />
          ) : null}
          <span className="hidden truncate rounded-md bg-neutral-200 px-2 py-0.5 text-sm font-semibold text-foreground dark:bg-neutral-700 md:inline">
            {areaLabel(area)}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className={cn(
          comercialProPopoverClass,
          "w-[min(100vw-2rem,17.5rem)] text-foreground",
        )}
      >
        <div className="flex flex-col gap-1 p-2">
          {availableOptions.map(({ id, name, Icon }) => {
            const isActive = area === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelect(id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                  isActive
                    ? "bg-neutral-200/80 dark:bg-neutral-800"
                    : "hover:bg-neutral-100/90 dark:hover:bg-neutral-800/70",
                )}
              >
                <Icon className={MENU_ICON_CLASS} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {name}
                </span>
                {isActive ? (
                  <span className="shrink-0 rounded-md bg-neutral-300/80 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                    Actual
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mx-3 border-t border-dashed border-border/80 dark:border-neutral-700" />

        <div className="bg-neutral-50/80 p-2 dark:bg-neutral-900/50">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/area-select");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-white/80 hover:text-foreground dark:hover:bg-neutral-800/80"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-neutral-200/80 text-muted-foreground dark:bg-neutral-800">
              <LayoutGrid className="size-3.5" />
            </span>
            <span className="flex-1 text-left font-medium">Ver todas las áreas</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
