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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/PageHeader";
import { CrmDataTableSkeleton } from "@/components/shared/CrmListPageSkeleton";
import { getConductores, type Conductor } from "@/lib/flotaConductoresApi";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toast } from "sonner";

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

export default function FlotaConductores() {
  const [loading, setLoading] = useState(true);
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

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
      const matchesEstado = estadoFilter === "all" || c.estado === estadoFilter;
      return matchesSearch && matchesEstado;
    });
  }, [conductores, searchTerm, estadoFilter]);

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
        <Select value={estadoFilter} onValueChange={setEstadoFilter}>
          <SelectTrigger className="w-40 shadow-none bg-card">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="DISPONIBLE">DISPONIBLE</SelectItem>
            <SelectItem value="NO DISPONIBLE">NO DISPONIBLE</SelectItem>
            <SelectItem value="CERRAR SESIÓN">CERRAR SESIÓN</SelectItem>
            <SelectItem value="SESIÓN CERRADA">SESIÓN CERRADA</SelectItem>
            <SelectItem value="ACTIVO">ACTIVO</SelectItem>
            <SelectItem value="INACTIVO">INACTIVO</SelectItem>
            <SelectItem value="EN CAPACITACION">EN CAPACITACION</SelectItem>
            <SelectItem value="EN SIMULACION">EN SIMULACION</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
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
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conductor</TableHead>
                  <TableHead>Tipo Doc.</TableHead>
                  <TableHead>Nº Doc.</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Fec. Registro</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedConductores.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
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
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                            {conductor.nombres
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <p className="font-medium">
                            {conductor.nombres} {conductor.apellidos}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{conductor.tipodocumento}</TableCell>
                      <TableCell>{conductor.ndni}</TableCell>
                      <TableCell>
                        {conductor.telefonop} - {conductor.telefonos}
                      </TableCell>
                      <TableCell className="font-medium">
                        {conductor.nplaca}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            estadoColors[conductor.estado] || ""
                          }`}
                        >
                          {conductor.estado}
                        </Badge>
                      </TableCell>
                      <TableCell>{conductor.agente}</TableCell>
                      <TableCell>{formatDate(conductor.fechorregistro)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Ver detalle</DropdownMenuItem>
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
              Mostrando {paginatedConductores.length} de{" "}
              {filteredConductores.length} conductores
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
    </div>
  );
}
