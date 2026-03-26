import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  User,
  Settings,
  LogOut,
} from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/store';
import { initialsFromName } from '@/lib/utils';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { AssistantLauncherButton } from '@/components/assistant/AiAssistantDrawer';

const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/contactos': 'Contactos',
  '/empresas': 'Empresas',
  '/pipeline': 'Pipeline',
  '/tareas': 'Tareas',
  '/calendario': 'Calendario',
  '/inbox': 'Correo',
  '/campaigns': 'Campañas',
  '/opportunities': 'Oportunidades',
  '/clients': 'Clientes',
  '/reports': 'Reportes',
  '/team': 'Equipo',
  '/users': 'Usuarios y Roles',
  '/audit': 'Auditoría',
  '/profile': 'Mi perfil',
  '/settings': 'Configuración',
  '/agentes-ia': 'Agentes IA',
};

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAppStore();

  const currentRoute = Object.keys(routeLabels).find((route) =>
    location.pathname.startsWith(route),
  );
  const pageTitle = currentRoute ? routeLabels[currentRoute] : 'Página';

  const initials = initialsFromName(currentUser.name);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />

      <Breadcrumb className="hidden sm:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Taxi Monterrico</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="h-8 w-56 bg-muted/50 pl-8 text-sm"
          />
        </div>

        <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
          <Plus className="size-4" />
        </Button>

        <NotificationCenter />

        <AssistantLauncherButton />

        <ThemeToggle />

        <Separator orientation="vertical" className="mx-1 h-5" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 gap-2 px-2 text-sm font-normal"
            >
              <Avatar className="size-6">
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline-block">{currentUser.name}</span>
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
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings />
                <span>Configuración</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={handleLogout}
            >
              <LogOut />
              <span>Cerrar sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
