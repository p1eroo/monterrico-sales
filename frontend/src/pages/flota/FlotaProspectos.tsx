import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { initiateConversation, fetchChatwootTemplates, findConversationByPhoneNumber, fetchContactConversations, pickBestContactConversation } from "@/lib/chatwootApi";
import { usePermissions } from "@/hooks/usePermissions";
import { useAppStore } from "@/store";
import { useImportJobsStore } from "@/store/importJobsStore";
import * as XLSX from "xlsx";
import {
  UserPlus,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Info,
  Upload,
  Phone,
  Download,
  Edit2,
  Lock,
  MessageCircle,
  Send,
} from "lucide-react";
import {
  DateRangeCalendar,
  type DateRangeValue,
} from "@/components/shared/DateRangeCalendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  flotaLlamadaCreate,
  fetchOperadores,
  getOperatorDisplayName,
  MODALIDAD_OPTIONS,
  type FlotaProspectoRow,
  type FlotaProspectosCounts,
  type OperadorUser,
  type SheetPreviewResponse,
  type SheetsSpreadsheet,
} from "@/lib/flotaProspectosApi";
import { getConductorTelefonos } from "@/lib/flotaConductoresApi";
import { useFlotaProspectosRealtime, notifyFlotaProspectosRefresh } from "@/lib/flotaProspectosRealtime";
import { InlineEditCell } from "@/components/shared/InlineEditCell";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { TableWithStickyScroll } from "@/components/shared/TableWithStickyScroll";
import { Pagination } from "@/components/shared/Pagination";
import ChatwootInboxPanel from "@/components/flota/ChatwootInboxPanel";

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

const AIRE_ACONDICIONADO_OPTIONS = [
  { label: "SI", value: "SI" },
  { label: "No", value: "No" },
];

const estadoColors: Record<string, string> = {
  Nuevo: "text-gray-700 dark:text-gray-300",
  Afiliado: "text-purple-700 dark:text-purple-300",
  Citado: "text-blue-700 dark:text-blue-300",
  Seguimiento: "text-green-700 dark:text-green-300",
  Informacion: "text-cyan-700 dark:text-cyan-300",
  "Sin Requisitos": "text-red-700 dark:text-red-300",
  "No Responde": "text-yellow-700 dark:text-yellow-300",
};

