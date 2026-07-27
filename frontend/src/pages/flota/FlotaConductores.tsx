import { useState, useMemo, useEffect, useCallback, type CSSProperties } from "react";
import {
  Search,
  X,
  ChevronDown,
  MoreVertical,
  XCircle,
  Car,
  Check,
  FileText,
} from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { GhostTableSkeleton } from "@/components/shared/GhostTableSkeleton";
import { GlassCard } from "@/components/shared/GlassCard";
import { Pagination } from "@/components/shared/Pagination";
import { MultiCheckboxFilterActions } from "@/components/shared/MultiCheckboxFilterActions";
import { ComercialTableColgroup } from "@/components/shared/ComercialTableColgroup";
import { ConductorEstadoBadge } from "@/components/flota/ConductorEstadoBadge";
import { ConductorAvatar } from "@/components/flota/ConductorAvatar";
import { ConductorDetailSheet } from "@/components/flota/ConductorDetailSheet";
import { ConductorDocumentosDialog } from "@/components/flota/ConductorDocumentosDialog";
import { getConductores, type Conductor } from "@/lib/flotaConductoresApi";
import { formatDateDMY } from "@/lib/formatters";
import { toast } from "@/lib/notify";
import { ChartSquareIcon } from "@/components/icons/ChartSquareIcon";
import { CategorySolidIcon } from "@/components/icons/CategorySolidIcon";
import { ColumnsSvgIcon } from "@/components/icons/ColumnsSvgIcon";
import { ExportSvgIcon } from "@/components/icons/ExportSvgIcon";
import {
  comercialFilterIconClass,
  comercialProCommandClass,
  comercialProPopoverClass,
} from "@/lib/comercialFilterSurface";
import {
  comercialTableCellStyle,
  comercialTableCheckboxWrapClass,
  comercialTableLeadingCellClass,
} from "@/lib/comercialTableLayout";
import {
  crmTableBodyRowClassInteractive,
  crmTableFooterClass,
  crmTableHeaderRowClass,
} from "@/lib/crmTableSurface";

type EstadoPresetKey = "todos" | "disponibilidad" | "con_servicio" | "suspensiones";

const ESTADO_PRESETS: Record<
  EstadoPresetKey,
  {
    label: string;
    idestado: number;
  }
> = {
  todos: { label: "Todos", idestado: 0 },
  disponibilidad: {
    label: "Disponible - No Disponible - Sesión Cerrada",
    idestado: -98,
  },
  con_servicio: {
    label: "Con Servicio",
    idestado: -99,
  },
  suspensiones: {
    label: "Suspensiones",
    idestado: -97,
  },
};

const ESTADO_PRESET_KEYS = Object.keys(ESTADO_PRESETS) as EstadoPresetKey[];

const SELECT_COLUMN_SIZE = 72;
const DOCS_COLUMN_SIZE = 48;

const FIXED_COLUMN_IDS = new Set(["porAutorizar", "documentos"]);

const TABLE_SKELETON_COLUMNS = [
  { label: "", width: SELECT_COLUMN_SIZE, className: "pl-5" },
  { label: "", width: DOCS_COLUMN_SIZE },
  { label: "Conductor", width: 220 },
  { label: "Código", width: 100 },
  { label: "Tipo Doc.", width: 90 },
  { label: "Nº Doc.", width: 100 },
  { label: "Teléfono", width: 130 },
  { label: "Placa", width: 90 },
  { label: "Estado", width: 130 },
  { label: "Agente", width: 120 },
  { label: "Fec. Registro", width: 110 },
];

function formatMultiFilterLabel(
  selected: string[],
  placeholder: string,
  plural: string,
): string {
  if (selected.length === 0) return placeholder;
  if (selected.length === 1) return selected[0];
  return `${selected.length} ${plural}`;
}

function tableCellClass(columnId: string): string {
  return comercialTableLeadingCellClass(columnId, {
    primaryColumnId: "conductor",
    extra: FIXED_COLUMN_IDS.has(columnId) ? "!px-0" : undefined,
  });
}

function fixedColumnStyle(columnId: string, size: number): CSSProperties | undefined {
  if (!FIXED_COLUMN_IDS.has(columnId)) return undefined;
  return selectColumnStyle(size);
}

function selectColumnStyle(size: number): CSSProperties {
  return {
    width: size,
    minWidth: size,
    maxWidth: size,
  };
}

const selectColumnInnerClass = "pl-5";

/** Misma tipografía secundaria que tablas comerciales (Empresas, Contactos). */
const TABLE_CELL_SECONDARY_CLASS =
  "text-[13px] text-[#475569] dark:text-gray-400";

