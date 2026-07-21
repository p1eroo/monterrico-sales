import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from '@/lib/notify';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { comercialProPopoverClass } from "@/lib/comercialFilterSurface";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import { ComercialAreaSvgIcon } from "@/components/icons/ComercialAreaSvgIcon";
import { FlotaAreaSvgIcon } from "@/components/icons/FlotaAreaSvgIcon";
import { MarketingAreaSvgIcon } from "@/components/icons/MarketingAreaSvgIcon";
import { ShieldUpSvgIcon } from "@/components/icons/ShieldUpSvgIcon";

type SwitchableArea = "comercial" | "flota" | "marketing";

const AREA_ICON_THEME: Record<
  SwitchableArea,
  { iconClass: string; menuWrapClass: string }
> = {
  comercial: {
    iconClass: "text-[#13944C] dark:text-[#2ECC87]",
    menuWrapClass: "bg-[#13944C]/12 dark:bg-[#13944C]/20",
  },
  flota: {
    iconClass: "text-[#0d9488] dark:text-[#2dd4bf]",
    menuWrapClass: "bg-[#0d9488]/12 dark:bg-[#0d9488]/20",
  },
  marketing: {
    iconClass: "text-[#1DB954] dark:text-[#4ade80]",
    menuWrapClass: "bg-[#1DB954]/12 dark:bg-[#1DB954]/20",
  },
};

const ADMIN_AREA_THEME = {
  iconClass: "text-[#475569] dark:text-[#94a3b8]",
  menuWrapClass: "bg-slate-500/12 dark:bg-slate-400/15",
};

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
const MENU_ICON_WRAP_CLASS =
  "flex size-8 shrink-0 items-center justify-center rounded-lg";
const MENU_ICON_CLASS = "size-5 shrink-0";

function areaTheme(area: string) {
  return AREA_ICON_THEME[area as SwitchableArea];
}

function areaIcon(area: string, className = TRIGGER_ICON_CLASS) {
  const opt = AREA_OPTIONS.find((a) => a.id === area);
  if (!opt) return null;
  const theme = areaTheme(area);
  const { Icon } = opt;
  return (
    <Icon className={cn(className, theme?.iconClass ?? "text-foreground")} />
  );
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

  const handleSelectAdmin = () => {
    setArea("admin");
    navigate("/admin");
    setOpen(false);
  };

  const triggerIcon =
    area === "admin" ? (
      <ShieldUpSvgIcon
        className={cn(TRIGGER_ICON_CLASS, ADMIN_AREA_THEME.iconClass)}
      />
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
            <ShieldUpSvgIcon
              className={cn(TRIGGER_ICON_CLASS, ADMIN_AREA_THEME.iconClass)}
            />
          ) : CurrentIcon ? (
            <CurrentIcon
              className={cn(
                TRIGGER_ICON_CLASS,
                areaTheme(area)?.iconClass ?? "text-foreground",
              )}
            />
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
            const theme = AREA_ICON_THEME[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelect(id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                  isActive
                    ? "bg-primary/8 ring-1 ring-primary/20 dark:bg-primary/15"
                    : "hover:bg-neutral-100/90 hover:ring-1 hover:ring-primary/15 dark:hover:bg-neutral-800/70",
                )}
              >
                <span
                  className={cn(MENU_ICON_WRAP_CLASS, theme.menuWrapClass)}
                >
                  <Icon className={cn(MENU_ICON_CLASS, theme.iconClass)} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {name}
                </span>
                {isActive ? (
                  <span className="shrink-0 rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary dark:bg-primary/25 dark:text-[#2ECC87]">
                    Actual
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {isAdmin ? (
          <>
            <div className="mx-3 border-t border-dashed border-border/80 dark:border-neutral-700" />

            <div className="bg-neutral-50/80 p-2 dark:bg-neutral-900/50">
              <button
                type="button"
                onClick={handleSelectAdmin}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                  area === "admin"
                    ? "bg-primary/8 ring-1 ring-primary/20 dark:bg-primary/15"
                    : "hover:bg-neutral-100/90 hover:ring-1 hover:ring-primary/15 dark:hover:bg-neutral-800/70",
                )}
              >
                <span
                  className={cn(
                    MENU_ICON_WRAP_CLASS,
                    ADMIN_AREA_THEME.menuWrapClass,
                  )}
                >
                  <ShieldUpSvgIcon
                    className={cn(MENU_ICON_CLASS, ADMIN_AREA_THEME.iconClass)}
                  />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  Administrador
                </span>
                {area === "admin" ? (
                  <span className="shrink-0 rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary dark:bg-primary/25 dark:text-[#2ECC87]">
                    Actual
                  </span>
                ) : null}
              </button>
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
