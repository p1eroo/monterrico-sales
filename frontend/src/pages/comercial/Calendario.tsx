import { useState, useMemo, useEffect, useCallback } from 'react';
import { addDays, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, isSameMonth, isSameDay, addWeeks, subWeeks, isToday, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Search,
  Phone, Mail, MessageCircle, ClipboardList,
} from 'lucide-react';
import { toast } from '@/lib/notify';
import { PageHeader } from '@/components/shared/PageHeader';
import { ActivityFormDialog, type ActivityFormData } from '@/components/shared/ActivityFormDialog';
import { activityPayloadFromForm } from '@/lib/activityPayloadFromForm';
import { TaskFormDialog, type TaskFormResult } from '@/components/shared/TaskFormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useUsers } from '@/hooks/useUsers';
import {
  activityToCalendarEvent, type CreateActivityPayload,
  fetchActivitiesList, createActivity as apiCreateActivity,
  updateActivity as apiUpdateActivity, deleteActivity as apiDeleteActivity,
} from '@/lib/activityApi';
import { contactListAll, mapApiContactRowToContact, contactCreate } from '@/lib/contactApi';
import { companyListAll } from '@/lib/companyApi';
import { opportunityListAll, mapApiOpportunityToOpportunity } from '@/lib/opportunityApi';
import { CalendarEventCard } from '@/components/calendar/CalendarEventCard';
import { EventDetailModal } from '@/components/calendar/EventDetailModal';
import { EventFormModal, type EventFormSaveData } from '@/components/calendar/EventFormModal';
import { eventTypeConfig } from '@/components/calendar/eventTypeConfig';
import { cn } from '@/lib/utils';
import { fetchGoogleEvents, type GoogleEvent } from '@/lib/calendarApi';
import { useAppStore } from '@/store';
import { batchCheckCompanies } from '@/lib/apolloApi';
import type { CalendarEvent, Contact, Opportunity, TaskKind, TaskAssociation, Activity } from '@/types';
import { TASK_KINDS } from '@/types';
import { taskAssociationsFromEntityCtx } from '@/lib/taskAssociationsFromActivity';

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
  return false;
}

type ViewMode = 'month' | 'week' | 'day';

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAYS_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const EVENT_DOT_COLOR: Record<string, string> = {
  llamada: 'bg-blue-500',
  reunion: 'bg-emerald-500',
  tarea: 'bg-violet-500',
  correo: 'bg-amber-500',
  whatsapp: 'bg-green-500',
};

const NEW_ACTIVITY_ACTIONS = [
  { kind: 'llamada' as const, icon: Phone, label: 'Llamada' },
  { kind: 'reunion' as const, icon: CalendarIcon, label: 'Reunión' },
  { kind: 'correo' as const, icon: Mail, label: 'Correo' },
  { kind: 'whatsapp' as const, icon: MessageCircle, label: 'WhatsApp' },
  { kind: 'tarea' as const, icon: ClipboardList, label: 'Tarea' },
];

