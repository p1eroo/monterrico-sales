import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import type { Client, ClientStatus } from '@/types';
import { companyRubroLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
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
  Building2, Users, UserX, Search,
  Phone, Mail, FileText, Clock, User,
  ChevronDown, MoreVertical, X,
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { comercialProPopoverClass, comercialProCommandClass } from '@/lib/comercialFilterSurface';
import { rightDrawerSheetContentClass } from '@/lib/rightPanelShell';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { toast } from '@/lib/notify';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppStore } from '@/store';
import { fetchExternalClients } from '@/lib/clientApi';
import { MoneySackSvgIcon } from '@/components/icons/MoneySackSvgIcon';
import { ChartSquareIcon } from '@/components/icons/ChartSquareIcon';
import { ColumnsSvgIcon } from '@/components/icons/ColumnsSvgIcon';
import { ExportSvgIcon } from '@/components/icons/ExportSvgIcon';
import { Skeleton } from '@/components/ui/skeleton';

const CLIENTS_TABLE_SKELETON_COLUMNS = [
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

function ClientsStatsSkeleton() {
  return (
    <Card
      className="flex-row flex-nowrap overflow-x-auto overflow-y-hidden py-0 scrollbar-thin [-webkit-overflow-scrolling:touch] sm:overflow-hidden"
      aria-hidden
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="relative flex w-[min(260px,82vw)] shrink-0 items-center gap-3 px-5 py-4 sm:w-auto sm:min-w-0 sm:flex-1 sm:justify-center"
        >
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          {i < 3 && (
            <div className="absolute right-0 top-4 bottom-4 border-r border-dashed border-border sm:w-px sm:border-0 sm:bg-border" />
          )}
        </div>
      ))}
    </Card>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
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

