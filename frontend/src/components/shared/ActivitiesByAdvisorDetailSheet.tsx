import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import {
  fetchActivitiesByAdvisorDetails,
  fetchTasksByAdvisorDetails,
  type ActivitiesByAdvisorDetailRow,
  type ActivitiesByAdvisorDetailsPage,
  type ActivitiesByAdvisorDetailsQuery,
} from '@/lib/analyticsApi';
import {
  companyDetailHref,
  contactDetailHref,
  opportunityDetailHref,
} from '@/lib/detailRoutes';
import {
  ACTIVITY_ICON_INHERIT,
  activityTypeIconCircleClass,
} from '@/lib/activityTypeCircleStyles';
import {
  activityTypeSvgIcon,
  TASK_META_ICON_CLASS,
  TaskEntityMetaIcons,
  type SvgIconComponent,
} from '@/lib/activityTypeSvgIcons';
import { rightDrawerSheetContentClass } from '@/lib/rightPanelShell';
import { Pagination } from '@/components/shared/Pagination';
import { ActivityDetailDialog } from '@/components/shared/ActivityDetailDialog';
import {
  TaskDetailDialog,
  type TaskComment,
  type TaskDetailTask,
} from '@/components/shared/TaskDetailDialog';
import {
  deleteActivity,
  fetchActivityById,
  updateActivity,
  type UpdateActivityPayload,
} from '@/lib/activityApi';
import { activityToTaskDetail } from '@/lib/activityToTaskDetail';
import { buildTaskDetailUpdatePayload } from '@/lib/taskActivityUpdate';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/lib/notify';
import type { Activity } from '@/types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ActivityGoalTargets } from '@/lib/crmConfigApi';
import { activityGoalTotalForPeriod } from '@/lib/crmConfigApi';

const PAGE_SIZE = 25;

type DetailTypeFilter = 'all' | 'llamada' | 'reunion' | 'correo';
type DetailCallOutcomeFilter = 'all' | 'contacto' | 'no_contacto';

const DETAIL_TYPE_FILTERS: {
  value: DetailTypeFilter;
  label: string;
  icon?: SvgIconComponent;
}[] = [
  { value: 'all', label: 'Todos' },
  { value: 'llamada', label: 'Llamada', icon: activityTypeSvgIcon('llamada') },
  { value: 'reunion', label: 'Reunión', icon: activityTypeSvgIcon('reunion') },
  { value: 'correo', label: 'Correo', icon: activityTypeSvgIcon('correo') },
];

const DETAIL_CALL_OUTCOME_FILTERS: { value: DetailCallOutcomeFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'contacto', label: 'Contacto' },
  { value: 'no_contacto', label: 'No contacto' },
];

export type AdvisorWeeklyDetailSheetKind = 'activities' | 'tasks';

export type ActivityGoalPeriod = 'week' | 'day';

function goalPeriodLabel(period: ActivityGoalPeriod): string {
  return period === 'day' ? 'Meta diaria' : 'Meta semanal';
}

function periodSubtitlePrefix(period: ActivityGoalPeriod, label: string): string {
  if (!label) return '';
  return period === 'day' ? label : `Semana ${label}`;
}
const SHEET_COPY: Record<
  AdvisorWeeklyDetailSheetKind,
  {
    defaultTitle: string;
    subtitle: string;
    loading: string;
    loadError: string;
    emptyWeek: string;
    emptyDay: string;
  }
> = {
  activities: {
    defaultTitle: 'Actividades',
    subtitle: 'interacciones completadas',
    loading: 'Cargando actividades…',
    loadError: 'No se pudo cargar el detalle de actividades.',
    emptyWeek: 'Sin actividades en esta semana.',
    emptyDay: 'Sin actividades en este día.',
  },
  tasks: {
    defaultTitle: 'Tareas',
    subtitle: 'tareas completadas',
    loading: 'Cargando tareas…',
    loadError: 'No se pudo cargar el detalle de tareas.',
    emptyWeek: 'Sin tareas en esta semana.',
    emptyDay: 'Sin tareas en este día.',
  },
};

