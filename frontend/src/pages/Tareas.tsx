import { useState, useMemo, type ComponentProps } from 'react';
import { useCrmTeamAdvisorFilter } from '@/hooks/useCrmTeamAdvisorFilter';
import { toast } from 'sonner';
import {
  Plus, Search, X, MoreHorizontal, Phone, Users,
  CheckSquare, Mail, Clock, MessageCircle,
  CalendarDays, CalendarCheck, AlertTriangle,
  RefreshCw, Check, Pencil, Trash2,
} from 'lucide-react';
import type { Activity, ActivityType, ActivityStatus, TaskKind } from '@/types';
import { TASK_KINDS } from '@/types';
import type { UpdateActivityPayload } from '@/lib/activityApi';
import { contacts, priorityLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { useActivities } from '@/hooks/useActivities';
import {
  format, isBefore, startOfDay, addDays, isWithinInterval, isSameDay,
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
import { TaskFormDialog } from '@/components/shared/TaskFormDialog';
import type { TaskFormResult } from '@/components/shared/TaskFormDialog';
import { opportunities } from '@/data/mock';

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
  const [advisorFilter, setAdvisorFilter] = useState('todos');
  const { canSeeAllAdvisors, currentUserId } = useCrmTeamAdvisorFilter(
    advisorFilter,
    setAdvisorFilter,
    'todos',
  );
  const [activeTab, setActiveTab] = useState('todas');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [completedTask, setCompletedTask] = useState<Activity | null>(null);
  const [activityFromTaskOpen, setActivityFromTaskOpen] = useState(false);
  const [linkedTaskPromptOpen, setLinkedTaskPromptOpen] = useState(false);
  const [newTaskDefaultTitle, setNewTaskDefaultTitle] = useState('');
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<Activity | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [taskComments, setTaskComments] = useState<TaskDetailComment[]>([]);

  const stats = useMemo(() => {
    const total = allTasks.length;
    const pendientes = allTasks.filter((a) => a.status === 'pendiente').length;
    const completadas = allTasks.filter((a) => a.status === 'completada').length;
    const vencidas = allTasks.filter((a) => a.status === 'vencida').length;
    const enProgreso = allTasks.filter((a) => a.status === 'en_progreso').length;
    return { total, pendientes, completadas, vencidas, enProgreso };
  }, [allTasks]);

  const filteredTasks = useMemo(() => {
    return allTasks.filter((task) => {
      const matchesSearch =
        !search ||
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.description.toLowerCase().includes(search.toLowerCase()) ||
        (task.contactName?.toLowerCase().includes(search.toLowerCase()) ?? false);

      const matchesTab = activeTab === 'todas' || task.status === activeTab;
      const matchesStatus = statusFilter === 'todos' || task.status === statusFilter;
      const matchesAdvisor = advisorFilter === 'todos' || task.assignedTo === advisorFilter;
      const matchesCalendarDate = !calendarDate || isSameDay(taskDueDay(task.dueDate), calendarDate);

      return matchesSearch && matchesTab && matchesStatus && matchesAdvisor && matchesCalendarDate;
    });
  }, [allTasks, search, activeTab, statusFilter, advisorFilter, calendarDate]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { todas: allTasks.length };
    for (const a of allTasks) {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    }
    return counts;
  }, [allTasks]);

  const selectedDateTasks = useMemo(() => {
    const targetDate = startOfDay(calendarDate ?? new Date());
    return allTasks.filter((a) => isSameDay(taskDueDay(a.dueDate), targetDate));
  }, [allTasks, calendarDate]);

  const taskDateCounts = useMemo(
    () =>
      allTasks.reduce((map, task) => {
        const key = format(taskDueDay(task.dueDate), 'yyyy-MM-dd');
        map.set(key, (map.get(key) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    [allTasks],
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

  const upcomingTasks = useMemo(() => {
    const today = startOfDay(new Date());
    const threeDaysLater = addDays(today, 3);
    return allTasks.filter((a) => {
      const due = startOfDay(new Date(a.dueDate));
      return isWithinInterval(due, { start: addDays(today, 1), end: threeDaysLater }) &&
        a.status !== 'completada';
    });
  }, [allTasks]);

  const advisorFilterIsActive = canSeeAllAdvisors
    ? advisorFilter !== 'todos'
    : false;
  const hasActiveFilters =
    statusFilter !== 'todos' || advisorFilterIsActive || search !== '' || Boolean(calendarDate);

  function clearFilters() {
    setSearch('');
    setStatusFilter('todos');
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
    const associations = a.contactName && a.contactId
      ? [{ type: 'contacto' as const, id: a.contactId, name: a.contactName }]
      : undefined;
    const company = a.contactName?.includes(' - ') ? a.contactName.split(' - ')[1] : undefined;
    return {
      id: a.id,
      title: a.title,
      status: a.status,
      type: kind,
      priority: 'media',
      company,
      dueDate: a.dueDate,
      startDate: a.startDate,
      startTime: a.startTime,
      assignee: a.assignedToName,
      associations,
      description: a.description,
    };
  }

  const tareasStatusLabels: Record<string, string> = Object.fromEntries(
    Object.entries(activityStatusConfig).map(([k, v]) => [k, v.label]),
  );
  const tareasStatusColors: Record<string, string> = Object.fromEntries(
    Object.entries(activityStatusConfig).map(([k, v]) => [k, v.className]),
  );

  const companiesFromContacts = useMemo(() => {
    const seen = new Set<string>();
    return contacts.flatMap((c) =>
      c.companies
        .filter((co) => co.name && !seen.has(co.name))
        .map((co) => {
          seen.add(co.name);
          return { name: co.name };
        }),
    );
  }, []);

  async function handleTaskToggle(taskId: string) {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'completada' ? 'pendiente' : 'completada';
    try {
      const payload: { status: string; completedAt?: string } = { status: newStatus };
      if (newStatus === 'completada') {
        payload.completedAt = new Date().toISOString().slice(0, 10);
      }
      await updateActivity(taskId, payload);
      toast.success(newStatus === 'completada' ? 'Tarea completada' : 'Tarea reactivada');
      if (
        newStatus === 'completada' &&
        task.taskKind &&
        TASK_KINDS.includes(task.taskKind)
      ) {
        setCompletedTask({ ...task, status: 'completada' });
        setActivityFromTaskOpen(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar tarea');
    }
  }

  function handleReschedule(id: string) {
    toast.info(`Reprogramando tarea "${allTasks.find((a) => a.id === id)?.title}"`);
  }

  async function handleDelete(id: string) {
    const title = allTasks.find((a) => a.id === id)?.title;
    try {
      await deleteActivity(id);
      toast.success(`Tarea "${title}" eliminada`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar tarea');
    }
  }

  async function handleTaskFormSave(data: TaskFormResult): Promise<void> {
    const contactAssoc = data.associations?.find((a) => a.type === 'contacto');
    const negocioAssoc = data.associations?.find((a) => a.type === 'negocio');
    const empresaAssoc = data.associations?.find((a) => a.type === 'empresa');
    const companyId = empresaAssoc?.id && /^c[a-z0-9]+$/i.test(empresaAssoc.id) ? empresaAssoc.id : undefined;

    if (!contactAssoc && !companyId && !negocioAssoc) {
      toast.error('Debes vincular la tarea a un contacto, empresa u oportunidad');
      return;
    }
    try {
      await createActivity({
        type: 'tarea',
        taskKind: data.type,
        title: data.title,
        description: '',
        assignedTo: data.assignee,
        dueDate: data.dueDate,
        startDate: data.startDate,
        startTime: data.startTime,
        contactId: contactAssoc?.id,
        companyId,
        opportunityId: negocioAssoc?.id,
      });
      setNewTaskOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear tarea');
      throw e;
    }
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
      <div className="space-y-6">
      <PageHeader title="Tareas" description="Gestiona tus tareas pendientes">
        <div className="flex items-center gap-2">
          {activitiesLoading && (
            <span className="text-sm text-muted-foreground">Cargando…</span>
          )}
          <Button onClick={() => setNewTaskOpen(true)} disabled={activitiesLoading}>
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statsCards.map((stat) => {
          const StatIcon = stat.icon;
          return (
            <Card key={stat.label} className={cn('border py-0', stat.className)}>
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
      <div className="flex gap-6">
        {/* Task list */}
        <div className="min-w-0 flex-1">
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
                  onAction={() => setNewTaskOpen(true)}
                />
              ) : (
                <Card>
                  <Table className="table-fixed w-full min-w-0">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead className="w-11 text-center text-muted-foreground">
                          Tipo
                        </TableHead>
                        <TableHead className="min-w-0 text-muted-foreground">Título</TableHead>
                        <TableHead className="hidden w-[92px] sm:table-cell text-muted-foreground">
                          Prioridad
                        </TableHead>
                        <TableHead className="hidden min-w-[88px] md:table-cell text-muted-foreground">
                          Asignado
                        </TableHead>
                        <TableHead className="hidden w-[120px] lg:table-cell text-muted-foreground">
                          Fecha
                        </TableHead>
                        <TableHead className="w-[104px] text-right text-muted-foreground">Estado</TableHead>
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
                        const taskPriority = 'media' as const;

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
                            <TableCell className="min-w-0 align-middle font-medium">
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
                            <TableCell className="hidden align-middle sm:table-cell">
                              <Badge
                                variant="outline"
                                className={cn('border-0 text-xs font-medium', taskPriorityBadgeClass[taskPriority])}
                              >
                                {priorityLabels[taskPriority]}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden min-w-0 align-middle md:table-cell text-muted-foreground">
                              <span className="block truncate text-sm" title={task.assignedToName}>
                                {task.assignedToName}
                              </span>
                            </TableCell>
                            <TableCell className="hidden align-middle text-sm text-muted-foreground lg:table-cell">
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
                                  <DropdownMenuItem onClick={() => handleReschedule(task.id)}>
                                    <RefreshCw /> Reprogramar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedTaskDetail(task); setTaskDetailOpen(true); }}>
                                    <Pencil /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onClick={() => handleDelete(task.id)}>
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

            <Card>
              <CardContent className="p-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <CalendarDays className="size-4 text-[#13944C]" />
                  {calendarDate ? 'Día seleccionado' : 'Hoy'}
                </h3>
                {selectedDateTasks.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {calendarDate ? 'No hay tareas para esa fecha.' : 'No hay tareas para hoy.'}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {selectedDateTasks.map((t) => {
                      const kind = (t.taskKind && TASK_KINDS.includes(t.taskKind)
                        ? t.taskKind
                        : 'llamada') as TaskKind;
                      const Icon = activityIcons[kind];
                      const circle = activityTypeIconCircleClass(kind);
                      return (
                        <div key={t.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                          <div
                            className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                              ACTIVITY_ICON_INHERIT,
                              circle ??
                                'bg-muted text-muted-foreground [&_svg]:text-muted-foreground',
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{t.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{t.assignedToName}</p>
                          </div>
                          <TaskStatusBadge status={t.status} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Clock className="size-4 text-blue-600" />
                  Próximos 3 días
                </h3>
                {upcomingTasks.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No hay tareas próximas.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {upcomingTasks.map((t) => {
                      const kind = (t.taskKind && TASK_KINDS.includes(t.taskKind)
                        ? t.taskKind
                        : 'llamada') as TaskKind;
                      const Icon = activityIcons[kind];
                      const circle = activityTypeIconCircleClass(kind);
                      return (
                        <div key={t.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                          <div
                            className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                              ACTIVITY_ICON_INHERIT,
                              circle ??
                                'bg-muted text-muted-foreground [&_svg]:text-muted-foreground',
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{t.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {format(new Date(t.dueDate), "d MMM", { locale: es })} · {t.assignedToName}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
              {sidebarOpen ? 'Ocultar calendario' : 'Ver calendario y agenda'}
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

            <Card>
              <CardContent className="p-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <CalendarDays className="size-4 text-[#13944C]" />
                  {calendarDate ? 'Tareas del día seleccionado' : 'Tareas de hoy'}
                </h3>
                {selectedDateTasks.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {calendarDate ? 'No hay tareas para esa fecha.' : 'No hay tareas para hoy.'}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {selectedDateTasks.map((t) => {
                      const kind = (t.taskKind && TASK_KINDS.includes(t.taskKind)
                        ? t.taskKind
                        : 'llamada') as TaskKind;
                      const Icon = activityIcons[kind];
                      const circle = activityTypeIconCircleClass(kind);
                      return (
                        <div key={t.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                          <div
                            className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                              ACTIVITY_ICON_INHERIT,
                              circle ??
                                'bg-muted text-muted-foreground [&_svg]:text-muted-foreground',
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{t.title}</p>
                          </div>
                          <TaskStatusBadge status={t.status} />
                        </div>
                      );
                    })}
                  </div>
                )}
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
        task={selectedTaskDetail ? activityToTaskDetail(selectedTaskDetail) : null}
        statusLabels={tareasStatusLabels}
        statusColors={tareasStatusColors}
        tasks={allTasks.map(activityToTaskDetail)}
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
            if (Object.keys(payload).length === 0) continue;
            try {
              await updateActivity(nd.id, payload);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Error al actualizar');
            }
          }
        }}
        taskComments={taskComments}
        onTaskCommentsChange={setTaskComments}
        contacts={contacts}
        companies={companiesFromContacts}
        opportunities={opportunities}
        onCompleteWithActivity={(t) => {
          const act = allTasks.find((a) => a.id === t.id);
          if (act) {
            setCompletedTask(act);
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
              if (!open) setCompletedTask(null);
            }}
            onSave={async (data) => {
              const summary = data.description?.trim() || '';
              if (summary && completedTask) {
                try {
                  await updateActivity(completedTask.id, { description: summary });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Error al guardar');
                }
              }
              setActivityFromTaskOpen(false);
              setLinkedTaskPromptOpen(true);
            }}
            taskSummary={{
              title: completedTask.title,
              assignee: completedTask.assignedToName,
              dueDate: completedTask.dueDate,
            }}
            defaultTitle={completedTask.title}
            defaultDate={completedTask.dueDate}
            defaultTime={completedTask.startTime}
            showSkip
          />
        )}

      {/* Prompt crear tarea vinculada */}
      <Dialog
        open={linkedTaskPromptOpen}
        onOpenChange={(open) => {
          setLinkedTaskPromptOpen(open);
          if (!open) setCompletedTask(null);
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
              }}
            >
              No, gracias
            </Button>
            <Button
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              onClick={() => {
                setLinkedTaskPromptOpen(false);
                setNewTaskDefaultTitle(`Seguimiento: ${completedTask?.title ?? ''}`);
                setCompletedTask(null);
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
          if (!open) setNewTaskDefaultTitle('');
        }}
        title="Nueva Tarea"
        description="Crea una nueva tarea."
        contacts={contacts}
        companies={companiesFromContacts}
        opportunities={opportunities}
        defaultTitle={newTaskDefaultTitle}
        onSave={handleTaskFormSave}
      />
      </div>
    </TooltipProvider>
  );
}
