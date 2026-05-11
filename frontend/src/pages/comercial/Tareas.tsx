import { useState, useMemo, useEffect, useCallback, type ComponentProps } from 'react';
import { useCrmTeamAdvisorFilter } from '@/hooks/useCrmTeamAdvisorFilter';
import { toast } from 'sonner';
import {
  Plus, Search, X, MoreHorizontal, Phone, Users,
  CheckSquare, Mail, Clock, MessageCircle,
  CalendarDays, CalendarCheck, AlertTriangle,
  RefreshCw, Check, Pencil, Trash2, Building2,
  List, Grid3X3,
} from 'lucide-react';
import type {
  Activity, ActivityType, ActivityStatus, TaskKind, ContactPriority, TaskAssociation,
  Contact, Opportunity,
} from '@/types';
import { TasksKanbanBoard } from '@/components/tasks/TasksKanbanBoard';
import { TASK_KINDS } from '@/types';
import type { CreateActivityPayload, UpdateActivityPayload } from '@/lib/activityApi';
import { priorityLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { useActivities } from '@/hooks/useActivities';
import {
  format, isBefore, startOfDay, isSameDay,
} from 'date-fns';
import { es } from 'date-fns/locale';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  activityTypeIconCircleClass,
  ACTIVITY_ICON_INHERIT,
} from '@/lib/activityTypeCircleStyles';
import { ActivityFormDialog } from '@/components/shared/ActivityFormDialog';
import {
  TaskDetailDialog,
  type TaskDetailTask,
  type TaskComment as TaskDetailComment,
} from '@/components/shared/TaskDetailDialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TaskFormDialog } from '@/components/shared/TaskFormDialog';
import type { TaskFormResult } from '@/components/shared/TaskFormDialog';
import { contactListAll, mapApiContactRowToContact } from '@/lib/contactApi';
import { companyListAll } from '@/lib/companyApi';
import { opportunityListAll, mapApiOpportunityToOpportunity } from '@/lib/opportunityApi';
import { formatTodayPeruYmd } from '@/lib/formatters';
import {
  contactLineFromTaskAssociations,
  taskAssociationsFromActivity,
  taskLinkBadgesFromActivity,
} from '@/lib/taskAssociationsFromActivity';

