import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { useAppStore } from "@/store";
import { useImportJobsStore } from "@/store/importJobsStore";
import * as XLSX from "xlsx";
import {
  Search,
  UserPlus,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  Trash2,
  XCircle,
  Info,
  Filter,
  Globe,
  Users,
  Calendar,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { CrmDataTableSkeleton } from "@/components/shared/CrmListPageSkeleton";
import { formatDateDMY } from "@/lib/formatters";
import {
  flotaProspectosList,
  flotaProspectosImportSheets,
  flotaProspectosImportRows,
  flotaProspectosCounts,
  flotaProspectosSheetNames,
  flotaProspectosSheetPreview,
  flotaProspectosDeleteMany,
  flotaProspectoCreate,
  flotaProspectosSpreadsheets,
  flotaProspectosByPhone,
  fetchOperadores, getOperatorDisplayName,
  type FlotaProspectoRow,
  type FlotaProspectosCounts,
  type OperadorUser,
  type SheetPreviewResponse,
  type SheetsSpreadsheet,
} from "@/lib/flotaProspectosApi";
import { getConductorTelefonos } from "@/lib/flotaConductoresApi";
import { InlineEditCell } from "@/components/shared/InlineEditCell";
import { TableWithStickyScroll } from "@/components/shared/TableWithStickyScroll";
import { Pagination } from "@/components/shared/Pagination";

const ESTADO_OPTIONS = [
  { label: "Nuevo", value: "Nuevo" },
  { label: "Afiliado", value: "Afiliado" },
  { label: "Citado", value: "Citado" },
  { label: "Seguimiento", value: "Seguimiento" },
  { label: "Información", value: "Informacion" },
  { label: "Sin Requisitos", value: "Sin Requisitos" },
  { label: "No Responde", value: "No Responde" },
];

const ASISTENCIA_OPTIONS = [
  { label: "Asistió", value: "Asistió" },
  { label: "No Asistió", value: "No Asistió" },
];

const estadoColors: Record<string, string> = {
  "Nuevo": "text-gray-700 dark:text-gray-300",
  "Afiliado": "text-purple-700 dark:text-purple-300",
  "Citado": "text-blue-700 dark:text-blue-300",
  "Seguimiento": "text-green-700 dark:text-green-300",
  "Informacion": "text-cyan-700 dark:text-cyan-300",
  "Sin Requisitos": "text-red-700 dark:text-red-300",
  "No Responde": "text-yellow-700 dark:text-yellow-300",
};

export default function FlotaProspectos() {
  const navigate = useNavigate();
  const [prospectos, setProspectos] = useState<FlotaProspectoRow[]>([]);
  const [totalProspectos, setTotalProspectos] = useState(0);
  const [counts, setCounts] = useState<FlotaProspectosCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importingFile, setImportingFile] = useState(false);
  const [citadoDialogOpen, setCitadoDialogOpen] = useState(false);
  const [citadoProspectId, setCitadoProspectId] = useState<string | null>(null);
  const [citadoDate, setCitadoDate] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("all");
  const [mesFilter, setMesFilter] = useState("all");
  const [redSocialFilter, setRedSocialFilter] = useState("all");
  const [operadorFilter, setOperadorFilter] = useState("all");
  const [duplicadosFilter, setDuplicadosFilter] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [spreadsheets, setSpreadsheets] = useState<SheetsSpreadsheet[]>([]);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string | undefined>(undefined);
  const [selectedSheet, setSelectedSheet] = useState<string | undefined>(undefined);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<SheetPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSource, setPreviewSource] = useState<'sheets' | 'file'>('sheets');
  const rawImportRowsRef = useRef<any[][] | null>(null);
  const [conductorTelefonos, setConductorTelefonos] = useState<{ phones: Set<string>; codigoByPhone: Record<string, string> }>({
    phones: new Set(),
    codigoByPhone: {},
  });
  const [operadores, setOperadores] = useState<OperadorUser[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProspecto, setNewProspecto] = useState({
    nombreCompleto: "",
    celular: "",
    redSocial: "",
    distrito: "",
    operador: "",
    edad: "",
    modalidad: "",
    anioVehiculo: "",
    placa: "",
    observaciones: "",
  });

  const [duplicateAlert, setDuplicateAlert] = useState<{ nombreCompleto: string; operador: string | null } | null>(null);

  const { hasPermission } = usePermissions();
  const currentUser = useAppStore((s) => s.currentUser);
  const hasVerTodos = hasPermission('flota_prospectos.ver_todos');
  const enqueueJob = useImportJobsStore((s) => s.enqueueJob);
  const completionTick = useImportJobsStore((s) => s.completionTickByEntity['flota-prospecto']);

  const filterOperadores = useMemo(() => {
    if (hasVerTodos) return operadores;
    return operadores.filter((op) => op.name === currentUser.name);
  }, [hasVerTodos, operadores, currentUser.name]);

  const operadorOptions = useMemo(
    () => filterOperadores.map((op) => ({ label: op.name, value: op.name })),
    [filterOperadores],
  );

  const loadSheetNames = useCallback(async (spreadsheetId?: string) => {
    try {
      const res = await flotaProspectosSheetNames(spreadsheetId);
      console.log("Sheets fetched:", res);
      const sheets = res.sheets || [];
      setSheetNames(sheets);
      if (sheets.length > 0) {
        setSelectedSheet((prev) => prev || sheets[0]);
      }
    } catch (e) {
      console.error("Error loading sheets:", e);
      toast.error(e instanceof Error ? e.message : "Error cargando hojas");
    }
  }, []);
  const loadSpreadsheets = useCallback(async () => {
    try {
      const res = await flotaProspectosSpreadsheets();
      const list = res.spreadsheets || [];
      setSpreadsheets(list);
      if (list.length > 0) {
        setSelectedSpreadsheetId((prev) => prev || list[0].id);
      }
    } catch (e) {
      console.error("Error loading spreadsheets:", e);
    }
  }, []);

  useEffect(() => {
    void loadSpreadsheets();
  }, [loadSpreadsheets]);


  useEffect(() => {
    if (selectedSpreadsheetId) {
      setSheetNames([]);
      setSelectedSheet(undefined);
      void loadSheetNames(selectedSpreadsheetId);
    }
  }, [selectedSpreadsheetId, loadSheetNames]);

  // Load conductor telefonos for cross-reference
  useEffect(() => {
    async function loadConductorTelefonos() {
      try {
        const { telefonos, codigoByTelefono } = await getConductorTelefonos();
        setConductorTelefonos({ phones: new Set(telefonos), codigoByPhone: codigoByTelefono });
      } catch (e) {
        console.error("Error loading conductor telefonos:", e);
      }
    }
    void loadConductorTelefonos();
  }, []);

  useEffect(() => {
    fetchOperadores().then(setOperadores).catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchTerm), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Check if searched phone belongs to another operator
  const lastCheckedSearchRef = useRef("");
  useEffect(() => {
    const phone = searchDebounced.trim();
    if (!phone || !/^\d{7,}$/.test(phone) || phone === lastCheckedSearchRef.current) return;
    lastCheckedSearchRef.current = phone;
    flotaProspectosByPhone(phone).then((res) => {
      if (res.found && res.prospecto?.operador) {
        toast.warning(`El número ${phone} ya existe y está asignado a ${res.prospecto.operador} (${res.prospecto.nombreCompleto})`, { duration: 6000 });
      }
    }).catch(() => {});
  }, [searchDebounced]);

  // Load data
  const loadProspectos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await flotaProspectosList({
        page,
        limit: pageSize,
        search: searchDebounced || undefined,
        estado: estadoFilter === "all" ? undefined : estadoFilter,
        duplicados: duplicadosFilter || undefined,
        mes: mesFilter === "all" ? undefined : mesFilter,
        redSocial: redSocialFilter === "all" ? undefined : redSocialFilter,
        operador: operadorFilter === "all" ? undefined : operadorFilter === "__unassigned__" ? "__unassigned__" : (() => {
          const op = operadores.find(o => o.name === operadorFilter);
          if (!op) return operadorFilter;
          const firstName = op.name.split(' ')[0];
          const aliases = [op.name, op.username];
          if (firstName !== op.name && firstName.toLowerCase() !== op.username.toLowerCase()) {
            aliases.push(firstName);
          }
          return aliases.join(',');
        })(),
      });
      
      setProspectos(res.data);
      setTotalProspectos(res.total);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error cargando prospectos",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchDebounced, estadoFilter, duplicadosFilter, mesFilter, redSocialFilter, operadorFilter]);

  const loadCounts = useCallback(async () => {
    try {
      const c = await flotaProspectosCounts();
      setCounts(c);
    } catch {
      /* silently fail */
    }
  }, []);

  // Auto-recargar cuando una importación finaliza
  useEffect(() => {
    if (!completionTick) return;
    void Promise.all([loadProspectos(), loadCounts()]);
  }, [completionTick, loadProspectos, loadCounts]);

  useEffect(() => {
    void loadProspectos();
  }, [loadProspectos]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [searchDebounced, estadoFilter, duplicadosFilter, mesFilter, redSocialFilter, operadorFilter, pageSize]);

  const totalPages = Math.ceil(totalProspectos / pageSize);

  const getConductorCodigo = (celular: string | null): string | null => {
    if (!celular) return null;
    const normalized = celular.replace(/\D/g, '').replace(/^51/, '');
    if (!conductorTelefonos.phones.has(normalized)) return null;
    return conductorTelefonos.codigoByPhone[normalized] ?? null;
  };

  const isConductor = (celular: string | null): boolean => {
    if (!celular) return false;
    const normalized = celular.replace(/\D/g, '').replace(/^51/, '');
    return conductorTelefonos.phones.has(normalized);
  };

  const handleOptimisticSave = useCallback(
    (id: string, field: string, newValue: string | null) => {
      setProspectos((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const updated = { ...p };
          if (field === 'edad' || field === 'anioVehiculo') {
            (updated as any)[field] = newValue != null ? parseInt(newValue, 10) : null;
          } else {
            (updated as any)[field] = newValue;
          }
          return updated;
        }),
      );
    },
    [],
  );

  const getRowClass = (prospecto: FlotaProspectoRow): string => {
    if (isConductor(prospecto.celular)) {
      return "bg-green-50/50 border-l-4 border-l-green-500 dark:bg-green-950/40 dark:border-l-green-400 dark:hover:bg-green-950/60";
    }
    return "hover:bg-muted/50";
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === prospectos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(prospectos.map((p) => p.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDownloadTemplate = useCallback(() => {
    const headers = [
      "FECHA_REGISTRO", "RED_SOCIAL", "CELULAR", "NOMBRE_COMPLETO",
      "EDAD", "OPERADOR", "ESTADO", "MODALIDAD", "PLACA", "ANIO_VEHICULO",
      "DISTRITO", "FECHA_CITA", "ASISTENCIA", "FECHA_AFILIACION",
      "MOVIL", "OBSERVACIONES",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "plantilla_prospectos.xlsx");
    toast.success("Plantilla descargada");
  }, []);

  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingFile(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
      if (json.length < 2) {
        toast.error('El archivo no tiene datos');
        return;
      }
      const rows = json.slice(1).filter((r) => r.some((c) => c != null && String(c).trim() !== ''));
      if (rows.length === 0) {
        toast.error('El archivo no tiene datos');
        return;
      }
      const headers = (json[0] || []).map((h: any) => String(h || '').trim()).filter(Boolean);
      const previewRows = rows.map((r: any[]) => {
        const obj: Record<string, string> = {};
        headers.forEach((h: string, i: number) => {
          if (h) obj[h] = String(r[i] || '');
        });
        return obj;
      });
      rawImportRowsRef.current = [json[0] as any[], ...rows as any[][]];
      setPreviewData({ headers, rows: previewRows, totalRows: previewRows.length });
      setPreviewSource('file');
      setPreviewOpen(true);
    } catch {
      toast.error('Error al leer el archivo');
    } finally {
      setImportingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  async function handleOpenImportPreview() {
    if (!selectedSheet) {
      toast.error("Selecciona una hoja primero");
      return;
    }
    setPreviewLoading(true);
    try {
      const data = await flotaProspectosSheetPreview(selectedSheet, selectedSpreadsheetId);
      setPreviewData(data);
      setPreviewSource('sheets');
      setPreviewOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando vista previa");
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreviewOpen(false);
    setPreviewData(null);
    setPreviewSource('sheets');
    rawImportRowsRef.current = null;
  }

  async function handleConfirmImport() {
    const rows = previewSource === 'file' ? rawImportRowsRef.current : null;
    closePreview();
    setImporting(true);
    try {
      if (rows) {
        const job = await flotaProspectosImportRows(rows);
        enqueueJob(job);
        toast.success("Importación iniciada. Revisá el progreso en la tarjeta de importación.");
      } else {
        const job = await flotaProspectosImportSheets(selectedSheet, selectedSpreadsheetId);
        enqueueJob(job);
        toast.success("Importación iniciada. Revisá el progreso en la tarjeta de importación.");
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al importar",
      );
    } finally {
      setImporting(false);
    }
  }

  async function checkDuplicatePhone(phone: string) {
    if (!phone.trim()) {
      setDuplicateAlert(null);
      return;
    }
    try {
      const res = await flotaProspectosByPhone(phone.trim());
      if (res.found && res.prospecto) {
        setDuplicateAlert(res.prospecto);
      } else {
        setDuplicateAlert(null);
      }
    } catch {
      setDuplicateAlert(null);
    }
  }

  async function handleCreateProspecto() {
    if (!newProspecto.nombreCompleto.trim() || !newProspecto.celular.trim()) {
      toast.error("Nombre y celular son requeridos");
      return;
    }
    setCreating(true);
    try {
      await flotaProspectoCreate({
        nombreCompleto: newProspecto.nombreCompleto.trim(),
        celular: newProspecto.celular.trim(),
        redSocial: newProspecto.redSocial.trim() || null,
        operador: newProspecto.operador.trim() || null,
        modalidad: newProspecto.modalidad.trim() || null,
        distrito: newProspecto.distrito.trim() || null,
        edad: newProspecto.edad ? parseInt(newProspecto.edad, 10) : null,
        anioVehiculo: newProspecto.anioVehiculo ? parseInt(newProspecto.anioVehiculo, 10) : null,
        placa: newProspecto.placa.trim() || null,
        observaciones: newProspecto.observaciones.trim() || null,
        estado: "Nuevo",
      });
      toast.success("Prospecto creado exitosamente");
      setCreateModalOpen(false);
      setNewProspecto({
        nombreCompleto: "",
        celular: "",
        redSocial: "",
        distrito: "",
        operador: "",
        edad: "",
        modalidad: "",
        anioVehiculo: "",
        placa: "",
        observaciones: "",
      });
      await Promise.all([loadProspectos(), loadCounts()]);
    } catch (e) {
      const existing = (e as any).body?.existing;
      if (existing) {
        toast.error((e as Error).message, { duration: 6000 });
        if (existing.operador) {
          toast.warning(`Este número ya está asignado a ${existing.operador} (${existing.nombreCompleto})`, { duration: 6000 });
        }
      } else {
        toast.error(e instanceof Error ? e.message : "Error al crear prospecto");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospectos"
        description="Personas interesadas en unirse a la flota de Taxi Monterrico"
      >
        <div className="flex items-center gap-2">
          <span className="mr-2 text-sm text-muted-foreground">
            Total: {counts?.total ?? "—"}
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="gap-1.5"
                disabled={previewLoading || importing}
              >
                {previewLoading || importing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="size-4" />
                )}
                Sheets
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-4 p-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Spreadsheet</label>
                <Select
                  value={selectedSpreadsheetId ?? ""}
                  onValueChange={(v) => {
                    setSelectedSpreadsheetId(v);
                    setSelectedSheet("");
                  }}
                >
                  <SelectTrigger className="w-full bg-card">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {spreadsheets.map((sp) => (
                      <SelectItem key={sp.id} value={sp.id}>
                        {sp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Hoja</label>
                <Select
                  value={selectedSheet ?? ""}
                  onValueChange={(v) => setSelectedSheet(v)}
                >
                  <SelectTrigger className="w-full bg-card">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sheetNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                className="w-full gap-1.5"
                disabled={!selectedSheet || previewLoading || importing}
                onClick={() => {
                  if (!selectedSheet) {
                    toast.error("Selecciona una hoja");
                    return;
                  }
                  void handleOpenImportPreview();
                }}
              >
                {previewLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="size-4" />
                )}
                {previewLoading ? "Cargando…" : "Importar"}
              </Button>
            </PopoverContent>
          </Popover>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileImport}
          />
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={handleDownloadTemplate}
          >
            <FileSpreadsheet className="size-4" />
            Plantilla
          </Button>
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={importingFile}
            onClick={() => fileInputRef.current?.click()}
          >
            {importingFile ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {importingFile ? "Importando…" : "Importar"}
          </Button>
          <Button className="gap-1.5" onClick={() => setCreateModalOpen(true)}>
            <UserPlus className="size-4" />
            Nuevo Prospecto
          </Button>
        </div>
      </PageHeader>

      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full min-w-0 max-w-[580px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, celular o distrito..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        <Select
          value={estadoFilter}
          onValueChange={(v) => setEstadoFilter(v)}
        >
          <SelectTrigger className="w-32 bg-card shadow-none gap-1.5">
            <Filter className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Estado</SelectItem>
            <SelectItem value="Nuevo">Nuevo</SelectItem>
            <SelectItem value="Afiliado">Afiliado</SelectItem>
            <SelectItem value="Citado">Citado</SelectItem>
            <SelectItem value="Seguimiento">Seguimiento</SelectItem>
            <SelectItem value="Informacion">Información</SelectItem>
            <SelectItem value="Sin Requisitos">Sin Requisitos</SelectItem>
            <SelectItem value="No Responde">No Responde</SelectItem>
          </SelectContent>
        </Select>
        
        <Select
          value={redSocialFilter}
          onValueChange={(v) => setRedSocialFilter(v)}
        >
          <SelectTrigger className="w-32 bg-card shadow-none gap-1.5">
            <Globe className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="Red Social" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Red Social</SelectItem>
            {counts?.redesSociales.map((rs) => (
              <SelectItem key={rs} value={rs}>
                {rs}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={operadorFilter}
          onValueChange={(v) => setOperadorFilter(v)}
        >
          <SelectTrigger className="w-32 bg-card shadow-none gap-1.5">
            <Users className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="Operador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Operador</SelectItem>
            {filterOperadores.map((op) => (
              <SelectItem key={op.id} value={op.name}>
                {op.name}
              </SelectItem>
            ))}
            <SelectItem value="__unassigned__">Sin asignar</SelectItem>
          </SelectContent>
        </Select>

        <Select value={mesFilter} onValueChange={(v) => setMesFilter(v)}>
          <SelectTrigger className="w-28 bg-card shadow-none gap-1.5">
            <Calendar className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mes</SelectItem>
            <SelectItem value="2026-01">Ene 2026</SelectItem>
            <SelectItem value="2026-02">Feb 2026</SelectItem>
            <SelectItem value="2026-03">Mar 2026</SelectItem>
            <SelectItem value="2026-04">Abr 2026</SelectItem>
            <SelectItem value="2026-05">May 2026</SelectItem>
            <SelectItem value="2026-06">Jun 2026</SelectItem>
            <SelectItem value="2026-07">Jul 2026</SelectItem>
            <SelectItem value="2026-08">Ago 2026</SelectItem>
            <SelectItem value="2026-09">Sep 2026</SelectItem>
            <SelectItem value="2026-10">Oct 2026</SelectItem>
            <SelectItem value="2026-11">Nov 2026</SelectItem>
            <SelectItem value="2026-12">Dic 2026</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={duplicadosFilter ? "default" : "outline"}
          className={`gap-1.5 ${duplicadosFilter ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
          onClick={() => setDuplicadosFilter((v) => !v)}
        >
          <AlertTriangle className="size-4" />
          Duplicados
          {counts && counts.duplicados > 0 && (
            <Badge
              variant="secondary"
              className={`ml-1 text-xs ${duplicadosFilter ? "bg-white/20 text-white" : "bg-red-100 text-red-700"}`}
            >
              {counts.duplicados}
            </Badge>
          )}
        </Button>

        {selectedIds.size > 0 && (
          <Button
            variant="destructive"
            className="gap-1.5"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="size-4" />
            Eliminar ({selectedIds.size})
          </Button>
        )}
      </div>

      <TableWithStickyScroll maxHeight="calc(100vh - 18rem)">
        {loading ? (
            <CrmDataTableSkeleton
              columns={[
                { label: "" },
                { label: "F.Registro" },
                { label: "Red Social" },
                { label: "Celular" },
                { label: "Nombres y Apellidos" },
                { label: "Edad" },
                { label: "Operador" },
                { label: "Estado" },
                { label: "Modalidad" },
                { label: "Placa" },
                { label: "Año Veh." },
                { label: "Distrito" },
                { label: "F. Cita" },
                { label: "Asistencia" },
                { label: "F. Afiliacion" },
                { label: "Movil" },
                { label: "Observaciones" },
                { label: "" },
              ]}
              rows={5}
              aria-label="Cargando prospectos"
              className="bg-card"
            />
        ) : (
            <Table containerClassName="overflow-visible" className="min-w-[1300px] [&_td]:border [&_th]:border [&_td]:border-border/50 [&_th]:border-border/50 [&_td]:px-2 [&_th]:px-2 [&_td]:py-2 [&_th]:py-2 bg-transparent border-collapse">
              <TableHeader className="bg-muted sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        selectedIds.size === prospectos.length &&
                        prospectos.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>F.Registro</TableHead>
                  <TableHead>Red Social</TableHead>
                  <TableHead>Celular</TableHead>
                  <TableHead>Nombres y Apellidos</TableHead>
                  <TableHead>Edad</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Modalidad</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Año Veh.</TableHead>
                  <TableHead>Distrito</TableHead>
                  <TableHead>F. Cita</TableHead>
                  <TableHead>Asistencia</TableHead>
                  <TableHead>F. Afiliacion</TableHead>
                  <TableHead>Movil</TableHead>
                  <TableHead className="max-w-[200px]">
                    Observaciones
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prospectos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={18}
                      className="py-12 text-center text-muted-foreground"
                    >
                      {duplicadosFilter
                        ? "No hay prospectos duplicados."
                        : "No se encontraron prospectos con los filtros aplicados."}
                    </TableCell>
                  </TableRow>
                ) : (
                  prospectos.map((prospecto) => (
                    <TableRow
                      key={prospecto.id}
                      className={isConductor(prospecto.celular) ? "bg-green-50/50 border-l-4 border-l-green-500 dark:bg-green-950/40 dark:border-l-green-400" : ""}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(prospecto.id)}
                          onCheckedChange={() => toggleSelectOne(prospecto.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineEditCell
                          value={prospecto.fechaRegistro ? formatDateDMY(prospecto.fechaRegistro) : "—"}
                          fieldId={prospecto.id}
                          fieldKey="fechaRegistro"
                          type="readonly"
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <InlineEditCell
                          value={prospecto.redSocial || ""}
                          fieldId={prospecto.id}
                          fieldKey="redSocial"
                          onSaved={(f, v) => handleOptimisticSave(prospecto.id, f, v)}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineEditCell
                          value={prospecto.celular || ""}
                          fieldId={prospecto.id}
                          fieldKey="celular"
                          onSaved={(f, v) => handleOptimisticSave(prospecto.id, f, v)}
                        >
                          <div>
                            <span>{prospecto.celular || "—"}</span>
                            {(() => {
                              const codigo = getConductorCodigo(prospecto.celular);
                              if (!codigo) return null;
                              return (
                                <span className="block text-[10px] text-emerald-600 font-medium">
                                  {codigo}
                                </span>
                              );
                            })()}
                          </div>
                        </InlineEditCell>
                      </TableCell>
                      <TableCell>
                        <InlineEditCell
                          value={prospecto.nombreCompleto}
                          fieldId={prospecto.id}
                          fieldKey="nombreCompleto"
                          onSaved={(f, v) => handleOptimisticSave(prospecto.id, f, v)}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-medium ${prospecto.esDuplicado ? "text-red-600" : ""}`}
                            >
                              {prospecto.nombreCompleto}
                            </span>
                            {prospecto.esDuplicado && (
                              <Badge
                                variant="outline"
                                className="border-red-200 bg-red-50 text-[10px] text-red-600"
                              >
                                Duplicado
                              </Badge>
        )}
                      </div>
                        </InlineEditCell>
                      </TableCell>
                      <TableCell>
                        <InlineEditCell
                          value={prospecto.edad != null ? String(prospecto.edad) : ""}
                          fieldId={prospecto.id}
                          fieldKey="edad"
                          type="number"
                          onSaved={(f, v) => handleOptimisticSave(prospecto.id, f, v)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <InlineEditCell
                          value={getOperatorDisplayName(prospecto.operador, operadores) || ""}
                          fieldId={prospecto.id}
                          fieldKey="operador"
                          type="select"
                          options={operadorOptions}
                          onSaved={(f, v) => handleOptimisticSave(prospecto.id, f, v)}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineEditCell
                          value={prospecto.estado}
                          fieldId={prospecto.id}
                          fieldKey="estado"
                          type="select"
                          options={ESTADO_OPTIONS}
                          onSaved={(f, v) => {
                            handleOptimisticSave(prospecto.id, f, v);
                            if (v === 'Citado') {
                              setCitadoProspectId(prospecto.id);
                              setCitadoDate(prospecto.fechaCita ? prospecto.fechaCita.split('T')[0] : '');
                              setCitadoDialogOpen(true);
                            }
                          }}
                        >
                          <span className={`text-xs ${estadoColors[prospecto.estado] || ""}`}>
                            {prospecto.estado || "—"}
                          </span>
                        </InlineEditCell>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <InlineEditCell
                          value={prospecto.modalidad || ""}
                          fieldId={prospecto.id}
                          fieldKey="modalidad"
                          onSaved={(f, v) => handleOptimisticSave(prospecto.id, f, v)}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineEditCell
                          value={prospecto.placa || ""}
                          fieldId={prospecto.id}
                          fieldKey="placa"
                          onSaved={(f, v) => handleOptimisticSave(prospecto.id, f, v)}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineEditCell
                          value={prospecto.anioVehiculo != null ? String(prospecto.anioVehiculo) : ""}
                          fieldId={prospecto.id}
                          fieldKey="anioVehiculo"
                          type="number"
                          onSaved={(f, v) => handleOptimisticSave(prospecto.id, f, v)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <InlineEditCell
                          value={prospecto.distrito || ""}
                          fieldId={prospecto.id}
                          fieldKey="distrito"
                          onSaved={(f, v) => handleOptimisticSave(prospecto.id, f, v)}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineEditCell
                          value={prospecto.fechaCita || ""}
                          fieldId={prospecto.id}
                          fieldKey="fechaCita"
                          type="date"
                          onSaved={(f, v) => handleOptimisticSave(prospecto.id, f, v)}
                        >
                          {prospecto.fechaCita
                            ? formatDateDMY(prospecto.fechaCita)
                            : "—"}
                        </InlineEditCell>
                      </TableCell>
                      <TableCell>
                        <InlineEditCell
                          value={prospecto.asistencia || ""}
                          fieldId={prospecto.id}
                          fieldKey="asistencia"
                          type="select"
                          options={ASISTENCIA_OPTIONS}
                          onSaved={(f, v) => handleOptimisticSave(prospecto.id, f, v)}
                        >
                          {prospecto.asistencia ? (
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                prospecto.asistencia === "Asistió" ||
                                prospecto.asistencia === "ASISTIO"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {prospecto.asistencia}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </InlineEditCell>
                      </TableCell>
                      <TableCell>
                        <InlineEditCell
                          value={prospecto.fechaAfiliacion || ""}
                          fieldId={prospecto.id}
                          fieldKey="fechaAfiliacion"
                          type="date"
                          onSaved={(f, v) => handleOptimisticSave(prospecto.id, f, v)}
                        >
                          {prospecto.fechaAfiliacion
                            ? formatDateDMY(prospecto.fechaAfiliacion)
                            : "—"}
                        </InlineEditCell>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        <InlineEditCell
                          value={prospecto.movil || ""}
                          fieldId={prospecto.id}
                          fieldKey="movil"
                          onSaved={(f, v) => handleOptimisticSave(prospecto.id, f, v)}
                        />
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <InlineEditCell
                          value={prospecto.observaciones || ""}
                          fieldId={prospecto.id}
                          fieldKey="observaciones"
                          onSaved={(f, v) => handleOptimisticSave(prospecto.id, f, v)}
                          className="max-w-[180px] truncate"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/flota/prospectos/${prospecto.id}`);
                          }}
                        >
                          <Info className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
        )}
      </TableWithStickyScroll>

      {!loading && (
        <div>
          {selectedIds.size > 0 && (
            <p className="text-xs text-muted-foreground mb-1 text-left italic">
              ({selectedIds.size} seleccionados)
            </p>
          )}
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalProspectos}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="flex h-[min(92vh,880px)] max-h-[92vh] w-[min(96vw,calc(100vw-2rem))] max-w-[min(96vw,87.5rem)] flex-col gap-0 p-0 sm:max-w-[min(96vw,87.5rem)]">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <h2 className="text-lg font-semibold">Vista previa de importación</h2>
            {previewData ? (
              <p className="text-sm text-muted-foreground mt-1">
                {previewData.totalRows} fila(s) total(es) &middot; Confirma para importar.
              </p>
            ) : null}
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden px-6 py-3">
            <div className="h-full overflow-auto rounded-md border" style={{ scrollbarWidth: 'thin' }}>
              {previewData && previewData.rows.length > 0 ? (
                <table className="table-fixed border-collapse [&_td]:border [&_th]:border [&_td]:border-border/50 [&_th]:border-border/50 [&_td]:px-2 [&_th]:px-2 [&_td]:py-2 [&_th]:py-2" style={{ width: 'max-content', minWidth: 'max-content' }}>
                  <thead>
                    <tr>
                      {previewData.headers.map((header) => (
                        <th
                          key={header}
                          className="w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem] h-10 px-2 text-left font-medium whitespace-nowrap text-foreground bg-muted"
                        >
                          <span className="block truncate" title={header}>
                            {header}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row, idx) => (
                      <tr key={idx} className="border-b border-transparent transition-colors hover:bg-muted/50">
                        {previewData.headers.map((header) => (
                          <td
                            key={`${idx}-${header}`}
                            className="w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem] align-top text-xs p-2 whitespace-nowrap"
                          >
                            {String(row[header] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : previewData ? (
                <p className="text-sm text-muted-foreground p-4">
                  No hay filas que mostrar.
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={closePreview}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={importing || !previewData}
              onClick={() => void handleConfirmImport()}
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Importando...
                </>
              ) : (
                "Confirmar importación"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createModalOpen} onOpenChange={(open) => !open && setCreateModalOpen(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo Prospecto</DialogTitle>
            <DialogDescription>
              Agregar un nuevo prospecto a la base de datos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Nombre completo *</label>
              <Input
                value={newProspecto.nombreCompleto}
                onChange={(e) => setNewProspecto({ ...newProspecto, nombreCompleto: e.target.value })}
                placeholder="Nombres y Apellidos"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Celular *</label>
                <Input
                  value={newProspecto.celular}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 9);
                    setNewProspecto({ ...newProspecto, celular: raw });
                    if (duplicateAlert) setDuplicateAlert(null);
                  }}
                  onBlur={() => void checkDuplicatePhone(newProspecto.celular)}
                  placeholder="999999999"
                />
                {duplicateAlert && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
                    Ya existe: {duplicateAlert.nombreCompleto}
                    {duplicateAlert.operador && ` · Asignado a ${duplicateAlert.operador}`}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Edad</label>
                <Input
                  type="number"
                  value={newProspecto.edad}
                  onChange={(e) => setNewProspecto({ ...newProspecto, edad: e.target.value })}
                  placeholder="18"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Placa</label>
                <Input
                  value={newProspecto.placa}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
                    const formatted = raw.length > 3 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw;
                    setNewProspecto({ ...newProspecto, placa: formatted });
                  }}
                  placeholder="ABC-123"
                  maxLength={7}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Año Vehículo</label>
                <Input
                  type="number"
                  value={newProspecto.anioVehiculo}
                  onChange={(e) => setNewProspecto({ ...newProspecto, anioVehiculo: e.target.value })}
                  placeholder="2024"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Red Social</label>
                <Input
                  value={newProspecto.redSocial}
                  onChange={(e) => setNewProspecto({ ...newProspecto, redSocial: e.target.value })}
                  placeholder="Facebook, Instagram..."
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Operador</label>
                <Select
                  value={newProspecto.operador || '__none__'}
                  onValueChange={(v) => setNewProspecto({ ...newProspecto, operador: v === '__none__' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin operador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin operador</SelectItem>
                    {operadores.map((op) => (
                      <SelectItem key={op.id} value={op.name}>
                        {op.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Modalidad</label>
                <Input
                  value={newProspecto.modalidad}
                  onChange={(e) => setNewProspecto({ ...newProspecto, modalidad: e.target.value })}
                  placeholder="Flota propia"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Distrito</label>
                <Input
                  value={newProspecto.distrito}
                  onChange={(e) => setNewProspecto({ ...newProspecto, distrito: e.target.value })}
                  placeholder="Lima, Callao..."
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Observaciones</label>
              <Input
                value={newProspecto.observaciones}
                onChange={(e) => setNewProspecto({ ...newProspecto, observaciones: e.target.value })}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => handleCreateProspecto()} disabled={creating || !!duplicateAlert}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear Prospecto"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={citadoDialogOpen} onOpenChange={setCitadoDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Programar cita</DialogTitle>
            <DialogDescription>Indica la fecha de la cita para el prospecto.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="date"
              value={citadoDate}
              onChange={(e) => setCitadoDate(e.target.value)}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCitadoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!citadoProspectId || !citadoDate) {
                toast.error('Selecciona una fecha');
                return;
              }
              try {
                await api(`/flota-prospectos/${citadoProspectId}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ fechaCita: citadoDate }),
                });
                setCitadoDialogOpen(false);
                await Promise.all([loadProspectos(), loadCounts()]);
                toast.success('Cita programada');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Error al guardar');
              }
            }} disabled={!citadoDate}>
              Guardar cita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => !open && setDeleteDialogOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar prospectos</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar <strong>{selectedIds.size}</strong> prospecto(s)? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await flotaProspectosDeleteMany(Array.from(selectedIds));
                  toast.success(`${selectedIds.size} eliminado(s)`);
                  setSelectedIds(new Set());
                  setDeleteDialogOpen(false);
                  void loadProspectos();
                  void loadCounts();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Error eliminando");
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

