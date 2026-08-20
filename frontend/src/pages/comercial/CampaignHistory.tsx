import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  Plus,
  Search,
  Mail,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X,
} from 'lucide-react';
import type { CampaignListItem, CampaignStatus } from '@/types';
import { deleteCampaignApi, listCampaignSummariesApi } from '@/lib/campaignApi';
import { ChartSquareIcon } from '@/components/icons/ChartSquareIcon';
import { CopySvgIcon } from '@/components/icons/CopySvgIcon';
import { PencilFileSvgIcon } from '@/components/icons/PencilFileSvgIcon';
import { TrashSvgIcon } from '@/components/icons/TrashSvgIcon';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuTriggerButton,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandGroup,
  CommandList,
} from '@/components/ui/command';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { GlassCard } from '@/components/shared/GlassCard';
import { GhostTableSkeleton } from '@/components/shared/GhostTableSkeleton';
import { ComercialTableColgroup } from '@/components/shared/ComercialTableColgroup';
import { ComercialInclusiveMultiFilter } from '@/components/shared/ComercialInclusiveMultiFilter';
import { ColumnsSvgIcon } from '@/components/icons/ColumnsSvgIcon';
import { formatDate } from '@/lib/formatters';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import {
  comercialFilterIconClass,
  comercialProPopoverClass,
  comercialProCommandClass,
  isInclusiveMultiFilterNone,
} from '@/lib/comercialFilterSurface';
import {
  comercialTableActionsColumnSizing,
  comercialTableCellStyle,
  comercialTableLeadingCellClass,
  comercialTableSelectColumnSizing,
  comercialTableCheckboxWrapClass,
} from '@/lib/comercialTableLayout';
import {
  crmTableBodyRowClassInteractive,
  crmTableFooterClass,
  crmTableHeaderRowClass,
} from '@/lib/crmTableSurface';

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Borrador',
  sending: 'Enviando',
  sent: 'Enviada',
  failed: 'Fallida',
  cancelled: 'Cancelada',
};

const STATUS_CLASS: Record<CampaignStatus, string> = {
  draft: 'border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  sending: 'border-0 bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  sent: 'border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  failed: 'border-0 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  cancelled: 'border-0 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_FILTER_OPTIONS = (
  Object.keys(STATUS_LABELS) as CampaignStatus[]
).map((value) => ({ value, label: STATUS_LABELS[value] }));

const TOGGLEABLE_COLUMNS = [
  { id: 'recipients', label: 'Destinatarios' },
  { id: 'results', label: 'Resultados' },
  { id: 'fecha', label: 'Fecha' },
  { id: 'createdBy', label: 'Creado por' },
] as const;

const CRM_CELL_MUTED = 'text-[13px] text-[#475569] dark:text-gray-400';

