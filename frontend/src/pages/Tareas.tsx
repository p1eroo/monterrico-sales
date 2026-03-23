import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Plus, Search, X, MoreHorizontal, Phone, Users,
  CheckSquare, Mail, Clock, MessageCircle,
  CalendarDays, CalendarCheck, AlertTriangle,
  RefreshCw, Check, Pencil, Trash2,
} from 'lucide-react';
import type { Activity, ActivityType, ActivityStatus } from '@/types';
import { contacts } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { useActivities } from '@/hooks/useActivities';
import {
  format, isBefore, startOfDay, addDays, isWithinInterval,
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
import { Calendar } from '@/components/ui/calendar';
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
import { cn } from '@/lib/utils';
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

const activityIconColors: Record<ActivityType, string> = {
  llamada: 'bg-blue-100 text-blue-600',
  reunion: 'bg-purple-100 text-purple-600',
  tarea: 'bg-emerald-100 text-emerald-600',
  correo: 'bg-amber-100 text-amber-600',
  whatsapp: 'bg-green-100 text-green-600',
};

/** Tipos de tarea mostrados en la columna Tipo: llamada, reunión, correo */
const taskTypeLabels: Record<'llamada' | 'reunion' | 'correo' | 'tarea', string> = {
  llamada: 'Llamada',
  reunion: 'Reunión',
  correo: 'Correo',
  tarea: 'Tarea',
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

const TASK_TYPES = ['tarea', 'llamada', 'reunion', 'correo'];

export default function TareasPage() {
  const { users } = useUsers();
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
    () => activities.filter((a) => TASK_TYPES.includes(a.type)),
    [activities],
  );

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [advisorFilter, setAdvisorFilter] = useState('todos');
  const [activeTab, setActiveTab] = useState('todas');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
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

      return matchesSearch && matchesTab && matchesStatus && matchesAdvisor;
    });
  }, [allTasks, search, activeTab, statusFilter, advisorFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { todas: allTasks.length };
    for (const a of allTasks) {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    }
    return counts;
  }, [allTasks]);

  const todayTasks = useMemo(() => {
    const today = startOfDay(new Date());
    return allTasks.filter((a) => {
      const due = startOfDay(new Date(a.dueDate));
      return due.getTime() === today.getTime();
    });
  }, [allTasks]);

  const upcomingTasks = useMemo(() => {
    const today = startOfDay(new Date());
    const threeDaysLater = addDays(today, 3);
    return allTasks.filter((a) => {
      const due = startOfDay(new Date(a.dueDate));
      return isWithinInterval(due, { start: addDays(today, 1), end: threeDaysLater }) &&
        a.status !== 'completada';
    });
  }, [allTasks]);

  const hasActiveFilters = statusFilter !== 'todos' || advisorFilter !== 'todos' || search !== '';

  function clearFilters() {
    setSearch('');
    setStatusFilter('todos');
    setAdvisorFilter('todos');
  }

  function isOverdue(dueDate: string, status: ActivityStatus) {
    if (status === 'completada') return false;
    return isBefore(new Date(dueDate), startOfDay(new Date()));
  }

  function formatDueDate(dueDate: string, startTime?: string) {
    const date = new Date(dueDate + 'T00:00:00');
    const dateStr = date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
    if (startTime) return `${dateStr} (${startTime})`;
    return dateStr;
  }

  function getCompanyFromContactName(contactName?: string): string | undefined {
    if (!contactName?.includes(' - ')) return undefined;
    return contactName.split(' - ')[1];
  }

  function getContactNameOnly(contactName?: string): string | undefined {
    if (!contactName) return undefined;
    return contactName.includes(' - ') ? contactName.split(' - ')[0] : contactName;
  }

  function activityToTaskDetail(a: Activity): TaskDetailTask {
    const type = ['llamada', 'reunion', 'correo', 'tarea'].includes(a.type) ? a.type : 'tarea';
    const associations = a.contactName && a.contactId
      ? [{ type: 'contacto' as const, id: a.contactId, name: a.contactName }]
      : undefined;
    const company = a.contactName?.includes(' - ') ? a.contactName.split(' - ')[1] : undefined;
    return {
      id: a.id,
      title: a.title,
      status: a.status,
      type: type as TaskDetailTask['type'],
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

  function taskDetailToActivity(t: TaskDetailTask): Activity {
    const contactName = t.associations?.find((a) => a.type === 'contacto')?.name;
    const contactId = t.associations?.find((a) => a.type === 'contacto')?.id;
    const type = (t.type ?? 'tarea') as Activity['type'];
    return {
      id: t.id,
      type,
      title: t.title,
      description: t.description ?? '',
      contactId,
      contactName,
      assignedTo: users.find((u) => u.name === t.assignee)?.id ?? '',
      assignedToName: t.assignee,
      status: t.status as ActivityStatus,
      dueDate: t.dueDate,
      startDate: t.startDate,
      startTime: t.startTime,
      createdAt: allTasks.find((a) => a.id === t.id)?.createdAt ?? new Date().toISOString().slice(0, 10),
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
      if (newStatus === 'completada' && ['llamada', 'reunion', 'correo'].includes(task.type)) {
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
        type: (data.type ?? 'tarea') as string,
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
    { label: 'Total', value: stats.total, icon: CalendarDays, className: 'bg-slate-50 border-slate-200 text-slate-700' },
    { label: 'Pendientes', value: stats.pendientes, icon: Clock, className: 'bg-amber-50 border-amber-200 text-amber-700' },
    { label: 'Completadas', value: stats.completadas, icon: CalendarCheck, className: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { label: 'En progreso', value: stats.enProgreso, icon: RefreshCw, className: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Vencidas', value: stats.vencidas, icon: AlertTriangle, className: 'bg-red-50 border-red-200 text-red-700' },
  ];

  return (
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
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/80">
                  <StatIcon className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs font-medium opacity-80">{stat.label}</p>
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

          <Select value={advisorFilter} onValueChange={setAdvisorFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Asesor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los asesores</SelectItem>
              {users.map((u) => (
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

      {/* Main content: list + sidebar */}
      <div className="flex gap-6">
        {/* Task list */}
        <div className="min-w-0 flex-1">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList variant="line" className="w-full justify-start overflow-x-auto">
              {statusTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead className="w-10">Tipo</TableHead>
                        <TableHead>Tarea</TableHead>
                        <TableHead className="hidden lg:table-cell">Contacto</TableHead>
                        <TableHead className="hidden lg:table-cell">Empresa</TableHead>
                        <TableHead className="hidden sm:table-cell">Asignado</TableHead>
                        <TableHead className="hidden lg:table-cell">Inicio</TableHead>
                        <TableHead>Vence</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTasks.map((task) => {
                        const taskType = ['llamada', 'reunion', 'correo', 'tarea'].includes(task.type)
                          ? task.type
                          : 'tarea';
                        const TypeIcon = activityIcons[taskType as keyof typeof activityIcons];
                        const iconColor = activityIconColors[taskType as keyof typeof activityIconColors];
                        const overdue = isOverdue(task.dueDate, task.status);

                        return (
                          <TableRow
                            key={task.id}
                            className={cn(
                              'cursor-pointer transition-colors hover:bg-muted/50',
                              overdue && 'bg-red-50/30',
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
                            <TableCell>
                              <div
                                className={cn(
                                  'flex size-8 items-center justify-center rounded-lg',
                                  iconColor,
                                )}
                                title={taskTypeLabels[taskType as keyof typeof taskTypeLabels]}
                              >
                                <TypeIcon className="size-4" />
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              <span
                                className={cn(
                                  task.status === 'completada' && 'line-through text-muted-foreground',
                                )}
                              >
                                {task.title}
                              </span>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-muted-foreground">
                              {getContactNameOnly(task.contactName) ?? task.contactName ?? '—'}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-muted-foreground">
                              {getCompanyFromContactName(task.contactName) ?? '—'}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground">
                              {task.assignedToName}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-muted-foreground">
                              {task.startDate
                                ? formatDueDate(task.startDate)
                                : '—'}
                            </TableCell>
                            <TableCell>
                              <span className={cn(
                                'flex items-center gap-1',
                                overdue && 'font-semibold text-red-600',
                              )}>
                                {formatDueDate(task.dueDate, task.startTime)}
                                {overdue && <AlertTriangle className="size-3.5 text-red-500" />}
                              </span>
                            </TableCell>
                            <TableCell>
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
                    {format(new Date(), "EEEE", { locale: es })}
                  </p>
                  <p className="text-3xl font-bold text-[#13944C]">
                    {format(new Date(), 'd')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(), "MMMM yyyy", { locale: es })}
                  </p>
                </div>
                <Calendar
                  mode="single"
                  selected={calendarDate}
                  onSelect={setCalendarDate}
                  className="mx-auto"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <CalendarDays className="size-4 text-[#13944C]" />
                  Hoy
                </h3>
                {todayTasks.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No hay tareas para hoy.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {todayTasks.map((t) => {
                      const Icon = activityIcons[t.type];
                      return (
                        <div key={t.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                          <Icon className="size-4 shrink-0 text-muted-foreground" />
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
                      const Icon = activityIcons[t.type];
                      return (
                        <div key={t.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                          <Icon className="size-4 shrink-0 text-muted-foreground" />
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
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <CalendarDays className="size-4 text-[#13944C]" />
                  Tareas de hoy
                </h3>
                {todayTasks.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No hay tareas para hoy.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {todayTasks.map((t) => {
                      const Icon = activityIcons[t.type];
                      return (
                        <div key={t.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                          <Icon className="size-4 shrink-0 text-muted-foreground" />
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
          const current = allTasks.map(activityToTaskDetail);
          const newIds = new Set(taskDetails.map((t) => t.id));
          const deleted = current.filter((t) => !newIds.has(t.id));
          for (const t of deleted) {
            try {
              await deleteActivity(t.id);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Error al eliminar');
            }
          }
          const changed = taskDetails.find(
            (nd) => {
              const oldTask = current.find((c) => c.id === nd.id);
              return oldTask && oldTask.status !== nd.status;
            },
          );
          if (changed) {
            try {
              const payload: { status: string; completedAt?: string } = { status: changed.status };
              if (changed.status === 'completada') {
                payload.completedAt = new Date().toISOString().slice(0, 10);
              }
              await updateActivity(changed.id, payload);
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
        ['llamada', 'reunion', 'correo'].includes(completedTask.type) &&
        activityFromTaskOpen && (
          <ActivityFormDialog
            type={completedTask.type as 'llamada' | 'reunion' | 'correo'}
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
  );
}
