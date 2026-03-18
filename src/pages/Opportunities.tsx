import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus, Search, Grid3X3, List, MoreHorizontal,
  Eye, Pencil, Trash2, X,
  DollarSign, Target, TrendingUp, Trophy,
  Calendar, User,
} from 'lucide-react';
import type { Etapa, OpportunityStatus, Opportunity } from '@/types';
import { users, etapaLabels } from '@/data/mock';
import { useCRMStore } from '@/store/crmStore';
import { getPrimaryCompany } from '@/lib/utils';

import { PageHeader } from '@/components/shared/PageHeader';
import { MetricCard } from '@/components/shared/MetricCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { cn } from '@/lib/utils';

const etapaColors: Record<string, string> = {
  lead: 'bg-slate-100 text-slate-700 border-slate-200',
  contacto: 'bg-blue-100 text-blue-700 border-blue-200',
  reunion_agendada: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  reunion_efectiva: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  propuesta_economica: 'bg-purple-100 text-purple-700 border-purple-200',
  negociacion: 'bg-amber-100 text-amber-700 border-amber-200',
  licitacion: 'bg-amber-100 text-amber-700 border-amber-200',
  licitacion_etapa_final: 'bg-amber-100 text-amber-700 border-amber-200',
  cierre_ganado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  firma_contrato: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  activo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cierre_perdido: 'bg-red-100 text-red-700 border-red-200',
  inactivo: 'bg-gray-100 text-gray-700 border-gray-200',
};

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

const newOpportunitySchema = z.object({
  title: z.string().min(2, 'El título debe tener al menos 2 caracteres'),
  contactId: z.string().optional(),
  amount: z.coerce.number().min(0, 'El monto debe ser positivo'),
  etapa: z.enum(['lead', 'contacto', 'reunion_agendada', 'reunion_efectiva', 'propuesta_economica', 'negociacion', 'licitacion', 'licitacion_etapa_final', 'cierre_ganado', 'firma_contrato', 'activo', 'cierre_perdido', 'inactivo'] as const),
  expectedCloseDate: z.string().min(1, 'Selecciona una fecha'),
  assignedTo: z.string().min(1, 'Selecciona un responsable'),
  description: z.string().optional(),
});

type NewOpportunityForm = z.infer<typeof newOpportunitySchema>;

function formatCurrency(value: number) {
  return `S/ ${value.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

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
    <Badge variant="outline" className={cn('text-[11px] font-medium', etapaColors[etapa] ?? 'bg-gray-100 text-gray-700')}>
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
  const { opportunities, contacts, addOpportunity } = useCRMStore();
  const [search, setSearch] = useState('');
  const [etapaFilter, setEtapaFilter] = useState('todas');
  const [statusFilter, setStatusFilter] = useState('todas');
  const [assigneeFilter, setAssigneeFilter] = useState('todos');
  const [activeTab, setActiveTab] = useState('todas');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  const form = useForm<NewOpportunityForm>({
    resolver: zodResolver(newOpportunitySchema) as import('react-hook-form').Resolver<NewOpportunityForm>,
    defaultValues: {
      title: '',
      contactId: '',
      amount: 0,
      etapa: 'lead',
      expectedCloseDate: '',
      assignedTo: '',
      description: '',
    },
  });

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
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
  }, [search, activeTab, etapaFilter, statusFilter, assigneeFilter]);

  const stats = useMemo(() => {
    const total = opportunities.length;
    const totalValue = opportunities.reduce((sum, o) => sum + o.amount, 0);
    const avgProbability = opportunities.length > 0
      ? Math.round(opportunities.reduce((sum, o) => sum + o.probability, 0) / opportunities.length)
      : 0;
    const wonThisMonth = opportunities.filter((o) => {
      const now = new Date();
      const closeDate = new Date(o.expectedCloseDate);
      return o.status === 'ganada' &&
        closeDate.getMonth() === now.getMonth() &&
        closeDate.getFullYear() === now.getFullYear();
    }).length;

    return { total, totalValue, avgProbability, wonThisMonth };
  }, []);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { todas: opportunities.length };
    for (const opp of opportunities) {
      counts[opp.status] = (counts[opp.status] ?? 0) + 1;
    }
    return counts;
  }, []);

  const hasActiveFilters = etapaFilter !== 'todas' || statusFilter !== 'todas' || assigneeFilter !== 'todos' || search !== '';

  function clearFilters() {
    setSearch('');
    setEtapaFilter('todas');
    setStatusFilter('todas');
    setAssigneeFilter('todos');
  }

  function onSubmit(data: NewOpportunityForm) {
    const contactId = data.contactId && data.contactId !== 'none' ? data.contactId : undefined;
    addOpportunity({
      title: data.title,
      contactId,
      amount: data.amount,
      etapa: data.etapa,
      status: 'abierta',
      expectedCloseDate: data.expectedCloseDate,
      assignedTo: data.assignedTo,
      createdAt: new Date().toISOString().slice(0, 10),
      description: data.description,
    });
    toast.success(`Oportunidad "${data.title}" creada exitosamente`);
    form.reset();
    setNewDialogOpen(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Oportunidades" description="Gestiona el pipeline de ventas y oportunidades comerciales">
        <Button onClick={() => setNewDialogOpen(true)}>
          <Plus /> Nueva Oportunidad
        </Button>
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
            placeholder="Buscar por título, lead o cliente..."
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
              <SelectValue placeholder="Responsable" />
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

      {/* New Opportunity Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Oportunidad</DialogTitle>
            <DialogDescription>Registra una nueva oportunidad de venta en el pipeline.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit as (data: NewOpportunityForm) => void)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">Título *</Label>
                <Input id="title" {...form.register('title')} placeholder="Ej: Servicio Corporativo Empresa X" />
                {form.formState.errors.title && (
                  <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Lead asociado</Label>
                <Select
                  value={form.watch('contactId') ?? ''}
                  onValueChange={(v) => form.setValue('contactId', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin lead</SelectItem>
                    {contacts.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name} - {getPrimaryCompany(l)?.name ?? '—'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Label>Responsable *</Label>
                <Select
                  value={form.watch('assignedTo')}
                  onValueChange={(v) => form.setValue('assignedTo', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter((u) => u.status === 'activo').map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.assignedTo && (
                  <p className="text-xs text-destructive">{form.formState.errors.assignedTo.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                {...form.register('description')}
                placeholder="Detalles adicionales sobre la oportunidad..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewDialogOpen(false)}>
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
            <TableHead>Oportunidad</TableHead>
            <TableHead className="hidden md:table-cell">Lead / Cliente</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead className="hidden sm:table-cell">Probabilidad</TableHead>
            <TableHead className="hidden lg:table-cell">Etapa</TableHead>
            <TableHead className="hidden xl:table-cell">Fecha cierre</TableHead>
            <TableHead className="hidden xl:table-cell">Responsable</TableHead>
            <TableHead className="hidden sm:table-cell">Estado</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((opp) => (
            <TableRow key={opp.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/opportunities/${opp.id}`)}>
              <TableCell>
                <div>
                  <p className="font-medium">{opp.title}</p>
                  <p className="text-xs text-muted-foreground md:hidden">
                    {opp.contactName ?? opp.clientName ?? '—'}
                  </p>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {opp.contactName ?? opp.clientName ?? '—'}
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
                <h3 className="font-semibold leading-tight truncate">{opp.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground truncate">
                  {opp.contactName ?? opp.clientName ?? 'Sin lead asignado'}
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
