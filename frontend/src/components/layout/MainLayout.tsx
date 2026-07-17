import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SidebarProvider, SidebarInset, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isCrmEntityDetailPath } from '@/lib/detailRoutes';
import { Toaster } from '@/components/ui/sonner';
import { AppSidebar } from './AppSidebar';
import { Topbar } from './Topbar';
import { ModuleGate } from './ModuleGate';
import { DailyBriefingPanel } from '@/components/shared/DailyBriefingPanel';
import { shouldShowDailyBriefing } from '@/lib/dailyOverview';
import { useUsers } from '@/hooks/useUsers';
import { fetchAuthMe } from '@/lib/api';
import { fetchCrmConfig } from '@/lib/crmConfigApi';
import { useAppStore } from '@/store';
import { useCrmConfigStore } from '@/store/crmConfigStore';
import { hydrateGoalsFromBundle } from '@/store/goalsStore';
import { fetchAnalyticsGoalProgress } from '@/lib/analyticsApi';
import { useAnalyticsGoalStore } from '@/store/analyticsGoalStore';
import { AiAssistantDrawer } from '@/components/assistant/AiAssistantDrawer';
import { ImportJobsPanel } from './ImportJobsPanel';

/** Toggle en la costura sidebar / contenido (solo desktop; fuera del topbar). */
function SidebarDividerToggle() {
  const { toggleSidebar, state } = useSidebar();

  return (
    <Button
      type="button"
      variant="default"
      size="icon-sm"
      aria-label={state === 'expanded' ? 'Contraer barra lateral' : 'Expandir barra lateral'}
      className={cn(
        'absolute left-0 z-[60] hidden size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-0 p-0 md:inline-flex',
        'top-[4rem]',
        'shadow-[0_2px_8px_rgba(15,23,42,0.16)] hover:shadow-[0_2px_12px_rgba(15,23,42,0.2)]',
        'dark:shadow-[0_2px_10px_rgba(0,0,0,0.4)] dark:hover:shadow-[0_2px_14px_rgba(0,0,0,0.5)]',
      )}
      onClick={toggleSidebar}
    >
      {state === 'expanded' ? (
        <ChevronLeft className="size-4 text-primary-foreground" strokeWidth={1.75} aria-hidden />
      ) : (
        <ChevronRight className="size-4 text-primary-foreground" strokeWidth={1.75} aria-hidden />
      )}
    </Button>
  );
}

export default function MainLayout() {
  const { pathname } = useLocation();
  const compactMainTop = isCrmEntityDetailPath(pathname);

  useUsers(); // Precarga usuarios de la API para selects de asignación
  const [showBriefing, setShowBriefing] = useState(false);
  const [dontShowAgainToday, setDontShowAgainToday] = useState(false);

  useEffect(() => {
    const area = useAppStore.getState().area;
    if (area === 'comercial' && shouldShowDailyBriefing()) {
      setShowBriefing(true);
    }
  }, []);

  /** Sincroniza permisos con Authority y catálogo CRM (/crm-config + metas). */
  useEffect(() => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchAuthMe();
        if (cancelled) return;
        const { updateCurrentUser, setPermissionKeys } = useAppStore.getState();
        updateCurrentUser({
          id: me.id,
          username: me.username,
          name: me.name,
          phone: me.phone || undefined,
          avatar: me.avatar || undefined,
          role: me.role,
          roleId: me.roleId,
          roleName: me.roleName,
          createdAt: me.joinedAt?.slice(0, 10),
          lastActivity: me.lastActivity ?? undefined,
          allowedAreas: me.allowedAreas || [],
        });
        const allowed = me.allowedAreas || [];
        const { area: currentArea, setArea } = useAppStore.getState();
        if (allowed.length === 1 && currentArea !== allowed[0]) {
          setArea(allowed[0]);
        }
        setPermissionKeys(me.permissions);
        const crm = await fetchCrmConfig();
        if (cancelled) return;
        useCrmConfigStore.getState().setBundle(crm);
        hydrateGoalsFromBundle(crm, me.id);
        try {
          const area = useAppStore.getState().area;
          const gp = await fetchAnalyticsGoalProgress(undefined, area === 'admin' ? undefined : area);
          if (!cancelled) useAnalyticsGoalStore.getState().setProgress(gp);
        } catch {
          /* sin permiso analytics o red: las tarjetas de meta usan 0 en ventas */
        }
      } catch (e: unknown) {
        const status = e instanceof Error ? (e as Error & { status?: number }).status : undefined;
        if (status === 401) {
          useAppStore.getState().logout();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="h-svh max-h-svh overflow-hidden">
    <style>{`[data-slot="sidebar-wrapper"][data-collapsible="icon"] { --sidebar-width: 11rem !important; }`}</style>
    {/* Móvil: tope a svh para que el pane interno scrollee (SidebarInset trae min-h-svh). Desktop intacto. */}
    <SidebarProvider className="h-svh max-h-svh min-h-0 overflow-hidden">
      <AppSidebar />
      <SidebarInset
        className="h-svh max-h-svh min-h-0 min-w-0 max-w-full bg-[#F3F4F6] dark:bg-neutral-950 md:z-20 md:h-[calc(100svh-1rem)] md:max-h-[calc(100svh-1rem)] md:!ml-0"
      >
        {/* overflow solo en el card interno; el toggle es hermano para no quedar recortado */}
        <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden md:rounded-xl">
          <Topbar />
          <div
            className={cn(
              'min-h-0 min-w-0 max-w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch] px-4 md:px-8',
              compactMainTop
                ? 'pt-0 pb-4 md:pt-0.5 md:pb-5'
                : 'pt-4 pb-5 md:pt-5 md:pb-6',
            )}
          >
            <ModuleGate />
          </div>
        </div>
        <SidebarDividerToggle />
      </SidebarInset>
      <Toaster />
      <ImportJobsPanel />
      <DailyBriefingPanel
        open={showBriefing}
        onOpenChange={setShowBriefing}
        dontShowAgainToday={dontShowAgainToday}
        onDontShowAgainChange={setDontShowAgainToday}
      />
      <AiAssistantDrawer />
    </SidebarProvider>
    </div>
  );
}
