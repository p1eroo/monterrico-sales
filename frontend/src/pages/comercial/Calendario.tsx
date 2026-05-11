import { useState, useMemo, useEffect, useCallback } from 'react';
import { addDays, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, isSameMonth, addWeeks, subWeeks, parseISO, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, LayoutGrid, Clock, Plus,
  Phone, Mail, MessageCircle, ClipboardList,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { ActivityFormDialog, type ActivityFormData } from '@/components/shared/ActivityFormDialog';
import { TaskFormDialog, type TaskFormResult } from '@/components/shared/TaskFormDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUsers } from '@/hooks/useUsers';
import { useActivities } from '@/hooks/useActivities';
import { activityToCalendarEvent, type CreateActivityPayload } from '@/lib/activityApi';
import { contactListAll, mapApiContactRowToContact } from '@/lib/contactApi';
import { companyListAll } from '@/lib/companyApi';
import { opportunityListAll, mapApiOpportunityToOpportunity } from '@/lib/opportunityApi';
import { CalendarEventCard } from '@/components/calendar/CalendarEventCard';
import { EventDetailModal } from '@/components/calendar/EventDetailModal';
import { EventFormModal, type EventFormModalProps } from '@/components/calendar/EventFormModal';
import { eventTypeConfig } from '@/components/calendar/eventTypeConfig';
import { cn } from '@/lib/utils';
import type { CalendarEvent, Contact, Opportunity, TaskKind } from '@/types';
import { TASK_KINDS } from '@/types';

const CALENDAR_TYPE_FILTER_MODALITIES = ['llamada', 'reunion', 'correo', 'whatsapp'] as const;

function eventMatchesCalendarTypeFilter(
  e: CalendarEvent,
  typeFilter: string,
  taskKindSubFilter: string,
): boolean {
  if (typeFilter === 'all') return true;
  if (typeFilter === 'tarea') {
    if (e.activityRecordType !== 'tarea') return false;
    if (taskKindSubFilter === 'all') return true;
    return e.taskKind === taskKindSubFilter;
  }
  if (CALENDAR_TYPE_FILTER_MODALITIES.includes(typeFilter as TaskKind)) {
    return (
      e.activityRecordType === typeFilter ||
      (e.activityRecordType === 'tarea' && e.taskKind === typeFilter)
    );
  }
  return e.type === typeFilter;
}
import { toast } from 'sonner';

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const NEW_ACTIVITY_ACTIONS = [
  { kind: 'llamada' as const, icon: Phone, label: 'Llamada' },
  { kind: 'reunion' as const, icon: CalendarIcon, label: 'Reunión' },
  { kind: 'correo' as const, icon: Mail, label: 'Correo' },
  { kind: 'whatsapp' as const, icon: MessageCircle, label: 'WhatsApp' },
  { kind: 'tarea' as const, icon: ClipboardList, label: 'Tarea' },
];

function activityPayloadFromForm(
  kind: 'llamada' | 'reunion' | 'correo' | 'whatsapp',
  data: ActivityFormData,
  ctx: { contactId?: string; companyId?: string; opportunityId?: string },
  assignedTo: string,
): CreateActivityPayload {
  const today = new Date().toISOString().slice(0, 10);
  let dueDate = today;
  let startDate = today;
  let startTime = '09:00';
  const extra: string[] = [];

  if (kind === 'llamada') {
    dueDate = data.date || today;
    startDate = data.date || today;
    startTime = data.time || '09:00';
    if (data.duration) extra.push(`Duración: ${data.duration} min`);
    if (data.result) extra.push(`Resultado: ${data.result}`);
  } else if (kind === 'reunion') {
    const dt = data.dateTime?.trim();
    if (dt) {
      dueDate = dt.slice(0, 10);
      startDate = dt.slice(0, 10);
      startTime = dt.length >= 16 ? dt.slice(11, 16) : '09:00';
    }
    if (data.meetingType) extra.push(`Modalidad: ${data.meetingType}`);
    if (data.result) extra.push(`Resultado: ${data.result}`);
  } else {
    dueDate = today;
    startDate = today;
    startTime = '09:00';
  }

  const title =
    data.title?.trim() ||
    (kind === 'llamada' ? 'Llamada' : kind === 'reunion' ? 'Reunión' : kind === 'correo' ? 'Correo' : 'WhatsApp');
  const description = [data.description?.trim(), ...extra].filter(Boolean).join('\n');

  return {
    type: kind,
    title,
    description,
    assignedTo,
    dueDate,
    startDate,
    startTime,
    ...ctx,
  };
}

export default function CalendarioPage() {
  const { activeAdvisors } = useUsers();
  const defaultAssigneeId = activeAdvisors[0]?.id ?? '';
  const { activities, loading: activitiesLoading, createActivity, updateActivity, deleteActivity, error: activitiesError } = useActivities();

  const events = useMemo(
    () =>
      activities
        .filter((a) => {
          if (a.type === 'tarea') return !!(a.taskKind && TASK_KINDS.includes(a.taskKind));
          return ['llamada', 'reunion', 'correo', 'whatsapp'].includes(a.type);
        })
        .map(activityToCalendarEvent),
    [activities],
  );

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [taskKindSubFilter, setTaskKindSubFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const [entityLinkOpen, setEntityLinkOpen] = useState(false);
  const [entityLinkValue, setEntityLinkValue] = useState<string>('');
  const [pendingActivityKind, setPendingActivityKind] = useState<
    'llamada' | 'reunion' | 'correo' | 'whatsapp' | null
  >(null);
  const [activityFormKind, setActivityFormKind] = useState<
    'llamada' | 'reunion' | 'correo' | 'whatsapp' | null
  >(null);
  const [activityEntityCtx, setActivityEntityCtx] = useState<{
    contactId?: string;
    companyId?: string;
    opportunityId?: string;
  } | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);

  const [taskContacts, setTaskContacts] = useState<Contact[]>([]);
  const [taskOpportunities, setTaskOpportunities] = useState<Opportunity[]>([]);
  const [taskCompanies, setTaskCompanies] = useState<{ name: string; id: string }[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(false);

  const loadCalendarEntities = useCallback(async () => {
    setEntitiesLoading(true);
    try {
      const [contactRows, companyRows, oppRows] = await Promise.all([
        contactListAll(),
        companyListAll(),
        opportunityListAll(),
      ]);
      setTaskContacts(contactRows.map(mapApiContactRowToContact));
      setTaskCompanies(companyRows.map((c) => ({ name: c.name, id: c.id })));
      setTaskOpportunities(oppRows.map(mapApiOpportunityToOpportunity));
    } catch {
      toast.error('No se pudieron cargar contactos u oportunidades para el calendario');
    } finally {
      setEntitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCalendarEntities();
  }, [loadCalendarEntities]);

  const relatedOptions = useMemo(() => {
    const opts: { type: 'contact' | 'company' | 'opportunity'; id: string; name: string }[] = [];
    taskContacts.forEach((c) => {
      const company = c.companies?.[0]?.name;
      opts.push({ type: 'contact', id: c.id, name: `${c.name}${company ? ` - ${company}` : ''}` });
    });
    taskCompanies.forEach((co) => {
      opts.push({ type: 'company', id: co.id, name: co.name });
    });
    taskOpportunities.forEach((o) => opts.push({ type: 'opportunity', id: o.id, name: o.title }));
    return opts;
  }, [taskContacts, taskCompanies, taskOpportunities]);

  const entityLinkOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    taskContacts.forEach((c) => {
      const co = c.companies?.[0]?.name;
      out.push({
        value: `contact:${c.id}`,
        label: `${c.name}${co ? ` — ${co}` : ''}`,
      });
    });
    taskCompanies.forEach((co) => {
      out.push({ value: `company:${co.id}`, label: co.name });
    });
    taskOpportunities.forEach((o) => {
      out.push({ value: `opportunity:${o.id}`, label: o.title });
    });
    return out;
  }, [taskContacts, taskCompanies, taskOpportunities]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (userFilter !== 'all' && e.assignedTo !== userFilter) return false;
      if (!eventMatchesCalendarTypeFilter(e, typeFilter, taskKindSubFilter)) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      return true;
    });
  }, [events, userFilter, typeFilter, taskKindSubFilter, statusFilter]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const monthDays = useMemo(() => {
    const days: Date[] = [];
    let d = calendarStart;
    while (d <= calendarEnd) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }, [calendarStart, calendarEnd]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach((e) => {
      const key = e.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    map.forEach((arr) => arr.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  }, [filteredEvents]);

  const weekStart = startOfWeek(viewMode === 'week' ? currentDate : currentDate, { weekStartsOn: 0 });
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const upcomingEvents = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return filteredEvents
      .filter((e) => e.date >= today && e.status !== 'completada')
      .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
      .slice(0, 5);
  }, [filteredEvents]);

  const overdueEvents = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return filteredEvents.filter((e) => e.date < today && e.status !== 'completada');
  }, [filteredEvents]);

  function handlePrev() {
    if (viewMode === 'month') setCurrentDate((d) => subDays(startOfMonth(d), 1));
    else if (viewMode === 'week') setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subDays(d, 1));
  }

  function handleNext() {
    if (viewMode === 'month') setCurrentDate((d) => addDays(endOfMonth(d), 1));
    else if (viewMode === 'week') setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addDays(d, 1));
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  function parseEntityLink(sel: string) {
    const i = sel.indexOf(':');
    if (i <= 0) return {};
    const kind = sel.slice(0, i);
    const id = sel.slice(i + 1);
    if (kind === 'contact') return { contactId: id };
    if (kind === 'company') return { companyId: id };
    if (kind === 'opportunity') return { opportunityId: id };
    return {};
  }

  function handleSelectNewActivityKind(
    kind: 'llamada' | 'reunion' | 'correo' | 'whatsapp' | 'tarea',
  ) {
    if (kind === 'tarea') {
      setTaskFormOpen(true);
      return;
    }
    setPendingActivityKind(kind);
    setEntityLinkValue('');
    setEntityLinkOpen(true);
  }

  function handleConfirmEntityLink() {
    if (!entityLinkValue || !pendingActivityKind) {
      toast.error('Selecciona un contacto, empresa u oportunidad');
      return;
    }
    const ctx = parseEntityLink(entityLinkValue);
    if (!ctx.contactId && !ctx.companyId && !ctx.opportunityId) {
      toast.error('Selección no válida');
      return;
    }
    setActivityEntityCtx(ctx);
    setActivityFormKind(pendingActivityKind);
    setPendingActivityKind(null);
    setEntityLinkOpen(false);
    setEntityLinkValue('');
  }

  async function handleActivityFormSave(data: ActivityFormData) {
    if (!activityFormKind || !activityEntityCtx) return;
    if (!defaultAssigneeId) {
      toast.error('No hay usuario interno para asignar');
      throw new Error('no assignee');
    }
    try {
      const payload = activityPayloadFromForm(
        activityFormKind,
        data,
        activityEntityCtx,
        defaultAssigneeId,
      );
      await createActivity(payload);
      setActivityFormKind(null);
      setActivityEntityCtx(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear la actividad');
      throw e;
    }
  }

  async function handleCalendarTaskFormSave(data: TaskFormResult) {
    const contactAssoc = data.associations?.find((a) => a.type === 'contacto');
    const negocioAssoc = data.associations?.find((a) => a.type === 'negocio');
    const empresaAssoc = data.associations?.find((a) => a.type === 'empresa');
    const companyId =
      empresaAssoc?.id && /^c[a-z0-9]+$/i.test(empresaAssoc.id) ? empresaAssoc.id : undefined;

    if (!contactAssoc && !companyId && !negocioAssoc) {
      toast.error('Debes vincular la tarea a un contacto, empresa u oportunidad');
      throw new Error('validation');
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear la tarea');
      throw e;
    }
  }

  async function handleSaveEvent(data: Parameters<EventFormModalProps['onSave']>[0]) {
    const d = data as {
      title: string;
      type: CalendarEvent['type'];
      date: string;
      startTime: string;
      endTime: string;
      assignedTo: string;
      relatedEntityType?: CalendarEvent['relatedEntityType'];
      relatedEntityId?: string;
      relatedEntityName?: string;
      description?: string;
      status: CalendarEvent['status'];
    };
    const entityId = d.relatedEntityId && d.relatedEntityId !== 'none' ? d.relatedEntityId : undefined;
    const entityType = entityId ? d.relatedEntityType : undefined;
    const contactId = entityType === 'contact' ? entityId : undefined;
    const opportunityId = entityType === 'opportunity' ? entityId : undefined;
    const companyId = entityType === 'company' && entityId && /^c[a-z0-9]+$/i.test(entityId) ? entityId : undefined;

    if (!contactId && !companyId && !opportunityId) {
      toast.error('Debes vincular la actividad a un contacto, empresa u oportunidad');
      return;
    }

    try {
      if (editingEvent) {
        const editPayload =
          editingEvent.activityRecordType === 'tarea'
            ? {
                type: 'tarea' as const,
                taskKind: d.type as TaskKind,
                title: d.title,
                description: d.description ?? '',
                assignedTo: d.assignedTo,
                status: d.status,
                dueDate: d.date,
                startDate: d.date,
                startTime: d.startTime,
              }
            : {
                type: d.type,
                title: d.title,
                description: d.description ?? '',
                assignedTo: d.assignedTo,
                status: d.status,
                dueDate: d.date,
                startDate: d.date,
                startTime: d.startTime,
              };
        await updateActivity(editingEvent.id, editPayload);
        toast.success('Evento actualizado');
      } else {
        await createActivity({
          type: d.type,
          title: d.title,
          description: d.description ?? '',
          assignedTo: d.assignedTo,
          dueDate: d.date,
          startDate: d.date,
          startTime: d.startTime,
          contactId,
          companyId,
          opportunityId,
        });
        toast.success('Evento creado');
      }
      setEditingEvent(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
      throw e;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario"
        description="Visualiza tus tareas y actividades por fecha."
      >
        <DropdownMenu
          onOpenChange={(open) => {
            if (open) {
              setEditingEvent(null);
              void loadCalendarEntities();
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              disabled={activitiesLoading || entitiesLoading}
            >
              <Plus className="mr-2 size-4" />
              Nueva Actividad
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Elige el tipo de actividad
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {NEW_ACTIVITY_ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <DropdownMenuItem
                  key={a.kind}
                  disabled={entitiesLoading}
                  className="gap-2"
                  onSelect={() => handleSelectNewActivityKind(a.kind)}
                >
                  <Icon className="size-4 shrink-0 text-[#13944C]" />
                  {a.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      {activitiesError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {activitiesError}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Usuario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los usuarios</SelectItem>
              {activeAdvisors.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={typeFilter}
            onValueChange={(v) => {
              setTypeFilter(v);
              if (v !== 'tarea') setTaskKindSubFilter('all');
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {Object.entries(eventTypeConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {typeFilter === 'tarea' && (
            <Select value={taskKindSubFilter} onValueChange={setTaskKindSubFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Modalidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las modalidades</SelectItem>
                {TASK_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {eventTypeConfig[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="completada">Completada</SelectItem>
              <SelectItem value="en_progreso">En progreso</SelectItem>
              <SelectItem value="vencida">Vencida</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-1">
            {(['month', 'week', 'day', 'agenda'] as const).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-3"
                onClick={() => setViewMode(mode)}
              >
                {mode === 'month' && <LayoutGrid className="size-4" />}
                {mode === 'week' && <CalendarIcon className="size-4" />}
                {mode === 'day' && <Clock className="size-4" />}
                {mode === 'agenda' && <List className="size-4" />}
                <span className="ml-1.5 hidden sm:inline">
                  {mode === 'month' && 'Mes'}
                  {mode === 'week' && 'Semana'}
                  {mode === 'day' && 'Día'}
                  {mode === 'agenda' && 'Agenda'}
                </span>
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border px-2 py-1">
            <Button variant="ghost" size="icon" className="size-8" onClick={handlePrev}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[140px] text-center text-sm font-medium">
              {viewMode === 'month' && format(currentDate, 'MMMM yyyy', { locale: es })}
              {viewMode === 'week' && `${format(weekStart, 'd MMM', { locale: es })} - ${format(addDays(weekStart, 6), 'd MMM yyyy', { locale: es })}`}
              {viewMode === 'day' && format(currentDate, "EEEE d 'de' MMMM, yyyy", { locale: es })}
              {viewMode === 'agenda' && format(currentDate, 'MMMM yyyy', { locale: es })}
            </span>
            <Button variant="ghost" size="icon" className="size-8" onClick={handleNext}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Hoy
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Main calendar area */}
        <div className="min-w-0 flex-1">
          {viewMode === 'month' && (
            <Card className="overflow-hidden">
              <div className="grid grid-cols-7 border-b bg-muted/30">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const dayEvents = eventsByDate.get(key) ?? [];
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  return (
                    <div
                      key={key}
                      className={cn(
                        'min-h-[100px] border-b border-r p-2 transition-colors hover:bg-muted/20',
                        !isCurrentMonth && 'bg-muted/20',
                        isToday(day) && 'bg-[#13944C]/5',
                      )}
                      onClick={() => {
                        setCurrentDate(day);
                        setViewMode('day');
                      }}
                    >
                      <div
                        className={cn(
                          'mb-1 flex size-7 items-center justify-center rounded-full text-sm font-medium',
                          isToday(day) && 'bg-[#13944C] text-white',
                          isCurrentMonth && !isToday(day) && 'text-foreground',
                          !isCurrentMonth && 'text-muted-foreground',
                        )}
                      >
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <CalendarEventCard
                            key={ev.id}
                            event={ev}
                            compact
                            onClick={() => {
                              setSelectedEvent(ev);
                              setDetailOpen(true);
                            }}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <p className="text-[10px] text-muted-foreground">+{dayEvents.length - 3} más</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {viewMode === 'week' && (
            <Card className="overflow-hidden">
              <div className="flex border-b">
                <div className="w-14 shrink-0 border-r bg-muted/30" />
                {weekDays.map((day) => (
                  <div key={day.toISOString()} className="flex-1 p-2 text-center text-xs font-medium">
                    {format(day, 'EEE d', { locale: es })}
                  </div>
                ))}
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {HOURS.map((hour) => (
                  <div key={hour} className="flex border-b">
                    <div className="w-14 shrink-0 border-r p-1 text-xs text-muted-foreground">
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                    <div className="flex flex-1">
                      {weekDays.map((day) => {
                        const key = format(day, 'yyyy-MM-dd');
                        const dayEvents = (eventsByDate.get(key) ?? []).filter((e) => {
                          const [h] = e.startTime.split(':').map(Number);
                          return h === hour;
                        });
                        return (
                          <div
                            key={key}
                            className="flex-1 border-r p-1 min-h-[48px]"
                            onClick={() => {
                              setCurrentDate(day);
                              setViewMode('day');
                            }}
                          >
                            {dayEvents.map((ev) => (
                              <CalendarEventCard
                                key={ev.id}
                                event={ev}
                                compact
                                onClick={() => {
                                  setSelectedEvent(ev);
                                  setDetailOpen(true);
                                }}
                              />
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {viewMode === 'day' && (
            <Card className="overflow-hidden">
              <div className="border-b p-3 text-center font-medium">
                {format(currentDate, "EEEE d 'de' MMMM", { locale: es })}
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {HOURS.map((hour) => {
                  const key = format(currentDate, 'yyyy-MM-dd');
                  const dayEvents = (eventsByDate.get(key) ?? []).filter((e) => {
                    const [h] = e.startTime.split(':').map(Number);
                    return h === hour;
                  });
                  return (
                    <div key={hour} className="flex border-b">
                      <div className="w-16 shrink-0 border-r p-2 text-sm text-muted-foreground">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                      <div className="flex-1 p-2">
                        {dayEvents.map((ev) => (
                          <CalendarEventCard
                            key={ev.id}
                            event={ev}
                            onClick={() => {
                              setSelectedEvent(ev);
                              setDetailOpen(true);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {viewMode === 'agenda' && (
            <Card>
              <CardContent className="p-0">
                {filteredEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <CalendarIcon className="mb-4 size-12 text-muted-foreground/40" />
                    <p className="text-muted-foreground">No hay actividades en este periodo.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredEvents
                      .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
                      .map((ev) => (
                        <div
                          key={ev.id}
                          className="flex gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedEvent(ev);
                            setDetailOpen(true);
                          }}
                        >
                          <div className="w-24 shrink-0 text-sm text-muted-foreground">
                            {format(parseISO(ev.date), 'EEE d MMM', { locale: es })}
                            <br />
                            <span className="font-medium text-foreground">{ev.startTime}</span>
                          </div>
                          <CalendarEventCard event={ev} />
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Upcoming & Overdue */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          {overdueEvents.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                  <Clock className="size-4" />
                  Vencidas ({overdueEvents.length})
                </h4>
                <div className="mt-2 space-y-2">
                  {overdueEvents.slice(0, 3).map((ev) => (
                    <CalendarEventCard
                      key={ev.id}
                      event={ev}
                      compact
                      onClick={() => {
                        setSelectedEvent(ev);
                        setDetailOpen(true);
                      }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <CalendarIcon className="size-4 text-[#13944C]" />
                Próximas actividades
              </h4>
              <div className="mt-3 space-y-2">
                {upcomingEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hay actividades próximas.</p>
                ) : (
                  upcomingEvents.map((ev) => (
                    <CalendarEventCard
                      key={ev.id}
                      event={ev}
                      compact
                      onClick={() => {
                        setSelectedEvent(ev);
                        setDetailOpen(true);
                      }}
                    />
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={entityLinkOpen}
        onOpenChange={(open) => {
          setEntityLinkOpen(open);
          if (!open) {
            setPendingActivityKind(null);
            setEntityLinkValue('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular actividad</DialogTitle>
            <DialogDescription>
              Elige el contacto, empresa u oportunidad relacionada con esta actividad.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Select value={entityLinkValue || undefined} onValueChange={setEntityLinkValue}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar registro…" />
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {entityLinkOptions.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">Sin datos. Carga o crea registros en el CRM.</div>
                ) : (
                  entityLinkOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntityLinkOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={handleConfirmEntityLink}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activityFormKind && (
        <ActivityFormDialog
          type={activityFormKind}
          open={!!activityFormKind}
          onOpenChange={(open) => {
            if (!open) {
              setActivityFormKind(null);
              setActivityEntityCtx(null);
            }
          }}
          onSave={handleActivityFormSave}
        />
      )}

      <TaskFormDialog
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        title="Nueva tarea"
        description="Crea una tarea y vincúlala a al menos un contacto, empresa u oportunidad."
        contacts={taskContacts}
        companies={taskCompanies}
        opportunities={taskOpportunities}
        defaultAssigneeId={defaultAssigneeId}
        onSave={handleCalendarTaskFormSave}
      />

      <EventDetailModal
        event={selectedEvent}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={(ev) => {
          setDetailOpen(false);
          setEditingEvent(ev);
          setFormOpen(true);
        }}
        onDelete={async (ev) => {
          try {
            await deleteActivity(ev.id);
            setDetailOpen(false);
            setSelectedEvent(null);
            toast.success('Actividad eliminada');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Error al eliminar');
          }
        }}
      />

      <EventFormModal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingEvent(null);
        }}
        event={editingEvent}
        relatedOptions={relatedOptions}
        onSave={handleSaveEvent}
      />
    </div>
  );
}
