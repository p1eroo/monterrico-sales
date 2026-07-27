import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { navigateOnAuxClick, navigateOnClick } from '@/lib/navigateOnClick';
import { toast, notify } from '@/lib/notify';
import * as XLSX from 'xlsx';
import {
  Search, Building2, Users, Briefcase,
  Plus, Loader2,
  Eye, Pencil, Trash2, MoreVertical,
  X, ChevronDown,
  ChevronsUpDown, ChevronUp,
} from 'lucide-react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import type { DateRange } from 'react-day-picker';
import type { Etapa, CompanyRubro, CompanyTipo, Company, ContactSource } from '@/types';
import { companyTipoLabels, etapaLabels, contactSourceLabels } from '@/data/mock';
import { useCrmConfigStore, getSourceLabelFromCatalog, getRubroLabelFromCatalog, useLeadSourceOptions, useRubroLabelsMap } from '@/store/crmConfigStore';
import { useCompaniesStore } from '@/store/companiesStore';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ImportInProgressDialog } from '@/components/shared/ImportInProgressDialog';
import { Pagination } from '@/components/shared/Pagination';
import { MultiAdvisorFilter } from '@/components/shared/MultiAdvisorFilter';
import { MultiCheckboxFilterActions } from '@/components/shared/MultiCheckboxFilterActions';
import { useMultiAdvisorFilter } from '@/hooks/useMultiAdvisorFilter';
import { CompanyEditDialog, type CompanyEditSavePayload } from '@/components/shared/CompanyEditDialog';
import { CompanyPreviewSheet } from '@/components/shared/CompanyPreviewSheet';
import {
  NewCompanyWizard,
  type NewCompanyData,
  type NewCompanyWizardSubmitMeta,
} from '@/components/shared/NewCompanyWizard';
import { newCompanyDataToPatchBody } from '@/lib/companyWizardMap';

import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
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
import { ChartSquareIcon } from '@/components/icons/ChartSquareIcon';
import { CategorySolidIcon } from '@/components/icons/CategorySolidIcon';
import { DateRangeFilterButton } from '@/components/ui/date-range-filter-button';
import { GitForkIcon } from '@/components/icons/GitForkIcon';
import { PaletteIcon } from '@/components/icons/PaletteIcon';
import { addCalendarDaysLocalIso } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { ComercialTableColgroup } from '@/components/shared/ComercialTableColgroup';
import {
  comercialTableActionsColumnSizing,
  comercialTableCellStyle,
  comercialTableLeadingCellClass,
  comercialTableSelectColumnSizing,
  comercialTableCheckboxWrapClass,
} from '@/lib/comercialTableLayout';
import { formatDateShort } from '@/lib/formatters';
import {
  comercialFilterIconClass,
  comercialProPopoverClass,
  comercialProCommandClass,
  dateRangeToQueryBounds,
  isInclusiveMultiFilterSelected,
  toggleInclusiveMultiFilter,
  formatInclusiveMultiFilterLabel,
  isInclusiveMultiFilterNone,
  isInclusiveMultiFilterAll,
  INCLUSIVE_MULTI_NONE,
  inclusiveMultiSourceFilterToApiParam,
  formatInclusiveMultiSourceFilterLabel,
} from '@/lib/comercialFilterSurface';
import {
  crmTableBodyRowClassInteractive,
  crmTableFooterClass,
  crmTableHeaderRowClass,
} from '@/lib/crmTableSurface';
import { api, API_BASE } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import {
  downloadImportExportCsv,
  previewCompaniesImportCsv,
  startImportJob,
  type CompanyImportPreviewResult,
} from '@/lib/importExportApi';
import { IMPORT_SPREADSHEET_ACCEPT } from '@/lib/importSpreadsheet';
import {
  type ApiCompanyRecord,
  type CompanySummaryRow,
  bulkDeleteCompanies,
  companyListSummaryPaginated,
  companySummaryEtapaCounts,
  isLikelyCompanyCuid,
} from '@/lib/companyApi';
import { isLikelyContactCuid, contactCreate } from '@/lib/contactApi';
import { contactListAll } from '@/lib/contactApi';
import { opportunityListAll } from '@/lib/opportunityApi';
import { companyDetailHref, contactDetailHref } from '@/lib/detailRoutes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { GhostTableSkeleton } from '@/components/shared/GhostTableSkeleton';
import { GlassCard } from '@/components/shared/GlassCard';
import { useImportJobsStore } from '@/store/importJobsStore';
import {
  CrmEntityCardGridSkeleton,
} from '@/components/shared/CrmListPageSkeleton';
import { ColumnsSvgIcon } from '@/components/icons/ColumnsSvgIcon';
import { FilterSvgIcon } from '@/components/icons/FilterSvgIcon';
import { FileNewSvgIcon } from '@/components/icons/FileNewSvgIcon';
import { ImportSvgIcon } from '@/components/icons/ImportSvgIcon';
import { ExportSvgIcon } from '@/components/icons/ExportSvgIcon';

type EmpresaSummaryRow = CompanySummaryRow & { isLocalOnly?: boolean };

function empresaDetailPath(row: EmpresaSummaryRow): string {
  return companyDetailHref({ id: row.id, urlSlug: row.urlSlug, name: row.name });
}

function localCompanyToSummary(c: Company): EmpresaSummaryRow {
  return {
    id: c.id,
    name: c.name,
    razonSocial: null,
    ruc: null,
    telefono: null,
    domain: c.domain ?? null,
    rubro: c.rubro ?? null,
    tipo: c.tipo ?? null,
    facturacionEstimada: 0,
    fuente: null,
    etapa: 'lead',
    assignedTo: null,
    createdAt: c.createdAt,
    updatedAt: c.createdAt,
    contactCount: 0,
    totalEstimatedValue: 0,
    displayEtapa: 'lead',
    displayFuente: null,
    displayAdvisorUserId: null,
    displayAdvisorName: null,
    clienteRecuperado: null,
    contactsPreview: [],
    lastInteractionAt: null,
    isLocalOnly: true,
  };
}

