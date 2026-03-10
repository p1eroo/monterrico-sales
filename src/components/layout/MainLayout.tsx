import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { AppSidebar } from './AppSidebar';
import { Topbar } from './Topbar';

export default function MainLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Topbar />
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
      <Toaster position="bottom-right" richColors />
    </SidebarProvider>
  );
}
