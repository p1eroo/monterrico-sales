import { useNavigate } from "react-router-dom";
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
import { useAppStore } from "@/store";
import { AvatarImage } from "@/lib/avatar";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AssistantLauncherButton } from "@/components/assistant/AiAssistantDrawer";
import FlotaNotificationBell from "@/components/flota/FlotaNotificationBell";
import { AreaSwitcher } from "@/components/layout/AreaSwitcher";

export function Topbar() {
  const navigate = useNavigate();
  const { currentUser, logout, area } = useAppStore();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 min-w-0 shrink-0 items-center gap-3 px-6 md:px-8">
      <SidebarTrigger className="-ml-1 text-text-secondary hover:bg-surface-hover hover:text-foreground md:hidden" />
      <Separator
        orientation="vertical"
        className="h-5 bg-border/80 md:hidden"
      />

      <div className="hidden min-w-0 flex-1 items-center sm:flex">
        <AreaSwitcher />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {area === "comercial" && (
          <>
            <AssistantLauncherButton />
            <NotificationCenter />
          </>
        )}
        {area === "flota" && <FlotaNotificationBell />}

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
