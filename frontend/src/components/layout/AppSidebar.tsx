import { type ComponentType } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { UserPlus, Users, Shield, Settings,
  FileSearch, Bot, ArrowRightLeft, ChevronDown, MessageCircle,
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
import { cn } from '@/lib/utils';
import { CollapsedSidebarFlyout } from '@/components/layout/CollapsedSidebarFlyout';
import { APP_PATHS } from '@/lib/detailRoutes';
import logoMark from '@/assets/logo.png';
import tmWordmark from '@/assets/TM.png';
import { DashboardSvgIcon } from '@/components/icons/DashboardSvgIcon';
import { UsersGroupTwoRoundedSvgIcon } from '@/components/icons/UsersGroupTwoRoundedSvgIcon';
import { Buildings2SvgIcon } from '@/components/icons/Buildings2SvgIcon';
import { MoneyBagSvgIcon } from '@/components/icons/MoneyBagSvgIcon';
import { DocumentAddSvgIcon } from '@/components/icons/DocumentAddSvgIcon';
import { CalendarSvgIcon } from '@/components/icons/CalendarSvgIcon';
import { LetterSvgIcon } from '@/components/icons/LetterSvgIcon';
import { MapArrowSquareSvgIcon } from '@/components/icons/MapArrowSquareSvgIcon';
import { SuitcaseSvgIcon } from '@/components/icons/SuitcaseSvgIcon';
import { ChatSquare2SvgIcon } from '@/components/icons/ChatSquare2SvgIcon';
import { SsdSquareSvgIcon } from '@/components/icons/SsdSquareSvgIcon';
import { CpuSvgIcon } from '@/components/icons/CpuSvgIcon';
import { Widget5SvgIcon } from '@/components/icons/Widget5SvgIcon';
import { WheelSvgIcon } from '@/components/icons/WheelSvgIcon';
import { ChatUnreadSvgIcon } from '@/components/icons/ChatUnreadSvgIcon';
import { SettingsSvgIcon } from '@/components/icons/SettingsSvgIcon';
import { PaletteRoundSvgIcon } from '@/components/icons/PaletteRoundSvgIcon';
import { SquareDoubleAltArrowLeftSvgIcon } from '@/components/icons/SquareDoubleAltArrowLeftSvgIcon';

type NavIcon = ComponentType<{ className?: string }>;

type NavDef = {
  to: string;
  label: string;
  icon: NavIcon;
  permission?: PermissionKey;
  anyOf?: readonly PermissionKey[];
  groupLabel?: string;
  children?: { to: string; label: string; icon: NavIcon }[];
};

const navItems: NavDef[] = [
  { to: '/dashboard', label: 'Dashboard', icon: DashboardSvgIcon, permission: 'dashboard.ver' },
  { to: APP_PATHS.contacts, label: 'Contactos', icon: UsersGroupTwoRoundedSvgIcon, permission: 'contactos.ver' },
  { to: APP_PATHS.companies, label: 'Empresas', icon: Buildings2SvgIcon, permission: 'empresas.ver' },
  { to: '/opportunities', label: 'Oportunidades', icon: MoneyBagSvgIcon, permission: 'oportunidades.ver' },
  { to: '/tareas', label: 'Tareas', icon: DocumentAddSvgIcon, permission: 'actividades.ver' },
  { to: '/calendario', label: 'Calendario', icon: CalendarSvgIcon, permission: 'actividades.ver' },
  { to: '/inbox', label: 'Correo', icon: LetterSvgIcon, permission: 'correo.ver' },
  { to: '/campaigns', label: 'Masivo', icon: MapArrowSquareSvgIcon, permission: 'campanas.ver' },
  {
    to: '/clients',
    label: 'Clientes',
    icon: SuitcaseSvgIcon,
    permission: 'clientes.ver',
    children: [
      { to: APP_PATHS.clientCompanies, label: 'Empresas', icon: Buildings2SvgIcon },
      { to: APP_PATHS.clientContacts, label: 'Contactos', icon: UsersGroupTwoRoundedSvgIcon },
      { to: APP_PATHS.clientTasks, label: 'Tareas', icon: DocumentAddSvgIcon },
    ],
  },
  { to: '/reports', label: 'Reportes', icon: ChatSquare2SvgIcon, permission: 'reportes.ver' },
  { to: '/archivos', label: 'Archivos', icon: SsdSquareSvgIcon, permission: 'archivos.ver' },
  {
    to: '/integraciones',
    label: 'Integraciones',
    icon: CpuSvgIcon,
    children: [
      { to: '/agentes-ia', label: 'Agentes IA', icon: Bot },
    ],
  },
  { to: '/team', label: 'Equipo', icon: Widget5SvgIcon, permission: 'equipo.ver' },
  { to: '/settings', label: 'Configuración', icon: SettingsSvgIcon, permission: 'configuracion.ver' },
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
  { to: '/flota/prospectos', label: 'Prospectos', icon: UsersGroupTwoRoundedSvgIcon, permission: 'flota_prospectos.ver' },
  { to: '/flota/whatsapp', label: 'WhatsApp', icon: MessageCircle, permission: 'flota_mensajes.ver' },
  { to: '/flota/conductores', label: 'Conductores', icon: WheelSvgIcon, permission: 'flota_conductores.ver' },
  { to: '/flota/calendario', label: 'Calendario', icon: CalendarSvgIcon, permission: 'flota_prospectos.ver' },
  { to: '/flota/reportes', label: 'Reportes', icon: Widget5SvgIcon, permission: 'flota_reportes.ver' },
  { to: '/flota/mensajes', label: 'Mensajes', icon: ChatUnreadSvgIcon, permission: 'flota_mensajes.ver' },
  {
    to: '/flota/integraciones',
    label: 'Integraciones',
    icon: ArrowRightLeft,
    permission: 'flota_mensajes.ver',
    groupLabel: 'Canales',
    children: [
      { to: '/flota/integraciones/evolution', label: 'Evolution GO', icon: MessageCircle },
    ],
  },
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
                    <CollapsedSidebarFlyout
                      key={item.to}
                      itemKey={item.to}
                      label={item.label}
                      icon={item.icon}
                      isActive={hasActiveChild}
                    >
                      {item.groupLabel && (
                        <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/50">
                          {item.groupLabel}
                        </p>
                      )}
                      {item.children.map((child) => {
                        const isChildActive = location.pathname.startsWith(child.to);
                        return (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            className={cn(
                              'group/flyout-item flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-normal whitespace-nowrap transition-colors',
                              'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                              isChildActive &&
                                'bg-sidebar-accent text-sidebar-accent-foreground',
                            )}
                          >
                            <child.icon
                              className={cn(
                                'size-4 shrink-0 transition-colors',
                                isChildActive
                                  ? 'text-sidebar-icon-active'
                                  : 'text-sidebar-icon group-hover/flyout-item:text-sidebar-icon-active',
                              )}
                            />
                            {child.label}
                          </NavLink>
                        );
                      })}
                    </CollapsedSidebarFlyout>
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
                            {item.groupLabel && (
                              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/50">
                                {item.groupLabel}
                              </p>
                            )}
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
              <PaletteRoundSvgIcon />
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
              <SquareDoubleAltArrowLeftSvgIcon />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
