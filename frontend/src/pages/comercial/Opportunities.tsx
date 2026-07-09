import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { toast } from 'sonner';
import {
  Plus, Search,
  MoreVertical,
  Eye, Pencil, Trash2,
  Target, TrendingUp,
  X, ChevronDown, ChevronsUpDown, ChevronUp,
  User, Loader2,
  Upload, Download,
  Users,
} from 'lucide-react';
import { ChartSquareIcon } from '@/components/icons/ChartSquareIcon';
import { PaletteIcon } from '@/components/icons/PaletteIcon';
import { BlackSuitcaseSvgIcon } from '@/components/icons/BlackSuitcaseSvgIcon';
import { MoneySackSvgIcon } from '@/components/icons/MoneySackSvgIcon';
import { BusinessGraphBoardSvgIcon } from '@/components/icons/BusinessGraphBoardSvgIcon';
import type { Etapa, Opportunity } from '@/types';
import { etapaLabels, contactSourceLabels } from '@/data/mock';
import { cn } from '@/lib/utils';

import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { GhostTableSkeleton } from '@/components/shared/GhostTableSkeleton';
import { GlassCard } from '@/components/shared/GlassCard';
import {
  NewOpportunityFormDialog,
  buildOpportunityCreateBody,
  type NewOpportunityFormValues,
} from '@/components/shared/NewOpportunityFormDialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { OpportunityEditDialog } from '@/components/shared/OpportunityEditDialog';
import { OpportunityPreviewSheet } from '@/components/shared/OpportunityPreviewSheet';
import { MultiAdvisorFilter } from '@/components/shared/MultiAdvisorFilter';
import { useMultiAdvisorFilter } from '@/hooks/useMultiAdvisorFilter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getStageBadgeTone } from '@/lib/etapaConfig';
import { useCrmConfigStore, getStageLabelFromCatalog, getSourceLabelFromCatalog, useLeadSourceOptions } from '@/store/crmConfigStore';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { api } from '@/lib/api';
import { opportunityDetailHref } from '@/lib/detailRoutes';
import {
  type ApiOpportunityDetail,
  isLikelyOpportunityCuid,
  mapApiOpportunityToOpportunity,
} from '@/lib/opportunityApi';
import { buildOptimisticOpportunity } from '@/lib/optimisticEntities';
import {
  generateOptimisticId,
  useOptimisticCrmStore,
} from '@/store/optimisticCrmStore';
import { usePermissions } from '@/hooks/usePermissions';
import {
  downloadImportExportCsv,
  startImportJob,
} from '@/lib/importExportApi';
import { IMPORT_SPREADSHEET_ACCEPT } from '@/lib/importSpreadsheet';
import { useImportJobsStore } from '@/store/importJobsStore';
import { useOpportunityCacheStore } from '@/store/opportunityCacheStore';
import { FileNewSvgIcon } from '@/components/icons/FileNewSvgIcon';
import { ImportSvgIcon } from '@/components/icons/ImportSvgIcon';
import { ExportSvgIcon } from '@/components/icons/ExportSvgIcon';
import { ColumnsSvgIcon } from '@/components/icons/ColumnsSvgIcon';

const OPPORTUNITIES_TABLE_SKELETON_COLUMNS = [
  { label: '', width: 44 },
  { label: 'Nombre', width: 280 },
  { label: 'Monto', width: 150 },
  { label: 'Etapa', width: 140, className: 'hidden lg:table-cell' },
  { label: 'Asesor', width: 150, className: 'hidden xl:table-cell' },
  { label: 'Fuente', width: 120, className: 'hidden lg:table-cell' },
  { label: 'Prioridad', width: 110, className: 'hidden lg:table-cell' },
  { label: 'Probabilidad', width: 150, className: 'hidden sm:table-cell' },
  { label: 'Fecha cierre', width: 120, className: 'hidden xl:table-cell' },
  { label: '', width: 40 },
];

const etapas: Etapa[] = [
  'lead', 'contacto', 'reunion_agendada', 'reunion_efectiva', 'propuesta_economica',
  'negociacion', 'licitacion', 'licitacion_etapa_final', 'cierre_ganado', 'firma_contrato',
  'activo', 'cierre_perdido', 'inactivo',
];