const TASK_STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  en_progreso: 'En progreso',
  vencida: 'Vencida',
};

const TASK_STATUS_COLORS: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  completada: 'bg-emerald-100 text-emerald-700',
  en_progreso: 'bg-blue-100 text-blue-700',
  vencida: 'bg-red-100 text-red-700',
};

function formatCompletedAt(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ActivitiesByAdvisorDetailSheetProps {
  kind?: AdvisorWeeklyDetailSheetKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advisorId: string | null;
  advisorName: string | null;
  weekLabel: string | null;
  weekStart: string | null;
  weekEnd: string | null;
  detailQuery: Omit<
    ActivitiesByAdvisorDetailsQuery,
    'advisorId' | 'weekStart' | 'weekEnd' | 'page' | 'limit'
  >;
  actualCounts?: ActivityGoalTargets | null;
  goalTargets?: ActivityGoalTargets | null;
  /** week = reportes; day = dashboard operativo. */
  goalPeriod?: ActivityGoalPeriod;
}

export function ActivitiesByAdvisorDetailSheet({
  kind = 'activities',
  open,
  onOpenChange,
  advisorId,
  advisorName,
  weekLabel,
  weekStart,
  weekEnd,
  detailQuery,
  actualCounts,
  goalTargets,
  goalPeriod = 'week',
}: ActivitiesByAdvisorDetailSheetProps) {
  const copy = SHEET_COPY[kind];
  const { hasPermission } = usePermissions();
  const canEditActivity = hasPermission('actividades.editar');
  const canDeleteActivity = hasPermission('actividades.eliminar');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<DetailTypeFilter>('all');
  const [callOutcomeFilter, setCallOutcomeFilter] = useState<DetailCallOutcomeFilter>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ActivitiesByAdvisorDetailsPage | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailActivity, setDetailActivity] = useState<Activity | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);

  const hasActiveFilters = typeFilter !== 'all' || callOutcomeFilter !== 'all';
  const displayWeek = weekLabel ?? result?.weekLabel;
  const periodLabel = periodSubtitlePrefix(goalPeriod, displayWeek ?? '');
  const emptyCopy = goalPeriod === 'day' ? copy.emptyDay : copy.emptyWeek;

  const loadPage = useCallback(
    async (nextPage: number) => {
      if (!advisorId || !weekStart || !weekEnd) return;
      setLoading(true);
      setError(null);
      try {
        const fetchDetails =
          kind === 'tasks' ? fetchTasksByAdvisorDetails : fetchActivitiesByAdvisorDetails;
        const data = await fetchDetails({
          ...detailQuery,
          advisorId,
          weekStart,
          weekEnd,
          page: nextPage,
          limit: PAGE_SIZE,
          activityType: typeFilter !== 'all' ? typeFilter : undefined,
          callOutcome:
            typeFilter === 'llamada' && callOutcomeFilter !== 'all'
              ? callOutcomeFilter
              : undefined,
        });
        setResult(data);
        setPage(data.page);
      } catch (err) {
        const message =
          err instanceof Error && err.message.trim() ? err.message : copy.loadError;
        setError(message);
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [advisorId, callOutcomeFilter, copy.loadError, detailQuery, kind, typeFilter, weekEnd, weekStart],
  );

  useEffect(() => {
    if (!open || !advisorId || !weekStart || !weekEnd) return;
    void loadPage(1);
  }, [open, advisorId, weekStart, weekEnd, typeFilter, callOutcomeFilter, loadPage]);

  useEffect(() => {
    if (!open) {
      setPage(1);
      setTypeFilter('all');
      setCallOutcomeFilter('all');
      setResult(null);
      setError(null);
      setDetailOpen(false);
      setDetailActivity(null);
      setDetailLoadingId(null);
      setTaskComments([]);
    }
  }, [open]);

  const handleUpdateActivity = useCallback(
    async (id: string, payload: UpdateActivityPayload) => {
      const updated = await updateActivity(id, payload);
      setDetailActivity((prev) => (prev?.id === updated.id ? updated : prev));
      await loadPage(page);
      return updated;
    },
    [loadPage, page],
  );

  const handleDeleteActivity = useCallback(
    async (id: string) => {
      await deleteActivity(id);
      setDetailOpen(false);
      setDetailActivity(null);
      await loadPage(page);
    },
    [loadPage, page],
  );

  const handleTasksChange = useCallback(
    async (taskDetails: TaskDetailTask[]) => {
      if (!detailActivity) return;
      const stillPresent = taskDetails.some((t) => t.id === detailActivity.id);
      if (!stillPresent) {
        if (!canDeleteActivity) {
          toast.error('No tienes permiso para eliminar tareas');
          throw new Error('forbidden');
        }
        await deleteActivity(detailActivity.id);
        setDetailOpen(false);
        setDetailActivity(null);
        await loadPage(page);
        return;
      }

      const nextDetail = taskDetails.find((t) => t.id === detailActivity.id);
      if (!nextDetail) return;

      if (!canEditActivity) {
        toast.error('No tienes permiso para editar tareas');
        throw new Error('forbidden');
      }

      const oldDetail = activityToTaskDetail(detailActivity);
      const payload = buildTaskDetailUpdatePayload(oldDetail, nextDetail, {
        previousAssigneeId: detailActivity.assignedTo,
      });
      if (Object.keys(payload).length === 0) return;

      const updated = await updateActivity(detailActivity.id, payload);
      setDetailActivity(updated);
      await loadPage(page);
    },
    [canDeleteActivity, canEditActivity, detailActivity, loadPage, page],
  );

  async function openRecordDetail(rowId: string) {
    if (detailLoadingId) return;
    setDetailLoadingId(rowId);
    try {
      const activity = await fetchActivityById(rowId);
      setDetailActivity(activity);
      setDetailOpen(true);
    } catch {
      toast.error(
        kind === 'tasks'
          ? 'No se pudo cargar el detalle de la tarea'
          : 'No se pudo cargar el detalle de la actividad',
      );
    } finally {
      setDetailLoadingId(null);
    }
  }

  function handleTypeFilterChange(value: DetailTypeFilter) {
    setTypeFilter(value);
    if (value !== 'llamada') setCallOutcomeFilter('all');
  }

  function clearFilters() {
    setTypeFilter('all');
    setCallOutcomeFilter('all');
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={rightDrawerSheetContentClass('notifications')}
      >
        <SheetHeader className="shrink-0 space-y-3 border-b border-border/50 px-5 py-4 text-left">
          <div className="flex flex-wrap items-start justify-between gap-2 pr-6">
            <div className="min-w-0 space-y-1">
              <SheetTitle className="text-lg font-semibold leading-tight">
                {advisorName ?? result?.advisorName ?? copy.defaultTitle}
              </SheetTitle>
              <SheetDescription className="text-sm">
                {periodLabel
                  ? `${periodLabel} · ${copy.subtitle}`
                  : copy.subtitle}
              </SheetDescription>
            </div>
            {result && !loading ? (
              <Badge
                variant="secondary"
                className="shrink-0 rounded-full border border-border/60 bg-background/80 px-2.5 py-0.5 text-[11px] font-medium tabular-nums"
              >
                {result.total} {result.total === 1 ? 'registro' : 'registros'}
              </Badge>
            ) : null}
          </div>
        </SheetHeader>

        <AdvisorDetailFilters
          typeFilter={typeFilter}
          callOutcomeFilter={callOutcomeFilter}
          hasActiveFilters={hasActiveFilters}
          onTypeChange={handleTypeFilterChange}
          onCallOutcomeChange={setCallOutcomeFilter}
          onClear={clearFilters}
        />

        {kind === 'activities' && goalTargets && hasAnyGoalTarget(goalTargets, goalPeriod) ? (
          <ActivityGoalSummary
            actual={actualCounts ?? EMPTY_GOAL_TARGETS}
            target={goalTargets}
            goalPeriod={goalPeriod}
          />
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary/70" />
              {copy.loading}
            </div>
          ) : error ? (
            <p className="px-2 py-16 text-center text-sm text-muted-foreground">{error}</p>
          ) : result && result.data.length > 0 ? (
            <ul className="space-y-3">
              {result.data.map((row) => (
                <ActivityDetailItem
                  key={row.id}
                  row={row}
                  loading={detailLoadingId === row.id}
                  onOpen={() => void openRecordDetail(row.id)}
                />
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center px-4 py-16 text-center">
              <p className="text-sm font-medium text-foreground">
                {hasActiveFilters ? 'Nada coincide con los filtros' : 'Sin registros'}
              </p>
              <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">
                {hasActiveFilters
                  ? 'Prueba otro tipo o limpia los filtros para ver todo el listado.'
                  : emptyCopy}
              </p>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 h-8"
                  onClick={clearFilters}
                >
                  Limpiar filtros
                </Button>
              ) : null}
            </div>
          )}
        </div>

        {result && result.total > 0 ? (
          <div className="shrink-0 border-t border-border/50 bg-background/40 px-3 py-2 backdrop-blur-sm">
            <Pagination
              page={page}
              totalPages={Math.max(1, result.totalPages)}
              totalItems={result.total}
              pageSize={result.limit}
              onPageChange={(next) => void loadPage(next)}
            />
          </div>
        ) : null}
      </SheetContent>

      {kind === 'tasks' ? (
        <TaskDetailDialog
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open);
            if (!open) setDetailActivity(null);
          }}
          task={detailActivity ? activityToTaskDetail(detailActivity) : null}
          statusLabels={TASK_STATUS_LABELS}
          statusColors={TASK_STATUS_COLORS}
          tasks={detailActivity ? [activityToTaskDetail(detailActivity)] : []}
          onTasksChange={canEditActivity || canDeleteActivity ? handleTasksChange : async () => {}}
          taskComments={taskComments}
          onTaskCommentsChange={setTaskComments}
        />
      ) : (
        <ActivityDetailDialog
          activity={detailActivity}
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open);
            if (!open) setDetailActivity(null);
          }}
          onUpdateActivity={canEditActivity ? handleUpdateActivity : undefined}
          onDeleteActivity={canDeleteActivity ? handleDeleteActivity : undefined}
        />
      )}
    </Sheet>
  );
}

