import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  UserPlus,
  Phone,
  MessageSquare,
  MoreHorizontal,
  Filter,
  User,
  Check,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/PageHeader";
import { CrmDataTableSkeleton } from "@/components/shared/CrmListPageSkeleton";
import { formatDateDMY } from "@/lib/formatters";

interface FlotaProspecto {
  id: string;
  fechaRegistro: string;
  redSocial: string;
  celular: string;
  nombres: string;
  apellidos: string;
  edad: number;
  operador: string;
  estado: string;
  modalidad: string;
  anioVehiculo: number | null;
  distrito: string;
  fechaCita: string | null;
  asistencia: string | null;
  fechaAfiliacion: string | null;
  movil: string;
  observaciones: string;
}

const PROSPECTOS_MOCK: FlotaProspecto[] = [
  {
    id: "1",
    fechaRegistro: "2026-05-05",
    redSocial: "Facebook",
    celular: "999 111 222",
    nombres: "Juan",
    apellidos: "Pérez López",
    edad: 35,
    operador: "Carlos",
    estado: "Nuevo",
    modalidad: "Arrendamiento",
    anioVehiculo: 2020,
    distrito: "Lima Centro",
    fechaCita: "2026-05-10",
    asistencia: null,
    fechaAfiliacion: null,
    movil: "1234-ABC",
    observaciones: "Tiene vehículo propio",
  },
  {
    id: "2",
    fechaRegistro: "2026-05-04",
    redSocial: "Instagram",
    celular: "999 333 444",
    nombres: "María",
    apellidos: "García Torres",
    edad: 28,
    operador: "Ana",
    estado: "Contactado",
    modalidad: "Propio",
    anioVehiculo: 2022,
    distrito: "Miraflores",
    fechaCita: "2026-05-08",
    asistencia: "Asistió",
    fechaAfiliacion: null,
    movil: "5678-DEF",
    observaciones: "Interesada en zona Sur",
  },
  {
    id: "3",
    fechaRegistro: "2026-05-03",
    redSocial: "TikTok",
    celular: "999 555 666",
    nombres: "Carlos",
    apellidos: "Mendoza Soto",
    edad: 42,
    operador: "Carlos",
    estado: "Afiliado",
    modalidad: "Arrendamiento",
    anioVehiculo: 2021,
    distrito: "Surco",
    fechaCita: "2026-05-06",
    asistencia: "Asistió",
    fechaAfiliacion: "2026-05-06",
    movil: "9012-GHI",
    observaciones: "Se afilió correctamente",
  },
  {
    id: "4",
    fechaRegistro: "2026-05-02",
    redSocial: "Web",
    celular: "999 777 888",
    nombres: "Ana",
    apellidos: "López Rivera",
    edad: 31,
    operador: "Pedro",
    estado: "Nuevo",
    modalidad: "Arrendamiento",
    anioVehiculo: 2019,
    distrito: "Barranco",
    fechaCita: null,
    asistencia: null,
    fechaAfiliacion: null,
    movil: "3456-JKL",
    observaciones: "",
  },
  {
    id: "5",
    fechaRegistro: "2026-05-01",
    redSocial: "Referido",
    celular: "999 000 111",
    nombres: "Pedro",
    apellidos: "Castro Ruiz",
    edad: 45,
    operador: "Ana",
    estado: "NoInteresado",
    modalidad: "Propio",
    anioVehiculo: 2018,
    distrito: "Lima Norte",
    fechaCita: null,
    asistencia: "NoAsistió",
    fechaAfiliacion: null,
    movil: "7890-MNO",
    observaciones: "No le interesa",
  },
  {
    id: "6",
    fechaRegistro: "2026-04-30",
    redSocial: "Facebook",
    celular: "999 222 333",
    nombres: "Laura",
    apellidos: "Díaz Martín",
    edad: 29,
    operador: "Carlos",
    estado: "Contactado",
    modalidad: "Arrendamiento",
    anioVehiculo: 2023,
    distrito: "San Borja",
    fechaCita: "2026-05-12",
    asistencia: null,
    fechaAfiliacion: null,
    movil: "1231-PQR",
    observaciones: "Primera llamada",
  },
  {
    id: "7",
    fechaRegistro: "2026-04-29",
    redSocial: "Instagram",
    celular: "999 444 555",
    nombres: "Roberto",
    apellidos: "Fernández Hayes",
    edad: 38,
    operador: "Pedro",
    estado: "Nuevo",
    modalidad: "Propio",
    anioVehiculo: 2020,
    distrito: "Jesus María",
    fechaCita: null,
    asistencia: null,
    fechaAfiliacion: null,
    movil: "4444-STU",
    observaciones: "",
  },
  {
    id: "8",
    fechaRegistro: "2026-04-28",
    redSocial: "Web",
    celular: "999 666 777",
    nombres: "Sofia",
    apellidos: "Romero Valdez",
    edad: 33,
    operador: "Ana",
    estado: "Afiliado",
    modalidad: "Arrendamiento",
    anioVehiculo: 2021,
    distrito: "Cercado de Lima",
    fechaCita: "2026-05-05",
    asistencia: "Asistió",
    fechaAfiliacion: "2026-05-05",
    movil: "6666-VWX",
    observaciones: " Buen candidato",
  },
];

