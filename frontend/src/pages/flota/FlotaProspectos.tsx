import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Search,
  UserPlus,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  Trash2,
  XCircle,
  Info,
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
  flotaProspectosCounts,
  flotaProspectosSheetNames,
  flotaProspectosSheetPreview,
  flotaProspectosDeleteMany,
  flotaProspectoCreate,
  type FlotaProspectoRow,
  type FlotaProspectosCounts,
  type SheetPreviewResponse,
  type ImportSheetsResult,
} from "@/lib/flotaProspectosApi";
import { getConductorTelefonos } from "@/lib/flotaConductoresApi";

const estadoColors: Record<string, string> = {
  "AFILIADO": "bg-purple-200 text-purple-700 border-purple-200",
  "CITADO": "bg-blue-100 text-blue-700 border-blue-200",
  "SEGUIMIENTO": "bg-green-100 text-green-700 border-green-200",
  "INFORMACION": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "SIN REQUISITOS": "bg-red-100 text-red-700 border-red-200",
  "NO RESPONDE": "bg-yellow-200 text-yellow-700 border-yellow-200",
};

const PAGE_SIZE = 25;

export default function FlotaProspectos() {
  const navigate = useNavigate();
  const [prospectos, setProspectos] = useState<FlotaProspectoRow[]>([]);
  const [totalProspectos, setTotalProspectos] = useState(0);
  const [counts, setCounts] = useState<FlotaProspectosCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSheetsResult | null>(null);
  const [errorsModalOpen, setErrorsModalOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("all");
  const [mesFilter, setMesFilter] = useState("all");
  const [redSocialFilter, setRedSocialFilter] = useState("all");
  const [duplicadosFilter, setDuplicadosFilter] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | undefined>(undefined);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<SheetPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [conductorTelefonos, setConductorTelefonos] = useState<Set<string>>(new Set());
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
    observaciones: "",
  });

  const loadSheetNames = useCallback(async () => {
    try {
      const res = await flotaProspectosSheetNames();
      console.log("Sheets fetched:", res);
      const sheets = res.sheets || [];
      setSheetNames(sheets);
      if (sheets.length > 0 && !selectedSheet) {
        setSelectedSheet(sheets[0]);
      }
    } catch (e) {
      console.error("Error loading sheets:", e);
      toast.error(e instanceof Error ? e.message : "Error cargando hojas");
    }
  }, [selectedSheet]);


  useEffect(() => {
    void loadSheetNames();
  }, [loadSheetNames]);

  // Load conductor telefonos for cross-reference
  useEffect(() => {
    async function loadConductorTelefonos() {
      try {
        const telefonos = await getConductorTelefonos();
        setConductorTelefonos(new Set(telefonos));
      } catch (e) {
        console.error("Error loading conductor telefonos:", e);
      }
    }
    void loadConductorTelefonos();
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchTerm), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Load data
  const loadProspectos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await flotaProspectosList({
        page,
        limit: PAGE_SIZE,
        search: searchDebounced || undefined,
        estado: estadoFilter === "all" ? undefined : estadoFilter,
        duplicados: duplicadosFilter || undefined,
        mes: mesFilter === "all" ? undefined : mesFilter,
        redSocial: redSocialFilter === "all" ? undefined : redSocialFilter,
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
  }, [page, searchDebounced, estadoFilter, duplicadosFilter, mesFilter, redSocialFilter]);

  const loadCounts = useCallback(async () => {
    try {
      const c = await flotaProspectosCounts();
      setCounts(c);
    } catch {
      /* silently fail */
    }
  }, []);

  useEffect(() => {
    void loadProspectos();
  }, [loadProspectos]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [searchDebounced, estadoFilter, duplicadosFilter, mesFilter, redSocialFilter]);

  const totalPages = Math.ceil(totalProspectos / PAGE_SIZE);

  const isConductor = (celular: string | null): boolean => {
    if (!celular) return false;
    const normalized = celular.replace(/\D/g, '').replace(/^51/, '');
    return conductorTelefonos.has(normalized);
  };

  const getRowClass = (prospecto: FlotaProspectoRow): string => {
    if (isConductor(prospecto.celular)) {
      return "bg-green-50/50 border-l-4 border-l-green-500 cursor-pointer hover:bg-green-100/50";
    }
    return "cursor-pointer hover:bg-muted/50";
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

  async function handleOpenImportPreview() {
    if (!selectedSheet) {
      toast.error("Selecciona una hoja primero");
      return;
    }
    setPreviewLoading(true);
    try {
      const data = await flotaProspectosSheetPreview(selectedSheet);
      setPreviewData(data);
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
  }

  async function handleConfirmImport() {
    closePreview();
    setImporting(true);
    try {
      const result = await flotaProspectosImportSheets(selectedSheet);
      setImportResult(result);
      
      const hasErrors = result.errors && result.errors.length > 0;
      
      toast.success(
        `Importación completada: ${result.imported} importados, ${result.skipped} omitidos`,
        {
          duration: hasErrors ? 10000 : 5000,
          action: hasErrors ? {
            label: "Ver detalles",
            onClick: () => setErrorsModalOpen(true)
          } : undefined
        }
      );
      
      if (hasErrors) {
        setErrorsModalOpen(true);
      }

      await Promise.all([loadProspectos(), loadCounts()]);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al importar desde Sheets",
      );
    } finally {
      setImporting(false);
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
        observaciones: "",
      });
      await Promise.all([loadProspectos(), loadCounts()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear prospecto");
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
          {sheetNames.length > 0 && (
            <Select
              value={selectedSheet ?? ""}
              onValueChange={(v) => {
                console.log("Sheet selected:", v);
                setSelectedSheet(v);
              }}
            >
              <SelectTrigger className="w-40 bg-card">
                <SelectValue placeholder="Hoja" />
              </SelectTrigger>
              <SelectContent>
                {sheetNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={previewLoading || importing}
            onClick={() => {
              if (!selectedSheet) {
                toast.error("Selecciona una hoja del dropdown");
                return;
              }
              void handleOpenImportPreview();
            }}
          >
            {previewLoading || importing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            {previewLoading
              ? "Cargando..."
              : importing
                ? "Importando…"
                : "Importar Sheets"}
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
          <SelectTrigger className="w-36 bg-card shadow-none">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="AFILIADO">Afiliado</SelectItem>
            <SelectItem value="CITADO">Citado</SelectItem>
            <SelectItem value="SEGUIMIENTO">Seguimiento</SelectItem>
            <SelectItem value="INFORMACION">Información</SelectItem>
            <SelectItem value="SIN REQUISITOS">Sin Requisitos</SelectItem>
            <SelectItem value="NO RESPONDE">No Responde</SelectItem>
          </SelectContent>
        </Select>
        
        <Select
          value={redSocialFilter}
          onValueChange={(v) => setRedSocialFilter(v)}
        >
          <SelectTrigger className="w-36 bg-card shadow-none">
            <SelectValue placeholder="Red Social" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas RRSS</SelectItem>
            {counts?.redesSociales.map((rs) => (
              <SelectItem key={rs} value={rs}>
                {rs}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={mesFilter} onValueChange={(v) => setMesFilter(v)}>
          <SelectTrigger className="w-28 bg-card shadow-none">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
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
            onClick={async () => {
              const confirm = window.confirm(
                `¿Eliminar ${selectedIds.size} prospecto(s)?`,
              );
              if (!confirm) return;
              try {
                await flotaProspectosDeleteMany(Array.from(selectedIds));
                toast.success(`${selectedIds.size} eliminado(s)`);
                setSelectedIds(new Set());
                void loadProspectos();
                void loadCounts();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Error eliminando");
              }
            }}
          >
            <Trash2 className="size-4" />
            Eliminar ({selectedIds.size})
          </Button>
        )}
      </div>

      <Card>
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
              { label: "Año Veh." },
              { label: "Distrito" },
              { label: "F. Cita" },
              { label: "Asistencia" },
              { label: "F. Afiliacion" },
              { label: "Movil" },
              { label: "Observaciones" },
            ]}
            rows={5}
            aria-label="Cargando prospectos"
          />
        ) : (
            <Table className="min-w-[1300px] [&_td]:py-3 [&_th]:py-2">
              <TableHeader>
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
                  <TableHead>Año Veh.</TableHead>
                  <TableHead>Distrito</TableHead>
                  <TableHead>F. Cita</TableHead>
                  <TableHead>Asistencia</TableHead>
                  <TableHead>F. Afiliacion</TableHead>
                  <TableHead>Movil</TableHead>
                  <TableHead className="max-w-[200px]">
                    Observaciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prospectos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={16}
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
                      className={getRowClass(prospecto)}
                      onClick={() =>
                        navigate(`/flota/prospectos/${prospecto.id}`)
                      }
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(prospecto.id)}
                          onCheckedChange={() => toggleSelectOne(prospecto.id)}
                        />
                      </TableCell>
                      <TableCell>
                        {prospecto.fechaRegistro
                          ? formatDateDMY(prospecto.fechaRegistro)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {prospecto.redSocial || "—"}
                      </TableCell>
                      <TableCell>{prospecto.celular || "—"}</TableCell>
                      <TableCell>
                        <span
                          className={`font-medium ${prospecto.esDuplicado ? "text-red-600" : ""}`}
                        >
                          {prospecto.nombreCompleto}
                        </span>
                        {prospecto.esDuplicado && (
                          <Badge
                            variant="outline"
                            className="ml-2 border-red-200 bg-red-50 text-[10px] text-red-600"
                          >
                            Duplicado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{prospecto.edad ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {prospecto.operador || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${estadoColors[prospecto.estado] || ""}`}
                        >
                          {prospecto.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {prospecto.modalidad || "—"}
                      </TableCell>
                      <TableCell>
                        {prospecto.anioVehiculo || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {prospecto.distrito || "—"}
                      </TableCell>
                      <TableCell>
                        {prospecto.fechaCita
                          ? formatDateDMY(prospecto.fechaCita)
                          : "—"}
                      </TableCell>
                      <TableCell>
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
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {prospecto.fechaAfiliacion
                          ? formatDateDMY(prospecto.fechaAfiliacion)
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {prospecto.movil || "—"}
                      </TableCell>
                      <TableCell
                        className="max-w-[200px] truncate"
                        title={prospecto.observaciones || ""}
                      >
                        {prospecto.observaciones || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
        )}
      </Card>

      {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-0">
            <p className="text-sm text-muted-foreground">
              Mostrando {prospectos.length} de {totalProspectos} prospectos
              {selectedIds.size > 0 && ` (${selectedIds.size} seleccionados)`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <span className="text-sm">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}

      <Dialog open={previewOpen} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="flex h-[min(92vh,880px)] max-h-[92vh] w-[min(96vw,calc(100vw-2rem))] max-w-[min(96vw,87.5rem)] flex-col gap-0 p-0 sm:max-w-[min(96vw,87.5rem)]">
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>Vista previa de importación</DialogTitle>
            <DialogDescription className="text-left">
              {previewData ? (
                <>
                  <span className="block">
                    Hoja: <strong>{selectedSheet}</strong> · {previewData.totalRows} fila(s) total(es)
                  </span>
                  <span className="text-muted-foreground">
                    A continuación se muestra el listado de datos detectados. Confirma para importar.

                  </span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-3">
            {previewData && previewData.rows.length > 0 ? (
              <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                <Table containerClassName="overflow-visible" className="w-full min-w-max table-fixed">
                  <TableHeader>
                    <TableRow>
                      {previewData.headers.map((header) => (
                        <TableHead
                          key={header}
                          className="w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem] align-bottom"
                        >
                          <span className="block truncate" title={header}>
                            {header}
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.rows.map((row, idx) => (
                      <TableRow key={idx}>
                        {previewData.headers.map((header) => (
                          <TableCell
                            key={`${idx}-${header}`}
                            className="w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem] align-top text-xs"
                          >
                            {String(row[header] ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : previewData ? (
              <p className="text-sm text-muted-foreground">
                No hay filas que mostrar.
              </p>
            ) : null}
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
            <div className="grid gap-2">
              <label className="text-sm font-medium">Celular *</label>
              <Input
                value={newProspecto.celular}
                onChange={(e) => setNewProspecto({ ...newProspecto, celular: e.target.value })}
                placeholder="999999999"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Edad</label>
                <Input
                  type="number"
                  value={newProspecto.edad}
                  onChange={(e) => setNewProspecto({ ...newProspecto, edad: e.target.value })}
                  placeholder="18"
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
                <Input
                  value={newProspecto.operador}
                  onChange={(e) => setNewProspecto({ ...newProspecto, operador: e.target.value })}
                  placeholder="Nombre del operador"
                />
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
            <Button onClick={() => handleCreateProspecto()} disabled={creating}>
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
      <Dialog open={errorsModalOpen} onOpenChange={setErrorsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="size-5" />
              Detalles de la Importación
            </DialogTitle>
            <DialogDescription>
              Se encontraron {importResult?.errors.length || 0} avisos o errores durante el proceso.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                <p className="text-xs text-emerald-600 font-medium uppercase">Importados</p>
                <p className="text-2xl font-bold text-emerald-700">{importResult?.imported || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                <p className="text-xs text-amber-600 font-medium uppercase">Omitidos/Duplicados</p>
                <p className="text-2xl font-bold text-amber-700">{(importResult?.skipped || 0) + (importResult?.duplicates || 0)}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                <p className="text-xs text-red-600 font-medium uppercase">Errores</p>
                <p className="text-2xl font-bold text-red-700">{importResult?.errors.length || 0}</p>
              </div>
            </div>

            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Info className="size-4 text-muted-foreground" />
              Lista de errores y advertencias:
            </h4>
            
            <div className="max-h-[350px] overflow-y-auto rounded-md border bg-muted/30 p-2">
              {importResult?.errors && importResult.errors.length > 0 ? (
                <ul className="space-y-2">
                  {importResult.errors.map((error, i) => (
                    <li key={i} className="text-sm py-2 px-3 bg-card rounded border border-border flex items-start gap-2">
                      <span className="shrink-0 mt-0.5 text-red-500 font-bold">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No hay detalles de errores disponibles.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setErrorsModalOpen(false)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

