import { useNavigate } from 'react-router-dom';
import { companyDetailPath } from '@/lib/detailRoutes';
import { useState, useEffect, useMemo, type ComponentType } from 'react';
import {
  AlertTriangle,
  X,
  Sparkles,
} from 'lucide-react';
import { Buildings2SvgIcon } from '@/components/icons/Buildings2SvgIcon';
import { DocumentAddSvgIcon } from '@/components/icons/DocumentAddSvgIcon';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { companySinCambioEtapaAlert } from '@/lib/companyApi';
import {
  markDailyBriefingCloseLockUsed,
  markDailyBriefingShown,
  shouldApplyDailyBriefingCloseLock,
} from '@/lib/dailyOverview';
import { formatTodayPeruYmd } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { rightDrawerDialogContentClass } from '@/lib/rightPanelShell';
import {
  ACTIVITY_ICON_INHERIT,
  activityTypeIconCircleClass,
} from '@/lib/activityTypeCircleStyles';
import { activityTypeSvgIcon } from '@/lib/activityTypeSvgIcons';
import type { Activity } from '@/types';
import { TASK_KINDS } from '@/types';
import { taskAssociationsFromActivity } from '@/lib/taskAssociationsFromActivity';
import { effectiveTaskStatus, isTaskOverdue, taskDaysUntilDue } from '@/lib/taskStatus';
import { InactiveCompaniesPanel } from '@/components/notifications/InactiveCompaniesPanel';
import type { CompanySinCambioEtapaAlertItem } from '@/lib/companyApi';
import { useActivities } from '@/hooks/useActivities';
import { useMultiAdvisorFilter } from '@/hooks/useMultiAdvisorFilter';

/** Segundos sin poder cerrar al abrir (click fuera, Escape o X). */
const BRIEFING_CLOSE_LOCK_SECONDS = 5;

function isBriefingTask(a: Activity): boolean {
  return (
    a.type === 'tarea' &&
    !!a.taskKind &&
    TASK_KINDS.includes(a.taskKind)
  );
}

function briefingTaskSubtitle(task: Activity): string {
  const assocs = taskAssociationsFromActivity(task);
  return assocs.map((x) => x.name).join(' · ');
}

function briefingTaskIconType(task: Activity): string {
  if (task.type === 'tarea' && task.taskKind) return task.taskKind;
  return task.type;
}

function briefingTaskMetaLine(
  task: Activity,
  showAssignee: boolean,
): string {
  const parts: string[] = [];
  if (showAssignee && task.assignedToName?.trim()) {
    parts.push(task.assignedToName.trim());
  }
  const associations = briefingTaskSubtitle(task);
  if (associations) parts.push(associations);
  if (task.startTime?.trim()) parts.push(task.startTime.trim());
  return parts.join(' · ');
}

interface DailyBriefingPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dontShowAgainToday?: boolean;
  onDontShowAgainChange?: (checked: boolean) => void;
}

function getStatusBadgeClass(status: string): string {
  if (status === 'vencida') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
  if (status === 'en_progreso') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
}

type BriefingKpiTone = 'primary' | 'violet' | 'red';

const BRIEFING_KPI_TONE = {
  primary: {
    activeCard:
      'border-primary/35 bg-primary/10 shadow-sm shadow-primary/10 dark:border-primary/40 dark:bg-primary/15',
    accent: 'text-primary',
  },
  violet: {
    activeCard:
      'border-violet-300/50 bg-violet-50/80 shadow-sm shadow-violet-500/10 dark:border-violet-800/50 dark:bg-violet-950/30',
    accent: 'text-violet-600 dark:text-violet-400',
  },
  red: {
    activeCard:
      'border-red-300/50 bg-red-50/80 shadow-sm shadow-red-500/10 dark:border-red-900/50 dark:bg-red-950/30',
    accent: 'text-red-600 dark:text-red-400',
  },
} as const;

function briefingKpiCardClass(active: boolean, tone: BriefingKpiTone): string {
  if (!active) return 'border-border bg-muted/20';
  return BRIEFING_KPI_TONE[tone].activeCard;
}

