import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Bell,
  User,
  Settings,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
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
import { notifications } from '@/data/mock';
import { cn } from '@/lib/utils';

const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/contactos': 'Contactos',
  '/empresas': 'Empresas',
  '/pipeline': 'Pipeline',
  '/tareas': 'Tareas',
  '/calendario': 'Calendario',
  '/opportunities': 'Oportunidades',
  '/clients': 'Clientes',
  '/reports': 'Reportes',
  '/team': 'Equipo',
  '/settings': 'Configuración',
};

const notificationIcons = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: XCircle,
} as const;

const notificationColors = {
  info: 'text-blue-500',
  warning: 'text-amber-500',
  success: 'text-emerald-500',
  error: 'text-red-500',
} as const;

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAppStore();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const currentRoute = Object.keys(routeLabels).find((route) =>
    location.pathname.startsWith(route),
  );
  const pageTitle = currentRoute ? routeLabels[currentRoute] : 'Página';

  const initials = currentUser.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2);

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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative text-muted-foreground"
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notificaciones</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {unreadCount} nuevas
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.map((notification) => {
              const IconComp = notificationIcons[notification.type];
              return (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex items-start gap-3 p-3"
                >
                  <IconComp
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      notificationColors[notification.type],
                    )}
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p
                      className={cn(
                        'text-sm leading-tight',
                        !notification.read && 'font-medium',
                      )}
                    >
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-tight">
                      {notification.description}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70">
                      {notification.time}
                    </p>
                  </div>
                  {!notification.read && (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

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
                <p className="text-xs text-muted-foreground">
                  {currentUser.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <User />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
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
