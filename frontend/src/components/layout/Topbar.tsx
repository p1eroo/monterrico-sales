import { useNavigate, useLocation } from "react-router-dom";
import { User, Settings, LogOut } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppStore } from "@/store";
import { AvatarImage } from "@/lib/avatar";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AssistantLauncherButton } from "@/components/assistant/AiAssistantDrawer";
import FlotaNotificationBell from "@/components/flota/FlotaNotificationBell";
import { AreaSwitcher } from "@/components/layout/AreaSwitcher";
import { CorreoSvgIcon } from "@/components/icons/CorreoSvgIcon";
import { topbarActionButtonClassName } from "@/lib/topbarIconStyles";
import { usePermissions } from "@/hooks/usePermissions";

export function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout, area } = useAppStore();
  const { hasPermission } = usePermissions();
  const hideChatwootBell =
    area === "flota" &&
    (location.pathname === "/flota/whatsapp" ||
      location.pathname.startsWith("/flota/whatsapp/"));

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 min-w-0 shrink-0 items-center gap-2 px-4 md:gap-3 md:px-8">
      <SidebarTrigger className="-ml-1 text-text-secondary hover:bg-surface-hover hover:text-foreground md:hidden" />

      <div className="min-w-0 flex-1 items-center flex">
        <AreaSwitcher />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
        {area === "comercial" && (
          <>
            {hasPermission("campanas.ver") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={topbarActionButtonClassName(
                      location.pathname.startsWith("/campaigns/recibidos"),
                    )}
                    onClick={() => navigate("/campaigns/recibidos")}
                    aria-label="Buzón de campañas"
                  >
                    <CorreoSvgIcon className="size-7" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Buzón</TooltipContent>
              </Tooltip>
            )}
            <AssistantLauncherButton />
            <NotificationCenter />
          </>
        )}
        {area === "flota" && !hideChatwootBell && <FlotaNotificationBell />}

        <ThemeToggle />

        <Separator
          orientation="vertical"
          className="-mx-0.5 h-5 bg-border/80"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-auto p-0 text-base font-normal text-text-secondary hover:bg-surface-hover hover:text-foreground"
            >
              <Avatar className="size-9">
                <AvatarImage
                  name={currentUser.name}
                  avatar={currentUser.avatar}
                  size={36}
                />
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-0.5">
                <p className="text-sm font-medium">{currentUser.name}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <User />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings />
                <span>Configuración</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut />
              <span>Cerrar sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