export default function CampaignHistoryPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('campanas.crear');

  const [searchInput, setSearchInput] = useState('');
  const [serverSearch, setServerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [items, setItems] = useState<CampaignListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [campaignToDelete, setCampaignToDelete] = useState<CampaignListItem | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setServerSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [serverSearch, statusFilter, pageSize]);

  const refresh = useCallback(() => {
    setPage(1);
    setSelectedIds([]);
    setRefreshKey((k) => k + 1);
  }, []);

  const statusParam = isInclusiveMultiFilterNone(statusFilter) ? null : statusFilter;
  const emptyByFilter = statusParam === null;

  useEffect(() => {
    if (emptyByFilter) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await listCampaignSummariesApi({
          page,
          limit: pageSize,
          search: serverSearch || undefined,
          status: statusParam.length ? statusParam : undefined,
        });
        if (cancelled) return;
        setLoadError(null);
        setTotal(res.total);
        setItems(res.items);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Error al cargar campañas');
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, serverSearch, refreshKey, emptyByFilter, statusParam]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasActiveFilters =
    Boolean(serverSearch) || statusFilter.length > 0;

  const selectedDeletable = items.filter((c) => selectedIds.includes(c.id));
  const allPageSelected = items.length > 0 && selectedIds.length === items.length;

  const toggleSelectAll = () => {
    setSelectedIds(allPageSelected ? [] : items.map((c) => c.id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const openCampaign = (c: CampaignListItem) => {
    if (c.status === 'sent') {
      navigate(`/campaigns/${c.id}/results`);
      return;
    }
    if (canCreate && c.status === 'draft') {
      navigate('/campaigns/new', { state: { draftId: c.id } });
    }
  };

  const handleDeleteOne = async () => {
    if (!campaignToDelete || !canCreate) return;
    setDeleting(true);
    try {
      await deleteCampaignApi(campaignToDelete.id);
      toast.success('Campaña eliminada');
      setCampaignToDelete(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const handleBatchDelete = async () => {
    if (!canCreate || selectedDeletable.length === 0) return;
    setDeleting(true);
    try {
      for (const c of selectedDeletable) {
        await deleteCampaignApi(c.id);
      }
      toast.success(
        selectedDeletable.length === 1
          ? 'Campaña eliminada'
          : `${selectedDeletable.length} campañas eliminadas`,
      );
      setBatchDeleteOpen(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<ColumnDef<CampaignListItem>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <div className={comercialTableCheckboxWrapClass}>
            <Checkbox
              checked={allPageSelected}
              onCheckedChange={toggleSelectAll}
              className="h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className={comercialTableCheckboxWrapClass}>
            <Checkbox
              checked={selectedIds.includes(row.original.id)}
              onCheckedChange={() => toggleSelect(row.original.id)}
              className="h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
            />
          </div>
        ),
        ...comercialTableSelectColumnSizing,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const campaign = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <DropdownMenuTriggerButton />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {campaign.status === 'sent' && (
                  <DropdownMenuItem
                    onClick={() => navigate(`/campaigns/${campaign.id}/results`)}
                  >
                    <ChartSquareIcon />
                    Ver resultados
                  </DropdownMenuItem>
                )}
                {canCreate && campaign.status === 'draft' && (
                  <DropdownMenuItem
                    onClick={() =>
                      navigate('/campaigns/new', { state: { draftId: campaign.id } })
                    }
                  >
                    <PencilFileSvgIcon />
                    Editar borrador
                  </DropdownMenuItem>
                )}
                {canCreate && (
                  <DropdownMenuItem
                    onClick={() =>
                      navigate(
                        `/campaigns/new?duplicate=${encodeURIComponent(campaign.id)}`,
                      )
                    }
                  >
                    <CopySvgIcon />
                    Duplicar campaña
                  </DropdownMenuItem>
                )}
                {canCreate && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setCampaignToDelete(campaign)}
                    >
                      <TrashSvgIcon />
                      Eliminar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        ...comercialTableActionsColumnSizing,
      },
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Nombre',
        size: 240,
        cell: ({ row }) => (
          <span
            className="block truncate text-[13px] font-semibold text-[#0F172A] dark:text-gray-100"
            title={row.original.name}
          >
            {row.original.name || 'Campaña sin nombre'}
          </span>
        ),
      },
      {
        id: 'recipients',
        accessorKey: 'recipientCount',
        header: 'Destinatarios',
        size: 130,
        cell: ({ row }) => (
          <span className={CRM_CELL_MUTED}>{row.original.recipientCount}</span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Estado',
        size: 120,
        cell: ({ row }) => {
          const status = row.original.status as CampaignStatus;
          return (
            <Badge
              variant="outline"
              className={cn(
                'text-xs font-medium',
                STATUS_CLASS[status] ?? STATUS_CLASS.draft,
              )}
            >
              {STATUS_LABELS[status] ?? row.original.status}
            </Badge>
          );
        },
      },
      {
        id: 'results',
        header: 'Resultados',
        size: 220,
        enableSorting: false,
        cell: ({ row }) => {
          const c = row.original;
          if (c.status !== 'sent' || c.sentCount == null) {
            return <span className={CRM_CELL_MUTED}>—</span>;
          }
          const parts = [`${c.deliveredCount ?? 0}/${c.sentCount} entregados`];
          if ((c.openedCount ?? 0) > 0) parts.push(`${c.openedCount} abiertos`);
          if ((c.clickedCount ?? 0) > 0) parts.push(`${c.clickedCount} clics`);
          return (
            <span className={cn('block truncate', CRM_CELL_MUTED)} title={parts.join(' · ')}>
              {parts.join(' · ')}
            </span>
          );
        },
      },
      {
        id: 'fecha',
        accessorFn: (row) => row.sentAt || row.createdAt,
        header: 'Fecha',
        size: 130,
        cell: ({ row }) => (
          <span className={CRM_CELL_MUTED}>
            {row.original.sentAt
              ? formatDate(row.original.sentAt)
              : formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'createdBy',
        accessorKey: 'createdByName',
        header: 'Creado por',
        size: 150,
        cell: ({ row }) => (
          <span className={cn('block truncate', CRM_CELL_MUTED)} title={row.original.createdByName}>
            {row.original.createdByName || '—'}
          </span>
        ),
      },
    ],
    [allPageSelected, selectedIds, canCreate, navigate],
  );

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 60 },
    getRowId: (row) => row.id,
  });

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <PageHeader
        title="Campañas"
        description={
          loadError
            ? `No se pudo cargar el historial: ${loadError}`
            : 'Gestiona y revisa las campañas de mensajería masiva'
        }
      >
        {canCreate && (
          <Button
            onClick={() => navigate('/campaigns/new')}
            className="h-9 text-sm font-normal shadow-md"
          >
            <Plus className="size-4" />
            Nueva
          </Button>
        )}
      </PageHeader>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/50 px-4 py-2.5">
          <span className="text-sm font-medium">
            {selectedIds.length} de {items.length} seleccionadas
          </span>
          {canCreate && selectedDeletable.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBatchDeleteOpen(true)}
              disabled={deleting}
            >
              <Trash2 className="size-4" />
              Eliminar ({selectedDeletable.length})
            </Button>
          )}
        </div>
      )}

      <GlassCard>
        <div className="flex min-w-0 flex-col gap-2 px-5 py-3 lg:flex-row lg:items-center">
          <div className="relative w-full min-w-0 max-w-[400px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a9aab] dark:text-gray-400" />
            <Input
              placeholder="Buscar por nombre..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="!h-10 rounded-lg border border-[#e1e7ee] bg-white/60 pl-8 text-[13px] text-black shadow-none placeholder:text-[#8a9aab] transition-colors hover:border-primary focus-visible:ring-1 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-100 dark:placeholder:text-gray-400"
            />
          </div>
          <ComercialInclusiveMultiFilter
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
            placeholder="Estado"
            countLabel="estados"
            icon={<ChartSquareIcon className={comercialFilterIconClass} />}
          />
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput('');
                setStatusFilter([]);
              }}
            >
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
                className={cn(comercialProPopoverClass, 'w-[200px] p-1.5')}
                align="end"
                sideOffset={8}
              >
                <Command className={comercialProCommandClass}>
                  <CommandList>
                    <CommandGroup>
                      {TOGGLEABLE_COLUMNS.map((col) => {
                        const visible = columnVisibility[col.id] !== false;
                        return (
                          <div
                            key={col.id}
                            onClick={() =>
                              setColumnVisibility((prev) => ({
                                ...prev,
                                [col.id]: !visible,
                              }))
                            }
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
          </div>
        </div>

        {loading && items.length === 0 ? (
          <GhostTableSkeleton
            columns={[
              { label: '', width: 44 },
              { label: '', width: 40 },
              { label: 'Nombre', width: 240 },
              { label: 'Destinatarios', width: 130 },
              { label: 'Estado', width: 120 },
              { label: 'Resultados', width: 220 },
              { label: 'Fecha', width: 130 },
              { label: 'Creado por', width: 150 },
            ]}
            rows={8}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No se encontraron campañas"
            description={
              hasActiveFilters
                ? 'Intenta ajustar los filtros o crea una nueva campaña.'
                : 'Crea una nueva campaña para comenzar.'
            }
            actionLabel={canCreate ? 'Nueva campaña' : undefined}
            onAction={canCreate ? () => navigate('/campaigns/new') : undefined}
          />
        ) : (
          <>
            <div className="max-h-[calc(100vh-330px)] overflow-auto border-t border-border/40 scrollbar-thin">
              <table
                className="w-full table-fixed bg-transparent"
                style={{ minWidth: table.getTotalSize() }}
              >
                <ComercialTableColgroup columns={table.getVisibleLeafColumns()} />
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className={cn('h-[36px] text-left', crmTableHeaderRowClass)}>
                      {hg.headers.map((header) => (
                        <th
                          key={header.id}
                          colSpan={header.colSpan}
                          className={cn(
                            comercialTableLeadingCellClass(header.column.id, {
                              primaryColumnId: 'name',
                              sortable: header.column.getCanSort(),
                            }),
                            header.column.getIsSorted() &&
                              'bg-emerald-50/90 dark:bg-emerald-950/35',
                          )}
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
                      className={cn('h-[48px] last:border-b-0', crmTableBodyRowClassInteractive)}
                      onClick={() => openCampaign(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={comercialTableLeadingCellClass(cell.column.id, {
                            primaryColumnId: 'name',
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
            {total > 0 && (
              <div className={cn('flex h-14 items-center px-5', crmTableFooterClass)}>
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  totalItems={total}
                  pageSize={pageSize}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </GlassCard>

      <ConfirmDialog
        open={campaignToDelete != null}
        onOpenChange={(open) => {
          if (!open) setCampaignToDelete(null);
        }}
        title="Eliminar campaña"
        description={
          campaignToDelete
            ? `¿Eliminar la campaña «${campaignToDelete.name}»? Esta acción no se puede deshacer.`
            : ''
        }
        onConfirm={() => void handleDeleteOne()}
        variant="destructive"
        confirmLabel={deleting ? 'Eliminando...' : 'Eliminar'}
      />

      <ConfirmDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        title="Eliminar campañas seleccionadas"
        description={`¿Eliminar ${selectedDeletable.length} campaña(s)? Esta acción no se puede deshacer.`}
        onConfirm={() => void handleBatchDelete()}
        variant="destructive"
        confirmLabel={
          deleting ? 'Eliminando...' : `Eliminar ${selectedDeletable.length}`
        }
      />
    </div>
  );
}