const estadoColors: Record<string, string> = {
  Nuevo: "bg-blue-100 text-blue-700 border-blue-200",
  Contactado: "bg-amber-100 text-amber-700 border-amber-200",
  Afiliado: "bg-emerald-100 text-emerald-700 border-emerald-200",
  NoInteresado: "bg-red-100 text-red-700 border-red-200",
};

export default function FlotaProspectos() {
  const navigate = useNavigate();
  const [loading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredProspectos = useMemo(() => {
    return PROSPECTOS_MOCK.filter((p) => {
      const fullName = `${p.nombres} ${p.apellidos}`.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        fullName.includes(searchTerm.toLowerCase()) ||
        p.celular.includes(searchTerm) ||
        p.distrito.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesEstado = estadoFilter === "all" || p.estado === estadoFilter;
      return matchesSearch && matchesEstado;
    });
  }, [searchTerm, estadoFilter]);

  const paginatedProspectos = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProspectos.slice(start, start + pageSize);
  }, [filteredProspectos, page]);

  const totalPages = Math.ceil(filteredProspectos.length / pageSize);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedProspectos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedProspectos.map((p) => p.id)));
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospectos"
        description="Personas interesadas en unirse a la flota de Taxi Monterrico"
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-1.5">
            <Filter className="size-4" />
            Filtrar
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
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-9 bg-card"
          />
        </div>
        <Select value={estadoFilter} onValueChange={setEstadoFilter}>
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
              { label: "" },
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
                        selectedIds.size === paginatedProspectos.length &&
                        paginatedProspectos.length > 0
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
                  <TableHead className="max-w-[200px]">Observaciones</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProspectos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={17}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No se encontraron prospectos con los filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedProspectos.map((prospecto) => (
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
                        {formatDateDMY(prospecto.fechaRegistro)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {prospecto.redSocial}
                      </TableCell>
                      <TableCell>{prospecto.celular}</TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {prospecto.nombres} {prospecto.apellidos}
                        </span>
                      </TableCell>
                      <TableCell>{prospecto.edad}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {prospecto.operador}
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
                        {prospecto.modalidad}
                      </TableCell>
                      <TableCell>{prospecto.anioVehiculo || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {prospecto.distrito}
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
                              prospecto.asistencia === "Asistió"
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
                        {prospecto.movil}
                      </TableCell>
                      <TableCell
                        className="max-w-[200px] truncate"
                        title={prospecto.observaciones}
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
              Mostrando {paginatedProspectos.length} de{" "}
              {filteredProspectos.length} prospectos
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
    </div>
  );
}
