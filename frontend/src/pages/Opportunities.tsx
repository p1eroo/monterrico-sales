import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus, Search, Grid3X3, List, MoreHorizontal,
  Eye, Pencil, Trash2,
  DollarSign, Target, TrendingUp, Trophy,
  Calendar, X, User, Loader2,
  FileSpreadsheet, Upload, Download, ChevronLeft, ChevronRight,
  Globe, Tag,
} from 'lucide-react';
import type { Etapa, OpportunityStatus, Opportunity } from '@/types';
import { etapaLabels, contactSourceLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { cn } from '@/lib/utils';

import { PageHeader } from '@/components/shared/PageHeader';
import { MetricCard } from '@/components/shared/MetricCard';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import {
  NewOpportunityFormDialog,
  buildOpportunityCreateBody,
  type NewOpportunityFormValues,
} from '@/components/shared/NewOpportunityFormDialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { OpportunityEditDialog } from '@/components/shared/OpportunityEditDialog';
import { OpportunityPreviewSheet } from '@/components/shared/OpportunityPreviewSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getStageBadgeTone } from '@/lib/etapaConfig';
import { useCrmConfigStore, getStageLabelFromCatalog } from '@/store/crmConfigStore';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { api } from '@/lib/api';
import { opportunityDetailHref } from '@/lib/detailRoutes';
import {
  type ApiOpportunityListRow,
  isLikelyOpportunityCuid,
  mapApiOpportunityToOpportunity,
  opportunityListAll,
} from '@/lib/opportunityApi';
import { buildOptimisticOpportunity } from '@/lib/optimisticEntities';
import {
  generateOptimisticId,
  useOptimisticCrmStore,
} from '@/store/optimisticCrmStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useCrmTeamAdvisorFilter } from '@/hooks/useCrmTeamAdvisorFilter';
import {
  downloadImportExportCsv,
  startImportJob,
} from '@/lib/importExportApi';
import { IMPORT_SPREADSHEET_ACCEPT } from '@/lib/importSpreadsheet';
import { useImportJobsStore } from '@/store/importJobsStore';
import {
  CrmDataTableSkeleton,
  CrmEntityCardGridSkeleton,
  CrmFilterBarSkeleton,
  CrmStatCardsSkeleton,
  CrmTabsBarSkeleton,
} from '@/components/shared/CrmListPageSkeleton';

const OPPORTUNITIES_TABLE_SKELETON_COLUMNS = [
  { label: 'Nombre', className: 'min-w-0 max-w-[20rem]' },
  { label: 'Contacto / Cliente', className: 'hidden min-w-0 max-w-[16rem] md:table-cell' },
  { label: 'Fuente', className: 'hidden min-w-[6.5rem] sm:table-cell' },
  { label: 'Prioridad', className: 'hidden lg:table-cell' },
  { label: 'Monto' },
  { label: 'Probabilidad', className: 'hidden sm:table-cell' },
  { label: 'Etapa', className: 'hidden lg:table-cell' },
  { label: 'Fecha cierre', className: 'hidden xl:table-cell' },
  { label: 'Asesor', className: 'hidden min-w-0 max-w-[10rem] xl:table-cell' },
  { label: 'Estado', className: 'hidden sm:table-cell' },
  { label: '', className: 'w-10' },
];

const statusLabels: Record<OpportunityStatus, string> = {
  abierta: 'Abierta',
  ganada: 'Ganada',
  perdida: 'Perdida',
  suspendida: 'Suspendida',
};

const statusColors: Record<OpportunityStatus, string> = {
  abierta: 'bg-blue-100 text-blue-700 border-blue-200',
  ganada: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  perdida: 'bg-red-100 text-red-700 border-red-200',
  suspendida: 'bg-gray-100 text-gray-700 border-gray-200',
};

const statusTabs = [
  { value: 'todas', label: 'Todas' },
  { value: 'abierta', label: 'Abiertas' },
  { value: 'ganada', label: 'Ganadas' },
  { value: 'perdida', label: 'Perdidas' },
] as const;

const etapas: Etapa[] = [
  'lead', 'contacto', 'reunion_agendada', 'reunion_efectiva', 'propuesta_economica',
  'negociacion', 'licitacion', 'licitacion_etapa_final', 'cierre_ganado', 'firma_contrato',
  'activo', 'cierre_perdido', 'inactivo',
];

const OPPORTUNITIES_PER_PAGE = 20;

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

function OpportunityStatusBadge({ status }: { status: OpportunityStatus }) {
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium', statusColors[status])}>
      {statusLabels[status]}
    </Badge>
  );
}

