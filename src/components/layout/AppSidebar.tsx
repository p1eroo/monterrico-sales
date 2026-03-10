import { NavLink, useLocation } from 'react-router-dom';
import {
  Car,
  LayoutDashboard,
  UserPlus,
  Briefcase,
  Kanban,
  CalendarCheck,
  Target,
  Building2,
  BarChart3,
  Users,
  Settings,
  LogOut,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAppStore } from '@/store';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/contactos', label: 'Contactos', icon: UserPlus },
  { to: '/empresas', label: 'Empresas', icon: Briefcase },
  { to: '/pipeline', label: 'Pipeline', icon: Kanban },
  { to: '/activities', label: 'Actividades', icon: CalendarCheck },
  { to: '/opportunities', label: 'Oportunidades', icon: Target },
  { to: '/clients', label: 'Clientes', icon: Building2 },
  { to: '/reports', label: 'Reportes', icon: BarChart3 },
  { to: '/team', label: 'Equipo', icon: Users },
  { to: '/settings', label: 'Configuración', icon: Settings },
] as const;

export function AppSidebar() {
  const location = useLocation();
  const { currentUser, logout } = useAppStore();

  const initials = currentUser.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
        <NavLink to="/dashboard" className="flex items-center justify-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Car className="size-4" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold tracking-tight text-sidebar-foreground">
              Taxi Monterrico
            </span>
            <span className="text-[11px] text-sidebar-foreground/60">
              CRM Ventas
            </span>
          </div>
        </NavLink>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname.startsWith(item.to);

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <NavLink to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="gap-3"
              tooltip={currentUser.name}
            >
              <Avatar className="size-7 shrink-0">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
                <span className="truncate text-xs font-medium text-sidebar-foreground">
                  {currentUser.name}
                </span>
                <span className="truncate text-[11px] text-sidebar-foreground/60">
                  {currentUser.role}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Cerrar sesión"
              onClick={logout}
              className="text-sidebar-foreground/60 hover:text-red-400"
            >
              <LogOut />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
