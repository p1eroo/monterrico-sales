import { useEffect, useState } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
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

export default function MainLayout() {
  useUsers(); // Precarga usuarios de la API para selects de asignación
  const [showBriefing, setShowBriefing] = useState(false);
  const [dontShowAgainToday, setDontShowAgainToday] = useState(false);

  useEffect(() => {
    if (shouldShowDailyBriefing()) {
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
        });
        setPermissionKeys(me.permissions);
        const crm = await fetchCrmConfig();
        if (cancelled) return;
        useCrmConfigStore.getState().setBundle(crm);
        hydrateGoalsFromBundle(crm, me.id);
        try {
          const gp = await fetchAnalyticsGoalProgress();
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-hidden bg-background">
        <Topbar />
        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 md:px-6 md:pb-6 md:pt-0">
          <ModuleGate />
        </div>
      </SidebarInset>
      <Toaster position="bottom-right" richColors />
      <DailyBriefingPanel
        open={showBriefing}
        onOpenChange={setShowBriefing}
        dontShowAgainToday={dontShowAgainToday}
        onDontShowAgainChange={setDontShowAgainToday}
      />
      <AiAssistantDrawer />
    </SidebarProvider>
  );
}