export default function Clients() {
  const { users } = useUsers();
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
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const { currentUser } = useAppStore();

  const reloadClients = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const externalRaw = await fetchExternalClients(currentUser.username);

      const mappedExternal: Client[] = externalRaw.map((ext) => {
        const rawAsesor = (ext.asesorresponsable || '').trim().toLowerCase();

        let advisor = users.find(
          (u) => u.username.toLowerCase() === rawAsesor,
        );

        if (!advisor && currentUser.username.toLowerCase() === rawAsesor) {
          advisor = currentUser as typeof users[number];
        }

        const monthsOrder: Record<string, number> = {
          enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
          julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
        };
        const currentMonthIdx = new Date().getMonth();
        let yearTotal = 0;
        for (let i = 1; i <= 5; i++) {
          const mName = (ext as Record<string, unknown>)[`mes${i}`] as string | undefined;
          const mAmount = (ext as Record<string, unknown>)[`monto${i}`] as number | undefined;
          if (mName && monthsOrder[mName.toLowerCase().trim()] !== undefined && monthsOrder[mName.toLowerCase().trim()] <= currentMonthIdx) {
            yearTotal += mAmount || 0;
          }
        }

        return {
          id: `ext-${ext.idclienteempresa || ext.codigoempresa}`,
          company: ext.nombrecomercial || ext.razonsocial,
          ruc: ext.rucempresa?.trim() || undefined,
          contactName: ext.contacto || '—',
          phone: ext.telefono || '—',
          email: ext.contactoemail || '—',
          status: 'activo' as ClientStatus,
          assignedTo: advisor ? advisor.id : (ext.asesorresponsable || 'unassigned'),
          assignedToName: advisor ? (advisor.name || advisor.username) : (ext.asesorresponsable || 'Sin asesor'),
          service: ext.tipopagodetalle || '—',
          createdAt: ext.fechor,
          totalRevenue: 0,
          externalMonthName: ext.mes1,
          externalMonthAmount: ext.monto1,
          externalYearTotal: yearTotal,
          externalLogoUrl: ext.logoempresa?.trim() || undefined,
          mes1: ext.mes1, monto1: ext.monto1,
          mes2: ext.mes2, monto2: ext.monto2,
          mes3: ext.mes3, monto3: ext.monto3,
          mes4: ext.mes4, monto4: ext.monto4,
          mes5: ext.mes5, monto5: ext.monto5,
          notes: '',
        } as Client;
      });

      setClientList(mappedExternal);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudieron cargar los clientes';
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [currentUser, users]);

  useEffect(() => {
    void reloadClients();
  }, [reloadClients]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, assigneeFilter, pageSize]);

  const stats = useMemo(() => {
    const total = clientList.length;
    const activos = clientList.filter((c) => c.status === 'activo').length;
    const inactivos = clientList.filter((c) => c.status === 'inactivo').length;
    const ingresos = clientList.reduce((sum, c) => {
      const rev = c.id.startsWith('ext-') ? (c.externalYearTotal || 0) : c.totalRevenue;
      return sum + rev;
    }, 0);
    return { total, activos, inactivos, ingresos };
  }, [clientList]);

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

      return matchesSearch && matchesStatus && matchesAssignee(client.assignedTo);
    });
  }, [clientList, searchTerm, statusFilter, matchesAssignee]);

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

  function openClientDetail(client: Client) {
    if (client.id.startsWith('ext-')) {
      toast.info('Cliente Externo', {
        description: 'Este registro proviene del system y es de solo lectura.',
      });
    }
    setSelectedClient(client);
  }

  const selectedAssigneeUser = useMemo(
    () =>
      selectedClient
        ? users.find((u) => u.id === selectedClient.assignedTo)
        : undefined,
    [selectedClient, users],
  );

  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
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
            <div className="flex min-w-0 max-w-[20rem] items-center gap-2">
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
                  {truncateCompanyName(client.company)}
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
          if (client.id.startsWith('ext-')) {
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
          }
          return (
            <span className="block text-right text-sm font-semibold tabular-nums text-[#0F172A] dark:text-gray-100">
              {formatCurrency(client.totalRevenue)}
            </span>
          );
        },
      },
    ],
    [],
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
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Gestiona y da seguimiento a tu cartera de clientes activos"
      />

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* Fase 1: Stats unificados */}
      {loading ? (
        <ClientsStatsSkeleton />
      ) : (
        <Card className="flex-row flex-nowrap overflow-x-auto overflow-y-hidden py-0 scrollbar-thin [-webkit-overflow-scrolling:touch] sm:overflow-hidden">
          <div className="relative flex w-[min(260px,82vw)] shrink-0 items-center gap-3 px-5 py-4 sm:w-auto sm:min-w-0 sm:flex-1 sm:justify-center">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 bg-transparent text-emerald-600">
              <Building2 className="size-7" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-[#647789] dark:text-gray-400">Total clientes</p>
              <p className="text-[22px] font-bold tracking-tight text-[#0F172A] dark:text-gray-100">{stats.total}</p>
              <p className="text-xs text-[#8a9aab] dark:text-gray-400">en cartera</p>
            </div>
            <div className="absolute right-0 top-4 bottom-4 border-r border-dashed border-border sm:w-px sm:border-0 sm:bg-border" />
          </div>
          <div className="relative flex w-[min(260px,82vw)] shrink-0 items-center gap-3 px-5 py-4 sm:w-auto sm:min-w-0 sm:flex-1 sm:justify-center">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 bg-transparent text-emerald-600">
              <Users className="size-7" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-[#647789] dark:text-gray-400">Activos</p>
              <p className="text-[22px] font-bold tracking-tight text-[#0F172A] dark:text-gray-100">{stats.activos}</p>
              <p className="text-xs text-[#8a9aab] dark:text-gray-400">
                {stats.total > 0 ? `${Math.round((stats.activos / stats.total) * 100)}% del total` : '—'}
              </p>
            </div>
            <div className="absolute right-0 top-4 bottom-4 border-r border-dashed border-border sm:w-px sm:border-0 sm:bg-border" />
          </div>
          <div className="relative flex w-[min(260px,82vw)] shrink-0 items-center gap-3 px-5 py-4 sm:w-auto sm:min-w-0 sm:flex-1 sm:justify-center">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-red-500 bg-transparent text-red-600">
              <UserX className="size-7" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-[#647789] dark:text-gray-400">Inactivos</p>
              <p className="text-[22px] font-bold tracking-tight text-[#0F172A] dark:text-gray-100">{stats.inactivos}</p>
              <p className="text-xs text-[#8a9aab] dark:text-gray-400">
                {stats.inactivos === 0 ? 'ninguno registrado' : 'requieren seguimiento'}
              </p>
            </div>
            <div className="absolute right-0 top-4 bottom-4 border-r border-dashed border-border sm:w-px sm:border-0 sm:bg-border" />
          </div>
          <div className="relative flex w-[min(260px,82vw)] shrink-0 items-center gap-3 px-5 py-4 sm:w-auto sm:min-w-0 sm:flex-1 sm:justify-center">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 bg-transparent text-blue-600">
              <MoneySackSvgIcon className="size-7" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-[#647789] dark:text-gray-400">Ingresos totales</p>
              <p className="text-[22px] font-bold tracking-tight text-[#0F172A] dark:text-gray-100">{formatCurrency(stats.ingresos)}</p>
              <p className="text-xs text-[#8a9aab] dark:text-gray-400">acumulado del año</p>
            </div>
          </div>
        </Card>
      )}

      {/* Fases 2–4: GlassCard con filtros, tabla tanstack y paginación */}
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
                <ChartSquareIcon className="size-4 shrink-0 text-[#8a9aab] dark:text-gray-400" />
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
                  ? 'Aún no hay clientes. Aparecerán aquí cuando una empresa llegue a la etapa Activo o a una etapa con probabilidad 100%.'
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
          <div className="scrollbar-thin max-h-[calc(100vh-460px)] overflow-auto border-t border-border/40 bg-card/30">
            <table className="w-full table-fixed bg-transparent" style={{ minWidth: table.getTotalSize() }}>
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
                        className={cn(
                          'relative overflow-hidden px-3 align-middle',
                          header.column.id === 'ingresos' && 'text-right',
                        )}
                        style={{ width: header.getSize() }}
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
                      className="h-[48px] cursor-pointer border-b border-dashed border-[#e8ecf0] bg-transparent transition-colors last:border-b-0 hover:bg-[#fafbfc] dark:border-gray-700 dark:hover:bg-gray-800"
                      onClick={() => openClientDetail(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={cn(
                            'overflow-hidden px-3 align-middle',
                            cell.column.id === 'ingresos' && 'text-right',
                          )}
                          style={{ width: cell.column.getSize() }}
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
          <div className="flex h-14 items-center border-t border-dashed border-[#e8ecf0] bg-transparent px-5 dark:border-gray-700">
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

      <Sheet open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <SheetContent
          side="right"
          className={rightDrawerSheetContentClass('lg', 'overflow-y-auto')}
        >
          {selectedClient && (
            <>
              <SheetHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-lg bg-[#13944C]/10">
                    <Building2 className="size-6 text-[#13944C]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="truncate">{selectedClient.company}</SheetTitle>
                    <SheetDescription className="flex flex-wrap items-center gap-2 pt-1">
                      <ClientStatusBadge status={selectedClient.status} />
                      {selectedClient.companyRubro && (
                        <Badge variant="outline" className="text-xs">{companyRubroLabels[selectedClient.companyRubro]}</Badge>
                      )}
                      {selectedClient.companyTipo && (
                        <Badge variant="secondary" className="text-xs">Tipo {selectedClient.companyTipo}</Badge>
                      )}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <ScrollArea className="h-[calc(100vh-130px)]">
                <div className="space-y-6 px-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Contacto vinculado
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Referencia del contacto asociado al mayor monto en negocios de esta empresa.
                    </p>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3">
                        <User className="size-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm">{selectedClient.contactName || '—'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="size-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm">{selectedClient.phone || '—'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="size-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm">{selectedClient.email || '—'}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Métricas
                    </h4>

                    {selectedClient.id.startsWith('ext-') ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
                          <p className="text-xs font-medium uppercase text-muted-foreground">Acumulado Año 2026</p>
                          <p className="mt-1 text-2xl font-bold text-primary">
                            S/ {(selectedClient.externalYearTotal || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {[1, 2, 3, 4, 5].map((i) => {
                            const ext = selectedClient as Client & Record<string, unknown>;
                            const mName = ext[`mes${i}`] as string | undefined;
                            const mAmount = ext[`monto${i}`] as number | undefined;
                            if (!mName) return null;

                            return (
                              <div key={i} className="flex flex-col items-center justify-center rounded-lg border bg-card p-2 text-center shadow-sm">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                                  {mName.substring(0, 3)}
                                </span>
                                <span className="mt-1 text-sm font-bold text-blue-600">
                                  {(mAmount || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className="mt-0.5 text-[9px] text-muted-foreground">Soles</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Ingresos</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Misma facturación estimada de la empresa.
                          </p>
                          <p className="mt-1 text-lg font-bold text-[#13944C]">
                            {formatCurrency(selectedClient.totalRevenue)}
                          </p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Fecha de alta</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Registro como cliente en CRM.
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {formatDate(selectedClient.createdAt)}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedClient.lastActivity && (
                      <div className="flex items-center gap-3 pt-2 text-sm text-muted-foreground">
                        <Clock className="size-4 shrink-0" />
                        Última actividad: {formatDate(selectedClient.lastActivity)}
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Asesor asignado
                    </h4>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-[#13944C]/10 text-xs text-[#13944C]">
                          {getInitials(selectedClient.assignedToName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{selectedClient.assignedToName}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedAssigneeUser?.username ??
                            selectedAssigneeUser?.email ??
                            '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedClient.notes && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                          Notas
                        </h4>
                        <div className="flex items-start gap-3">
                          <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <p className="text-sm">{selectedClient.notes}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
