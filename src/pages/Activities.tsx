import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus, Search, X, MoreHorizontal, Phone, Users,
  CheckSquare, Mail, Clock, MessageCircle,
  CalendarDays, CalendarCheck, AlertTriangle,
  RefreshCw, Check, Pencil, Trash2, User,
} from 'lucide-react';
import type { ActivityType, ActivityStatus } from '@/types';
import { activities, users, activityTypeLabels } from '@/data/mock';
import {
  format, isToday, isBefore, startOfDay, addDays, isWithinInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const activityIcons: Record<ActivityType, typeof Phone> = {
  llamada: Phone,
  reunion: Users,
  tarea: CheckSquare,
  correo: Mail,
  seguimiento: Clock,
  whatsapp: MessageCircle,
};

const activityIconColors: Record<ActivityType, string> = {
  llamada: 'bg-blue-100 text-blue-600',
  reunion: 'bg-purple-100 text-purple-600',
  tarea: 'bg-emerald-100 text-emerald-600',
  correo: 'bg-amber-100 text-amber-600',
  seguimiento: 'bg-cyan-100 text-cyan-600',
  whatsapp: 'bg-green-100 text-green-600',
};

const activityStatusConfig: Record<ActivityStatus, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  completada: { label: 'Completada', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  vencida: { label: 'Vencida', className: 'bg-red-100 text-red-700 border-red-200' },
  reprogramada: { label: 'Reprogramada', className: 'bg-blue-100 text-blue-700 border-blue-200' },
};

const statusTabs = [
  { value: 'todas', label: 'Todas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'completada', label: 'Completadas' },
  { value: 'vencida', label: 'Vencidas' },
];

const newActivitySchema = z.object({
  type: z.enum(['llamada', 'reunion', 'tarea', 'correo', 'seguimiento', 'whatsapp'] as const),
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres'),
  description: z.string().min(5, 'La descripción debe tener al menos 5 caracteres'),
  leadId: z.string().optional(),
  assignedTo: z.string().min(1, 'Selecciona un asesor'),
  dueDate: z.string().min(1, 'Selecciona una fecha'),
  status: z.enum(['pendiente', 'completada', 'vencida', 'reprogramada'] as const),
});

type NewActivityForm = z.infer<typeof newActivitySchema>;

function ActivityStatusBadge({ status }: { status: ActivityStatus }) {
  const config = activityStatusConfig[status];
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}

export default function ActivitiesPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [advisorFilter, setAdvisorFilter] = useState('todos');
  const [activeTab, setActiveTab] = useState('todas');
  const [newActivityOpen, setNewActivityOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const form = useForm<NewActivityForm>({
    resolver: zodResolver(newActivitySchema),
    defaultValues: {
      type: 'llamada',
      title: '',
      description: '',
      leadId: '',
      assignedTo: '',
      dueDate: '',
      status: 'pendiente',
    },
  });

  const [dueDateOpen, setDueDateOpen] = useState(false);

  const stats = useMemo(() => {
    const total = activities.length;
    const pendientes = activities.filter((a) => a.status === 'pendiente').length;
    const completadas = activities.filter((a) => a.status === 'completada').length;
    const vencidas = activities.filter((a) => a.status === 'vencida').length;
    const reprogramadas = activities.filter((a) => a.status === 'reprogramada').length;
    return { total, pendientes, completadas, vencidas, reprogramadas };
  }, []);

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      const matchesSearch =
        !search ||
        activity.title.toLowerCase().includes(search.toLowerCase()) ||
        activity.description.toLowerCase().includes(search.toLowerCase()) ||
        (activity.leadName?.toLowerCase().includes(search.toLowerCase()) ?? false);

      const matchesTab = activeTab === 'todas' || activity.status === activeTab;
      const matchesType = typeFilter === 'todos' || activity.type === typeFilter;
      const matchesStatus = statusFilter === 'todos' || activity.status === statusFilter;
      const matchesAdvisor = advisorFilter === 'todos' || activity.assignedTo === advisorFilter;

      return matchesSearch && matchesTab && matchesType && matchesStatus && matchesAdvisor;
    });
  }, [search, activeTab, typeFilter, statusFilter, advisorFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { todas: activities.length };
    for (const a of activities) {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    }
    return counts;
  }, []);

  const todayActivities = useMemo(() => {
    const today = startOfDay(new Date());
    return activities.filter((a) => {
      const due = startOfDay(new Date(a.dueDate));
      return due.getTime() === today.getTime();
    });
  }, []);

  const upcomingActivities = useMemo(() => {
    const today = startOfDay(new Date());
    const threeDaysLater = addDays(today, 3);
    return activities.filter((a) => {
      const due = startOfDay(new Date(a.dueDate));
      return isWithinInterval(due, { start: addDays(today, 1), end: threeDaysLater }) &&
        a.status !== 'completada';
    });
  }, []);

  const hasActiveFilters = typeFilter !== 'todos' || statusFilter !== 'todos' || advisorFilter !== 'todos' || search !== '';

  function clearFilters() {
    setSearch('');
    setTypeFilter('todos');
    setStatusFilter('todos');
    setAdvisorFilter('todos');
  }

  function isOverdue(dueDate: string, status: ActivityStatus) {
    if (status === 'completada') return false;
    return isBefore(new Date(dueDate), startOfDay(new Date()));
  }

  function formatDueDate(dueDate: string) {
    const date = new Date(dueDate);
    if (isToday(date)) return 'Hoy';
    return format(date, "d 'de' MMM", { locale: es });
  }

  function handleComplete(id: string) {
    toast.success(`Actividad "${activities.find((a) => a.id === id)?.title}" marcada como completada`);
  }

  function handleReschedule(id: string) {
    toast.info(`Reprogramando actividad "${activities.find((a) => a.id === id)?.title}"`);
  }

  function handleDelete(id: string) {
    toast.success(`Actividad "${activities.find((a) => a.id === id)?.title}" eliminada`);
  }

  function onSubmitNewActivity(data: NewActivityForm) {
    console.log('New activity:', data);
    toast.success(`Actividad "${data.title}" creada exitosamente`);
    form.reset();
    setNewActivityOpen(false);
  }

  const statsCards = [
    { label: 'Total', value: stats.total, icon: CalendarDays, className: 'bg-slate-50 border-slate-200 text-slate-700' },
    { label: 'Pendientes', value: stats.pendientes, icon: Clock, className: 'bg-amber-50 border-amber-200 text-amber-700' },
    { label: 'Completadas', value: stats.completadas, icon: CalendarCheck, className: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { label: 'Vencidas', value: stats.vencidas, icon: AlertTriangle, className: 'bg-red-50 border-red-200 text-red-700' },
    { label: 'Reprogramadas', value: stats.reprogramadas, icon: RefreshCw, className: 'bg-blue-50 border-blue-200 text-blue-700' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Actividades" description="Gestiona llamadas, reuniones, tareas y seguimientos">
        <Button onClick={() => setNewActivityOpen(true)}>
          <Plus /> Nueva Actividad
        </Button>
      </PageHeader>

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
            placeholder="Buscar por título, descripción o lead..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {Object.entries(activityTypeLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

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
        {/* Activity list */}
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
              {filteredActivities.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No se encontraron actividades"
                  description="Intenta ajustar los filtros o crea una nueva actividad."
                  actionLabel="Nueva Actividad"
                  onAction={() => setNewActivityOpen(true)}
                />
              ) : (
                <div className="space-y-3">
                  {filteredActivities.map((activity) => {
                    const TypeIcon = activityIcons[activity.type];
                    const iconColor = activityIconColors[activity.type];
                    const overdue = isOverdue(activity.dueDate, activity.status);

                    return (
                      <Card
                        key={activity.id}
                        className={cn(
                          'transition-shadow hover:shadow-md',
                          overdue && 'border-red-200 bg-red-50/30',
                        )}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', iconColor)}>
                              <TypeIcon className="size-5" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-semibold">{activity.title}</h3>
                                    <ActivityStatusBadge status={activity.status} />
                                    <Badge variant="outline" className="text-[11px]">
                                      {activityTypeLabels[activity.type]}
                                    </Badge>
                                  </div>
                                  <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                                    {activity.description}
                                  </p>
                                </div>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon-sm" className="shrink-0">
                                      <MoreHorizontal className="size-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {activity.status !== 'completada' && (
                                      <DropdownMenuItem onClick={() => handleComplete(activity.id)}>
                                        <Check /> Completar
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => handleReschedule(activity.id)}>
                                      <RefreshCw /> Reprogramar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      <Pencil /> Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem variant="destructive" onClick={() => handleDelete(activity.id)}>
                                      <Trash2 /> Eliminar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                                {activity.leadName && (
                                  <span className="flex items-center gap-1.5 font-medium text-[#13944C] hover:underline cursor-pointer">
                                    <Users className="size-3.5" />
                                    {activity.leadName}
                                  </span>
                                )}
                                <span className="flex items-center gap-1.5">
                                  <User className="size-3.5" />
                                  {activity.assignedToName}
                                </span>
                                <span className={cn(
                                  'flex items-center gap-1.5',
                                  overdue && 'font-semibold text-red-600',
                                )}>
                                  <CalendarDays className="size-3.5" />
                                  {formatDueDate(activity.dueDate)}
                                  {overdue && (
                                    <AlertTriangle className="size-3.5 text-red-500" />
                                  )}
                                </span>
                                {activity.completedAt && (
                                  <span className="flex items-center gap-1.5 text-emerald-600">
                                    <CalendarCheck className="size-3.5" />
                                    Completada {format(new Date(activity.completedAt), "d MMM", { locale: es })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
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
                {todayActivities.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No hay actividades para hoy.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {todayActivities.map((a) => {
                      const Icon = activityIcons[a.type];
                      return (
                        <div key={a.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                          <Icon className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{a.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{a.assignedToName}</p>
                          </div>
                          <ActivityStatusBadge status={a.status} />
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
                {upcomingActivities.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No hay actividades próximas.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {upcomingActivities.map((a) => {
                      const Icon = activityIcons[a.type];
                      return (
                        <div key={a.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                          <Icon className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{a.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {format(new Date(a.dueDate), "d MMM", { locale: es })} · {a.assignedToName}
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
                  Actividades de hoy
                </h3>
                {todayActivities.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No hay actividades para hoy.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {todayActivities.map((a) => {
                      const Icon = activityIcons[a.type];
                      return (
                        <div key={a.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                          <Icon className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{a.title}</p>
                          </div>
                          <ActivityStatusBadge status={a.status} />
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

      {/* New Activity Dialog */}
      <Dialog open={newActivityOpen} onOpenChange={setNewActivityOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Actividad</DialogTitle>
            <DialogDescription>Programa una nueva actividad para dar seguimiento.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmitNewActivity)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de actividad *</Label>
                <Select
                  value={form.watch('type')}
                  onValueChange={(v) => form.setValue('type', v as ActivityType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(activityTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={form.watch('status')}
                  onValueChange={(v) => form.setValue('status', v as ActivityStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(activityStatusConfig).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="act-title">Título *</Label>
                <Input id="act-title" {...form.register('title')} placeholder="Ej: Llamada de seguimiento" />
                {form.formState.errors.title && (
                  <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="act-desc">Descripción *</Label>
                <Textarea
                  id="act-desc"
                  {...form.register('description')}
                  placeholder="Describe la actividad..."
                  rows={3}
                />
                {form.formState.errors.description && (
                  <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Lead (opcional)</Label>
                <Select
                  value={form.watch('leadId') ?? ''}
                  onValueChange={(v) => form.setValue('leadId', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin lead</SelectItem>
                    {activities
                      .filter((a) => a.leadId && a.leadName)
                      .reduce<Array<{ id: string; name: string }>>((acc, a) => {
                        if (a.leadId && a.leadName && !acc.some((x) => x.id === a.leadId)) {
                          acc.push({ id: a.leadId, name: a.leadName });
                        }
                        return acc;
                      }, [])
                      .map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Asesor asignado *</Label>
                <Select
                  value={form.watch('assignedTo')}
                  onValueChange={(v) => form.setValue('assignedTo', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar asesor" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter((u) => u.status === 'activo').map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.assignedTo && (
                  <p className="text-xs text-destructive">{form.formState.errors.assignedTo.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Fecha de vencimiento *</Label>
                <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !form.watch('dueDate') && 'text-muted-foreground',
                      )}
                    >
                      <CalendarDays className="size-4" />
                      {form.watch('dueDate')
                        ? format(new Date(form.watch('dueDate')), "d 'de' MMMM, yyyy", { locale: es })
                        : 'Seleccionar fecha'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.watch('dueDate') ? new Date(form.watch('dueDate')) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          form.setValue('dueDate', format(date, 'yyyy-MM-dd'));
                          setDueDateOpen(false);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
                {form.formState.errors.dueDate && (
                  <p className="text-xs text-destructive">{form.formState.errors.dueDate.message}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewActivityOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Crear Actividad</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
