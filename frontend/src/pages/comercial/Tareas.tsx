import { useState, useMemo, useEffect, useCallback, type ComponentProps, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { toast } from '@/lib/notify';
import {
  Plus, Search, X, MoreVertical,
  CalendarDays, AlertTriangle,
  Check, Pencil, Trash2, Building2,
  Grid3X3, Target,
} from 'lucide-react';
import type {
  Activity, ActivityStatus, TaskKind, ContactPriority, TaskAssociation,
  Contact, Opportunity,
} from '@/types';
import { TasksKanbanBoard } from '@/components/tasks/TasksKanbanBoard';
import { TasksCalendarPopover } from '@/components/tasks/TasksCalendarPopover';
import { TaskDueColorGuide } from '@/components/tasks/TaskDueColorGuide';
import { TASK_KINDS } from '@/types';
import type { UpdateActivityPayload } from '@/lib/activityApi';
import {
  buildCreateTaskPayloadFromForm,
  buildTaskDetailUpdatePayload,
  taskFormHasEntityLinks,
} from '@/lib/taskActivityUpdate';
import { priorityLabels } from '@/data/mock';
import { useActivities } from '@/hooks/useActivities';
import { useMultiAdvisorFilter } from '@/hooks/useMultiAdvisorFilter';
import { format, isSameDay,
} from 'date-fns';
import { es } from 'date-fns/locale';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CalendarDayButton } from '@/components/ui/calendar';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { comercialFilterIconClass, comercialProPopoverClass, matchesInclusiveMultiFilterValue } from '@/lib/comercialFilterSurface';
import {
  comercialTableActionsColumnSizing,
  comercialTableCheckboxWrapClass,
  comercialTableCellStyle,
  comercialTableLeadingCellClass,
  comercialTableSelectColumnSizing,
} from '@/lib/comercialTableLayout';
import {
  crmTableBodyRowClassInteractive,
  crmTableFooterClass,
  crmTableHeaderRowClassSticky,
} from '@/lib/crmTableSurface';
import { GlassCard } from '@/components/shared/GlassCard';
import { ComercialInclusiveMultiFilter } from '@/components/shared/ComercialInclusiveMultiFilter';
import { MultiAdvisorFilter } from '@/components/shared/MultiAdvisorFilter';
import { GhostTableSkeleton } from '@/components/shared/GhostTableSkeleton';
import { ComercialTableColgroup } from '@/components/shared/ComercialTableColgroup';
import { ActivityFormDialog } from '@/components/shared/ActivityFormDialog';
import {
  TaskDetailDialog,
  type TaskDetailTask,
  type TaskComment as TaskDetailComment,
} from '@/components/shared/TaskDetailDialog';
import { ChartSquareIcon } from '@/components/icons/ChartSquareIcon';
import { FilterSvgIcon } from '@/components/icons/FilterSvgIcon';
import { LlamadaSvgIcon } from '@/components/icons/LlamadaSvgIcon';
import { ReunionSvgIcon } from '@/components/icons/ReunionSvgIcon';
import { CorreoSvgIcon } from '@/components/icons/CorreoSvgIcon';
import { WhatsAppSvgIcon } from '@/components/icons/WhatsAppSvgIcon';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TaskFormDialog } from '@/components/shared/TaskFormDialog';
import type { TaskFormResult } from '@/components/shared/TaskFormDialog';
import { contactListAll, mapApiContactRowToContact } from '@/lib/contactApi';
import { companyListAll } from '@/lib/companyApi';
import { opportunityListAll, mapApiOpportunityToOpportunity } from '@/lib/opportunityApi';
import { formatTodayPeruYmd, formatDate, completedAtNowIso } from '@/lib/formatters';
import {
  countTasksByDueUrgency,
  effectiveTaskStatus,
  isTaskOverdue,
  matchesTaskDueUrgencyFilter,
  taskDueDateTextClass,
  taskDueDay,
  taskDueRowHighlightClass,
  type TaskDueUrgencyFilter,
} from '@/lib/taskStatus';
import {
  mergeCompaniesForTaskPicker,
  contactLineFromTaskAssociations,
  taskAssociationsFromActivity,
  taskLinkBadgesFromActivity,
} from '@/lib/taskAssociationsFromActivity';
import { activityIsClienteCartera } from '@/lib/clienteCarteraActivityLinks';
import { completeTaskWithActivityForm } from '@/lib/activityPayloadFromForm';

const taskKindIcons: Record<TaskKind, ComponentType<{ className?: string }>> = {
  llamada: LlamadaSvgIcon,
  reunion: ReunionSvgIcon,
  correo: CorreoSvgIcon,
  whatsapp: WhatsAppSvgIcon,
};

const taskPriorityBadgeClass: Record<'alta' | 'media' | 'baja', string> = {
  alta: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  media: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
  baja: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

/** Tipos de tarea (modalidades; la fila en BD tiene type = 'tarea' + taskKind) */
const taskTypeLabels: Record<TaskKind, string> = {
  llamada: 'Llamada',
  reunion: 'Reunión',
  correo: 'Correo',
  whatsapp: 'WhatsApp',
};

const activityStatusConfig: Record<ActivityStatus, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'text-amber-700 dark:text-amber-300' },
  completada: { label: 'Completada', className: 'text-emerald-700 dark:text-emerald-300' },
  en_progreso: { label: 'En progreso', className: 'text-blue-700 dark:text-blue-300' },
  vencida: { label: 'Vencida', className: 'text-red-700 dark:text-red-300' },
};

const STATUS_FILTER_KEYS = Object.keys(activityStatusConfig) as ActivityStatus[];
const PRIORITY_FILTER_KEYS = Object.keys(priorityLabels) as ContactPriority[];

const statusFilterOptions = STATUS_FILTER_KEYS.map((value) => ({
  value,
  label: activityStatusConfig[value].label,
}));

const priorityFilterOptions = PRIORITY_FILTER_KEYS.map((value) => ({
  value,
  label: priorityLabels[value],
}));

const TASK_VIEW_TOGGLE_SHELL =
  'flex items-center rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 p-0.5';
