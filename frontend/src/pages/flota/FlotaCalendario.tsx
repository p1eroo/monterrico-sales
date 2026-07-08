import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  isSameDay,
  eachDayOfInterval,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Phone,
  Globe,
  ClipboardList,
  MapPin,
  Car,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { flotaCalendarCitas, type CalendarCita } from "@/lib/flotaProspectosApi";
import { notifyFlotaProspectosRefresh } from "@/lib/flotaProspectosRealtime";

interface CitaEvent {
  prospecto: CalendarCita;
  date: Date;
}

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"];
const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d);
}

type ViewMode = "month" | "week" | "day";

export default function FlotaCalendario() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [prospectos, setProspectos] = useState<CalendarCita[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProspecto, setSelectedProspecto] = useState<CalendarCita | null>(null);

  const openProspectoPopover = useCallback((p: CalendarCita) => {
    setSelectedProspecto(p);
  }, []);

  const citas = useMemo(() => {
    const list: CitaEvent[] = [];
    for (const p of prospectos) {
      if (!p.fechaCita) continue;
      const d = parseDateOnly(p.fechaCita);
      if (!isNaN(d.getTime())) {
        list.push({ prospecto: p, date: d });
      }
    }
    return list;
  }, [prospectos]);

  const citasByDate = useMemo(() => {
    const map = new Map<string, CitaEvent[]>();
    for (const c of citas) {
      const key = format(c.date, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [citas]);

  const selectedCitas = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return citasByDate.get(key) || [];
  }, [selectedDate, citasByDate]);

  useEffect(() => {
    setLoading(true);
    flotaCalendarCitas()
      .then((data) => {
        setProspectos(data);
      })
      .catch(() => toast.error("Error al cargar citas"))
      .finally(() => setLoading(false));
  }, []);

  const navigateMonth = useCallback((dir: number) => {
    setCurrentDate((d) => (dir > 0 ? addMonths(d, 1) : subMonths(d, 1)));
  }, []);

  const navigateWeek = useCallback((dir: number) => {
    setCurrentDate((d) => (dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1)));
  }, []);

  const navigateDay = useCallback((dir: number) => {
    setCurrentDate((d) => (dir > 0 ? addDays(d, 1) : subDays(d, 1)));
  }, []);

  const goToday = useCallback(() => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  }, []);

  const handleNav = useCallback(
    (dir: number) => {
      if (viewMode === "month") navigateMonth(dir);
      else if (viewMode === "week") navigateWeek(dir);
      else navigateDay(dir);
    },
    [viewMode, navigateMonth, navigateWeek, navigateDay],
  );

  const headerLabel = useMemo(() => {
    if (viewMode === "month")
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, "d", { locale: es })} - ${format(end, "d MMM", { locale: es })} ${currentDate.getFullYear()}`;
    }
    return format(currentDate, "d 'de' MMMM 'de' yyyy", { locale: es });
  }, [currentDate, viewMode]);

  // Mini calendar days
  const miniDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentDate]);

  // Month grid days
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentDate]);

  // Week days
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-background shadow-none overflow-hidden h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => handleNav(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <button
            onClick={goToday}
            className="rounded-md px-3 py-1 text-sm font-medium hover:bg-muted transition-colors"
          >
            Hoy
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => handleNav(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="text-xl font-medium ml-2">{headerLabel}</h2>
        </div>
        <div className="flex rounded-md border p-0.5">
          {(["month", "week", "day"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "rounded px-4 py-1.5 text-sm font-medium transition-colors",
                viewMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {mode === "month" ? "Mes" : mode === "week" ? "Semana" : "Día"}
            </button>
          ))}
        </div>
      </div>

      {/* Body: sidebar + main */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-60 shrink-0 border-r flex flex-col overflow-y-auto">
          {/* Mini calendar */}
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {MONTH_NAMES[currentDate.getMonth()]}{" "}
                {currentDate.getFullYear()}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="rounded p-1 hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  onClick={() => navigateMonth(1)}
                  className="rounded p-1 hover:bg-muted transition-colors"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-0 text-center text-[11px] font-semibold text-muted-foreground mb-1">
              {DAY_LETTERS.map((d) => (
                <div key={d} className="py-0.5">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0 text-center text-xs">
              {miniDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const hasCita = citasByDate.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedDate(day);
                      setCurrentDate(day);
                    }}
                    className={cn(
                      "relative flex items-center justify-center p-1 transition-colors hover:bg-muted/50 rounded",
                      !isSameMonth(day, currentDate) &&
                        "text-muted-foreground/30",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-xs",
                        isSameDay(day, selectedDate) &&
                          "bg-primary text-primary-foreground",
                        isToday(day) &&
                          !isSameDay(day, selectedDate) &&
                          "font-semibold",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {hasCita && isSameDay(day, selectedDate) && (
                      <span className="absolute -bottom-0.5 size-1 rounded-full bg-primary-foreground" />
                    )}
                    {hasCita && !isSameDay(day, selectedDate) && (
                      <span className="absolute -bottom-0.5 size-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Events of selected day */}
          <div className="p-3 overflow-y-auto">
            <h3 className="text-sm font-medium mb-2">
              {selectedDate
                ? format(selectedDate, "d 'de' MMMM", { locale: es })
                : "Selecciona un día"}
            </h3>
            {selectedCitas.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin citas este día
              </p>
            ) : (
              <div className="space-y-1">
                {selectedCitas.map((c) => (
                  <div
                    key={c.prospecto.id}
                    className="flex items-start gap-2 rounded-lg p-2"
                  >
                    <Checkbox
                      checked={c.prospecto.asistencia === "Asistió"}
                      onCheckedChange={async (checked) => {
                        const nuevoValor = checked ? "Asistió" : "No Asistió";
                        setProspectos((prev) =>
                          prev.map((p) =>
                            p.id === c.prospecto.id
                              ? { ...p, asistencia: nuevoValor }
                              : p,
                          ),
                        );
                        try {
                          await api(
                            `/flota-prospectos/${c.prospecto.id}`,
                            {
                              method: "PATCH",
                              body: JSON.stringify({
                                asistencia: nuevoValor,
                              }),
                            },
                          );
                          toast.success(
                            `${c.prospecto.nombreCompleto} — ${nuevoValor}`,
                          );
                          notifyFlotaProspectosRefresh();
                        } catch {
                          setProspectos((prev) =>
                            prev.map((p) =>
                              p.id === c.prospecto.id
                                ? { ...p, asistencia: c.prospecto.asistencia }
                                : p,
                            ),
                          );
                        }
                      }}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {c.prospecto.nombreCompleto}
                      </p>
                      {c.prospecto.celular && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.prospecto.celular}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 flex flex-col">
          {/* Month view */}
          {viewMode === "month" && (
            <div className="flex-1 flex flex-col overflow-y-auto">
              <div className="grid grid-cols-7 border-b shrink-0">
                {DAY_NAMES.map((d) => (
                  <div
                    key={d}
                    className="p-2 text-center text-sm font-medium text-foreground border-r last:border-r-0"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                {monthDays.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayCitas = citasByDate.get(key) || [];
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "border-b border-r p-1.5 text-left transition-colors hover:bg-muted/30 relative overflow-hidden",
                        !isSameMonth(day, currentDate) && "bg-muted/20",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-full text-xs",
                          isToday(day) &&
                            "bg-primary text-primary-foreground font-bold",
                          isSameDay(day, selectedDate) &&
                            !isToday(day) &&
                            "bg-muted font-semibold",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {dayCitas.slice(0, 3).map((c) => (
                          <div
                            key={c.prospecto.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openProspectoPopover(c.prospecto);
                            }}
                            className="truncate rounded bg-blue-100 px-1 py-0.5 text-[11px] text-blue-700 cursor-pointer hover:bg-blue-200 transition-colors dark:bg-blue-900/40 dark:text-blue-300"
                          >
                            {c.prospecto.nombreCompleto}
                          </div>
                        ))}
                        {dayCitas.length > 3 && (
                          <span className="text-[10px] text-muted-foreground pl-1">
                            +{dayCitas.length - 3} más
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Week view with hourly grid */}
          {viewMode === "week" && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Day headers */}
              <div className="flex border-b shrink-0">
                <div className="w-14 shrink-0" />
                {weekDays.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "flex-1 p-1.5 text-center cursor-pointer transition-colors hover:bg-muted/30 border-r last:border-r-0",
                        isToday(day) && "bg-muted/50",
                      )}
                    >
                      <div className="text-xs text-foreground mb-1">
                        {format(day, "EEE", { locale: es })}
                      </div>
                      <div
                        className={cn(
                          "inline-flex size-12 items-center justify-center rounded-full text-2xl",
                          isToday(day) &&
                            "bg-primary text-primary-foreground",
                        )}
                      >
                        {format(day, "d")}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time grid */}
              <div className="flex-1 overflow-y-auto">
                <div className="relative" style={{ minHeight: 1440 }}>
                  {/* Hour lines */}
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="flex border-b">
                      <div className="w-14 shrink-0 text-[10px] text-muted-foreground text-right pr-2 py-0 border-r">
                        {String(h).padStart(2, "0")}:00
                      </div>
                      <div className="flex-1 flex">
                        {weekDays.map((day) => {
                          const key = format(day, "yyyy-MM-dd");
                          return (
                            <div
                              key={`${key}-${h}`}
                              className="flex-1 border-r last:border-r-0 min-h-[60px] relative"
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Events positioned in the grid */}
                  {weekDays.map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    const dayCitas = citasByDate.get(key) || [];
                    if (dayCitas.length === 0) return null;
                    const dayIndex = weekDays.findIndex(
                      (d) => format(d, "yyyy-MM-dd") === key,
                    );
                    if (dayIndex === -1) return null;
                    const dayWidth = `calc((100% - 3.5rem) / 7)`;
                    const left = `calc(3.5rem + ${dayIndex} * ${dayWidth})`;
                    return (
                      <div
                        key={`events-${key}`}
                        className="absolute top-0 space-y-0.5 p-0.5"
                        style={{ left, width: dayWidth, pointerEvents: "none" }}
                      >
                        {dayCitas.slice(0, 4).map((c) => (
                          <button
                            key={c.prospecto.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openProspectoPopover(c.prospecto);
                            }}
                            className="w-full truncate rounded bg-blue-100 px-1 py-0.5 text-[10px] text-blue-700 cursor-pointer hover:bg-blue-200 transition-colors dark:bg-blue-900/40 dark:text-blue-300 pointer-events-auto text-left"
                            style={{ pointerEvents: "auto" }}
                          >
                            {c.prospecto.nombreCompleto}
                          </button>
                        ))}
                        {dayCitas.length > 4 && (
                          <span className="text-[9px] text-muted-foreground pl-1">
                            +{dayCitas.length - 4}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Day view with hourly grid */}
          {viewMode === "day" && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto">
                {selectedCitas.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    <CalendarIcon className="mx-auto mb-2 size-8 text-muted-foreground/30" />
                    No hay citas este día
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {selectedCitas.map((c) => (
                      <button
                        key={c.prospecto.id}
                        onClick={() =>
                          openProspectoPopover(c.prospecto)
                        }
                        className="w-full rounded-xl border bg-blue-50 px-4 py-3 text-left transition-colors hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-blue-700 dark:text-blue-300">
                            {c.prospecto.nombreCompleto}
                          </span>
                          {c.prospecto.celular && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="size-3" />
                              {c.prospecto.celular}
                            </span>
                          )}
                        </div>
                        {c.prospecto.distrito && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {c.prospecto.distrito}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Prospecto popover */}
      {selectedProspecto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelectedProspecto(null)}>
          <div className="w-full max-w-sm rounded-xl border bg-background p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-3">{selectedProspecto.nombreCompleto}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
                <span>{format(parseDateOnly(selectedProspecto.fechaCita), "d 'de' MMMM 'de' yyyy", { locale: es })}</span>
              </div>
              {(() => {
                const d = parseDateOnly(selectedProspecto.fechaCita);
                const time = selectedProspecto.fechaCita.split('T')[1]?.substring(0, 5);
                if (!time || time === '00:00') return null;
                return (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-4" />
                    <span>{time} hrs</span>
                  </div>
                );
              })()}
              <div className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-muted-foreground" />
                <span>{selectedProspecto.celular || '—'}</span>
              </div>
              {selectedProspecto.redSocial && (
                <div className="flex items-center gap-2">
                  <Globe className="size-4 shrink-0 text-muted-foreground" />
                  <span>{selectedProspecto.redSocial}</span>
                </div>
              )}
              {selectedProspecto.modalidad && (
                <div className="flex items-center gap-2">
                  <ClipboardList className="size-4 shrink-0 text-muted-foreground" />
                  <span>{selectedProspecto.modalidad}</span>
                </div>
              )}
              {selectedProspecto.anioVehiculo && (
                <div className="flex items-center gap-2">
                  <Car className="size-4 shrink-0 text-muted-foreground" />
                  <span>Año: {selectedProspecto.anioVehiculo}</span>
                </div>
              )}
              {selectedProspecto.distrito && (
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 shrink-0 text-muted-foreground" />
                  <span>{selectedProspecto.distrito}</span>
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedProspecto(null)}>
                Cerrar
              </Button>
              <Button size="sm" onClick={() => { setSelectedProspecto(null); navigate(`/flota/prospectos/${selectedProspecto.id}`); }}>
                Ver detalle
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
