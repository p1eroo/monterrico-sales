import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationDropdown } from './NotificationDropdown';
import { NotificationDrawer, type DrawerView } from './NotificationDrawer';
import { useNotificationStore } from '@/store/notificationStore';

export function NotificationCenter() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<DrawerView>('notifications');
  const refreshNotifications = useNotificationStore((s) => s.refreshNotifications);
  const unreadCount = useNotificationStore((s) =>
    s.notifications.filter((n) => !n.read).length,
  );

  useEffect(() => {
    void refreshNotifications();
    const t = setInterval(() => void refreshNotifications(), 120_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshNotifications();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refreshNotifications]);

  const openDrawer = (view: DrawerView = 'notifications') => {
    setDrawerView(view);
    setDrawerOpen(true);
  };

  const trigger = (
    <Button
      variant="ghost"
      size="icon-sm"
      className="relative text-muted-foreground"
    >
      <Bell className="size-4" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#13944C] text-[10px] font-bold text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Button>
  );

  return (
    <>
      <NotificationDropdown
        trigger={trigger}
        onOpenDrawer={() => openDrawer('notifications')}
        onOpenInactiveCompanies={() => openDrawer('inactive-companies')}
      />
      <NotificationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initialView={drawerView}
      />
    </>
  );
}