function AdvisorDetailFilters({
  typeFilter,
  callOutcomeFilter,
  hasActiveFilters,
  onTypeChange,
  onCallOutcomeChange,
  onClear,
}: {
  typeFilter: DetailTypeFilter;
  callOutcomeFilter: DetailCallOutcomeFilter;
  hasActiveFilters: boolean;
  onTypeChange: (value: DetailTypeFilter) => void;
  onCallOutcomeChange: (value: DetailCallOutcomeFilter) => void;
  onClear: () => void;
}) {
  return (
    <div className="shrink-0 space-y-3 border-b border-border/50 bg-background/30 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Filtrar
        </p>
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={onClear}
          >
            <X className="size-3" aria-hidden />
            Limpiar
          </Button>
        ) : null}
      </div>

      <FilterChipRow>
        {DETAIL_TYPE_FILTERS.map((option) => (
          <FilterChip
            key={option.value}
            active={typeFilter === option.value}
            onClick={() => onTypeChange(option.value)}
            icon={option.icon}
          >
            {option.label}
          </FilterChip>
        ))}
      </FilterChipRow>

      {typeFilter === 'llamada' ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground">Resultado de llamada</p>
          <FilterChipRow>
            {DETAIL_CALL_OUTCOME_FILTERS.map((option) => (
              <FilterChip
                key={option.value}
                active={callOutcomeFilter === option.value}
                onClick={() => onCallOutcomeChange(option.value)}
                compact
              >
                {option.label}
              </FilterChip>
            ))}
          </FilterChipRow>
        </div>
      ) : null}
    </div>
  );
}