export default function FlotaConductores() {
  const [loading, setLoading] = useState(true);
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [codigoFilter, setCodigoFilter] = useState<string[]>([]);
  const [codigoSearch, setCodigoSearch] = useState("");
  const [estadoPreset, setEstadoPreset] = useState<EstadoPresetKey>("disponibilidad");
  const [estadoPopoverOpen, setEstadoPopoverOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [selectedConductor, setSelectedConductor] = useState<Conductor | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [documentosConductor, setDocumentosConductor] = useState<Conductor | null>(null);
  const [documentosOpen, setDocumentosOpen] = useState(false);

  const STORAGE_KEY = "flota-por-autorizar";
  const [porAutorizarIds, setPorAutorizarIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const porAutorizarSet = useMemo(() => new Set(porAutorizarIds), [porAutorizarIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(porAutorizarIds));
  }, [porAutorizarIds]);

  const codigosList = useMemo(() => {
    return [...new Set(conductores.map((c) => c.codigo).filter(Boolean))].sort() as string[];
  }, [conductores]);

  const filteredCodigosList = useMemo(() => {
    if (!codigoSearch) return codigosList;
    return codigosList.filter((c) =>
      c.toLowerCase().includes(codigoSearch.toLowerCase()),
    );
  }, [codigosList, codigoSearch]);

  useEffect(() => {
    async function loadConductores() {
      setLoading(true);
      try {
        const { idestado } = ESTADO_PRESETS[estadoPreset];
        const data = await getConductores(idestado);
        setConductores(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Error loading conductores:", e);
        toast.error("No se pudieron cargar los conductores");
        setConductores([]);
      } finally {
        setLoading(false);
      }
    }
    void loadConductores();
  }, [estadoPreset]);

  const filteredConductores = useMemo(() => {
    if (!Array.isArray(conductores)) return [];
    return conductores.filter((c) => {
      if (!c) return false;
      const nombreCompleto = `${c.nombres || ""} ${c.apellidos || ""}`.toLowerCase();
      const telefonos = `${c.telefonop || ""} ${c.telefonos || ""}`;
      const matchesSearch =
        !searchTerm ||
        nombreCompleto.includes(searchTerm.toLowerCase()) ||
        telefonos.includes(searchTerm) ||
        (c.nplaca || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCodigo =
        codigoFilter.length === 0 || (c.codigo && codigoFilter.includes(c.codigo));
      return matchesSearch && matchesCodigo;
    });
  }, [conductores, searchTerm, codigoFilter]);

  const displayedConductores = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredConductores.slice(start, start + pageSize);
  }, [filteredConductores, page, pageSize]);

  const totalPages =
    filteredConductores.length > 0
      ? Math.ceil(filteredConductores.length / pageSize)
      : 0;

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    estadoPreset !== "disponibilidad" ||
    codigoFilter.length > 0;

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setEstadoPreset("disponibilidad");
    setCodigoFilter([]);
    setCodigoSearch("");
    setPage(1);
  }, []);

  const openConductorDetail = useCallback((conductor: Conductor) => {
    setSelectedConductor(conductor);
    setDetailOpen(true);
  }, []);

  const openConductorDocumentos = useCallback((conductor: Conductor) => {
    setDocumentosConductor(conductor);
    setDocumentosOpen(true);
  }, []);

  const columns = useMemo<ColumnDef<Conductor>[]>(
    () => [
      {
        id: "porAutorizar",
        header: () => (
          <div className={selectColumnInnerClass}>
            <span className="text-[10px] font-bold uppercase tracking-wide">Por Aut.</span>
          </div>
        ),
        cell: ({ row }) => {
          const conductor = row.original;
          return (
            <div className={selectColumnInnerClass}>
              <div className={comercialTableCheckboxWrapClass}>
                <Checkbox
                  checked={porAutorizarSet.has(String(conductor.idasociado))}
                  onCheckedChange={(checked) => {
                    if (checked === "indeterminate") return;
                    setPorAutorizarIds((prev) =>
                      checked
                        ? [...prev, String(conductor.idasociado)]
                        : prev.filter((id) => id !== String(conductor.idasociado)),
                    );
                  }}
                  aria-label={`Marcar ${conductor.nombres} como por autorizar`}
                  className="h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                />
              </div>
            </div>
          );
        },
        size: SELECT_COLUMN_SIZE,
        minSize: SELECT_COLUMN_SIZE,
        maxSize: SELECT_COLUMN_SIZE,
        enableSorting: false,
        enableResizing: false,
      },
      {
        id: "documentos",
        header: () => (
          <div className="flex justify-center">
            <FileText className="size-3.5 text-muted-foreground" aria-hidden />
          </div>
        ),
        cell: ({ row }) => {
          const conductor = row.original;
          const nombre = `${conductor.nombres ?? ""} ${conductor.apellidos ?? ""}`.trim();
          return (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-primary hover:bg-primary/10 hover:text-primary"
                aria-label={`Ver documentos de ${nombre || conductor.codigo}`}
                onClick={(e) => {
                  e.stopPropagation();
                  openConductorDocumentos(conductor);
                }}
              >
                <FileText className="size-4" />
              </Button>
            </div>
          );
        },
        size: DOCS_COLUMN_SIZE,
        minSize: DOCS_COLUMN_SIZE,
        maxSize: DOCS_COLUMN_SIZE,
        enableSorting: false,
        enableResizing: false,
      },
      {
        id: "conductor",
        header: "Conductor",
        enableHiding: false,
        size: 240,
        cell: ({ row }) => {
          const conductor = row.original;
          const nombre = `${conductor.nombres ?? ""} ${conductor.apellidos ?? ""}`.trim();
          return (
            <div className="flex min-w-0 items-center gap-2">
              <ConductorAvatar conductor={conductor} />
              <p
                className="truncate text-[13px] font-semibold text-[#0F172A] dark:text-gray-100"
                title={nombre || undefined}
              >
                {nombre || "—"}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "codigo",
        id: "codigo",
        header: "Código",
        enableHiding: false,
        size: 100,
        cell: ({ getValue }) => (
          <span className={TABLE_CELL_SECONDARY_CLASS}>
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "tipodocumento",
        id: "tipoDoc",
        header: "Tipo Doc.",
        enableHiding: true,
        size: 90,
        cell: ({ getValue }) => (
          <span className={TABLE_CELL_SECONDARY_CLASS}>
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "ndni",
        id: "ndni",
        header: "Nº Doc.",
        enableHiding: true,
        size: 100,
        cell: ({ getValue }) => (
          <span className={TABLE_CELL_SECONDARY_CLASS}>
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        id: "telefono",
        header: "Teléfono",
        enableHiding: true,
        size: 140,
        cell: ({ row }) => {
          const c = row.original;
          const tel = [c.telefonop, c.telefonos].filter(Boolean).join(" / ");
          return (
            <span className={TABLE_CELL_SECONDARY_CLASS}>{tel || "—"}</span>
          );
        },
      },
      {
        accessorKey: "nplaca",
        id: "placa",
        header: "Placa",
        enableHiding: true,
        size: 90,
        cell: ({ getValue }) => (
          <span className={TABLE_CELL_SECONDARY_CLASS}>
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "estado",
        id: "estado",
        header: "Estado",
        enableHiding: false,
        size: 160,
        cell: ({ getValue }) => <ConductorEstadoBadge estado={getValue() as string} />,
      },
      {
        accessorKey: "agente",
        id: "agente",
        header: "Agente",
        enableHiding: true,
        size: 120,
        cell: ({ getValue }) => (
          <span className={`block truncate ${TABLE_CELL_SECONDARY_CLASS}`}>
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "fechorregistro",
        id: "fechorregistro",
        header: "Fec. Registro",
        enableHiding: true,
        size: 110,
        cell: ({ getValue }) => {
          const val = getValue() as string;
          return (
            <span className={TABLE_CELL_SECONDARY_CLASS}>
              {val ? formatDateDMY(val) : "—"}
            </span>
          );
        },
      },
    ],
    [openConductorDocumentos, porAutorizarSet],
  );

  const table = useReactTable({
    data: displayedConductores,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: { minSize: 60 },
  });

  const toggleCodigo = (codigo: string) => {
    setCodigoFilter((prev) =>
      prev.includes(codigo) ? prev.filter((item) => item !== codigo) : [...prev, codigo],
    );
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conductores"
        description="Conductores de la flota Taxi Monterrico"
        className="mb-4"
      >
        {porAutorizarIds.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
            onClick={() => {
              const count = porAutorizarIds.length;
              setPorAutorizarIds([]);
              toast.success(`${count} marcado(s) eliminado(s)`);
            }}
          >
            <XCircle className="size-4" />
            Limpiar Por Aut. ({porAutorizarIds.length})
          </Button>
        )}
      </PageHeader>

      <GlassCard>
        <div className="flex min-w-0 flex-col gap-2 px-5 py-3 lg:flex-row lg:items-center">
          <div className="relative w-full min-w-0 max-w-[400px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a9aab] dark:text-gray-400" />
            <Input
              placeholder="Buscar por nombre, teléfono o placa..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="!h-10 rounded-lg border border-[#e1e7ee] bg-white/60 pl-8 text-[13px] text-black shadow-none transition-colors placeholder:text-[#8a9aab] hover:border-primary focus-visible:ring-1 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-100 dark:placeholder:text-gray-400"
            />
          </div>

          <Popover open={estadoPopoverOpen} onOpenChange={setEstadoPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex !h-10 w-[220px] cursor-pointer items-center gap-1.5 rounded-lg border border-[#e1e7ee] bg-white/60 px-3 text-left text-[13px] shadow-none transition-colors hover:border-primary dark:border-gray-700 dark:bg-gray-800/60",
                  estadoPreset !== "todos"
                    ? "text-black dark:text-gray-100"
                    : "text-[#8a9aab] dark:text-gray-400",
                )}
              >
                <ChartSquareIcon className={comercialFilterIconClass} />
                <span className="flex-1 truncate">
                  {ESTADO_PRESETS[estadoPreset].label}
                </span>
                <ChevronDown className="size-3.5 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(comercialProPopoverClass, "w-[min(100vw-2rem,360px)] p-1.5")}
              align="start"
              sideOffset={8}
            >
              <Command className={comercialProCommandClass}>
                <CommandList>
                  <CommandGroup>
                    {ESTADO_PRESET_KEYS.map((key) => {
                      const selected = estadoPreset === key;
                      return (
                        <CommandItem
                          key={key}
                          value={ESTADO_PRESETS[key].label}
                          onSelect={() => {
                            setEstadoPreset(key);
                            setPage(1);
                            setEstadoPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4 shrink-0",
                              selected ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span>{ESTADO_PRESETS[key].label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex !h-10 w-[190px] cursor-pointer items-center gap-1.5 rounded-lg border border-[#e1e7ee] bg-white/60 px-3 text-left text-[13px] shadow-none transition-colors hover:border-primary dark:border-gray-700 dark:bg-gray-800/60",
                  codigoFilter.length > 0
                    ? "text-black dark:text-gray-100"
                    : "text-[#8a9aab] dark:text-gray-400",
                )}
              >
                <CategorySolidIcon className={comercialFilterIconClass} />
                <span className="flex-1 truncate">
                  {formatMultiFilterLabel(codigoFilter, "Código", "códigos")}
                </span>
                <ChevronDown className="size-3.5 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(comercialProPopoverClass, "w-[240px] p-1.5")}
              align="start"
              sideOffset={8}
            >
              <Command shouldFilter={false} className={comercialProCommandClass}>
                <CommandInput
                  placeholder="Buscar código..."
                  value={codigoSearch}
                  onValueChange={setCodigoSearch}
                />
                <CommandList className="max-h-[260px] overflow-y-auto">
                  <CommandEmpty>No se encontró código.</CommandEmpty>
                  <CommandGroup>
                    {filteredCodigosList.slice(0, 50).map((codigo) => {
                      const selected = codigoFilter.includes(codigo);
                      return (
                        <CommandItem key={codigo} onSelect={() => toggleCodigo(codigo)}>
                          <span className="[&_svg]:!text-primary-foreground">
                            <Checkbox
                              checked={selected}
                              className="mr-2 h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                            />
                          </span>
                          <span className="font-mono text-xs">{codigo}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
                <MultiCheckboxFilterActions
                  allSelected={
                    filteredCodigosList.length > 0 &&
                    filteredCodigosList.every((c) => codigoFilter.includes(c))
                  }
                  noneSelected={codigoFilter.length === 0}
                  onSelectAll={() => {
                    setCodigoFilter((prev) => [
                      ...new Set([...prev, ...filteredCodigosList]),
                    ]);
                    setPage(1);
                  }}
                  onClear={() => {
                    setCodigoFilter([]);
                    setCodigoSearch("");
                    setPage(1);
                  }}
                />
              </Command>
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" /> Limpiar
            </Button>
          )}

          <div className="ml-auto hidden items-center gap-5 sm:flex">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-[#1f2933] transition-opacity hover:opacity-70 dark:text-gray-100"
                >
                  <ColumnsSvgIcon className="size-[18px]" />
                  Columnas
                </button>
              </PopoverTrigger>
              <PopoverContent
                className={cn(comercialProPopoverClass, "w-[200px] p-1.5")}
                align="end"
                sideOffset={8}
              >
                <Command className={comercialProCommandClass}>
                  <CommandList>
                    <CommandGroup>
                      {[
                        { id: "tipoDoc", label: "Tipo Doc." },
                        { id: "ndni", label: "Nº Doc." },
                        { id: "telefono", label: "Teléfono" },
                        { id: "placa", label: "Placa" },
                        { id: "agente", label: "Agente" },
                        { id: "fechorregistro", label: "Fec. Registro" },
                      ].map((col) => {
                        const visible = columnVisibility[col.id] ?? true;
                        return (
                          <div
                            key={col.id}
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              setColumnVisibility((prev) => ({
                                ...prev,
                                [col.id]: !visible,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                setColumnVisibility((prev) => ({
                                  ...prev,
                                  [col.id]: !visible,
                                }));
                              }
                            }}
                            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                          >
                            <Checkbox
                              checked={visible}
                              className="h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                            />
                            <span className="text-[#1f2933] dark:text-gray-100">{col.label}</span>
                          </div>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-[#1f2933] transition-opacity hover:opacity-70 dark:text-gray-100"
                >
                  <MoreVertical className="size-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toast.info("Exportación próximamente")}>
                  <ExportSvgIcon className="size-[18px]" />
                  Exportar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {loading ? (
          <GhostTableSkeleton columns={TABLE_SKELETON_COLUMNS} rows={10} />
        ) : filteredConductores.length === 0 ? (
          <Card className="rounded-none border-0 shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Car className="mb-4 size-12 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold">No se encontraron conductores</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {conductores.length === 0
                  ? "No hay conductores registrados en la flota."
                  : "Intenta ajustar los filtros para ver más resultados."}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" className="mt-4" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="scrollbar-thin max-h-[calc(100vh-330px)] overflow-auto border-t border-border/40 bg-card/30">
            <table
              className="w-full table-fixed bg-transparent"
              style={{ minWidth: table.getTotalSize() }}
            >
              <ComercialTableColgroup columns={table.getVisibleLeafColumns()} />
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr
                    key={hg.id}
                    className={cn("h-[36px] text-left", crmTableHeaderRowClass)}
                  >
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        colSpan={header.colSpan}
                        className={tableCellClass(header.column.id)}
                        style={
                          fixedColumnStyle(
                            header.column.id,
                            header.column.id === "documentos"
                              ? DOCS_COLUMN_SIZE
                              : SELECT_COLUMN_SIZE,
                          ) ??
                          comercialTableCellStyle(
                            header.column.id,
                            header.getSize(),
                          )
                        }
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanResize() &&
                          header.index < hg.headers.length - 1 && (
                          <div
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              header.getResizeHandler()(e);
                            }}
                            onTouchStart={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              header.getResizeHandler()(e);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="group/rez absolute inset-y-0 right-0 flex w-5 cursor-col-resize items-center justify-center"
                          >
                            <div className="pointer-events-none h-4 w-[2px] select-none rounded-full bg-gray-200 transition-all group-hover/rez:w-[5px] group-hover/rez:bg-blue-500 group-active/rez:w-[5px] group-active/rez:bg-blue-500" />
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-transparent">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "h-[48px] bg-transparent last:border-b-0",
                      crmTableBodyRowClassInteractive,
                    )}
                    onDoubleClick={() => openConductorDetail(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={tableCellClass(cell.column.id)}
                        style={
                          fixedColumnStyle(
                            cell.column.id,
                            cell.column.id === "documentos"
                              ? DOCS_COLUMN_SIZE
                              : SELECT_COLUMN_SIZE,
                          ) ??
                          comercialTableCellStyle(
                            cell.column.id,
                            cell.column.getSize(),
                          )
                        }
                        onClick={
                          FIXED_COLUMN_IDS.has(cell.column.id)
                            ? (e) => e.stopPropagation()
                            : undefined
                        }
                        onDoubleClick={
                          FIXED_COLUMN_IDS.has(cell.column.id)
                            ? (e) => e.stopPropagation()
                            : undefined
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredConductores.length > 0 && (
          <div className={cn("flex h-14 items-center bg-transparent px-5", crmTableFooterClass)}>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filteredConductores.length}
              pageSize={pageSize}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          </div>
        )}
      </GlassCard>

      <ConductorDetailSheet
        conductor={selectedConductor}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <ConductorDocumentosDialog
        conductor={documentosConductor}
        open={documentosOpen}
        onOpenChange={setDocumentosOpen}
      />
    </div>
  );
}
