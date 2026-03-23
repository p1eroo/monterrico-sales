import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus, Search, Grid3X3, List, MoreHorizontal,
  Eye, Pencil, Trash2, X,
  DollarSign, Target, TrendingUp, Trophy,
  Calendar, User, Building2, ChevronsUpDown,
} from 'lucide-react';
import type { ContactPriority, Etapa, OpportunityStatus, Opportunity } from '@/types';
import { etapaLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { useCRMStore } from '@/store/crmStore';
import { getPrimaryCompany, cn } from '@/lib/utils';

import { PageHeader } from '@/components/shared/PageHeader';
import { MetricCard } from '@/components/shared/MetricCard';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { LinkExistingDialog } from '@/components/shared/LinkExistingDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { etapaColorsWithBorder } from '@/lib/etapaConfig';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { api } from '@/lib/api';
import {
  type ApiOpportunityListRow,
  isLikelyOpportunityCuid,
  mapApiOpportunityToOpportunity,
  opportunityListAll,
} from '@/lib/opportunityApi';
import {
  type ApiContactListRow,
  isLikelyContactCuid,
  mapApiContactRowToContact,
  contactListAll,
} from '@/lib/contactApi';
import { type ApiCompanyRecord, companyListAll } from '@/lib/companyApi';

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

const etapaEnum = z.enum([
  'lead', 'contacto', 'reunion_agendada', 'reunion_efectiva', 'propuesta_economica',
  'negociacion', 'licitacion', 'licitacion_etapa_final', 'cierre_ganado', 'firma_contrato',
  'activo', 'cierre_perdido', 'inactivo',
] as const);

const newOpportunitySchema = z.object({
  title: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  /** Solo vínculo a contacto ya existente (cuid API o id mock local) */
  contactId: z.string().optional(),
  /** Solo vínculo a empresa ya existente en servidor */
  companyId: z.string().optional(),
  amount: z.coerce.number().min(0, 'El monto debe ser positivo'),
  etapa: etapaEnum,
  expectedCloseDate: z.string().min(1, 'Selecciona una fecha'),
  assignedTo: z.string().optional(),
  priority: z.enum(['baja', 'media', 'alta']),
});

type NewOpportunityForm = z.infer<typeof newOpportunitySchema>;

const newOpportunityFormDefaults: NewOpportunityForm = {
  title: '',
  contactId: '',
  companyId: '',
  amount: 0,
  etapa: 'lead',
  expectedCloseDate: '',
  assignedTo: undefined,
  priority: 'media',
};

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
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium', etapaColorsWithBorder[etapa] ?? 'bg-gray-100 text-gray-700')}>
      {etapaLabels[etapa]}
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
  const { opportunities, contacts } = useCRMStore();
  const { users, activeUsers } = useUsers();
  const [apiRows, setApiRows] = useState<ApiOpportunityListRow[]>([]);
  const [apiContactRows, setApiContactRows] = useState<ApiContactListRow[]>([]);

  const loadApiOpportunities = useCallback(async () => {
    try {
      const list = await opportunityListAll();
      setApiRows(list);
    } catch {
      setApiRows([]);
    }
  }, []);

  useEffect(() => {
    void loadApiOpportunities();
  }, [loadApiOpportunities]);

  const loadApiContactsForForm = useCallback(async () => {
    try {
      const list = await contactListAll();
      setApiContactRows(list);
    } catch {
      setApiContactRows([]);
    }
  }, []);

  useEffect(() => {
    void loadApiContactsForForm();
  }, [loadApiContactsForForm]);

  const mergedContactsForForm = useMemo(() => {
    const apiIds = new Set(apiContactRows.map((r) => r.id));
    const fromApi = apiContactRows.map(mapApiContactRowToContact);
    const fromStore = contacts.filter((c) => !apiIds.has(c.id));
    return [...fromApi, ...fromStore];
  }, [apiContactRows, contacts]);

  const mergedOpportunities = useMemo(() => {
    const apiIds = new Set(apiRows.map((r) => r.id));
    const fromApi = apiRows.map(mapApiOpportunityToOpportunity);
    const fromStore = opportunities.filter((o) => !apiIds.has(o.id));
    return [...fromApi, ...fromStore];
  }, [apiRows, opportunities]);

  const [search, setSearch] = useState('');
  const [etapaFilter, setEtapaFilter] = useState('todas');
  const [statusFilter, setStatusFilter] = useState('todas');
  const [assigneeFilter, setAssigneeFilter] = useState('todos');
  const [activeTab, setActiveTab] = useState('todas');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [apiCompanies, setApiCompanies] = useState<ApiCompanyRecord[]>([]);
  const [linkContactOpen, setLinkContactOpen] = useState(false);
  const [linkCompanyOpen, setLinkCompanyOpen] = useState(false);
  const [linkContactSearch, setLinkContactSearch] = useState('');
  const [linkCompanySearch, setLinkCompanySearch] = useState('');
  const [linkContactSelectedIds, setLinkContactSelectedIds] = useState<string[]>([]);
  const [linkCompanySelectedIds, setLinkCompanySelectedIds] = useState<string[]>([]);

  const loadApiCompanies = useCallback(async () => {
    try {
      const list = await companyListAll();
      setApiCompanies(list);
    } catch {
      setApiCompanies([]);
    }
  }, []);

  useEffect(() => {
    void loadApiCompanies();
  }, [loadApiCompanies]);

  const linkContactItems = useMemo(
    () =>
      mergedContactsForForm.map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: getPrimaryCompany(c)?.name,
      })),
    [mergedContactsForForm],
  );

  const linkCompanyItems = useMemo(
    () =>
      apiCompanies.map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: c.ruc ?? undefined,
      })),
    [apiCompanies],
  );

  const form = useForm<NewOpportunityForm>({
    resolver: zodResolver(newOpportunitySchema) as import('react-hook-form').Resolver<NewOpportunityForm>,
    defaultValues: { ...newOpportunityFormDefaults },
  });

  const watchContactId = form.watch('contactId');
  const watchCompanyId = form.watch('companyId');

  const contactLinkedLabel = useMemo(() => {
    if (!watchContactId?.trim()) return null;
    const c = mergedContactsForForm.find((x) => x.id === watchContactId);
    return c
      ? `${c.name} — ${getPrimaryCompany(c)?.name ?? '—'}`
      : `Contacto (${watchContactId.slice(0, 8)}…)`;
  }, [watchContactId, mergedContactsForForm]);

  const companyLinkedLabel = useMemo(() => {
    if (!watchCompanyId?.trim()) return null;
    const c = apiCompanies.find((x) => x.id === watchCompanyId);
    return c?.name ?? `Empresa (${watchCompanyId.slice(0, 8)}…)`;
  }, [watchCompanyId, apiCompanies]);

  const filteredOpportunities = useMemo(() => {
    return mergedOpportunities.filter((opp) => {
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
  }, [mergedOpportunities, search, activeTab, etapaFilter, statusFilter, assigneeFilter]);

  const stats = useMemo(() => {
    const total = mergedOpportunities.length;
    const totalValue = mergedOpportunities.reduce((sum, o) => sum + o.amount, 0);
    const avgProbability = mergedOpportunities.length > 0
      ? Math.round(mergedOpportunities.reduce((sum, o) => sum + o.probability, 0) / mergedOpportunities.length)
      : 0;
    const wonThisMonth = mergedOpportunities.filter((o) => {
      const now = new Date();
      const closeDate = new Date(o.expectedCloseDate);
      return o.status === 'ganada' &&
        closeDate.getMonth() === now.getMonth() &&
        closeDate.getFullYear() === now.getFullYear();
    }).length;

    return { total, totalValue, avgProbability, wonThisMonth };
  }, [mergedOpportunities]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { todas: mergedOpportunities.length };
    for (const opp of mergedOpportunities) {
      counts[opp.status] = (counts[opp.status] ?? 0) + 1;
    }
    return counts;
  }, [mergedOpportunities]);

  const hasActiveFilters = etapaFilter !== 'todas' || statusFilter !== 'todas' || assigneeFilter !== 'todos' || search !== '';

  function clearFilters() {
    setSearch('');
    setEtapaFilter('todas');
    setStatusFilter('todas');
    setAssigneeFilter('todos');
  }

  async function onSubmit(data: NewOpportunityForm) {
    const resolvedContactId = data.contactId?.trim() || undefined;
    const resolvedCompanyId = data.companyId?.trim() || undefined;

    const body: Record<string, unknown> = {
      title: data.title.trim(),
      amount: data.amount,
      etapa: data.etapa,
      status: 'abierta',
      expectedCloseDate: data.expectedCloseDate,
      priority: data.priority,
    };
    if (data.assignedTo && isLikelyOpportunityCuid(data.assignedTo)) {
      body.assignedTo = data.assignedTo;
    }
    if (resolvedContactId && isLikelyContactCuid(resolvedContactId)) {
      body.contactId = resolvedContactId;
    }
    if (resolvedCompanyId && isLikelyContactCuid(resolvedCompanyId)) {
      body.companyId = resolvedCompanyId;
    }
    try {
      await api('/opportunities', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await loadApiOpportunities();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo crear la oportunidad en el servidor',
      );
      return;
    }
    toast.success(`Oportunidad "${data.title.trim()}" creada exitosamente`);
    form.reset({ ...newOpportunityFormDefaults });
    setLinkContactSearch('');
    setLinkCompanySearch('');
    setLinkContactSelectedIds([]);
    setLinkCompanySelectedIds([]);
    setNewDialogOpen(false);
  }

  function handleNewDialogOpenChange(open: boolean) {
    setNewDialogOpen(open);
    if (!open) {
      form.reset({ ...newOpportunityFormDefaults });
      setLinkContactSearch('');
      setLinkCompanySearch('');
      setLinkContactSelectedIds([]);
      setLinkCompanySelectedIds([]);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Oportunidades" description="Gestiona el pipeline de ventas y oportunidades comerciales">
        <div className="flex flex-wrap items-center gap-2">
          {apiRows.length > 0 && (
            <Badge variant="secondary" className="font-normal">
              <Target className="size-3.5" /> {apiRows.length} en servidor
            </Badge>
          )}
          <Button onClick={() => setNewDialogOpen(true)}>
            <Plus /> Nueva Oportunidad
          </Button>
        </div>
      </PageHeader>

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
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, contacto o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={etapaFilter} onValueChange={setEtapaFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las etapas</SelectItem>
                {etapas.map((e) => (
                  <SelectItem key={e} value={e}>{etapaLabels[e]}</SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos</SelectItem>
              {(Object.keys(statusLabels) as OpportunityStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Asesor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" /> Limpiar
            </Button>
          )}

          <div className="ml-auto flex items-center rounded-md border">
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
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          {statusTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
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
            <OpportunitiesTable data={filteredOpportunities} />
          ) : (
            <OpportunitiesGrid data={filteredOpportunities} />
          )}
        </TabsContent>
      </Tabs>

      {/* Info footer */}
      {filteredOpportunities.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filteredOpportunities.length} oportunidad{filteredOpportunities.length !== 1 && 'es'} &middot; Valor:{' '}
            <span className="font-semibold text-foreground">
              {formatCurrency(filteredOpportunities.reduce((s, o) => s + o.amount, 0))}
            </span>
          </span>
        </div>
      )}

      <LinkExistingDialog
        open={linkContactOpen}
        onOpenChange={setLinkContactOpen}
        title="Contacto existente"
        searchPlaceholder="Buscar por nombre o empresa…"
        items={linkContactItems}
        selectedIds={linkContactSelectedIds}
        onSelectionChange={setLinkContactSelectedIds}
        searchValue={linkContactSearch}
        onSearchChange={setLinkContactSearch}
        selectionMode="single"
        confirmLabel="Usar contacto"
        contentClassName="z-[60]"
        onConfirm={() => {
          const id = linkContactSelectedIds[0];
          if (!id) return;
          form.setValue('contactId', id);
          form.clearErrors('contactId');
          setLinkContactOpen(false);
          setLinkContactSearch('');
          setLinkContactSelectedIds([]);
        }}
      />
      <LinkExistingDialog
        open={linkCompanyOpen}
        onOpenChange={setLinkCompanyOpen}
        title="Empresa existente"
        searchPlaceholder="Buscar empresa…"
        items={linkCompanyItems}
        selectedIds={linkCompanySelectedIds}
        onSelectionChange={setLinkCompanySelectedIds}
        searchValue={linkCompanySearch}
        onSearchChange={setLinkCompanySearch}
        selectionMode="single"
        confirmLabel="Usar empresa"
        contentClassName="z-[60]"
        onConfirm={() => {
          const id = linkCompanySelectedIds[0];
          if (!id) return;
          form.setValue('companyId', id);
          form.clearErrors('companyId');
          setLinkCompanyOpen(false);
          setLinkCompanySearch('');
          setLinkCompanySelectedIds([]);
        }}
      />

      {/* New Opportunity Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={handleNewDialogOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Oportunidad</DialogTitle>
            <DialogDescription>Registra una nueva oportunidad de venta en el pipeline.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((d) => void onSubmit(d))}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Nombre *</Label>
                <Input id="title" {...form.register('title')} placeholder="Ej: Servicio Corporativo Empresa X" />
                {form.formState.errors.title && (
                  <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Monto (S/) *</Label>
                <Input
                  id="amount"
                  type="number"
                  {...form.register('amount', { valueAsNumber: true })}
                  placeholder="0"
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Contacto</Label>
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'h-10 w-full justify-start gap-2 px-3 pr-14 font-normal',
                      !contactLinkedLabel && 'text-muted-foreground',
                    )}
                    onClick={() => {
                      setLinkContactSearch('');
                      setLinkContactSelectedIds(watchContactId ? [watchContactId] : []);
                      setLinkContactOpen(true);
                    }}
                  >
                    <User className="size-4 shrink-0 opacity-60" />
                    <span className="min-w-0 flex-1 truncate text-left">
                      {contactLinkedLabel ?? 'Seleccionar contacto…'}
                    </span>
                    <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 size-4 shrink-0 -translate-y-1/2 opacity-50" />
                  </Button>
                  {watchContactId ? (
                    <button
                      type="button"
                      className="absolute right-9 top-1/2 z-[1] -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.setValue('contactId', '');
                      }}
                      aria-label="Quitar contacto"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
                {form.formState.errors.contactId && (
                  <p className="text-xs text-destructive">{form.formState.errors.contactId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Empresa</Label>
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'h-10 w-full justify-start gap-2 px-3 pr-14 font-normal',
                      !companyLinkedLabel && 'text-muted-foreground',
                    )}
                    onClick={() => {
                      setLinkCompanySearch('');
                      setLinkCompanySelectedIds(watchCompanyId ? [watchCompanyId] : []);
                      setLinkCompanyOpen(true);
                    }}
                  >
                    <Building2 className="size-4 shrink-0 opacity-60" />
                    <span className="min-w-0 flex-1 truncate text-left">
                      {companyLinkedLabel ?? 'Seleccionar empresa…'}
                    </span>
                    <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 size-4 shrink-0 -translate-y-1/2 opacity-50" />
                  </Button>
                  {watchCompanyId ? (
                    <button
                      type="button"
                      className="absolute right-9 top-1/2 z-[1] -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.setValue('companyId', '');
                      }}
                      aria-label="Quitar empresa"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
                {form.formState.errors.companyId && (
                  <p className="text-xs text-destructive">{form.formState.errors.companyId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Prioridad *</Label>
                <Select
                  value={form.watch('priority')}
                  onValueChange={(v) => form.setValue('priority', v as ContactPriority)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expectedCloseDate">Fecha estimada de cierre *</Label>
                <Input
                  id="expectedCloseDate"
                  type="date"
                  {...form.register('expectedCloseDate')}
                />
                {form.formState.errors.expectedCloseDate && (
                  <p className="text-xs text-destructive">{form.formState.errors.expectedCloseDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Etapa * (define probabilidad)</Label>
                <Select
                  value={form.watch('etapa')}
                  onValueChange={(v) => form.setValue('etapa', v as Etapa)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {etapas.map((e) => (
                      <SelectItem key={e} value={e}>
                        {etapaLabels[e]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Asesor (servidor)</Label>
                <Select
                  value={form.watch('assignedTo') ?? 'none'}
                  onValueChange={(v) => form.setValue('assignedTo', v === 'none' ? undefined : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin asignar en servidor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar en servidor</SelectItem>
                    {activeUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleNewDialogOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Crear Oportunidad</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Table View ─── */

function OpportunitiesTable({ data }: { data: Opportunity[] }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead className="hidden md:table-cell">Contacto / Cliente</TableHead>
            <TableHead className="hidden lg:table-cell">Prioridad</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead className="hidden sm:table-cell">Probabilidad</TableHead>
            <TableHead className="hidden lg:table-cell">Etapa</TableHead>
            <TableHead className="hidden xl:table-cell">Fecha cierre</TableHead>
            <TableHead className="hidden xl:table-cell">Asesor</TableHead>
            <TableHead className="hidden sm:table-cell">Estado</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((opp) => (
            <TableRow key={opp.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/opportunities/${opp.id}`)}>
              <TableCell>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{opp.title}</p>
                    {isLikelyOpportunityCuid(opp.id) && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        Servidor
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground md:hidden">
                    {opp.contactName ?? opp.clientName ?? '—'}
                  </p>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {opp.contactName ?? opp.clientName ?? '—'}
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
              <TableCell className="hidden xl:table-cell text-muted-foreground">
                {opp.assignedToName}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <OpportunityStatusBadge status={opp.status} />
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/opportunities/${opp.id}`); }}>
                      <Eye /> Ver detalle
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Pencil /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive">
                      <Trash2 /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ─── Card View ─── */

function OpportunitiesGrid({ data }: { data: Opportunity[] }) {
  const navigate = useNavigate();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((opp) => (
        <Card
          key={opp.id}
          className="group cursor-pointer transition-all hover:shadow-md hover:border-[#13944C]/30"
          onClick={() => navigate(`/opportunities/${opp.id}`)}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold leading-tight truncate">{opp.title}</h3>
                  {isLikelyOpportunityCuid(opp.id) && (
                    <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                      Servidor
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground truncate">
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
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/opportunities/${opp.id}`); }}><Eye /> Ver</DropdownMenuItem>
                  <DropdownMenuItem><Pencil /> Editar</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive"><Trash2 /> Eliminar</DropdownMenuItem>
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
            </div>

            <div className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5 truncate">
                <User className="size-3 shrink-0" /> {opp.assignedToName}
              </p>
              <p className="flex items-center gap-1.5">
                <Calendar className="size-3 shrink-0" /> {formatDate(opp.expectedCloseDate)}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
