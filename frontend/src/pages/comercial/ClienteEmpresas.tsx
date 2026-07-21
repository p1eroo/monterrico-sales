import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { navigateOnAuxClick, navigateOnClick } from '@/lib/navigateOnClick';
import { clienteEmpresaDetailHref } from '@/lib/detailRoutes';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import type { Client, ClientStatus } from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { GlassCard } from '@/components/shared/GlassCard';
import { GhostTableSkeleton } from '@/components/shared/GhostTableSkeleton';
import { MultiAdvisorFilter } from '@/components/shared/MultiAdvisorFilter';
import { MultiCheckboxFilterActions } from '@/components/shared/MultiCheckboxFilterActions';
import { CompanyLogoBox } from '@/components/shared/CompanyLogo';
import { useMultiAdvisorFilter } from '@/hooks/useMultiAdvisorFilter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2, Search,
  ChevronDown, MoreVertical, X, Eye,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { ComercialTableColgroup } from '@/components/shared/ComercialTableColgroup';
import {
  comercialTableActionsColumnSizing,
  comercialTableCellStyle,
  comercialTableLeadingCellClass,
  comercialTableSelectColumnSizing,
  comercialTableCheckboxWrapClass,
} from '@/lib/comercialTableLayout';
import { comercialFilterIconClass, comercialProPopoverClass, comercialProCommandClass } from '@/lib/comercialFilterSurface';
import { usePermissions } from '@/hooks/usePermissions';
import {
  refreshClienteEmpresas,
  fetchClienteEmpresas,
  mapClienteEmpresaToClient,
} from '@/lib/clienteCarteraApi';
import { ChartSquareIcon } from '@/components/icons/ChartSquareIcon';
import { ColumnsSvgIcon } from '@/components/icons/ColumnsSvgIcon';
import { ExportSvgIcon } from '@/components/icons/ExportSvgIcon';

const CLIENTS_TABLE_SKELETON_COLUMNS = [
  { label: '', width: 44 },
  { label: '', width: 40 },
  { label: 'Empresa', width: 280 },
  { label: 'RUC', width: 120, className: 'hidden md:table-cell' },
  { label: 'Teléfono', width: 120, className: 'hidden md:table-cell' },
  { label: 'Email', width: 180, className: 'hidden lg:table-cell' },
  { label: 'Estado', width: 100 },
  { label: 'Asesor', width: 150, className: 'hidden md:table-cell' },
  { label: 'Fecha alta', width: 120, className: 'hidden xl:table-cell' },
  { label: 'Ingresos', width: 150 },
];

const CLIENT_STATUS_OPTIONS: { key: ClientStatus; label: string }[] = [
  { key: 'activo', label: 'Activo' },
  { key: 'inactivo', label: 'Inactivo' },
  { key: 'potencial', label: 'Potencial' },
];

const clientStatusConfig: Record<ClientStatus, { label: string; className: string }> = {
  activo: { label: 'Activo', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  inactivo: { label: 'Inactivo', className: 'bg-red-100 text-red-700 border-emerald-200' },
  potencial: { label: 'Potencial', className: 'bg-amber-100 text-amber-700 border-emerald-200' },
};

function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const config = clientStatusConfig[status];
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}

function getDomainFromEmail(email: string): string | null {
  const match = email?.match(/@([\w.-]+\.[a-z]{2,})/i);
  return match ? match[1] : null;
}

function truncateCompanyName(name: string, maxLength = 28): string {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength - 3) + '...';
}