export default function FlotaProspectos() {
  const navigate = useNavigate();
  const [prospectos, setProspectos] = useState<FlotaProspectoRow[]>([]);
  const [totalProspectos, setTotalProspectos] = useState(0);
  const [counts, setCounts] = useState<FlotaProspectosCounts | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const isFirstLoad = useRef(true);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importingFile, setImportingFile] = useState(false);
  const [citadoDialogOpen, setCitadoDialogOpen] = useState(false);
  const [citadoProspectId, setCitadoProspectId] = useState<string | null>(null);
  const [citadoDate, setCitadoDate] = useState("");
  const [citadoTime, setCitadoTime] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [llamadaProspecto, setLlamadaProspecto] = useState<{
    id: string;
    nombre: string;
  } | null>(null);
  const [llamadaFecha, setLlamadaFecha] = useState("");
  const [llamadaHora, setLlamadaHora] = useState("");
  const [llamadaNotas, setLlamadaNotas] = useState("");
  const [llamadaSaving, setLlamadaSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("all");
  const [fechaRegistroRange, setFechaRegistroRange] = useState<
    DateRangeValue | undefined
  >();
  const [mesImportRange, setMesImportRange] = useState<
    DateRangeValue | undefined
  >();
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
    {},
  );

  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [spreadsheets, setSpreadsheets] = useState<SheetsSpreadsheet[]>([]);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<
    string | undefined
  >(undefined);
  const [selectedSheet, setSelectedSheet] = useState<string | undefined>(
    undefined,
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<SheetPreviewResponse | null>(
    null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSource, setPreviewSource] = useState<"sheets" | "file">(
    "sheets",
  );
  const rawImportRowsRef = useRef<any[][] | null>(null);
  const [conductorTelefonos, setConductorTelefonos] = useState<{
    phones: Set<string>;
    codigoByPhone: Record<string, string>;
  }>({
    phones: new Set(),
    codigoByPhone: {},
  });
  const [operadores, setOperadores] = useState<OperadorUser[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editProspectoId, setEditProspectoId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editData, setEditData] = useState({
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

  useEffect(() => {
    if (!editProspectoId) return;
    api<Record<string, unknown>>(`/flota-prospectos/${editProspectoId}`)
      .then((data) => {
        const fullObs = String(data.observaciones || "");
        const latest = fullObs.split(/\n?---\n?/)[0].replace(/^(?:\[.+?\]\s*)+/, "").trim();
        setEditData({
          nombreCompleto: String(data.nombreCompleto || ""),
          celular: String(data.celular || ""),
          redSocial: String(data.redSocial || ""),
          distrito: String(data.distrito || ""),
          operador: String(data.operador || ""),
          edad: data.edad != null ? String(data.edad) : "",
          modalidad: String(data.modalidad || ""),
          anioVehiculo: data.anioVehiculo != null ? String(data.anioVehiculo) : "",
          placa: String(data.placa || ""),
          observaciones: latest,
        });
      })
      .catch(() => toast.error("No se pudo cargar el prospecto"));
  }, [editProspectoId]);
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

  const [duplicateAlert, setDuplicateAlert] = useState<{
    nombreCompleto: string;
    operador: string | null;
  } | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const abortRef = useRef<AbortController | null>(null);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const setPage = useCallback(
    (newPage: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (newPage > 1) {
          next.set('page', String(newPage));
        } else {
          next.delete('page');
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [blockedProspects, setBlockedProspects] = useState<FlotaProspectoRow[]>([]);
  const [modalidadFilter, setModalidadFilter] = useState("all");
  const [aireAcondicionadoFilter, setAireAcondicionadoFilter] = useState("all");
  const [redSocialFilter, setRedSocialFilter] = useState("all");
  const [operadorFilter, setOperadorFilter] = useState("all");
  const [pageSize, setPageSize] = useState(25);
  const [duplicadosFilter, setDuplicadosFilter] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [conLlamadasFilter, setConLlamadasFilter] = useState("all");
  const [fechasOpen, setFechasOpen] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [chatActiveId, setChatActiveId] = useState<number | null>(null);
  const [chatInitialContact, setChatInitialContact] = useState<{ name?: string; phone?: string } | null>(null);
  const [openingChatProspectoId, setOpeningChatProspectoId] = useState<string | null>(null);
  const [newChatData, setNewChatData] = useState<{ phone: string; name: string; operador?: string } | null>(null);
  const [newChatTemplates, setNewChatTemplates] = useState<{ name: string; language: string; category: string; content?: string }[]>([]);
  const [newChatSelected, setNewChatSelected] = useState('afiliacion_atu');
  const [newChatLoadingTpl, setNewChatLoadingTpl] = useState(false);
  const [newChatSending, setNewChatSending] = useState(false);


  const blockedProspectsRef = useRef(blockedProspects);
  blockedProspectsRef.current = blockedProspects;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const columnFiltersRef = useRef(columnFilters);
  columnFiltersRef.current = columnFilters;
  const operadoresRef = useRef(operadores);
  operadoresRef.current = operadores;
  const conductorTelefonosRef = useRef(conductorTelefonos);
  conductorTelefonosRef.current = conductorTelefonos;
  const openingChatProspectoIdRef = useRef(openingChatProspectoId);
  openingChatProspectoIdRef.current = openingChatProspectoId;

  const columns = useMemo<ColumnDef<FlotaProspectoRow>[]>(
    () => [
      {
        id: "select",
        header: "",
        enableSorting: false,
        enableColumnFilter: false,
        size: 40,
        minSize: 40,
        maxSize: 40,
        cell: ({ row }) => {
          const isBlocked = blockedProspectsRef.current.some(
            (bp) => bp.id === row.original.id,
          );
          return (
            <div
              className="flex justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {isBlocked ? (
                <Lock className="size-3.5 text-muted-foreground" />
              ) : (
                <Checkbox
                  checked={selectedIdsRef.current.has(row.original.id)}
                  onCheckedChange={() => {
                    const id = row.original.id;
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    });
                  }}
                />
              )}
            </div>
          );
        },
      },
      {
        id: "fechaRegistro",
        header: "F.Registro",
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div>
            <div>
              {row.original.fechaRegistro
                ? formatDateDMY(row.original.fechaRegistro)
                : "—"}
            </div>
            {row.original.origen === "IMPORTADO" &&
              row.original.createdAt && (
                <div className="text-[9px] text-muted-foreground mt-0.5">
                  FI:{" "}
                  {new Date(row.original.createdAt).toLocaleDateString(
                    "es-PE",
                    {
                      timeZone: "America/Lima",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    },
                  )}
                </div>
              )}
          </div>
        ),
      },
      {
        accessorKey: "redSocial",
        id: "redSocial",
        header: "Red Social",
        size: 90,
        enableColumnFilter: false,
        cell: ({ getValue }) => (
          <span
            className="truncate block max-w-[80px] text-[10px]"
            title={String(getValue() ?? "")}
          >
            {String(getValue() ?? "") || "—"}
          </span>
        ),
      },
      {
        accessorKey: "celular",
        id: "celular",
        header: "Celular",
        size: 110,
        cell: ({ getValue, row }) => {
          const phone = String(getValue() ?? "");
          const codigo = getConductorCodigo(row.original.celular);
          const isBlocked = blockedProspectsRef.current.some(
            (bp) => bp.id === row.original.id,
          );
          return (
            <div className="relative">
              <span
                className="truncate block max-w-[90px]"
                title={phone}
              >
                {phone || "—"}
              </span>
                {phone && (
                <div
                  className={`absolute inset-0 flex items-center justify-center transition-opacity bg-background/70 rounded z-10 ${
                    openingChatProspectoId === row.original.id
                      ? 'opacity-100 cursor-wait'
                      : 'opacity-0 hover:opacity-100 cursor-pointer'
                  }`}
                  onClick={async (e) => {
                    e.stopPropagation();
                    const p = row.original;
                    if (openingChatProspectoIdRef.current === p.id) return;
                    const digits = (p.celular || '').replace(/\D/g, '');
                    if (!digits) return;
                    const fullPhone = digits.length === 9 ? `+51${digits}` : `+${digits}`;
                    setOpeningChatProspectoId(p.id);
                    try {
                      const openExisting = (conversationId: number) => {
                        setChatInitialContact({
                          name: p.nombreCompleto,
                          phone: fullPhone,
                        });
                        setChatActiveId(conversationId);
                        setChatPanelOpen(true);
                      };
                      if (p.chatwootConversationId) {
                        openExisting(p.chatwootConversationId);
                        return;
                      }
                      const existing = await findConversationByPhoneNumber(fullPhone);
                      if (existing) {
                        openExisting(existing.id);
                        return;
                      }
                      if (p.chatwootContactId) {
                        const convs = await fetchContactConversations(p.chatwootContactId);
                        const best = pickBestContactConversation(convs);
                        if (best) {
                          openExisting(best.id);
                          return;
                        }
                      }
                      setNewChatData({
                        phone: fullPhone,
                        name: p.nombreCompleto,
                        operador: p.operador || undefined,
                      });
                    } catch {
                      toast.error('Error al abrir el chat');
                    } finally {
                      setOpeningChatProspectoId(null);
                    }
                  }}
                >
                  {openingChatProspectoId === row.original.id ? (
                    <Loader2 className="size-5 animate-spin text-primary" />
                  ) : (
                    <MessageCircle className="size-5 text-primary" />
                  )}
                </div>
              )}
              {isBlocked && (
                <span className="block text-[10px] text-muted-foreground italic">
                  Operador no editable
                </span>
              )}
              {codigo && (
                <span className="block text-[10px] text-emerald-600 font-medium truncate max-w-[100px]">
                  {codigo}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "nombreCompleto",
        id: "nombreCompleto",
        header: "Nombres y Apellidos",
        cell: ({ getValue, row }) => (
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-medium ${row.original.esDuplicado ? "text-red-600" : ""}`}
            >
              {String(getValue() ?? "")}
            </span>
            {row.original.esDuplicado && (
              <Badge
                variant="outline"
                className="border-red-200 bg-red-50 text-[10px] text-red-600"
              >
                Duplicado
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "edad",
        id: "edad",
        header: "Edad",
        size: 60,
        cell: ({ getValue }) =>
          getValue() != null ? (
            <span className="text-[10px]">{String(getValue())}</span>
          ) : (
            <span className="text-[10px]">—</span>
          ),
      },
      {
        accessorFn: (r) => {
          const ops = operadoresRef.current;
          return getOperatorDisplayName(r.operador, ops) ||
            r.operador ||
            "";
        },
        id: "operador",
        header: "Operador",
        size: 110,
        enableColumnFilter: false,
        cell: ({ getValue }) => {
          const name = String(getValue() ?? "") || "—";
          return (
            <span
              className="truncate block max-w-[100px] text-[10px]"
              title={name}
            >
              {name}
            </span>
          );
        },
      },
      {
        accessorFn: (r) => r._count?.llamadas ?? 0,
        id: "llamadas",
        header: "Llamadas",
        size: 70,
        enableColumnFilter: false,
        cell: ({ getValue }) => {
          const count = Number(getValue() ?? 0);
          return count > 0 ? (
            <span className="flex items-center gap-0.5 text-xs text-blue-600 dark:text-blue-400">
              <Phone className="h-3 w-3" />
              {count}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: "estado",
        id: "estado",
        header: "Estado",
        size: 90,
        enableColumnFilter: false,
        cell: ({ getValue }) => {
          const val = String(getValue() ?? "");
          return (
            <span
              className={`text-[10px] truncate block max-w-[80px] ${val ? estadoColors[val] || "" : ""}`}
            >
              {val || "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "modalidad",
        id: "modalidad",
        header: "Modalidad",
        size: 100,
        enableColumnFilter: false,
        cell: ({ getValue }) => (
          <span
            className="truncate block max-w-[90px] text-[10px]"
            title={String(getValue() ?? "")}
          >
            {String(getValue() ?? "") || "—"}
          </span>
        ),
      },
      {
        accessorKey: "placa",
        id: "placa",
        header: "Placa",
        size: 90,
        cell: ({ getValue }) => (
          <span
            className="truncate block max-w-[80px] text-[10px]"
            title={String(getValue() ?? "")}
          >
            {String(getValue() ?? "") || "—"}
          </span>
        ),
      },
      {
        accessorKey: "aireAcondicionado",
        id: "aireAcondicionado",
        header: "A.C.",
        size: 70,
        cell: ({ getValue }) => (
          <span className="text-[10px]" title={String(getValue() ?? "")}>
            {String(getValue() ?? "") || "—"}
          </span>
        ),
      },
      {
        accessorKey: "anioVehiculo",
        id: "anioVehiculo",
        header: "Año Veh.",
        size: 65,
        cell: ({ getValue }) =>
          getValue() != null ? (
            <span className="text-[10px]">{String(getValue())}</span>
          ) : (
            <span className="text-[10px]">—</span>
          ),
      },
      {
        accessorKey: "distrito",
        id: "distrito",
        header: "Zona",
        size: 100,
        cell: ({ getValue }) => (
          <span
            className="truncate block max-w-[90px] text-[10px]"
            title={String(getValue() ?? "")}
          >
            {String(getValue() ?? "") || "—"}
          </span>
        ),
      },
      {
        accessorKey: "fechaCita",
        id: "fechaCita",
        header: "F. Cita",
        size: 130,
        cell: ({ getValue, row }) => {
          const val = row.original.fechaCita;
          return val ? (
            <div>
              <div>{formatDateDMY(val)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(val).toLocaleTimeString("es-PE", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "America/Lima",
                })}
              </div>
            </div>
          ) : (
            "—"
          );
        },
      },
      {
        accessorKey: "asistencia",
        id: "asistencia",
        header: "Asistencia",
        size: 80,
        cell: ({ getValue }) => {
          const val = String(getValue() ?? "");
          return val ? (
            <Badge
              variant="outline"
              className={`text-[10px] ${val === "Asistió" || val === "ASISTIO" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
            >
              {val}
            </Badge>
          ) : (
            <span className="text-[10px] text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: "fechaAfiliacion",
        id: "fechaAfiliacion",
        header: "F. Afiliacion",
        size: 110,
        cell: ({ getValue }) =>
          getValue() ? formatDateDMY(String(getValue())) : "—",
      },
      {
        accessorKey: "movil",
        id: "movil",
        header: "Movil",
        size: 100,
        cell: ({ getValue }) => (
          <span
            className="truncate block max-w-[90px]"
            title={String(getValue() ?? "")}
          >
            {String(getValue() ?? "") || "—"}
          </span>
        ),
      },
      {
        accessorKey: "observaciones",
        id: "observaciones",
        header: "Observaciones",
        size: 170,
        cell: ({ getValue }) => (
          <span className="text-[10px]">
            {getLatestObservacion(String(getValue() ?? ""))}
          </span>
        ),
      },
    ],
    [openingChatProspectoId],
  );

  const { hasPermission } = usePermissions();
  const currentUser = useAppStore((s) => s.currentUser);
  const hasVerTodos = hasPermission("flota_prospectos.ver_todos");
  const enqueueJob = useImportJobsStore((s) => s.enqueueJob);
  const completionTick = useImportJobsStore(
    (s) => s.completionTickByEntity["flota-prospecto"],
  );

  const filterOperadores = useMemo(() => {
    if (hasVerTodos) return operadores;
    return operadores.filter((op) => op.name === currentUser.name);
  }, [hasVerTodos, operadores, currentUser.name]);

  const operadorOptions = useMemo(
    () => filterOperadores.map((op) => ({ label: op.name, value: op.name })),
    [filterOperadores],
  );

  const redSocialOptions = useMemo(() => {
    return (counts?.redesSociales ?? []).filter(Boolean).sort();
  }, [counts?.redesSociales]);

  const modalidadOptions = useMemo(() => {
    return MODALIDAD_OPTIONS.map((o) => o.value);
  }, []);

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
        setConductorTelefonos({
          phones: new Set(telefonos),
          codigoByPhone: codigoByTelefono,
        });
      } catch (e) {
        console.error("Error loading conductor telefonos:", e);
      }
    }
    void loadConductorTelefonos();
  }, []);

  useEffect(() => {
    fetchOperadores()
      .then(setOperadores)
      .catch(() => {});
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
    if (!phone || !/^\d{7,}$/.test(phone)) {
      lastCheckedSearchRef.current = "";
      return;
    }
    if (phone === lastCheckedSearchRef.current) return;
    lastCheckedSearchRef.current = phone;
    flotaProspectosByPhone(phone)
      .then((res) => {
        if (res.found && res.prospecto) {
          const operadorDisplay = getOperatorDisplayName(res.prospecto.operador, operadores);
          const isOwn = hasVerTodos || res.prospecto.operador === null || currentUser.name === operadorDisplay;
          if (!isOwn) {
            toast.warning(
              `El número ${phone} está asignado a ${res.prospecto.operador} (${res.prospecto.nombreCompleto}). No puedes cambiar el operador.`,
              { duration: 5000 },
            );
            setBlockedProspects((prev) => {
              const p = res.prospecto;
              if (!p || prev.some((bp) => bp.id === p.id)) return prev;
              return [...prev, {
                id: p.id,
                fechaRegistro: null, redSocial: null, celular: p.celular,
                nombreCompleto: p.nombreCompleto, edad: null,
                operador: p.operador, estado: p.estado || '',
                modalidad: null, anioVehiculo: null, placa: null, aireAcondicionado: null, distrito: null,
                fechaCita: null, asistencia: null, fechaAfiliacion: null, movil: null,
                observaciones: null, esDuplicado: false, origen: '', createdAt: '', updatedAt: '',
                _count: { llamadas: 0 },
              }];
            });
          }
        }
      })
      .catch(() => {});
  }, [searchDebounced, hasVerTodos, currentUser.name]);

  const LOAD_LIMIT = 25;

  const loadProspectos = useCallback(
    async (pageNum: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        setInitialLoading(true);
      }
      try {
        const res = await flotaProspectosList({
          page: pageNum,
          limit: LOAD_LIMIT,
          signal: controller.signal,
          search: searchDebounced || undefined,
          estado: estadoFilter === "all" ? undefined : estadoFilter,
          duplicados: duplicadosFilter ? true : undefined,
          fechaRegistroDesde: fechaRegistroRange?.from
            ?.toISOString()
            .split("T")[0],
          fechaRegistroHasta: fechaRegistroRange?.to
            ?.toISOString()
            .split("T")[0],
          mesImportDesde: mesImportRange?.from?.toISOString().split("T")[0],
          mesImportHasta: mesImportRange?.to?.toISOString().split("T")[0],
          redSocial: redSocialFilter === "all" ? undefined : redSocialFilter,
          operador:
            operadorFilter === "all"
              ? undefined
              : operadorFilter === "__unassigned__"
                ? "__unassigned__"
                : (() => {
                    const op = operadores.find(
                      (o) => o.name === operadorFilter,
                    );
                    if (!op) return operadorFilter;
                    const firstName = op.name.split(" ")[0];
                    const aliases = [op.name, op.username];
                    if (
                      firstName !== op.name &&
                      firstName.toLowerCase() !== op.username.toLowerCase()
                    ) {
                      aliases.push(firstName);
                    }
                    return aliases.join(",");
                  })(),
          filters:
            Object.keys(columnFilters).length > 0
            || modalidadFilter !== "all"
            || aireAcondicionadoFilter !== "all"
              ? {
                  ...columnFilters,
                  ...(modalidadFilter !== "all" ? { modalidad: modalidadFilter } : {}),
                  ...(aireAcondicionadoFilter !== "all"
                    ? { aireAcondicionado: aireAcondicionadoFilter }
                    : {}),
                }
              : undefined,
          conLlamadas:
            conLlamadasFilter === "all" ? undefined : conLlamadasFilter,
        });

        setProspectos(res.data);
        setTotalProspectos(res.total);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        toast.error(
          e instanceof Error ? e.message : "Error cargando prospectos",
        );
      } finally {
        setInitialLoading(false);
      }
    },
    [
      searchDebounced,
      estadoFilter,
      duplicadosFilter,
      fechaRegistroRange,
      mesImportRange,
      redSocialFilter,
      operadorFilter,
      modalidadFilter,
      aireAcondicionadoFilter,
      conLlamadasFilter,
      columnFilters,
    ],
  );

  useEffect(() => {
    void loadProspectos(page);
  }, [loadProspectos, page]);

  useEffect(() => {
    if (!newChatData) return;
    setNewChatSelected('afiliacion_atu');
    setNewChatLoadingTpl(true);
    fetchChatwootTemplates().then((tpls) => {
      setNewChatTemplates(tpls);
      if (tpls.length > 0) setNewChatSelected(tpls[0].name);
    }).catch(() => {}).finally(() => setNewChatLoadingTpl(false));
  }, [newChatData]);

  const displayData = useMemo(() => {
    if (blockedProspects.length === 0) return prospectos;
    const filtered = blockedProspects.filter((bp) => {
      if (Object.keys(columnFilters).length === 0) return true;
      for (const [colId, filterVal] of Object.entries(columnFilters)) {
        if (!filterVal) continue;
        const val = String((bp as any)[colId] ?? "").toLowerCase();
        if (!val.includes(filterVal.toLowerCase())) return false;
      }
      return true;
    });
    return [...filtered, ...prospectos];
  }, [prospectos, columnFilters, blockedProspects]);

  const loadCounts = useCallback(async () => {
    try {
      const c = await flotaProspectosCounts();
      setCounts(c);
    } catch {
      /* silently fail */
    }
  }, []);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  // Auto-recargar cuando una importación finaliza
  useEffect(() => {
    if (!completionTick) return;
    void Promise.all([loadProspectos(page), loadCounts()]);
  }, [completionTick, loadProspectos, loadCounts]);

  // Auto-recargar cuando otra pestaña, socket o visibilidad indican cambios
  useFlotaProspectosRealtime(() => {
    void Promise.all([loadProspectos(page), loadCounts()]);
  });

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);



  const getConductorCodigo = (celular: string | null): string | null => {
    if (!celular) return null;
    const normalized = celular.replace(/\D/g, "").replace(/^51/, "");
    if (!conductorTelefonosRef.current.phones.has(normalized)) return null;
    return conductorTelefonosRef.current.codigoByPhone[normalized] ?? null;
  };

  const getLatestObservacion = (obs: string | null | undefined): string => {
    if (!obs) return "";
    return obs
      .split(/\n?---\n?/)[0]
      .replace(/^(?:\[.+?\]\s*)+/, "")
      .trim();
  };

  const toLocalDatetimeValue = (iso: string | null | undefined): string => {
    if (!iso) return "";
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
    const time = d.toLocaleTimeString("en-GB", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${date}T${time}`;
  };

  const isConductor = (celular: string | null): boolean => {
    if (!celular) return false;
    const normalized = celular.replace(/\D/g, "").replace(/^51/, "");
    return conductorTelefonosRef.current.phones.has(normalized);
  };

  const handleOptimisticSave = useCallback(
    (id: string, field: string, newValue: string | null) => {
      setProspectos((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const updated = { ...p };
          if (field === "edad" || field === "anioVehiculo") {
            (updated as any)[field] =
              newValue != null ? parseInt(newValue, 10) : null;
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
      "FECHA_REGISTRO",
      "RED_SOCIAL",
      "CELULAR",
      "NOMBRE_COMPLETO",
      "EDAD",
      "OPERADOR",
      "ESTADO",
      "MODALIDAD",
      "PLACA",
      "AÑO_VEHICULO",
      "DISTRITO",
      "FECHA_CITA",
      "ASISTENCIA",
      "FECHA_AFILIACION",
      "MOVIL",
      "OBSERVACIONES",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "plantilla_prospectos.xlsx");
    toast.success("Plantilla descargada");
  }, []);

  const handleFileImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImportingFile(true);
      try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: "",
        }) as any[][];
        if (json.length < 2) {
          toast.error("El archivo no tiene datos");
          return;
        }
        const rows = json
          .slice(1)
          .filter((r) => r.some((c) => c != null && String(c).trim() !== ""));
        if (rows.length === 0) {
          toast.error("El archivo no tiene datos");
          return;
        }
        const headers = (json[0] || [])
          .map((h: any) => String(h || "").trim())
          .filter(Boolean);
        const previewRows = rows.map((r: any[]) => {
          const obj: Record<string, string> = {};
          headers.forEach((h: string, i: number) => {
            if (h) obj[h] = String(r[i] || "");
          });
          return obj;
        });
        rawImportRowsRef.current = [json[0] as any[], ...(rows as any[][])];
        setPreviewData({
          headers,
          rows: previewRows,
          totalRows: previewRows.length,
        });
        setPreviewSource("file");
        setPreviewOpen(true);
      } catch {
        toast.error("Error al leer el archivo");
      } finally {
        setImportingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [],
  );

  async function handleOpenImportPreview() {
    if (!selectedSheet) {
      toast.error("Selecciona una hoja primero");
      return;
    }
    setPreviewLoading(true);
    try {
      const data = await flotaProspectosSheetPreview(
        selectedSheet,
        selectedSpreadsheetId,
      );
      setPreviewData(data);
      setPreviewSource("sheets");
      setPreviewOpen(true);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error cargando vista previa",
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreviewOpen(false);
    setPreviewData(null);
    setPreviewSource("sheets");
    rawImportRowsRef.current = null;
  }

  async function handleConfirmImport() {
    const rows = previewSource === "file" ? rawImportRowsRef.current : null;
    closePreview();
    setImporting(true);
    try {
      if (rows) {
        const job = await flotaProspectosImportRows(rows);
        enqueueJob(job);
      } else {
        const job = await flotaProspectosImportSheets(
          selectedSheet,
          selectedSpreadsheetId,
        );
        enqueueJob(job);
      }
    } catch (e) {
      console.error("Error al importar:", e);
      toast.error(e instanceof Error ? e.message : "Error al importar");
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
        anioVehiculo: newProspecto.anioVehiculo
          ? parseInt(newProspecto.anioVehiculo, 10)
          : null,
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
      await Promise.all([loadProspectos(page), loadCounts()]);
    } catch (e) {
      const existing = (e as any).body?.existing;
      if (existing) {
        toast.error((e as Error).message, { duration: 6000 });
        if (existing.operador) {
          toast.warning(
            `Este número ya está asignado a ${existing.operador} (${existing.nombreCompleto})`,
            { duration: 6000 },
          );
        }
      } else {
        toast.error(
          e instanceof Error ? e.message : "Error al crear prospecto",
        );
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleExport() {
    setExportBusy(true);
    try {
      const operadorParam =
        operadorFilter === "all"
          ? undefined
          : operadorFilter === "__unassigned__"
            ? "__unassigned__"
            : (() => {
                const op = operadores.find((o) => o.name === operadorFilter);
                if (!op) return operadorFilter;
                const firstName = op.name.split(" ")[0];
                const aliases = [op.name, op.username];
                if (
                  firstName !== op.name &&
                  firstName.toLowerCase() !== op.username.toLowerCase()
                ) {
                  aliases.push(firstName);
                }
                return aliases.join(",");
              })();

      const res = await flotaProspectosList({
        page: 1,
        limit: 10000,
        search: searchDebounced || undefined,
        estado: estadoFilter === "all" ? undefined : estadoFilter,
        duplicados: duplicadosFilter ? true : undefined,
        fechaRegistroDesde: fechaRegistroRange?.from
          ?.toISOString()
          .split("T")[0],
        fechaRegistroHasta: fechaRegistroRange?.to?.toISOString().split("T")[0],
        mesImportDesde: mesImportRange?.from?.toISOString().split("T")[0],
        mesImportHasta: mesImportRange?.to?.toISOString().split("T")[0],
        redSocial: redSocialFilter === "all" ? undefined : redSocialFilter,
        operador: operadorParam,
        filters:
          Object.keys(columnFilters).length > 0
          || modalidadFilter !== "all"
          || aireAcondicionadoFilter !== "all"
            ? {
                ...columnFilters,
                ...(modalidadFilter !== "all" ? { modalidad: modalidadFilter } : {}),
                ...(aireAcondicionadoFilter !== "all"
                  ? { aireAcondicionado: aireAcondicionadoFilter }
                  : {}),
              }
            : undefined,
      });

      const rows = res.data.map((p) => ({
        "F. Registro": p.fechaRegistro
          ? new Date(p.fechaRegistro).toLocaleDateString("es-PE")
          : "",
        Origen: p.origen === "IMPORTADO" ? "Importado" : "Manual",
        "Red Social": p.redSocial ?? "",
        Celular: p.celular ?? "",
        "Nombres y Apellidos": p.nombreCompleto,
        Edad: p.edad != null ? String(p.edad) : "",
        Operador: p.operador ?? "",
        Estado: p.estado,
        Modalidad: p.modalidad ?? "",
        Placa: p.placa ?? "",
        "A.C.": p.aireAcondicionado ?? "",
        "Año Veh.": p.anioVehiculo != null ? String(p.anioVehiculo) : "",
        Zona: p.distrito ?? "",
        "F. Cita": p.fechaCita
          ? new Date(p.fechaCita).toLocaleDateString("es-PE")
          : "",
        Asistencia: p.asistencia ?? "",
        "F. Afiliación": p.fechaAfiliacion
          ? new Date(p.fechaAfiliacion).toLocaleDateString("es-PE")
          : "",
        Móvil: p.movil ?? "",
        Observaciones: p.observaciones ?? "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Prospectos");
      XLSX.writeFile(
        wb,
        `prospectos_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      toast.success("Exportación descargada");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al exportar prospectos",
      );
    } finally {
      setExportBusy(false);
    }
  }

  async function handleEditSave() {
    if (!editProspectoId || !editData.nombreCompleto.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (editData.nombreCompleto.trim()) body.nombreCompleto = editData.nombreCompleto.trim();
      if (editData.celular.trim()) body.celular = editData.celular.trim();
      if (editData.redSocial.trim()) body.redSocial = editData.redSocial.trim();
      if (editData.distrito.trim()) body.distrito = editData.distrito.trim();
      if (editData.operador.trim()) body.operador = editData.operador.trim();
      if (editData.modalidad.trim()) body.modalidad = editData.modalidad.trim();
      if (editData.placa.trim()) body.placa = editData.placa.trim();
      const edad = parseInt(editData.edad, 10);
      if (!isNaN(edad)) body.edad = edad;
      const anio = parseInt(editData.anioVehiculo, 10);
      if (!isNaN(anio)) body.anioVehiculo = anio;
      if (editData.observaciones.trim()) {
        const dateStr = new Date().toLocaleString("es-PE", { timeZone: "America/Lima" });
        body.observaciones = `[${dateStr}] ${editData.observaciones.trim()}`;
      }
      await api(`/flota-prospectos/${editProspectoId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success("Prospecto actualizado");
      setEditProspectoId(null);
      notifyFlotaProspectosRefresh();
      void loadProspectos(page);
      void loadCounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al actualizar");
    } finally {
      setEditSaving(false);
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
                <label className="text-xs font-medium text-muted-foreground">
                  Spreadsheet
                </label>
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
                <label className="text-xs font-medium text-muted-foreground">
                  Hoja
                </label>
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
            {importingFile ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {importingFile ? "Importando…" : "Importar"}
          </Button>
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={exportBusy}
            onClick={() => void handleExport()}
          >
            {exportBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Exportar
          </Button>
          <Button className="gap-1.5" onClick={() => setCreateModalOpen(true)}>
            <UserPlus className="size-4" />
            Nuevo Prospecto
          </Button>
        </div>
      </PageHeader>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2">
          {selectedIds.size === 1 && (
            <>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const id = Array.from(selectedIds)[0];
                  navigate(`/flota/prospectos/${id}`);
                }}
              >
                <Info className="size-4" />
                Vista detallada
              </Button>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const id = Array.from(selectedIds)[0];
                  setEditProspectoId(id);
                }}
              >
                <Edit2 className="size-4" />
                Editar
              </Button>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const id = Array.from(selectedIds)[0];
                  const row = prospectos.find((p) => p.id === id);
                  if (row) {
                    const now = new Date();
                    setLlamadaProspecto({ id: row.id, nombre: row.nombreCompleto });
                    setLlamadaFecha(now.toISOString().split("T")[0]);
                    setLlamadaHora(now.toTimeString().split(" ")[0].substring(0, 5));
                    setLlamadaNotas("");
                  }
                }}
              >
                <Phone className="size-4" />
                Registrar llamada
              </Button>
            </>
          )}
          {hasPermission("flota_prospectos.eliminar") && (
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
      )}
      {initialLoading ? (
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
            { label: "Zona" },
            { label: "F. Cita" },
            { label: "Asistencia" },
            { label: "F. Afiliacion" },
            { label: "Movil" },
            { label: "Observaciones" },
            { label: "Llamadas" },
          ]}
          rows={5}
          aria-label="Cargando prospectos"
          className="bg-card"
        />
      ) : (
        <>
          <div className="text-xs">
            <DataTable
              columns={columns}
              maxHeight="calc(100vh - 16rem)"
              data={displayData}
              getId={(r) => r.id}
              filterComponents={{
                fechaRegistro: (
                  <Popover open={fechasOpen} onOpenChange={setFechasOpen}>
                    <PopoverTrigger asChild>
                      <button className="w-full h-6 rounded border border-input bg-background px-1.5 text-[10px] outline-none text-left text-muted-foreground">
                        Fechas
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="start">
                      <div className="flex gap-4">
                        <div>
                          <p className="text-xs font-medium mb-1 text-foreground">
                            F. Registro
                          </p>
                          <DateRangeCalendar
                            value={fechaRegistroRange}
                            onChange={(v) => { setFechaRegistroRange(v); setPage(1); }}
                            onClose={() => setFechasOpen(false)}
                          />
                        </div>
                        <div>
                          <p className="text-xs font-medium mb-1 text-foreground">
                            F. Import
                          </p>
                          <DateRangeCalendar
                            value={mesImportRange}
                            onChange={(v) => { setMesImportRange(v); setPage(1); }}
                            onClose={() => setFechasOpen(false)}
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                ),
                estado: (
                  <select
                    value={estadoFilter}
                    onChange={(e) => setEstadoFilter(e.target.value)}
                    className="w-full h-6 rounded border border-input bg-background px-1.5 text-[10px] outline-none text-muted-foreground"
                  >
                    <option value="all">Estado</option>
                    <option value="Nuevo">Nuevo</option>
                    <option value="Afiliado">Afiliado</option>
                    <option value="Citado">Citado</option>
                    <option value="Seguimiento">Seguimiento</option>
                    <option value="Informacion">Información</option>
                    <option value="Sin Requisitos">Sin Requisitos</option>
                    <option value="No Responde">No Responde</option>
                  </select>
                ),
                operador: (
                  <select
                    value={operadorFilter}
                    onChange={(e) => setOperadorFilter(e.target.value)}
                    className="w-full h-6 rounded border border-input bg-background px-1.5 text-[10px] outline-none text-muted-foreground"
                  >
                    <option value="all">Operador</option>
                    {filterOperadores.map((op) => (
                      <option key={op.id} value={op.name}>
                        {op.name}
                      </option>
                    ))}
                    <option value="__unassigned__">Sin asignar</option>
                  </select>
                ),
                redSocial: (
                  <select
                    value={redSocialFilter}
                    onChange={(e) => setRedSocialFilter(e.target.value)}
                    className="w-full h-6 rounded border border-input bg-background px-1.5 text-[10px] outline-none text-muted-foreground"
                  >
                    <option value="all">Filtrar...</option>
                    {redSocialOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ),
                modalidad: (
                  <select
                    value={modalidadFilter}
                    onChange={(e) => {
                      setModalidadFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full h-6 rounded border border-input bg-background px-1.5 text-[10px] outline-none text-muted-foreground"
                  >
                    <option value="all">Modalidad</option>
                    {modalidadOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ),
                aireAcondicionado: (
                  <select
                    value={aireAcondicionadoFilter}
                    onChange={(e) => {
                      setAireAcondicionadoFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full h-6 rounded border border-input bg-background px-1.5 text-[10px] outline-none text-muted-foreground"
                  >
                    <option value="all">A.C.</option>
                    {AIRE_ACONDICIONADO_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ),
                llamadas: (
                  <select
                    value={conLlamadasFilter}
                    onChange={(e) => setConLlamadasFilter(e.target.value)}
                    className="w-full h-6 rounded border border-input bg-background px-1.5 text-[10px] outline-none text-muted-foreground"
                  >
                    <option value="all">Llamadas</option>
                    <option value="true">Con llamadas</option>
                    <option value="false">Sin llamadas</option>
                  </select>
                ),
              }}
              readOnlyColumns={["select", "actions", "fechaRegistro"]}
              editTypes={{
                edad: "number",
                anioVehiculo: "number",
                operador: "select",
                estado: "select",
                asistencia: "select",
                modalidad: "select",
                aireAcondicionado: "select",
                fechaCita: "datetime-local",
                fechaAfiliacion: "date",
              }}
              editOptions={{
                operador: operadorOptions,
                estado: ESTADO_OPTIONS,
                asistencia: ASISTENCIA_OPTIONS,
                modalidad: MODALIDAD_OPTIONS,
                aireAcondicionado: AIRE_ACONDICIONADO_OPTIONS,
              }}
               onEditStart={(row, columnId) => {
                 if (columnId === "estado") return false;
                 if (columnId === "operador") return false;
                 if (columnId === "modalidad") return;
                 if (columnId === "aireAcondicionado") return;
                 return false;
               }}
              onRowSelectionChange={(ids) => setSelectedIds(new Set(ids))}
               onCellEdit={async (row, columnId, newValue) => {
                const isBlocked = blockedProspects.some((bp) => bp.id === (row as any).id);
                if (isBlocked && columnId === "operador") {
                  toast.warning("No puedes cambiar el operador asignado a otro operador");
                  return;
                }
                const body: Record<string, unknown> = {};
                if (columnId === "edad" || columnId === "anioVehiculo") {
                  const num = parseInt(newValue, 10);
                  body[columnId] = isNaN(num) ? null : num;
                } else if (columnId === "observaciones") {
                  const fullObs = (row as any).observaciones || "";
                  const entries = fullObs.split(/\n?---\n?/).filter(Boolean);
                  const cleanValue = newValue
                    .replace(/^\[.+?\]\s*/g, "")
                    .trim();
                  if (entries.length > 0) {
                    const latest = entries[0];
                    const datePrefix = latest.match(/^\[.+?\]\s*/)?.[0] || "";
                    entries[0] = datePrefix
                      ? `${datePrefix}${cleanValue}`
                      : cleanValue;
                    body[columnId] = entries.join("\n---\n");
                  } else {
                    body[columnId] = cleanValue;
                  }
                } else if (columnId === "estado" && newValue === "Citado") {
                  const p = row as any;
                  setCitadoProspectId(p.id);
                  setCitadoDate(p.fechaCita ? p.fechaCita.split("T")[0] : "");
                  setCitadoTime(
                    p.fechaCita
                      ? new Date(p.fechaCita)
                          .toTimeString()
                          .split(" ")[0]
                          .substring(0, 5)
                      : "",
                  );
                  setCitadoDialogOpen(true);
                  return;
                } else if (columnId === "operador") {
                  const opName = newValue || "Sin operador";
                  setProspectos((prev) =>
                    prev.map((p) =>
                      p.id === (row as any).id
                        ? { ...p, operador: newValue || null }
                        : p,
                    ),
                  );
                  try {
                    await api(`/flota-prospectos/${(row as any).id}/operador`, {
                      method: "PATCH",
                      body: JSON.stringify({ operador: newValue || null }),
                    });
                    toast.success(`Operador cambiado a ${opName}`);
                  } catch {
                    setProspectos((prev) => [...prev]);
                    toast.error("Error al cambiar operador");
                  }
                  return;
                } else if (columnId === "aireAcondicionado") {
                  body[columnId] = newValue?.trim() || null;
                } else {
                  body[columnId] = newValue;
                }
                if (Object.keys(body).length === 0) return;
                setProspectos((prev) =>
                  prev.map((p) =>
                    p.id === (row as any).id ? { ...p, ...body } : p,
                  ),
                );
                try {
                  await api(`/flota-prospectos/${(row as any).id}`, {
                    method: "PATCH",
                    body: JSON.stringify(body),
                  });
                  setBlockedProspects((prev) =>
                    prev.map((p) =>
                      p.id === (row as any).id ? { ...p, ...body } : p,
                    ),
                  );
                } catch {
                  setProspectos((prev) => [...prev]);
                }
              }}
              onFilterChange={(columnId, value) => {
                setColumnFilters((prev) => ({ ...prev, [columnId]: value }));
                setPage(1);
                if (
                  columnId === "nombreCompleto" ||
                  columnId === "celular" ||
                  columnId === "distrito"
                ) {
                  setSearchTerm(value);
                } else if (columnId === "estado") {
                  setEstadoFilter(value || "all");
                } else if (columnId === "redSocial") {
                  setRedSocialFilter(value || "all");
                } else if (columnId === "operador") {
                  setOperadorFilter(value || "all");
                }
              }}
              filterValues={columnFilters}
            />
          </div>
        </>
      )}

      {!initialLoading && (
        <div>
          {selectedIds.size > 0 && (
            <p className="text-xs text-muted-foreground mb-1 text-left italic">
              ({selectedIds.size} seleccionados)
            </p>
          )}
          <Pagination
            page={page}
            totalPages={Math.ceil(totalProspectos / pageSize)}
            totalItems={totalProspectos}
            pageSize={pageSize}
            onPageChange={(p) => {
              setPage(p);
            }}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        </div>
      )}

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => !open && closePreview()}
      >
        <DialogContent className="flex h-[min(92vh,880px)] max-h-[92vh] w-[min(96vw,calc(100vw-2rem))] max-w-[min(96vw,87.5rem)] flex-col gap-0 p-0 sm:max-w-[min(96vw,87.5rem)]">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <h2 className="text-lg font-semibold">
              Vista previa de importación
            </h2>
            {previewData ? (
              <p className="text-sm text-muted-foreground mt-1">
                {previewData.totalRows} fila(s) total(es) &middot; Confirma para
                importar.
              </p>
            ) : null}
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden px-6 py-3">
            <div
              className="h-full overflow-auto rounded-md border"
              style={{ scrollbarWidth: "thin" }}
            >
              {previewData && previewData.rows.length > 0 ? (
                <table
                  className="table-fixed border-collapse [&_td]:border [&_th]:border [&_td]:border-border/50 [&_th]:border-border/50 [&_td]:px-2 [&_th]:px-2 [&_td]:py-2 [&_th]:py-2"
                  style={{ width: "max-content", minWidth: "max-content" }}
                >
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
                      <tr
                        key={idx}
                        className="border-b border-transparent transition-colors hover:bg-muted/50"
                      >
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

      <Dialog
        open={createModalOpen}
        onOpenChange={(open) => !open && setCreateModalOpen(open)}
      >
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
                onChange={(e) =>
                  setNewProspecto({
                    ...newProspecto,
                    nombreCompleto: e.target.value,
                  })
                }
                placeholder="Nombres y Apellidos"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-muted-forer">Celular *</label>
                <Input
                  value={newProspecto.celular}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 9);
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
                    {duplicateAlert.operador &&
                      ` · Asignado a ${duplicateAlert.operador}`}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Edad</label>
                <Input
                  type="number"
                  value={newProspecto.edad}
                  onChange={(e) =>
                    setNewProspecto({ ...newProspecto, edad: e.target.value })
                  }
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
                    const raw = e.target.value
                      .replace(/[^a-zA-Z0-9]/g, "")
                      .toUpperCase()
                      .slice(0, 6);
                    const formatted =
                      raw.length > 3
                        ? `${raw.slice(0, 3)}-${raw.slice(3)}`
                        : raw;
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
                  onChange={(e) =>
                    setNewProspecto({
                      ...newProspecto,
                      anioVehiculo: e.target.value,
                    })
                  }
                  placeholder="2024"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Red Social</label>
                <Input
                  value={newProspecto.redSocial}
                  onChange={(e) =>
                    setNewProspecto({
                      ...newProspecto,
                      redSocial: e.target.value,
                    })
                  }
                  placeholder="Facebook, Instagram..."
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Operador</label>
                <Select
                  value={newProspecto.operador || "__none__"}
                  onValueChange={(v) =>
                    setNewProspecto({
                      ...newProspecto,
                      operador: v === "__none__" ? "" : v,
                    })
                  }
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
                <Select
                  value={newProspecto.modalidad || "__none__"}
                  onValueChange={(v) =>
                    setNewProspecto({
                      ...newProspecto,
                      modalidad: v === "__none__" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin modalidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin modalidad</SelectItem>
                    {MODALIDAD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Distrito</label>
                <Input
                  value={newProspecto.distrito}
                  onChange={(e) =>
                    setNewProspecto({
                      ...newProspecto,
                      distrito: e.target.value,
                    })
                  }
                  placeholder="Lima, Callao..."
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Observaciones</label>
              <Input
                value={newProspecto.observaciones}
                onChange={(e) =>
                  setNewProspecto({
                    ...newProspecto,
                    observaciones: e.target.value,
                  })
                }
                placeholder="Notas adicionales..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => handleCreateProspecto()}
              disabled={creating || !!duplicateAlert}
            >
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
            <DialogDescription>
              Indica la fecha y hora de la cita para el prospecto.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Input
              type="date"
              value={citadoDate}
              onChange={(e) => setCitadoDate(e.target.value)}
              className="w-full"
            />
            <Input
              type="time"
              value={citadoTime}
              onChange={(e) => setCitadoTime(e.target.value)}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCitadoDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!citadoProspectId || !citadoDate) {
                  toast.error("Selecciona una fecha");
                  return;
                }
                try {
                  const fechaHora = new Date(
                    `${citadoDate}T${citadoTime || "12:00"}:00`,
                  ).toISOString();
                  await api(`/flota-prospectos/${citadoProspectId}`, {
                    method: "PATCH",
                    body: JSON.stringify({ estado: "Citado", fechaCita: fechaHora }),
                  });
                  setCitadoDialogOpen(false);
                  await Promise.all([loadProspectos(page), loadCounts()]);
                  toast.success("Cita programada");
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Error al guardar",
                  );
                }
              }}
              disabled={!citadoDate}
            >
              Guardar cita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => !open && setDeleteDialogOpen(false)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar prospectos</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar <strong>{selectedIds.size}</strong>{" "}
              prospecto(s)? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
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
                  void loadProspectos(page);
                  void loadCounts();
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Error eliminando",
                  );
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!llamadaProspecto}
        onOpenChange={(open) => {
          if (!open) setLlamadaProspecto(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar llamada</DialogTitle>
            <DialogDescription>
              {llamadaProspecto?.nombre
                ? `Prospecto: ${llamadaProspecto.nombre}`
                : "Fecha y hora de la llamada"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Fecha</label>
                <Input
                  type="date"
                  value={llamadaFecha}
                  onChange={(e) => setLlamadaFecha(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Hora</label>
                <Input
                  type="time"
                  value={llamadaHora}
                  onChange={(e) => setLlamadaHora(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Notas / Comentarios</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Comentarios sobre la llamada..."
                value={llamadaNotas}
                onChange={(e) => setLlamadaNotas(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLlamadaProspecto(null)}
              disabled={llamadaSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!llamadaProspecto) return;
                setLlamadaSaving(true);
                try {
                  const fechaHora = new Date(
                    `${llamadaFecha}T${llamadaHora}:00`,
                  );
                  await flotaLlamadaCreate(llamadaProspecto.id, {
                    notas: llamadaNotas.trim() || null,
                    createdAt: fechaHora.toISOString(),
                  });
                  toast.success("Llamada registrada");
                  setLlamadaProspecto(null);
                } catch {
                  toast.error("No se pudo registrar la llamada");
                } finally {
                  setLlamadaSaving(false);
                }
              }}
              disabled={!llamadaNotas.trim() || llamadaSaving}
            >
              {llamadaSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Phone className="size-4" />
              )}
              {llamadaSaving ? "Guardando..." : "Registrar llamada"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editProspectoId} onOpenChange={(open) => { if (!open) setEditProspectoId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Prospecto</DialogTitle>
            <DialogDescription>Modifica los datos del prospecto</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Nombre completo *</label>
              <Input value={editData.nombreCompleto} onChange={(e) => setEditData((p) => ({ ...p, nombreCompleto: e.target.value }))} placeholder="Nombres y Apellidos" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Celular</label>
                <Input value={editData.celular} onChange={(e) => setEditData((p) => ({ ...p, celular: e.target.value }))} placeholder="999999999" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Edad</label>
                <Input type="number" value={editData.edad} onChange={(e) => setEditData((p) => ({ ...p, edad: e.target.value }))} placeholder="18" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Red Social</label>
                <Input value={editData.redSocial} onChange={(e) => setEditData((p) => ({ ...p, redSocial: e.target.value }))} placeholder="Facebook, Instagram..." />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Distrito</label>
                <Input value={editData.distrito} onChange={(e) => setEditData((p) => ({ ...p, distrito: e.target.value }))} placeholder="Lima" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Modalidad</label>
                <Select
                  value={editData.modalidad || "__none__"}
                  onValueChange={(v) =>
                    setEditData((p) => ({
                      ...p,
                      modalidad: v === "__none__" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin modalidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin modalidad</SelectItem>
                    {MODALIDAD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                    {editData.modalidad &&
                      !MODALIDAD_OPTIONS.some((o) => o.value === editData.modalidad) && (
                        <SelectItem value={editData.modalidad}>
                          {editData.modalidad}
                        </SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Placa</label>
                <Input value={editData.placa} onChange={(e) => setEditData((p) => ({ ...p, placa: e.target.value }))} placeholder="ABC-123" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Año Vehículo</label>
                <Input type="number" value={editData.anioVehiculo} onChange={(e) => setEditData((p) => ({ ...p, anioVehiculo: e.target.value }))} placeholder="2024" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Operador</label>
                <Input value={editData.operador} onChange={(e) => setEditData((p) => ({ ...p, operador: e.target.value }))} placeholder="Nombre del operador" />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Observaciones</label>
              <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={editData.observaciones} onChange={(e) => setEditData((p) => ({ ...p, observaciones: e.target.value }))} placeholder="Notas adicionales..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProspectoId(null)} disabled={editSaving}>Cancelar</Button>
            <Button onClick={() => void handleEditSave()} disabled={editSaving || !editData.nombreCompleto.trim()}>
              {editSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {blockedProspects.length > 0 && (
        <style>{blockedProspects.map((bp) => `
tr[data-row-id="${bp.id}"] {
  opacity: 0.75;
}
`).join('')}</style>
      )}

      <ChatwootInboxPanel
        open={chatPanelOpen}
        onOpenChange={(v) => {
          if (!v) {
            setChatPanelOpen(false);
            setChatActiveId(null);
            setChatInitialContact(null);
          }
        }}
        initialActiveId={chatActiveId}
        initialContact={chatInitialContact}
      />

      <Dialog open={!!newChatData} onOpenChange={(v) => { if (!v) setNewChatData(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo mensaje</DialogTitle>
            <DialogDescription>Selecciona una plantilla para iniciar la conversación</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Número</Label>
              <p className="text-sm font-medium">{newChatData?.phone}</p>
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <p className="text-sm font-medium">{newChatData?.name}</p>
            </div>
            <div className="space-y-2">
              <Label>Plantilla</Label>
              {newChatLoadingTpl ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                </div>
              ) : newChatTemplates.length === 0 ? (
                newChatSelected === 'afiliacion_atu' ? (
                  <div className="rounded-lg border border-primary bg-primary/10 px-3 py-2">
                    <p className="font-medium text-xs">afiliacion_atu</p>
                    <p className="text-[10px] text-muted-foreground">UTILITY</p>
                    <div className="mt-2 text-[13px] leading-relaxed whitespace-pre-line text-foreground">
                      Hola estimado(a), reciba un cordial saludo de parte de Taxi Monterrico.{'\n\n'}
                      Hemos observado su interés en formar parte de nuestra flota.{'\n'}
                      ¿usted cuenta con vehiculo particular o tiene permiso de la ATU?
                    </div>
                  </div>
                ) : null
              ) : (
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {newChatTemplates.map((t) => (
                    <button key={t.name} onClick={() => setNewChatSelected(t.name)}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                        newChatSelected === t.name ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50 hover:bg-muted'
                      }`}
                    >
                      <p className="font-medium text-xs">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground">{t.category}</p>
                      {t.content && (
                        <div className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-foreground/80">{t.content}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewChatData(null)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!newChatData) return;
              const template = newChatTemplates.find((t) => t.name === newChatSelected);
              const templateName = template?.name || 'afiliacion_atu';
              const templateCategory = template?.category || 'UTILITY';
              setNewChatSending(true);
              try {
                const result = await initiateConversation({
                  name: newChatData.name,
                  phone: newChatData.phone,
                  templateName,
                  templateCategory,
                  operador: newChatData.operador,
                });
                setChatInitialContact({
                  name: newChatData.name,
                  phone: newChatData.phone,
                });
                setNewChatData(null);
                setChatActiveId(result.conversationId);
                setChatPanelOpen(true);
                toast.success('Mensaje enviado');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Error al enviar');
              } finally {
                setNewChatSending(false);
              }
            }} disabled={newChatSending}>
              {newChatSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {newChatSending ? 'Enviando...' : 'Enviar plantilla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
