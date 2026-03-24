import { useState, useMemo } from 'react';
import { addDays, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, isSameMonth, addWeeks, subWeeks, parseISO, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, LayoutGrid, Clock, Plus,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useUsers } from '@/hooks/useUsers';
import { useActivities } from '@/hooks/useActivities';
import { activityToCalendarEvent } from '@/lib/activityApi';
import { contacts } from '@/data/mock';
import { opportunities } from '@/data/mock';
import { CalendarEventCard } from '@/components/calendar/CalendarEventCard';
import { EventDetailModal } from '@/components/calendar/EventDetailModal';
import { EventFormModal, type EventFormModalProps } from '@/components/calendar/EventFormModal';
import { eventTypeConfig } from '@/components/calendar/eventTypeConfig';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types';
import { toast } from 'sonner';

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);


export default function CalendarioPage() {
  const { activeUsers } = useUsers();
  const { activities, loading: activitiesLoading, createActivity, updateActivity, deleteActivity, error: activitiesError } = useActivities();

  const TASK_TYPES = ['tarea', 'llamada', 'reunion', 'correo'];
  const events = useMemo(
    () => activities
      .filter((a) => TASK_TYPES.includes(a.type))
      .map(activityToCalendarEvent),
    [activities],
  );

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const relatedOptions = useMemo(() => {
    const opts: { type: 'contact' | 'company' | 'opportunity'; id: string; name: string }[] = [];
    contacts.forEach((c) => {
      const company = c.companies?.[0]?.name;
      opts.push({ type: 'contact', id: c.id, name: `${c.name}${company ? ` - ${company}` : ''}` });
    });
    const companyNames = new Set<string>();
    contacts.forEach((c) => {
      c.companies?.forEach((co) => {
        if (co.name && !companyNames.has(co.name)) {
          companyNames.add(co.name);
          opts.push({ type: 'company', id: co.name, name: co.name });
        }
      });
    });
    opportunities.forEach((o) => opts.push({ type: 'opportunity', id: o.id, name: o.title }));
    return opts;
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (userFilter !== 'all' && e.assignedTo !== userFilter) return false;
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      return true;
    });
  }, [events, userFilter, typeFilter, statusFilter]);

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
        await updateActivity(editingEvent.id, {
          type: d.type,
          title: d.title,
          description: d.description ?? '',
          assignedTo: d.assignedTo,
          status: d.status,
          dueDate: d.date,
          startDate: d.date,
          startTime: d.startTime,
        });
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
        <Button
          className="bg-[#13944C] hover:bg-[#0f7a3d]"
          onClick={() => { setEditingEvent(null); setFormOpen(true); }}
          disabled={activitiesLoading}
        >
          <Plus className="mr-2 size-4" />
          Nueva Actividad
        </Button>
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
              {activeUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
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