const DEFAULT_OPPORTUNITIES_PER_PAGE = 25;

function ProbabilityBar({ value }: { value: number }) {
  const colorClass =
    value > 60 ? '[&_[data-slot=progress-indicator]]:bg-emerald-500' :
    value > 30 ? '[&_[data-slot=progress-indicator]]:bg-amber-500' :
    '[&_[data-slot=progress-indicator]]:bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <Progress value={value} className={cn('h-2 w-16', colorClass)} />
      <span className="text-xs text-muted-foreground tabular-nums">{value}%</span>
    </div>
  );
}

function EtapaBadge({ etapa }: { etapa: Etapa }) {
  const bundle = useCrmConfigStore((s) => s.bundle);
  const tone = useMemo(() => getStageBadgeTone(bundle, etapa), [bundle, etapa]);
  const label = getStageLabelFromCatalog(etapa, bundle, etapaLabels as Record<string, string>);
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium', tone.className)} style={tone.style}>
      {label}
    </Badge>
  );
}

export default function OpportunitiesPage() {
  const {
    selectedIds: assigneeFilter,
    setSelectedIds: setAssigneeFilter,
    canSeeAllAdvisors,
    activeAdvisors,
    isInitialized: assigneeFilterInitialized,
    isActive: assigneeFilterIsActive,
    queryParams: advisorListParams,
    matchesAssignee,
    reset: resetAdvisorFilter,
  } = useMultiAdvisorFilter();
  const pendingOpportunities = useOptimisticCrmStore((s) => s.pendingOpportunities);
  const addPendingOpportunity = useOptimisticCrmStore((s) => s.addPendingOpportunity);
  const removePendingOpportunity = useOptimisticCrmStore((s) => s.removePendingOpportunity);
  const isPendingOpportunityId = useOptimisticCrmStore((s) => s.isPendingOpportunityId);
  const cacheOpportunities = useOpportunityCacheStore((s) => s.opportunities);
  const cacheLoad = useOpportunityCacheStore((s) => s.load);
  const cacheLoadedAt = useOpportunityCacheStore((s) => s.loadedAt);
  const bundle = useCrmConfigStore((s) => s.bundle);
  const leadSourceOptions = useLeadSourceOptions();

  useEffect(() => {
    cacheLoad();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apiOpportunities = useMemo(
    () => cacheOpportunities.map(mapApiOpportunityToOpportunity),
    [cacheOpportunities],
  );

  const allOpportunities = useMemo(() => {
    const apiIds = new Set(apiOpportunities.map((o) => o.id));
    const pending = pendingOpportunities.filter((o) => !apiIds.has(o.id));
    return [...pending, ...apiOpportunities];
  }, [apiOpportunities, pendingOpportunities]);

  const navigate = useNavigate();

  function openOpportunityDetail(opp: Opportunity) {
    if (isPendingOpportunityId(opp.id)) {
      toast.info('Guardando oportunidad…');
      return;
    }
    navigate(opportunityDetailHref(opp));
  }

  const [search, setSearch] = useState('');
  const [etapaFilter, setEtapaFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_OPPORTUNITIES_PER_PAGE);
  const [viewMode] = useState<'table'>('table');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    fuente: true,
    priority: true,
    probability: true,
    expectedCloseDate: true,
    etapa: true,
    asesor: true,
  });
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [previewOpportunity, setPreviewOpportunity] = useState<Opportunity | null>(null);
  const [editOpportunity, setEditOpportunity] = useState<Opportunity | null>(null);
  const [oppToDelete, setOppToDelete] = useState<Opportunity | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { hasPermission } = usePermissions();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const enqueueImportJob = useImportJobsStore((s) => s.enqueueJob);
  const opportunityImportCompletionTick = useImportJobsStore(
    (s) => s.completionTickByEntity.opportunities,
  );

  useEffect(() => {
    if (!opportunityImportCompletionTick) return;
    void cacheLoad();
  }, [cacheLoad, opportunityImportCompletionTick]);

  const filteredOpportunities = useMemo(() => {
    return allOpportunities.filter((opp) => {
      const matchesSearch =
        !search ||
        opp.title.toLowerCase().includes(search.toLowerCase()) ||
        opp.contactName?.toLowerCase().includes(search.toLowerCase()) ||
        opp.clientName?.toLowerCase().includes(search.toLowerCase());

      const matchesEtapa = etapaFilter.length === 0 || etapaFilter.includes(opp.etapa);
      const matchesSource = sourceFilter.length === 0 || (opp.fuente ? sourceFilter.includes(opp.fuente) : false);

      return matchesSearch && matchesEtapa && matchesAssignee(opp.assignedTo) && matchesSource;
    });
  }, [allOpportunities, search, etapaFilter, sourceFilter, matchesAssignee]);

  useEffect(() => {
    setPage(1);
  }, [search, etapaFilter, assigneeFilter, sourceFilter, pageSize]);

  const totalFiltered = filteredOpportunities.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const start = (page - 1) * pageSize;
  const displayedOpportunities = useMemo(
    () => filteredOpportunities.slice(start, start + pageSize),
    [filteredOpportunities, start],
  );
  const startIndex = totalFiltered === 0 ? 0 : start + 1;
  const endIndex = totalFiltered === 0
    ? 0
    : Math.min(start + displayedOpportunities.length, totalFiltered);

  const stats = useMemo(() => {
    const total = allOpportunities.length;
    const totalValue = allOpportunities.reduce((sum, o) => sum + o.amount, 0);
    const avgProbability = allOpportunities.length > 0
      ? Math.round(allOpportunities.reduce((sum, o) => sum + o.probability, 0) / allOpportunities.length)
      : 0;

    return { total, totalValue, avgProbability };
  }, [allOpportunities]);

  const hasActiveFilters =
    etapaFilter.length > 0 ||
    assigneeFilterIsActive ||
    sourceFilter.length > 0 ||
    search !== '';

  function clearFilters() {
    setSearch('');
    setEtapaFilter([]);
    setSourceFilter([]);
    resetAdvisorFilter();
  }

  async function handleCreateOpportunity(data: NewOpportunityFormValues) {
    const body = buildOpportunityCreateBody(data);
    const optId = generateOptimisticId('o');
    addPendingOpportunity(buildOptimisticOpportunity(optId, data));
    toast.loading('Guardando…', { id: 'create-opp-list' });
    try {
      await api('/opportunities', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (e) {
      removePendingOpportunity(optId);
      toast.error(
        e instanceof Error ? e.message : 'No se pudo crear la oportunidad',
        { id: 'create-opp-list' },
      );
      throw e;
    }
    removePendingOpportunity(optId);
    await cacheLoad();
    toast.success(`Oportunidad "${data.title.trim()}" creada exitosamente`, { id: 'create-opp-list' });
  }

  async function handleSaveOpportunity(payload: { title: string; amount: number; expectedCloseDate: string | null }) {
    const targetOpp = editOpportunity;
    if (!targetOpp) return;
    const oppId = targetOpp.id;
    const prevRow = useOpportunityCacheStore.getState().opportunities.find((r) => r.id === oppId);

    setEditOpportunity(null);
    if (prevRow) {
      useOpportunityCacheStore.getState().updateRow(oppId, (r) => ({
        ...r,
        title: payload.title,
        amount: payload.amount,
      }));
    }

    toast.loading('Guardando cambios…', { id: `save-${oppId}` });
    try {
      const result = await api<ApiOpportunityDetail>(`/opportunities/${oppId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: payload.title,
          amount: payload.amount,
          expectedCloseDate: payload.expectedCloseDate,
        }),
      });
      useOpportunityCacheStore.getState().updateRow(oppId, () => result);
      toast.success('Oportunidad actualizada', { id: `save-${oppId}` });
    } catch (e) {
      if (prevRow) {
        useOpportunityCacheStore.getState().updateRow(oppId, () => prevRow);
      }
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar', { id: `save-${oppId}` });
    }
  }

  async function handleOppTemplate() {
    try {
      setExportBusy(true);
      await downloadImportExportCsv('opportunities', 'template');
      toast.success('Plantilla descargada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo descargar la plantilla');
    } finally {
      setExportBusy(false);
    }
  }

  async function handleOppExport() {
    try {
      setExportBusy(true);
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (etapaFilter.length > 0) params.etapa = etapaFilter.join(',');
      if (sourceFilter.length > 0) params.fuente = sourceFilter.join(',');
      if (advisorListParams.assignedTo) params.assignedTo = advisorListParams.assignedTo;
      if (advisorListParams.excludeAssignedTo) {
        params.excludeAssignedTo = advisorListParams.excludeAssignedTo;
      }
      if (advisorListParams.advisorPool) params.advisorPool = advisorListParams.advisorPool;
      await downloadImportExportCsv('opportunities', 'export', params);
      toast.success('Exportación descargada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo exportar');
    } finally {
      setExportBusy(false);
    }
  }

  function openOppImport() {
    importInputRef.current?.click();
  }

  function openOpportunityPreview(opp: Opportunity) {
    if (isPendingOpportunityId(opp.id)) {
      toast.info('Guardando oportunidad…');
      return;
    }
    setPreviewOpportunity(opp);
  }

  function openOpportunityEdit(opp: Opportunity) {
    if (!hasPermission('oportunidades.editar')) {
      toast.error('No tienes permiso para editar oportunidades');
      return;
    }
    if (isPendingOpportunityId(opp.id)) {
      toast.info('Espera a que termine de guardarse la oportunidad');
      return;
    }
    if (!isLikelyOpportunityCuid(opp.id)) {
      toast.error('Solo se pueden editar oportunidades guardadas');
      return;
    }
    setEditOpportunity(opp);
  }

  function requestDeleteOpportunity(opp: Opportunity) {
    if (!hasPermission('oportunidades.eliminar')) {
      toast.error('No tienes permiso para eliminar oportunidades');
      return;
    }
    if (isPendingOpportunityId(opp.id)) {
      toast.info('Espera a que termine de guardarse la oportunidad');
      return;
    }
    setOppToDelete(opp);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDeleteOpportunity() {
    if (!oppToDelete) return;
    try {
      if (!isLikelyOpportunityCuid(oppToDelete.id)) {
        toast.error('Solo se pueden eliminar oportunidades guardadas');
        return;
      }
      toast.loading('Eliminando…', { id: 'delete-opp-list' });
      await api(`/opportunities/${oppToDelete.id}`, { method: 'DELETE' });
      await cacheLoad();
      toast.success('Oportunidad eliminada correctamente', { id: 'delete-opp-list' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar', { id: 'delete-opp-list' });
    } finally {
      setOppToDelete(null);
    }
  }

  async function onOppImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportBusy(true);
    try {
      const job = await startImportJob('opportunities', file);
      enqueueImportJob(job);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar');
    } finally {
      setImportBusy(false);
    }
  }

  const columns = useMemo<ColumnDef<Opportunity>[]>(
    () => [
      {
        id: 'select',
        meta: { responsive: '' } as any,
        header: () => (
          <div className="inline-flex items-center justify-center rounded-full p-1.5 transition-colors hover:bg-primary/10 pl-2">
            <Checkbox className="h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded" />
          </div>
        ),
        cell: () => (
          <div className="inline-flex items-center justify-center rounded-full p-1.5 transition-colors hover:bg-primary/10 pl-2">
            <Checkbox className="h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded" />
          </div>
        ),
        size: 44,
        maxSize: 44,
        enableSorting: false,
        enableResizing: false,
      },
      {
        accessorKey: 'title',
        id: 'title',
        header: 'Nombre',
        enableHiding: false,
        size: 280,
        cell: ({ row }) => {
          const opp = row.original;
          const pending = isPendingOpportunityId(opp.id);
          const contactClientLabel = opp.contactName ?? opp.clientName ?? '—';
          return (
            <div className="min-w-0 max-w-[20rem]">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-[#0F172A] dark:text-gray-100" title={opp.title}>
                  {opp.title}
                </p>
                {pending && (
                  <Badge variant="secondary" className="shrink-0 gap-1 font-normal">
                    <Loader2 className="size-3 animate-spin" />
                    Guardando…
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-[#64748B] dark:text-gray-400">{contactClientLabel}</p>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'amount',
        id: 'amount',
        header: 'Monto',
        size: 150,
        cell: ({ getValue }) => (
          <span className="font-semibold tabular-nums text-sm text-[#0F172A] dark:text-gray-100">
            {formatCurrency(getValue() as number)}
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'etapa',
        id: 'etapa',
        header: 'Etapa',
        enableHiding: true,
        size: 140,
        cell: ({ getValue }) => <EtapaBadge etapa={getValue() as Etapa} />,
        enableSorting: false,
      },
      {
        accessorKey: 'assignedToName',
        id: 'asesor',
        header: 'Asesor',
        enableHiding: true,
        size: 150,
        cell: ({ getValue }) => {
          const val = String(getValue() || '');
          return (
            <span className="block truncate text-sm text-[#475569] dark:text-gray-400" title={val || undefined}>
              {val || '—'}
            </span>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'fuente',
        id: 'fuente',
        header: 'Fuente',
        enableHiding: true,
        size: 120,
        cell: ({ getValue }) => {
          const val = String(getValue() || '');
          return (
            <span className="text-sm text-[#475569] dark:text-gray-400">
              {getSourceLabelFromCatalog(val, bundle, contactSourceLabels) || '—'}
            </span>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'priority',
        id: 'priority',
        header: 'Prioridad',
        enableHiding: true,
        size: 110,
        cell: ({ getValue }) => (
          <PriorityBadge priority={(getValue() as string || 'media') as any} />
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'probability',
        id: 'probability',
        header: 'Probabilidad',
        enableHiding: true,
        size: 150,
        cell: ({ getValue }) => <ProbabilityBar value={getValue() as number} />,
        enableSorting: false,
      },
      {
        accessorKey: 'expectedCloseDate',
        id: 'expectedCloseDate',
        header: 'Fecha cierre',
        enableHiding: true,
        size: 120,
        cell: ({ getValue }) => (
          <span className="text-sm text-[#475569] dark:text-gray-400">{formatDate(getValue() as string)}</span>
        ),
        enableSorting: false,
      },
      {
        id: 'actions',
        header: '',
        enableResizing: false,
        enableSorting: false,
        enableHiding: false,
        size: 40,
        maxSize: 40,
        cell: ({ row }) => {
          const opp = row.original;
          const pending = isPendingOpportunityId(opp.id);
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Acciones">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openOpportunityPreview(opp)}>
                  <Eye /> Vista previa
                </DropdownMenuItem>
                {hasPermission('oportunidades.editar') && (
                  <DropdownMenuItem onClick={() => openOpportunityEdit(opp)} disabled={pending}>
                    <Pencil /> Editar
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {hasPermission('oportunidades.eliminar') && (
                  <DropdownMenuItem variant="destructive" onClick={() => requestDeleteOpportunity(opp)} disabled={pending}>
                    <Trash2 /> Eliminar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [isPendingOpportunityId, openOpportunityPreview, openOpportunityEdit, requestDeleteOpportunity, hasPermission, bundle],
  );

  const table = useReactTable({
    data: displayedOpportunities,
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
    <div className="space-y-6">
      <input
        ref={importInputRef}
        type="file"
        accept={IMPORT_SPREADSHEET_ACCEPT}
        className="hidden"
        onChange={onOppImportChange}
      />
      <PageHeader title="Oportunidades" description="Gestiona el pipeline de ventas y oportunidades comerciales">
        <div className="flex items-center rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 p-0.5">
          <button className="rounded-md px-3 py-1.5 text-sm font-medium bg-[#e8f5e9] dark:bg-green-900/30 text-[#13944C] dark:text-green-400">
            Lista
          </button>
          <button
            className="rounded-md px-3 py-1.5 text-sm font-medium text-[#647789] dark:text-gray-400 hover:text-[#1f2933] dark:hover:text-gray-100 transition-colors cursor-pointer"
            onClick={() => navigate('/pipeline')}
          >
            Pipeline
          </button>
        </div>
        <Button onClick={() => setNewDialogOpen(true)} className="h-11 w-[120px] text-base font-normal shadow-md">
          <Plus /> Nueva
        </Button>
      </PageHeader>

      {/* Stats */}
      <Card className="flex flex-col overflow-hidden py-0 sm:flex-row">
        <div className="flex-1 flex items-center justify-center gap-3 py-4 px-5 relative">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-transparent text-emerald-600 border-2 border-emerald-500">
            <BlackSuitcaseSvgIcon className="size-7" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-[#647789] dark:text-gray-400">Total oportunidades</p>
            <p className="text-[22px] font-bold tracking-tight text-[#0F172A] dark:text-gray-100">{stats.total}</p>
            <div className="flex items-center gap-1.5 text-xs">
              <TrendingUp className="size-3.5 text-emerald-500" />
              <span className="font-medium text-emerald-600">+3</span>
              <span className="text-[#8a9aab] dark:text-gray-400">este mes</span>
            </div>
          </div>
          <div className="absolute right-0 top-4 bottom-4 w-px bg-border hidden sm:block" />
        </div>
        <div className="flex-1 flex items-center justify-center gap-3 py-4 px-5 relative">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-transparent text-blue-600 border-2 border-blue-500">
            <MoneySackSvgIcon className="size-7" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-[#647789] dark:text-gray-400">Valor total</p>
            <p className="text-[22px] font-bold tracking-tight text-[#0F172A] dark:text-gray-100">{formatCurrency(stats.totalValue)}</p>
            <div className="flex items-center gap-1.5 text-xs">
              <TrendingUp className="size-3.5 text-emerald-500" />
              <span className="font-medium text-emerald-600">+12%</span>
              <span className="text-[#8a9aab] dark:text-gray-400">vs mes anterior</span>
            </div>
          </div>
          <div className="absolute right-0 top-4 bottom-4 w-px bg-border hidden sm:block" />
        </div>
        <div className="flex-1 flex items-center justify-center gap-3 py-4 px-5 relative">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-transparent text-amber-600 border-2 border-amber-500">
            <BusinessGraphBoardSvgIcon className="size-7" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-[#647789] dark:text-gray-400">Tasa promedio de cierre</p>
            <p className="text-[22px] font-bold tracking-tight text-[#0F172A] dark:text-gray-100">{stats.avgProbability}%</p>
            <div className="flex items-center gap-1.5 text-xs">
              <TrendingUp className="size-3.5 text-emerald-500" />
              <span className="font-medium text-emerald-600">+5%</span>
              <span className="text-[#8a9aab] dark:text-gray-400">tendencia</span>
            </div>
          </div>
        </div>
      </Card>

      <GlassCard>
        {/* Filter bar */}
        <div className="flex min-w-0 flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
          <div className="relative w-full min-w-0 max-w-[400px]">
            <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-[#8a9aab] dark:text-gray-400" />
            <Input
              placeholder="Buscar por nombre, contacto o cliente..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="!h-12 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 pl-10 text-[15px] text-black dark:text-gray-100 placeholder:text-[#8a9aab] dark:placeholder:text-gray-400 transition-colors hover:border-primary focus-visible:ring-1 shadow-none"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button className={`!h-12 w-[190px] rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 px-3 text-sm hover:border-primary transition-colors shadow-none cursor-pointer flex items-center gap-1.5 text-left ${etapaFilter.length > 0 ? 'text-black dark:text-gray-100' : 'text-[#8a9aab] dark:text-gray-400'}`}>
                <ChartSquareIcon className="size-5 shrink-0 text-[#8a9aab] dark:text-gray-400" />
                <span className="truncate flex-1">
                  {etapaFilter.length === 0
                    ? 'Etapa'
                    : etapaFilter.map((k) => etapaLabels[k as keyof typeof etapaLabels] || k).join(', ')}
                </span>
                <ChevronDown className="size-3.5 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandList className="max-h-[260px] overflow-y-auto">
                  <CommandGroup>
                    {Object.entries(etapaLabels).map(([key, label]) => {
                      const selected = etapaFilter.includes(key);
                      return (
                        <CommandItem
                          key={key}
                          onSelect={() => {
                            setEtapaFilter((prev) =>
                              prev.includes(key)
                                ? prev.filter((e) => e !== key)
                                : [...prev, key],
                            );
                            setPage(1);
                          }}
                        >
                          <span className="[&_svg]:!text-primary-foreground">
                            <Checkbox
                              checked={selected}
                              className="mr-2 h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded"
                            />
                          </span>
                          <span>{label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
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
            className="!h-12 w-[190px]"
            onInteraction={() => setPage(1)}
          />

          <Popover>
            <PopoverTrigger asChild>
              <button className={`!h-12 w-[190px] rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 px-3 text-sm hover:border-primary transition-colors shadow-none cursor-pointer flex items-center gap-1.5 text-left truncate ${sourceFilter.length > 0 ? 'text-black dark:text-gray-100' : 'text-[#8a9aab] dark:text-gray-400'}`}>
                <PaletteIcon className="size-5 shrink-0 text-[#8a9aab] dark:text-gray-400" />
                <span className="truncate flex-1">
                  {sourceFilter.length === 0
                    ? 'Fuente'
                    : sourceFilter.map((k) => getSourceLabelFromCatalog(k, bundle, contactSourceLabels)).join(', ')}
                </span>
                <ChevronDown className="size-3.5 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[180px] p-0" align="start">
              <Command>
                <CommandList className="max-h-[260px] overflow-y-auto">
                  <CommandGroup>
                    {leadSourceOptions.map(({ value: key, label }) => {
                      const selected = sourceFilter.includes(key);
                      return (
                        <CommandItem
                          key={key}
                          onSelect={() => {
                            setSourceFilter((prev) =>
                              prev.includes(key)
                                ? prev.filter((e) => e !== key)
                                : [...prev, key],
                            );
                            setPage(1);
                          }}
                        >
                          <span className="[&_svg]:!text-primary-foreground">
                            <Checkbox
                              checked={selected}
                              className="mr-2 h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded"
                            />
                          </span>
                          <span>{label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" /> Limpiar
            </Button>
          )}

          <div className="ml-auto hidden sm:flex items-center gap-5">
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1f2933] dark:text-gray-100 transition-opacity hover:opacity-70 cursor-pointer">
                  <ColumnsSvgIcon className="size-[18px]" />
                  Columnas
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[180px] p-0" align="end">
                <Command>
                  <CommandList>
                    <CommandGroup>
                      {[
                        { id: 'fuente', label: 'Fuente' },
                        { id: 'priority', label: 'Prioridad' },
                        { id: 'probability', label: 'Probabilidad' },
                        { id: 'expectedCloseDate', label: 'Fecha cierre' },
                        { id: 'etapa', label: 'Etapa' },
                        { id: 'asesor', label: 'Asesor' },
                      ].map((col) => {
                        const visible = columnVisibility[col.id] ?? true;
                        return (
                          <div
                            key={col.id}
                            onClick={() => setColumnVisibility((prev) => ({ ...prev, [col.id]: !visible }))}
                            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent"
                          >
                            <Checkbox
                              checked={visible}
                              className="h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded"
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
                <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1f2933] dark:text-gray-100 transition-opacity hover:opacity-70 cursor-pointer">
                  <MoreVertical className="size-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {hasPermission('oportunidades.exportar') && (
                  <DropdownMenuItem
                    disabled={exportBusy}
                    onClick={() => void handleOppTemplate()}
                  >
                    {exportBusy ? <Loader2 className="size-3.5 animate-spin" /> : <FileNewSvgIcon className="size-[18px]" />}
                    Plantilla
                  </DropdownMenuItem>
                )}
                {hasPermission('oportunidades.crear') && (
                  <DropdownMenuItem
                    disabled={importBusy}
                    onClick={openOppImport}
                  >
                    {importBusy ? <Loader2 className="size-3.5 animate-spin" /> : <ImportSvgIcon className="size-[18px]" />}
                    Importar
                  </DropdownMenuItem>
                )}
                {hasPermission('oportunidades.exportar') && (
                  <DropdownMenuItem
                    disabled={exportBusy}
                    onClick={() => void handleOppExport()}
                  >
                    {exportBusy ? <Loader2 className="size-3.5 animate-spin" /> : <ExportSvgIcon className="size-[18px]" />}
                    Exportar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        {!cacheLoadedAt ? (
          <div className="border-t border-border/40 overflow-auto scrollbar-thin max-h-[calc(100vh-460px)]">
            <GhostTableSkeleton columns={[...OPPORTUNITIES_TABLE_SKELETON_COLUMNS]} rows={10} />
          </div>
        ) : filteredOpportunities.length === 0 ? (
          <Card className="border-0 shadow-none rounded-none">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Target className="mb-4 size-12 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold">No se encontraron oportunidades</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Intenta ajustar los filtros o crea una nueva oportunidad.
              </p>
              <Button className="mt-4" onClick={() => setNewDialogOpen(true)}>
          <Plus /> Nueva
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === 'table' ? (
          <div className="border-t border-border/40 overflow-auto scrollbar-thin max-h-[calc(100vh-460px)]">
            <table className="w-full table-fixed" style={{ minWidth: table.getTotalSize() }}>
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="h-11 bg-[#eef1f5] dark:bg-gray-800 text-left text-xs font-bold text-[#647789] dark:text-gray-400">
                    {hg.headers.map((header: any) => (
                      <th
                        key={header.id}
                        colSpan={header.colSpan}
                        className={cn(
                          'relative px-3 align-middle overflow-hidden',
                          header.column.getCanSort() && 'cursor-pointer select-none hover:text-[#1f2933] dark:hover:text-gray-100',
                          header.column.id === 'select' && 'pr-0',
                          header.column.id === 'title' && 'pl-2',
                        )}
                        style={{ width: header.getSize() }}
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
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); header.getResizeHandler()(e); }}
                            onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); header.getResizeHandler()(e); }}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute inset-y-0 right-0 flex items-center justify-center w-5 cursor-col-resize group/rez"
                          >
                            <div className="h-4 w-[2px] rounded-full bg-gray-200 group-hover/rez:bg-blue-500 group-active/rez:bg-blue-500 group-hover/rez:w-[5px] group-active/rez:w-[5px] transition-all select-none pointer-events-none" />
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => {
                  const pending = isPendingOpportunityId(row.original.id);
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'h-14 border-b border-dashed border-[#e8ecf0] dark:border-gray-700 bg-card/30 transition-colors cursor-pointer last:border-b-0',
                        pending ? 'bg-muted/40' : 'hover:bg-[#fafbfc] dark:hover:bg-gray-800',
                      )}
                      onClick={() => openOpportunityDetail(row.original)}
                    >
                      {row.getVisibleCells().map((cell: any) => (
                        <td
                          key={cell.id}
                          className={cn(
                            'px-3 align-middle overflow-hidden',
                            cell.column.id === 'select' && 'pr-0',
                            cell.column.id === 'title' && 'pl-2',
                          )}
                          style={{ width: cell.column.getSize() }}
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
        ) : null}

        {totalFiltered > 0 && (
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

      <NewOpportunityFormDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onCreate={handleCreateOpportunity}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setOppToDelete(null);
        }}
        title="Eliminar oportunidad"
        description={
          oppToDelete
            ? `¿Estás seguro que deseas eliminar esta oportunidad? Esta acción no se puede deshacer.`
            : ''
        }
        onConfirm={() => void handleConfirmDeleteOpportunity()}
        variant="destructive"
      />

      <OpportunityPreviewSheet
        opportunity={previewOpportunity}
        open={previewOpportunity !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewOpportunity(null);
        }}
        onOpenFullDetail={() => {
          const o = previewOpportunity;
          setPreviewOpportunity(null);
          if (o) openOpportunityDetail(o);
        }}
        onEdit={() => {
          const o = previewOpportunity;
          setPreviewOpportunity(null);
          if (o) openOpportunityEdit(o);
        }}
      />

      <OpportunityEditDialog
        opportunity={editOpportunity}
        open={editOpportunity !== null}
        onOpenChange={(open) => {
          if (!open) setEditOpportunity(null);
        }}
        onSave={handleSaveOpportunity}
      />
    </div>
  );
}
