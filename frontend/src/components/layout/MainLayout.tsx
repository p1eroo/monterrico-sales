import { useEffect, useState } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { AppSidebar } from './AppSidebar';
import { Topbar } from './Topbar';
import { ModuleGate } from './ModuleGate';
import { DailyBriefingPanel } from '@/components/shared/DailyBriefingPanel';
import { shouldShowDailyBriefing } from '@/lib/dailyOverview';
import { useUsers } from '@/hooks/useUsers';

export default function MainLayout() {
  useUsers(); // Precarga usuarios de la API para selects de asignación
  const [showBriefing, setShowBriefing] = useState(false);
  const [dontShowAgainToday, setDontShowAgainToday] = useState(false);

  useEffect(() => {
    if (shouldShowDailyBriefing()) {
      setShowBriefing(true);
    }
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <Topbar />
        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
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
    </SidebarProvider>
  );
}
