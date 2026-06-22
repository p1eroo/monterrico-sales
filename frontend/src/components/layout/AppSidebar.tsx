import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UserPlus,
  Briefcase,
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
  Car,
  UserCheck,
  ArrowRightLeft,
  MessageCircle,
  Search,
  Puzzle,
  ChevronDown,
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';

import { useAppStore } from '@/store';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import logoMark from '@/assets/logo.png';
import tmWordmark from '@/assets/TM.png';

type NavDef = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: PermissionKey;
  anyOf?: readonly PermissionKey[];
  children?: { to: string; label: string; icon: typeof LayoutDashboard }[];
};

const navItems: NavDef[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.ver' },
  { to: '/contactos', label: 'Contactos', icon: UserPlus, permission: 'contactos.ver' },
  { to: '/empresas', label: 'Empresas', icon: Briefcase, permission: 'empresas.ver' },
  { to: '/opportunities', label: 'Oportunidades', icon: Target, permission: 'oportunidades.ver' },
  { to: '/tareas', label: 'Tareas', icon: CalendarCheck, permission: 'actividades.ver' },
  { to: '/calendario', label: 'Calendario', icon: Calendar, permission: 'actividades.ver' },
  { to: '/inbox', label: 'Correo', icon: Mail, permission: 'correo.ver' },
  { to: '/campaigns', label: 'Masivo', icon: Send, permission: 'campanas.ver' },
  { to: '/clients', label: 'Clientes', icon: Building2, permission: 'clientes.ver' },
  { to: '/reports', label: 'Reportes', icon: BarChart3, permission: 'reportes.ver' },
  { to: '/archivos', label: 'Archivos', icon: FileArchive, permission: 'archivos.ver' },
  {
    to: '/integraciones',
    label: 'Integraciones',
    icon: Puzzle,
    children: [
      { to: '/integraciones/apollo', label: 'Apollo', icon: Search },
      { to: '/agentes-ia', label: 'Agentes IA', icon: Bot },
    ],
  },
  { to: '/team', label: 'Equipo', icon: Users, permission: 'equipo.ver' },
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

const navItemsFlota: NavDef[] = [
  { to: '/flota/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'flota_dashboard.ver' },
  { to: '/flota/prospectos', label: 'Prospectos', icon: UserCheck, permission: 'flota_prospectos.ver' },
  { to: '/flota/conductores', label: 'Conductores', icon: Car, permission: 'flota_conductores.ver' },
  { to: '/flota/calendario', label: 'Calendario', icon: Calendar, permission: 'flota_prospectos.ver' },
  { to: '/flota/reportes', label: 'Reportes', icon: BarChart3, permission: 'flota_reportes.ver' },
  { to: '/flota/mensajes', label: 'Mensajes', icon: MessageCircle, permission: 'flota_mensajes.ver' },
];

const navItemsAdmin: NavDef[] = [
  { to: '/admin', label: 'Panel Control', icon: LayoutDashboard },
  {
    to: '/admin/users',
    label: 'Usuarios y Roles',
    icon: Shield,
    anyOf: ['usuarios.ver', 'roles.ver'],
  },
  { to: '/admin/audit', label: 'Auditoría', icon: FileSearch, permission: 'auditoria.ver' },
  { to: '/settings', label: 'Configuración', icon: Settings, permission: 'configuracion.ver' },
];

const navItemsMarketing: NavDef[] = [
  { to: '/marketing', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/marketing/leads', label: 'Leads', icon: UserPlus },
  { to: '/marketing/integrations', label: 'Integraciones', icon: ArrowRightLeft },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, area, currentUser } = useAppStore();
  const { state: sidebarState } = useSidebar();
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const isCollapsed = sidebarState === 'collapsed';

  const { hasPermission } = usePermissions();
  const allowedAreas = currentUser.allowedAreas || [];
  const effectiveArea = allowedAreas.length === 1 ? allowedAreas[0] : area;
  const currentNavItems = 
    effectiveArea === 'flota' ? navItemsFlota : 
    effectiveArea === 'marketing' ? navItemsMarketing :
    effectiveArea === 'admin' ? navItemsAdmin : 
    navItems;
  const visibleNav = currentNavItems;

  return (
    <Sidebar collapsible="icon" variant="inset" className="border-sidebar-border/80">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
        <NavLink
          to="/dashboard"
          aria-label="CRM Qatuna, ir al inicio"
          className="flex items-center justify-center gap-3 group-data-[collapsible=icon]:justify-center"
        >
          <img
            src={logoMark}
            alt=""
            role="presentation"
            className="size-10 shrink-0 rounded-lg object-contain"
          />
          <div className="flex min-w-0 flex-col gap-1 group-data-[collapsible=icon]:hidden">
            <img
              src={tmWordmark}
              alt=""
              role="presentation"
              className="h-4 w-auto max-w-[7rem] object-contain object-left"
            />
            <span className="text-[12px] text-sidebar-foreground/70" aria-hidden>
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
                const isActive = !item.children && location.pathname.startsWith(item.to);
                const hasActiveChild = item.children?.some((c) => location.pathname.startsWith(c.to));

                if (item.children) {
                  return isCollapsed ? (
                    <SidebarMenuItem key={item.to}>
                      <div
                        onMouseEnter={() => setOpenPopover(item.to)}
                        onMouseLeave={() => setOpenPopover(null)}
                      >
                        <Popover open={openPopover === item.to} onOpenChange={(open) => setOpenPopover(open ? item.to : null)}>
                          <PopoverTrigger asChild>
                            <SidebarMenuButton className={cn('outline-none focus-visible:outline-none focus-visible:ring-0', hasActiveChild && 'text-sidebar-accent-foreground')}>
                              <item.icon />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                          </PopoverTrigger>
                          <PopoverContent
                            side="right"
                            align="start"
                            sideOffset={12}
                            className="w-auto p-1 min-w-40"
                            onMouseEnter={() => setOpenPopover(item.to)}
                            onMouseLeave={() => setOpenPopover(null)}
                          >
                          {item.children.map((child) => {
                            const isChildActive = location.pathname.startsWith(child.to);
                            return (
                              <NavLink
                                key={child.to}
                                to={child.to}
                                className={cn(
                                  'flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm hover:bg-muted transition-colors',
                                  isChildActive && 'font-medium text-primary',
                                )}
                              >
                                <child.icon className="size-4" />
                                {child.label}
                              </NavLink>
                            );
                          })}
                        </PopoverContent>
                      </Popover>
                    </div>
                    </SidebarMenuItem>
                  ) : (
                    <Collapsible key={item.to} defaultOpen={hasActiveChild} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={item.label} className={cn(hasActiveChild && 'text-sidebar-accent-foreground')}>
                            <item.icon />
                            <span>{item.label}</span>
                            <ChevronDown className="ml-auto size-3.5 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-0 -rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.children.map((child) => {
                              const isChildActive = location.pathname.startsWith(child.to);
                              return (
                                <SidebarMenuSubItem key={child.to}>
                                  <SidebarMenuSubButton asChild isActive={isChildActive}>
                                    <NavLink to={child.to}>
                                      <child.icon />
                                      <span>{child.label}</span>
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

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
              tooltip="Cambiar área"
              onClick={() => navigate('/area-select')}
              className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <ArrowRightLeft />
              <span>Cambiar área</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Cerrar sesión"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive"
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