function FilterChipRow({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-0.5 flex flex-wrap gap-1.5 overflow-x-auto pb-0.5">{children}</div>
  );
}

function FilterChip({
  active,
  onClick,
  icon: Icon,
  compact,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: SvgIconComponent;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border font-medium transition-colors',
        compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
        active
          ? 'border-primary/30 bg-primary text-primary-foreground shadow-sm'
          : 'border-border/70 bg-background/90 text-foreground/80 hover:border-border hover:bg-muted/50',
      )}
    >
      {Icon ? <Icon className={cn(compact ? 'size-3' : 'size-3.5')} aria-hidden /> : null}
      {children}
    </button>
  );
}

const EMPTY_GOAL_TARGETS: ActivityGoalTargets = {
  contacto: 0,
  noContacto: 0,
  reuniones: 0,
  correos: 0,
};

const GOAL_ROWS_WEEK: { key: keyof ActivityGoalTargets; label: string }[] = [
  { key: 'contacto', label: 'Contacto' },
  { key: 'noContacto', label: 'No contacto' },
  { key: 'reuniones', label: 'Reuniones' },
  { key: 'correos', label: 'Correos' },
];

const GOAL_ROWS_DAY: { key: keyof ActivityGoalTargets; label: string }[] = [
  { key: 'contacto', label: 'Contacto' },
  { key: 'reuniones', label: 'Reuniones' },
];