const TASK_VIEW_TOGGLE_BTN =
  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer';
const TASK_VIEW_TOGGLE_INACTIVE =
  'text-[#647789] dark:text-gray-400 hover:text-[#1f2933] dark:hover:text-gray-100';
const TASK_VIEW_TOGGLE_ACTIVE =
  'bg-[#e8f5e9] dark:bg-green-900/30 text-[#13944C] dark:text-green-400';
const TASK_TOOLBAR_SEARCH_INPUT =
  '!h-auto min-h-0 rounded-md border-0 bg-transparent py-1.5 pl-9 pr-3 text-sm text-black shadow-none placeholder:text-[#8a9aab] focus-visible:ring-0 dark:placeholder:text-gray-400';

const TASK_TABLE_RESPONSIVE: Record<string, string> = {
  contacto: 'hidden sm:table-cell',
  empresa: 'hidden sm:table-cell',
  oportunidad: 'hidden sm:table-cell',
  prioridad: 'hidden sm:table-cell',
  asignado: 'hidden md:table-cell',
  fecha: 'hidden lg:table-cell',
};

function taskTableResponsiveClass(columnId: string): string {
  return TASK_TABLE_RESPONSIVE[columnId] ?? '';
}

const CRM_TABLE_CHECKBOX_CLASS =
  'h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded';

const CRM_CELL_MUTED = 'text-[13px] text-[#475569] dark:text-gray-400';
const CRM_CELL_EMPTY = 'text-[13px] text-muted-foreground/50';

