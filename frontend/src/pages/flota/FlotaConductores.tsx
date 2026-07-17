import { useState, useMemo, useEffect } from "react";
import {
  Search,
  Car,
  Phone,
  MessageSquare,
  MoreHorizontal,
  Filter,
  Download,
  MapPin,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import { CrmDataTableSkeleton } from "@/components/shared/CrmListPageSkeleton";
import { Pagination } from "@/components/shared/Pagination";
import { getConductores, type Conductor } from "@/lib/flotaConductoresApi";
import { TableWithStickyScroll } from "@/components/shared/TableWithStickyScroll";
import { formatCurrency, formatDate, formatDateDMY } from "@/lib/formatters";
import { toast } from '@/lib/notify';

const CONDUCTORES_MOCK = [
  {
    id: "1",
    nombres: "Juan Pérez",
    dni: "12345678",
    telefono: "+51 999 111 222",
    placa: "ABC-1234",
    zona: "Lima Centro",
    estado: "Activo",
    vehicleType: "Sedan",
    ingresos: 4500,
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    nombres: "María García",
    dni: "23456789",
    telefono: "+51 999 333 444",
    placa: "DEF-5678",
    zona: "Miraflores",
    estado: "Activo",
    vehicleType: "SUV",
    ingresos: 5200,
    createdAt: "2024-02-20",
  },
  {
    id: "3",
    nombres: "Carlos Mendoza",
    dni: "34567890",
    telefono: "+51 999 555 666",
    placa: "GHI-9012",
    zona: "Surco",
    estado: "Activo",
    vehicleType: "Sedan",
    ingresos: 3800,
    createdAt: "2024-03-10",
  },
  {
    id: "4",
    nombres: "Ana López",
    dni: "45678901",
    telefono: "+51 999 777 888",
    placa: "JKL-3456",
    zona: "Barranco",
    estado: "Inactivo",
    vehicleType: "Compact",
    ingresos: 0,
    createdAt: "2024-04-05",
  },
  {
    id: "5",
    nombres: "Pedro Castro",
    dni: "56789012",
    telefono: "+51 999 000 111",
    placa: "MNO-7890",
    zona: "Lima Norte",
    estado: "Activo",
    vehicleType: "Sedan",
    ingresos: 4100,
    createdAt: "2024-05-12",
  },
  {
    id: "6",
    nombres: "Laura Díaz",
    dni: "67890123",
    telefono: "+51 999 222 333",
    placa: "PQR-1234",
    zona: "San Borja",
    estado: "Activo",
    vehicleType: "SUV",
    ingresos: 5500,
    createdAt: "2024-06-18",
  },
  {
    id: "7",
    nombres: "Roberto Fernández",
    dni: "78901234",
    telefono: "+51 999 444 555",
    placa: "STU-5678",
    zona: "Jesus María",
    estado: "EnCapacitacion",
    vehicleType: "Sedan",
    ingresos: 0,
    createdAt: "2026-05-01",
  },
  {
    id: "8",
    nombres: "Sofia Romero",
    dni: "89012345",
    telefono: "+51 999 666 777",
    placa: "VWX-9012",
    zona: "Cercado de Lima",
    estado: "Activo",
    vehicleType: "Sedan",
    ingresos: 4200,
    createdAt: "2024-07-22",
  },
];

const estadoColors: Record<string, string> = {
  ACTIVO: "bg-emerald-100 text-emerald-700 border-emerald-200",
  INACTIVO: "bg-red-100 text-red-700 border-red-200",
  EN_CAPACITACION: "bg-blue-100 text-blue-700 border-blue-200",
  NO_DISPONIBLE: "bg-gray-100 text-gray-700 border-gray-200",
  DISPONIBLE: "bg-green-100 text-green-700 border-green-200",
  EN_SIMULACION: "bg-purple-100 text-purple-700 border-purple-200",
};

const ESTADOS_LIST = [
  "(Vacío)",
  "ASIGNACION AUTOMATICA",
  "CAMINO AL SERVICIO",
  "CERRAR SESIÓN",
  "DISPONIBLE",
  "EN EL PUNTO",
  "LISTA NEGRA - INADMISIBLE",
  "NO DISPONIBLE",
  "PERMISO TEMPORAL",
  "RETIRADO",
  "SERVICIO EN PROCESO",
  "SESION CERRADA",
];

export default function FlotaConductores() {
  const [loading, setLoading] = useState(true);
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [codigoFilter, setCodigoFilter] = useState<string[]>([]);
  const [codigoPopoverOpen, setCodigoPopoverOpen] = useState(false);
  const [codigoSearch, setCodigoSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string[]>([]);
  const [estadoPopoverOpen, setEstadoPopoverOpen] = useState(false);
  const [estadoSearch, setEstadoSearch] = useState("");
  const [page, setPage] = useState(1);

  const STORAGE_KEY = 'flota-por-autorizar';
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

  const [pageSize, setPageSize] = useState(25);

  const codigosList = useMemo(() => {
    return [...new Set(conductores.map(c => c.codigo).filter(Boolean))].sort() as string[];
  }, [conductores]);

  const filteredCodigosList = useMemo(() => {
    if (!codigoSearch) return codigosList;
    return codigosList.filter(c => c.toLowerCase().includes(codigoSearch.toLowerCase()));
  }, [codigosList, codigoSearch]);

  const filteredEstadosList = useMemo(() => {
    if (!estadoSearch) return ESTADOS_LIST;
    return ESTADOS_LIST.filter(e => e.toLowerCase().includes(estadoSearch.toLowerCase()));
  }, [estadoSearch]);

  useEffect(() => {
async function loadConductores() {
      setLoading(true);
      try {
        const data = await getConductores();
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
  }, []);

  const filteredConductores = useMemo(() => {
    if (!Array.isArray(conductores)) return [];
    return conductores.filter((c) => {
      if (!c) return false;
      const nombreCompleto = `${c.nombres || ''} ${c.apellidos || ''}`.toLowerCase();
      const telefonos = `${c.telefonop || ''} ${c.telefonos || ''}`;
      const matchesSearch =
        !searchTerm ||
        nombreCompleto.includes(searchTerm.toLowerCase()) ||
        telefonos.includes(searchTerm) ||
        (c.nplaca || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCodigo = codigoFilter.length === 0 || (c.codigo && codigoFilter.includes(c.codigo));
      const conductorEstado = c.estado || "(Vacío)";
      const matchesEstado = estadoFilter.length === 0 || estadoFilter.includes(conductorEstado);
      return matchesSearch && matchesCodigo && matchesEstado;
    });
  }, [conductores, searchTerm, codigoFilter, estadoFilter]);

  const paginatedConductores = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredConductores.slice(start, start + pageSize);
  }, [filteredConductores, page]);

  const totalPages = filteredConductores.length > 0 ? Math.ceil(filteredConductores.length / pageSize) : 0;


const stats = useMemo(() => {
    if (!Array.isArray(conductores)) return { activos: 0, inactivos: 0, enCapacitacion: 0 };
    const activos = conductores.filter(
      (c) => c.estado === "ACTIVO",
    ).length;
    const inactivos = conductores.filter(
      (c) => c.estado === "INACTIVO",
    ).length;
    const enCapacitacion = conductores.filter(
      (c) => c.estado === "EN CAPACITACION",
    ).length;
    return { activos, inactivos, enCapacitacion };
  }, [conductores]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conductores"
        description="Conductores de la flota Taxi Monterrico"
      >
        {porAutorizarIds.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
            onClick={() => {
              setPorAutorizarIds([]);
              toast.success(`${porAutorizarIds.length} marcado(s) eliminado(s)`);
            }}
          >
            <XCircle className="size-4" />
            Limpiar Por Aut. ({porAutorizarIds.length})
          </Button>
        )}
        <Button variant="outline" className="gap-1.5">
          <Download className="size-4" />
          Exportar
        </Button>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="py-0">
          <CardContent className="flex items-center gap-4 px-4 py-3">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
              <Car className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{conductores.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="flex items-center gap-4 px-4 py-3">
            <div className="flex size-12 items-center justify-center rounded-lg bg-emerald-100">
              <Car className="size-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Activos</p>
              <p className="text-2xl font-bold">{stats.activos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="flex items-center gap-4 px-4 py-3">
            <div className="flex size-12 items-center justify-center rounded-lg bg-red-100">
              <Car className="size-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inactivos</p>
              <p className="text-2xl font-bold">{stats.inactivos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="flex items-center gap-4 px-4 py-3">
            <div className="flex size-12 items-center justify-center rounded-lg bg-blue-100">
              <Car className="size-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">En Capacitacion</p>
              <p className="text-2xl font-bold">{stats.enCapacitacion}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center ">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono o placa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-card pl-9"
          />
        </div>
        <Popover open={estadoPopoverOpen} onOpenChange={setEstadoPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[200px] justify-between shadow-none bg-card font-normal">
              {estadoFilter.length === 0
                ? "Estado: Todos"
                : estadoFilter.length === 1
                ? estadoFilter[0]
                : estadoSearch && filteredEstadosList.every(e => estadoFilter.includes(e))
                ? `Estado: ${estadoSearch}`
                : `${estadoFilter.length} estados`}
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput 
                placeholder="Buscar estado..." 
                value={estadoSearch}
                onValueChange={setEstadoSearch}
              />
              <CommandList>
                <CommandEmpty>No se encontró estado.</CommandEmpty>
                <CommandGroup>
                  {filteredEstadosList.slice(0, 50).map((estado) => {
                    const isSelected = estadoFilter.includes(estado);
                    return (
                      <CommandItem
                        key={estado}
                        value={estado}
                        onSelect={() => {
                          setEstadoFilter((prev) =>
                            isSelected
                              ? prev.filter((item) => item !== estado)
                              : [...prev, estado]
                          );
                        }}
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </div>
                        {estado}
                      </CommandItem>
                    );
                  })}
                  {filteredEstadosList.length > 50 && (
                    <div className="py-2 text-center text-xs text-muted-foreground">
                      Mostrando 50 de {filteredEstadosList.length}. Sigue escribiendo...
                    </div>
                  )}
                </CommandGroup>
              </CommandList>
              <CommandSeparator />
              <div className="flex items-center justify-between p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs font-semibold text-primary"
                  onClick={() => {
                    const allSelected = filteredEstadosList.length > 0 && filteredEstadosList.every(e => estadoFilter.includes(e));
                    if (allSelected) {
                      setEstadoFilter(prev => prev.filter(e => !filteredEstadosList.includes(e)));
                    } else {
                      setEstadoFilter(prev => [...new Set([...prev, ...filteredEstadosList])]);
                    }
                  }}
                >
                  {filteredEstadosList.length > 0 && filteredEstadosList.every(e => estadoFilter.includes(e)) ? "Limpiar" : "Seleccionar todos"}
                </Button>
                <div className="flex items-center gap-1">
                  {estadoFilter.length > 0 && estadoFilter.length !== ESTADOS_LIST.length && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                      onClick={() => {
                        setEstadoFilter([]);
                        setEstadoSearch("");
                      }}
                    >
                      Limpiar todo
                    </Button>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setEstadoPopoverOpen(false)}
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            </Command>
          </PopoverContent>
        </Popover>
        <Popover open={codigoPopoverOpen} onOpenChange={setCodigoPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[200px] justify-between shadow-none bg-card font-normal">
              {codigoFilter.length === 0
                ? "Código: Todos"
                : codigoFilter.length === 1
                ? codigoFilter[0]
                : codigoSearch && filteredCodigosList.every(c => codigoFilter.includes(c))
                ? `Código: ${codigoSearch}`
                : `${codigoFilter.length} códigos`}
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput 
                placeholder="Buscar código..." 
                value={codigoSearch}
                onValueChange={setCodigoSearch}
              />
              <CommandList>
                <CommandEmpty>No se encontró código.</CommandEmpty>
                <CommandGroup>
                  {filteredCodigosList.slice(0, 50).map((codigo) => {
                    const isSelected = codigoFilter.includes(codigo);
                    return (
                      <CommandItem
                        key={codigo}
                        value={codigo}
                        onSelect={() => {
                          setCodigoFilter((prev) =>
                            isSelected
                              ? prev.filter((item) => item !== codigo)
                              : [...prev, codigo]
                          );
                        }}
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </div>
                        {codigo}
                      </CommandItem>
                    );
                  })}
                  {filteredCodigosList.length > 50 && (
                    <div className="py-2 text-center text-xs text-muted-foreground">
                      Mostrando 50 de {filteredCodigosList.length}. Sigue escribiendo para buscar...
                    </div>
                  )}
                </CommandGroup>
              </CommandList>
              <CommandSeparator />
              <div className="flex items-center justify-between p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs font-semibold text-primary"
                  onClick={() => {
                    const allSelected = filteredCodigosList.length > 0 && filteredCodigosList.every(c => codigoFilter.includes(c));
                    if (allSelected) {
                      setCodigoFilter(prev => prev.filter(c => !filteredCodigosList.includes(c)));
                    } else {
                      setCodigoFilter(prev => [...new Set([...prev, ...filteredCodigosList])]);
                    }
                  }}
                >
                  {filteredCodigosList.length > 0 && filteredCodigosList.every(c => codigoFilter.includes(c)) ? "Limpiar" : "Seleccionar todos"}
                </Button>
                <div className="flex items-center gap-1">
                  {codigoFilter.length > 0 && codigoFilter.length !== codigosList.length && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                      onClick={() => {
                        setCodigoFilter([]);
                        setCodigoSearch("");
                      }}
                    >
                      Limpiar todo
                    </Button>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setCodigoPopoverOpen(false)}
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      
      <TableWithStickyScroll maxHeight="calc(100vh - 26rem)">
        {loading ? (
            <CrmDataTableSkeleton
              columns={[
                { label: "Conductor" },
                { label: "DNI" },
                { label: "Teléfono" },
                { label: "Placa" },
                { label: "Zona" },
                { label: "Estado" },
                { label: "Ingresos" },
                { label: "" },
              ]}
              rows={5}
              aria-label="Cargando conductores"
              className="bg-card"
            />
        ) : (
            <Table containerClassName="overflow-visible" className="min-w-[1280px] bg-transparent">
              <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-12 text-center">
                      <span>Por Aut.</span>
                    </TableHead>
                  <TableHead>Conductor</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Tipo Doc.</TableHead>
                  <TableHead>Nº Doc.</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Fec. Registro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedConductores.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No se encontraron conductores con los filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedConductores.map((conductor) => (
                    <TableRow
                      key={conductor.id}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={porAutorizarSet.has(String(conductor.idasociado))}
                          onCheckedChange={(checked) => {
                            if (checked === 'indeterminate') return;
                            setPorAutorizarIds((prev) =>
                              checked
                                ? [...prev, String(conductor.idasociado)]
                                : prev.filter((id) => id !== String(conductor.idasociado)),
                            );
                          }}
                          aria-label={`Marcar ${conductor.nombres} como por autorizar`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                            {conductor.nombres
                              ? conductor.nombres
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                              : "—"}
                          </div>
                          <p className="font-medium">
                            {conductor.nombres} {conductor.apellidos}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {conductor.codigo || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {conductor.tipodocumento || "—"}
                      </TableCell>
                      <TableCell>{conductor.ndni || "—"}</TableCell>
                      <TableCell>
                        {conductor.telefonop} {conductor.telefonos ? `/ ${conductor.telefonos}` : ""}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono bg-muted/30">
                          {conductor.nplaca || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            conductor.estado === "Activo" || conductor.estado === "ACTIVO"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                          )}
                        >
                          {conductor.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {conductor.agente || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {conductor.fechorregistro ? formatDateDMY(conductor.fechorregistro) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
        )}
      </TableWithStickyScroll>

      {!loading && totalPages > 0 && (
        <div>
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
    </div>
  );
}
