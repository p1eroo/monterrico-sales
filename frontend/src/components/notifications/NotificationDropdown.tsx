import { useState, useEffect } from 'react';
import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationCard } from './NotificationCard';
import { EmpresasInactivasCard } from './EmpresasInactivasCard';
import { useNotificationStore } from '@/store/notificationStore';
import { getInactiveCompanies } from '@/lib/inactiveCompanies';
import { contactListAll, mapApiContactRowToContact } from '@/lib/contactApi';
import type { Contact } from '@/types';

interface NotificationDropdownProps {
  onOpenDrawer: () => void;
  onOpenInactiveCompanies: () => void;
  trigger: React.ReactNode;
}

export function NotificationDropdown({
  onOpenDrawer,
  onOpenInactiveCompanies,
  trigger,
}: NotificationDropdownProps) {
  const { notifications, markAllAsRead, refreshNotifications } =
    useNotificationStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  useEffect(() => {
    let c = true;
    void contactListAll()
      .then((rows) => {
        if (c) setContacts(rows.map(mapApiContactRowToContact));
      })
      .catch(() => {
        if (c) setContacts([]);
      });
    return () => {
      c = false;
    };
  }, []);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('todas');

  const unreadCount = notifications.filter((n) => !n.read).length;
  const importantCount = notifications.filter((n) => n.important).length;
  const inactiveCompaniesCount = getInactiveCompanies(contacts).length;

  const filtered =
    activeTab === 'no-leidas'
      ? notifications.filter((n) => !n.read)
      : activeTab === 'importantes'
        ? notifications.filter((n) => n.important)
        : notifications;

  const handleVerTodas = () => {
    setOpen(false);
    onOpenDrawer();
  };

  const handleEmpresasInactivas = () => {
    setOpen(false);
    onOpenInactiveCompanies();
  };

  const showEmpresasInactivas = activeTab === 'todas' || activeTab === 'importantes';

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void refreshNotifications();
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="rounded-xl border bg-card shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">Notificaciones</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#13944C]/15 px-2 py-0.5 text-xs font-medium text-[#13944C]">
                  {unreadCount} nuevas
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => void markAllAsRead()}
              >
                <CheckCheck className="size-3.5" />
                Marcar todas
              </Button>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mx-4 mt-2 h-8 w-[calc(100%-2rem)] rounded-lg bg-muted/60 p-0.5">
              <TabsTrigger value="todas" className="flex-1 text-xs">
                Todas
              </TabsTrigger>
              <TabsTrigger value="no-leidas" className="flex-1 text-xs">
                No leídas {unreadCount > 0 && `(${unreadCount})`}
              </TabsTrigger>
              <TabsTrigger value="importantes" className="flex-1 text-xs">
                Importantes {importantCount > 0 && `(${importantCount})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-0">
              <ScrollArea className="h-[280px]">
                <div className="space-y-2 p-3">
                  {showEmpresasInactivas && (
                    <EmpresasInactivasCard
                      count={inactiveCompaniesCount}
                      onClick={handleEmpresasInactivas}
                      variant="compact"
                    />
                  )}
                  {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Bell className="size-10 text-muted-foreground/50" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        No hay notificaciones
                      </p>
                    </div>
                  ) : (
                    filtered.slice(0, 5).map((n) => (
                      <NotificationCard
                        key={n.id}
                        notification={n}
                        variant="compact"
                        showActions={false}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="border-t p-3">
            <Button
              className="w-full bg-[#13944C] hover:bg-[#0f7a3d]"
              onClick={handleVerTodas}
            >
              Ver todas las notificaciones
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
