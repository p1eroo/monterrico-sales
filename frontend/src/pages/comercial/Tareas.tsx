import { useState, useMemo, useEffect, useCallback, type ComponentProps, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { TASK_KINDS } from '@/types';
import type { CreateActivityPayload, UpdateActivityPayload } from '@/lib/activityApi';
import { priorityLabels } from '@/data/mock';
import { useActivities } from '@/hooks/useActivities';
import { useMultiAdvisorFilter } from '@/hooks/useMultiAdvisorFilter';
import {
  format, isBefore, startOfDay, isSameDay,
} from 'date-fns';
import { es } from 'date-fns/locale';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
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
  comercialTableCheckboxWrapClass,
  comercialTableFixedColStyle,
  comercialTableLeadingCellClass,
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
import { ActivityFormDialog } from '@/components/shared/ActivityFormDialog';
import {
  TaskDetailDialog,
  type TaskDetailTask,
  type TaskComment as TaskDetailComment,
} from '@/components/shared/TaskDetailDialog';
import { ChartSquareIcon } from '@/components/icons/ChartSquareIcon';
import { CalendarSvgIcon } from '@/components/icons/CalendarSvgIcon';
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
import { formatTodayPeruYmd, formatDate } from '@/lib/formatters';
import {
  contactLineFromTaskAssociations,
  mergeCompaniesForTaskPicker,
  taskAssociationsFromActivity,
  taskLinkBadgesFromActivity,
} from '@/lib/taskAssociationsFromActivity';

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
  pendiente: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  completada: { label: 'Completada', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  en_progreso: { label: 'En progreso', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  vencida: { label: 'Vencida', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
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

const DATE_ONLY_YMD = /^\d{4}-\d{2}-\d{2}$/;

function taskDueDay(dueDate: string): Date | null {
  const t = dueDate?.trim();
  if (!t || !DATE_ONLY_YMD.test(t)) return null;
  const d = startOfDay(new Date(`${t}T12:00:00-05:00`));
  return Number.isNaN(d.getTime()) ? null : d;
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

export default function TareasPage() {
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
    () => activities.filter(isTaskRow),
    [activities],
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

  const loadTaskFormEntities = useCallback(async () => {
    try {
      const [contactRows, companyRows, oppRows] = await Promise.all([
        contactListAll(),
        companyListAll(),
        opportunityListAll(),
      ]);
      setCrmContacts(contactRows.map(mapApiContactRowToContact));
      setCrmCompanies(companyRows.map((c) => ({ name: c.name, id: c.id })));
      setCrmOpportunities(oppRows.map(mapApiOpportunityToOpportunity));
    } catch {
      toast.error('No se pudieron cargar contactos, empresas u oportunidades');
    }
  }, []);

  useEffect(() => {
    void loadTaskFormEntities();
  }, [loadTaskFormEntities]);


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

      const matchesStatus = matchesInclusiveMultiFilterValue(statusFilter, task.status);
      const taskPriority = task.priority ?? 'media';
      const matchesPriority = matchesInclusiveMultiFilterValue(priorityFilter, taskPriority);
      const matchesAdvisor = matchesAssignee(task.assignedTo);
      const dueDay = taskDueDay(task.dueDate);
      const matchesCalendarDate =
        !calendarDate || (dueDay != null && isSameDay(dueDay, calendarDate));

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesAdvisor &&
        matchesCalendarDate
      );
    });
  }, [allTasksForDisplay, search, statusFilter, priorityFilter, matchesAssignee, calendarDate]);

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
      const matchesStatus = matchesInclusiveMultiFilterValue(statusFilter, task.status);
      const taskPriority = task.priority ?? 'media';
      const matchesPriority = matchesInclusiveMultiFilterValue(priorityFilter, taskPriority);
      const matchesAdvisor = matchesAssignee(task.assignedTo);
      const dueDay = taskDueDay(task.dueDate);
      const matchesCalendarDate =
        !calendarDate || (dueDay != null && isSameDay(dueDay, calendarDate));
      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesAdvisor &&
        matchesCalendarDate
      );
    });
  }, [allTasksForDisplay, search, statusFilter, priorityFilter, matchesAssignee, calendarDate]);

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
        const showDot = modifiers.hasTasks && !modifiers.outside;
        const showCounter = taskCount > 1 && !modifiers.outside;
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
            {showCounter ? (
              <span
                className={cn(
                  'pointer-events-none absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold leading-none',
                  modifiers.selected
                    ? 'bg-white/90 text-[#13944C]'
                    : 'bg-[#13944C] text-white',
                )}
              >
                {taskCount}
              </span>
            ) : null}
          </div>
        );

        if (!showCounter) return dayButton;

        return (
          <Tooltip>
            <TooltipTrigger asChild>{dayButton}</TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              {taskCount} tareas
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
    Boolean(calendarDate);

  function clearFilters() {
    setSearch('');
    setStatusFilter([]);
    setPriorityFilter([]);
    resetAdvisorFilter();
    setCalendarDate(undefined);
    setListPage(1);
  }

  function isOverdue(dueDate: string, status: ActivityStatus) {
    if (status === 'completada') return false;
    const day = taskDueDay(dueDate);
    if (!day) return false;
    return isBefore(day, startOfDay(new Date()));
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
      status: a.status,
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

  function handleKanbanStatusChange(taskId: string, next: ActivityStatus) {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task || task.status === next) return;
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
      payload.completedAt = new Date().toISOString().slice(0, 10);
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
      payload.completedAt = new Date().toISOString().slice(0, 10);
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

  function handleTaskFormSave(data: TaskFormResult): void {
    const contactAssoc = data.associations?.find((a) => a.type === 'contacto');
    const negocioAssoc = data.associations?.find((a) => a.type === 'negocio');
    const empresaAssoc = data.associations?.find((a) => a.type === 'empresa');
    const companyId = empresaAssoc?.id && /^c[a-z0-9]+$/i.test(empresaAssoc.id) ? empresaAssoc.id : undefined;

    if (!contactAssoc && !companyId && !negocioAssoc) {
      toast.error('Debes vincular la tarea a un contacto, empresa u oportunidad');
      throw new Error('TASK_FORM_VALIDATION');
    }
    const payload: CreateActivityPayload = {
      type: 'tarea',
      taskKind: data.type,
      title: data.title,
      description: '',
      assignedTo: data.assignee,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate,
      startDate: data.startDate,
      startTime: data.startTime,
      ...(data.status === 'completada'
        ? { completedAt: new Date().toISOString().slice(0, 10) }
        : {}),
      contactId: contactAssoc?.id,
      companyId,
      opportunityId: negocioAssoc?.id,
    };
    const optimisticDisplay = {
      assigneeName: data.assigneeName,
      contactNameLine: contactLineFromTaskAssociations(data.associations),
    };
    void createActivity(payload, optimisticDisplay).catch((e) => {
      toast.error(e instanceof Error ? e.message : 'Error al crear tarea');
    });
  }

  const openNewTask = useCallback(() => {
    setNewTaskColumnStatus(undefined);
    setNewTaskDefaultAssociations(undefined);
    setNewTaskOpen(true);
  }, []);

  return (
    <TooltipProvider>
      <div className={viewMode === 'kanban' ? 'flex h-full min-h-0 min-w-0 flex-col gap-5' : 'min-w-0 max-w-full space-y-6'}>
      <PageHeader title="Tareas">
        {viewMode === 'kanban' ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 p-0.5">
              <button
                className="rounded-md px-3 py-1.5 text-sm font-medium text-[#647789] dark:text-gray-400 hover:text-[#1f2933] dark:hover:text-gray-100 transition-colors cursor-pointer"
                onClick={() => setViewMode('list')}
              >
                Lista
              </button>
              <button className="rounded-md px-3 py-1.5 text-sm font-medium bg-[#e8f5e9] dark:bg-green-900/30 text-[#13944C] dark:text-green-400">
                Kanban
              </button>
            </div>
            <div className="relative w-full min-w-0 max-w-[400px]">
              <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-[#8a9aab] dark:text-gray-400" />
              <Input
                placeholder="Buscar tareas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="!h-12 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 pl-10 text-[15px] text-black placeholder:text-[#8a9aab] dark:placeholder:text-gray-400 transition-colors hover:border-primary focus-visible:ring-1 shadow-none"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button className="!h-12 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 px-3 text-sm font-medium text-[#647789] dark:text-gray-400 hover:border-primary transition-colors shadow-none cursor-pointer flex items-center gap-1.5 whitespace-nowrap">
                  <CalendarSvgIcon className="size-5" />
                  Calendario
                </button>
              </PopoverTrigger>
              <PopoverContent className={cn(comercialProPopoverClass, "w-auto p-4")} align="end" sideOffset={8}>
                <Calendar
                  mode="single"
                  selected={calendarDate}
                  onSelect={setCalendarDate}
                  className="mx-auto"
                  {...calendarTaskProps}
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1f2933] dark:text-gray-100 transition-opacity hover:opacity-70 cursor-pointer whitespace-nowrap">
                  <FilterSvgIcon className="size-[18px]" />
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
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      TASK_VIEW_TOGGLE_BTN,
                      'inline-flex items-center gap-1.5',
                      calendarDate
                        ? TASK_VIEW_TOGGLE_ACTIVE
                        : TASK_VIEW_TOGGLE_INACTIVE,
                    )}
                  >
                    <CalendarSvgIcon className="size-4" />
                    Calendario
                  </button>
                </PopoverTrigger>
                <PopoverContent className={cn(comercialProPopoverClass, 'w-auto p-4')} align="end" sideOffset={8}>
                  <Calendar
                    mode="single"
                    selected={calendarDate}
                    onSelect={setCalendarDate}
                    className="mx-auto"
                    {...calendarTaskProps}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {activitiesLoading && (
              <span className="text-sm text-muted-foreground">Cargando…</span>
            )}
            <Button
              onClick={openNewTask}
              disabled={activitiesLoading}
              className="h-9 w-[110px] text-sm font-normal shadow-md"
            >
              <Plus /> Nueva
            </Button>
          </div>
        )}
      </PageHeader>

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
                onCompleteToggle={handleTaskToggle}
                onEdit={(t) => {
                  setSelectedTaskDetail(t);
                  setTaskDetailOpen(true);
                }}
                onDelete={requestDeleteTask}
                formatDueDate={formatDueDate}
                isOverdue={isOverdue}
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
                    <table className="w-full table-fixed" style={{ minWidth: 1040 }}>
                      <colgroup>
                        <col style={comercialTableFixedColStyle('select')} />
                        <col style={comercialTableFixedColStyle('actions')} />
                        <col style={{ width: 44 }} />
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '17%' }} />
                        <col style={{ width: '17%' }} />
                        <col style={{ width: '17%' }} />
                        <col style={{ width: 104 }} />
                        <col style={{ width: 96 }} />
                        <col style={{ width: 140 }} />
                        <col style={{ width: 110 }} />
                      </colgroup>
                      <thead>
                        <tr className={cn('h-[36px] text-left', crmTableHeaderRowClassSticky)}>
                          <th className={comercialTableLeadingCellClass('select')} />
                          <th className={comercialTableLeadingCellClass('actions')} />
                          <th className={comercialTableLeadingCellClass('type', { extra: 'text-center' })}>
                            Tipo
                          </th>
                          <th className={comercialTableLeadingCellClass('titulo', { primaryColumnId: 'titulo' })}>
                            Título
                          </th>
                          <th className={cn(comercialTableLeadingCellClass('contacto'), taskTableResponsiveClass('contacto'))}>
                            Contacto
                          </th>
                          <th className={cn(comercialTableLeadingCellClass('empresa'), taskTableResponsiveClass('empresa'))}>
                            Empresa
                          </th>
                          <th className={cn(comercialTableLeadingCellClass('oportunidad'), taskTableResponsiveClass('oportunidad'))}>
                            Oportunidad
                          </th>
                          <th className={cn(comercialTableLeadingCellClass('prioridad'), taskTableResponsiveClass('prioridad'))}>
                            Prioridad
                          </th>
                          <th className={cn(comercialTableLeadingCellClass('asignado'), taskTableResponsiveClass('asignado'))}>
                            Asignado
                          </th>
                          <th className={cn(comercialTableLeadingCellClass('fecha'), taskTableResponsiveClass('fecha'))}>
                            Fecha
                          </th>
                          <th className={comercialTableLeadingCellClass('estado')}>
                            Estado
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTasks.map((task) => {
                          const taskType: TaskKind =
                            task.taskKind && TASK_KINDS.includes(task.taskKind)
                              ? task.taskKind
                              : 'llamada';
                          const TypeIcon = taskKindIcons[taskType];
                          const overdue = isOverdue(task.dueDate, task.status);
                          const taskPriority: ContactPriority = task.priority ?? 'media';

                          return (
                            <tr
                              key={task.id}
                              className={cn(
                                'h-[48px] last:border-b-0',
                                crmTableBodyRowClassInteractive,
                                overdue && 'bg-red-50/30 dark:bg-red-950/20',
                                task.status === 'completada' && 'opacity-75',
                              )}
                              onClick={() => {
                                setSelectedTaskDetail(task);
                                setTaskDetailOpen(true);
                              }}
                            >
                              <td
                                className={comercialTableLeadingCellClass('select')}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className={comercialTableCheckboxWrapClass}>
                                  <Checkbox
                                    checked={task.status === 'completada'}
                                    onCheckedChange={() => handleTaskToggle(task.id)}
                                    className={CRM_TABLE_CHECKBOX_CLASS}
                                  />
                                </div>
                              </td>
                              <td
                                className={comercialTableLeadingCellClass('actions')}
                                onClick={(e) => e.stopPropagation()}
                              >
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
                              </td>
                              <td className={comercialTableLeadingCellClass('type', { extra: 'text-center' })}>
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
                              </td>
                              <td className={comercialTableLeadingCellClass('titulo', { primaryColumnId: 'titulo' })}>
                                <span
                                  className={cn(
                                    'block truncate text-[13px] font-semibold text-[#0F172A] dark:text-gray-100',
                                    task.status === 'completada' && 'line-through text-muted-foreground',
                                  )}
                                  title={task.title}
                                >
                                  {task.title}
                                </span>
                              </td>
                              <td className={cn(comercialTableLeadingCellClass('contacto'), taskTableResponsiveClass('contacto'))}>
                                {task.contactName ? (
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
                                ) : (
                                  <span className={CRM_CELL_EMPTY}>—</span>
                                )}
                              </td>
                              <td className={cn(comercialTableLeadingCellClass('empresa'), taskTableResponsiveClass('empresa'))}>
                                {task.companyName ? (
                                  <span className={cn('block truncate', CRM_CELL_MUTED)} title={task.companyName}>
                                    {task.companyName}
                                  </span>
                                ) : (
                                  <span className={CRM_CELL_EMPTY}>—</span>
                                )}
                              </td>
                              <td className={cn(comercialTableLeadingCellClass('oportunidad'), taskTableResponsiveClass('oportunidad'))}>
                                {task.opportunityTitle ? (
                                  <span className={cn('block truncate', CRM_CELL_MUTED)} title={task.opportunityTitle}>
                                    {task.opportunityTitle}
                                  </span>
                                ) : (
                                  <span className={CRM_CELL_EMPTY}>—</span>
                                )}
                              </td>
                              <td className={cn(comercialTableLeadingCellClass('prioridad'), taskTableResponsiveClass('prioridad'))}>
                                <Badge
                                  variant="outline"
                                  className={cn('border-0 text-xs font-medium', taskPriorityBadgeClass[taskPriority])}
                                >
                                  {priorityLabels[taskPriority]}
                                </Badge>
                              </td>
                              <td className={cn(comercialTableLeadingCellClass('asignado'), taskTableResponsiveClass('asignado'))}>
                                <span className={cn('block truncate', CRM_CELL_MUTED)} title={task.assignedToName}>
                                  {task.assignedToName?.split(' ')[0] ?? '—'}
                                </span>
                              </td>
                              <td className={cn(comercialTableLeadingCellClass('fecha'), taskTableResponsiveClass('fecha'))}>
                                <span
                                  className={cn(
                                    'flex flex-col gap-0.5 whitespace-nowrap text-[13px] leading-tight',
                                    CRM_CELL_MUTED,
                                    overdue && 'font-semibold text-red-600 dark:text-red-400',
                                  )}
                                >
                                  <span className="flex items-center gap-1">
                                    {formatDueDate(task.dueDate, task.startTime)}
                                    {overdue && <AlertTriangle className="size-3.5 shrink-0 text-red-500" />}
                                  </span>
                                  {task.startDate && (
                                    <span className="text-[11px] text-muted-foreground/80">
                                      Inicio: {formatDueDate(task.startDate)}
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className={comercialTableLeadingCellClass('estado')}>
                                <TaskStatusBadge status={task.status} />
                              </td>
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
            const payload: UpdateActivityPayload = {};
            if (nd.title !== oldDetail.title) payload.title = nd.title;
            if (nd.status !== oldDetail.status) {
              payload.status = nd.status;
              if (nd.status === 'completada') {
                payload.completedAt = new Date().toISOString().slice(0, 10);
              }
            }
            if (nd.type !== oldDetail.type) payload.taskKind = nd.type;
            if (nd.dueDate !== oldDetail.dueDate) payload.dueDate = nd.dueDate;
            if (nd.startDate !== oldDetail.startDate) payload.startDate = nd.startDate;
            if (nd.startTime !== oldDetail.startTime) payload.startTime = nd.startTime;
            if ((nd.priority ?? 'media') !== (oldDetail.priority ?? 'media')) {
              payload.priority = nd.priority ?? 'media';
            }
            if (Object.keys(payload).length === 0) continue;
            try {
              const updated = await updateActivity(nd.id, payload);
              setSelectedTaskDetail((prev) => (prev?.id === updated.id ? updated : prev));
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Error al actualizar');
            }
          }
        }}
        taskComments={taskComments}
        onTaskCommentsChange={setTaskComments}
        contacts={crmContacts}
        companies={taskFormCompanies}
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
            onSave={(data) => {
              if (!completedTask) return;
              const t = completedTask;
              const summary = data.description?.trim() || '';
              const payload: UpdateActivityPayload = {
                status: 'completada',
                completedAt: new Date().toISOString().slice(0, 10),
              };
              if (summary) payload.description = summary;
              setLinkPromptSourceActivity(t);
              setTaskCompletionPreviewId(null);
              setActivityFromTaskOpen(false);
              setLinkedTaskPromptOpen(true);
              void updateActivity(t.id, payload).catch((e) => {
                toast.error(
                  e instanceof Error ? e.message : 'Error al guardar la actividad; el estado se revirtió.',
                );
              });
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
        contacts={crmContacts}
        companies={taskFormCompanies}
        opportunities={crmOpportunities}
        defaultTitle={newTaskDefaultTitle}
        defaultStatus={newTaskColumnStatus}
        defaultAssociations={newTaskDefaultAssociations}
        onSave={handleTaskFormSave}
        optimisticClose
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