const activityIcons: Record<ActivityType, typeof Phone> = {
  llamada: Phone,
  reunion: Users,
  tarea: CheckSquare,
  correo: Mail,
  whatsapp: MessageCircle,
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
  pendiente: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  completada: { label: 'Completada', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  en_progreso: { label: 'En progreso', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  vencida: { label: 'Vencida', className: 'bg-red-100 text-red-700 border-red-200' },
};

const statusTabs = [
  { value: 'todas', label: 'Todas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'completada', label: 'Completadas' },
  { value: 'en_progreso', label: 'En progreso' },
  { value: 'vencida', label: 'Vencidas' },
];

function TaskStatusBadge({ status }: { status: ActivityStatus }) {
  const config = activityStatusConfig[status];
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}

function isTaskRow(a: Activity): boolean {
  return (
    a.type === 'tarea' &&
    !!a.taskKind &&
    TASK_KINDS.includes(a.taskKind)
  );
}

function taskDueDay(dueDate: string): Date {
  return startOfDay(new Date(`${dueDate}T00:00:00`));
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
  const { activeAdvisors } = useUsers();
  const {
    activities,
    loading: activitiesLoading,
    error: activitiesError,
    createActivity,
    updateActivity,
    deleteActivity,
    refresh: refreshActivities,
  } = useActivities();

  const allTasks = useMemo(
    () => activities.filter(isTaskRow),
    [activities],
  );

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [priorityFilter, setPriorityFilter] = useState<'todas' | ContactPriority>('todas');
  const [advisorFilter, setAdvisorFilter] = useState('todos');
  const { canSeeAllAdvisors, currentUserId } = useCrmTeamAdvisorFilter(
    advisorFilter,
    setAdvisorFilter,
    'todos',
  );
  const [activeTab, setActiveTab] = useState('todas');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskColumnStatus, setNewTaskColumnStatus] = useState<ActivityStatus | undefined>();
  const [calendarDate, setCalendarDate] = useState<Date | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const stats = useMemo(() => {
    const total = allTasksForDisplay.length;
    const pendientes = allTasksForDisplay.filter((a) => a.status === 'pendiente').length;
    const completadas = allTasksForDisplay.filter((a) => a.status === 'completada').length;
    const vencidas = allTasksForDisplay.filter((a) => a.status === 'vencida').length;
    const enProgreso = allTasksForDisplay.filter((a) => a.status === 'en_progreso').length;
    return { total, pendientes, completadas, vencidas, enProgreso };
  }, [allTasksForDisplay]);

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

      const matchesTab = activeTab === 'todas' || task.status === activeTab;
      const matchesStatus = statusFilter === 'todos' || task.status === statusFilter;
      const taskPriority = task.priority ?? 'media';
      const matchesPriority =
        priorityFilter === 'todas' || taskPriority === priorityFilter;
      const matchesAdvisor = advisorFilter === 'todos' || task.assignedTo === advisorFilter;
      const matchesCalendarDate = !calendarDate || isSameDay(taskDueDay(task.dueDate), calendarDate);

      return (
        matchesSearch &&
        matchesTab &&
        matchesStatus &&
        matchesPriority &&
        matchesAdvisor &&
        matchesCalendarDate
      );
    });
  }, [allTasksForDisplay, search, activeTab, statusFilter, priorityFilter, advisorFilter, calendarDate]);

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
      const matchesStatus = statusFilter === 'todos' || task.status === statusFilter;
      const taskPriority = task.priority ?? 'media';
      const matchesPriority =
        priorityFilter === 'todas' || taskPriority === priorityFilter;
      const matchesAdvisor = advisorFilter === 'todos' || task.assignedTo === advisorFilter;
      const matchesCalendarDate = !calendarDate || isSameDay(taskDueDay(task.dueDate), calendarDate);
      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesAdvisor &&
        matchesCalendarDate
      );
    });
  }, [allTasksForDisplay, search, statusFilter, priorityFilter, advisorFilter, calendarDate]);

  /** Lista actualizada del store (p. ej. PATCH optimista) para que el diálogo refleje el estado al instante. */
  const taskDetailActivity = useMemo(() => {
    if (!selectedTaskDetail) return null;
    return allTasksForDisplay.find((a) => a.id === selectedTaskDetail.id) ?? selectedTaskDetail;
  }, [selectedTaskDetail, allTasksForDisplay]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { todas: allTasksForDisplay.length };
    for (const a of allTasksForDisplay) {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    }
    return counts;
  }, [allTasksForDisplay]);

  const taskDateCounts = useMemo(
    () =>
      allTasksForDisplay.reduce((map, task) => {
        const key = format(taskDueDay(task.dueDate), 'yyyy-MM-dd');
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

  const advisorFilterIsActive = canSeeAllAdvisors
    ? advisorFilter !== 'todos'
    : false;
  const hasActiveFilters =
    statusFilter !== 'todos' ||
    priorityFilter !== 'todas' ||
    advisorFilterIsActive ||
    search !== '' ||
    Boolean(calendarDate);

  function clearFilters() {
    setSearch('');
    setStatusFilter('todos');
    setPriorityFilter('todas');
    setAdvisorFilter(canSeeAllAdvisors ? 'todos' : currentUserId);
    setCalendarDate(undefined);
  }

  function isOverdue(dueDate: string, status: ActivityStatus) {
    if (status === 'completada') return false;
    return isBefore(new Date(dueDate), startOfDay(new Date()));
  }

  const selectedDateLabel = format(
    calendarDate ?? new Date(),
    "d 'de' MMMM yyyy",
    { locale: es },
  );

  function formatDueDate(dueDate: string, startTime?: string) {
    const date = new Date(dueDate + 'T00:00:00');
    const dateStr = date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
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
  const taskFormCompanies = useMemo(() => {
    const list = crmCompanies.map((c) => ({ ...c }));
    const keys = new Set(
      list.map((c) => (c.id ? `id:${c.id}` : `n:${c.name}`)),
    );
    for (const a of newTaskDefaultAssociations ?? []) {
      if (a.type === 'empresa' && a.id) {
        const k = `id:${a.id}`;
        if (!keys.has(k)) {
          list.push({ id: a.id, name: a.name });
          keys.add(k);
        }
      }
    }
    return list;
  }, [crmCompanies, newTaskDefaultAssociations]);

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

  const statsCards = [
    {
      label: 'Total',
      value: stats.total,
      icon: CalendarDays,
      className:
        'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600/50 dark:bg-slate-800/60 dark:text-slate-100',
    },
    {
      label: 'Pendientes',
      value: stats.pendientes,
      icon: Clock,
      className:
        'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/45 dark:bg-amber-950/45 dark:text-amber-100',
    },
    {
      label: 'Completadas',
      value: stats.completadas,
      icon: CalendarCheck,
      className:
        'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/45 dark:bg-emerald-950/45 dark:text-emerald-100',
    },
    {
      label: 'En progreso',
      value: stats.enProgreso,
      icon: RefreshCw,
      className:
        'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/45 dark:bg-blue-950/45 dark:text-blue-100',
    },
    {
      label: 'Vencidas',
      value: stats.vencidas,
      icon: AlertTriangle,
      className:
        'border-red-200 bg-red-50 text-red-800 dark:border-red-800/45 dark:bg-red-950/45 dark:text-red-100',
    },
  ];

  return (
    <TooltipProvider>
      <div className="min-w-0 max-w-full space-y-6">
      <PageHeader title="Tareas">
        <div className="flex items-center gap-2">
          {activitiesLoading && (
            <span className="text-sm text-muted-foreground">Cargando…</span>
          )}
          <Button
            onClick={() => {
              setNewTaskColumnStatus(undefined);
              setNewTaskDefaultAssociations(undefined);
              setNewTaskOpen(true);
            }}
            disabled={activitiesLoading}
          >
            <Plus /> Nueva Tarea
          </Button>
        </div>
      </PageHeader>

      {activitiesError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {activitiesError}
          <Button variant="link" size="sm" className="ml-2 h-auto p-0" onClick={() => refreshActivities()}>
            Reintentar
          </Button>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:[grid-template-columns:repeat(5,minmax(0,1fr))]">
        {statsCards.map((stat) => {
          const StatIcon = stat.icon;
          return (
            <Card key={stat.label} className={cn('min-w-0 border py-0', stat.className)}>
              <CardContent className="flex items-center gap-3 px-4 py-3">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/90 shadow-sm ring-1 ring-black/[0.06] dark:bg-black/35 dark:ring-white/10"
                >
                  <StatIcon className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs font-medium opacity-90">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, descripción o contacto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {Object.entries(activityStatusConfig).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter(v as 'todas' | ContactPriority)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las prioridades</SelectItem>
              {(Object.keys(priorityLabels) as ContactPriority[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {priorityLabels[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={advisorFilter}
            onValueChange={setAdvisorFilter}
            disabled={!canSeeAllAdvisors}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Asesor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los asesores</SelectItem>
              {activeAdvisors.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" /> Limpiar
            </Button>
          )}

          <div className="ml-auto flex items-center rounded-md border" role="tablist" aria-label="Vista de tareas">
            <Button
              type="button"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setViewMode('list')}
              className="rounded-r-none"
              aria-label="Vista lista"
            >
              <List className="size-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setViewMode('kanban')}
              className="rounded-l-none"
              aria-label="Vista tablero"
            >
              <Grid3X3 className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {calendarDate && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4 text-[#13944C]" />
          <span>
            Mostrando tareas para <span className="font-medium text-foreground">{selectedDateLabel}</span>
          </span>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setCalendarDate(undefined)}>
            Ver todas
          </Button>
        </div>
      )}

      {/* Main content: list + sidebar */}
      <div className="flex min-h-0 min-w-0 max-w-full gap-6">
        {/* Task list / Kanban */}
        <div
          className={cn(
            'min-w-0 flex-1',
            viewMode === 'kanban' && 'flex min-h-0 w-full min-w-0 flex-col',
          )}
        >
          {viewMode === 'kanban' ? (
            tasksForKanban.length === 0 ? (
              <EmptyState
                icon={Grid3X3}
                title="No hay tareas para el tablero"
                description="Ajusta los filtros o crea una nueva tarea."
                actionLabel="Nueva Tarea"
                onAction={() => {
                  setNewTaskColumnStatus(undefined);
                  setNewTaskDefaultAssociations(undefined);
                  setNewTaskOpen(true);
                }}
              />
            ) : (
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
            )
          ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList
              variant="line"
              className="w-full flex-nowrap gap-1 p-0"
            >
              {statusTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="min-w-0 flex-1 basis-0 overflow-hidden px-1.5 sm:px-2"
                >
                  <span className="min-w-0 truncate">{tab.label}</span>
                  <Badge
                    variant="secondary"
                    className="ml-1 shrink-0 px-1.5 py-0 text-xs max-sm:ml-0.5 max-sm:px-1"
                  >
                    {statusCounts[tab.value] ?? 0}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {filteredTasks.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No se encontraron tareas"
                  description="Intenta ajustar los filtros o crea una nueva tarea."
                  actionLabel="Nueva Tarea"
                  onAction={() => {
                    setNewTaskDefaultAssociations(undefined);
                    setNewTaskOpen(true);
                  }}
                />
              ) : (
                <Card className="min-w-0 overflow-hidden">
                  <Table
                    className="table-fixed w-full min-w-[1040px]"
                    containerClassName="min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
                  >
                    <colgroup>
                      <col className="w-10" />
                      <col className="w-11" />
                      <col className="min-w-[12rem] w-[22%]" />
                      <col className="min-w-[11rem] w-[18%]" />
                      <col className="w-[104px]" />
                      <col className="w-[9.25rem]" />
                      <col className="w-[11.25rem]" />
                      <col className="w-[124px]" />
                      <col className="w-10" />
                    </colgroup>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead className="w-11 text-center text-muted-foreground">
                          Tipo
                        </TableHead>
                        <TableHead className="min-w-[12rem] whitespace-normal text-muted-foreground">
                          <span className="block hyphens-auto pr-1 leading-tight sm:whitespace-nowrap">Título</span>
                        </TableHead>
                        <TableHead className="hidden min-w-[11rem] whitespace-normal sm:table-cell text-muted-foreground">
                          <span className="block pr-1 leading-tight sm:whitespace-nowrap">Empresa</span>
                        </TableHead>
                        <TableHead className="hidden w-[104px] sm:table-cell px-2 text-muted-foreground">
                          Prioridad
                        </TableHead>
                        <TableHead className="hidden w-[9.25rem] md:table-cell px-2 text-muted-foreground">
                          Asignado
                        </TableHead>
                        <TableHead className="hidden w-[11.25rem] lg:table-cell px-2 text-muted-foreground">
                          Fecha
                        </TableHead>
                        <TableHead className="w-[124px] px-2 text-right text-muted-foreground">Estado</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTasks.map((task) => {
                        const taskType: TaskKind =
                          task.taskKind && TASK_KINDS.includes(task.taskKind)
                            ? task.taskKind
                            : 'llamada';
                        const TypeIcon = activityIcons[taskType];
                        const circle = activityTypeIconCircleClass(taskType);
                        const overdue = isOverdue(task.dueDate, task.status);
                        const taskPriority: ContactPriority = task.priority ?? 'media';
                        const companyLabel = activityCompanyDisplayName(task);

                        return (
                          <TableRow
                            key={task.id}
                            className={cn(
                              'cursor-pointer transition-colors hover:bg-muted/50',
                              overdue && 'bg-red-50/30 dark:bg-red-950/20',
                              task.status === 'completada' && 'opacity-75',
                            )}
                            onClick={() => {
                              setSelectedTaskDetail(task);
                              setTaskDetailOpen(true);
                            }}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={task.status === 'completada'}
                                onCheckedChange={() => handleTaskToggle(task.id)}
                              />
                            </TableCell>
                            <TableCell className="text-center align-middle">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className={cn(
                                      'mx-auto mt-0.5 flex h-7 w-7 cursor-default items-center justify-center rounded-full border-0 p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                                      ACTIVITY_ICON_INHERIT,
                                      circle ??
                                        'bg-muted text-muted-foreground [&_svg]:text-muted-foreground',
                                    )}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label={taskTypeLabels[taskType]}
                                  >
                                    <TypeIcon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">{taskTypeLabels[taskType]}</TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="min-w-[12rem] align-middle font-medium">
                              <span
                                className={cn(
                                  'block truncate',
                                  task.status === 'completada' && 'line-through text-muted-foreground',
                                )}
                                title={task.title}
                              >
                                {task.title}
                              </span>
                            </TableCell>
                            <TableCell className="hidden min-w-[11rem] align-middle sm:table-cell text-muted-foreground">
                              {companyLabel ? (
                                <span className="flex items-center gap-1.5" title={companyLabel}>
                                  <Building2 className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
                                  <span className="truncate text-sm">{companyLabel}</span>
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground/50">—</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden align-middle px-2 sm:table-cell">
                              <Badge
                                variant="outline"
                                className={cn('border-0 text-xs font-medium', taskPriorityBadgeClass[taskPriority])}
                              >
                                {priorityLabels[taskPriority]}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden min-w-0 max-w-[9.25rem] align-middle px-2 md:table-cell text-muted-foreground">
                              <span className="block truncate text-sm" title={task.assignedToName}>
                                {task.assignedToName}
                              </span>
                            </TableCell>
                            <TableCell className="hidden min-w-0 max-w-[11.25rem] align-middle px-2 text-sm text-muted-foreground lg:table-cell">
                              <span
                                className={cn(
                                  'flex flex-col gap-0.5 whitespace-nowrap leading-tight',
                                  overdue && 'font-semibold text-red-600 dark:text-red-400',
                                )}
                              >
                                <span className="flex items-center gap-1">
                                  {formatDueDate(task.dueDate, task.startTime)}
                                  {overdue && <AlertTriangle className="size-3.5 shrink-0 text-red-500" />}
                                </span>
                                {task.startDate && (
                                  <span className="text-xs text-muted-foreground/80">
                                    Inicio: {formatDueDate(task.startDate)}
                                  </span>
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="align-middle text-right">
                              <TaskStatusBadge status={task.status} />
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon-sm" className="h-8 w-8">
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
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
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>
          </Tabs>
          )}
        </div>

        {/* Calendar sidebar - desktop */}
        <aside className="hidden w-[320px] shrink-0 lg:block">
          <div className="sticky top-6 space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 text-center">
                  <p className="text-sm font-medium text-muted-foreground">
                    {format(calendarDate ?? new Date(), "EEEE", { locale: es })}
                  </p>
                  <p className="text-3xl font-bold text-[#13944C]">
                    {format(calendarDate ?? new Date(), 'd')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(calendarDate ?? new Date(), "MMMM yyyy", { locale: es })}
                  </p>
                </div>
                <Calendar
                  mode="single"
                  selected={calendarDate}
                  onSelect={setCalendarDate}
                  className="mx-auto"
                  {...calendarTaskProps}
                />
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>

      {/* Mobile calendar collapsible */}
      <div className="lg:hidden">
        <Collapsible open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full">
              <CalendarDays className="size-4" />
              {sidebarOpen ? 'Ocultar calendario' : 'Ver calendario'}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            <Card>
              <CardContent className="flex flex-col items-center p-4">
                <Calendar
                  mode="single"
                  selected={calendarDate}
                  onSelect={setCalendarDate}
                  {...calendarTaskProps}
                />
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
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