function TaskStatusBadge({ status }: { status: ActivityStatus }) {
  const config = activityStatusConfig[status];
  return (
    <span className={cn('text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}

function isTaskRow(a: Activity): boolean {
  return (
    a.type === 'tarea' &&
    !!a.taskKind &&
    TASK_KINDS.includes(a.taskKind)
  );
}

/** Nombre de empresa para listados (coherente con `mapApiActivityToActivity`). */
function activityCompanyDisplayName(a: Activity): string | undefined {
  const raw = a.contactName?.trim();
  if (!raw) return undefined;
  if (raw.includes(' - ')) {
    const rest = raw.split(' - ').slice(1).join(' - ').trim();
    return rest || undefined;
  }
  if (a.companyId && !a.contactId) return raw;
  return undefined;
}

export type TareasPageScope = 'all' | 'clienteCartera';

export default function TareasPage({ scope = 'all' }: { scope?: TareasPageScope }) {
  const navigate = useNavigate();
  const {
    activities,
    loading: activitiesLoading,
    error: activitiesError,
    createActivity,
    updateActivity,
    deleteActivity,
    refresh: refreshActivities,
  } = useActivities();

  const {
    selectedIds: advisorFilterIds,
    setSelectedIds: setAdvisorFilterIds,
    canSeeAllAdvisors,
    activeAdvisors,
    isInitialized: advisorFilterInitialized,
    isActive: advisorFilterIsActive,
    matchesAssignee,
    reset: resetAdvisorFilter,
  } = useMultiAdvisorFilter();

  const allTasks = useMemo(
    () => {
      const rows = activities.filter(isTaskRow);
      if (scope === 'clienteCartera') {
        return rows.filter(activityIsClienteCartera);
      }
      return rows.filter((task) => !activityIsClienteCartera(task));
    },
    [activities, scope],
  );

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [listPage, setListPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskColumnStatus, setNewTaskColumnStatus] = useState<ActivityStatus | undefined>();
  const [calendarDate, setCalendarDate] = useState<Date | undefined>();
  const [showCalendarHint, setShowCalendarHint] = useState(true);
  const [showDueColorGuide, setShowDueColorGuide] = useState(true);
  const [dueUrgencyFilter, setDueUrgencyFilter] = useState<TaskDueUrgencyFilter | null>(null);
  const [completedTask, setCompletedTask] = useState<Activity | null>(null);
  const [activityFromTaskOpen, setActivityFromTaskOpen] = useState(false);
  const [linkedTaskPromptOpen, setLinkedTaskPromptOpen] = useState(false);
  /** Copia al guardar actividad para el aviso "tarea vinculada" (completedTask se limpia al cerrar el modal). */
  const [linkPromptSourceActivity, setLinkPromptSourceActivity] = useState<Activity | null>(null);
  const [newTaskDefaultTitle, setNewTaskDefaultTitle] = useState('');
  const [newTaskDefaultAssociations, setNewTaskDefaultAssociations] = useState<
    TaskAssociation[] | undefined
  >(undefined);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<Activity | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [taskComments, setTaskComments] = useState<TaskDetailComment[]>([]);
  const [taskPendingDelete, setTaskPendingDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  /** Tarea mostrada como completada mientras se registra la actividad; se revierte al cerrar sin guardar. */
  const [taskCompletionPreviewId, setTaskCompletionPreviewId] = useState<string | null>(null);

  const [crmContacts, setCrmContacts] = useState<Contact[]>([]);
  const [crmOpportunities, setCrmOpportunities] = useState<Opportunity[]>([]);
  const [crmCompanies, setCrmCompanies] = useState<{ name: string; id: string }[]>([]);

  const allTasksForDisplay = useMemo((): Activity[] => {
    if (!taskCompletionPreviewId) return allTasks;
    return allTasks.map((t) =>
      t.id === taskCompletionPreviewId
        ? { ...t, status: 'completada' as ActivityStatus }
        : t,
    );
  }, [allTasks, taskCompletionPreviewId]);

  const loadTaskFormCompanies = useCallback(async () => {
    try {
      const companyRows = await companyListAll();
      setCrmCompanies(companyRows.map((c) => ({ name: c.name, id: c.id })));
    } catch {
      toast.error('No se pudieron cargar las empresas');
    }
  }, []);

  const loadTaskDetailEntities = useCallback(async () => {
    try {
      const [contactRows, oppRows] = await Promise.all([
        contactListAll(),
        opportunityListAll(),
      ]);
      setCrmContacts(contactRows.map(mapApiContactRowToContact));
      setCrmOpportunities(oppRows.map(mapApiOpportunityToOpportunity));
    } catch {
      toast.error('No se pudieron cargar contactos u oportunidades');
    }
  }, []);

  useEffect(() => {
    void loadTaskFormCompanies();
  }, [loadTaskFormCompanies]);

  useEffect(() => {
    if (taskDetailOpen) void loadTaskDetailEntities();
  }, [taskDetailOpen, loadTaskDetailEntities]);

  const tasksInAdvisorScope = useMemo(
    () => allTasksForDisplay.filter((task) => matchesAssignee(task.assignedTo)),
    [allTasksForDisplay, matchesAssignee],
  );

  const dueUrgencyCounts = useMemo(
    () => countTasksByDueUrgency(tasksInAdvisorScope),
    [tasksInAdvisorScope],
  );

  const filteredTasks = useMemo(() => {
    return allTasksForDisplay.filter((task) => {
      const q = search.toLowerCase();
      const companyQ = activityCompanyDisplayName(task)?.toLowerCase() ?? '';
      const matchesSearch =
        !search ||
        task.title.toLowerCase().includes(q) ||
        task.description.toLowerCase().includes(q) ||
        (task.contactName?.toLowerCase().includes(q) ?? false) ||
        companyQ.includes(q);

      const matchesStatus = matchesInclusiveMultiFilterValue(
        statusFilter,
        effectiveTaskStatus(task),
      );
      const taskPriority = task.priority ?? 'media';
      const matchesPriority = matchesInclusiveMultiFilterValue(priorityFilter, taskPriority);
      const matchesAdvisor = matchesAssignee(task.assignedTo);
      const dueDay = taskDueDay(task.dueDate);
      const matchesCalendarDate =
        !calendarDate || (dueDay != null && isSameDay(dueDay, calendarDate));
      const matchesDueUrgency = matchesTaskDueUrgencyFilter(task, dueUrgencyFilter);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesAdvisor &&
        matchesCalendarDate &&
        matchesDueUrgency
      );
    });
  }, [allTasksForDisplay, search, statusFilter, priorityFilter, matchesAssignee, calendarDate, dueUrgencyFilter]);

  const paginatedTasks = useMemo(() => {
    const start = (listPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, listPage, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));

  /** Misma lógica de filtros que la lista, sin pestaña de estado (el tablero agrupa por columna). */
  const tasksForKanban = useMemo(() => {
    return allTasksForDisplay.filter((task) => {
      const q = search.toLowerCase();
      const companyQ = activityCompanyDisplayName(task)?.toLowerCase() ?? '';
      const matchesSearch =
        !search ||
        task.title.toLowerCase().includes(q) ||
        task.description.toLowerCase().includes(q) ||
        (task.contactName?.toLowerCase().includes(q) ?? false) ||
        companyQ.includes(q);
      const matchesStatus = matchesInclusiveMultiFilterValue(
        statusFilter,
        effectiveTaskStatus(task),
      );
      const taskPriority = task.priority ?? 'media';
      const matchesPriority = matchesInclusiveMultiFilterValue(priorityFilter, taskPriority);
      const matchesAdvisor = matchesAssignee(task.assignedTo);
      const dueDay = taskDueDay(task.dueDate);
      const matchesCalendarDate =
        !calendarDate || (dueDay != null && isSameDay(dueDay, calendarDate));
      const matchesDueUrgency = matchesTaskDueUrgencyFilter(task, dueUrgencyFilter);
      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesAdvisor &&
        matchesCalendarDate &&
        matchesDueUrgency
      );
    });
  }, [allTasksForDisplay, search, statusFilter, priorityFilter, matchesAssignee, calendarDate, dueUrgencyFilter]);

  /** Lista actualizada del store (p. ej. PATCH optimista) para que el diálogo refleje el estado al instante. */
  const taskDetailActivity = useMemo(() => {
    if (!selectedTaskDetail) return null;
    return allTasksForDisplay.find((a) => a.id === selectedTaskDetail.id) ?? selectedTaskDetail;
  }, [selectedTaskDetail, allTasksForDisplay]);

  const taskDateCounts = useMemo(
    () =>
      allTasksForDisplay.reduce((map, task) => {
        const day = taskDueDay(task.dueDate);
        if (!day) return map;
        const key = format(day, 'yyyy-MM-dd');
        map.set(key, (map.get(key) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    [allTasksForDisplay],
  );

  const taskDateKeys = useMemo(
    () => new Set(taskDateCounts.keys()),
    [taskDateCounts],
  );

  const TaskCalendarDayButton = useMemo(
    () =>
      function TaskCalendarDayButton({
        className,
        modifiers,
        children,
        day,
        ...props
      }: ComponentProps<typeof CalendarDayButton>) {
        const taskCount = taskDateCounts.get(format(day.date, 'yyyy-MM-dd')) ?? 0;
        const showDot = taskCount > 0 && !modifiers.outside;
        const dayButton = (
          <div className="relative">
            <CalendarDayButton className={className} modifiers={modifiers} day={day} {...props}>
              {children}
            </CalendarDayButton>
            {showDot ? (
              <span
                className={cn(
                  'pointer-events-none absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[#13944C]',
                  modifiers.selected && 'bg-white/90',
                )}
              />
            ) : null}
          </div>
        );

        if (!showDot) return dayButton;

        return (
          <Tooltip>
            <TooltipTrigger asChild>{dayButton}</TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              {taskCount === 1 ? '1 tarea' : `${taskCount} tareas`}
            </TooltipContent>
          </Tooltip>
        );
      },
    [taskDateCounts],
  );

  const calendarTaskProps = useMemo(
    () => ({
      modifiers: {
        hasTasks: (date: Date) => taskDateKeys.has(format(date, 'yyyy-MM-dd')),
      },
      components: {
        DayButton: TaskCalendarDayButton,
      },
    }),
    [taskDateKeys],
  );

  const hasActiveFilters =
    statusFilter.length > 0 ||
    priorityFilter.length > 0 ||
    advisorFilterIsActive ||
    search !== '' ||
    Boolean(calendarDate) ||
    dueUrgencyFilter != null;

  function clearFilters() {
    setSearch('');
    setStatusFilter([]);
    setPriorityFilter([]);
    resetAdvisorFilter();
    setCalendarDate(undefined);
    setDueUrgencyFilter(null);
    setListPage(1);
  }

  function isOverdue(dueDate: string, status: ActivityStatus) {
    return isTaskOverdue({ dueDate, status });
  }

  const selectedDateLabel = format(
    calendarDate ?? new Date(),
    "d 'de' MMMM yyyy",
    { locale: es },
  );

  function formatDueDate(dueDate: string, startTime?: string) {
    const dateStr = formatDate(dueDate);
    if (startTime) return `${dateStr} (${startTime})`;
    return dateStr;
  }

  function activityToTaskDetail(a: Activity): TaskDetailTask {
    const kind: TaskKind =
      a.taskKind && TASK_KINDS.includes(a.taskKind) ? a.taskKind : 'llamada';
    const assocs = taskAssociationsFromActivity(a);
    return {
      id: a.id,
      title: a.title,
      status: effectiveTaskStatus(a),
      type: kind,
      priority: a.priority ?? 'media',
      company: activityCompanyDisplayName(a),
      dueDate: a.dueDate,
      startDate: a.startDate,
      startTime: a.startTime,
      assignee: a.assignedToName,
      associations: assocs.length > 0 ? assocs : undefined,
      description: a.description,
    };
  }

  const tareasStatusLabels: Record<string, string> = Object.fromEntries(
    Object.entries(activityStatusConfig).map(([k, v]) => [k, v.label]),
  );
  const tareasStatusColors: Record<string, string> = Object.fromEntries(
    Object.entries(activityStatusConfig).map(([k, v]) => [k, v.className]),
  );

  /** Incluye empresas de GET /companies y las de tarea de seguimiento aunque no estén en el listado. */
  const taskFormCompanies = useMemo(
    () => mergeCompaniesForTaskPicker(crmCompanies, newTaskDefaultAssociations ?? []),
    [crmCompanies, newTaskDefaultAssociations],
  );

  const taskDetailFormCompanies = useMemo(
    () =>
      mergeCompaniesForTaskPicker(
        crmCompanies,
        taskDetailActivity ? taskAssociationsFromActivity(taskDetailActivity) : [],
      ),
    [crmCompanies, taskDetailActivity],
  );

  function handleKanbanStatusChange(taskId: string, next: ActivityStatus) {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task || effectiveTaskStatus(task) === next) return;
    if (next === 'vencida') return;
    const openActivityModal =
      next === 'completada' &&
      task.taskKind &&
      TASK_KINDS.includes(task.taskKind);
    if (openActivityModal) {
      setCompletedTask(task);
      setTaskCompletionPreviewId(task.id);
      setActivityFromTaskOpen(true);
      return;
    }
    const payload: UpdateActivityPayload = { status: next };
    if (next === 'completada') {
      payload.completedAt = completedAtNowIso();
    } else if (task.status === 'completada') {
      payload.completedAt = '';
    }
    toast.success('Estado actualizado');
    void updateActivity(taskId, payload).catch((e) => {
      toast.error(e instanceof Error ? e.message : 'Error al mover la tarea');
    });
  }

  function handleTaskToggle(taskId: string) {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'completada' ? 'pendiente' : 'completada';
    if (
      newStatus === 'completada' &&
      task.taskKind &&
      TASK_KINDS.includes(task.taskKind)
    ) {
      setCompletedTask(task);
      setTaskCompletionPreviewId(task.id);
      setActivityFromTaskOpen(true);
      return;
    }
    const payload: { status: string; completedAt?: string } = { status: newStatus };
    if (newStatus === 'completada') {
      payload.completedAt = completedAtNowIso();
    } else if (task.status === 'completada') {
      payload.completedAt = '';
    }
    toast.success(newStatus === 'completada' ? 'Tarea completada' : 'Tarea reactivada');
    void updateActivity(taskId, payload).catch((e) => {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar tarea');
    });
  }

  function requestDeleteTask(id: string) {
    const t = allTasks.find((a) => a.id === id);
    if (!t) return;
    setTaskPendingDelete({ id, title: t.title });
  }

  async function confirmDeleteTask() {
    if (!taskPendingDelete) return;
    const { id, title } = taskPendingDelete;
    try {
      await deleteActivity(id);
      toast.success(`Tarea "${title}" eliminada`);
      if (selectedTaskDetail?.id === id) {
        setTaskDetailOpen(false);
        setSelectedTaskDetail(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar tarea');
    } finally {
      setTaskPendingDelete(null);
    }
  }

  async function handleTaskFormSave(data: TaskFormResult): Promise<void> {
    if (!taskFormHasEntityLinks(data)) {
      toast.error('Debes vincular la tarea a un contacto, empresa u oportunidad');
      throw new Error('TASK_FORM_VALIDATION');
    }
    try {
      await createActivity(buildCreateTaskPayloadFromForm(data), {
        assigneeName: data.assigneeName,
        contactNameLine: contactLineFromTaskAssociations(data.associations),
      });
      toast.success('Tarea creada');
    } catch (e) {
      if (e instanceof Error && e.message === 'TASK_FORM_VALIDATION') return;
      toast.error(e instanceof Error ? e.message : 'Error al crear tarea');
      throw e;
    }
  }

  const openNewTask = useCallback(() => {
    setNewTaskColumnStatus(undefined);
    setNewTaskDefaultAssociations(undefined);
    setNewTaskOpen(true);
  }, []);

  const taskTableColumns = useMemo<ColumnDef<Activity>[]>(
    () => [
      {
        id: 'select',
        header: () => <span className="sr-only">Seleccionar</span>,
        cell: ({ row }) => {
          const task = row.original;
          return (
            <div className={comercialTableCheckboxWrapClass}>
              <Checkbox
                checked={task.status === 'completada'}
                onCheckedChange={() => handleTaskToggle(task.id)}
                className={CRM_TABLE_CHECKBOX_CLASS}
              />
            </div>
          );
        },
        ...comercialTableSelectColumnSizing,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const task = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Acciones">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {task.status !== 'completada' && (
                  <DropdownMenuItem onClick={() => handleTaskToggle(task.id)}>
                    <Check /> Completar
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => { setSelectedTaskDetail(task); setTaskDetailOpen(true); }}>
                  <Pencil /> Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => requestDeleteTask(task.id)}>
                  <Trash2 /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        ...comercialTableActionsColumnSizing,
      },
      {
        id: 'type',
        header: 'Tipo',
        size: 44,
        minSize: 40,
        cell: ({ row }) => {
          const task = row.original;
          const taskType: TaskKind =
            task.taskKind && TASK_KINDS.includes(task.taskKind) ? task.taskKind : 'llamada';
          const TypeIcon = taskKindIcons[taskType];
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="mx-auto flex size-6 items-center justify-center text-muted-foreground"
                  aria-label={taskTypeLabels[taskType]}
                >
                  <TypeIcon className="size-6 shrink-0" aria-hidden />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">{taskTypeLabels[taskType]}</TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        id: 'titulo',
        accessorKey: 'title',
        header: 'Título',
        size: 220,
        cell: ({ row }) => {
          const task = row.original;
          return (
            <span
              className={cn(
                'block truncate text-[13px] font-semibold text-[#0F172A] dark:text-gray-100',
                task.status === 'completada' && 'line-through text-muted-foreground',
              )}
              title={task.title}
            >
              {task.title}
            </span>
          );
        },
      },
      {
        id: 'contacto',
        header: 'Contacto',
        size: 160,
        cell: ({ row }) => {
          const task = row.original;
          if (!task.contactName) return <span className={CRM_CELL_EMPTY}>—</span>;
          return (
            <div className="min-w-0 truncate" title={`${task.contactName}${task.contactPhone ? ` - ${task.contactPhone}` : ''}`}>
              <span className="block truncate text-[13px] font-semibold text-[#0F172A] dark:text-gray-100">
                {task.contactName}
              </span>
              {task.contactPhone && (
                <span className="block truncate text-[11px] text-muted-foreground">
                  {task.contactPhone}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'empresa',
        header: 'Empresa',
        size: 160,
        cell: ({ row }) => {
          const task = row.original;
          const displayCompany =
            task.clienteEmpresaName?.trim() ||
            task.companyName?.trim() ||
            taskAssociationsFromActivity(task).find((a) => a.type === 'cliente_empresa')?.name;
          if (!displayCompany) return <span className={CRM_CELL_EMPTY}>—</span>;
          return (
            <span className={cn('block truncate', CRM_CELL_MUTED)} title={displayCompany}>
              {displayCompany}
            </span>
          );
        },
      },
      {
        id: 'oportunidad',
        header: 'Oportunidad',
        size: 160,
        cell: ({ row }) => {
          const task = row.original;
          if (!task.opportunityTitle) return <span className={CRM_CELL_EMPTY}>—</span>;
          return (
            <span className={cn('block truncate', CRM_CELL_MUTED)} title={task.opportunityTitle}>
              {task.opportunityTitle}
            </span>
          );
        },
      },
      {
        id: 'prioridad',
        header: 'Prioridad',
        size: 104,
        cell: ({ row }) => {
          const taskPriority: ContactPriority = row.original.priority ?? 'media';
          return (
            <Badge
              variant="outline"
              className={cn('border-0 text-xs font-medium', taskPriorityBadgeClass[taskPriority])}
            >
              {priorityLabels[taskPriority]}
            </Badge>
          );
        },
      },
      {
        id: 'asignado',
        header: 'Asignado',
        size: 96,
        cell: ({ row }) => (
          <span className={cn('block truncate', CRM_CELL_MUTED)} title={row.original.assignedToName}>
            {row.original.assignedToName?.split(' ')[0] ?? '—'}
          </span>
        ),
      },
      {
        id: 'fecha',
        header: 'Fecha',
        size: 140,
        cell: ({ row }) => {
          const task = row.original;
          const overdue = isOverdue(task.dueDate, task.status);
          const dateTextClass = taskDueDateTextClass(task);
          return (
            <span
              className={cn(
                'flex flex-col gap-0.5 whitespace-nowrap text-[13px] leading-tight',
                CRM_CELL_MUTED,
                dateTextClass,
              )}
            >
              <span className="flex items-center gap-1">
                {formatDueDate(task.dueDate, task.startTime)}
                {overdue && <AlertTriangle className="size-3.5 shrink-0 text-red-500" />}
              </span>
            </span>
          );
        },
      },
      {
        id: 'estado',
        header: 'Estado',
        size: 110,
        cell: ({ row }) => (
          <TaskStatusBadge status={effectiveTaskStatus(row.original)} />
        ),
      },
    ],
    [handleTaskToggle, requestDeleteTask, formatDueDate, isOverdue],
  );

  const tasksTable = useReactTable({
    data: paginatedTasks,
    columns: taskTableColumns,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 60 },
  });

  return (
    <TooltipProvider>
      <div className={viewMode === 'kanban' ? 'flex h-full min-h-0 min-w-0 flex-col gap-5' : 'min-w-0 max-w-full space-y-6'}>
      <PageHeader title={scope === 'clienteCartera' ? 'Tareas — Clientes' : 'Tareas'}>
        {viewMode === 'kanban' ? (
          <div className="flex items-center gap-2">
            <div className={TASK_VIEW_TOGGLE_SHELL}>
              <button
                type="button"
                className={cn(TASK_VIEW_TOGGLE_BTN, TASK_VIEW_TOGGLE_INACTIVE)}
                onClick={() => setViewMode('list')}
              >
                Lista
              </button>
              <button
                type="button"
                className={cn(TASK_VIEW_TOGGLE_BTN, TASK_VIEW_TOGGLE_ACTIVE)}
              >
                Kanban
              </button>
            </div>
            <div className={cn(TASK_VIEW_TOGGLE_SHELL, 'relative w-full min-w-0 max-w-[400px]')}>
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a9aab] dark:text-gray-400" />
              <Input
                placeholder="Buscar tareas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={TASK_TOOLBAR_SEARCH_INPUT}
              />
            </div>
            <div className={TASK_VIEW_TOGGLE_SHELL}>
              <TasksCalendarPopover
                calendarDate={calendarDate}
                onCalendarDateChange={setCalendarDate}
                calendarTaskProps={calendarTaskProps}
                showHint={showCalendarHint}
                onDismissHint={() => setShowCalendarHint(false)}
                triggerClassName={cn(
                  TASK_VIEW_TOGGLE_BTN,
                  'inline-flex items-center gap-1.5',
                  calendarDate
                    ? TASK_VIEW_TOGGLE_ACTIVE
                    : TASK_VIEW_TOGGLE_INACTIVE,
                )}
              />
            </div>
            <div className={TASK_VIEW_TOGGLE_SHELL}>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      TASK_VIEW_TOGGLE_BTN,
                      'inline-flex items-center gap-1.5 font-semibold',
                      hasActiveFilters
                        ? TASK_VIEW_TOGGLE_ACTIVE
                        : TASK_VIEW_TOGGLE_INACTIVE,
                    )}
                  >
                    <FilterSvgIcon className="size-4" />
                    Filtros
                  </button>
                </PopoverTrigger>
              <PopoverContent className={cn(comercialProPopoverClass, "w-[min(100vw-2rem,640px)] p-3")} align="end" sideOffset={8}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <ComercialInclusiveMultiFilter
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={statusFilterOptions}
                    placeholder="Estado"
                    countLabel="estados"
                    icon={<ChartSquareIcon className={comercialFilterIconClass} />}
                    className="flex-1 w-auto min-w-0"
                  />
                  <ComercialInclusiveMultiFilter
                    value={priorityFilter}
                    onChange={setPriorityFilter}
                    options={priorityFilterOptions}
                    placeholder="Prioridad"
                    countLabel="prioridades"
                    icon={<ChartSquareIcon className={comercialFilterIconClass} />}
                    className="flex-1 w-auto min-w-0"
                  />
                  <MultiAdvisorFilter
                    value={advisorFilterIds}
                    onChange={setAdvisorFilterIds}
                    advisors={activeAdvisors}
                    disabled={!canSeeAllAdvisors}
                    isActive={advisorFilterIsActive}
                    isInitialized={advisorFilterInitialized}
                    className="!w-[240px] flex-1 min-w-[240px]"
                  />
                </div>
              </PopoverContent>
            </Popover>
            </div>
            {(hasActiveFilters || search) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-4" /> Limpiar
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <div className={TASK_VIEW_TOGGLE_SHELL}>
              <button
                type="button"
                className={cn(TASK_VIEW_TOGGLE_BTN, TASK_VIEW_TOGGLE_ACTIVE)}
              >
                Lista
              </button>
              <button
                type="button"
                className={cn(TASK_VIEW_TOGGLE_BTN, TASK_VIEW_TOGGLE_INACTIVE)}
                onClick={() => setViewMode('kanban')}
              >
                Kanban
              </button>
            </div>
            <div className={TASK_VIEW_TOGGLE_SHELL}>
              <TasksCalendarPopover
                calendarDate={calendarDate}
                onCalendarDateChange={setCalendarDate}
                calendarTaskProps={calendarTaskProps}
                showHint={showCalendarHint}
                onDismissHint={() => setShowCalendarHint(false)}
                triggerClassName={cn(
                  TASK_VIEW_TOGGLE_BTN,
                  'inline-flex items-center gap-1.5',
                  calendarDate
                    ? TASK_VIEW_TOGGLE_ACTIVE
                    : TASK_VIEW_TOGGLE_INACTIVE,
                )}
              />
            </div>
            {activitiesLoading && (
              <span className="text-sm text-muted-foreground">Cargando…</span>
            )}
            <Button
              type="button"
              onClick={openNewTask}
              disabled={activitiesLoading}
              className="inline-flex h-auto items-center gap-1.5 rounded-md border-0 bg-[#13944C] px-3 py-2 text-sm font-medium text-white shadow-md hover:bg-[#0f7a3d] disabled:opacity-50"
            >
              <Plus className="size-4" /> Nueva
            </Button>
          </div>
        )}
      </PageHeader>

      <TaskDueColorGuide
        open={showDueColorGuide}
        onDismiss={() => setShowDueColorGuide(false)}
        onReopen={() => setShowDueColorGuide(true)}
        activeFilter={dueUrgencyFilter}
        counts={dueUrgencyCounts}
        onFilterChange={(next) => {
          setDueUrgencyFilter(next);
          setListPage(1);
        }}
      />

      {activitiesError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {activitiesError}
          <Button variant="link" size="sm" className="ml-2 h-auto p-0" onClick={() => refreshActivities()}>
            Reintentar
          </Button>
        </div>
      )}

      {/* Main content: list / kanban */}
      <div className="flex min-h-0 min-w-0 max-w-full flex-1 gap-6">
        <div
          className={cn(
            'min-w-0 flex-1',
            viewMode === 'kanban' && 'flex min-h-0 w-full min-w-0 flex-col',
          )}
        >
          {viewMode === 'kanban' ? (
            activitiesLoading || tasksForKanban.length > 0 ? (
              <TasksKanbanBoard
                tasks={tasksForKanban}
                loading={activitiesLoading}
                onTaskClick={(t) => {
                  setSelectedTaskDetail(t);
                  setTaskDetailOpen(true);
                }}
                onAddTask={(columnStatus) => {
                  setNewTaskColumnStatus(columnStatus);
                  setNewTaskDefaultAssociations(undefined);
                  setNewTaskOpen(true);
                }}
                onStatusChange={handleKanbanStatusChange}
                formatDueDate={formatDueDate}
              />
            ) : (
              <EmptyState
                icon={Grid3X3}
                title="No hay tareas para el tablero"
                description="Ajusta los filtros o crea una nueva tarea."
              />
            )
          ) : (
            <GlassCard>
              {calendarDate ? (
                <div className="flex items-center gap-2 border-b border-border/40 px-5 py-2.5 text-sm text-muted-foreground">
                  <CalendarDays className="size-4 text-[#13944C]" />
                  <span>
                    Mostrando tareas para{' '}
                    <span className="font-medium text-foreground">{selectedDateLabel}</span>
                  </span>
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setCalendarDate(undefined)}>
                    Ver todas
                  </Button>
                </div>
              ) : null}

              <div className="flex min-w-0 flex-col gap-2 px-5 py-3 lg:flex-row lg:items-center">
                <div className="relative w-full min-w-0 max-w-[400px]">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a9aab] dark:text-gray-400" />
                  <Input
                    placeholder="Buscar por título, descripción o contacto..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setListPage(1);
                    }}
                    className="!h-10 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 pl-8 text-[13px] text-black dark:text-gray-100 placeholder:text-[#8a9aab] dark:placeholder:text-gray-400 transition-colors hover:border-primary focus-visible:ring-1 shadow-none"
                  />
                </div>
                <ComercialInclusiveMultiFilter
                  value={statusFilter}
                  onChange={(value) => {
                    setStatusFilter(value);
                    setListPage(1);
                  }}
                  options={statusFilterOptions}
                  placeholder="Estado"
                  countLabel="estados"
                  icon={<ChartSquareIcon className={comercialFilterIconClass} />}
                />
                <ComercialInclusiveMultiFilter
                  value={priorityFilter}
                  onChange={(value) => {
                    setPriorityFilter(value);
                    setListPage(1);
                  }}
                  options={priorityFilterOptions}
                  placeholder="Prioridad"
                  countLabel="prioridades"
                  icon={<ChartSquareIcon className={comercialFilterIconClass} />}
                />
                <MultiAdvisorFilter
                  value={advisorFilterIds}
                  onChange={setAdvisorFilterIds}
                  advisors={activeAdvisors}
                  disabled={!canSeeAllAdvisors}
                  isActive={advisorFilterIsActive}
                  isInitialized={advisorFilterInitialized}
                  className="!w-[240px]"
                  onInteraction={() => setListPage(1)}
                />
                {hasActiveFilters ? (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="size-4" /> Limpiar
                  </Button>
                ) : null}
              </div>

              {activitiesLoading && allTasks.length === 0 ? (
                <GhostTableSkeleton
                  columns={[
                    { label: '', width: 44 },
                    { label: '', width: 40 },
                    { label: 'Tipo', width: 44 },
                    { label: 'Título', width: 220 },
                    { label: 'Contacto', width: 160, className: 'hidden sm:table-cell' },
                    { label: 'Empresa', width: 160, className: 'hidden sm:table-cell' },
                    { label: 'Oportunidad', width: 160, className: 'hidden sm:table-cell' },
                    { label: 'Prioridad', width: 104, className: 'hidden sm:table-cell' },
                    { label: 'Asignado', width: 96, className: 'hidden md:table-cell' },
                    { label: 'Fecha', width: 140, className: 'hidden lg:table-cell' },
                    { label: 'Estado', width: 110 },
                  ]}
                  rows={10}
                />
              ) : filteredTasks.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No se encontraron tareas"
                  description="Intenta ajustar los filtros o crea una nueva tarea."
                />
              ) : (
                <>
                  <div className="border-t border-border/40 overflow-auto scrollbar-thin max-h-[calc(100vh-330px)]">
                    <table className="w-full table-fixed bg-transparent" style={{ minWidth: tasksTable.getTotalSize() }}>
                      <ComercialTableColgroup columns={tasksTable.getVisibleLeafColumns()} />
                      <thead>
                        {tasksTable.getHeaderGroups().map((hg) => (
                          <tr key={hg.id} className={cn('h-[36px] text-left', crmTableHeaderRowClassSticky)}>
                            {hg.headers.map((header) => (
                              <th
                                key={header.id}
                                colSpan={header.colSpan}
                                className={cn(
                                  comercialTableLeadingCellClass(header.column.id, {
                                    primaryColumnId: 'titulo',
                                    extra: header.column.id === 'type' ? 'text-center' : undefined,
                                  }),
                                  taskTableResponsiveClass(header.column.id),
                                )}
                                style={comercialTableCellStyle(header.column.id, header.getSize())}
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {header.column.getCanResize() && (
                                  <div
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      header.getResizeHandler()(e);
                                    }}
                                    onTouchStart={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      header.getResizeHandler()(e);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="group/rez absolute inset-y-0 right-0 flex w-5 cursor-col-resize items-center justify-center"
                                  >
                                    <div className="pointer-events-none h-4 w-[2px] select-none rounded-full bg-gray-200 transition-all group-hover/rez:w-[5px] group-hover/rez:bg-blue-500 group-active/rez:w-[5px] group-active/rez:bg-blue-500" />
                                  </div>
                                )}
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody className="bg-transparent">
                        {tasksTable.getRowModel().rows.map((row) => {
                          const task = row.original;
                          const rowHighlight = taskDueRowHighlightClass(task);
                          return (
                            <tr
                              key={row.id}
                              className={cn(
                                'h-[48px] last:border-b-0',
                                crmTableBodyRowClassInteractive,
                                rowHighlight,
                                task.status === 'completada' && 'opacity-75',
                              )}
                              onClick={() => {
                                setSelectedTaskDetail(task);
                                setTaskDetailOpen(true);
                              }}
                            >
                              {row.getVisibleCells().map((cell) => (
                                <td
                                  key={cell.id}
                                  className={cn(
                                    comercialTableLeadingCellClass(cell.column.id, {
                                      primaryColumnId: 'titulo',
                                      extra: cell.column.id === 'type' ? 'text-center' : undefined,
                                    }),
                                    taskTableResponsiveClass(cell.column.id),
                                  )}
                                  style={comercialTableCellStyle(cell.column.id, cell.column.getSize())}
                                  onClick={
                                    cell.column.id === 'select' || cell.column.id === 'actions'
                                      ? (e) => e.stopPropagation()
                                      : undefined
                                  }
                                >
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                {filteredTasks.length > 0 && (
                  <div className={cn('flex h-14 items-center px-5', crmTableFooterClass)}>
                    <Pagination
                      page={listPage}
                      totalPages={totalPages}
                      onPageChange={setListPage}
                      totalItems={filteredTasks.length}
                      pageSize={pageSize}
                      onPageSizeChange={(newSize) => {
                        setPageSize(newSize);
                        setListPage(1);
                      }}
                    />
                  </div>
                )}
                </>
              )}
            </GlassCard>
          )}
        </div>
      </div>

      {/* Vista previa de tarea (mismo que TasksTab) */}
      <TaskDetailDialog
        open={taskDetailOpen}
        onOpenChange={(o) => {
          setTaskDetailOpen(o);
          if (!o) setSelectedTaskDetail(null);
        }}
        task={taskDetailActivity ? activityToTaskDetail(taskDetailActivity) : null}
        statusLabels={tareasStatusLabels}
        statusColors={tareasStatusColors}
        tasks={allTasksForDisplay.map(activityToTaskDetail)}
        onTasksChange={async (taskDetails) => {
          const currentActs = allTasks;
          const current = currentActs.map(activityToTaskDetail);
          const newIds = new Set(taskDetails.map((t) => t.id));
          const deleted = current.filter((t) => !newIds.has(t.id));
          for (const t of deleted) {
            try {
              await deleteActivity(t.id);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Error al eliminar');
            }
          }
          for (const nd of taskDetails) {
            const oldAct = currentActs.find((a) => a.id === nd.id);
            if (!oldAct) continue;
            const oldDetail = activityToTaskDetail(oldAct);
            const payload = buildTaskDetailUpdatePayload(oldDetail, nd, {
              previousAssigneeId: oldAct.assignedTo,
            });
            if (Object.keys(payload).length === 0) continue;
            try {
              const updated = await updateActivity(nd.id, payload);
              setSelectedTaskDetail((prev) => (prev?.id === updated.id ? updated : prev));
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Error al actualizar');
              throw e;
            }
          }
        }}
        taskComments={taskComments}
        onTaskCommentsChange={setTaskComments}
        contacts={crmContacts}
        companies={taskDetailFormCompanies}
        opportunities={crmOpportunities}
        onCompleteWithActivity={(t) => {
          const act = allTasks.find((a) => a.id === t.id);
          if (act) {
            setCompletedTask(act);
            setTaskCompletionPreviewId(act.id);
            setTaskDetailOpen(false);
            setSelectedTaskDetail(null);
            setActivityFromTaskOpen(true);
          }
        }}
      />

      {/* ActivityFormDialog al completar llamada/reunión/correo */}
      {completedTask &&
        completedTask.taskKind &&
        TASK_KINDS.includes(completedTask.taskKind) &&
        activityFromTaskOpen && (
          <ActivityFormDialog
            type={completedTask.taskKind}
            open={activityFromTaskOpen}
            onOpenChange={(open) => {
              setActivityFromTaskOpen(open);
              if (!open) {
                setCompletedTask(null);
                setTaskCompletionPreviewId(null);
              }
            }}
            onSave={async (data) => {
              if (!completedTask?.taskKind || !TASK_KINDS.includes(completedTask.taskKind)) return;
              const t = completedTask;
              const kind = completedTask.taskKind!;
              try {
                await completeTaskWithActivityForm({
                  kind,
                  form: data,
                  task: t,
                  createActivity,
                  updateActivity,
                });
                setLinkPromptSourceActivity(t);
                setTaskCompletionPreviewId(null);
                setActivityFromTaskOpen(false);
                setLinkedTaskPromptOpen(true);
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : 'Error al guardar la actividad; el estado se revirtió.',
                );
                throw e;
              }
            }}
            taskSummary={{
              title: completedTask.title,
              assignee: completedTask.assignedToName,
              dueDate: completedTask.dueDate,
              linkBadges: taskLinkBadgesFromActivity(completedTask),
            }}
            defaultTitle={completedTask.title}
            defaultDate={formatTodayPeruYmd()}
            showSkip
          />
        )}

      {/* Prompt crear tarea vinculada */}
      <Dialog
        open={linkedTaskPromptOpen}
        onOpenChange={(open) => {
          setLinkedTaskPromptOpen(open);
          if (!open) {
            setCompletedTask(null);
            setLinkPromptSourceActivity(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Crear tarea vinculada</DialogTitle>
            <DialogDescription>
              ¿Deseas crear una nueva tarea vinculada a esta actividad?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setLinkedTaskPromptOpen(false);
                setCompletedTask(null);
                setLinkPromptSourceActivity(null);
              }}
            >
              No, gracias
            </Button>
            <Button
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              onClick={() => {
                const source = linkPromptSourceActivity;
                setLinkedTaskPromptOpen(false);
                setNewTaskDefaultTitle('');
                setNewTaskDefaultAssociations(
                  source ? taskAssociationsFromActivity(source) : undefined,
                );
                setCompletedTask(null);
                setLinkPromptSourceActivity(null);
                setNewTaskOpen(true);
              }}
            >
              Sí, crear tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskFormDialog
        open={newTaskOpen}
        onOpenChange={(open) => {
          setNewTaskOpen(open);
          if (!open) {
            setNewTaskDefaultTitle('');
            setNewTaskColumnStatus(undefined);
            setNewTaskDefaultAssociations(undefined);
          }
        }}
        title="Nueva Tarea"
        description="Crea una nueva tarea vinculada a al menos un contacto, empresa u oportunidad."
        contacts={[]}
        companies={taskFormCompanies}
        opportunities={[]}
        defaultTitle={newTaskDefaultTitle}
        defaultStatus={newTaskColumnStatus}
        defaultAssociations={newTaskDefaultAssociations}
        onSave={handleTaskFormSave}
      />

      <ConfirmDialog
        open={taskPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setTaskPendingDelete(null);
        }}
        title="Eliminar tarea"
        description={
          taskPendingDelete
            ? `¿Estás seguro de que deseas eliminar la tarea «${taskPendingDelete.title}»? Esta acción no se puede deshacer.`
            : ''
        }
        onConfirm={() => { void confirmDeleteTask(); }}
        variant="destructive"
      />
      </div>
    </TooltipProvider>
  );
}
