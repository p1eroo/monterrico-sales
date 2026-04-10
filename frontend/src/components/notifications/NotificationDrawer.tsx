import { useState, useMemo, useEffect } from 'react';
import { Search, Settings, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { rightDrawerSheetContentClass } from '@/lib/rightPanelShell';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NotificationCard } from './NotificationCard';
import { EmpresasInactivasCard } from './EmpresasInactivasCard';
import { InactiveCompaniesPanel } from './InactiveCompaniesPanel';
import { useNotificationStore } from '@/store/notificationStore';
import { getInactiveCompanies } from '@/lib/inactiveCompanies';
import { contactListAll, mapApiContactRowToContact } from '@/lib/contactApi';
import type { Contact } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { Bell } from 'lucide-react';
import type { NotificationItem } from '@/types';
export type DrawerView = 'notifications' | 'inactive-companies';

interface NotificationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialView?: DrawerView;
}

type TabValue = 'no-leidas' | 'todas' | 'importantes';

function groupByDate(notifications: NotificationItem[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: { label: string; items: NotificationItem[] }[] = [
    { label: 'Hoy', items: [] },
    { label: 'Ayer', items: [] },
    { label: 'Esta semana', items: [] },
    { label: 'Anteriores', items: [] },
  ];

  for (const n of notifications) {
    const created = n.createdAt ? new Date(n.createdAt) : null;
    if (!created) {
      groups[3].items.push(n);
      continue;
    }
    const createdDate = new Date(created.getFullYear(), created.getMonth(), created.getDate());
    if (createdDate >= today) groups[0].items.push(n);
    else if (createdDate >= yesterday) groups[1].items.push(n);
    else if (created >= weekAgo) groups[2].items.push(n);
    else groups[3].items.push(n);
  }

  return groups.filter((g) => g.items.length > 0);
}

export function NotificationDrawer({
  open,
  onOpenChange,
  initialView = 'notifications',
}: NotificationDrawerProps) {
  const { notifications, refreshNotifications } = useNotificationStore();
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
  const [activeTab, setActiveTab] = useState<TabValue>('no-leidas');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [currentView, setCurrentView] = useState<DrawerView>(initialView);

  useEffect(() => {
    if (open) setCurrentView(initialView);
  }, [open, initialView]);

  useEffect(() => {
    if (open) void refreshNotifications();
  }, [open, refreshNotifications]);

  const inactiveCompaniesCount = getInactiveCompanies(contacts).length;
  const showEmpresasInactivas = activeTab === 'todas' || activeTab === 'importantes';

  const filtered = useMemo(() => {
    let result = notifications;

    if (activeTab === 'no-leidas') result = result.filter((n) => !n.read);
    else if (activeTab === 'importantes') result = result.filter((n) => n.important);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q),
      );
    }
    if (typeFilter !== 'all') {
      result = result.filter((n) => n.type === typeFilter);
    }
    if (priorityFilter !== 'all') {
      result = result.filter((n) => n.priority === priorityFilter);
    }

    return result;
  }, [notifications, activeTab, search, typeFilter, priorityFilter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const handleOpenInactiveCompanies = () => setCurrentView('inactive-companies');
  const handleBackFromInactive = () => setCurrentView('notifications');

  if (currentView === 'inactive-companies') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className={rightDrawerSheetContentClass('notifications')}
          showCloseButton={false}
        >
          <InactiveCompaniesPanel
            onBack={handleBackFromInactive}
            onClose={() => onOpenChange(false)}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={rightDrawerSheetContentClass('notifications')}
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2">
          <SheetHeader className="space-y-0">
            <SheetTitle className="text-lg font-semibold">
              Notificaciones
            </SheetTitle>
          </SheetHeader>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
              <Settings className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <div className="px-4 py-1.5">
            <TabsList className="h-9 w-full bg-muted/50 p-0.5">
              <TabsTrigger value="no-leidas" className="flex-1 text-sm">
                No leídas
              </TabsTrigger>
              <TabsTrigger value="todas" className="flex-1 text-sm">
                Todas
              </TabsTrigger>
              <TabsTrigger value="importantes" className="flex-1 text-sm">
                Importantes
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Filters */}
          <div className="space-y-2 px-4 py-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar notificaciones..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8"
              />
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 flex-1 text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="lead">Contacto</SelectItem>
                  <SelectItem value="sistema">Sistema</SelectItem>
                  <SelectItem value="exito">Éxito</SelectItem>
                  <SelectItem value="alerta">Alerta</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-9 flex-1 text-xs">
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Content - same for all tabs, filtered by activeTab */}
          {(['no-leidas', 'todas', 'importantes'] as const).map((tab) => (
            <TabsContent
              key={tab}
              value={tab}
              className="mt-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
            >
              <ScrollArea className="h-[calc(100vh-220px)]">
                <div className="space-y-6 p-4">
                  {showEmpresasInactivas && (
                    <div>
                      <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Resumen
                      </h4>
                      <EmpresasInactivasCard
                        count={inactiveCompaniesCount}
                        onClick={handleOpenInactiveCompanies}
                        variant="full"
                      />
                    </div>
                  )}
                  {filtered.length === 0 ? (
                    <EmptyState
                      icon={Bell}
                      title="No tienes notificaciones nuevas"
                      description="Cuando tengas notificaciones, aparecerán aquí."
                    />
                  ) : (
                    grouped.map((group) => (
                      <div key={group.label}>
                        <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {group.label}
                        </h4>
                        <div className="space-y-2">
                          {group.items.map((n) => (
                            <NotificationCard
                              key={n.id}
                              notification={n}
                              variant="full"
                              showActions
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
