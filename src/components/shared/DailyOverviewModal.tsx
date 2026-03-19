import { useNavigate } from 'react-router-dom';
import {
  Building2,
  CheckSquare,
  ChevronRight,
  X,
  CalendarDays,
  Bell,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCRMStore } from '@/store/crmStore';
import { useAppStore } from '@/store';
import { getInactiveCompanies, slugifyCompany } from '@/lib/inactiveCompanies';
import { activities, calendarEvents } from '@/data/mock';
import { activityTypeLabels } from '@/data/mock';
import { markDailyOverviewShown } from '@/lib/dailyOverview';
import { cn } from '@/lib/utils';
import type { Activity, CalendarEvent } from '@/types';

interface DailyOverviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dontShowAgainToday?: boolean;
  onDontShowAgainChange?: (checked: boolean) => void;
}

function getTodayTasks(
  currentUserId: string,
): { activity?: Activity; event?: CalendarEvent }[] {
  const today = format(new Date(), 'yyyy-MM-dd');
  const items: { activity?: Activity; event?: CalendarEvent }[] = [];

  for (const a of activities) {
    if (a.dueDate === today && a.assignedTo === currentUserId) {
      items.push({ activity: a });
    }
  }
  for (const e of calendarEvents) {
    if (e.date === today && e.assignedTo === currentUserId) {
      if (!items.some((i) => i.event?.id === e.id)) {
        items.push({ event: e });
      }
    }
  }

  return items.sort((a, b) => {
    const timeA = a.activity?.startTime ?? a.event?.startTime ?? '00:00';
    const timeB = b.activity?.startTime ?? b.event?.startTime ?? '00:00';
    return timeA.localeCompare(timeB);
  });
}

export function DailyOverviewModal({
  open,
  onOpenChange,
  dontShowAgainToday = false,
  onDontShowAgainChange,
}: DailyOverviewModalProps) {
  const navigate = useNavigate();
  const { contacts } = useCRMStore();
  const currentUser = useAppStore((s) => s.currentUser);
  const inactiveCompanies = getInactiveCompanies(contacts);
  const todayTasks = getTodayTasks(currentUser.id);

  const handleClose = () => {
    if (dontShowAgainToday) {
      markDailyOverviewShown();
    }
    onOpenChange(false);
  };

  const handleCompanyClick = (company: string) => {
    navigate(`/empresas/${slugifyCompany(company)}`);
    handleClose();
  };

  const handleTaskClick = (item: { activity?: Activity; event?: CalendarEvent }) => {
    if (item.activity?.contactId) {
      navigate(`/contactos/${item.activity.contactId}`);
    } else if (item.event?.relatedEntityType === 'contact' && item.event?.relatedEntityId) {
      navigate(`/contactos/${item.event.relatedEntityId}`);
    } else {
      navigate('/tareas');
    }
    handleClose();
  };

  const handleVerEmpresas = () => {
    navigate('/empresas');
    handleClose();
  };

  const handleVerTareas = () => {
    navigate('/tareas');
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl p-0"
        onPointerDownOutside={handleClose}
        onEscapeKeyDown={handleClose}
      >
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-full bg-[#13944C]/10 text-[#13944C]">
                <CalendarDays className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  Resumen del día
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleClose}
              className="text-muted-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          {/* Empresas inactivas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-medium">
                <Building2 className="size-4 text-amber-600" />
                Empresas inactivas
              </h3>
              {inactiveCompanies.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#13944C]"
                  onClick={handleVerEmpresas}
                >
                  Ver todas
                  <ChevronRight className="size-3" />
                </Button>
              )}
            </div>
            <div className="rounded-lg border bg-muted/30">
              <ScrollArea className="h-[180px]">
                <div className="p-2">
                  {inactiveCompanies.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No hay empresas inactivas
                    </p>
                  ) : (
                    inactiveCompanies.map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => handleCompanyClick(emp.company)}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                          <Building2 className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {emp.company}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {emp.assignedToName}
                          </p>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Tareas de hoy */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-medium">
                <CheckSquare className="size-4 text-[#13944C]" />
                Tareas de hoy
              </h3>
              {todayTasks.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#13944C]"
                  onClick={handleVerTareas}
                >
                  Ver todas
                  <ChevronRight className="size-3" />
                </Button>
              )}
            </div>
            <div className="rounded-lg border bg-muted/30">
              <ScrollArea className="h-[180px]">
                <div className="p-2">
                  {todayTasks.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No tienes tareas para hoy
                    </p>
                  ) : (
                    todayTasks.map((item, idx) => {
                      const title =
                        item.activity?.title ?? item.event?.title ?? '';
                      const type =
                        item.activity?.type ?? item.event?.type ?? 'tarea';
                      const time =
                        item.activity?.startTime ?? item.event?.startTime ?? '';
                      const status = item.activity?.status ?? item.event?.status;
                      return (
                        <button
                          key={item.activity?.id ?? item.event?.id ?? idx}
                          type="button"
                          onClick={() => handleTaskClick(item)}
                          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted"
                        >
                          <div
                            className={cn(
                              'flex size-8 shrink-0 items-center justify-center rounded-full',
                              status === 'vencida'
                                ? 'bg-red-100 text-red-600'
                                : 'bg-emerald-100 text-emerald-600',
                            )}
                          >
                            <CheckSquare className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {time && `${time} · `}
                              {activityTypeLabels[type] ?? type}
                            </p>
                          </div>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={dontShowAgainToday}
              onCheckedChange={(v) => onDontShowAgainChange?.(!!v)}
            />
            No mostrar de nuevo hoy
          </label>
          <Button onClick={handleClose} className="bg-[#13944C] hover:bg-[#0f7a3d]">
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
