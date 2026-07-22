import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DateRange } from 'react-day-picker';
import { navigateOnAuxClick, navigateOnClick } from '@/lib/navigateOnClick';
import { clienteEmpresaDetailHref } from '@/lib/detailRoutes';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  Search, Users, X, Plus, Pencil, Trash2, Loader2, MoreVertical, ChevronDown, ChevronUp, ChevronsUpDown,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  ContactEditDialog,
  type ContactEditSavePayload,
} from '@/components/shared/ContactEditDialog';
import {
  NewContactWizard,
  type NewContactData,
} from '@/components/shared/NewContactWizard';
import { Pagination } from '@/components/shared/Pagination';
import { GlassCard } from '@/components/shared/GlassCard';
import { GhostTableSkeleton } from '@/components/shared/GhostTableSkeleton';
import { MultiAdvisorFilter } from '@/components/shared/MultiAdvisorFilter';
import { MultiCheckboxFilterActions } from '@/components/shared/MultiCheckboxFilterActions';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useMultiAdvisorFilter } from '@/hooks/useMultiAdvisorFilter';
import { contactSourceLabels, etapaLabels } from '@/data/mock';
import { getSourceLabelFromCatalog, useCrmConfigStore, useLeadSourceOptions } from '@/store/crmConfigStore';
import { formatDateShort } from '@/lib/formatters';
import {
  comercialFilterIconClass,
  comercialProPopoverClass,
  comercialProCommandClass,
  dateRangeToQueryBounds,
  formatInclusiveMultiFilterLabel,
  formatInclusiveMultiSourceFilterLabel,
  INCLUSIVE_MULTI_NONE,
  isInclusiveMultiFilterAll,
  isInclusiveMultiFilterNone,
  isInclusiveMultiFilterSelected,
  matchesInclusiveMultiFilterValue,
  matchesInclusiveMultiSourceFilterValue,
  toggleInclusiveMultiFilter,
} from '@/lib/comercialFilterSurface';
import {
  crmTableBodyRowClassInteractive,
  crmTableFooterClass,
  crmTableHeaderRowClass,
} from '@/lib/crmTableSurface';
import { DateRangeFilterButton } from '@/components/ui/date-range-filter-button';
import { ChartSquareIcon } from '@/components/icons/ChartSquareIcon';
import { PaletteIcon } from '@/components/icons/PaletteIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ColumnsSvgIcon } from '@/components/icons/ColumnsSvgIcon';
import { ExportSvgIcon } from '@/components/icons/ExportSvgIcon';
import { FilterSvgIcon } from '@/components/icons/FilterSvgIcon';
import { usePermissions } from '@/hooks/usePermissions';
import { canReassignCommercialAdvisor } from '@/data/rbac';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import { ComercialTableColgroup } from '@/components/shared/ComercialTableColgroup';
import {
  comercialTableActionsColumnSizing,
  comercialTableCellStyle,
  comercialTableLeadingCellClass,
  comercialTableSelectColumnSizing,
  comercialTableCheckboxWrapClass,
} from '@/lib/comercialTableLayout';
import { toast } from '@/lib/notify';
import {
  createContactoCliente,
  deleteContactoCliente,
  fetchContactosCliente,
  updateContactoCliente,
  type ContactoClienteRow,
} from '@/lib/clienteCarteraApi';
import { newContactDataToClienteBody, contactoClienteRowToContact, contactEditPayloadToClienteUpdate } from '@/lib/clienteContactoFormUtils';

import type { Contact } from '@/types';

const TABLE_SKELETON_COLUMNS = [
  { label: '', width: 44 },
  { label: '', width: 40 },
  { label: 'Nombre', width: 240 },
  { label: 'Empresas', width: 200 },
  { label: 'Teléfono', width: 130, className: 'hidden md:table-cell' },
  { label: 'Email', width: 180, className: 'hidden lg:table-cell' },
  { label: 'Fuente', width: 100, className: 'hidden md:table-cell' },
  { label: 'Etapa', width: 120, className: 'hidden md:table-cell' },
  { label: 'Asesor', width: 150, className: 'hidden md:table-cell' },
  { label: 'Creación', width: 120, className: 'hidden lg:table-cell' },
  { label: 'U. Interacción', width: 120, className: 'hidden lg:table-cell' },
];

