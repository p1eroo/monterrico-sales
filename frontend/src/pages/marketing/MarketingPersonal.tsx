import { useState, useEffect, useMemo } from 'react';
import { Users, Search, Loader2, AlertTriangle, Phone, Building2, Download } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { fetchAllPersonal, type PersonalRow } from '@/lib/marketingApi';
import { useAppStore } from '@/store';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

import * as XLSX from 'xlsx';

function exportToXlsx(rows: PersonalRow[]) {
  const data = rows.map((r) => ({
    Nombre: `${r.nombres} ${r.apellidos}`,
    Teléfono: r.telefonoprincipal,
    Empresa: r.empresa,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Personal');
  XLSX.writeFile(wb, `personal-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function getInitials(nombres: string, apellidos: string) {
  const a = (nombres?.charAt(0) ?? '').toUpperCase();
  const b = (apellidos?.charAt(0) ?? '').toUpperCase();
  return `${a}${b}` || '?';
}

export default function MarketingPersonal() {
  const currentUser = useAppStore((s) => s.currentUser);

  const [data, setData] = useState<PersonalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchAllPersonal(currentUser.username);
        if (!cancelled) setData(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar datos');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [currentUser.username]);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (p) =>
        `${p.nombres} ${p.apellidos}`.toLowerCase().includes(q) ||
        p.telefonoprincipal.includes(q) ||
        p.empresa.toLowerCase().includes(q),
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Personal" description="Personal de todas las empresas" />

      <Card>
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#E5EAF0]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, teléfono o empresa..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 h-9 rounded-xl border-[#E2E8F0] bg-white shadow-sm"
            />
          </div>
          {!loading && !error && filtered.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToXlsx(filtered)}
              className="h-9 rounded-xl border-[#E2E8F0] bg-white shadow-sm"
            >
              <Download className="size-4 mr-1.5" />
              Exportar
            </Button>
          )}
          <div className="text-sm text-muted-foreground">
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              `${filtered.length} registro${filtered.length !== 1 ? 's' : ''}`
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Cargando personal...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertTriangle className="size-8 text-destructive" />
            <p className="text-sm text-destructive font-medium">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setError(null);
                setLoading(true);
                fetchAllPersonal(currentUser.username)
                  .then(setData)
                  .catch((e) => setError(e.message))
                  .finally(() => setLoading(false));
              }}
            >
              Reintentar
            </Button>
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead>Nombre completo</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Empresa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3">
                        <Users className="size-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {search ? 'No se encontraron registros con ese filtro' : 'No hay personal registrado'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((person) => (
                    <TableRow key={person.idpersonalempresa}>
                      <TableCell>
                        <Avatar className="size-9">
                          <AvatarImage src="" alt="" />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(person.nombres, person.apellidos)}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">
                        {person.nombres} {person.apellidos}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="size-3.5 shrink-0" />
                          {person.telefonoprincipal || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="size-3.5 shrink-0" />
                          {person.empresa}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {!loading && !error && filtered.length > 0 && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />
      )}
    </div>
  );
}
