import { NavLink, useLocation } from 'react-router-dom';
import {
  Car,
  LayoutDashboard,
  UserPlus,
  Briefcase,
  Kanban,
  CalendarCheck,
  Calendar,
  Target,
  Building2,
  BarChart3,
  Users,
  Shield,
  Settings,
  LogOut,
  FileSearch,
  Mail,
  Send,
  FileArchive,
  Bot,
} from 'lucide-react';
import type { PermissionKey } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
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
import { initialsFromName } from '@/lib/utils';

type NavDef = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: PermissionKey;
  anyOf?: readonly PermissionKey[];
};

const navItems: NavDef[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.ver' },
  { to: '/contactos', label: 'Contactos', icon: UserPlus, permission: 'contactos.ver' },
  { to: '/empresas', label: 'Empresas', icon: Briefcase, permission: 'empresas.ver' },
  { to: '/opportunities', label: 'Oportunidades', icon: Target, permission: 'oportunidades.ver' },
  { to: '/pipeline', label: 'Pipeline', icon: Kanban, permission: 'pipeline.ver' },
  { to: '/tareas', label: 'Tareas', icon: CalendarCheck, permission: 'actividades.ver' },
  { to: '/calendario', label: 'Calendario', icon: Calendar, permission: 'actividades.ver' },
  { to: '/inbox', label: 'Correo', icon: Mail, permission: 'correo.ver' },
  { to: '/campaigns', label: 'Campañas', icon: Send, permission: 'campanas.ver' },
  { to: '/clients', label: 'Clientes', icon: Building2, permission: 'clientes.ver' },
  { to: '/reports', label: 'Reportes', icon: BarChart3, permission: 'reportes.ver' },
  { to: '/archivos', label: 'Archivos', icon: FileArchive, permission: 'archivos.ver' },
  { to: '/agentes-ia', label: 'Agentes IA', icon: Bot },
  { to: '/team', label: 'Equipo', icon: Users, permission: 'equipo.ver' },
  {
    to: '/users',
    label: 'Usuarios y Roles',
    icon: Shield,
    anyOf: ['usuarios.ver', 'roles.ver'],
  },
  { to: '/audit', label: 'Auditoría', icon: FileSearch, permission: 'auditoria.ver' },
  { to: '/settings', label: 'Configuración', icon: Settings, permission: 'configuracion.ver' },
];

function navItemVisible(
  item: NavDef,
  hasPermission: (k: PermissionKey) => boolean,
): boolean {
  if (item.anyOf?.length) {
    return item.anyOf.some((p) => hasPermission(p));
  }
  if (item.permission) {
    return hasPermission(item.permission);
  }
  return true;
}

export function AppSidebar() {
  const location = useLocation();
  const { currentUser, logout } = useAppStore();
  const { hasPermission } = usePermissions();
  const visibleNav = navItems.filter((item) => navItemVisible(item, hasPermission));

  const initials = initialsFromName(currentUser.name);

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
              CRM Qatuna
            </span>
          </div>
        </NavLink>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNav.map((item) => {
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