function EmpresaContactsList({
  items,
  totalCount,
  onPick,
}: {
  items: { id: string; name: string; urlSlug?: string }[];
  totalCount: number;
  onPick: (row: { id: string; urlSlug?: string }) => void;
}) {
  return (
    <>
      <div className="border-b px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">
          Contactos vinculados ({totalCount}
          {items.length < totalCount ? ` · mostrando ${items.length}` : ''})
        </p>
      </div>
      <ul className="max-h-60 overflow-y-auto py-1">
        {items.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => onPick(c)}
            >
              {c.name}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Clic en el contador / fila abre lista de contactos (evita navegar con la fila/tarjeta). */
function EmpresaContactsPopover({
  contactCount,
  preview,
  variant = 'table',
}: {
  contactCount: number;
  preview: { id: string; name: string; urlSlug?: string }[];
  variant?: 'table' | 'card';
}) {
  const navigate = useNavigate();
  const n = contactCount;
  const go = (row: { id: string; urlSlug?: string }) =>
    navigate(contactDetailHref(row));

  if (n === 0) {
    if (variant === 'card') {
      return (
        <p className="flex items-center gap-2">
          <Users className="size-3 shrink-0" /> Sin contactos
        </p>
      );
    }
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {variant === 'table' ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 font-normal"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Ver ${n} contacto${n !== 1 ? 's' : ''}`}
          >
            <Badge variant="secondary" className="tabular-nums">
              {n}
            </Badge>
          </Button>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md text-left hover:bg-muted/80 -mx-1 px-1 py-0.5"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Ver ${n} contacto${n !== 1 ? 's' : ''}`}
          >
            <Users className="size-3 shrink-0" />
            <span>
              {n} contacto{n !== 1 ? 's' : ''}
              <span className="ml-1 text-xs text-primary">· ver</span>
            </span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        align={variant === 'table' ? 'center' : 'start'}
        onClick={(e) => e.stopPropagation()}
      >
        <EmpresaContactsList items={preview} totalCount={n} onPick={go} />
      </PopoverContent>
    </Popover>
  );
}

function parseRubroFromApi(s: string | null | undefined): CompanyRubro | undefined {
  const t = s?.trim();
  if (!t) return undefined;
  return t;
}

function parseTipoFromApi(s: string | null | undefined): CompanyTipo | undefined {
  if (!s) return undefined;
  return s === 'A' || s === 'B' || s === 'C' ? s : undefined;
}

function sourceLabelFromApi(
  s: string | null | undefined,
  bundle: ReturnType<typeof useCrmConfigStore.getState>['bundle'],
): string {
  if (!s) return '—';
  return getSourceLabelFromCatalog(s, bundle, contactSourceLabels);
}

function importPreviewCell(v: string | undefined) {
  const t = (v ?? '').trim();
  if (t === '') {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="block truncate" title={t}>
      {t}
    </span>
  );
}

const logoCache = new Map<string, boolean>();

function CompanyLogoImg({ companyId, isLocal }: { companyId: string; isLocal: boolean }) {
  const [errored, setErrored] = useState(() => logoCache.get(companyId) === true);
  if (isLocal || !isLikelyCompanyCuid(companyId) || errored) {
    return <Building2 className="size-4 text-muted-foreground" />;
  }
  return (
    <img
      src={`${API_BASE}/companies/${companyId}/logo`}
      alt=""
      className="size-6 rounded object-contain"
      onError={() => {
        logoCache.set(companyId, true);
        setErrored(true);
      }}
    />
  );
}

const ITEMS_PER_PAGE = 25;

export default function EmpresasPage() {
  const navigate = useNavigate();
  const { companies: standaloneCompanies, updateCompany, deleteCompany } = useCompaniesStore();
  const {
    selectedIds: advisorFilter,
    setSelectedIds: setAdvisorFilter,
    canSeeAllAdvisors,
    activeAdvisors,
    isInitialized: advisorFilterInitialized,
    isActive: advisorFilterIsActive,
    queryParams: advisorListParams,
    reset: resetAdvisorFilter,
  } = useMultiAdvisorFilter();

  const [summaryRows, setSummaryRows] = useState<CompanySummaryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const bundle = useCrmConfigStore((s) => s.bundle);
  const leadSourceOptions = useLeadSourceOptions();
  const rubroLabelsMap = useRubroLabelsMap();

  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [etapaFilter, setEtapaFilter] = useState<string[]>([]);
  const [rubroFilter, setRubroFilter] = useState<string[]>([]);
  const [tipoFilter, setTipoFilter] = useState<string[]>([]);
  const [interactionRange, setInteractionRange] = useState<DateRange | undefined>();
  const [creationRange, setCreationRange] = useState<DateRange | undefined>();
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    fuente: true,
    rubro: true,
    tipo: true,
    recuperado: true,
    asesor: true,
    creacion: true,
    contactos: true,
    ultimaInteraccion: true,
  });
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectAllMode, setSelectAllMode] = useState(false);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'cards';
    return 'table';
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [newEmpresaOpen, setNewEmpresaOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importPreviewInProgress, setImportPreviewInProgress] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] =
    useState<CompanyImportPreviewResult | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(
    null,
  );
  const [exportBusy, setExportBusy] = useState(false);
  const [fullExportBusy, setFullExportBusy] = useState(false);
  const { hasPermission } = usePermissions();

  const [previewEmpresa, setPreviewEmpresa] = useState<EmpresaSummaryRow | null>(null);
  const [editEmpresa, setEditEmpresa] = useState<EmpresaSummaryRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [empresaToDelete, setEmpresaToDelete] = useState<EmpresaSummaryRow | null>(null);
  const [etapaTabCounts, setEtapaTabCounts] = useState<Record<
    string,
    number
  > | null>(null);
  const enqueueImportJob = useImportJobsStore((s) => s.enqueueJob);
  const companyImportCompletionTick = useImportJobsStore(
    (s) => s.completionTickByEntity.companies,
  );

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced, pageSize]);

  const listFilterParams = useMemo(() => {
    const { from: interactionFromIso, to: interactionToIso } =
      dateRangeToQueryBounds(interactionRange);
    const { from: createdFromIso, to: createdToIso } =
      dateRangeToQueryBounds(creationRange);
    return {
      search: searchDebounced || undefined,
      etapa: etapaFilter.length > 0 ? etapaFilter.join(',') : undefined,
      fuente: inclusiveMultiSourceFilterToApiParam(sourceFilter),
      assignedTo: advisorListParams.assignedTo,
      excludeAssignedTo: advisorListParams.excludeAssignedTo,
      advisorPool: advisorListParams.advisorPool,
      rubro: rubroFilter.length > 0 ? rubroFilter.join(',') : undefined,
      tipo: tipoFilter.length > 0 ? tipoFilter.join(',') : undefined,
      lastInteractionFrom: interactionFromIso,
      lastInteractionTo: interactionToIso,
      createdFrom: createdFromIso,
      createdTo: createdToIso,
    };
  }, [
    searchDebounced,
    etapaFilter,
    sourceFilter,
    advisorListParams,
    rubroFilter,
    tipoFilter,
    interactionRange,
    creationRange,
  ]);

  useEffect(() => {
    setSelectedCompanies([]);
    setSelectAllMode(false);
  }, [listFilterParams]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await companyListSummaryPaginated({
        page,
        limit: pageSize,
        ...listFilterParams,
      });
      setSummaryRows(res.data);
      setTotal(res.total);
      setTotalPages(Math.max(1, res.totalPages));
    } catch {
      setSummaryRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    listFilterParams,
  ]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const loadEtapaTabCounts = useCallback(async () => {
    try {
      const { counts } = await companySummaryEtapaCounts(listFilterParams);
      setEtapaTabCounts(counts);
    } catch {
      setEtapaTabCounts({});
    }
  }, [listFilterParams]);

  useEffect(() => {
    void loadEtapaTabCounts();
  }, [loadEtapaTabCounts]);

  useEffect(() => {
    if (!companyImportCompletionTick) return;
    void loadSummary();
    void loadEtapaTabCounts();
  }, [companyImportCompletionTick, loadEtapaTabCounts, loadSummary]);

  const hasActiveFilters =
    etapaFilter.length > 0 ||
    sourceFilter.length > 0 ||
    rubroFilter.length > 0 ||
    tipoFilter.length > 0 ||
    advisorFilterIsActive ||
    searchDebounced !== '' ||
    Boolean(interactionRange?.from || interactionRange?.to) ||
    Boolean(creationRange?.from || creationRange?.to);

  const filtersDefault = !hasActiveFilters;

  const displayRows = useMemo((): EmpresaSummaryRow[] => {
    if (page !== 1 || !filtersDefault || standaloneCompanies.length === 0) {
      return summaryRows;
    }
    const names = new Set(
      summaryRows.map((r) => r.name.trim().toLowerCase()),
    );
    const locals = standaloneCompanies
      .filter((c) => !names.has(c.name.trim().toLowerCase()))
      .map(localCompanyToSummary);
    return [...locals, ...summaryRows];
  }, [summaryRows, page, filtersDefault, standaloneCompanies]);

  function clearFilters() {
    setSearch('');
    setSearchDebounced('');
    setSourceFilter([]);
    setEtapaFilter([]);
    setRubroFilter([]);
    setTipoFilter([]);
    resetAdvisorFilter();
    setInteractionRange(undefined);
    setCreationRange(undefined);
    setPage(1);
    setSelectedCompanies([]);
    setSelectAllMode(false);
  }

  function toggleSelectAll() {
    if (selectAllMode) {
      setSelectAllMode(false);
      setSelectedCompanies([]);
      return;
    }
    if (
      selectedCompanies.length === displayRows.length &&
      displayRows.length > 0
    ) {
      setSelectedCompanies([]);
      return;
    }
    setSelectedCompanies(displayRows.map((r) => r.id));
  }

  function handleSelectAllMatchingFilter() {
    setSelectAllMode(true);
    setSelectedCompanies(displayRows.map((r) => r.id));
  }

  function toggleSelectCompany(id: string) {
    if (selectAllMode) return;
    setSelectedCompanies((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }

  const selectedDeleteCount = selectAllMode ? total : selectedCompanies.length;
  const allPageSelected =
    !selectAllMode &&
    displayRows.length > 0 &&
    selectedCompanies.length === displayRows.length;

  async function handleBatchDelete() {
    if (selectedDeleteCount === 0) return;
    setBatchDeleting(true);
    toast.loading('Eliminando…', { id: 'batch-delete-empresas' });
    try {
      const result = await bulkDeleteCompanies(
        selectAllMode
          ? { selectAll: true, ...listFilterParams }
          : {
              ids: selectedCompanies.filter((id) => isLikelyCompanyCuid(id)),
            },
      );
      setBatchDeleteDialogOpen(false);
      setSelectedCompanies([]);
      setSelectAllMode(false);
      await loadSummary();
      await loadEtapaTabCounts();
      toast.success(`${result.deleted} eliminada(s)`, {
        id: 'batch-delete-empresas',
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo eliminar',
        { id: 'batch-delete-empresas' },
      );
    } finally {
      setBatchDeleting(false);
    }
  }

  const companyImportPreviewCsvKeys = useMemo(() => {
    const withCols = importPreviewData?.rows.find(
      (r) => r.csvColumns && Object.keys(r.csvColumns).length > 0,
    );
    return withCols ? Object.keys(withCols.csvColumns) : [];
  }, [importPreviewData]);

  const [sorting, setSorting] = useState<SortingState>([]);

  const responsiveClasses: Record<string, string> = {
    etapa: 'hidden md:table-cell',
    fuente: 'hidden lg:table-cell',
    rubro: 'hidden md:table-cell',
    tipo: 'hidden md:table-cell',
    recuperado: 'hidden lg:table-cell',
    asesor: 'hidden xl:table-cell',
  };
  const getResponsiveClass = (id: string) => responsiveClasses[id] ?? '';

  const columns = useMemo<ColumnDef<EmpresaSummaryRow>[]>(
    () => [
      {
        id: 'select',
        meta: { responsive: '' } as any,
        header: () => (
          <div className={comercialTableCheckboxWrapClass}>
            <Checkbox
              checked={
                selectAllMode ||
                (selectedCompanies.length === displayRows.length &&
                  displayRows.length > 0)
              }
              onCheckedChange={toggleSelectAll}
              className="h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className={comercialTableCheckboxWrapClass}>
            <Checkbox
              checked={
                selectAllMode || selectedCompanies.includes(row.original.id)
              }
              disabled={selectAllMode}
              onCheckedChange={() => toggleSelectCompany(row.original.id)}
              className="h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded"
            />
          </div>
        ),
        ...comercialTableSelectColumnSizing,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const emp = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Acciones">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => openCompanyPreview(emp)}>
                  <Eye /> Vista previa
                </DropdownMenuItem>
                {hasPermission('empresas.editar') && (
                  <DropdownMenuItem onClick={() => openCompanyEdit(emp)}>
                    <Pencil /> Editar
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {hasPermission('empresas.eliminar') && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => requestDeleteCompany(emp)}
                  >
                    <Trash2 /> Eliminar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        ...comercialTableActionsColumnSizing,
      },
      {
        accessorKey: 'name',
        id: 'empresa',
        header: 'Empresa',
        size: 240,
        enableHiding: false,
        cell: ({ row }) => {
          const companyId = row.original.id;
          const isLocal = (row.original as any).isLocalOnly;
          return (
          <div className="min-w-0 flex items-center gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden">
              <CompanyLogoImg companyId={companyId} isLocal={isLocal} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[#0F172A] dark:text-gray-100" title={row.original.name}>
                <Link
                  to={empresaDetailPath(row.original)}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-primary"
                >
                  {row.original.name}
                </Link>
              </p>
              {row.original.domain && (
                <a
                  href={row.original.domain.startsWith('http') ? row.original.domain : `https://${row.original.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-muted-foreground hover:text-primary hover:underline truncate block"
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.original.domain}
                </a>
              )}
            </div>
          </div>
        );
      },
      enableSorting: false,
      },
      {
        accessorKey: 'displayEtapa',
        id: 'etapa',
        header: 'Etapa',
        enableHiding: true,
        cell: ({ getValue }) => <StatusBadge status={getValue() as Etapa} />,
        enableSorting: false,
        size: 140,
      },
      {
        accessorKey: 'displayFuente',
        id: 'fuente',
        header: 'Fuente',
        enableHiding: true,
        cell: ({ getValue }) => (
          <span className="text-[13px] text-[#475569] dark:text-gray-400">{sourceLabelFromApi(getValue() as string | null, bundle)}</span>
        ),
        enableSorting: false,
        size: 100,
      },
      {
        accessorKey: 'rubro',
        id: 'rubro',
        header: 'Rubro',
        enableHiding: true,
        cell: ({ getValue }) => {
          const rubro = parseRubroFromApi(getValue() as string | null | undefined);
          const label = rubro ? getRubroLabelFromCatalog(rubro, bundle) : undefined;
          return <span className="block truncate text-[13px] text-[#475569] dark:text-gray-400" title={label}>{label ?? '—'}</span>;
        },
        enableSorting: false,
        size: 140,
      },
      {
        accessorKey: 'tipo',
        id: 'tipo',
        header: 'Tipo',
        enableHiding: true,
        cell: ({ getValue }) => {
          const tipo = parseTipoFromApi(getValue() as string | null | undefined);
          return <span className="text-[13px] text-[#475569] dark:text-gray-400">{tipo ?? '—'}</span>;
        },
        enableSorting: false,
        size: 65,
        maxSize: 65,
      },
      {
        accessorKey: 'clienteRecuperado',
        id: 'recuperado',
        header: 'Recuperado',
        enableHiding: true,
        cell: ({ getValue }) => (
          <span className="text-[13px] text-[#475569] dark:text-gray-400">
            {getValue() === 'si' ? 'Recuperado' : '—'}
          </span>
        ),
        enableSorting: false,
        size: 95,
      },
      {
        accessorKey: 'displayAdvisorName',
        id: 'asesor',
        header: 'Asesor',
        enableHiding: true,
        cell: ({ getValue }) => (
          <span className="text-[13px] text-[#475569] dark:text-gray-400">{getValue() as string ?? '—'}</span>
        ),
        enableSorting: false,
        size: 120,
      },
      {
        accessorKey: 'createdAt',
        id: 'creacion',
        header: 'Creación',
        enableHiding: true,
        cell: ({ getValue }) => (
          <span className="text-[13px] text-[#475569] dark:text-gray-400">
            {formatDateShort(String(getValue() ?? ''))}
          </span>
        ),
        enableSorting: false,
        size: 115,
      },
      {
        id: 'contactos',
        header: 'Contactos',
        enableHiding: true,
        cell: ({ row }) => (
          <div className="flex justify-center">
            <EmpresaContactsPopover
              contactCount={row.original.contactCount}
              preview={row.original.contactsPreview}
              variant="table"
            />
          </div>
        ),
        enableSorting: false,
        size: 100,
      },
      {
        accessorKey: 'lastInteractionAt',
        id: 'ultimaInteraccion',
        header: 'U. Interacción',
        enableHiding: true,
        cell: ({ getValue }) => (
          <span className="text-[13px] text-[#475569] dark:text-gray-400">
            {getValue() ? formatDateShort(String(getValue())) : '—'}
          </span>
        ),
        enableSorting: false,
        size: 120,
      },
    ],
    [openCompanyPreview, openCompanyEdit, requestDeleteCompany, hasPermission, bundle],
  );

  const table = useReactTable({
    data: displayRows,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 60 },
  });

  /** Conteos de pestañas: servidor + empresas solo locales (cuentan como etapa lead). */
  const effectiveEtapaTabCounts = useMemo((): Record<string, number> => {
    const base = etapaTabCounts ? { ...etapaTabCounts } : null;
    if (!base) return {};
    if (!(page === 1 && filtersDefault && standaloneCompanies.length > 0)) {
      return base;
    }
    const names = new Set(
      summaryRows.map((r) => r.name.trim().toLowerCase()),
    );
    let extraLead = 0;
    for (const c of standaloneCompanies) {
      if (!names.has(c.name.trim().toLowerCase())) {
        extraLead += 1;
      }
    }
    if (extraLead > 0) {
      base.lead = (base.lead ?? 0) + extraLead;
    }
    return base;
  }, [
    etapaTabCounts,
    page,
    filtersDefault,
    standaloneCompanies,
    summaryRows,
  ]);

  useEffect(() => {
    if (etapaTabCounts == null) return;
    if (etapaFilter.length === 0 || isInclusiveMultiFilterNone(etapaFilter)) return;
    const hasAnyResult = etapaFilter.some((e) => (effectiveEtapaTabCounts[e] ?? 0) > 0);
    if (hasAnyResult) return;
    setEtapaFilter([]);
    setPage(1);
  }, [etapaTabCounts, etapaFilter, effectiveEtapaTabCounts]);

  async function handleNewEmpresaSubmit(
    data: NewCompanyData,
    meta: NewCompanyWizardSubmitMeta,
  ) {
    if (!data.origenLead) {
      const msg = 'Selecciona la fuente del lead';
      toast.error(msg);
      throw new Error(msg);
    }

    if (meta.mode === 'update' && meta.existingCompanyId) {
      try {
        await api(`/companies/${meta.existingCompanyId}`, {
          method: 'PATCH',
          body: JSON.stringify(newCompanyDataToPatchBody(data)),
        });
        await loadSummary();
        toast.success(`Empresa "${data.nombreComercial.trim()}" actualizada`);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : 'No se pudo actualizar la empresa';
        toast.error(msg);
        throw e instanceof Error ? e : new Error(msg);
      }
      return;
    }

    const monto = Number(data.facturacion);
    if (!Number.isFinite(monto) || monto <= 0) {
      const msg = 'La facturación estimada debe ser mayor que 0';
      toast.error(msg);
      throw new Error(msg);
    }

    const assignedTo = data.propietario?.trim() || activeAdvisors[0]?.id || '';

    let created: ApiCompanyRecord;
    try {
      created = await api<ApiCompanyRecord>('/companies', {
        method: 'POST',
        body: JSON.stringify({
          name: data.nombreComercial.trim(),
          razonSocial: data.razonSocial.trim() || undefined,
          ruc: data.ruc.trim() || undefined,
          telefono: data.telefono.trim() || undefined,
          domain: data.dominio.trim() || undefined,
          rubro: data.rubro || undefined,
          tipo: data.tipoEmpresa || undefined,
          linkedin: data.linkedin.trim() || undefined,
          correo: data.correo.trim() || undefined,
          distrito: data.distrito.trim() || undefined,
          provincia: data.provincia.trim() || undefined,
          departamento: data.departamento.trim() || undefined,
          direccion: data.direccion.trim() || undefined,
          facturacionEstimada: monto,
          fuente: data.origenLead,
          clienteRecuperado: data.clienteRecuperado,
          etapa: data.etapa,
          ...(assignedTo && isLikelyContactCuid(assignedTo)
            ? { assignedTo }
            : {}),
        }),
      });
      await loadSummary();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'No se pudo guardar la empresa';
      toast.error(msg);
      throw e instanceof Error ? e : new Error(msg);
    }
    const oppTitle =
      data.nombreNegocio.trim() || data.nombreComercial.trim() || 'Sin título';
    const expectedCloseDate =
      data.fechaCierre.trim() || addCalendarDaysLocalIso(30);
    const rawCorreo = (data.correo || '').trim();
    const useEmailAsContactName =
      !!rawCorreo &&
      !rawCorreo.toLowerCase().endsWith('@temp.local') &&
      rawCorreo.includes('@');
    const contactDisplayName = useEmailAsContactName
      ? rawCorreo
      : data.nombreComercial.trim();
    let contactId: string | undefined;
    let contactApiError: string | null = null;
    if (rawCorreo) {
      try {
        const contactBody: Record<string, unknown> = {
          name: contactDisplayName,
          telefono: (data.telefono || '').trim(),
          correo: rawCorreo,
          fuente: (data.origenLead || 'base') as ContactSource,
          etapa: data.etapa,
          estimatedValue: monto,
          companyId: created.id,
          clienteRecuperado: data.clienteRecuperado,
        };
        if (assignedTo && isLikelyContactCuid(assignedTo)) {
          contactBody.assignedTo = assignedTo;
        }
        const createdContact = await contactCreate(contactBody);
        contactId = createdContact.id;
      } catch (e) {
        contactApiError =
          e instanceof Error
            ? e.message
            : 'No se pudo crear el contacto';
      }
    }

    let opportunityApiError: string | null = null;
    try {
      await api('/opportunities', {
        method: 'POST',
        body: JSON.stringify({
          title: oppTitle,
          amount: monto,
          etapa: data.etapa,
          fuente: data.origenLead,
          expectedCloseDate,
          companyId: created.id,
          ...(contactId ? { contactId } : {}),
          priority: 'media',
          ...(assignedTo && isLikelyContactCuid(assignedTo) ? { assignedTo } : {}),
        }),
      });
    } catch (e) {
      opportunityApiError =
        e instanceof Error
          ? e.message
          : 'No se pudo crear la oportunidad';
    }

    await loadSummary();

    if (!opportunityApiError && !contactApiError) {
      const suffix = contactId
        ? `con contacto y oportunidad "${oppTitle}"`
        : `con oportunidad "${oppTitle}" (sin contacto: indica un correo para crearlo)`;
      toast.success(`Empresa "${data.nombreComercial}" creada ${suffix}`);
    } else if (!opportunityApiError && contactApiError) {
      toast.warning(
        `Empresa y oportunidad "${oppTitle}" creadas. No se pudo crear el contacto: ${contactApiError}`,
      );
    } else if (opportunityApiError && !contactApiError) {
      const saved = contactId ? 'Empresa y contacto guardados.' : 'Empresa guardada.';
      toast.warning(`${saved} ${opportunityApiError} (la oportunidad quedó pendiente).`);
    } else {
      toast.warning(
        `Empresa guardada. No se pudo crear el contacto (${contactApiError}). ${opportunityApiError} (la oportunidad quedó pendiente).`,
      );
    }
  }

  function openCompanyDetail(emp: EmpresaSummaryRow, event?: React.MouseEvent) {
    const path = empresaDetailPath(emp);
    if (event) {
      navigateOnClick(event, path, navigate);
      return;
    }
    navigate(path);
  }

  function openCompanyPreview(emp: EmpresaSummaryRow) {
    setPreviewEmpresa(emp);
  }

  function openCompanyEdit(emp: EmpresaSummaryRow) {
    if (!hasPermission('empresas.editar')) {
      toast.error('No tienes permiso para editar empresas');
      return;
    }
    setEditEmpresa(emp);
  }

  function requestDeleteCompany(emp: EmpresaSummaryRow) {
    if (!hasPermission('empresas.eliminar')) {
      toast.error('No tienes permiso para eliminar empresas');
      return;
    }
    setEmpresaToDelete(emp);
    setDeleteDialogOpen(true);
  }

  async function handleSaveCompanyFromList(payload: CompanyEditSavePayload) {
    const empresaId = editEmpresa?.id;
    if (!empresaId) return;
    const prevRowIndex = summaryRows.findIndex((r) => r.id === empresaId);
    const prevRow = prevRowIndex >= 0 ? summaryRows[prevRowIndex] : null;

    if (editEmpresa?.isLocalOnly) {
      updateCompany(empresaId, {
        name: payload.name,
        domain: payload.domain || undefined,
        rubro: (payload.rubro || undefined) as CompanyRubro | undefined,
        tipo: (payload.tipo || undefined) as CompanyTipo | undefined,
      });
      setEditEmpresa(null);
      notify.success('Empresa actualizada', 'Los cambios se guardaron correctamente');
      return;
    }

    // Close modal and update optimistically
    setEditEmpresa(null);
    if (prevRow) {
      setSummaryRows((prev) => {
        const next = [...prev];
        next[prevRowIndex] = { ...next[prevRowIndex], name: payload.name };
        return next;
      });
    }

    toast.loading('Guardando cambios…', { id: `save-${empresaId}`, description: 'Esto puede tardar unos segundos' });
    try {
      const result = await api<ApiCompanyRecord>(`/companies/${empresaId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: payload.name,
          domain: payload.domain?.trim() || undefined,
          telefono: payload.telefono.trim() || undefined,
          rubro: payload.rubro || undefined,
          tipo: payload.tipo || undefined,
          ruc: payload.ruc.trim() || undefined,
          razonSocial: payload.razonSocial.trim() || undefined,
          fuente: payload.fuente || undefined,
          ...(payload.assignedTo && isLikelyContactCuid(payload.assignedTo)
            ? { assignedTo: payload.assignedTo }
            : {}),
        }),
      });
      // Reconcile with API response
      setSummaryRows((prev) => prev.map((r) => (r.id === empresaId ? { ...r, ...result, clienteRecuperado: result.clienteRecuperado as CompanySummaryRow['clienteRecuperado'] } : r)));
      notify.success('Empresa actualizada', 'Los cambios se guardaron correctamente', { id: `save-${empresaId}` });
    } catch (e) {
      // Revert on error
      if (prevRow && prevRowIndex >= 0) {
        setSummaryRows((prev) => {
          const next = [...prev];
          next[prevRowIndex] = prevRow;
          return next;
        });
      }
      notify.error('No se pudo guardar', e instanceof Error ? e.message : 'Inténtalo de nuevo', { id: `save-${empresaId}` });
    }
  }

  async function handleConfirmDeleteEmpresa() {
    if (!empresaToDelete) return;
    try {
      if (empresaToDelete.isLocalOnly) {
        deleteCompany(empresaToDelete.id);
        await loadSummary();
        notify.success('Empresa eliminada', 'Se eliminó correctamente del sistema', { id: 'delete-empresa' });
        return;
      }
      if (!isLikelyCompanyCuid(empresaToDelete.id)) {
        toast.error('Solo se pueden eliminar empresas guardadas', { id: 'delete-empresa' });
        return;
      }
      toast.loading('Eliminando…', { id: 'delete-empresa' });
      await api(`/companies/${empresaToDelete.id}`, { method: 'DELETE' });
      await loadSummary();
      notify.success('Empresa eliminada', 'Se eliminó correctamente del sistema', { id: 'delete-empresa' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar', { id: 'delete-empresa' });
    } finally {
      setEmpresaToDelete(null);
    }
  }

  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, total);
  const localExtraOnPage =
    page === 1 && filtersDefault
      ? standaloneCompanies.filter(
          (c) =>
            !summaryRows.some(
              (r) =>
                r.name.trim().toLowerCase() === c.name.trim().toLowerCase(),
            ),
        ).length
      : 0;

  async function handleCompanyTemplate() {
    try {
      setExportBusy(true);
      await downloadImportExportCsv('companies', 'template');
      toast.success('Plantilla descargada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo descargar la plantilla');
    } finally {
      setExportBusy(false);
    }
  }

  async function handleCompanyExport() {
    try {
      setExportBusy(true);
      const params: Record<string, string> = {};
      if (searchDebounced) params.search = searchDebounced;
      if (etapaFilter.length > 0) params.etapa = etapaFilter.join(',');
      const fuenteParam = inclusiveMultiSourceFilterToApiParam(sourceFilter);
      if (fuenteParam) params.fuente = fuenteParam;
      if (rubroFilter.length > 0) params.rubro = rubroFilter.join(',');
      if (tipoFilter.length > 0) params.tipo = tipoFilter.join(',');
      if (advisorListParams.assignedTo) params.assignedTo = advisorListParams.assignedTo;
      if (advisorListParams.excludeAssignedTo) {
        params.excludeAssignedTo = advisorListParams.excludeAssignedTo;
      }
      if (advisorListParams.advisorPool) params.advisorPool = advisorListParams.advisorPool;
      const { from: interactionFromIso, to: interactionToIso } =
        dateRangeToQueryBounds(interactionRange);
      const { from: createdFromIso, to: createdToIso } =
        dateRangeToQueryBounds(creationRange);
      if (interactionFromIso) params.lastInteractionFrom = interactionFromIso;
      if (interactionToIso) params.lastInteractionTo = interactionToIso;
      if (createdFromIso) params.createdFrom = createdFromIso;
      if (createdToIso) params.createdTo = createdToIso;
      await downloadImportExportCsv('companies', 'export', params);
      toast.success('Exportación descargada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo exportar');
    } finally {
      setExportBusy(false);
    }
  }

  async function handleFullExport() {
    try {
      setFullExportBusy(true);
      const params: Record<string, string> = {};
      if (searchDebounced) params.search = searchDebounced;
      if (etapaFilter.length > 0) params.etapa = etapaFilter.join(',');
      const fuenteParam = inclusiveMultiSourceFilterToApiParam(sourceFilter);
      if (fuenteParam) params.fuente = fuenteParam;
      if (rubroFilter.length > 0) params.rubro = rubroFilter.join(',');
      if (tipoFilter.length > 0) params.tipo = tipoFilter.join(',');
      if (advisorListParams.assignedTo) params.assignedTo = advisorListParams.assignedTo;
      if (advisorListParams.excludeAssignedTo) {
        params.excludeAssignedTo = advisorListParams.excludeAssignedTo;
      }
      if (advisorListParams.advisorPool) params.advisorPool = advisorListParams.advisorPool;
      const { from: interactionFromIso, to: interactionToIso } =
        dateRangeToQueryBounds(interactionRange);
      const { from: createdFromIso, to: createdToIso } =
        dateRangeToQueryBounds(creationRange);
      if (interactionFromIso) params.lastInteractionFrom = interactionFromIso;
      if (interactionToIso) params.lastInteractionTo = interactionToIso;
      if (createdFromIso) params.createdFrom = createdFromIso;
      if (createdToIso) params.createdTo = createdToIso;

      const [companies, contacts, opportunities] = await Promise.all([
        companyListSummaryPaginated({
          limit: 5000,
          search: params.search,
          etapa: params.etapa,
          fuente: params.fuente,
          rubro: params.rubro,
          tipo: params.tipo,
          assignedTo: advisorListParams.assignedTo,
          excludeAssignedTo: advisorListParams.excludeAssignedTo,
          advisorPool: advisorListParams.advisorPool,
          lastInteractionFrom: params.lastInteractionFrom,
          lastInteractionTo: params.lastInteractionTo,
          createdFrom: params.createdFrom,
          createdTo: params.createdTo,
        }),
        contactListAll({
          etapa: params.etapa,
          fuente: params.fuente,
          assignedTo: advisorListParams.assignedTo,
          excludeAssignedTo: advisorListParams.excludeAssignedTo,
          advisorPool: advisorListParams.advisorPool,
        }),
        opportunityListAll(params),
      ]);

      // Index contacts by company
      const contactsByCompany = new Map<string, typeof contacts>();
      for (const c of contacts) {
        const comps = (c as any).companies;
        if (comps) {
          for (const cc of comps) {
            const cid = cc.company?.id;
            if (cid) {
              const arr = contactsByCompany.get(cid) || [];
              arr.push(c);
              contactsByCompany.set(cid, arr);
            }
          }
        }
      }

      // Index opportunities by company
      const oppsByCompany = new Map<string, typeof opportunities>();
      for (const o of opportunities) {
        const comps = (o as any).companies;
        if (comps) {
          for (const oc of comps) {
            const cid = oc.company?.id;
            if (cid) {
              const arr = oppsByCompany.get(cid) || [];
              arr.push(o);
              oppsByCompany.set(cid, arr);
            }
          }
        }
      }

      // Determine max contacts and opps per company for dynamic columns
      let maxContacts = 0;
      let maxOpps = 0;
      for (const c of companies.data) {
        const cs = contactsByCompany.get(c.id)?.length ?? 0;
        const os = oppsByCompany.get(c.id)?.length ?? 0;
        if (cs > maxContacts) maxContacts = cs;
        if (os > maxOpps) maxOpps = os;
      }

      // Build column headers
      const fixedHeaders = ['Empresa', 'RUC', 'Dominio', 'Etapa', 'Asesor', 'Teléfono', 'Rubro', 'Fuente', 'Última interacción'];
      const contactHeaders: string[] = [];
      for (let i = 0; i < maxContacts; i++) {
        contactHeaders.push(`Contacto ${i + 1}`, `Email ${i + 1}`, `Teléfono ${i + 1}`);
      }
      const oppHeaders: string[] = [];
      for (let i = 0; i < maxOpps; i++) {
        oppHeaders.push(`Oportunidad ${i + 1}`, `Monto ${i + 1}`, `Etapa ${i + 1}`);
      }
      const headers = [...fixedHeaders, ...contactHeaders, ...oppHeaders];

      // Build rows: one per company
      const rows = companies.data.map((c) => {
        const row: Record<string, string> = {
          Empresa: c.name,
          RUC: c.ruc || '',
          Dominio: c.domain || '',
          Etapa: c.displayEtapa,
          Asesor: c.displayAdvisorName || '',
          Teléfono: c.telefono || '',
          Rubro: c.rubro || '',
          Fuente: c.fuente || '',
          'Última interacción': c.lastInteractionAt ? formatDateShort(c.lastInteractionAt) : '',
        };

        const cs = contactsByCompany.get(c.id) || [];
        for (let i = 0; i < maxContacts; i++) {
          const contact = cs[i];
          row[`Contacto ${i + 1}`] = contact?.name || '';
          row[`Email ${i + 1}`] = (contact as any)?.correo || '';
          row[`Teléfono ${i + 1}`] = (contact as any)?.telefono || '';
        }

        const os = oppsByCompany.get(c.id) || [];
        for (let i = 0; i < maxOpps; i++) {
          const opp = os[i];
          row[`Oportunidad ${i + 1}`] = opp?.title || '';
          row[`Monto ${i + 1}`] = opp?.amount != null ? String(opp.amount) : '';
          row[`Etapa ${i + 1}`] = (opp as any)?.etapa || '';
        }

        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Exportación Completa');
      XLSX.writeFile(wb, `export_full_empresas_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Exportación completa descargada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error en exportación completa');
    } finally {
      setFullExportBusy(false);
    }
  }

  function openCompanyImport() {
    importInputRef.current?.click();
  }

  function closeImportPreview() {
    setImportPreviewOpen(false);
    setImportPreviewData(null);
    setPendingImportFile(null);
  }

  async function onCompanyImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportPreviewInProgress(true);
    setImportBusy(true);
    try {
      const preview = await previewCompaniesImportCsv(file);
      setImportPreviewData(preview);
      setPendingImportFile(file);
      setImportPreviewOpen(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error al generar vista previa',
      );
    } finally {
      setImportPreviewInProgress(false);
      setImportBusy(false);
    }
  }

  async function confirmCompanyImport() {
    const file = pendingImportFile;
    const preview = importPreviewData;
    if (!file || !preview) {
      closeImportPreview();
      return;
    }
    closeImportPreview();
    setImportBusy(true);
    try {
      const job = await startImportJob('companies', file);
      enqueueImportJob(job);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar');
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <div>
      <ImportInProgressDialog
        open={importPreviewInProgress}
        title="Generando vista previa"
        description="Puede tardar unos segundos si el archivo tiene muchas filas."
        footerNote=""
      />
      <Dialog
        open={importPreviewOpen}
        onOpenChange={(open) => {
          if (!open) closeImportPreview();
        }}
      >
        <DialogContent className="flex h-[min(92vh,880px)] max-h-[92vh] w-[min(96vw,calc(100vw-2rem))] max-w-[min(96vw,87.5rem)] flex-col gap-0 p-0 sm:max-w-[min(96vw,87.5rem)]">
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>Vista previa · importar empresas</DialogTitle>
            <DialogDescription className="text-left">
              {importPreviewData ? (
                <>
                  <span className="block">
                    {importPreviewData.okCount} fila(s) lista(s) ·{' '}
                    {importPreviewData.errorCount} con error
                    {importPreviewData.blockedCount
                      ? ` · ${importPreviewData.blockedCount} bloqueada(s) por asesor`
                      : ''}
                    {importPreviewData.skipped
                      ? ` · ${importPreviewData.skipped} vacía(s) omitida(s)`
                      : ''}
                    . Los datos SUNAT/RENIEC/CEE se consultan al confirmar la importación, no en esta vista.
                  </span>
                  {importPreviewData.errorCount > 0 ? (
                    <span className="mt-2 block text-muted-foreground">
                      Las filas con error se omitirán durante la importación.
                    </span>
                  ) : null}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-3">
            {importPreviewData && importPreviewData.rows.length > 0 ? (
              <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                <Table
                  containerClassName="overflow-visible"
                  className="w-max min-w-full text-sm"
                >
<TableHeader className="sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="sticky left-0 z-20 w-12 min-w-12 whitespace-nowrap bg-background px-2 shadow-[2px_0_6px_-4px_rgba(0,0,0,0.25)]">
                        Fila
                      </TableHead>
                      <TableHead
                        className={cn(
                          'sticky z-20 w-[5.5rem] min-w-[5.5rem] whitespace-nowrap bg-background px-2 shadow-[2px_0_6px_-4px_rgba(0,0,0,0.25)]',
                          'left-12',
                        )}
                      >
                        Estado
                      </TableHead>
                      {companyImportPreviewCsvKeys.map((key) => (
                        <TableHead
                          key={key}
                          className="w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem] align-bottom font-normal text-muted-foreground"
                        >
                          <span className="block truncate" title={key}>
                            {key}
                          </span>
                        </TableHead>
                      ))}
                      <TableHead className="w-[14rem] min-w-[14rem] max-w-[14rem] align-bottom">
                        Motivo / detalle
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreviewData.rows
                      .slice()
                      .sort((a, b) => a.row - b.row)
                      .map((row) => (
                        <TableRow key={row.row}>
                          <TableCell
                            className={cn(
                              'sticky left-0 z-10 bg-background px-2 align-top tabular-nums text-muted-foreground shadow-[2px_0_6px_-4px_rgba(0,0,0,0.2)]',
                            )}
                          >
                            {row.row}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'sticky left-12 z-10 bg-background px-2 align-top shadow-[2px_0_6px_-4px_rgba(0,0,0,0.2)]',
                            )}
                          >
                            {row.ok ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-200 bg-emerald-50 font-normal text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                              >
                                OK
                              </Badge>
                            ) : row.blocked ? (
                              <Badge
                                variant="outline"
                                className="border-amber-300 bg-amber-50 font-normal text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                              >
                                Bloqueada
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="font-normal">
                                Error
                              </Badge>
                            )}
                          </TableCell>
                          {companyImportPreviewCsvKeys.map((key) => (
                            <TableCell
                              key={`${row.row}-${key}`}
                              className="w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem] align-top text-xs"
                            >
                              {importPreviewCell(row.csvColumns?.[key])}
                            </TableCell>
                          ))}
                          <TableCell className="w-[14rem] min-w-[14rem] max-w-[14rem] align-top text-muted-foreground">
                            <span
                              className="block truncate"
                              title={row.ok ? undefined : row.error}
                            >
                              {row.ok
                                ? importPreviewCell(undefined)
                                : (row.error ?? '—')}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            ) : importPreviewData ? (
              <p className="text-sm text-muted-foreground">No hay filas que mostrar.</p>
            ) : null}
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={closeImportPreview}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!importPreviewData}
              onClick={() => void confirmCompanyImport()}
            >
              Importar {importPreviewData ? `(${importPreviewData.okCount}/${importPreviewData.totalRows})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <input
        ref={importInputRef}
        type="file"
        accept={IMPORT_SPREADSHEET_ACCEPT}
        className="hidden"
        onChange={onCompanyImportChange}
      />
      <PageHeader
        title="Empresas"
        description="Gestiona empresas y cuentas comerciales"
        className="mb-4"
      >
        {hasPermission('empresas.eliminar') && selectedDeleteCount > 0 && (
          <Button
            variant="destructive"
            onClick={() => setBatchDeleteDialogOpen(true)}
            disabled={batchDeleting}
          >
            {batchDeleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}{' '}
            Eliminar ({selectedDeleteCount})
          </Button>
        )}
        <Button onClick={() => setNewEmpresaOpen(true)} className="h-9 w-[110px] text-sm font-normal shadow-md">
          <Plus /> Nueva
        </Button>
      </PageHeader>

      {selectedDeleteCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2.5">
          {selectAllMode ? (
            <span className="text-sm font-medium">
              Todas las {total} empresas del filtro están seleccionadas
            </span>
          ) : (
            <span className="text-sm font-medium">
              {selectedCompanies.length} de {total} seleccionadas
            </span>
          )}
          {allPageSelected && total > displayRows.length && (
            <Button
              variant="link"
              size="sm"
              className="h-auto px-1 text-xs"
              onClick={handleSelectAllMatchingFilter}
            >
              Seleccionar las {total} empresas del filtro
            </Button>
          )}
          {selectAllMode && (
            <Button
              variant="link"
              size="sm"
              className="h-auto px-1 text-xs"
              onClick={() => {
                setSelectAllMode(false);
                setSelectedCompanies([]);
              }}
            >
              Deseleccionar todo
            </Button>
          )}
        </div>
      )}

      <GlassCard>
      {/* Filter bar */}
      <div className="flex min-w-0 flex-col gap-2 px-5 py-3 lg:flex-row lg:items-center">
        <div className="relative w-full min-w-0 max-w-[400px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a9aab] dark:text-gray-400" />
          <Input
            placeholder="Buscar por empresa o contacto..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="!h-10 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 pl-8 text-[13px] text-black dark:text-gray-100 placeholder:text-[#8a9aab] dark:placeholder:text-gray-400 transition-colors hover:border-primary focus-visible:ring-1 shadow-none"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button className={`!h-10 w-[190px] rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 px-3 text-[13px] hover:border-primary transition-colors shadow-none cursor-pointer flex items-center gap-1.5 text-left ${etapaFilter.length > 0 ? 'text-black dark:text-gray-100' : 'text-[#8a9aab] dark:text-gray-400'}`}>
              <ChartSquareIcon className={comercialFilterIconClass} />
              <span className="truncate flex-1">
                {formatInclusiveMultiFilterLabel(
                  etapaFilter,
                  'Etapa',
                  (k) => etapaLabels[k] || k,
                  'etapas',
                )}
              </span>
              <ChevronDown className="size-3.5 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent className={cn(comercialProPopoverClass, "w-[220px] p-1.5")} align="start" sideOffset={8}>
            <Command className={comercialProCommandClass}>
              <CommandList className="max-h-[260px] overflow-y-auto">
                <CommandGroup>
                  {Object.entries(etapaLabels).map(([key, label]) => {
                    const selected = isInclusiveMultiFilterSelected(etapaFilter, key);
                    return (
                      <CommandItem
                        key={key}
                        onSelect={() => {
                          setEtapaFilter((prev) =>
                            toggleInclusiveMultiFilter(
                              prev,
                              key,
                              Object.keys(etapaLabels),
                            ),
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

        <Popover>
          <PopoverTrigger asChild>
            <button className={`!h-10 w-[190px] rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 px-3 text-[13px] hover:border-primary transition-colors shadow-none cursor-pointer flex items-center gap-1.5 text-left truncate ${rubroFilter.length > 0 ? 'text-black dark:text-gray-100' : 'text-[#8a9aab] dark:text-gray-400'}`}>
              <CategorySolidIcon className={comercialFilterIconClass} />
              <span className="truncate flex-1">
                {formatInclusiveMultiFilterLabel(
                  rubroFilter,
                  'Rubro',
                  (k) => rubroLabelsMap[k] || k,
                  'rubros',
                )}
              </span>
              <ChevronDown className="size-3.5 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent className={cn(comercialProPopoverClass, "w-[220px] p-1.5")} align="start" sideOffset={8}>
            <Command className={comercialProCommandClass}>
              <CommandList className="max-h-[260px] overflow-y-auto">
                <CommandGroup>
                  {Object.entries(rubroLabelsMap).map(([key, label]) => {
                    const selected = isInclusiveMultiFilterSelected(rubroFilter, key);
                    return (
                      <CommandItem
                        key={key}
                        onSelect={() => {
                          setRubroFilter((prev) =>
                            toggleInclusiveMultiFilter(
                              prev,
                              key,
                              Object.keys(rubroLabelsMap),
                            ),
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
              <MultiCheckboxFilterActions
                allSelected={isInclusiveMultiFilterAll(rubroFilter)}
                noneSelected={isInclusiveMultiFilterNone(rubroFilter)}
                onSelectAll={() => {
                  setRubroFilter([]);
                  setPage(1);
                }}
                onClear={() => {
                  setRubroFilter([INCLUSIVE_MULTI_NONE]);
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

        <div className="ml-auto hidden sm:flex items-center gap-5">
          <Popover>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1f2933] dark:text-gray-100 transition-opacity hover:opacity-70 cursor-pointer">
                <ColumnsSvgIcon className="size-[18px]" />
                Columnas
              </button>
            </PopoverTrigger>
            <PopoverContent className={cn(comercialProPopoverClass, "w-[200px] p-1.5")} align="end" sideOffset={8}>
              <Command className={comercialProCommandClass}>
                <CommandList>
                  <CommandGroup>
                    {[
                      { id: 'fuente', label: 'Fuente' },
                      { id: 'rubro', label: 'Rubro' },
                      { id: 'tipo', label: 'Tipo' },
                      { id: 'recuperado', label: 'Recuperado' },
                      { id: 'asesor', label: 'Asesor' },
                      { id: 'creacion', label: 'Creación' },
                      { id: 'contactos', label: 'Contactos' },
                      { id: 'ultimaInteraccion', label: 'U. Interacción' },
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
          <Popover>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1f2933] dark:text-gray-100 transition-opacity hover:opacity-70 cursor-pointer">
                <FilterSvgIcon className="size-[18px]" />
                Filtros
              </button>
            </PopoverTrigger>
            <PopoverContent className={cn(comercialProPopoverClass, "w-[min(100vw-2rem,680px)] p-3")} align="end" sideOffset={8}>
              <div className="flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={`!h-10 flex-1 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 px-3 text-[13px] hover:border-primary transition-colors shadow-none cursor-pointer text-left truncate flex items-center gap-1.5 ${sourceFilter.length > 0 ? 'text-black dark:text-gray-100' : 'text-[#8a9aab] dark:text-gray-400'}`}>
                      <PaletteIcon className={comercialFilterIconClass} />
                      <span className="truncate flex-1">
                        {formatInclusiveMultiSourceFilterLabel(
                          sourceFilter,
                          'Fuente',
                          (k) =>
                            getSourceLabelFromCatalog(
                              k,
                              bundle,
                              contactSourceLabels,
                            ),
                        )}
                      </span>
                      <ChevronDown className="size-3.5 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className={cn(comercialProPopoverClass, "w-[200px] p-1.5")} align="start" sideOffset={8}>
                    <Command className={comercialProCommandClass}>
                      <CommandList className="max-h-[260px] overflow-y-auto">
                        <CommandGroup>
                          {leadSourceOptions.map(({ value: key, label }) => {
                            const selected = isInclusiveMultiFilterSelected(
                              sourceFilter,
                              key,
                            );
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
                                  className="mr-2 h-4 w-4 border border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded"
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
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={`!h-10 flex-1 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 px-3 text-[13px] hover:border-primary transition-colors shadow-none cursor-pointer text-left truncate flex items-center gap-1.5 ${tipoFilter.length > 0 ? 'text-black dark:text-gray-100' : 'text-[#8a9aab] dark:text-gray-400'}`}>
                      <GitForkIcon className={comercialFilterIconClass} />
                      <span className="truncate flex-1">
                        {formatInclusiveMultiFilterLabel(
                          tipoFilter,
                          'Tipo',
                          (k) => companyTipoLabels[k] || k,
                          'tipos',
                        )}
                      </span>
                      <ChevronDown className="size-3.5 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className={cn(comercialProPopoverClass, "w-[200px] p-1.5")} align="start" sideOffset={8}>
                    <Command className={comercialProCommandClass}>
                      <CommandList className="max-h-[260px] overflow-y-auto">
                        <CommandGroup>
                          {Object.entries(companyTipoLabels).map(([key, label]) => {
                            const selected = isInclusiveMultiFilterSelected(tipoFilter, key);
                            return (
                              <CommandItem
                                key={key}
                                onSelect={() => {
                                  setTipoFilter((prev) =>
                                    toggleInclusiveMultiFilter(
                                      prev,
                                      key,
                                      Object.keys(companyTipoLabels),
                                    ),
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
                      <MultiCheckboxFilterActions
                        allSelected={isInclusiveMultiFilterAll(tipoFilter)}
                        noneSelected={isInclusiveMultiFilterNone(tipoFilter)}
                        onSelectAll={() => {
                          setTipoFilter([]);
                          setPage(1);
                        }}
                        onClear={() => {
                          setTipoFilter([INCLUSIVE_MULTI_NONE]);
                          setPage(1);
                        }}
                      />
                    </Command>
                  </PopoverContent>
                </Popover>
                <MultiAdvisorFilter
                  value={advisorFilter}
                  onChange={setAdvisorFilter}
                  advisors={activeAdvisors}
                  disabled={!canSeeAllAdvisors}
                  isActive={advisorFilterIsActive}
                  isInitialized={advisorFilterInitialized}
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
              <button className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1f2933] dark:text-gray-100 transition-opacity hover:opacity-70 cursor-pointer">
                <MoreVertical className="size-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {hasPermission('empresas.exportar') && (
                <DropdownMenuItem
                  disabled={exportBusy}
                  onClick={() => void handleCompanyTemplate()}
                >
                  {exportBusy ? <Loader2 className="size-3.5 animate-spin" /> : <FileNewSvgIcon className="size-[18px]" />}
                  Plantilla
                </DropdownMenuItem>
              )}
              {hasPermission('empresas.crear') && (
                <DropdownMenuItem
                  disabled={importBusy}
                  onClick={openCompanyImport}
                >
                  {importBusy ? <Loader2 className="size-3.5 animate-spin" /> : <ImportSvgIcon className="size-[18px]" />}
                  Importar
                </DropdownMenuItem>
              )}
              {hasPermission('empresas.exportar') && (
                <DropdownMenuItem
                  disabled={exportBusy}
                  onClick={() => void handleCompanyExport()}
                >
                  {exportBusy ? <Loader2 className="size-3.5 animate-spin" /> : <ExportSvgIcon className="size-[18px]" />}
                  Exportar
                </DropdownMenuItem>
              )}
              {hasPermission('empresas.exportar') && (
                <DropdownMenuItem
                  disabled={fullExportBusy}
                  onClick={() => void handleFullExport()}
                >
                  {fullExportBusy ? <Loader2 className="size-3.5 animate-spin" /> : <ExportSvgIcon className="size-[18px]" />}
                  Full Exp
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      {loading && displayRows.length === 0 ? (
        viewMode === 'table' ? (
          <GhostTableSkeleton
            columns={[
              { label: '', width: 44 },
              { label: '', width: 40 },
              { label: 'Empresa', width: 280 },
              { label: 'Etapa', width: 140, className: 'hidden md:table-cell' },
              { label: 'Fuente', width: 100, className: 'hidden lg:table-cell' },
              { label: 'Rubro', width: 170, className: 'hidden md:table-cell' },
              { label: 'Tipo', width: 65, className: 'hidden md:table-cell' },
              { label: 'Recuperado', width: 110, className: 'hidden lg:table-cell' },
              { label: 'Asesor', width: 120, className: 'hidden xl:table-cell' },
              { label: 'Creación', width: 115 },
              { label: 'Contactos', width: 115, className: 'text-center' },
              { label: 'U. Interacción', width: 145 },
            ]}
            rows={10}
          />
        ) : (
          <CrmEntityCardGridSkeleton count={8} aria-label="Cargando empresas" />
        )
      ) : displayRows.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No se encontraron empresas"
          description="Intenta ajustar los filtros o crea una nueva empresa."
        />
      ) : viewMode === 'table' ? (
        <div className="border-t border-border/40 overflow-auto scrollbar-thin max-h-[calc(100vh-330px)]">
          <table className="w-full table-fixed" style={{ minWidth: table.getTotalSize() }}>
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
                          primaryColumnId: 'empresa',
                          sortable: header.column.getCanSort(),
                        }),
                        getResponsiveClass(header.column.id),
                      )}
                      style={comercialTableCellStyle(header.column.id, header.getSize())}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <>
                            {header.column.getIsSorted() === "asc" ? (
                              <ChevronUp className="size-3 shrink-0" />
                            ) : header.column.getIsSorted() === "desc" ? (
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
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn('h-[48px] last:border-b-0', crmTableBodyRowClassInteractive)}
                  onClick={(e) => openCompanyDetail(row.original, e)}
                  onAuxClick={(e) => navigateOnAuxClick(e, empresaDetailPath(row.original))}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        comercialTableLeadingCellClass(cell.column.id, {
                          primaryColumnId: 'empresa',
                        }),
                        getResponsiveClass(cell.column.id),
                      )}
                      style={comercialTableCellStyle(cell.column.id, cell.column.getSize())}
                      onClick={
                        cell.column.id === "actions" || cell.column.id === "select"
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
      ) : (
        <div className="p-5 border-t border-border/40">
          <div className="grid w-full grid-cols-1 gap-3 px-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayRows.map((emp) => {
              const rubro = parseRubroFromApi(emp.rubro);
              const tipo = parseTipoFromApi(emp.tipo);
              const rowKey = emp.isLocalOnly ? `local-${emp.id}` : emp.id;
              return (
<Card
              key={rowKey}
              className="cursor-pointer gap-0 max-w-full overflow-hidden py-0 transition-shadow hover:shadow-md"
              onClick={(e) => openCompanyDetail(emp, e)}
              onAuxClick={(e) => navigateOnAuxClick(e, empresaDetailPath(emp))}
            >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Building2 className="size-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold">
                        <Link
                          to={empresaDetailPath(emp)}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-primary"
                        >
                          {emp.name}
                        </Link>
                      </h3>
                      {emp.domain && (
                        <p className="text-xs text-muted-foreground truncate">{emp.domain}</p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon-xs" aria-label="Acciones">
                          <MoreVertical className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openCompanyPreview(emp);
                          }}
                        >
                          <Eye /> Vista previa
                        </DropdownMenuItem>
                        {hasPermission('empresas.editar') && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              openCompanyEdit(emp);
                            }}
                          >
                            <Pencil /> Editar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {hasPermission('empresas.eliminar') && (
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDeleteCompany(emp);
                            }}
                          >
                            <Trash2 /> Eliminar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <StatusBadge status={emp.displayEtapa as Etapa} />
                    {rubro && (
                      <Badge variant="outline" className="text-xs">{getRubroLabelFromCatalog(rubro, bundle)}</Badge>
                    )}
                    {tipo && (
                      <Badge variant="outline" className="text-xs">Tipo {tipo}</Badge>
                    )}
                    {emp.clienteRecuperado === 'si' && (
                      <Badge variant="secondary" className="text-xs">Recuperado</Badge>
                    )}
                  </div>

                  <div
                    className="mt-3 text-sm text-muted-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EmpresaContactsPopover
                      contactCount={emp.contactCount}
                      preview={emp.contactsPreview}
                      variant="card"
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                      <span>Creación: {formatDateShort(emp.createdAt)}</span>
                      <span>
                        Última interact.: {emp.lastInteractionAt
                          ? formatDateShort(emp.lastInteractionAt)
                          : '—'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {emp.displayAdvisorName ?? '—'}
                    </span>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        </div>
      )}

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
      </GlassCard>

      <NewCompanyWizard
        open={newEmpresaOpen}
        onOpenChange={setNewEmpresaOpen}
        onSubmit={handleNewEmpresaSubmit}
      />

      <ConfirmDialog
        open={batchDeleteDialogOpen}
        onOpenChange={setBatchDeleteDialogOpen}
        title="Eliminar Empresas Seleccionadas"
        description={`¿Estás seguro que deseas eliminar ${selectedDeleteCount} empresa(s)? Esta acción no se puede deshacer.`}
        onConfirm={() => void handleBatchDelete()}
        variant="destructive"
        confirmLabel={
          batchDeleting
            ? 'Eliminando...'
            : `Eliminar ${selectedDeleteCount}`
        }
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setEmpresaToDelete(null);
        }}
        title="Eliminar empresa"
        description={
          empresaToDelete
            ? `¿EStás seguro que deseas eliminar esta empresa? Esta acción no se puede deshacer.`
            : ''
        }
        onConfirm={() => void handleConfirmDeleteEmpresa()}
        variant="destructive"
      />

      <CompanyPreviewSheet
        row={previewEmpresa}
        open={previewEmpresa !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewEmpresa(null);
        }}
        onOpenFullDetail={() => {
          const e = previewEmpresa;
          setPreviewEmpresa(null);
          if (e) openCompanyDetail(e);
        }}
        onEdit={() => {
          const e = previewEmpresa;
          setPreviewEmpresa(null);
          if (e) openCompanyEdit(e);
        }}
      />

      <CompanyEditDialog
        row={editEmpresa}
        open={editEmpresa !== null}
        onOpenChange={(open) => {
          if (!open) setEditEmpresa(null);
        }}
        onSave={handleSaveCompanyFromList}
      />
    </div>
  );
}