function goalRowsForPeriod(period: ActivityGoalPeriod) {
  return period === 'day' ? GOAL_ROWS_DAY : GOAL_ROWS_WEEK;
}

function hasAnyGoalTarget(target: ActivityGoalTargets, period: ActivityGoalPeriod): boolean {
  return activityGoalTotalForPeriod(target, period) > 0;
}

function goalProgressTotal(
  values: ActivityGoalTargets,
  period: ActivityGoalPeriod,
): number {
  return activityGoalTotalForPeriod(values, period);
}

export function ActivityGoalSummary({
  actual,
  target,
  goalPeriod = 'week',
}: {
  actual: ActivityGoalTargets;
  target: ActivityGoalTargets;
  goalPeriod?: ActivityGoalPeriod;
}) {
  const goalRows = goalRowsForPeriod(goalPeriod);
  const actualTotal = goalProgressTotal(actual, goalPeriod);
  const targetTotal = goalProgressTotal(target, goalPeriod);
  const allMet = targetTotal > 0 && goalRows.every(({ key }) => actual[key] >= target[key]);
  const totalMet = targetTotal > 0 && actualTotal >= targetTotal;

  return (
    <div className="shrink-0 border-b border-border/50 bg-background/20 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {goalPeriodLabel(goalPeriod)}
        </p>
        <Badge
          variant="secondary"
          className={cn(
            'rounded-full text-[10px] font-medium',
            allMet || totalMet
              ? 'border-primary/20 bg-primary/10 text-primary'
              : 'border-border/60 bg-muted/50 text-muted-foreground',
          )}
        >
          {allMet ? 'Meta cumplida' : totalMet ? 'Total alcanzado' : 'En progreso'}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {goalRows.map(({ key, label }) => {
          const t = target[key];
          if (t <= 0) return null;
          const a = actual[key];
          const met = a >= t;
          return (
            <div
              key={key}
              className="rounded-xl border border-border/50 bg-background/60 px-2.5 py-2 shadow-sm"
            >
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  met ? 'text-primary' : 'text-foreground',
                )}
              >
                {a}/{t}
              </p>
            </div>
          );
        })}
      </div>
      {targetTotal > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Total:{' '}
          <span
            className={cn(
              'font-semibold tabular-nums',
              totalMet ? 'text-primary' : 'text-foreground',
            )}
          >
            {actualTotal}/{targetTotal}
          </span>
        </p>
      ) : null}
    </div>
  );
}

