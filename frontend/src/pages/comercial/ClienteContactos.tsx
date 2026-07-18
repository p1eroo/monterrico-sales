import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import {
  Search, Users, Building2, Phone, Mail, User, X, RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { GlassCard } from '@/components/shared/GlassCard';
import { GhostTableSkeleton } from '@/components/shared/GhostTableSkeleton';
import { MultiAdvisorFilter } from '@/components/shared/MultiAdvisorFilter';
import { CompanyLogoBox } from '@/components/shared/CompanyLogo';
import { useMultiAdvisorFilter } from '@/hooks/useMultiAdvisorFilter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/notify';
import {
  fetchContactosEmpresa,
  type ContactoEmpresaRow,
} from '@/lib/clienteCarteraApi';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { rightDrawerSheetContentClass } from '@/lib/rightPanelShell';

const TABLE_SKELETON_COLUMNS = [
  { label: 'Nombre', width: 220 },
  { label: 'Empresa', width: 200 },
  { label: 'Teléfono', width: 130, className: 'hidden md:table-cell' },
  { label: 'Email', width: 180, className: 'hidden lg:table-cell' },
  { label: 'Asesor', width: 150, className: 'hidden md:table-cell' },
];

export default function ClienteContactos() {
  const {
    selectedIds: assigneeFilter,
    setSelectedIds: setAssigneeFilter,
    canSeeAllAdvisors,
    activeAdvisors,
    isInitialized: assigneeFilterInitialized,
    isActive: assigneeFilterIsActive,
    matchesAssignee,
    reset: resetAdvisorFilter,
  } = useMultiAdvisorFilter();

  const [contactList, setContactList] = useState<ContactoEmpresaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedContact, setSelectedContact] = useState<ContactoEmpresaRow | null>(null);

  const loadFromDb = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await fetchContactosEmpresa();
      setContactList(rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudieron cargar los contactos';
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFromDb();
  }, [loadFromDb]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, assigneeFilter, pageSize]);

  const filtered = useMemo(() => {
    return contactList.filter((row) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        searchTerm === '' ||
        row.nombre.toLowerCase().includes(q) ||
        row.empresa.toLowerCase().includes(q) ||
        (row.telefono ?? '').includes(searchTerm) ||
        (row.email ?? '').toLowerCase().includes(q) ||
        (row.cargo ?? '').toLowerCase().includes(q);
      return matchesSearch && matchesAssignee(row.assignedTo);
    });
  }, [contactList, searchTerm, matchesAssignee]);

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const start = (page - 1) * pageSize;
  const displayed = useMemo(
    () => filtered.slice(start, start + pageSize),
    [filtered, start, pageSize],
  );

  const hasActiveFilters = searchTerm !== '' || assigneeFilterIsActive;

  const columns = useMemo<ColumnDef<ContactoEmpresaRow>[]>(
    () => [
      {
        accessorKey: 'nombre',
        id: 'nombre',
        header: 'Nombre',
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="min-w-0 max-w-[20rem]">
              <p className="truncate text-[13px] font-semibold text-[#0F172A] dark:text-gray-100" title={c.nombre}>
                {c.nombre}
              </p>
              {c.cargo && (
                <p className="truncate text-[11px] text-[#64748B] dark:text-gray-400">{c.cargo}</p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'empresa',
        id: 'empresa',
        header: 'Empresa',
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex min-w-0 items-center gap-2">
              <CompanyLogoBox externalLogoUrl={c.empresaLogoUrl} />
              <span className="truncate text-[13px] text-[#475569] dark:text-gray-400" title={c.empresa}>
                {c.empresa}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'telefono',
        id: 'telefono',
        header: 'Teléfono',
        cell: ({ getValue }) => (
          <span className="text-[13px] text-[#475569] dark:text-gray-400">{String(getValue() || '—')}</span>
        ),
      },
      {
        accessorKey: 'email',
        id: 'email',
        header: 'Email',
        cell: ({ getValue }) => (
          <span className="block truncate text-[13px] text-[#475569] dark:text-gray-400">{String(getValue() || '—')}</span>
        ),
      },
      {
        accessorKey: 'assignedToName',
        id: 'asesor',
        header: 'Asesor',
        cell: ({ getValue }) => (
          <span className="block truncate text-[13px] text-[#475569] dark:text-gray-400">{String(getValue() || '—')}</span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: displayed,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contactos de clientes"
        description="Personal vinculado a empresas de la cartera activa"
      />

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <GlassCard>
        <div className="flex min-w-0 flex-col gap-2 px-5 py-3 lg:flex-row lg:items-center">
          <div className="relative w-full min-w-0 max-w-[400px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a9aab] dark:text-gray-400" />
            <Input
              placeholder="Buscar por nombre, empresa, teléfono o email…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="!h-10 rounded-lg border border-[#e1e7ee] bg-white/60 pl-8 text-[13px] text-black shadow-none transition-colors placeholder:text-[#8a9aab] hover:border-primary focus-visible:ring-1 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-100"
            />
          </div>

          <MultiAdvisorFilter
            value={assigneeFilter}
            onChange={setAssigneeFilter}
            advisors={activeAdvisors}
            disabled={!canSeeAllAdvisors}
            isActive={assigneeFilterIsActive}
            isInitialized={assigneeFilterInitialized}
            className="!h-10 w-[190px]"
            onInteraction={() => setPage(1)}
          />

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); resetAdvisorFilter(); setPage(1); }}>
              <X className="size-4" /> Limpiar
            </Button>
          )}

          <Button variant="outline" size="sm" className="ml-auto" onClick={() => void loadFromDb()} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            Actualizar
          </Button>
        </div>

        {loading ? (
          <GhostTableSkeleton columns={TABLE_SKELETON_COLUMNS} rows={10} />
        ) : totalFiltered === 0 ? (
          <Card className="rounded-none border-0 shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="mb-4 size-12 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold">No se encontraron contactos</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {contactList.length === 0
                  ? 'Aún no hay contactos registrados. Se irán agregando desde la cartera de clientes.'
                  : 'Intenta ajustar los filtros para ver más resultados.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="scrollbar-thin max-h-[calc(100vh-320px)] overflow-auto border-t border-border/40 bg-card/30">
            <table className="w-full table-fixed bg-transparent">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="h-[36px] bg-[#eef1f5] text-left text-[11px] font-bold text-[#647789] dark:bg-gray-800 dark:text-gray-400">
                    {hg.headers.map((header) => (
                      <th key={header.id} className="overflow-hidden px-3 align-middle">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="h-[48px] cursor-pointer border-b border-dashed border-[#e8ecf0] transition-colors hover:bg-[#fafbfc] dark:border-gray-700 dark:hover:bg-gray-800"
                    onClick={() => setSelectedContact(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="overflow-hidden px-3 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalFiltered > 0 && (
          <div className="flex h-14 items-center border-t border-dashed border-[#e8ecf0] px-5 dark:border-gray-700">
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={totalFiltered}
              pageSize={pageSize}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          </div>
        )}
      </GlassCard>

      <Sheet open={!!selectedContact} onOpenChange={(open) => !open && setSelectedContact(null)}>
        <SheetContent side="right" className={rightDrawerSheetContentClass('lg', 'overflow-y-auto')}>
          {selectedContact && (
            <>
              <SheetHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-lg bg-[#13944C]/10">
                    <User className="size-6 text-[#13944C]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="truncate">{selectedContact.nombre}</SheetTitle>
                    <SheetDescription className="truncate">
                      {selectedContact.cargo || 'Contacto de empresa cliente'}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <ScrollArea className="h-[calc(100vh-130px)]">
                <div className="space-y-6 px-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Empresa</h4>
                    <div className="flex items-center gap-3">
                      <Building2 className="size-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm">{selectedContact.empresa}</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <Phone className="size-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm">{selectedContact.telefono || '—'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="size-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm">{selectedContact.email || '—'}</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Asesor</h4>
                    <p className="text-sm">{selectedContact.assignedToName}</p>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
