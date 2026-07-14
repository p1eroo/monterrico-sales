import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import {
  Car,
  UserPlus,
  Loader2,
  AlertTriangle,
  Hash,
  CheckCircle2,
  Maximize2,
  CalendarDays,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  getISOWeek,
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  min,
} from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { MultiOperadorFilter } from "@/components/shared/MultiOperadorFilter";
import { DateRangeFilterButton } from "@/components/ui/date-range-filter-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DateRangeCalendar,
  type DateRangeValue,
} from "@/components/shared/DateRangeCalendar";
import { PdfSvgIcon } from "@/components/icons/PdfSvgIcon";
import { XlsSvgIcon } from "@/components/icons/XlsSvgIcon";
import {
  comercialFilterActionClass,
  comercialFilterSurfaceClass,
} from "@/lib/comercialFilterSurface";
import { cn } from "@/lib/utils";
import { useChartTheme } from "@/hooks/useChartTheme";
import { TooltipProvider as UITooltipProvider } from "@/components/ui/tooltip";
import {
  useFlotaReportesData,
  useFlotaReportesOperadorStats,
  useFlotaReportesSunat,
} from "@/hooks/useFlotaReportesData";
import { useFlotaReportesStore } from "@/store/flotaReportesStore";
import {
  ResponsiveContainer,
  Legend,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  ComposedChart,
  Line,
  Tooltip,
} from "recharts";
import { ChartCardBody } from "@/components/shared/ChartCardBody";
import { ConversionDailyMixedChart } from "@/components/flota/ConversionDailyMixedChart";
import { OperadorActivityStackedAreaChart } from "@/components/flota/OperadorActivityStackedAreaChart";
import { OperadorAsignacionesZonaPanel } from "@/components/flota/OperadorAsignacionesZonaPanel";
import { ProspectosStackedTimeBarChart } from "@/components/flota/ProspectosStackedTimeBarChart";
import {
  buildDailyConversionTimeSeries,
  buildProspectosByFuenteBarData,
  buildProspectosByFuenteTimeSeries,
  buildProspectosByZonaBarData,
  buildProspectosByZonaTimeSeries,
  prospectosTimeGranularityLabel,
  resolveProspectosTimeGranularity,
} from "@/lib/flotaProspectosReportUtils";
import {
  buildOperadorActivityByOperatorDailySeries,
  buildOperadorActivityTimeSeries,
  buildOperadorAsignacionesPorDia,
  buildOperadorActividadMetricasPorDia,
  mergeOperadorDetallePorDia,
} from "@/lib/flotaOperadorReportUtils";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur-md border border-border p-4 rounded-xl shadow-2xl min-w-45 ring-1 ring-black/5">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 border-b border-border/50 pb-2 flex items-center justify-between">
          <span>{label}</span>
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-emerald-600" />
              <span className="text-xs font-medium text-foreground/80">
                Servicios
              </span>
            </div>
            <span className="text-sm font-bold tabular-nums">
              {payload[0].value}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-blue-500" />
              <span className="text-xs font-medium text-foreground/80">
                Autorizados
              </span>
            </div>
            <span className="text-sm font-bold tabular-nums">
              {payload[1].value}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function FlotaReportes() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const now = new Date();
    return {
      from: startOfMonth(now),
      to: min([endOfMonth(now), now]),
    };
  });
  const {
    conductores,
    prospectos,
    loadingProspectos,
    loadingConductores,
  } = useFlotaReportesData();
  const chartTheme = useChartTheme();

  const [sunatDateRange, setSunatDateRange] = useState<
    DateRangeValue | undefined
  >({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  });
  const { sunatHistory, loadingSunatReal } =
    useFlotaReportesSunat(sunatDateRange);
  const [conductoresDateRange, setConductoresDateRange] = useState<
    DateRangeValue | undefined
  >({
    from: startOfWeek(subWeeks(new Date(), 3), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  });
  const [conversionModalOpen, setConversionModalOpen] = useState(false);
  const [conductoresModalOpen, setConductoresModalOpen] = useState(false);
  const [fuenteModalOpen, setFuenteModalOpen] = useState(false);
  const [zonaModalOpen, setZonaModalOpen] = useState(false);
  const [actividadModalOpen, setActividadModalOpen] = useState(false);
  const [actividadChartView, setActividadChartView] = useState<'time' | 'operador'>('time');
  const [actividadSelectedDayIndex, setActividadSelectedDayIndex] = useState(-1);
  const [sunatModalOpen, setSunatModalOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfDialogOpen, setExportPdfDialogOpen] = useState(false);
  const [exportPdfSections, setExportPdfSections] = useState<Set<string>>(
    new Set([
      "conversion",
      "conductores",
      "fuente",
      "zona",
      "operador",
      "sunat",
    ]),
  );

  const EXPORT_SECTIONS_CONFIG = [
    { key: "conversion", label: "Conversión" },
    { key: "conductores", label: "Nuevos Conductores" },
    { key: "fuente", label: "Prospectos por Fuente" },
    { key: "zona", label: "Prospectos por Zona" },
    { key: "operador", label: "Actividad por Operador" },
    { key: "sunat", label: "SUNAT - Gestión de Flota" },
  ] as const;

  const STORAGE_KEY = "flota-por-autorizar";
  const [porAutorizarCount, setPorAutorizarCount] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw).length : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    const refresh = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        setPorAutorizarCount(raw ? JSON.parse(raw).length : 0);
      } catch { /* empty */ }
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refresh();
    });
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const { operadorStats, operadorStatsDaily, operadorNames, loadingOperadorStats } =
    useFlotaReportesOperadorStats(dateRange);
  const hasInitialSelection = useRef(
    useFlotaReportesStore.getState().operadorNames.length > 0,
  );
  const [operadorFilterInitialized, setOperadorFilterInitialized] = useState(
    () => useFlotaReportesStore.getState().operadorNames.length > 0,
  );
  const [selectedOperadores, setSelectedOperadores] = useState<Set<string>>(
    () => new Set(useFlotaReportesStore.getState().operadorNames),
  );

  const filteredOperadorStats = useMemo(
    () => operadorStats.filter((s) => selectedOperadores.has(s.operador)),
    [operadorStats, selectedOperadores],
  );

  const operadorFilterActive =
    operadorNames.length > 0 &&
    selectedOperadores.size !== operadorNames.length;

  const reportExportReady =
    !loadingProspectos && (prospectos.length > 0 || conductores.length > 0);

  useEffect(() => {
    if (operadorNames.length === 0) return;
    if (!hasInitialSelection.current) {
      hasInitialSelection.current = true;
      setSelectedOperadores(new Set(operadorNames));
    }
    setOperadorFilterInitialized(true);
  }, [operadorNames]);

  const weeklyData = useMemo(() => {
    if (!conductores.length) return [];

    const weekMap = new Map<
      string,
      {
        nuevos: number;
        nuevosActivos: number;
        weekStart: Date;
        weekEnd: Date;
        weekNum: number;
      }
    >();

    for (const c of conductores) {
      if (!c.fechorregistro) continue;
      let regDate: Date;
      try {
        regDate = parseISO(c.fechorregistro);
        if (isNaN(regDate.getTime())) continue;
      } catch {
        continue;
      }

      const wStart = startOfWeek(regDate, { weekStartsOn: 1 });
      const wEnd = endOfWeek(regDate, { weekStartsOn: 1 });
      const weekNum = getISOWeek(regDate);
      const key = format(wStart, "yyyy-MM-dd");

      const existing = weekMap.get(key) || {
        nuevos: 0,
        nuevosActivos: 0,
        weekStart: wStart,
        weekEnd: wEnd,
        weekNum,
      };
      existing.nuevos += 1;
      if (c.estado !== "RETIRADO") {
        existing.nuevosActivos += 1;
      }
      weekMap.set(key, existing);
    }

    return Array.from(weekMap.values())
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
      .map((w) => ({
        semana: `Sem ${w.weekNum}`,
        rango: `${format(w.weekStart, "dd MMM", { locale: es })} - ${format(w.weekEnd, "dd MMM", { locale: es })}`,
        nuevos: w.nuevos,
        nuevosActivos: w.nuevosActivos,
        weekStartTs: w.weekStart.getTime(),
      }));
  }, [conductores]);

  const filteredWeeklyData = useMemo(() => {
    if (!conductoresDateRange?.from || !conductoresDateRange?.to)
      return weeklyData;
    const start = conductoresDateRange.from.getTime();
    const end = conductoresDateRange.to.getTime() + 86400000;
    return weeklyData.filter(
      (w) => w.weekStartTs >= start && w.weekStartTs <= end,
    );
  }, [weeklyData, conductoresDateRange]);

  const sunatFiltered = useMemo(() => {
    return sunatHistory.filter(
      (s) => s.cliente === "SUNAT" || s.cliente === "SUNAT INTENDENCIA LIMA",
    );
  }, [sunatHistory]);

  const sunatMetrics = useMemo(() => {
    if (sunatFiltered.length === 0 && !loadingSunatReal) {
      return {
        servicios: 0,
        autorizados: 0,
        noAutorizados: 0,
        penalizados: 0,
        porAutorizar: 0,
        nuevosIngresos: 0,
      };
    }

    const authorizedPrefixes = ["0S", "1S", "3S", "5S", "9S"];
    const uniqueMobiles = new Set(
      sunatFiltered.map((s) => s.movil as string | undefined).filter(Boolean),
    );
    let autorizadosCount = 0;
    let noAutorizadosCount = 0;

    uniqueMobiles.forEach((m) => {
      if (authorizedPrefixes.some((p) => (m as string).startsWith(p))) {
        autorizadosCount++;
      } else {
        noAutorizadosCount++;
      }
    });

    const penalizados = sunatFiltered.filter((s) => {
      const m = (s.movil as string) || "";
      return !authorizedPrefixes.some((p) => m.startsWith(p));
    }).length;

    // For Nuevos Ingresos, count drivers created in the selected range
    const rangeStart = sunatDateRange?.from;
    const rangeEnd = sunatDateRange?.to;
    const nuevosIngresos = conductores.filter((c) => {
      if (!rangeStart || !rangeEnd || !c.fechorregistro) return false;
      const regDate = new Date(c.fechorregistro);
      return regDate >= rangeStart && regDate <= rangeEnd;
    }).length;

    return {
      servicios: sunatFiltered.length,
      autorizados: autorizadosCount,
      noAutorizados: noAutorizadosCount,
      penalizados,
      porAutorizar: porAutorizarCount,
      nuevosIngresos,
    };
  }, [
    sunatFiltered,
    conductores,
    loadingSunatReal,
    sunatDateRange,
    porAutorizarCount,
  ]);

  const sunatChartData = useMemo(() => {
    if (!sunatDateRange?.from || !sunatDateRange?.to) {
      return [];
    }

    const interval = eachDayOfInterval({
      start: sunatDateRange.from,
      end: sunatDateRange.to,
    });

    const authorizedPrefixes = ["0S", "1S", "3S", "5S", "9S"];
    const historyMap = new Map<
      string,
      { servicios: number; autorizados: Set<string> }
    >();
    for (const item of sunatFiltered) {
      const d =
        (item.fechareserva as string | undefined) ||
        (item.fechorregistro as string | undefined);
      if (d) {
        const dateKey = d.split("T")[0];
        const current = historyMap.get(dateKey) || {
          servicios: 0,
          autorizados: new Set<string>(),
        };
        current.servicios += 1;

        const movil = item.movil as string | undefined;
        if (movil && authorizedPrefixes.some((p) => movil.startsWith(p))) {
          current.autorizados.add(movil);
        }

        historyMap.set(dateKey, current);
      }
    }

    return interval.map((date) => {
      const dateKey = format(date, "yyyy-MM-dd");
      const dataPoint = historyMap.get(dateKey);
      return {
        name: format(date, "EEE dd", { locale: es }),
        servicios: dataPoint?.servicios || 0,
        autorizados: dataPoint?.autorizados.size || 0,
      };
    });
  }, [sunatFiltered, sunatDateRange]);

  const dailyConversionData = useMemo(
    () => buildDailyConversionTimeSeries(prospectos, dateRange),
    [prospectos, dateRange],
  );

  const prospectosTimeGranularity = useMemo(
    () => resolveProspectosTimeGranularity(dateRange),
    [dateRange],
  );
  const prospectosTimeGranularityText = prospectosTimeGranularityLabel(
    prospectosTimeGranularity,
  );

  const operadorActivityTime = useMemo(
    () =>
      buildOperadorActivityTimeSeries(
        operadorStatsDaily,
        selectedOperadores,
        dateRange,
        prospectosTimeGranularity,
      ),
    [
      operadorStatsDaily,
      selectedOperadores,
      dateRange,
      prospectosTimeGranularity,
    ],
  );

  const operadorActivityByOperatorDaily = useMemo(
    () =>
      buildOperadorActivityByOperatorDailySeries(
        operadorStatsDaily,
        selectedOperadores,
        dateRange,
        prospectosTimeGranularity,
      ),
    [
      operadorStatsDaily,
      selectedOperadores,
      dateRange,
      prospectosTimeGranularity,
    ],
  );

  const resolveProspectOperador = useCallback(
    (raw: string | null) => {
      if (!raw?.trim()) return null;
      const v = raw.trim();
      const exact = operadorNames.find(
        (n) => n.toLowerCase() === v.toLowerCase(),
      );
      if (exact) return exact;
      const byFirst = operadorNames.find(
        (n) => n.split(" ")[0]?.toLowerCase() === v.toLowerCase(),
      );
      if (byFirst) return byFirst;
      return (
        operadorNames.find(
          (n) =>
            n.toLowerCase().includes(v.toLowerCase()) ||
            v.toLowerCase().includes(n.toLowerCase()),
        ) ?? null
      );
    },
    [operadorNames],
  );

  const operadorAsignacionesPorDia = useMemo(
    () =>
      buildOperadorAsignacionesPorDia(
        prospectos,
        dateRange,
        selectedOperadores,
        resolveProspectOperador,
        prospectosTimeGranularity,
      ),
    [
      prospectos,
      dateRange,
      selectedOperadores,
      resolveProspectOperador,
      prospectosTimeGranularity,
    ],
  );

  const operadorActividadMetricasPorDia = useMemo(
    () =>
      buildOperadorActividadMetricasPorDia(
        operadorStatsDaily,
        selectedOperadores,
        dateRange,
        prospectosTimeGranularity,
      ),
    [
      operadorStatsDaily,
      selectedOperadores,
      dateRange,
      prospectosTimeGranularity,
    ],
  );

  const operadorDetallePorDia = useMemo(
    () =>
      mergeOperadorDetallePorDia(
        operadorActividadMetricasPorDia,
        operadorAsignacionesPorDia,
      ),
    [operadorActividadMetricasPorDia, operadorAsignacionesPorDia],
  );

  useEffect(() => {
    if (!actividadModalOpen || actividadChartView !== "operador") return;
    const lastIdx = operadorDetallePorDia.length - 1;
    if (lastIdx < 0) {
      setActividadSelectedDayIndex(-1);
      return;
    }
    const lastWithData = [...operadorDetallePorDia.keys()]
      .reverse()
      .find((i) => operadorDetallePorDia[i].operadores.length > 0);
    setActividadSelectedDayIndex(lastWithData ?? lastIdx);
  }, [actividadModalOpen, actividadChartView, operadorDetallePorDia]);

  const prospectosByFuente = useMemo(
    () => buildProspectosByFuenteBarData(prospectos, dateRange),
    [prospectos, dateRange],
  );

  const prospectosByZona = useMemo(
    () => buildProspectosByZonaBarData(prospectos, dateRange),
    [prospectos, dateRange],
  );

  const prospectosByFuenteTime = useMemo(
    () => buildProspectosByFuenteTimeSeries(prospectos, dateRange),
    [prospectos, dateRange],
  );

  const prospectosByZonaTime = useMemo(
    () => buildProspectosByZonaTimeSeries(prospectos, dateRange),
    [prospectos, dateRange],
  );

  function padExportStamp(d: Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  }

  function handleExportXlsx() {
    const baseName = `reporte-flota_${padExportStamp(new Date())}`;
    const wb = XLSX.utils.book_new();

    const overview: (string | number)[][] = [
      ["Reporte Flota"],
      [
        "Periodo desde",
        dateRange?.from ? format(dateRange.from, "dd/MM/yyyy") : "—",
      ],
      [
        "Periodo hasta",
        dateRange?.to ? format(dateRange.to, "dd/MM/yyyy") : "—",
      ],
      [],
      ["Métrica", "Valor"],
      ["Total prospectos", prospectos.length],
      ["Total conductores", conductores.length],
      ["Servicios SUNAT", sunatMetrics.servicios],
      ["Autorizados", sunatMetrics.autorizados],
      ["No autorizados", sunatMetrics.noAutorizados],
      ["Penalizados", sunatMetrics.penalizados],
      ["Nuevos ingresos", sunatMetrics.nuevosIngresos],
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(overview),
      "Resumen",
    );

    const addSheet = (
      name: string,
      rows: Record<string, string | number>[],
    ) => {
      if (!rows.length) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet([["Sin datos"]]),
          name.slice(0, 31),
        );
        return;
      }
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(rows),
        name.slice(0, 31),
      );
    };

    addSheet(
      "Conversión",
      dailyConversionData.categories.map((fecha, i) => ({
        Fecha: fecha,
        Nuevos: dailyConversionData.nuevos[i] ?? 0,
        Conversiones: dailyConversionData.conversiones[i] ?? 0,
      })),
    );
    addSheet(
      "Nuevos Conductores",
      filteredWeeklyData.map((x) => ({
        Semana: x.semana,
        Nuevos: x.nuevos,
        Activos: x.nuevosActivos,
      })),
    );
    addSheet(
      "Prospectos por Fuente",
      prospectosByFuente.allFuentes.map((x) => ({
        Fuente: x.name,
        Cantidad: x.count,
      })),
    );
    addSheet(
      "Prospectos por Zona",
      prospectosByZona.allZones.map((x) => ({
        Distrito: x.name,
        Cantidad: x.count,
      })),
    );
    addSheet(
      "Actividad Operador",
      operadorActivityTime.categories.map((fecha, i) => ({
        Fecha: fecha,
        Asignados: operadorActivityTime.series[0]?.data[i] ?? 0,
        Chats: operadorActivityTime.series[1]?.data[i] ?? 0,
        Enviados: operadorActivityTime.series[2]?.data[i] ?? 0,
        Recibidos: operadorActivityTime.series[3]?.data[i] ?? 0,
        Llamadas: operadorActivityTime.series[4]?.data[i] ?? 0,
        "Citas programadas": operadorActivityTime.series[5]?.data[i] ?? 0,
      })),
    );
    addSheet(
      "Actividad por Operador",
      filteredOperadorStats.map((x) => ({
        Operador: x.operador,
        Asignados: x.prospectosAsignados,
        "Chats Activos": x.chatsActivos,
        "Mensajes Enviados": x.mensajesEnviados,
        "Mensajes Recibidos": x.mensajesRecibidos,
        Llamadas: x.llamadas,
        "Citas programadas": x.citasProgramadas,
      })),
    );
    addSheet(
      "SUNAT Diario",
      sunatChartData.map((x) => ({
        Fecha: x.name,
        Servicios: x.servicios,
        Autorizados: x.autorizados,
      })),
    );

    XLSX.writeFile(wb, `${baseName}.xlsx`);
    toast.success("Reporte Excel exportado");
  }

  async function handleExportPdf(selectedSections: Set<string>) {
    setExportingPdf(true);
    try {
      const baseName = `reporte-flota_${padExportStamp(new Date())}`;
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const chartIds: Record<string, string> = {
        conversion: "chart-conversion",
        conductores: "chart-conductores",
        fuente: "chart-fuente",
        zona: "chart-zona",
        operador: "chart-operador",
        sunat: "chart-sunat",
      };
      const chartImages: Record<string, string> = {};

      await new Promise((resolve) => setTimeout(resolve, 1000));

      for (const [key, id] of Object.entries(chartIds)) {
        if (!selectedSections.has(key)) continue;
        const cardEl = document.getElementById(id);
        if (!cardEl) continue;
        try {
          const allSvgs = Array.from(cardEl.querySelectorAll("svg"));
          if (allSvgs.length === 0) continue;
          const svgEl = allSvgs.reduce((prev, current) =>
            current.clientHeight > prev.clientHeight ? current : prev,
          );
          if (!svgEl || svgEl.clientHeight < 50) continue;

          const clonedSvg = svgEl.cloneNode(true) as SVGElement;
          const width = svgEl.clientWidth || 800;
          const height = svgEl.clientHeight || 400;
          clonedSvg.setAttribute("width", width.toString());
          clonedSvg.setAttribute("height", height.toString());

          const svgData = new XMLSerializer().serializeToString(clonedSvg);
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const img = new Image();
          canvas.width = width * 2;
          canvas.height = height * 2;

          const svgBlob = new Blob([svgData], {
            type: "image/svg+xml;charset=utf-8",
          });
          const url = URL.createObjectURL(svgBlob);

          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              if (ctx) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                chartImages[key] = canvas.toDataURL("image/png");
              }
              URL.revokeObjectURL(url);
              resolve();
            };
            img.onerror = reject;
            img.src = url;
          });
        } catch (e) {
          console.error(`Error capturando gráfico ${id}:`, e);
        }
      }

      const contentWidth = 182;
      let y = 14;

      doc.setFontSize(16);
      doc.text("Reporte Flota", 14, y);
      y += 8;
      doc.setFontSize(10);
      doc.text(
        `Periodo: ${dateRange?.from ? format(dateRange.from, "dd/MM/yyyy") : "—"} — ${dateRange?.to ? format(dateRange.to, "dd/MM/yyyy") : "—"}`,
        14,
        y,
      );
      y += 10;

      const kpiBody = [
        ["Total prospectos", prospectos.length],
        ["Total conductores", conductores.length],
        ["Servicios SUNAT", sunatMetrics.servicios],
        ["Autorizados", sunatMetrics.autorizados],
        ["No autorizados", sunatMetrics.noAutorizados],
        ["Penalizados", sunatMetrics.penalizados],
        ["Nuevos ingresos", sunatMetrics.nuevosIngresos],
      ];
      autoTable(doc, {
        startY: y,
        head: [["Métrica", "Valor"]],
        body: kpiBody,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [19, 148, 76] },
        margin: { left: 14, right: 14 },
      });
      y =
        (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
          .finalY + 12;

      const sections: {
        key: string;
        title: string;
        head: string[][];
        body: (string | number)[][];
      }[] = [
        {
          key: "conversion",
          title: "Conversión",
          head: [["Fecha", "Nuevos", "Conversiones"]],
          body: dailyConversionData.categories.map((fecha, i) => [
            fecha,
            dailyConversionData.nuevos[i] ?? 0,
            dailyConversionData.conversiones[i] ?? 0,
          ]),
        },
        {
          key: "conductores",
          title: "Nuevos Conductores",
          head: [["Semana", "Nuevos", "Activos"]],
          body: filteredWeeklyData.map((x) => [
            x.semana,
            x.nuevos,
            x.nuevosActivos,
          ]),
        },
        {
          key: "fuente",
          title: "Prospectos por Fuente",
          head: [["Fuente", "Cantidad"]],
          body: prospectosByFuente.allFuentes.map((x) => [x.name, x.count]),
        },
        {
          key: "zona",
          title: "Prospectos por Zona",
          head: [["Distrito", "Cantidad"]],
          body: prospectosByZona.allZones.map((x) => [x.name, x.count]),
        },
        {
          key: "operador",
          title: "Actividad por Operador",
          head: [
            [
              "Operador",
              "Asignados",
              "Chats",
              "Enviados",
              "Recibidos",
              "Llamadas",
              "Citas programadas",
            ],
          ],
          body: filteredOperadorStats.map((x) => [
            x.operador,
            x.prospectosAsignados,
            x.chatsActivos,
            x.mensajesEnviados,
            x.mensajesRecibidos,
            x.llamadas,
            x.citasProgramadas,
          ]),
        },
        {
          key: "sunat",
          title: "SUNAT",
          head: [["Fecha", "Servicios", "Autorizados"]],
          body: sunatChartData.map((x) => [x.name, x.servicios, x.autorizados]),
        },
      ];

      for (const sec of sections) {
        if (!sec.body.length) continue;
        if (!selectedSections.has(sec.key)) continue;
        doc.addPage();
        y = 20;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(sec.title, 14, y);
        doc.setFont("helvetica", "normal");
        y += 10;

        const chartImg = chartImages[sec.key];
        if (chartImg) {
          const imgProps = doc.getImageProperties(chartImg);
          const imgHeight = (imgProps.height * contentWidth) / imgProps.width;
          const maxH = 110;
          const h = Math.min(imgHeight, maxH);
          doc.addImage(chartImg, "PNG", 14, y, contentWidth, h);
          y += h + 10;
        }

        autoTable(doc, {
          startY: y,
          head: sec.head,
          body: sec.body,
          theme: "striped",
          styles: { fontSize: 8 },
          headStyles: { fillColor: [19, 148, 76] },
          margin: { left: 14, right: 14 },
        });
        y =
          (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
            .finalY + 12;
      }

      doc.save(`${baseName}.pdf`);
      toast.success("Reporte PDF exportado");
    } catch {
      toast.error("Error al generar PDF");
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <UITooltipProvider delayDuration={0}>
      <div className="space-y-6">
        <PageHeader
          title="Reportes Flota"
          description="Métricas de prospectos y conductores"
        >
          <DateRangeFilterButton
            value={dateRange}
            onChange={setDateRange}
            placeholder="Seleccionar periodo"
            className={cn(
              "w-full min-[400px]:w-[260px] sm:w-[260px]",
              comercialFilterSurfaceClass,
            )}
          />

          <MultiOperadorFilter
            value={Array.from(selectedOperadores)}
            onChange={(next) => setSelectedOperadores(new Set(next))}
            operadores={operadorNames}
            isActive={operadorFilterActive}
            isInitialized={operadorFilterInitialized}
            className={cn(
              "!h-12 w-full min-[400px]:w-[190px] sm:w-[190px]",
              comercialFilterSurfaceClass,
            )}
          />

          <button
            type="button"
            disabled={!reportExportReady || exportingPdf}
            onClick={() => setExportPdfDialogOpen(true)}
            className={cn(comercialFilterActionClass, "cursor-pointer")}
          >
            {exportingPdf ? (
              <Loader2 className="size-5 shrink-0 animate-spin" />
            ) : (
              <PdfSvgIcon className="size-5 shrink-0" />
            )}
            {exportingPdf ? "Generando…" : "PDF"}
          </button>
          <button
            type="button"
            disabled={!reportExportReady}
            onClick={handleExportXlsx}
            className={cn(comercialFilterActionClass, "cursor-pointer")}
          >
            <XlsSvgIcon className="size-5 shrink-0" />
            Excel
          </button>
        </PageHeader>

        {/* Conversión & Nuevos Conductores */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card id="chart-conversion">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base font-medium">Conversión</CardTitle>
                <p className="text-xs text-muted-foreground capitalize">
                  Distribuido {prospectosTimeGranularityText}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                onClick={() => setConversionModalOpen(true)}
                disabled={
                  loadingProspectos || !dailyConversionData.hasData
                }
                aria-label="Ampliar conversión"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <ChartCardBody
                loading={loadingProspectos}
                isEmpty={!dailyConversionData.hasData}
                variant="bar"
                className="h-80"
                emptyMessage="Sin datos de conversión en el periodo"
              >
                <ConversionDailyMixedChart data={dailyConversionData} />
              </ChartCardBody>
            </CardContent>
          </Card>

          <Card id="chart-operador" className="flex flex-col">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base font-medium">
                  Actividad por Operador
                </CardTitle>
                <p className="text-xs text-muted-foreground capitalize">
                  Distribuido {prospectosTimeGranularityText}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                onClick={() => setActividadModalOpen(true)}
                disabled={
                  loadingOperadorStats || !operadorActivityTime.hasData
                }
                aria-label="Ampliar actividad por operador"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 pb-4">
              <ChartCardBody
                loading={loadingOperadorStats}
                isEmpty={!operadorActivityTime.hasData}
                variant="stackedBar"
                className="flex-1 min-h-0"
                emptyMessage="Sin datos de operadores en el periodo"
              >
                <OperadorActivityStackedAreaChart data={operadorActivityTime} />
              </ChartCardBody>
            </CardContent>
          </Card>
        </div>

        {/* Row 1: Fuente & Zona */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card id="chart-fuente">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base font-medium">
                  Prospectos por Fuente
                </CardTitle>
                <p className="text-xs text-muted-foreground capitalize">
                  Distribuido {prospectosTimeGranularityText}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                onClick={() => setFuenteModalOpen(true)}
                disabled={loadingProspectos || !prospectosByFuenteTime.hasData}
                aria-label="Ampliar prospectos por fuente"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <ChartCardBody
                loading={loadingProspectos}
                isEmpty={!prospectosByFuenteTime.hasData}
                variant="bar"
                className="min-h-87.5"
                emptyMessage="Sin datos en el periodo"
              >
                <ProspectosStackedTimeBarChart data={prospectosByFuenteTime} />
              </ChartCardBody>
            </CardContent>
          </Card>

          <Card id="chart-zona">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base font-medium">Prospectos por Zona</CardTitle>
                <p className="text-xs text-muted-foreground capitalize">
                  Distribuido {prospectosTimeGranularityText}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                onClick={() => setZonaModalOpen(true)}
                disabled={loadingProspectos || !prospectosByZonaTime.hasData}
                aria-label="Ampliar prospectos por zona"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <ChartCardBody
                loading={loadingProspectos}
                isEmpty={!prospectosByZonaTime.hasData}
                variant="bar"
                className="min-h-87.5"
                emptyMessage="Sin datos en el periodo"
              >
                <ProspectosStackedTimeBarChart data={prospectosByZonaTime} />
              </ChartCardBody>
            </CardContent>
          </Card>
        </div>

        {/* Nuevos Conductores & SUNAT */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card id="chart-conductores">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div>
                    <CardTitle className="text-base font-medium">
                      Nuevos Conductores
                    </CardTitle>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-65 justify-start gap-1.5 font-normal"
                      >
                        <CalendarDays className="size-4" />
                        <span
                          className={
                            !conductoresDateRange?.from
                              ? "text-muted-foreground"
                              : ""
                          }
                        >
                          {conductoresDateRange?.from
                            ? `${format(conductoresDateRange.from, "d MMM yyyy", { locale: es })}${conductoresDateRange.to && conductoresDateRange.to.getTime() !== conductoresDateRange.from.getTime() ? ` - ${format(conductoresDateRange.to, "d MMM yyyy", { locale: es })}` : ""}`
                            : "Seleccionar fechas"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="start">
                      <DateRangeCalendar
                        value={conductoresDateRange}
                        onChange={setConductoresDateRange}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                    onClick={() => setConductoresModalOpen(true)}
                    disabled={loadingConductores || filteredWeeklyData.length === 0}
                    aria-label="Ampliar nuevos conductores"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartCardBody
                loading={loadingConductores}
                isEmpty={filteredWeeklyData.length === 0}
                variant="area"
                className="h-80"
                emptyMessage="Sin datos de conductores en el periodo"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredWeeklyData}>
                    <defs>
                      <linearGradient
                        id="gradNuevos"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#3b82f6"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3b82f6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="gradActivos"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#13944C"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#13944C"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={chartTheme.gridStroke}
                      opacity={0.4}
                    />
                    <XAxis
                      dataKey="semana"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      dy={8}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: `1px solid ${chartTheme.tooltipBorder}`,
                        backgroundColor: chartTheme.tooltipBg,
                        color: chartTheme.tooltipText,
                        fontSize: "13px",
                      }}
                      itemStyle={{ color: chartTheme.tooltipText }}
                      labelStyle={{
                        color: chartTheme.tooltipTextMuted,
                        marginBottom: 4,
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="center"
                      height={24}
                      iconType="circle"
                      wrapperStyle={{ fontSize: "12px" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="nuevos"
                      name="Nuevos"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#gradNuevos)"
                      dot={{
                        r: 3,
                        fill: "#3b82f6",
                        strokeWidth: 2,
                        stroke: "#fff",
                      }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="nuevosActivos"
                      name="Activos"
                      stroke="#13944C"
                      strokeWidth={2}
                      fill="url(#gradActivos)"
                      dot={{
                        r: 3,
                        fill: "#13944C",
                        strokeWidth: 2,
                        stroke: "#fff",
                      }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCardBody>
            </CardContent>
          </Card>

          <Card id="chart-sunat">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    SUNAT - Gestión de Flota
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-65 justify-start gap-1.5 font-normal"
                      >
                        <CalendarDays className="size-4" />
                        <span
                          className={
                            !sunatDateRange?.from ? "text-muted-foreground" : ""
                          }
                        >
                          {sunatDateRange?.from
                            ? `${format(sunatDateRange.from, "d MMM yyyy", { locale: es })}${sunatDateRange.to && sunatDateRange.to.getTime() !== sunatDateRange.from.getTime() ? ` - ${format(sunatDateRange.to, "d MMM yyyy", { locale: es })}` : ""}`
                            : "Seleccionar fechas"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="start">
                      <DateRangeCalendar
                        value={sunatDateRange}
                        onChange={setSunatDateRange}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                    onClick={() => setSunatModalOpen(true)}
                    disabled={loadingSunatReal || sunatChartData.length === 0}
                    aria-label="Ampliar SUNAT"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-72 relative">
                {loadingSunatReal && (
                  <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
                    <Loader2 className="size-8 animate-spin text-primary" />
                  </div>
                )}
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={sunatChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={chartTheme.gridStroke}
                      opacity={0.4}
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: chartTheme.axisColor,
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: chartTheme.axisColor, fontSize: 12 }}
                      dx={-10}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ fill: "rgba(0,0,0,0.04)", strokeWidth: 2 }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="center"
                      height={24}
                      iconType="circle"
                      wrapperStyle={{ fontSize: "12px" }}
                    />
                    <Bar
                      dataKey="servicios"
                      fill="#13944C"
                      radius={[4, 4, 0, 0]}
                      barSize={40}
                      name="Servicios Totales"
                    />
                    <Line
                      type="monotone"
                      dataKey="autorizados"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{
                        r: 4,
                        fill: "#3b82f6",
                        strokeWidth: 2,
                        stroke: "#fff",
                      }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      name="Conductores Autorizados"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-6 justify-items-center">
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                    <CheckCircle2 className="size-3 text-emerald-500" />{" "}
                    Autorizados
                  </p>
                  <p className="text-2xl font-bold tracking-tighter tabular-nums">
                    {sunatMetrics?.autorizados ?? 0}
                  </p>
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                    <XCircle className="size-3 text-red-500" /> No Autorizados
                  </p>
                  <p className="text-2xl font-bold tracking-tighter tabular-nums text-red-500">
                    {sunatMetrics?.noAutorizados ?? 0}
                  </p>
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                    <AlertTriangle className="size-3 text-amber-500" />{" "}
                    Penalizados
                  </p>
                  <p className="text-2xl font-bold tracking-tighter tabular-nums text-amber-500">
                    {sunatMetrics?.penalizados ?? 0}
                  </p>
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                    <Hash className="size-3 text-blue-500" /> Servicios
                  </p>
                  <p className="text-2xl font-bold tracking-tighter tabular-nums">
                    {sunatMetrics?.servicios ?? 0}
                  </p>
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                    <Car className="size-3 text-zinc-500" /> Por Autorizar
                  </p>
                  <p className="text-2xl font-bold tracking-tighter tabular-nums">
                    {sunatMetrics?.porAutorizar ?? 0}
                  </p>
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                    <UserPlus className="size-3 text-emerald-600" /> Nuevos Ing.
                  </p>
                  <p className="text-2xl font-bold tracking-tighter tabular-nums text-emerald-600">
                    {sunatMetrics?.nuevosIngresos ?? 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={conversionModalOpen} onOpenChange={setConversionModalOpen}>
        <DialogContent
          className="flex max-h-[min(calc(100dvh-1.5rem),900px)] w-full max-w-[min(100vw-1rem,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,56rem)]"
          showCloseButton
        >
          <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
            <DialogTitle className="pr-8 text-base">
              Conversión
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
            {dailyConversionData.hasData && (
              <ConversionDailyMixedChart
                data={dailyConversionData}
                chartHeight={520}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={conductoresModalOpen}
        onOpenChange={setConductoresModalOpen}
      >
        <DialogContent
          className="flex max-h-[min(calc(100dvh-1.5rem),900px)] w-full max-w-[min(100vw-1rem,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,56rem)]"
          showCloseButton
        >
          <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
            <DialogTitle className="pr-8 text-base">
              Nuevos Conductores
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
            {filteredWeeklyData.length > 0 && (
              <div className="h-130 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredWeeklyData}>
                    <defs>
                      <linearGradient
                        id="modalGradNuevos"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#3b82f6"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3b82f6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="modalGradActivos"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#13944C"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#13944C"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={chartTheme.gridStroke}
                      opacity={0.4}
                    />
                    <XAxis
                      dataKey="semana"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      dy={8}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: `1px solid ${chartTheme.tooltipBorder}`,
                        backgroundColor: chartTheme.tooltipBg,
                        color: chartTheme.tooltipText,
                        fontSize: "13px",
                      }}
                      itemStyle={{ color: chartTheme.tooltipText }}
                      labelStyle={{
                        color: chartTheme.tooltipTextMuted,
                        marginBottom: 4,
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="center"
                      height={24}
                      iconType="circle"
                      wrapperStyle={{ fontSize: "12px" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="nuevos"
                      name="Nuevos"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#modalGradNuevos)"
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="nuevosActivos"
                      name="Activos"
                      stroke="#13944C"
                      strokeWidth={2}
                      fill="url(#modalGradActivos)"
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={fuenteModalOpen} onOpenChange={setFuenteModalOpen}>
        <DialogContent
          className="flex max-h-[min(calc(100dvh-1.5rem),900px)] w-full max-w-[min(100vw-1rem,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,56rem)]"
          showCloseButton
        >
          <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
            <DialogTitle className="pr-8 text-base">
              Prospectos por Fuente
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
            {prospectosByFuenteTime.hasData && (
              <ProspectosStackedTimeBarChart
                data={prospectosByFuenteTime}
                chartHeight={420}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={zonaModalOpen} onOpenChange={setZonaModalOpen}>
        <DialogContent
          className="flex max-h-[min(calc(100dvh-1.5rem),900px)] w-full max-w-[min(100vw-1rem,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,56rem)]"
          showCloseButton
        >
          <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
            <DialogTitle className="pr-8 text-base">
              Prospectos por Zona
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
            {prospectosByZonaTime.hasData && (
              <ProspectosStackedTimeBarChart
                data={prospectosByZonaTime}
                chartHeight={480}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={actividadModalOpen}
        onOpenChange={(open) => {
          setActividadModalOpen(open);
          if (!open) {
            setActividadChartView("time");
            setActividadSelectedDayIndex(-1);
          }
        }}
      >
        <DialogContent
          className="flex max-h-[min(calc(100dvh-1.5rem),960px)] w-full max-w-[min(100vw-1rem,80rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,80rem)]"
          showCloseButton
        >
          <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
            <DialogTitle className="pr-8 text-base">
              Actividad por Operador
            </DialogTitle>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pr-8 pt-3">
              <div className="flex w-fit rounded-md border border-border/80 bg-muted/30 p-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 rounded px-2.5 text-xs font-medium',
                    actividadChartView === 'time' && 'bg-background shadow-sm',
                  )}
                  onClick={() => setActividadChartView('time')}
                >
                  Por tipo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 rounded px-2.5 text-xs font-medium',
                    actividadChartView === 'operador' && 'bg-background shadow-sm',
                  )}
                  onClick={() => setActividadChartView('operador')}
                >
                  Por operador
                </Button>
              </div>
              <p className="text-xs text-muted-foreground capitalize">
                {actividadChartView === 'time'
                  ? `Actividad por tipo · ${prospectosTimeGranularityText}`
                  : `Actividad por operador · ${prospectosTimeGranularityText}`}
              </p>
            </div>
          </DialogHeader>
          <div
            className={cn(
              'min-h-0 w-full flex-1 px-4 pb-5 pt-0 sm:px-6 sm:pb-6',
              actividadChartView === 'operador' &&
                operadorActivityByOperatorDaily.hasData
                ? 'overflow-hidden'
                : 'overflow-y-auto overflow-x-hidden',
            )}
          >
            {actividadChartView === 'time' ? (
              operadorActivityTime.hasData ? (
                <OperadorActivityStackedAreaChart
                  data={operadorActivityTime}
                  chartHeight={580}
                />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Sin datos de operadores en el periodo.
                </p>
              )
            ) : operadorActivityByOperatorDaily.hasData ? (
              <div className="grid h-[580px] min-h-0 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-h-0 overflow-hidden">
                  <ProspectosStackedTimeBarChart
                    data={operadorActivityByOperatorDaily}
                    countLabel="actividad"
                    chartHeight={580}
                    selectedDayIndex={actividadSelectedDayIndex}
                    onDaySelect={setActividadSelectedDayIndex}
                  />
                </div>
                <OperadorAsignacionesZonaPanel
                  data={operadorDetallePorDia}
                  selectedDayIndex={actividadSelectedDayIndex}
                  className="h-full"
                />
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sin actividad de operadores en el periodo.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sunatModalOpen} onOpenChange={setSunatModalOpen}>
        <DialogContent
          className="flex max-h-[min(calc(100dvh-1.5rem),900px)] w-full max-w-[min(100vw-1rem,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,56rem)]"
          showCloseButton
        >
          <DialogHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
            <DialogTitle className="pr-8 text-base">
              SUNAT - Gestión de Flota
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
            {sunatChartData.length > 0 && (
              <div className="h-130 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={sunatChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={chartTheme.gridStroke}
                      opacity={0.4}
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: chartTheme.axisColor,
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: chartTheme.axisColor, fontSize: 12 }}
                      dx={-10}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ fill: "rgba(0,0,0,0.04)", strokeWidth: 2 }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="center"
                      height={24}
                      iconType="circle"
                      wrapperStyle={{ fontSize: "12px" }}
                    />
                    <Bar
                      dataKey="servicios"
                      fill="#13944C"
                      radius={[4, 4, 0, 0]}
                      barSize={60}
                      name="Servicios Totales"
                    />
                    <Line
                      type="monotone"
                      dataKey="autorizados"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{
                        r: 4,
                        fill: "#3b82f6",
                        strokeWidth: 2,
                        stroke: "#fff",
                      }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      name="Conductores Autorizados"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={exportPdfDialogOpen} onOpenChange={setExportPdfDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Exportar PDF</DialogTitle>
            <DialogDescription>
              Selecciona las secciones que quieres incluir en el reporte
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {EXPORT_SECTIONS_CONFIG.map((sec) => (
              <label
                key={sec.key}
                className="flex items-center gap-3 cursor-pointer"
              >
                <Checkbox
                  checked={exportPdfSections.has(sec.key)}
                  onCheckedChange={(checked) => {
                    setExportPdfSections((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(sec.key);
                      else next.delete(sec.key);
                      return next;
                    });
                  }}
                />
                <span className="text-sm font-medium">{sec.label}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExportPdfDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setExportPdfDialogOpen(false);
                void handleExportPdf(exportPdfSections);
              }}
              disabled={exportPdfSections.size === 0 || exportingPdf}
            >
              {exportingPdf ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Exportar ({exportPdfSections.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UITooltipProvider>
  );
}
