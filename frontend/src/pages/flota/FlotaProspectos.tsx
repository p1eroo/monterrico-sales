import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Phone, MessageSquare, MoreHorizontal, Filter, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/PageHeader';
import { CrmDataTableSkeleton } from '@/components/shared/CrmListPageSkeleton';

const PROSPECTOS_MOCK = [
  { id: '1', nombres: 'Juan', apellidos: 'Pérez López', dni: '12345678', telefono: '+51 999 111 222', email: 'juan@example.com', estado: 'Nuevo', fuente: 'Web', zona: 'Lima Centro', createdAt: '2026-05-05' },
  { id: '2', nombres: 'María', apellidos: 'García Torres', dni: '23456789', telefono: '+51 999 333 444', email: 'maria@example.com', estado: 'Contactado', fuente: 'Referido', zona: 'Miraflores', createdAt: '2026-05-04' },
  { id: '3', nombres: 'Carlos', apellidos: 'Mendoza Soto', dni: '34567890', telefono: '+51 999 555 666', email: 'carlos@example.com', estado: 'Conversión', fuente: 'Facebook', zona: 'Surco', createdAt: '2026-05-03' },
  { id: '4', nombres: 'Ana', apellidos: 'López Rivera', dni: '45678901', telefono: '+51 999 777 888', email: 'ana@example.com', estado: 'Nuevo', fuente: 'Instagram', zona: 'Barranco', createdAt: '2026-05-02' },
  { id: '5', nombres: 'Pedro', apellidos: 'Castro Ruiz', dni: '56789012', telefono: '+51 999 000 111', email: 'pedro@example.com', estado: 'NoInteresado', fuente: 'Web', zona: 'Lima Norte', createdAt: '2026-05-01' },
  { id: '6', nombres: 'Laura', apellidos: 'Díaz Martín', dni: '67890123', telefono: '+51 999 222 333', email: 'laura@example.com', estado: 'Contactado', fuente: 'Referido', zona: 'San Borja', createdAt: '2026-04-30' },
  { id: '7', nombres: 'Roberto', apellidos: 'Fernández Hayes', dni: '78901234', telefono: '+51 999 444 555', email: 'roberto@example.com', estado: 'Nuevo', fuente: 'TikTok', zona: 'Jesus María', createdAt: '2026-04-29' },
  { id: '8', nombres: 'Sofia', apellidos: 'Romero Valdez', dni: '89012345', telefono: '+51 999 666 777', email: 'sofia@example.com', estado: 'Conversión', fuente: 'Web', zona: 'Cercado de Lima', createdAt: '2026-04-28' },
];

const estadoColors: Record<string, string> = {
  Nuevo: 'bg-blue-100 text-blue-700 border-blue-200',
  Contactado: 'bg-amber-100 text-amber-700 border-amber-200',
  Conversión: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  NoInteresado: 'bg-red-100 text-red-700 border-red-200',
};

export default function FlotaProspectos() {
  const navigate = useNavigate();
  const [loading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredProspectos = useMemo(() => {
    return PROSPECTOS_MOCK.filter(p => {
      const matchesSearch = !searchTerm || 
        `${p.nombres} ${p.apellidos}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.telefono.includes(searchTerm) ||
        p.dni.includes(searchTerm);
      const matchesEstado = estadoFilter === 'all' || p.estado === estadoFilter;
      return matchesSearch && matchesEstado;
    });
  }, [searchTerm, estadoFilter]);

  const paginatedProspectos = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProspectos.slice(start, start + pageSize);
  }, [filteredProspectos, page]);

  const totalPages = Math.ceil(filteredProspectos.length / pageSize);

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

      <Card>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, teléfono o DNI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Nuevo">Nuevo</SelectItem>
              <SelectItem value="Contactado">Contactado</SelectItem>
              <SelectItem value="Conversión">Conversión</SelectItem>
              <SelectItem value="NoInteresado">No Interesado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <CrmDataTableSkeleton
            columns={[{ label: 'Nombre' }, { label: 'DNI' }, { label: 'Teléfono' }, { label: 'Estado' }, { label: 'Fuente' }, { label: 'Zona' }, { label: '' }]}
            rows={5}
            aria-label="Cargando prospectos"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProspectos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      No se encontraron prospectos con los filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedProspectos.map((prospecto) => (
                    <TableRow
                      key={prospecto.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/flota/prospectos/${prospecto.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                            <User className="size-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{prospecto.nombres} {prospecto.apellidos}</p>
                            <p className="text-xs text-muted-foreground">{prospecto.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{prospecto.dni}</TableCell>
                      <TableCell>{prospecto.telefono}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${estadoColors[prospecto.estado] || ''}`}>
                          {prospecto.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{prospecto.fuente}</TableCell>
                      <TableCell className="text-muted-foreground">{prospecto.zona}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Phone className="size-4 mr-2" />
                              Llamar
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <MessageSquare className="size-4 mr-2" />
                              WhatsApp
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
              Mostrando {paginatedProspectos.length} de {filteredProspectos.length} prospectos
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <span className="text-sm">Página {page} de {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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