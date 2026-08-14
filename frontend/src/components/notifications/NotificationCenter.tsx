import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { NotificationBingSvgIcon } from '@/components/icons/NotificationBingSvgIcon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { topbarActionButtonClass } from '@/lib/topbarIconStyles';
import { useComercialNotificationsRealtime } from '@/lib/comercialNotificationsRealtime';
import { NotificationDropdown } from './NotificationDropdown';
import { NotificationDrawer, type DrawerView } from './NotificationDrawer';
import { useNotificationStore } from '@/store/notificationStore';

const WEB_LEAD_HINT_KEY = 'crm.webLeadHintDismissedAt';

function readHintDismissedAt(): string | null {
  try {
    return localStorage.getItem(WEB_LEAD_HINT_KEY);
  } catch {
    return null;
  }
}

export function NotificationCenter() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<DrawerView>('notifications');
  const [hintDismissedAt, setHintDismissedAt] = useState<string | null>(
    readHintDismissedAt,
  );
  const refreshNotifications = useNotificationStore((s) => s.refreshNotifications);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const unreadWebLeads = useMemo(
    () => notifications.filter((n) => n.kind === 'web_lead' && !n.read),
    [notifications],
  );

  const showHint = useMemo(() => {
    if (unreadWebLeads.length === 0) return false;
    const newest = unreadWebLeads.reduce((max, n) => {
      const t = n.createdAt ? Date.parse(n.createdAt) : 0;
      return t > max ? t : max;
    }, 0);
    if (!hintDismissedAt) return true;
    const dismissed = Date.parse(hintDismissedAt);
    return Number.isFinite(newest) && Number.isFinite(dismissed) && newest > dismissed;
  }, [unreadWebLeads, hintDismissedAt]);

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

  useComercialNotificationsRealtime(() => {
    void refreshNotifications();
  });

  const dismissHint = () => {
    const now = new Date().toISOString();
    try {
      localStorage.setItem(WEB_LEAD_HINT_KEY, now);
    } catch {
      /* ignore quota / private mode */
    }
    setHintDismissedAt(now);
  };

  const openDrawer = (view: DrawerView = 'notifications') => {
    setDrawerView(view);
    setDrawerOpen(true);
  };

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        'relative',
        topbarActionButtonClass,
        showHint &&
          'ring-2 ring-[#13944C]/35 ring-offset-1 ring-offset-white dark:ring-offset-gray-900',
      )}
    >
      <NotificationBingSvgIcon className="size-[30px]" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#13944C] text-[10px] font-bold text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Button>
  );

  return (
    <div className="relative">
      <NotificationDropdown
        trigger={trigger}
        openToTab={showHint ? 'importantes' : undefined}
        onOpenChange={(open) => {
          if (open && showHint) dismissHint();
        }}
        onOpenDrawer={() => openDrawer('notifications')}
        onOpenInactiveCompanies={() => openDrawer('inactive-companies')}
      />
      {showHint && (
        <div
          role="status"
          aria-live="polite"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(calc(100vw-2rem),17rem)] animate-in fade-in slide-in-from-top-1 duration-300"
        >
          <div className="relative rounded-xl border border-[#13944C]/25 bg-white px-3 py-2.5 text-left shadow-lg dark:border-green-800/40 dark:bg-gray-900">
            <div
              className="absolute -top-1.5 right-6 size-3 rotate-45 border-l border-t border-[#13944C]/25 bg-white dark:border-green-800/40 dark:bg-gray-900"
              aria-hidden
            />
            <button
              type="button"
              onClick={dismissHint}
              className="absolute right-1.5 top-1.5 rounded-md p-0.5 text-[#8a9aab] transition-colors hover:text-[#1f2933] dark:text-gray-400 dark:hover:text-gray-100"
              aria-label="Cerrar aviso"
            >
              <X className="size-3.5" />
            </button>
            <p className="pr-5 text-[13px] leading-snug text-[#1f2933] dark:text-gray-100">
              <span className="font-medium text-[#13944C] dark:text-green-400">
                Nuevo interesado en Taxi Monterrico
              </span>{' '}
              Revisa la campana, pestaña Importantes, para abrir el contacto o la empresa.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-2 h-7 bg-[#13944C] px-2.5 text-xs text-white hover:bg-[#0f7a3d]"
              onClick={dismissHint}
            >
              Entendido
            </Button>
          </div>
        </div>
      )}
      <NotificationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initialView={drawerView}
      />
    </div>
  );
}