function BriefingKpiCard({
  active,
  tone,
  onClick,
  icon: Icon,
  value,
  label,
}: {
  active: boolean;
  tone: BriefingKpiTone;
  onClick?: () => void;
  icon: ComponentType<{ className?: string }>;
  value: number;
  label: string;
}) {
  const accent = BRIEFING_KPI_TONE[tone].accent;
  const className = cn(
    'flex w-full flex-col items-center justify-center rounded-xl border px-2.5 py-3.5 transition-colors',
    briefingKpiCardClass(active, tone),
    active && onClick && 'cursor-pointer hover:brightness-[0.98] dark:hover:brightness-110',
  );

  const content = (
    <>
      <div className="flex items-center gap-1.5">
        <Icon className={cn('size-4 shrink-0', accent)} aria-hidden />
        <span className={cn('text-2xl font-bold tabular-nums', accent)}>{value}</span>
      </div>
      <span className="mt-1 text-center text-[10px] font-medium leading-tight text-muted-foreground">
        {label}
      </span>
    </>
  );

  if (active && onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

export function DailyBriefingPanel({
  open,
  onOpenChange,
  dontShowAgainToday = false,
  onDontShowAgainChange,
}: DailyBriefingPanelProps) {
  const navigate = useNavigate();
  const { activities, loading: activitiesLoading } = useActivities();
  const { canSeeAllAdvisors, matchesAssignee } = useMultiAdvisorFilter();
  const [sinCambioEtapaCount, setSinCambioEtapaCount] = useState(0);
  const [briefingView, setBriefingView] = useState<'summary' | 'companies'>('summary');
  const [closeLockRemaining, setCloseLockRemaining] = useState(0);
  const canDismiss = closeLockRemaining === 0;

  const todayYmd = formatTodayPeruYmd();

  const scopedTasks = useMemo(
    () =>
      activities.filter(
        (a) => isBriefingTask(a) && matchesAssignee(a.assignedTo),
      ),
    [activities, matchesAssignee],
  );

  const todayTasks = useMemo(
    () =>
      scopedTasks
        .filter(
          (task) =>
            task.status !== 'completada' &&
            (task.dueDate === todayYmd || taskDaysUntilDue(task.dueDate) === 0),
        )
        .sort((a, b) =>
          (a.startTime ?? '00:00').localeCompare(b.startTime ?? '00:00'),
        ),
    [scopedTasks, todayYmd],
  );

  const pendingTodayCount = useMemo(
    () =>
      todayTasks.filter((task) => {
        const status = effectiveTaskStatus(task);
        return status === 'pendiente' || status === 'en_progreso';
      }).length,
    [todayTasks],
  );

  const overdueTaskCount = useMemo(
    () =>
      scopedTasks.filter(
        (task) =>
          task.status !== 'completada' && isTaskOverdue(task),
      ).length,
    [scopedTasks],
  );

  useEffect(() => {
    if (!open) {
      setCloseLockRemaining(0);
      setBriefingView('summary');
      return;
    }

    const applyCloseLock = shouldApplyDailyBriefingCloseLock();
    if (!applyCloseLock) {
      setCloseLockRemaining(0);
      return;
    }

    markDailyBriefingCloseLockUsed();
    setCloseLockRemaining(BRIEFING_CLOSE_LOCK_SECONDS);
    const interval = window.setInterval(() => {
      setCloseLockRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let c = true;
    void companySinCambioEtapaAlert()
      .then((res) => {
        if (c) setSinCambioEtapaCount(res.count);
      })
      .catch(() => {
        if (c) setSinCambioEtapaCount(0);
      });
    return () => {
      c = false;
    };
  }, [open]);

  const todayLabel = format(new Date(), "EEEE, d 'de' MMMM", { locale: es }).replace(/^\w/, (c) => c.toUpperCase());

  const handleClose = () => {
    if (dontShowAgainToday) markDailyBriefingShown();
    onOpenChange(false);
  };

  const tryDismiss = () => {
    if (!canDismiss) return;
    handleClose();
  };

  const handleDismissPointerDownOutside = (event: Event) => {
    if (!canDismiss) event.preventDefault();
  };

  const handleDismissEscapeKeyDown = (event: KeyboardEvent) => {
    if (!canDismiss) {
      event.preventDefault();
      return;
    }
    handleClose();
  };

  const openCompaniesDetail = () => {
    setBriefingView('companies');
  };

  const handleVerTareas = () => {
    navigate('/tareas');
    handleClose();
  };

  const handleBriefingCompanyClick = (row: CompanySinCambioEtapaAlertItem) => {
    navigate(companyDetailPath({ urlSlug: row.urlSlug, name: row.name }));
    handleClose();
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) tryDismiss();
        else onOpenChange(next);
      }}
      modal
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
          data-slot="sheet-overlay"
        />
        <DialogPrimitive.Content
          className={rightDrawerDialogContentClass(
            'briefing',
            'z-[51] overflow-hidden rounded-l-2xl ring-1 ring-black/5 dark:ring-white/10',
          )}
          onEscapeKeyDown={handleDismissEscapeKeyDown}
          onPointerDownOutside={handleDismissPointerDownOutside}
        >
          {briefingView === 'companies' ? (
            <InactiveCompaniesPanel
              onBack={() => setBriefingView('summary')}
              onClose={canDismiss ? tryDismiss : undefined}
              onCompanyClick={handleBriefingCompanyClick}
            />
          ) : (
            <>
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-border/50 bg-background/80 px-5 py-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 dark:bg-background/60">
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
                <h2 className="text-lg font-semibold text-foreground">Resumen de hoy</h2>
              </div>
              <p className="text-xs text-muted-foreground">{todayLabel}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={tryDismiss}
              disabled={!canDismiss}
              className={cn(
                'shrink-0 text-muted-foreground hover:text-foreground',
                !canDismiss && 'opacity-70',
              )}
              aria-label={
                canDismiss
                  ? 'Cerrar'
                  : `Cerrar disponible en ${closeLockRemaining} segundos`
              }
            >
              {canDismiss ? (
                <X className="size-5" strokeWidth={1.75} />
              ) : (
                <span className="text-sm font-semibold tabular-nums">{closeLockRemaining}</span>
              )}
            </Button>
          </div>

          {/* Scrollable Content */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-6 p-5">
              {/* KPI Summary */}
              <div className="grid grid-cols-3 gap-2.5">
                <BriefingKpiCard
                  active={sinCambioEtapaCount > 0}
                  tone="primary"
                  onClick={sinCambioEtapaCount > 0 ? openCompaniesDetail : undefined}
                  icon={Buildings2SvgIcon}
                  value={sinCambioEtapaCount}
                  label="Sin cambio de etapa (11+ sem.)"
                />
                <BriefingKpiCard
                  active={pendingTodayCount > 0}
                  tone="violet"
                  onClick={pendingTodayCount > 0 ? handleVerTareas : undefined}
                  icon={DocumentAddSvgIcon}
                  value={pendingTodayCount}
                  label="Tareas vencen hoy"
                />
                <BriefingKpiCard
                  active={overdueTaskCount > 0}
                  tone="red"
                  onClick={overdueTaskCount > 0 ? handleVerTareas : undefined}
                  icon={AlertTriangle}
                  value={overdueTaskCount}
                  label="Tareas vencidas"
                />
              </div>

              {/* Tareas de hoy */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Tareas que vencen hoy</h3>
                {activitiesLoading ? (
                  <p className="py-3 text-center text-sm text-muted-foreground">
                    Cargando tareas…
                  </p>
                ) : todayTasks.length === 0 ? (
                  <p className="py-3 text-center text-sm text-muted-foreground">
                    {canSeeAllAdvisors
                      ? 'No hay tareas que venzan hoy'
                      : 'No tienes tareas que venzan hoy'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {todayTasks.map((task) => {
                      const iconType = briefingTaskIconType(task);
                      const TaskIcon = activityTypeSvgIcon(iconType);
                      const status = effectiveTaskStatus(task);
                      const metaLine = briefingTaskMetaLine(task, canSeeAllAdvisors);
                      const overdue = isTaskOverdue(task);

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            'flex w-full gap-3 rounded-xl border px-3 py-2.5',
                            overdue
                              ? 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20'
                              : 'border-border bg-card',
                          )}
                        >
                          <div
                            className={cn(
                              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                              ACTIVITY_ICON_INHERIT,
                              activityTypeIconCircleClass(iconType) ??
                                'bg-muted text-muted-foreground',
                            )}
                          >
                            <TaskIcon className="size-3.5" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-sm font-medium">{task.title}</p>
                              <span
                                className={cn(
                                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                                  getStatusBadgeClass(status),
                                )}
                              >
                                {status === 'vencida' ? 'Vencida' : status === 'en_progreso' ? 'En progreso' : 'Pendiente'}
                              </span>
                            </div>
                            {metaLine ? (
                              <p className="mt-1 min-w-0 break-words text-xs text-muted-foreground">
                                {metaLine}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="sticky bottom-0 shrink-0 border-t border-border/50 bg-background/70 px-5 py-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 dark:bg-background/50">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={dontShowAgainToday}
                onCheckedChange={(v) => onDontShowAgainChange?.(!!v)}
              />
              No mostrar este resumen hoy
            </label>
          </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