export default function OpportunitiesPage() {
  const { activeAdvisors } = useUsers();
  const pendingOpportunities = useOptimisticCrmStore((s) => s.pendingOpportunities);
  const addPendingOpportunity = useOptimisticCrmStore((s) => s.addPendingOpportunity);
  const removePendingOpportunity = useOptimisticCrmStore((s) => s.removePendingOpportunity);
  const isPendingOpportunityId = useOptimisticCrmStore((s) => s.isPendingOpportunityId);
  const [apiRows, setApiRows] = useState<ApiOpportunityListRow[]>([]);
  /** Solo primera carga: evita vacío confundido con “sin oportunidades” y no tapa el listado en refetch. */
  const [initialOppLoad, setInitialOppLoad] = useState(true);

  const loadApiOpportunities = useCallback(async () => {
    try {
      const list = await opportunityListAll();
      setApiRows(list);
    } catch {
      setApiRows([]);
    } finally {
      setInitialOppLoad(false);
    }
  }, []);

  useEffect(() => {
    void loadApiOpportunities();
  }, [loadApiOpportunities]);

  const apiOpportunities = useMemo(
    () => apiRows.map(mapApiOpportunityToOpportunity),
    [apiRows],
  );

  const allOpportunities = useMemo(() => {
    const apiIds = new Set(apiOpportunities.map((o) => o.id));
    const pending = pendingOpportunities.filter((o) => !apiIds.has(o.id));
    return [...pending, ...apiOpportunities];
  }, [apiOpportunities, pendingOpportunities]);

  const navigate = useNavigate();

  function openOpportunityDetail(opp: Opportunity) {
    if (isPendingOpportunityId(opp.id)) {
      toast.info('Guardando oportunidad en el servidor…');
      return;
    }
    navigate(opportunityDetailHref(opp));
  }

  const [search, setSearch] = useState('');
  const [etapaFilter, setEtapaFilter] = useState('todas');
  const [statusFilter, setStatusFilter] = useState('todas');
  const [assigneeFilter, setAssigneeFilter] = useState('todos');
  const [page, setPage] = useState(1);
  const { canSeeAllAdvisors, currentUserId } = useCrmTeamAdvisorFilter(
    assigneeFilter,
    setAssigneeFilter,
    'todos',
  );
  const [activeTab, setActiveTab] = useState('todas');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'cards';
    return 'table';
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
    void loadApiOpportunities();
  }, [loadApiOpportunities, opportunityImportCompletionTick]);

  const filteredOpportunities = useMemo(() => {
    return allOpportunities.filter((opp) => {
      const matchesSearch =
        !search ||
        opp.title.toLowerCase().includes(search.toLowerCase()) ||
        opp.contactName?.toLowerCase().includes(search.toLowerCase()) ||
        opp.clientName?.toLowerCase().includes(search.toLowerCase());

      const matchesTab = activeTab === 'todas' || opp.status === activeTab;
      const matchesEtapa = etapaFilter === 'todas' || opp.etapa === etapaFilter;
      const matchesStatus = statusFilter === 'todas' || opp.status === statusFilter;
      const matchesAssignee = assigneeFilter === 'todos' || opp.assignedTo === assigneeFilter;

      return matchesSearch && matchesTab && matchesEtapa && matchesStatus && matchesAssignee;
    });
  }, [allOpportunities, search, activeTab, etapaFilter, statusFilter, assigneeFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, activeTab, etapaFilter, statusFilter, assigneeFilter, viewMode]);

  const totalFiltered = filteredOpportunities.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / OPPORTUNITIES_PER_PAGE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const start = (page - 1) * OPPORTUNITIES_PER_PAGE;
  const displayedOpportunities = useMemo(
    () => filteredOpportunities.slice(start, start + OPPORTUNITIES_PER_PAGE),
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
    const wonThisMonth = allOpportunities.filter((o) => {
      const now = new Date();
      const closeRaw = (o.expectedCloseDate ?? '').trim();
      const closeDate = /^\d{4}-\d{2}-\d{2}$/.test(closeRaw)
        ? new Date(`${closeRaw}T00:00:00`)
        : new Date(o.expectedCloseDate);
      return o.status === 'ganada' &&
        closeDate.getMonth() === now.getMonth() &&
        closeDate.getFullYear() === now.getFullYear();
    }).length;

    return { total, totalValue, avgProbability, wonThisMonth };
  }, [allOpportunities]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { todas: allOpportunities.length };
    for (const opp of allOpportunities) {
      counts[opp.status] = (counts[opp.status] ?? 0) + 1;
    }
    return counts;
  }, [allOpportunities]);

  const assigneeFilterIsActive = canSeeAllAdvisors
    ? assigneeFilter !== 'todos'
    : false;
  const hasActiveFilters =
    etapaFilter !== 'todas' ||
    statusFilter !== 'todas' ||
    assigneeFilterIsActive ||
    search !== '';

  function clearFilters() {
    setSearch('');
    setEtapaFilter('todas');
    setStatusFilter('todas');
    setAssigneeFilter(canSeeAllAdvisors ? 'todos' : currentUserId);
  }

  async function handleCreateOpportunity(data: NewOpportunityFormValues) {
    const body = buildOpportunityCreateBody(data);
    const optId = generateOptimisticId('o');
    addPendingOpportunity(buildOptimisticOpportunity(optId, data));
    try {
      await api('/opportunities', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (e) {
      removePendingOpportunity(optId);
      toast.error(
        e instanceof Error ? e.message : 'No se pudo crear la oportunidad en el servidor',
      );
      throw e;
    }
    removePendingOpportunity(optId);
    await loadApiOpportunities();
    toast.success(`Oportunidad "${data.title.trim()}" creada exitosamente`);
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
      await downloadImportExportCsv('opportunities', 'export');
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
      toast.info('Guardando oportunidad en el servidor…');
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
      toast.error('Solo se pueden editar oportunidades guardadas en el servidor');
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
        toast.error('Solo se pueden eliminar oportunidades guardadas en el servidor');
        return;
      }
      await api(`/opportunities/${oppToDelete.id}`, { method: 'DELETE' });
      await loadApiOpportunities();
      toast.success('Oportunidad eliminada correctamente');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
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
        <span className="mr-2 text-sm text-muted-foreground">Total: {allOpportunities.length}</span>
        {hasPermission('oportunidades.exportar') && (
            <Button
              variant="outline"
              disabled={exportBusy}
              onClick={() => void handleOppTemplate()}
              className="bg-card"
            >
              {exportBusy ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}{' '}
              Plantilla
            </Button>
          )}
          {hasPermission('oportunidades.crear') && (
            <Button variant="outline" disabled={importBusy} onClick={openOppImport} className="bg-card">
              {importBusy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{' '}
              Importar
            </Button>
          )}
          {hasPermission('oportunidades.exportar') && (
            <Button
              variant="outline"
              disabled={exportBusy}
              onClick={() => void handleOppExport()}
              className="bg-card"
            >
              {exportBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}{' '}
              Exportar
            </Button>
          )}
          <Button onClick={() => setNewDialogOpen(true)}>
            <Plus /> Nueva Oportunidad
          </Button>
        </PageHeader>

      {initialOppLoad ? (
        <div
          className="space-y-6"
          aria-busy="true"
          aria-live="polite"
          aria-label="Cargando oportunidades"
        >
          <CrmStatCardsSkeleton count={4} />
          <CrmFilterBarSkeleton />
          <div className="space-y-3">
            <CrmTabsBarSkeleton tabCount={4} />
            <div>
              {viewMode === 'table' ? (
                <CrmDataTableSkeleton
                  columns={[...OPPORTUNITIES_TABLE_SKELETON_COLUMNS]}
                  rows={10}
                  aria-label="Cargando lista de oportunidades"
                  roundedClass="rounded-lg"
                  className="bg-card"
                />
              ) : (
                <CrmEntityCardGridSkeleton count={8} aria-label="Cargando tarjetas de oportunidades" />
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total oportunidades"
          value={stats.total}
          icon={Target}
          change="+3"
          changeType="positive"
          description="este mes"
        />
        <MetricCard
          title="Valor total"
          value={formatCurrency(stats.totalValue)}
          icon={DollarSign}
          changeType="positive"
          change="+12%"
          description="vs mes anterior"
        />
        <MetricCard
          title="Tasa promedio de cierre"
          value={`${stats.avgProbability}%`}
          icon={TrendingUp}
          change="+5%"
          changeType="positive"
          description="tendencia"
        />
        <MetricCard
          title="Ganadas este mes"
          value={stats.wonThisMonth}
          icon={Trophy}
          changeType="positive"
          change={`${stats.wonThisMonth}`}
          description="cerradas"
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-[580px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, contacto o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <Select value={etapaFilter} onValueChange={setEtapaFilter}>
            <SelectTrigger className="h-9 w-auto rounded-md border-input bg-card shadow-none">
              <div className="flex items-center gap-1.5">
                <Tag className="size-3.5" />
                <SelectValue placeholder="Etapa" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Etapas</SelectItem>
              {etapas.map((e) => (
                <SelectItem key={e} value={e}>{etapaLabels[e]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-auto rounded-md border-input bg-card shadow-none">
              <div className="flex items-center gap-1.5">
                <Globe className="size-3.5" />
                <SelectValue placeholder="Estado" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Estados</SelectItem>
              {(Object.keys(statusLabels) as OpportunityStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={assigneeFilter}
            onValueChange={setAssigneeFilter}
            disabled={!canSeeAllAdvisors}
          >
            <SelectTrigger className="h-9 w-auto rounded-md border-input bg-card shadow-none">
              <div className="flex items-center gap-1.5">
                <User className="size-3.5" />
                <SelectValue placeholder="Asesor" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Asesores</SelectItem>
              {activeAdvisors.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" /> Limpiar
            </Button>
          )}

<div className="ml-auto hidden md:flex items-center rounded-md border bg-card">
  <Button
    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
    size="icon-sm"
    onClick={() => setViewMode('table')}
    className="rounded-r-none"
  >
    <List className="size-4" />
  </Button>
  <Button
    variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
    size="icon-sm"
    onClick={() => setViewMode('cards')}
    className="rounded-l-none"
  >
    <Grid3X3 className="size-4" />
  </Button>
</div>
        </div>
      </div>

      {/* Tabs & Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList
          variant="line"
          className="w-full flex-nowrap gap-1 p-0"
        >
          {statusTabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="min-w-0 flex-1 basis-0 overflow-hidden px-1.5 sm:px-2"
            >
              <span className="min-w-0 truncate">{tab.label}</span>
              <Badge
                variant="secondary"
                className="ml-1 shrink-0 px-1.5 py-0 text-xs max-sm:ml-0.5 max-sm:px-1"
              >
                {tabCounts[tab.value] ?? 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredOpportunities.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Target className="mb-4 size-12 text-muted-foreground/40" />
                <h3 className="text-lg font-semibold">No se encontraron oportunidades</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Intenta ajustar los filtros o crea una nueva oportunidad.
                </p>
                <Button className="mt-4" onClick={() => setNewDialogOpen(true)}>
                  <Plus /> Nueva Oportunidad
                </Button>
              </CardContent>
            </Card>
          ) : viewMode === 'table' ? (
            <OpportunitiesTable
              data={displayedOpportunities}
              isPendingOpportunityId={isPendingOpportunityId}
              onOpenDetail={openOpportunityDetail}
              onOpenPreview={openOpportunityPreview}
              onOpenEdit={openOpportunityEdit}
              onRequestDelete={requestDeleteOpportunity}
              canEdit={hasPermission('oportunidades.editar')}
              canDelete={hasPermission('oportunidades.eliminar')}
            />
          ) : (
            <OpportunitiesGrid
              data={displayedOpportunities}
              isPendingOpportunityId={isPendingOpportunityId}
              onOpenDetail={openOpportunityDetail}
              onOpenPreview={openOpportunityPreview}
              onOpenEdit={openOpportunityEdit}
              onRequestDelete={requestDeleteOpportunity}
              canEdit={hasPermission('oportunidades.editar')}
              canDelete={hasPermission('oportunidades.eliminar')}
            />
          )}
        </TabsContent>
      </Tabs>
        </>
      )}

      {/* Pagination */}
      {filteredOpportunities.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIndex}-{endIndex} de {filteredOpportunities.length} oportunidad
            {filteredOpportunities.length !== 1 ? 'es' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-card"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" /> Anterior
            </Button>
            <span className="px-2 text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="bg-card"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

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
        onSaved={() => void loadApiOpportunities()}
      />
    </div>
  );
}

/* ─── Table View ─── */

function OpportunitiesTable({
  data,
  isPendingOpportunityId,
  onOpenDetail,
  onOpenPreview,
  onOpenEdit,
  onRequestDelete,
  canEdit,
  canDelete,
}: {
  data: Opportunity[];
  isPendingOpportunityId: (id: string) => boolean;
  onOpenDetail: (opp: Opportunity) => void;
  onOpenPreview: (opp: Opportunity) => void;
  onOpenEdit: (opp: Opportunity) => void;
  onRequestDelete: (opp: Opportunity) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-0 max-w-[20rem]">Nombre</TableHead>
            <TableHead className="hidden min-w-0 max-w-[16rem] md:table-cell">
              Contacto / Cliente
            </TableHead>
            <TableHead className="hidden min-w-[6.5rem] sm:table-cell">Fuente</TableHead>
            <TableHead className="hidden lg:table-cell">Prioridad</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead className="hidden sm:table-cell">Probabilidad</TableHead>
            <TableHead className="hidden lg:table-cell">Etapa</TableHead>
            <TableHead className="hidden xl:table-cell">Fecha cierre</TableHead>
            <TableHead className="hidden min-w-0 max-w-[10rem] xl:table-cell">
              Asesor
            </TableHead>
            <TableHead className="hidden sm:table-cell">Estado</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((opp) => {
            const pending = isPendingOpportunityId(opp.id);
            const contactClientLabel =
              opp.contactName ?? opp.clientName ?? '—';
            return (
            <TableRow
              key={opp.id}
              className={pending ? 'group bg-muted/40' : 'group cursor-pointer hover:bg-muted/50'}
              onClick={() => onOpenDetail(opp)}
            >
              <TableCell className="min-w-0 max-w-[20rem] whitespace-normal align-top">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <p
                      className="min-w-0 flex-1 truncate font-medium"
                      title={opp.title}
                    >
                      {opp.title}
                    </p>
                    {pending && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 gap-1 font-normal"
                      >
                        <Loader2 className="size-3 animate-spin" />
                        Guardando…
                      </Badge>
                    )}
                  </div>
                  <p
                    className="truncate text-xs text-muted-foreground md:hidden"
                    title={contactClientLabel !== '—' ? contactClientLabel : undefined}
                  >
                    {contactClientLabel}
                  </p>
                  <p className="truncate text-xs text-muted-foreground/90 sm:hidden">
                    {contactSourceLabels[opp.fuente ?? 'base'] ?? opp.fuente}
                  </p>
                </div>
              </TableCell>
              <TableCell className="hidden min-w-0 max-w-[16rem] whitespace-normal md:table-cell align-top text-muted-foreground">
                <span
                  className="block truncate"
                  title={contactClientLabel !== '—' ? contactClientLabel : undefined}
                >
                  {contactClientLabel}
                </span>
              </TableCell>
              <TableCell className="hidden min-w-[6.5rem] sm:table-cell align-top text-muted-foreground">
                <span className="text-sm">
                  {contactSourceLabels[opp.fuente ?? 'base'] ?? opp.fuente ?? '—'}
                </span>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <PriorityBadge priority={opp.priority ?? 'media'} />
              </TableCell>
              <TableCell className="font-semibold tabular-nums">
                {formatCurrency(opp.amount)}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <ProbabilityBar value={opp.probability} />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <EtapaBadge etapa={opp.etapa} />
              </TableCell>
              <TableCell className="hidden xl:table-cell text-muted-foreground">
                {formatDate(opp.expectedCloseDate)}
              </TableCell>
              <TableCell className="hidden min-w-0 max-w-[10rem] whitespace-normal xl:table-cell align-top text-muted-foreground">
                <span className="block truncate" title={opp.assignedToName}>
                  {opp.assignedToName}
                </span>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <OpportunityStatusBadge status={opp.status} />
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Acciones">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onOpenPreview(opp)}>
                      <Eye /> Vista previa
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onOpenEdit(opp)}
                      disabled={!canEdit || pending}
                    >
                      <Pencil /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onRequestDelete(opp)}
                      disabled={!canDelete || pending}
                    >
                      <Trash2 /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/* ─── Card View ─── */

function OpportunitiesGrid({
  data,
  isPendingOpportunityId,
  onOpenDetail,
  onOpenPreview,
  onOpenEdit,
  onRequestDelete,
  canEdit,
  canDelete,
}: {
  data: Opportunity[];
  isPendingOpportunityId: (id: string) => boolean;
  onOpenDetail: (opp: Opportunity) => void;
  onOpenPreview: (opp: Opportunity) => void;
  onOpenEdit: (opp: Opportunity) => void;
  onRequestDelete: (opp: Opportunity) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="grid w-full grid-cols-1 gap-3 px-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((opp) => {
        const pending = isPendingOpportunityId(opp.id);
        return (
<Card
              key={opp.id}
              className={
                pending
                  ? 'group gap-0 max-w-full overflow-hidden border-dashed bg-muted/30 py-0'
                  : 'group cursor-pointer gap-0 max-w-full overflow-hidden py-0 transition-all hover:shadow-md hover:border-[#13944C]/30'
              }
              onClick={() => onOpenDetail(opp)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h3
                    className="min-w-0 flex-1 truncate font-semibold leading-tight"
                    title={opp.title}
                  >
                    {opp.title}
                  </h3>
                  {pending && (
                    <Badge variant="secondary" className="shrink-0 gap-1 text-[10px] font-normal">
                      <Loader2 className="size-3 animate-spin" />
                      Guardando…
                    </Badge>
                  )}
                </div>
                <p
                  className="mt-1 truncate text-xs text-muted-foreground"
                  title={
                    opp.contactName ?? opp.clientName ?? 'Sin contacto asignado'
                  }
                >
                  {opp.contactName ?? opp.clientName ?? 'Sin contacto asignado'}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon-xs">
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenPreview(opp); }}>
                    <Eye /> Vista previa
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!canEdit || pending}
                    onClick={(e) => { e.stopPropagation(); onOpenEdit(opp); }}
                  >
                    <Pencil /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={!canDelete || pending}
                    onClick={(e) => { e.stopPropagation(); onRequestDelete(opp); }}
                  >
                    <Trash2 /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className="mt-3 text-2xl font-bold tracking-tight text-[#13944C]">
              {formatCurrency(opp.amount)}
            </p>

            <div className="mt-3">
              <ProbabilityBar value={opp.probability} />
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <PriorityBadge priority={opp.priority ?? 'media'} />
              <EtapaBadge etapa={opp.etapa} />
              <OpportunityStatusBadge status={opp.status} />
              <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
                {contactSourceLabels[opp.fuente ?? 'base'] ?? opp.fuente}
              </Badge>
            </div>

            <div className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
              <p
                className="flex min-w-0 items-center gap-1.5 truncate"
                title={opp.assignedToName}
              >
                <User className="size-3 shrink-0" />{' '}
                <span className="min-w-0 truncate">{opp.assignedToName}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <Calendar className="size-3 shrink-0" /> {formatDate(opp.expectedCloseDate)}
              </p>
            </div>
          </CardContent>
        </Card>
      );
      })}
    </div>
  );
}