function ActivityDetailItem({
  row,
  loading,
  onOpen,
}: {
  row: ActivitiesByAdvisorDetailRow;
  loading?: boolean;
  onOpen: () => void;
}) {
  const typeKey = row.type?.toLowerCase().trim() ?? '';
  const Icon = activityTypeSvgIcon(typeKey);
  const iconCircle =
    activityTypeIconCircleClass(typeKey) ??
    'bg-muted text-muted-foreground';

  const hasEntities =
    row.companies.length > 0 || row.contacts.length > 0 || row.opportunities.length > 0;

  return (
    <li
      className={cn(
        'overflow-hidden rounded-xl border border-border/60 bg-background/90 shadow-sm transition-all',
        'hover:border-primary/25 hover:shadow-md',
        loading && 'opacity-70',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={loading}
        aria-label={`Ver detalle: ${row.title || row.typeLabel}`}
        className={cn(
          'group w-full text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30',
          loading && 'pointer-events-none',
        )}
      >
        <div className="flex items-start gap-3 p-3.5">
          <span
            className={cn(
              'inline-flex size-9 shrink-0 items-center justify-center rounded-xl',
              ACTIVITY_ICON_INHERIT,
              iconCircle,
            )}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Icon className="size-[18px]" aria-hidden />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-foreground/90">
                  {row.typeLabel}
                </span>
                {row.callOutcomeLabel ? (
                  <Badge
                    variant="secondary"
                    className={cn(
                      'rounded-full px-2 py-0 text-[10px] font-medium',
                      row.callOutcome === 'contacto'
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'border-border/60 bg-muted/60 text-muted-foreground',
                    )}
                  >
                    {row.callOutcomeLabel}
                    {row.callResultLabel ? ` · ${row.callResultLabel}` : ''}
                  </Badge>
                ) : null}
              </div>
              <time
                dateTime={row.completedAt}
                className="shrink-0 text-[10px] leading-tight text-muted-foreground tabular-nums"
              >
                {formatCompletedAt(row.completedAt)}
              </time>
            </div>

            {row.title ? (
              <p className="mt-1.5 text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
                {row.title}
              </p>
            ) : null}
          </div>
        </div>
      </button>

      {hasEntities ? (
        <div className="border-t border-border/40 bg-muted/20 px-3 py-2">
          <div className="space-y-1">
            <EntityLine
              icon={TaskEntityMetaIcons.company}
              label="Empresa"
              empty="Sin empresa vinculada"
              items={row.companies}
              href={(item) => companyDetailHref(item)}
            />
            <EntityLine
              icon={TaskEntityMetaIcons.contact}
              label="Contacto"
              empty="Sin contacto vinculado"
              items={row.contacts}
              href={(item) => contactDetailHref(item)}
            />
            <EntityLine
              icon={TaskEntityMetaIcons.opportunity}
              label="Oportunidad"
              empty="Sin oportunidad vinculada"
              items={row.opportunities.map((o) => ({
                id: o.id,
                name: o.title,
                urlSlug: o.urlSlug,
              }))}
              href={(item) =>
                opportunityDetailHref({
                  id: item.id,
                  title: item.name,
                  urlSlug: item.urlSlug,
                })
              }
            />
          </div>
        </div>
      ) : null}
    </li>
  );
}

function EntityLine({
  icon: Icon,
  label,
  empty,
  items,
  href,
}: {
  icon: SvgIconComponent;
  label: string;
  empty: string;
  items: { id: string; name: string; urlSlug: string }[];
  href: (item: { id: string; name: string; urlSlug: string }) => string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex items-start gap-2 py-0.5 text-xs">
      <Icon className={cn(TASK_META_ICON_CLASS, 'mt-0.5')} aria-hidden />
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <div className="mt-0.5 flex flex-wrap gap-x-1 gap-y-0.5">
          {items.map((item, index) => (
            <span key={item.id} className="inline-flex min-w-0 items-center">
              {index > 0 ? (
                <span className="mr-1 text-muted-foreground/60">·</span>
              ) : null}
              <Link
                to={href(item)}
                className="truncate font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
              >
                {item.name.trim() || 'Sin nombre'}
              </Link>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