export default function CalendarioPage() {
  const googleConnected = useAppStore((s) => s.googleConnected);
  const currentUser = useAppStore((s) => s.currentUser);
  const { activeAdvisors } = useUsers();
  const defaultAssigneeId = activeAdvisors[0]?.id ?? '';
  const [localActivities, setLocalActivities] = useState<Activity[]>([]);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [taskKindSubFilter, setTaskKindSubFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadCalendarActivities = useCallback(async () => {
    if (!currentUser?.id) return;
    const assignedTo = userFilter === 'all' ? currentUser.id : userFilter;
    setActivitiesError(null);
    try {
      const data = await fetchActivitiesList({ assignedTo, limit: 5000 });
      setLocalActivities(data);
    } catch (e) {
      setActivitiesError(e instanceof Error ? e.message : 'Error al cargar actividades');
    }
  }, [userFilter, currentUser?.id]);

  useEffect(() => {
    void loadCalendarActivities();
  }, [loadCalendarActivities]);

  const events = useMemo(
    () =>
      localActivities
        .filter((a) => {
          if (a.type === 'tarea') return !!(a.taskKind && TASK_KINDS.includes(a.taskKind));
          return ['llamada', 'reunion', 'correo', 'whatsapp'].includes(a.type);
        })
        .map(activityToCalendarEvent),
    [localActivities],
  );
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [googleEventsLoading, setGoogleEventsLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const [entityLinkOpen, setEntityLinkOpen] = useState(false);
  const [entityLinkValue, setEntityLinkValue] = useState<string>('');
  const [entitySearch, setEntitySearch] = useState('');
  const [entityCategory, setEntityCategory] = useState<'contactos' | 'empresas' | 'oportunidades'>('contactos');
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
  const [linkedTaskPromptOpen, setLinkedTaskPromptOpen] = useState(false);
  const [taskFormDefaultAssociations, setTaskFormDefaultAssociations] = useState<
    TaskAssociation[] | undefined
  >();

  const [quickCreateMenu, setQuickCreateMenu] = useState<{
    day: Date;
    x: number;
    y: number;
  } | null>(null);

  const [taskContacts, setTaskContacts] = useState<Contact[]>([]);
  const [taskOpportunities, setTaskOpportunities] = useState<Opportunity[]>([]);
  const [taskCompanies, setTaskCompanies] = useState<{ name: string; id: string }[]>([]);

  const loadCalendarEntities = useCallback(async () => {
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
    }
  }, []);

  useEffect(() => {
    void loadCalendarEntities();
  }, [loadCalendarEntities]);

  function googleEventToCalendarEvent(ge: GoogleEvent): CalendarEvent {
    const startDate = ge.start.dateTime ? ge.start.dateTime.slice(0, 10) : ge.start.date ?? '';
    const startTime = ge.start.dateTime ? ge.start.dateTime.slice(11, 16) : '00:00';
    const endTime = ge.end.dateTime ? ge.end.dateTime.slice(11, 16) : '23:59';
    return {
      id: `google-${ge.id}`,
      title: ge.summary || '(Sin título)',
      type: 'reunion',
      activityRecordType: 'reunion',
      date: startDate,
      startTime,
      endTime,
      assignedTo: 'google',
      assignedToName: 'Google Calendar',
      status: 'pendiente',
      description: ge.description,
      meetLink: ge.hangoutLink || ge.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri,
      attendees: [
        ...(ge.organizer?.email ? [{ email: ge.organizer.email, name: ge.organizer.displayName, organizer: true }] : []),
        ...(ge.attendees?.filter((a) => a.email !== ge.organizer?.email).map((a) => ({ email: a.email })) ?? []),
      ],
    };
  }

  useEffect(() => {
    if (!quickCreateMenu) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-quick-create]')) setQuickCreateMenu(null);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setQuickCreateMenu(null);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [quickCreateMenu]);

  useEffect(() => {
    if (!googleConnected) { setGoogleEvents([]); return; }
    let cancelled = false;
    async function load() {
      setGoogleEventsLoading(true);
      try {
        const timeMin = startOfMonth(currentDate).toISOString();
        const timeMax = endOfMonth(currentDate).toISOString();
        const raw = await fetchGoogleEvents(100, timeMin, timeMax);
        if (cancelled) return;
        setGoogleEvents(raw.map(googleEventToCalendarEvent));
      } catch {
        if (!cancelled) toast.error('No se pudieron cargar eventos de Google Calendar');
      } finally {
        if (!cancelled) setGoogleEventsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [googleConnected, currentDate]);

  const allCalendarEvents = useMemo(() => [...events, ...googleEvents], [events, googleEvents]);

  const filteredEvents = useMemo(() => {
    return allCalendarEvents.filter((e) => {
      if (userFilter !== 'all' && e.assignedTo !== 'google' && e.assignedTo !== userFilter) return false;
      if (e.assignedTo === 'google') {
        if (typeFilter !== 'all' && typeFilter !== 'reunion') return false;
        return true;
      }
      if (!eventMatchesCalendarTypeFilter(e, typeFilter, taskKindSubFilter)) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      return true;
    });
  }, [allCalendarEvents, userFilter, typeFilter, taskKindSubFilter, statusFilter]);

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

  // Removed goToToday in favor of goToday below

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
      setTaskFormDefaultAssociations(undefined);
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
    setEntitySearch('');
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
      const ctx = activityEntityCtx;
      await apiCreateActivity(payload);
      void loadCalendarActivities();
      setActivityFormKind(null);
      setActivityEntityCtx(null);
      setTaskFormDefaultAssociations(
        taskAssociationsFromEntityCtx(ctx, taskContacts, taskCompanies, taskOpportunities),
      );
      setLinkedTaskPromptOpen(true);
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
      await apiCreateActivity({
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
      void loadCalendarActivities();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear la tarea');
      throw e;
    }
  }

  async function handleSaveEvent(data: EventFormSaveData) {
    const contactId = data.associations.find((a) => a.type === 'contactos')?.id;
    const companyId = data.associations.find((a) => a.type === 'empresas')?.id;
    const opportunityId = data.associations.find((a) => a.type === 'oportunidades')?.id;

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
                taskKind: data.type as TaskKind,
                title: data.title,
                description: data.description ?? '',
                assignedTo: data.assignedTo,
                status: data.status,
                dueDate: data.date,
                startDate: data.date,
                startTime: data.startTime,
              }
            : {
                type: data.type,
                title: data.title,
                description: data.description ?? '',
                assignedTo: data.assignedTo,
                status: data.status,
                dueDate: data.date,
                startDate: data.date,
                startTime: data.startTime,
              };
        await apiUpdateActivity(editingEvent.id, editPayload);
        toast.success('Evento actualizado');
      } else {
        await apiCreateActivity({
          type: data.type,
          title: data.title,
          description: data.description ?? '',
          assignedTo: data.assignedTo,
          dueDate: data.date,
          startDate: data.date,
          startTime: data.startTime,
          contactId,
          companyId,
          opportunityId,
        });
        toast.success('Evento creado');
      }
      void loadCalendarActivities();
      setEditingEvent(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
      throw e;
    }
  }

  const eventTypeOptions = [
    { value: 'all', label: 'Tipos' },
    ...Object.entries(eventTypeConfig).map(([key, config]) => ({ value: key, label: config.label })),
  ];

  const miniDays = useMemo(() => {
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    const cs = startOfWeek(ms);
    const ce = endOfWeek(me);
    return eachDayOfInterval({ start: cs, end: ce });
  }, [currentDate]);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, 'yyyy-MM-dd');
    return eventsByDate.get(key) || [];
  }, [selectedDate, eventsByDate]);

  const headerLabel = useMemo(() => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: es });
    if (viewMode === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(ws, 'd MMM', { locale: es })} - ${format(addDays(ws, 6), 'd MMM yyyy', { locale: es })}`;
    }
    return format(currentDate, "EEEE d 'de' MMMM, yyyy", { locale: es });
  }, [currentDate, viewMode]);

  function goToday() {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  }

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] flex-col overflow-hidden rounded-xl bg-background md:h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-2 border-b px-3 py-2 sm:px-4 sm:py-3 md:flex-row md:items-center md:justify-between md:gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={handlePrev}>
            <ChevronLeft className="size-4" />
          </Button>
          <button onClick={goToday} className="rounded-md px-2 py-1 text-sm font-medium transition-colors hover:bg-muted sm:px-3">
            Hoy
          </button>
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={handleNext}>
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="ml-1 truncate text-base font-semibold capitalize sm:ml-2 sm:text-lg">{headerLabel}</h2>
        </div>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {/* Asesor filter — single select */}
            <div className="flex items-center rounded-md bg-[#13944C]/5 px-1.5">
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="h-8 w-[72px] border-0 bg-transparent px-1 text-sm font-semibold text-[#13944C] shadow-none sm:w-[85px] [&_svg]:hidden">
                  <SelectValue placeholder="Asesor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Asesor</SelectItem>
                  {activeAdvisors.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo filter */}
            <div className="flex items-center rounded-md bg-[#13944C]/5 px-1.5">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-auto gap-1 border-0 bg-transparent px-1 text-sm font-semibold text-[#13944C] shadow-none [&_svg]:hidden">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Modalidad filter — only shown when tipo is 'tarea' */}
            {typeFilter === 'tarea' && (
              <div className="flex items-center rounded-md bg-[#13944C]/5 px-1.5">
                <Select value={taskKindSubFilter} onValueChange={setTaskKindSubFilter}>
                  <SelectTrigger className="h-8 w-auto gap-1 border-0 bg-transparent px-1 text-sm font-semibold text-[#13944C] shadow-none [&_svg]:hidden">
                    <SelectValue placeholder="Mod." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Mod.</SelectItem>
                    {TASK_KINDS.map((k) => <SelectItem key={k} value={k}>{eventTypeConfig[k].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Estado filter */}
            <div className="flex items-center rounded-md bg-[#13944C]/5 px-1.5">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-auto gap-1 border-0 bg-transparent px-1 text-sm font-semibold text-[#13944C] shadow-none [&_svg]:hidden">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Estado</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="completada">Completada</SelectItem>
                  <SelectItem value="en_progreso">En progreso</SelectItem>
                  <SelectItem value="vencida">Vencida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            </div>
            <div className="ml-0 flex rounded-md border p-px sm:ml-1">
            {(['month', 'week', 'day'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'h-8 rounded px-2.5 text-sm font-medium transition-colors sm:px-3',
                  viewMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {mode === 'month' ? 'Mes' : mode === 'week' ? 'Semana' : 'Día'}
              </button>
            ))}
          </div>
          </div>
        </div>


      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Mini-calendario + agenda del día: solo desktop (en móvil la grilla usa todo el ancho) */}
        <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r bg-muted/10 md:flex">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{format(currentDate, 'MMMM yyyy', { locale: es })}</span>
              <div className="flex gap-1">
                <button onClick={() => setCurrentDate((d) => { const m = startOfMonth(d); return subDays(m, 1); })} className="rounded p-1 hover:bg-muted transition-colors">
                  <ChevronLeft className="size-3.5" />
                </button>
                <button onClick={() => setCurrentDate((d) => { const m = endOfMonth(d); return addDays(m, 1); })} className="rounded p-1 hover:bg-muted transition-colors">
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-0 text-center text-[11px] font-semibold text-muted-foreground mb-1">
              {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((d) => <div key={d} className="py-0.5">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-0 text-center text-xs">
              {miniDays.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const hasEvents = eventsByDate.has(key) && eventsByDate.get(key)!.length > 0;
                return (
                  <button key={key} onClick={() => { setSelectedDate(day); setCurrentDate(day); }}
                    className={cn('relative flex items-center justify-center p-1 transition-colors hover:bg-muted/50 rounded',
                      !isSameMonth(day, currentDate) && 'text-muted-foreground/30'
                    )}
                  >
                    <span className={cn('inline-flex size-6 items-center justify-center rounded-full text-xs',
                      isSameDay(day, selectedDate) && 'bg-primary text-primary-foreground',
                      isToday(day) && !isSameDay(day, selectedDate) && 'font-semibold',
                    )}>
                      {format(day, 'd')}
                    </span>
                    {hasEvents && (
                      <span className={cn('absolute -bottom-0.5 size-1 rounded-full',
                        isSameDay(day, selectedDate) ? 'bg-primary-foreground' : 'bg-primary'
                      )} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day events */}
          <div className="flex-1 overflow-y-auto p-3">
            <h3 className="text-sm font-medium mb-2">
              {format(selectedDate, "d 'de' MMMM", { locale: es })}
            </h3>
            {selectedDateEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin actividades este día</p>
            ) : (
              <div className="space-y-1.5">
                {selectedDateEvents.slice(0, 8).map((ev) => (
                  <CalendarEventCard key={ev.id} event={ev} compact onClick={() => { setSelectedEvent(ev); setDetailOpen(true); }} />
                ))}
                {selectedDateEvents.length > 8 && (
                  <p className="text-xs text-muted-foreground pt-1">+{selectedDateEvents.length - 8} más</p>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 flex flex-col">
          {activitiesError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mx-4 mt-4 shrink-0">
              {activitiesError}
            </div>
          )}

          {viewMode === 'month' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid grid-cols-7 border-b shrink-0">
                  {WEEKDAYS.map((d, i) => (
                    <div key={d} className="border-r p-1 text-center text-[11px] font-medium text-foreground last:border-r-0 sm:p-2 sm:text-sm">
                      <span className="sm:hidden">{WEEKDAYS_SHORT[i]}</span>
                      <span className="hidden sm:inline">{d}</span>
                    </div>
                  ))}
                </div>
                <div className="grid auto-rows-[minmax(3.25rem,1fr)] grid-cols-7 sm:auto-rows-fr sm:min-h-[calc(100%-2rem)]">
                  {monthDays.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const dayEvs = eventsByDate.get(key) || [];
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    return (
                      <button key={key} onClick={() => { setSelectedDate(day); setCurrentDate(day); }}
                        onDoubleClick={(e) => { setCurrentDate(day); setQuickCreateMenu({ day, x: e.clientX, y: e.clientY }); }}
                        className={cn(
                          'relative overflow-hidden border-b border-r p-1 text-left transition-colors hover:bg-muted/30 sm:p-1.5',
                          !isCurrentMonth && 'bg-muted/20',
                          isSameDay(day, selectedDate) && 'bg-muted/40 md:bg-transparent',
                        )}
                      >
                        <span className={cn(
                          'inline-flex size-6 items-center justify-center rounded-full text-xs sm:absolute sm:top-1 sm:right-1',
                          isToday(day) && 'bg-primary font-bold text-primary-foreground',
                          isSameDay(day, selectedDate) && !isToday(day) && 'bg-muted font-semibold',
                        )}>
                          {format(day, 'd')}
                        </span>
                        {/* Móvil: puntos de color; desktop: cards de eventos */}
                        <div className="mt-0.5 flex justify-center gap-0.5 sm:hidden">
                          {dayEvs.slice(0, 3).map((ev) => (
                            <span
                              key={ev.id}
                              className={cn(
                                'size-1.5 rounded-full',
                                ev.assignedTo === 'google'
                                  ? 'bg-blue-500'
                                  : EVENT_DOT_COLOR[ev.type] ?? 'bg-primary',
                              )}
                            />
                          ))}
                        </div>
                        <div className="mt-7 hidden space-y-0.5 sm:block">
                          {dayEvs.slice(0, 3).map((ev) => (
                            <CalendarEventCard key={ev.id} event={ev} compact onClick={(e) => { e?.stopPropagation(); setSelectedEvent(ev); setDetailOpen(true); }} />
                          ))}
                          {dayEvs.length > 3 && <span className="pl-1 text-[10px] text-muted-foreground">+{dayEvs.length - 3} más</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Agenda del día seleccionado (reemplaza el aside en móvil) */}
              <div className="max-h-[38%] shrink-0 overflow-y-auto border-t p-3 md:hidden">
                <h3 className="mb-2 text-sm font-medium">
                  {format(selectedDate, "d 'de' MMMM", { locale: es })}
                </h3>
                {selectedDateEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin actividades este día</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedDateEvents.map((ev) => (
                      <CalendarEventCard key={ev.id} event={ev} compact onClick={() => { setSelectedEvent(ev); setDetailOpen(true); }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {viewMode === 'week' && (
            <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
              <div className="flex min-w-[640px] flex-1 flex-col min-h-0">
              <div className="flex shrink-0 border-b">
                <div className="w-14 shrink-0" />
                {weekDays.map((day) => (
                  <div key={day.toISOString()} onClick={() => setSelectedDate(day)}
                    className={cn('flex-1 cursor-pointer border-r p-1.5 text-center transition-colors last:border-r-0 hover:bg-muted/30',
                      isToday(day) && 'bg-muted/50'
                    )}
                  >
                    <div className="mb-1 text-xs text-foreground">{format(day, 'EEE', { locale: es })}</div>
                    <div className={cn('inline-flex size-10 items-center justify-center rounded-full text-xl',
                      isToday(day) && 'bg-primary text-primary-foreground'
                    )}>
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {HOURS.map((hour) => (
                  <div key={hour} className="flex border-b">
                    <div className="w-14 shrink-0 border-r py-0 pr-2 text-right text-[10px] text-muted-foreground">
                      {String(hour).padStart(2, '0')}:00
                    </div>
                    <div className="flex flex-1">
                      {weekDays.map((day) => {
                        const key = format(day, 'yyyy-MM-dd');
                        const dayEvs = (eventsByDate.get(key) || []).filter((e) => {
                          const [h] = e.startTime.split(':').map(Number);
                          return h === hour;
                        });
                        return (
                          <div key={`${key}-${hour}`} className="relative min-h-[48px] flex-1 border-r p-0.5 last:border-r-0">
                            {dayEvs.map((ev) => (
                              <CalendarEventCard key={ev.id} event={ev} compact onClick={() => { setSelectedEvent(ev); setDetailOpen(true); }} />
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>
          )}

          {viewMode === 'day' && (
            <div className="flex-1 overflow-y-auto">
              {selectedDateEvents.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <CalendarIcon className="mx-auto mb-2 size-8 text-muted-foreground/30" />
                  No hay actividades este día
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {HOURS.map((hour) => {
                    const dayEvs = selectedDateEvents.filter((e) => {
                      const [h] = e.startTime.split(':').map(Number);
                      return h === hour;
                    });
                    return dayEvs.length > 0 ? (
                      <div key={hour} className="flex gap-3">
                        <div className="w-14 shrink-0 text-sm text-muted-foreground text-right pt-1">
                          {String(hour).padStart(2, '0')}:00
                        </div>
                        <div className="flex-1 space-y-1">
                          {dayEvs.map((ev) => (
                            <CalendarEventCard key={ev.id} event={ev} onClick={() => { setSelectedEvent(ev); setDetailOpen(true); }} />
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })}
                  {selectedDateEvents.filter((e) => {
                    const [h] = e.startTime.split(':').map(Number);
                    return isNaN(h);
                  }).map((ev) => (
                    <CalendarEventCard key={ev.id} event={ev} onClick={() => { setSelectedEvent(ev); setDetailOpen(true); }} />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {quickCreateMenu && (
        <div
          data-quick-create
          style={{ position: 'fixed', left: quickCreateMenu.x, top: quickCreateMenu.y, zIndex: 9999 }}
          className="min-w-40 rounded-md border bg-popover p-1 shadow-lg"
        >
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Tipo de actividad</p>
          <div className="mt-0.5 border-t" />
          {NEW_ACTIVITY_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.kind}
                type="button"
                onClick={() => { setQuickCreateMenu(null); handleSelectNewActivityKind(a.kind); }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Icon className="size-4 shrink-0 text-[#13944C]" />
                {a.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <Dialog open={entityLinkOpen} onOpenChange={(open) => { setEntityLinkOpen(open); if (!open) { setPendingActivityKind(null); setEntityLinkValue(''); setEntitySearch(''); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Vincular actividad</DialogTitle>
          <DialogDescription>Elige el contacto, empresa u oportunidad relacionada.</DialogDescription></DialogHeader>
          <div className="w-full min-w-0 space-y-3 py-2">
            {/* Tabs */}
            <div className="flex gap-3 border-b pb-2 overflow-x-auto">
              {(['contactos', 'empresas', 'oportunidades'] as const).map((cat) => {
                const count = cat === 'contactos' ? taskContacts.length : cat === 'empresas' ? taskCompanies.length : taskOpportunities.length;
                return (
                  <button key={cat} onClick={() => { setEntityCategory(cat); setEntitySearch(''); }}
                    className={cn('text-xs font-medium transition-colors pb-1 border-b-2',
                      entityCategory === cat ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)} ({count})
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 pl-8 text-xs" placeholder={`Buscar ${entityCategory}...`} value={entitySearch} onChange={(e) => setEntitySearch(e.target.value)} />
            </div>

            {/* Items */}
            <div className="max-h-56 w-full min-w-0 overflow-y-auto space-y-0.5">
              {(() => {
                const q = entitySearch.toLowerCase();
                let items: { value: string; label: string }[];
                if (entityCategory === 'contactos') {
                  items = taskContacts
                    .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.companies?.[0]?.name || '').toLowerCase().includes(q))
                    .map((c) => ({ value: `contact:${c.id}`, label: `${c.name}${c.companies?.[0]?.name ? ` — ${c.companies[0].name}` : ''}` }));
                } else if (entityCategory === 'empresas') {
                  items = taskCompanies
                    .filter((co) => !q || co.name.toLowerCase().includes(q))
                    .map((co) => ({ value: `company:${co.id}`, label: co.name }));
                } else {
                  items = taskOpportunities
                    .filter((o) => !q || o.title.toLowerCase().includes(q))
                    .map((o) => ({ value: `opportunity:${o.id}`, label: o.title }));
                }
                const sliced = items.slice(0, 20);
                return sliced.length > 0 ? sliced.map((item) => {
                  const isSelected = entityLinkValue === item.value;
                  return (
                    <button key={item.value} onClick={() => setEntityLinkValue(isSelected ? '' : item.value)}
                      className={cn('flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-xs text-left transition-colors hover:bg-muted',
                        isSelected && 'bg-primary/10 text-primary'
                      )}>
                      <span className={cn('size-4 rounded-full border-2 flex items-center justify-center shrink-0',
                        isSelected ? 'border-primary' : 'border-muted-foreground/30'
                      )}>
                        {isSelected && <span className="size-2 rounded-full bg-primary" />}
                      </span>
                      <span className="truncate min-w-0 leading-tight">{item.label}</span>
                    </button>
                  );
                }) : (
                  <p className="py-4 text-center text-xs text-muted-foreground">Sin resultados</p>
                );
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEntityLinkOpen(false); setEntitySearch(''); }}>Cancelar</Button>
            <Button className="bg-[#13944C] hover:bg-[#0f7a3d]" disabled={!entityLinkValue} onClick={handleConfirmEntityLink}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activityFormKind && (
        <ActivityFormDialog type={activityFormKind} open={!!activityFormKind}
          onOpenChange={(open) => { if (!open) { setActivityFormKind(null); setActivityEntityCtx(null); } }}
          defaultDate={format(currentDate, 'yyyy-MM-dd')} defaultTime={format(currentDate, 'HH:mm')}
          onSave={handleActivityFormSave}
        />
      )}

      <Dialog open={linkedTaskPromptOpen} onOpenChange={setLinkedTaskPromptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Crear tarea vinculada</DialogTitle>
            <DialogDescription>
              ¿Deseas crear una nueva tarea vinculada a esta actividad?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setLinkedTaskPromptOpen(false)}>
              No, gracias
            </Button>
            <Button
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              onClick={() => {
                setLinkedTaskPromptOpen(false);
                setTaskFormOpen(true);
              }}
            >
              Sí, crear tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskFormDialog open={taskFormOpen} onOpenChange={(open) => {
          setTaskFormOpen(open);
          if (!open) setTaskFormDefaultAssociations(undefined);
        }} title={taskFormDefaultAssociations?.length ? 'Nueva Tarea Vinculada' : 'Nueva tarea'}
        description={taskFormDefaultAssociations?.length
          ? 'Crea una tarea para continuar con el proceso.'
          : 'Crea una tarea vinculada a contacto, empresa u oportunidad.'}
        contacts={taskContacts} companies={taskCompanies} opportunities={taskOpportunities}
        defaultAssigneeId={defaultAssigneeId} defaultStartDate={format(currentDate, 'yyyy-MM-dd')}
        defaultAssociations={taskFormDefaultAssociations}
        onSave={handleCalendarTaskFormSave}
      />

      <EventDetailModal event={selectedEvent} open={detailOpen} onOpenChange={setDetailOpen}
        onEdit={(ev) => { setDetailOpen(false); setEditingEvent(ev); setFormOpen(true); }}
        onDelete={async (ev) => { try { await apiDeleteActivity(ev.id); void loadCalendarActivities(); setDetailOpen(false); setSelectedEvent(null); toast.success('Actividad eliminada'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Error al eliminar'); } }}
      />

      <EventFormModal open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingEvent(null); }}
        event={editingEvent} contacts={taskContacts} companies={taskCompanies} opportunities={taskOpportunities}
        defaultDate={format(currentDate, 'yyyy-MM-dd')} defaultTime={format(currentDate, 'HH:mm')} onSave={handleSaveEvent}
      />
    </div>
  );
}