const TOGGLEABLE_COLUMNS = [
  { id: 'empresas', label: 'Empresas' },
  { id: 'telefono', label: 'Teléfono' },
  { id: 'email', label: 'Email' },
  { id: 'fuente', label: 'Fuente' },
  { id: 'etapa', label: 'Etapa' },
  { id: 'asesor', label: 'Asesor' },
  { id: 'fecha', label: 'Creación' },
  { id: 'ultimaInteraccion', label: 'U. Interacción' },
] as const;

function matchesIsoDateInRange(isoDate: string | undefined, range: DateRange | undefined): boolean {
  if (!range?.from && !range?.to) return true;
  if (!isoDate) return false;
  const { from, to } = dateRangeToQueryBounds(range);
  const day = isoDate.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function exportContactosClienteToCSV(rows: ContactoClienteRow[], sourceLabel: (key: string) => string) {
  const headers = ['Nombre', 'Empresas', 'Teléfono', 'Email', 'Fuente', 'Etapa', 'Cargo', 'Asesor', 'Creación', 'U. Interacción'];
  const csvRows = rows.map((c) => [
    c.nombre,
    c.empresas.map((e) => e.empresa).join('; '),
    c.telefono ?? '',
    c.email ?? '',
    c.source ? sourceLabel(c.source) : '',
    c.etapa ?? '',
    c.cargo ?? '',
    c.assignedToName ?? '',
    formatDateShort(c.createdAt),
    formatDateShort(c.lastInteractionAt),
  ]);
  const csvContent = [
    headers.join(','),
    ...csvRows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `contactos-clientes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ClienteContactos() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const currentUserRole = useAppStore((s) => s.currentUser.role);
  const canEditAssignee = canReassignCommercialAdvisor(currentUserRole);
  const bundle = useCrmConfigStore((s) => s.bundle);
  const leadSourceOptions = useLeadSourceOptions();
  const sourceLabel = useCallback(
    (key: string) => getSourceLabelFromCatalog(key, bundle, contactSourceLabels),
    [bundle],
  );
  const etapaFilterOptions = useMemo(() => {
    const stages = bundle?.catalog.stages
      ?.filter((x) => x.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (stages?.length) {
      return stages.map((s) => ({ key: s.slug, label: s.name }));
    }
    return Object.entries(etapaLabels).map(([key, label]) => ({ key, label }));
  }, [bundle]);
  const etapaFilterKeys = useMemo(
    () => etapaFilterOptions.map((o) => o.key),
    [etapaFilterOptions],
  );
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

  const [contactList, setContactList] = useState<ContactoClienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [etapaFilter, setEtapaFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [interactionRange, setInteractionRange] = useState<DateRange | undefined>();
  const [creationRange, setCreationRange] = useState<DateRange | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    empresas: true,
    telefono: true,
    email: true,
    fuente: true,
    etapa: true,
    asesor: true,
    fecha: true,
    ultimaInteraccion: true,
  });

  const [newContactOpen, setNewContactOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);

  const loadFromDb = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await fetchContactosCliente();
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
  }, [searchTerm, assigneeFilter, pageSize, etapaFilter, sourceFilter, interactionRange, creationRange]);

  const filtered = useMemo(() => {
    return contactList.filter((row) => {
      const q = searchTerm.toLowerCase();
      const empresasText = row.empresas.map((e) => e.empresa).join(' ');
      const matchesSearch =
        searchTerm === '' ||
        row.nombre.toLowerCase().includes(q) ||
        empresasText.toLowerCase().includes(q) ||
        (row.telefono ?? '').includes(searchTerm) ||
        (row.email ?? '').toLowerCase().includes(q) ||
        (row.cargo ?? '').toLowerCase().includes(q);
      const matchesEtapa = matchesInclusiveMultiFilterValue(etapaFilter, row.etapa);
      const matchesSource = matchesInclusiveMultiSourceFilterValue(sourceFilter, row.source);
      const matchesInteraction = matchesIsoDateInRange(row.lastInteractionAt, interactionRange);
      const matchesCreation = matchesIsoDateInRange(row.createdAt, creationRange);
      return (
        matchesSearch
        && matchesAssignee(row.assignedTo)
        && matchesEtapa
        && matchesSource
        && matchesInteraction
        && matchesCreation
      );
    });
  }, [
    contactList,
    searchTerm,
    matchesAssignee,
    etapaFilter,
    sourceFilter,
    interactionRange,
    creationRange,
  ]);

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const start = (page - 1) * pageSize;
  const displayed = useMemo(
    () => filtered.slice(start, start + pageSize),
    [filtered, start, pageSize],
  );

  const allSelected =
    displayed.length > 0 && selectedContactIds.length === displayed.length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(displayed.map((row) => row.id));
    }
  }

  function toggleSelectContact(id: string) {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  const hasActiveFilters =
    searchTerm !== ''
    || assigneeFilterIsActive
    || etapaFilter.length > 0
    || sourceFilter.length > 0
    || Boolean(interactionRange?.from || interactionRange?.to)
    || Boolean(creationRange?.from || creationRange?.to);

  function clearFilters() {
    setSearchTerm('');
    setEtapaFilter([]);
    setSourceFilter([]);
    setInteractionRange(undefined);
    setCreationRange(undefined);
    resetAdvisorFilter();
    setPage(1);
  }

  function openCreate() {
    setNewContactOpen(true);
  }

  function openEdit(row: ContactoClienteRow) {
    setEditContact(contactoClienteRowToContact(row));
  }

  async function handleSaveContactFromList(payload: ContactEditSavePayload) {
    if (!editContact) return;
    const contactId = editContact.id;
    setEditContact(null);
    toast.loading('Guardando cambios…', { id: `save-${contactId}` });
    try {
      await updateContactoCliente(contactId, contactEditPayloadToClienteUpdate(payload));
      await loadFromDb();
      toast.success('Contacto actualizado', { id: `save-${contactId}` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar', { id: `save-${contactId}` });
      const row = contactList.find((c) => c.id === contactId);
      if (row) setEditContact(contactoClienteRowToContact(row));
    }
  }

  async function onSubmitNewContact(data: NewContactData) {
    try {
      await createContactoCliente(newContactDataToClienteBody(data));
      toast.success('Contacto creado');
      setNewContactOpen(false);
      await loadFromDb();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear');
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar este contacto? Se desvinculará de todas las empresas.')) return;
    setDeletingId(id);
    try {
      await deleteContactoCliente(id);
      toast.success('Contacto eliminado');
      await loadFromDb();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setDeletingId(null);
    }
  }

  const columns = useMemo<ColumnDef<ContactoClienteRow>[]>(
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
              checked={selectedContactIds.includes(row.original.id)}
              onCheckedChange={() => toggleSelectContact(row.original.id)}
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
                  openEdit(row.original);
                }}
              >
                <Pencil /> Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={deletingId === row.original.id}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(row.original.id);
                }}
              >
                {deletingId === row.original.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 />
                )}
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        ...comercialTableActionsColumnSizing,
      },
      {
        accessorKey: 'nombre',
        id: 'nombre',
        header: 'Nombre',
        enableHiding: false,
        size: 240,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="min-w-0 max-w-[20rem]">
              <p className="truncate text-[13px] font-semibold text-[#0F172A] dark:text-gray-100" title={c.nombre}>
                {c.nombre}
              </p>
              {c.cargo && (
                <p className="mt-0.5 truncate text-[11px] text-[#64748B] dark:text-gray-400">{c.cargo}</p>
              )}
            </div>
          );
        },
      },
      {
        id: 'empresas',
        header: 'Empresas',
        enableHiding: true,
        size: 200,
        enableSorting: false,
        cell: ({ row }) => {
          const c = row.original;
          const primary = c.empresas.find((e) => e.isPrimary) ?? c.empresas[0];
          if (!primary) {
            return <span className="text-[13px] text-[#94a3b8]">Sin vincular</span>;
          }
          const extra = c.empresas.length - 1;
          return (
            <span
              className="block truncate text-[13px] text-[#475569] dark:text-gray-400"
              title={c.empresas.map((e) => e.empresa).join(', ')}
            >
              {primary.empresa}
              {extra > 0 ? ` +${extra}` : ''}
            </span>
          );
        },
      },
      {
        accessorKey: 'telefono',
        id: 'telefono',
        header: 'Teléfono',
        enableHiding: true,
        size: 100,
        enableSorting: false,
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
        accessorKey: 'email',
        id: 'email',
        header: 'Email',
        enableHiding: true,
        size: 170,
        enableSorting: false,
        cell: ({ getValue }) => {
          const val = String(getValue() || '');
          return (
            <span className="block max-w-[14rem] truncate text-[13px] text-[#475569] dark:text-gray-400" title={val}>
              {val || '—'}
            </span>
          );
        },
      },
      {
        accessorKey: 'source',
        id: 'fuente',
        header: 'Fuente',
        enableHiding: true,
        size: 100,
        enableSorting: false,
        cell: ({ getValue }) => {
          const val = String(getValue() || '');
          if (!val) {
            return <span className="text-[13px] text-[#475569] dark:text-gray-400">—</span>;
          }
          return (
            <span className="inline-flex h-6 items-center rounded-full border border-gray-300 bg-white px-2.5 text-[11px] font-semibold text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {sourceLabel(val)}
            </span>
          );
        },
      },
      {
        accessorKey: 'etapa',
        id: 'etapa',
        header: 'Etapa',
        enableHiding: true,
        size: 120,
        enableSorting: false,
        cell: ({ getValue }) => {
          const val = String(getValue() || '');
          if (!val) return <span className="text-[13px] text-[#475569] dark:text-gray-400">—</span>;
          return <StatusBadge status={val} />;
        },
      },
      {
        accessorKey: 'assignedToName',
        id: 'asesor',
        header: 'Asesor',
        enableHiding: true,
        size: 130,
        enableSorting: false,
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
        id: 'fecha',
        header: 'Creación',
        enableHiding: true,
        size: 120,
        sortingFn: 'datetime',
        cell: ({ getValue }) => (
          <span className="text-[13px] text-[#475569] dark:text-gray-400">
            {formatDateShort(String(getValue()))}
          </span>
        ),
      },
      {
        accessorKey: 'lastInteractionAt',
        id: 'ultimaInteraccion',
        header: 'U. Interacción',
        enableHiding: true,
        size: 120,
        enableSorting: false,
        cell: ({ getValue }) => {
          const val = getValue() as string | null | undefined;
          return (
            <span className="text-[13px] text-[#475569] dark:text-gray-400">
              {val ? formatDateShort(val) : '—'}
            </span>
          );
        },
      },
    ],
    [allSelected, deletingId, selectedContactIds, sourceLabel],
  );

  const table = useReactTable({
    data: displayed,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSorting: true,
    enableSortingRemoval: false,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 60 },
  });

  return (
    <div>
      <PageHeader
        title="Contactos - Clientes"
        description="Contactos manuales vinculados a empresas de la cartera"
        className="mb-4"
      >
        <Button onClick={openCreate} className="h-9 w-[110px] text-sm font-normal shadow-md">
          <Plus /> Nuevo
        </Button>
      </PageHeader>

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
              placeholder="Buscar por nombre, empresa, teléfono o email…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="!h-10 rounded-lg border border-[#e1e7ee] bg-white/60 pl-8 text-[13px] text-black shadow-none transition-colors placeholder:text-[#8a9aab] hover:border-primary focus-visible:ring-1 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-100"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex !h-10 w-[190px] cursor-pointer items-center gap-1.5 rounded-lg border border-[#e1e7ee] bg-white/60 px-3 text-left text-[13px] shadow-none transition-colors hover:border-primary dark:border-gray-700 dark:bg-gray-800/60',
                  etapaFilter.length > 0
                    ? 'text-black dark:text-gray-100'
                    : 'text-[#8a9aab] dark:text-gray-400',
                )}
              >
                <ChartSquareIcon className={comercialFilterIconClass} />
                <span className="flex-1 truncate">
                  {formatInclusiveMultiFilterLabel(
                    etapaFilter,
                    'Etapa',
                    (k) => etapaFilterOptions.find((o) => o.key === k)?.label ?? etapaLabels[k as keyof typeof etapaLabels] ?? k,
                    'etapas',
                  )}
                </span>
                <ChevronDown className="size-3.5 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className={cn(comercialProPopoverClass, 'w-[220px] p-1.5')} align="start" sideOffset={8}>
              <Command className={comercialProCommandClass}>
                <CommandList className="max-h-[260px] overflow-y-auto">
                  <CommandGroup>
                    {etapaFilterOptions.map(({ key, label }) => {
                      const selected = isInclusiveMultiFilterSelected(etapaFilter, key);
                      return (
                        <CommandItem
                          key={key}
                          onSelect={() => {
                            setEtapaFilter((prev) =>
                              toggleInclusiveMultiFilter(prev, key, etapaFilterKeys),
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
                  allSelected={isInclusiveMultiFilterAll(etapaFilter)}
                  noneSelected={isInclusiveMultiFilterNone(etapaFilter)}
                  onSelectAll={() => {
                    setEtapaFilter([]);
                    setPage(1);
                  }}
                  onClear={() => {
                    setEtapaFilter([INCLUSIVE_MULTI_NONE]);
                    setPage(1);
                  }}
                />
              </Command>
            </PopoverContent>
          </Popover>

          <DateRangeFilterButton
            value={interactionRange}
            onChange={(range) => {
              setInteractionRange(range);
              setPage(1);
            }}
            placeholder="Última interacción"
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
              <PopoverContent className={cn(comercialProPopoverClass, 'w-[200px] p-1.5')} align="end" sideOffset={8}>
                <Command className={comercialProCommandClass}>
                  <CommandList>
                    <CommandGroup>
                      {TOGGLEABLE_COLUMNS.map((col) => {
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

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-[#1f2933] transition-opacity hover:opacity-70 dark:text-gray-100"
                >
                  <FilterSvgIcon className="size-[18px]" />
                  Filtros
                </button>
              </PopoverTrigger>
              <PopoverContent className={cn(comercialProPopoverClass, 'w-[min(100vw-2rem,500px)] p-3')} align="end" sideOffset={8}>
                <div className="flex items-center gap-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'flex !h-10 flex-1 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e1e7ee] bg-white/60 px-3 text-left text-[13px] shadow-none transition-colors hover:border-primary dark:border-gray-700 dark:bg-gray-800/60',
                          sourceFilter.length > 0
                            ? 'text-black dark:text-gray-100'
                            : 'text-[#8a9aab] dark:text-gray-400',
                        )}
                      >
                        <PaletteIcon className={comercialFilterIconClass} />
                        <span className="flex-1 truncate">
                          {formatInclusiveMultiSourceFilterLabel(
                            sourceFilter,
                            'Fuente',
                            (k) => getSourceLabelFromCatalog(k, bundle, contactSourceLabels),
                          )}
                        </span>
                        <ChevronDown className="size-3.5 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className={cn(comercialProPopoverClass, 'w-[200px] p-1.5')} align="start" sideOffset={8}>
                      <Command className={comercialProCommandClass}>
                        <CommandList className="max-h-[260px] overflow-y-auto">
                          <CommandGroup>
                            {leadSourceOptions.map(({ value: key, label }) => {
                              const selected = isInclusiveMultiFilterSelected(sourceFilter, key);
                              return (
                                <CommandItem
                                  key={key}
                                  onSelect={() => {
                                    setSourceFilter((prev) =>
                                      toggleInclusiveMultiFilter(
                                        prev,
                                        key,
                                        leadSourceOptions.map((o) => o.value),
                                      ),
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
                          allSelected={isInclusiveMultiFilterAll(sourceFilter)}
                          noneSelected={isInclusiveMultiFilterNone(sourceFilter)}
                          onSelectAll={() => {
                            setSourceFilter([]);
                            setPage(1);
                          }}
                          onClear={() => {
                            setSourceFilter([INCLUSIVE_MULTI_NONE]);
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
                    className="!h-10 flex-1"
                    onInteraction={() => setPage(1)}
                  />

                  <DateRangeFilterButton
                    value={creationRange}
                    onChange={(range) => {
                      setCreationRange(range);
                      setPage(1);
                    }}
                    placeholder="Creación"
                    className="min-w-0 w-auto flex-1"
                  />
                </div>
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
                      exportContactosClienteToCSV(filtered, sourceLabel);
                      toast.success('Exportación completada', {
                        description: `Se exportaron ${filtered.length} contactos.`,
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
          <GhostTableSkeleton columns={TABLE_SKELETON_COLUMNS} rows={10} />
        ) : totalFiltered === 0 ? (
          <Card className="rounded-none border-0 shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="mb-4 size-12 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold">No se encontraron contactos</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {contactList.length === 0
                  ? 'Crea contactos manualmente o vincúlalos desde el detalle de una empresa cliente.'
                  : 'Intenta ajustar los filtros para ver más resultados.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="border-t border-border/40 overflow-auto max-h-[calc(100vh-330px)] scrollbar-thin">
            <table className="w-full table-fixed" style={{ minWidth: table.getTotalSize() }}>
              <ComercialTableColgroup columns={table.getVisibleLeafColumns()} />
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className={cn('h-[36px] text-left', crmTableHeaderRowClass)}>
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        colSpan={header.colSpan}
                        className={comercialTableLeadingCellClass(header.column.id, {
                          primaryColumnId: 'nombre',
                          sortable: header.column.getCanSort(),
                        })}
                        style={comercialTableCellStyle(header.column.id, header.getSize())}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <>
                              {header.column.getIsSorted() === 'asc' ? (
                                <ChevronUp className="size-3 shrink-0" />
                              ) : header.column.getIsSorted() === 'desc' ? (
                                <ChevronDown className="size-3 shrink-0" />
                              ) : (
                                <ChevronsUpDown className="size-3 shrink-0 text-[#94A3B8] dark:text-gray-500" />
                              )}
                            </>
                          )}
                        </div>
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
                            className="absolute inset-y-0 right-0 flex w-5 cursor-col-resize items-center justify-center group/rez"
                          >
                            <div className="pointer-events-none h-4 w-[2px] rounded-full bg-gray-200 transition-all select-none group-hover/rez:w-[5px] group-hover/rez:bg-blue-500 group-active/rez:w-[5px] group-active/rez:bg-blue-500" />
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => {
                  const primaryEmpresa = row.original.empresas[0];
                  return (
                    <tr
                      key={row.id}
                      className={cn('h-[48px] last:border-b-0', crmTableBodyRowClassInteractive)}
                      onClick={(e) => {
                        if (primaryEmpresa) {
                          navigateOnClick(
                            e,
                            clienteEmpresaDetailHref({ empresa: primaryEmpresa.empresa }),
                            navigate,
                          );
                        }
                      }}
                      onAuxClick={(e) => {
                        if (primaryEmpresa) {
                          navigateOnAuxClick(
                            e,
                            clienteEmpresaDetailHref({ empresa: primaryEmpresa.empresa }),
                          );
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={comercialTableLeadingCellClass(cell.column.id, {
                            primaryColumnId: 'nombre',
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalFiltered > 0 && (
          <div className={cn('flex h-14 items-center px-5', crmTableFooterClass)}>
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

      <NewContactWizard
        variant="cliente-cartera"
        open={newContactOpen}
        onOpenChange={setNewContactOpen}
        onSubmit={onSubmitNewContact}
        title="Nuevo contacto"
        description="Registra un nuevo contacto de cartera."
        submitLabel="Crear contacto"
      />

      <ContactEditDialog
        contact={editContact}
        open={editContact !== null}
        onOpenChange={(open) => {
          if (!open) setEditContact(null);
        }}
        onSave={handleSaveContactFromList}
        canEditAssignee={canEditAssignee}
      />
    </div>
  );
}
