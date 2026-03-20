import { useNavigate } from 'react-router-dom';
import {
  Building2,
  CheckSquare,
  AlertTriangle,
  X,
  Settings,
  ListTodo,
  LayoutDashboard,
} from 'lucide-react';
import { format } from 'date-fns';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCRMStore } from '@/store/crmStore';
import { useAppStore } from '@/store';
import { getInactiveCompanies } from '@/lib/inactiveCompanies';
import { markDailyBriefingShown } from '@/lib/dailyOverview';
import { activities, calendarEvents, activityTypeLabels } from '@/data/mock';
import { cn } from '@/lib/utils';
import type { Activity, CalendarEvent } from '@/types';


interface DailyBriefingPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dontShowAgainToday?: boolean;
  onDontShowAgainChange?: (checked: boolean) => void;
}

type TaskItem = { activity?: Activity; event?: CalendarEvent };

function getTodayTasks(currentUserId: string): TaskItem[] {
  const today = format(new Date(), 'yyyy-MM-dd');
  const items: TaskItem[] = [];

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

function isOverdue(item: TaskItem): boolean {
  return (item.activity?.status ?? item.event?.status) === 'vencida';
}

function getStatusBadgeClass(status: string): string {
  if (status === 'vencida') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
  if (status === 'en_progreso') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
}

export function DailyBriefingPanel({
  open,
  onOpenChange,
  dontShowAgainToday = false,
  onDontShowAgainChange,
}: DailyBriefingPanelProps) {
  const navigate = useNavigate();
  const { contacts } = useCRMStore();
  const currentUser = useAppStore((s) => s.currentUser);
  const inactiveCompanies = getInactiveCompanies(contacts);
  const todayTasks = getTodayTasks(currentUser.id);
  const pendingTasks = todayTasks.filter((i) => {
    const s = i.activity?.status ?? i.event?.status;
    return s === 'pendiente' || s === 'en_progreso';
  });
  const overdueTasks = todayTasks.filter((i) => isOverdue(i));

  const handleClose = () => {
    if (dontShowAgainToday) markDailyBriefingShown();
    onOpenChange(false);
  };

  const handleVerTareas = () => {
    navigate('/tareas');
    handleClose();
  };

  const handleVerEmpresas = () => {
    navigate('/empresas');
    handleClose();
  };

  const handleIrPipeline = () => {
    navigate('/pipeline');
    handleClose();
  };

  const handleTaskClick = (item: TaskItem) => {
    if (item.activity?.contactId) {
      navigate(`/contactos/${item.activity.contactId}`);
    } else if (item.event?.relatedEntityType === 'contact' && item.event?.relatedEntityId) {
      navigate(`/contactos/${item.event.relatedEntityId}`);
    } else {
      navigate('/tareas');
    }
    handleClose();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
          data-slot="sheet-overlay"
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l bg-background shadow-xl',
            'w-full sm:w-[380px] sm:max-w-[380px]',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=closed]:duration-300',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-500',
            'rounded-l-2xl'
          )}
          onEscapeKeyDown={handleClose}
          onPointerDownOutside={handleClose}
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b bg-background px-5 py-4">
            <h2 className="text-xl font-semibold text-foreground">Resumen de hoy</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Configuración"
              >
                <Settings className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Scrollable Content */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-6 p-5">
              {/* KPI Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/30 px-3 py-4 shadow-sm transition-colors hover:bg-muted/50">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="size-4 text-primary" />
                    <span className="text-2xl font-bold text-primary">
                      {inactiveCompanies.length}
                    </span>
                  </div>
                  <span className="mt-1 text-center text-[11px] font-medium text-muted-foreground">
                    Empresas sin actividad
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/30 px-3 py-4 shadow-sm transition-colors hover:bg-muted/50">
                  <div className="flex items-center gap-1.5">
                    <CheckSquare className="size-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {pendingTasks.length}
                    </span>
                  </div>
                  <span className="mt-1 text-center text-[11px] font-medium text-muted-foreground">
                    Tareas hoy
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/30 px-3 py-4 shadow-sm transition-colors hover:bg-muted/50">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
                    <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {overdueTasks.length}
                    </span>
                  </div>
                  <span className="mt-1 text-center text-[11px] font-medium text-muted-foreground">
                    Vencidas
                  </span>
                </div>
              </div>

              {/* Tareas de hoy */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Tareas de hoy</h3>
                <div className="rounded-xl border bg-card shadow-sm">
                  <ScrollArea className="h-[160px]">
                    <div className="p-3 pr-4">
                      {todayTasks.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          No tienes tareas para hoy
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {todayTasks.map((item, idx) => {
                            const title = item.activity?.title ?? item.event?.title ?? '';
                            const time = item.activity?.startTime ?? item.event?.startTime ?? '';
                            const type = item.activity?.type ?? item.event?.type ?? 'tarea';
                            const status = item.activity?.status ?? item.event?.status ?? 'pendiente';
                            const companyContact =
                              item.activity?.contactName ?? item.event?.relatedEntityName ?? '';
                            const overdue = isOverdue(item);

                            return (
                              <button
                                key={item.activity?.id ?? item.event?.id ?? idx}
                                type="button"
                                onClick={() => handleTaskClick(item)}
                                className={cn(
                                  'flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted',
                                  overdue && 'border-l-2 border-l-red-500 bg-red-50/50 dark:bg-red-950/20'
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="truncate text-sm font-medium">{title}</p>
                                  <span
                                    className={cn(
                                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                                      getStatusBadgeClass(status)
                                    )}
                                  >
                                    {status === 'vencida' ? 'Vencida' : status === 'en_progreso' ? 'En progreso' : 'Pendiente'}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {companyContact && `${companyContact} · `}
                                  {time && `${time} · `}
                                  {activityTypeLabels[type] ?? type}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              {/* Alertas */}
              {(overdueTasks.length > 0 || inactiveCompanies.length > 0) && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-foreground">Alertas</h3>
                  <div className="space-y-2">
                    {overdueTasks.length > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/20">
                        <AlertTriangle className="size-4 shrink-0 text-red-600 dark:text-red-400" />
                        <span className="text-sm">
                          {overdueTasks.length} tarea{overdueTasks.length > 1 ? 's' : ''} vencida
                          {overdueTasks.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    {inactiveCompanies.length > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/20">
                        <Building2 className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span className="text-sm">
                          {inactiveCompanies.length} empresa{inactiveCompanies.length > 1 ? 's' : ''}{' '}
                          sin actividad
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Acciones rápidas</h3>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleVerTareas}
                    className="w-full justify-start gap-2 bg-primary hover:bg-primary/90"
                  >
                    <ListTodo className="size-4" />
                    Ver tareas
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleVerEmpresas}
                    className="w-full justify-start gap-2"
                  >
                    <Building2 className="size-4" />
                    Ver empresas
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleIrPipeline}
                    className="w-full justify-start gap-2"
                  >
                    <LayoutDashboard className="size-4" />
                    Ir al pipeline
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Sticky Footer */}
          <div className="sticky bottom-0 shrink-0 border-t bg-background px-5 py-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={dontShowAgainToday}
                onCheckedChange={(v) => onDontShowAgainChange?.(!!v)}
              />
              No mostrar este resumen hoy
            </label>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
