import { useEffect, useRef, useState, type ComponentType } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { UserPlus, Briefcase, CalendarCheck, Calendar, Target, Building2,
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
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { APP_PATHS } from '@/lib/detailRoutes';
import logoMark from '@/assets/logo.png';
import tmWordmark from '@/assets/TM.png';
import { DashboardSvgIcon } from '@/components/icons/DashboardSvgIcon';

type NavIcon = ComponentType<{ className?: string }>;

type NavDef = {
  to: string;
  label: string;
  icon: NavIcon;
  permission?: PermissionKey;
  anyOf?: readonly PermissionKey[];
  children?: { to: string; label: string; icon: NavIcon }[];
};

const collapsedFlyoutClass =
  'relative w-auto min-w-0 rounded-2xl border-0 bg-popover px-2 py-2 text-sm shadow-[0_4px_24px_rgba(15,23,42,0.1)] before:absolute before:-left-3 before:top-0 before:h-full before:w-3 before:content-[""]';

const navItems: NavDef[] = [
  { to: '/dashboard', label: 'Dashboard', icon: DashboardSvgIcon, permission: 'dashboard.ver' },
  { to: APP_PATHS.contacts, label: 'Contactos', icon: UserPlus, permission: 'contactos.ver' },
  { to: APP_PATHS.companies, label: 'Empresas', icon: Briefcase, permission: 'empresas.ver' },
  { to: '/opportunities', label: 'Oportunidades', icon: Target, permission: 'oportunidades.ver' },
  { to: '/tareas', label: 'Tareas', icon: CalendarCheck, permission: 'actividades.ver' },
  { to: '/calendario', label: 'Calendario', icon: Calendar, permission: 'actividades.ver' },
  { to: '/inbox', label: 'Correo', icon: Mail, permission: 'correo.ver' },
  { to: '/campaigns', label: 'Masivo', icon: Send, permission: 'campanas.ver' },
  {
    to: '/clients',
    label: 'Clientes',
    icon: Building2,
    permission: 'clientes.ver',
    children: [
      { to: APP_PATHS.clientCompanies, label: 'Empresas', icon: Briefcase },
      { to: APP_PATHS.clientContacts, label: 'Contactos', icon: UserPlus },
    ],
  },
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
  { to: '/flota/dashboard', label: 'Dashboard', icon: DashboardSvgIcon, permission: 'flota_dashboard.ver' },
  { to: '/flota/prospectos', label: 'Prospectos', icon: UserCheck, permission: 'flota_prospectos.ver' },
  { to: '/flota/conductores', label: 'Conductores', icon: Car, permission: 'flota_conductores.ver' },
  { to: '/flota/calendario', label: 'Calendario', icon: Calendar, permission: 'flota_prospectos.ver' },
  { to: '/flota/reportes', label: 'Reportes', icon: BarChart3, permission: 'flota_reportes.ver' },
  { to: '/flota/mensajes', label: 'Mensajes', icon: MessageCircle, permission: 'flota_mensajes.ver' },
];

const navItemsAdmin: NavDef[] = [
  { to: '/admin', label: 'Panel Control', icon: DashboardSvgIcon },
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
  { to: '/marketing', label: 'Dashboard', icon: DashboardSvgIcon },
  { to: '/marketing/leads', label: 'Leads', icon: UserPlus },
  { to: '/marketing/integrations', label: 'Integraciones', icon: ArrowRightLeft },
  { to: '/marketing/personal', label: 'Personal', icon: Users },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, area, currentUser } = useAppStore();
  const { state: sidebarState } = useSidebar();
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const popoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCollapsed = sidebarState === 'collapsed';

  const clearPopoverCloseTimer = () => {
    if (popoverCloseTimerRef.current) {
      clearTimeout(popoverCloseTimerRef.current);
      popoverCloseTimerRef.current = null;
    }
  };

  const openCollapsedPopover = (key: string) => {
    clearPopoverCloseTimer();
    setOpenPopover(key);
  };

  const scheduleCollapsedPopoverClose = () => {
    clearPopoverCloseTimer();
    popoverCloseTimerRef.current = setTimeout(() => {
      setOpenPopover(null);
      popoverCloseTimerRef.current = null;
    }, 120);
  };

  useEffect(() => () => clearPopoverCloseTimer(), []);

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
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-3">
        <NavLink
          to="/dashboard"
          aria-label="CRM Qatuna, ir al inicio"
          className="flex items-center justify-center gap-3 group-data-[collapsible=icon]:justify-center"
        >
          <img
            src={logoMark}
            alt=""
            role="presentation"
            className="size-10 shrink-0 rounded-lg object-contain group-data-[collapsible=icon]:size-[36px]"
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

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNav.map((item) => {
                const isActive = !item.children && location.pathname.startsWith(item.to);
                const hasActiveChild = item.children?.some((c) => location.pathname.startsWith(c.to));

                if (item.children) {
                  return isCollapsed ? (
                    <SidebarMenuItem
                      key={item.to}
                      className="relative"
                      onMouseEnter={() => openCollapsedPopover(item.to)}
                      onMouseLeave={scheduleCollapsedPopoverClose}
                    >
                        <Popover
                          open={openPopover === item.to}
                          onOpenChange={(open) => {
                            if (open) openCollapsedPopover(item.to);
                            else {
                              clearPopoverCloseTimer();
                              setOpenPopover(null);
                            }
                          }}
                        >
                          <PopoverAnchor asChild>
                            <span
                              aria-hidden
                              className="pointer-events-none absolute top-1/2 right-0 size-px -translate-y-1/2"
                            />
                          </PopoverAnchor>
                          <SidebarMenuButton
                            isActive={hasActiveChild}
                            className={cn('w-full outline-none focus-visible:outline-none focus-visible:ring-0', hasActiveChild && 'text-sidebar-accent-foreground')}
                          >
                            <item.icon />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                          <PopoverContent
                            side="right"
                            align="center"
                            sideOffset={0}
                            className={cn('border-0 p-0', collapsedFlyoutClass)}
                            onMouseEnter={() => openCollapsedPopover(item.to)}
                            onMouseLeave={scheduleCollapsedPopoverClose}
                          >
                          <div className="flex flex-col gap-0.5">
                          {item.children.map((child) => {
                            const isChildActive = location.pathname.startsWith(child.to);
                            return (
                              <NavLink
                                key={child.to}
                                to={child.to}
                                className={cn(
                                  'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm whitespace-nowrap transition-colors hover:bg-muted/60',
                                  isChildActive && 'font-medium text-primary',
                                )}
                              >
                                <span
                                  className={cn(
                                    'size-1.5 shrink-0 rounded-full',
                                    isChildActive ? 'bg-primary' : 'bg-foreground/75',
                                  )}
                                  aria-hidden
                                />
                                {child.label}
                              </NavLink>
                            );
                          })}
                          </div>
                        </PopoverContent>
                      </Popover>
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

      <SidebarFooter className="p-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2">
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
