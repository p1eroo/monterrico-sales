import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { AppSidebar } from './AppSidebar';
import { Topbar } from './Topbar';
import { DailyOverviewModal } from '@/components/shared/DailyOverviewModal';
import { shouldShowDailyOverview } from '@/lib/dailyOverview';

export default function MainLayout() {
  const [showDailyOverview, setShowDailyOverview] = useState(false);
  const [dontShowAgainToday, setDontShowAgainToday] = useState(false);

  useEffect(() => {
    if (shouldShowDailyOverview()) {
      setShowDailyOverview(true);
    }
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <Topbar />
        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
      <Toaster position="bottom-right" richColors />
      <DailyOverviewModal
        open={showDailyOverview}
        onOpenChange={setShowDailyOverview}
        dontShowAgainToday={dontShowAgainToday}
        onDontShowAgainChange={setDontShowAgainToday}
      />
    </SidebarProvider>
  );
}