function exportClientsToCSV(clients: Client[]) {
  const headers = ['Empresa', 'RUC', 'Dominio', 'Teléfono', 'Email', 'Estado', 'Asesor', 'Fecha alta', 'Ingresos'];
  const rows = clients.map((c) => [
    c.company,
    c.ruc ?? '',
    getDomainFromEmail(c.email) ?? '',
    c.phone,
    c.email,
    clientStatusConfig[c.status].label,
    c.assignedToName,
    formatDate(c.createdAt),
    c.totalRevenue.toString(),
  ]);
  const csvContent = [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ClienteEmpresas() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
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

  const [clientList, setClientList] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    ruc: true,
    phone: true,
    email: true,
    asesor: true,
    createdAt: true,
  });
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setLoading(true);
      setLoadError(null);
      try {
        const cached = await fetchClienteEmpresas();
        if (!cancelled && cached.length > 0) {
          setClientList(cached.map(mapClienteEmpresaToClient));
          setLoading(false);
        }
        const result = await refreshClienteEmpresas();
        if (!cancelled) {
          setClientList(result.data.map(mapClienteEmpresaToClient));
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'No se pudieron cargar los clientes';
          setLoadError(msg);
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void bootstrap();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, assigneeFilter, pageSize]);

  const filteredClients = useMemo(() => {
    const rucQuery = searchTerm.replace(/\D/g, '');
    return clientList.filter((client) => {
      const matchesSearch =
        searchTerm === '' ||
        client.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone.includes(searchTerm) ||
        (rucQuery.length > 0 &&
          (client.ruc?.replace(/\D/g, '').includes(rucQuery) ?? false));

      const matchesStatus =
        statusFilter.length === 0 || statusFilter.includes(client.status);

      return matchesSearch && matchesStatus && (
        canSeeAllAdvisors ? matchesAssignee(client.assignedTo) : true
      );
    });
  }, [clientList, searchTerm, statusFilter, matchesAssignee, canSeeAllAdvisors]);

  const totalFiltered = filteredClients.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const start = (page - 1) * pageSize;
  const displayedClients = useMemo(
    () => filteredClients.slice(start, start + pageSize),
    [filteredClients, start, pageSize],
  );

  const allSelected =
    displayedClients.length > 0 && selectedClientIds.length === displayedClients.length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedClientIds([]);
    } else {
      setSelectedClientIds(displayedClients.map((client) => client.id));
    }
  }

  function toggleSelectClient(id: string) {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  const hasActiveFilters =
    searchTerm !== '' ||
    statusFilter.length > 0 ||
    assigneeFilterIsActive;

  function clearFilters() {
    setSearchTerm('');
    setStatusFilter([]);
    resetAdvisorFilter();
    setPage(1);
  }

  function openClientDetail(client: Client, event?: React.MouseEvent) {
    const path = clienteEmpresaDetailHref({ empresa: client.company });
    if (event) {
      navigateOnClick(event, path, navigate);
      return;
    }
    navigate(path);
  }

  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <div className={comercialTableCheckboxWrapClass}>
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
              className="h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className={comercialTableCheckboxWrapClass}>
            <Checkbox
              checked={selectedClientIds.includes(row.original.id)}
              onCheckedChange={() => toggleSelectClient(row.original.id)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
            />
          </div>
        ),
        ...comercialTableSelectColumnSizing,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Acciones"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  openClientDetail(row.original);
                }}
              >
                <Eye /> Ver detalle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        ...comercialTableActionsColumnSizing,
      },
      {
        accessorKey: 'company',
        id: 'company',
        header: 'Empresa',
        enableHiding: false,
        size: 240,
        cell: ({ row }) => {
          const client = row.original;
          const emailDomain = getDomainFromEmail(client.email);
          return (
            <div className="flex min-w-0 items-center gap-2">
              <CompanyLogoBox
                companyId={client.companyId}
                domain={emailDomain}
                externalLogoUrl={client.externalLogoUrl}
              />
              <div className="min-w-0">
                <p
                  className="truncate text-[13px] font-semibold text-[#0F172A] dark:text-gray-100"
                  title={client.company}
                >
                  <Link
                    to={clienteEmpresaDetailHref({ empresa: client.company })}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:text-primary"
                  >
                    {truncateCompanyName(client.company)}
                  </Link>
                </p>
                {emailDomain ? (
                  <a
                    href={`https://${emailDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Abrir ${emailDomain}`}
                    className="block truncate text-[11px] text-[#64748B] hover:text-primary hover:underline dark:text-gray-400"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {emailDomain}
                  </a>
                ) : (
                  <p className="truncate text-[11px] text-[#64748B] dark:text-gray-400">
                    {client.contactName !== '—' ? client.contactName : '—'}
                  </p>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'ruc',
        id: 'ruc',
        header: 'RUC',
        enableHiding: true,
        size: 100,
        cell: ({ getValue }) => {
          const val = String(getValue() || '').trim();
          return (
            <span className="text-[13px] tabular-nums text-[#475569] dark:text-gray-400" title={val || undefined}>
              {val || '—'}
            </span>
          );
        },
      },
      {
        accessorKey: 'phone',
        id: 'phone',
        header: 'Teléfono',
        enableHiding: true,
        size: 100,
        cell: ({ getValue }) => (
          <span className="text-[13px] text-[#475569] dark:text-gray-400">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'email',
        id: 'email',
        header: 'Email',
        enableHiding: true,
        size: 150,
        cell: ({ getValue }) => {
          const val = String(getValue() || '');
          return (
            <span className="block truncate text-[13px] text-[#475569] dark:text-gray-400" title={val || undefined}>
              {val || '—'}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        id: 'status',
        header: 'Estado',
        enableHiding: false,
        size: 100,
        cell: ({ getValue }) => <ClientStatusBadge status={getValue() as ClientStatus} />,
      },
      {
        accessorKey: 'assignedToName',
        id: 'asesor',
        header: 'Asesor',
        enableHiding: true,
        size: 130,
        cell: ({ getValue }) => {
          const val = String(getValue() || '');
          return (
            <span className="block truncate text-[13px] text-[#475569] dark:text-gray-400" title={val || undefined}>
              {val || '—'}
            </span>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        id: 'createdAt',
        header: 'Fecha alta',
        enableHiding: true,
        size: 100,
        cell: ({ getValue }) => (
          <span className="text-[13px] text-[#475569] dark:text-gray-400">
            {formatDate(getValue() as string)}
          </span>
        ),
      },
      {
        id: 'ingresos',
        header: 'Ingresos',
        enableHiding: false,
        size: 130,
        cell: ({ row }) => {
          const client = row.original;
          return (
            <div className="flex flex-col items-end leading-tight">
              <span className="text-[13px] font-semibold tabular-nums text-[#0F172A] dark:text-gray-100">
                {formatCurrency(client.externalMonthAmount || 0).replace('S/\u00a0', 'S/ ')}
              </span>
              <span className="text-[10px] font-normal uppercase text-[#64748B] dark:text-gray-400">
                {client.externalMonthName || 'Mes'} · Año: S/ {(client.externalYearTotal || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          );
        },
      },
    ],
    [allSelected, selectedClientIds],
  );

  const table = useReactTable({
    data: displayedClients,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 60 },
  });

  const statusFilterLabel =
    statusFilter.length === 0
      ? 'Estado'
      : statusFilter.map((k) => clientStatusConfig[k].label).join(', ');

  return (
    <div>
      <PageHeader
        title="Empresas - Clientes"
        description="Gestiona y da seguimiento a tu cartera de clientes activos"
        className="mb-4"
      />

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <GlassCard>
        <div className="flex min-w-0 flex-col gap-2 px-5 py-3 lg:flex-row lg:items-center">
          <div className="relative w-full min-w-0 max-w-[400px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a9aab] dark:text-gray-400" />
            <Input
              placeholder="Buscar por empresa, RUC, contacto, email o teléfono…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="!h-10 rounded-lg border border-[#e1e7ee] bg-white/60 pl-8 text-[13px] text-black shadow-none transition-colors placeholder:text-[#8a9aab] hover:border-primary focus-visible:ring-1 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-100 dark:placeholder:text-gray-400"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex !h-10 w-[190px] cursor-pointer items-center gap-1.5 rounded-lg border border-[#e1e7ee] bg-white/60 px-3 text-left text-[13px] shadow-none transition-colors hover:border-primary dark:border-gray-700 dark:bg-gray-800/60',
                  statusFilter.length > 0
                    ? 'text-black dark:text-gray-100'
                    : 'text-[#8a9aab] dark:text-gray-400',
                )}
              >
                <ChartSquareIcon className={comercialFilterIconClass} />
                <span className="flex-1 truncate">{statusFilterLabel}</span>
                <ChevronDown className="size-3.5 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className={cn(comercialProPopoverClass, "w-[220px] p-1.5")} align="start" sideOffset={8}>
              <Command className={comercialProCommandClass}>
                <CommandList className="max-h-[260px] overflow-y-auto">
                  <CommandGroup>
                    {CLIENT_STATUS_OPTIONS.map(({ key, label }) => {
                      const selected = statusFilter.includes(key);
                      return (
                        <CommandItem
                          key={key}
                          onSelect={() => {
                            setStatusFilter((prev) =>
                              prev.includes(key)
                                ? prev.filter((s) => s !== key)
                                : [...prev, key],
                            );
                            setPage(1);
                          }}
                        >
                          <span className="[&_svg]:!text-primary-foreground">
                            <Checkbox
                              checked={selected}
                              className="mr-2 h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                            />
                          </span>
                          <span>{label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
                <MultiCheckboxFilterActions
                  allSelected={
                    CLIENT_STATUS_OPTIONS.length > 0 &&
                    CLIENT_STATUS_OPTIONS.every(({ key }) =>
                      statusFilter.includes(key),
                    )
                  }
                  noneSelected={statusFilter.length === 0}
                  onSelectAll={() => {
                    setStatusFilter(CLIENT_STATUS_OPTIONS.map(({ key }) => key));
                    setPage(1);
                  }}
                  onClear={() => {
                    setStatusFilter([]);
                    setPage(1);
                  }}
                />
              </Command>
            </PopoverContent>
          </Popover>

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
              <PopoverContent className={cn(comercialProPopoverClass, "w-[200px] p-1.5")} align="end" sideOffset={8}>
                <Command className={comercialProCommandClass}>
                  <CommandList>
                    <CommandGroup>
                      {[
                        { id: 'ruc', label: 'RUC' },
                        { id: 'phone', label: 'Teléfono' },
                        { id: 'email', label: 'Email' },
                        { id: 'asesor', label: 'Asesor' },
                        { id: 'createdAt', label: 'Fecha alta' },
                      ].map((col) => {
                        const visible = columnVisibility[col.id] ?? true;
                        return (
                          <div
                            key={col.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setColumnVisibility((prev) => ({ ...prev, [col.id]: !visible }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                setColumnVisibility((prev) => ({ ...prev, [col.id]: !visible }));
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
                {hasPermission('clientes.exportar') && (
                  <DropdownMenuItem
                    onClick={() => {
                      exportClientsToCSV(filteredClients);
                      toast.success('Exportación completada', {
                        description: `Se exportaron ${filteredClients.length} clientes.`,
                      });
                    }}
                  >
                    <ExportSvgIcon className="size-[18px]" />
                    Exportar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {loading ? (
          <GhostTableSkeleton columns={CLIENTS_TABLE_SKELETON_COLUMNS} rows={10} />
        ) : totalFiltered === 0 ? (
          <Card className="rounded-none border-0 shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="mb-4 size-12 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold">No se encontraron clientes</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {clientList.length === 0
                  ? 'Aún no hay empresas cliente. Se están cargando desde Taxi Monterrico…'
                  : 'Intenta ajustar los filtros para ver más resultados.'}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" className="mt-4" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="border-t border-border/40 overflow-auto scrollbar-thin max-h-[calc(100vh-330px)]">
            <table className="w-full table-fixed bg-transparent" style={{ minWidth: table.getTotalSize() }}>
              <ComercialTableColgroup columns={table.getVisibleLeafColumns()} />
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr
                    key={hg.id}
                    className="h-[36px] bg-[#eef1f5] text-left text-[11px] font-bold text-[#647789] dark:bg-gray-800 dark:text-gray-400"
                  >
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        colSpan={header.colSpan}
                        className={comercialTableLeadingCellClass(header.column.id, {
                          primaryColumnId: 'company',
                          alignRight: header.column.id === 'ingresos',
                        })}
                        style={comercialTableCellStyle(header.column.id, header.getSize())}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanResize() && (
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
                      className="h-[48px] cursor-pointer border-b border-dashed border-[#e8ecf0] bg-card/30 transition-colors last:border-b-0 hover:bg-[#fafbfc] dark:border-gray-700 dark:hover:bg-gray-800"
                      onClick={(e) => openClientDetail(row.original, e)}
                      onAuxClick={(e) => navigateOnAuxClick(e, clienteEmpresaDetailHref({ empresa: row.original.company }))}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={comercialTableLeadingCellClass(cell.column.id, {
                            primaryColumnId: 'company',
                            alignRight: cell.column.id === 'ingresos',
                          })}
                          style={comercialTableCellStyle(cell.column.id, cell.column.getSize())}
                          onClick={
                            cell.column.id === 'select' || cell.column.id === 'actions'
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

        {!loading && totalFiltered > 0 && (
          <div className="flex h-14 items-center border-t border-dashed border-[#e8ecf0] bg-card/30 px-5 dark:border-gray-700">
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
    </div>
  );
}
