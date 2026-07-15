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
import { PdfSvgIcon } from "@/components/icons/PdfSvgIcon";
import { XlsSvgIcon } from "@/components/icons/XlsSvgIcon";
import {
  comercialFilterActionClass,
  comercialFilterSurfaceClass,
} from "@/lib/comercialFilterSurface";
import { cn } from "@/lib/utils";
import { TooltipProvider as UITooltipProvider } from "@/components/ui/tooltip";
import {
  useFlotaReportesData,
  useFlotaReportesOperadorStats,
  useFlotaReportesSunat,
} from "@/hooks/useFlotaReportesData";
import { useFlotaReportesStore } from "@/store/flotaReportesStore";
import { ChartCardBody } from "@/components/shared/ChartCardBody";
import { ConductoresWeeklyAreaChart } from "@/components/flota/ConductoresWeeklyAreaChart";
import { ConversionDailyMixedChart } from "@/components/flota/ConversionDailyMixedChart";
import { OperadorActivityStackedAreaChart } from "@/components/flota/OperadorActivityStackedAreaChart";
import { OperadorAsignacionesZonaPanel } from "@/components/flota/OperadorAsignacionesZonaPanel";
import { ProspectosByFuenteBarChart } from "@/components/flota/ProspectosByFuenteBarChart";
import { ProspectosByZonaBarChart } from "@/components/flota/ProspectosByZonaBarChart";
import { ProspectosStackedTimeBarChart } from "@/components/flota/ProspectosStackedTimeBarChart";
import { SunatDailyMixedChart } from "@/components/flota/SunatDailyMixedChart";
import {
  buildDailyConversionTimeSeries,
  buildProspectosByFuenteBarData,
  buildProspectosByFuenteTimeSeries,
  buildProspectosByZonaBarData,
  buildProspectosByZonaTimeSeries,
  prospectosByFuenteBarHasData,
  prospectosByZonaBarHasData,
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

  const [sunatDateRange, setSunatDateRange] = useState<DateRange | undefined>({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  });
  const { sunatHistory, loadingSunatReal } =
    useFlotaReportesSunat(sunatDateRange);
  const [conductoresDateRange, setConductoresDateRange] = useState<
    DateRange | undefined
  >({
    from: startOfWeek(subWeeks(new Date(), 3), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  });
  const [conversionModalOpen, setConversionModalOpen] = useState(false);
  const [conductoresModalOpen, setConductoresModalOpen] = useState(false);
  const [fuenteModalOpen, setFuenteModalOpen] = useState(false);
  const [zonaModalOpen, setZonaModalOpen] = useState(false);
  const [fuenteModalChartReady, setFuenteModalChartReady] = useState(false);
  const [zonaModalChartReady, setZonaModalChartReady] = useState(false);
  const [fuenteModalTimeReady, setFuenteModalTimeReady] = useState(false);
  const [zonaModalTimeReady, setZonaModalTimeReady] = useState(false);
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
    if (!fuenteModalOpen) {
      setFuenteModalChartReady(false);
      setFuenteModalTimeReady(false);
      return;
    }
    const id = window.setTimeout(() => setFuenteModalChartReady(true), 80);
    return () => window.clearTimeout(id);
  }, [fuenteModalOpen]);

  useEffect(() => {
    if (!fuenteModalChartReady) {
      setFuenteModalTimeReady(false);
      return;
    }
    const id = window.setTimeout(() => setFuenteModalTimeReady(true), 220);
    return () => window.clearTimeout(id);
  }, [fuenteModalChartReady]);

  useEffect(() => {
    if (!zonaModalOpen) {
      setZonaModalChartReady(false);
      setZonaModalTimeReady(false);
      return;
    }
    const id = window.setTimeout(() => setZonaModalChartReady(true), 80);
    return () => window.clearTimeout(id);
  }, [zonaModalOpen]);

  useEffect(() => {
    if (!zonaModalChartReady) {
      setZonaModalTimeReady(false);
      return;
    }
    const id = window.setTimeout(() => setZonaModalTimeReady(true), 220);
    return () => window.clearTimeout(id);
  }, [zonaModalChartReady]);

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

  const prospectosByZonaCardHeight = useMemo(
    () =>
      Math.max(
        360,
        Math.min(480, prospectosByZona.chartRows.length * 30 + 40),
      ),
    [prospectosByZona.chartRows.length],
  );

  const prospectosByFuenteCardHeight = prospectosByZonaCardHeight;

  const flotaTimeSeriesCardHeight = 380;

  const flotaConductoresCardHeight = 400;
  const flotaSunatChartHeight = 360;

  const flotaCardDateFilterClass =
    "w-[248px] !bg-transparent hover:!bg-transparent dark:!bg-transparent dark:hover:!bg-transparent";

  const fuenteModalBarHeight = useMemo(
    () =>
      Math.max(
        280,
        Math.min(520, prospectosByFuente.chartRows.length * 48 + 80),
      ),
    [prospectosByFuente.chartRows.length],
  );

  const zonaModalBarHeight = useMemo(
    () =>
      Math.max(
        320,
        Math.min(720, prospectosByZona.chartRows.length * 38 + 80),
      ),
    [prospectosByZona.chartRows.length],
  );

  const prospectosByFuenteModalHasData =
    prospectosByFuenteTime.hasData ||
    prospectosByFuenteBarHasData(prospectosByFuente);
  const prospectosByZonaModalHasData =
    prospectosByZonaTime.hasData ||
    prospectosByZonaBarHasData(prospectosByZona);

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
            <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 px-5 pt-4 pb-1">
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
                chartHeight={flotaTimeSeriesCardHeight}
                emptyMessage="Sin datos de conversión en el periodo"
              >
                <ConversionDailyMixedChart
                  data={dailyConversionData}
                  chartHeight={flotaTimeSeriesCardHeight}
                />
              </ChartCardBody>
            </CardContent>
          </Card>

          <Card id="chart-operador">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 px-5 pt-4 pb-1">
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
            <CardContent>
              <ChartCardBody
                loading={loadingOperadorStats}
                isEmpty={!operadorActivityTime.hasData}
                variant="stackedBar"
                chartHeight={flotaTimeSeriesCardHeight}
                emptyMessage="Sin datos de operadores en el periodo"
              >
                <OperadorActivityStackedAreaChart
                  data={operadorActivityTime}
                  chartHeight={flotaTimeSeriesCardHeight}
                />
              </ChartCardBody>
            </CardContent>
          </Card>
        </div>

        {/* Row 1: Fuente & Zona */}
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <Card id="chart-fuente" className="h-full w-full">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 px-5 pt-4 pb-1">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base font-medium">
                  Prospectos por Fuente
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Totales del periodo
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                onClick={() => setFuenteModalOpen(true)}
                disabled={
                  loadingProspectos || !prospectosByFuenteModalHasData
                }
                aria-label="Ampliar prospectos por fuente"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="px-5 pb-4 pt-0">
              <ChartCardBody
                loading={loadingProspectos}
                isEmpty={!prospectosByFuenteBarHasData(prospectosByFuente)}
                variant="bar"
                chartHeight={prospectosByFuenteCardHeight}
                emptyMessage="Sin datos en el periodo"
              >
                <ProspectosByFuenteBarChart
                  rows={prospectosByFuente.chartRows}
                  chartHeight={prospectosByFuenteCardHeight}
                />
              </ChartCardBody>
            </CardContent>
          </Card>

          <Card id="chart-zona" className="h-full w-full">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 px-5 pt-4 pb-1">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base font-medium">Prospectos por Zona</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Totales del periodo
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                onClick={() => setZonaModalOpen(true)}
                disabled={loadingProspectos || !prospectosByZonaModalHasData}
                aria-label="Ampliar prospectos por zona"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="px-5 pb-4 pt-0">
              <ChartCardBody
                loading={loadingProspectos}
                isEmpty={!prospectosByZonaBarHasData(prospectosByZona)}
                variant="barHorizontal"
                chartHeight={prospectosByZonaCardHeight}
                emptyMessage="Sin datos en el periodo"
              >
                <ProspectosByZonaBarChart
                  rows={prospectosByZona.chartRows}
                  chartHeight={prospectosByZonaCardHeight}
                />
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
                  <DateRangeFilterButton
                    value={conductoresDateRange}
                    onChange={setConductoresDateRange}
                    placeholder="Seleccionar fechas"
                    className={flotaCardDateFilterClass}
                  />
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
            <CardContent className="pb-4 pt-0">
              <ChartCardBody
                loading={loadingConductores}
                isEmpty={filteredWeeklyData.length === 0}
                variant="area"
                chartHeight={flotaConductoresCardHeight}
                className="min-h-0"
                emptyMessage="Sin datos de conductores en el periodo"
              >
                <ConductoresWeeklyAreaChart
                  rows={filteredWeeklyData}
                  chartHeight={flotaConductoresCardHeight}
                />
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
                  <DateRangeFilterButton
                    value={sunatDateRange}
                    onChange={setSunatDateRange}
                    placeholder="Seleccionar fechas"
                    className={flotaCardDateFilterClass}
                  />
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
            <CardContent className="pb-4 pt-0">
              <ChartCardBody
                loading={loadingSunatReal}
                isEmpty={sunatChartData.length === 0}
                variant="bar"
                chartHeight={flotaSunatChartHeight}
                className="min-h-0"
                emptyMessage="Sin datos SUNAT en el periodo"
              >
                <SunatDailyMixedChart
                  rows={sunatChartData}
                  chartHeight={flotaSunatChartHeight}
                />
              </ChartCardBody>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-6 justify-items-center">
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                    <CheckCircle2 className="size-3 text-[#13944C]" />
                    Autorizados
                  </p>
                  <p
                    className={cn(
                      "text-2xl font-bold tracking-tighter tabular-nums",
                      (sunatMetrics?.autorizados ?? 0) > 0
                        ? "text-[#13944C]"
                        : "text-muted-foreground",
                    )}
                  >
                    {sunatMetrics?.autorizados ?? 0}
                  </p>
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                    <XCircle
                      className={cn(
                        "size-3",
                        (sunatMetrics?.noAutorizados ?? 0) > 0
                          ? "text-red-500"
                          : "text-muted-foreground/60",
                      )}
                    />
                    No Autorizados
                  </p>
                  <p
                    className={cn(
                      "text-2xl font-bold tracking-tighter tabular-nums",
                      (sunatMetrics?.noAutorizados ?? 0) > 0
                        ? "text-red-500"
                        : "text-muted-foreground",
                    )}
                  >
                    {sunatMetrics?.noAutorizados ?? 0}
                  </p>
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                    <AlertTriangle
                      className={cn(
                        "size-3",
                        (sunatMetrics?.penalizados ?? 0) > 0
                          ? "text-amber-500"
                          : "text-muted-foreground/60",
                      )}
                    />
                    Penalizados
                  </p>
                  <p
                    className={cn(
                      "text-2xl font-bold tracking-tighter tabular-nums",
                      (sunatMetrics?.penalizados ?? 0) > 0
                        ? "text-amber-500"
                        : "text-muted-foreground",
                    )}
                  >
                    {sunatMetrics?.penalizados ?? 0}
                  </p>
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                    <Hash className="size-3 text-[#13944C]" />
                    Servicios
                  </p>
                  <p className="text-2xl font-bold tracking-tighter tabular-nums text-foreground">
                    {sunatMetrics?.servicios ?? 0}
                  </p>
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                    <Car className="size-3 text-[#13944C]" />
                    Por Autorizar
                  </p>
                  <p className="text-2xl font-bold tracking-tighter tabular-nums text-foreground">
                    {sunatMetrics?.porAutorizar ?? 0}
                  </p>
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground uppercase flex items-center gap-1.5 font-semibold tracking-tight justify-center">
                    <UserPlus className="size-3 text-[#059669]" />
                    Nuevos Ing.
                  </p>
                  <p
                    className={cn(
                      "text-2xl font-bold tracking-tighter tabular-nums",
                      (sunatMetrics?.nuevosIngresos ?? 0) > 0
                        ? "text-[#059669]"
                        : "text-muted-foreground",
                    )}
                  >
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
              <ConductoresWeeklyAreaChart
                rows={filteredWeeklyData}
                chartHeight={520}
              />
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
            <DialogDescription className="sr-only">
              Totales del periodo y distribución temporal por fuente de registro
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
            {fuenteModalChartReady && prospectosByFuenteModalHasData ? (
              <div className="flex flex-col gap-8">
                {prospectosByFuenteBarHasData(prospectosByFuente) && (
                  <section className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Totales del periodo
                    </p>
                    <ProspectosByFuenteBarChart
                      key="fuente-modal-totals"
                      rows={prospectosByFuente.chartRows}
                      chartHeight={fuenteModalBarHeight}
                    />
                  </section>
                )}
                {fuenteModalTimeReady && prospectosByFuenteTime.hasData && (
                  <section className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground capitalize">
                      Distribuido {prospectosTimeGranularityText}
                    </p>
                    <ProspectosStackedTimeBarChart
                      key="fuente-modal-time"
                      data={prospectosByFuenteTime}
                      chartHeight={420}
                    />
                  </section>
                )}
              </div>
            ) : null}
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
            <DialogDescription className="sr-only">
              Totales del periodo y distribución temporal por zona de registro
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
            {zonaModalChartReady && prospectosByZonaModalHasData ? (
              <div className="flex flex-col gap-8">
                {prospectosByZonaBarHasData(prospectosByZona) && (
                  <section className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Totales del periodo
                    </p>
                    <ProspectosByZonaBarChart
                      key="zona-modal-totals"
                      rows={prospectosByZona.chartRows}
                      chartHeight={zonaModalBarHeight}
                    />
                  </section>
                )}
                {zonaModalTimeReady && prospectosByZonaTime.hasData && (
                  <section className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground capitalize">
                      Distribuido {prospectosTimeGranularityText}
                    </p>
                    <ProspectosStackedTimeBarChart
                      key="zona-modal-time"
                      data={prospectosByZonaTime}
                      chartHeight={420}
                    />
                  </section>
                )}
              </div>
            ) : null}
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
              <SunatDailyMixedChart rows={sunatChartData} chartHeight={520} />
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
