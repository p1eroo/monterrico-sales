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
  type FlotaProspectoRow,
  type FlotaProspectosCounts,
  type SheetPreviewResponse,
} from "@/lib/flotaProspectosApi";

const estadoColors: Record<string, string> = {
  Nuevo: "bg-blue-100 text-blue-700 border-blue-200",
  Contactado: "bg-amber-100 text-amber-700 border-amber-200",
  Afiliado: "bg-emerald-100 text-emerald-700 border-emerald-200",
  NoInteresado: "bg-red-100 text-red-700 border-red-200",
  "NO RESPONDE": "bg-gray-100 text-gray-700 border-gray-200",
  "SIN REQUISITOS": "bg-orange-100 text-orange-700 border-orange-200",
  REQUIMIENTO: "bg-purple-100 text-purple-700 border-purple-200",
  EQUIMIENTO: "bg-purple-100 text-purple-700 border-purple-200",
};

const PAGE_SIZE = 25;

export default function FlotaProspectos() {
  const navigate = useNavigate();
  const [prospectos, setProspectos] = useState<FlotaProspectoRow[]>([]);
  const [totalProspectos, setTotalProspectos] = useState(0);
  const [counts, setCounts] = useState<FlotaProspectosCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("all");
  const [mesFilter, setMesFilter] = useState("all");
  const [duplicadosFilter, setDuplicadosFilter] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | undefined>(undefined);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<SheetPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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
  }, [page, searchDebounced, estadoFilter, duplicadosFilter, mesFilter]);

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
  }, [searchDebounced, estadoFilter, duplicadosFilter, mesFilter]);

  const totalPages = Math.ceil(totalProspectos / PAGE_SIZE);

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
      toast.success(
        `Importación completada: ${result.imported} importados, ${result.skipped} omitidos`,
      );
      await Promise.all([loadProspectos(), loadCounts()]);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al importar desde Sheets",
      );
    } finally {
      setImporting(false);
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
          <Button className="gap-1.5">
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
            <SelectItem value="Nuevo">Nuevo</SelectItem>
            <SelectItem value="Contactado">Contactado</SelectItem>
            <SelectItem value="Afiliado">Afiliado</SelectItem>
            <SelectItem value="NoInteresado">No Interesado</SelectItem>
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
          <div className="overflow-x-auto">
            <Table className="[&_td]:py-3 [&_th]:py-2">
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
                      className="cursor-pointer hover:bg-muted/50"
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
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
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
      </Card>

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
    </div>
  );
}
