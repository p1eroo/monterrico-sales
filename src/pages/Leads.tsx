import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus, Search, Grid3X3, List, MoreHorizontal,
  Eye, Pencil, Trash2, X, ArrowUpDown,
  Phone, Mail, Building2, DollarSign, Users, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { LeadPriority, LeadSource, CompanyRubro, CompanyTipo } from '@/types';
import { users, leadSourceLabels, etapaLabels, priorityLabels, companyRubroLabels, companyTipoLabels } from '@/data/mock';
import { useCRMStore } from '@/store/crmStore';
import { getPrimaryCompany } from '@/lib/utils';

import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

const ITEMS_PER_PAGE = 8;

const etapaTabs: { value: string; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  ...Object.entries(etapaLabels).map(([value, label]) => ({ value, label })),
];

const newLeadSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  cargo: z.string().optional(),
  company: z.string().min(2, 'La empresa debe tener al menos 2 caracteres'),
  companyRubro: z.enum(['mineria', 'hoteleria', 'banca', 'construccion', 'salud', 'retail', 'telecomunicaciones', 'educacion', 'energia', 'consultoria', 'diplomatico', 'aviacion', 'consumo_masivo', 'otros'] as const).optional(),
  companyTipo: z.enum(['A', 'B', 'C'] as const).optional(),
  phone: z.string().min(6, 'Ingresa un teléfono válido'),
  email: z.string().email('Ingresa un email válido'),
  source: z.enum(['referido', 'base', 'entorno', 'feria', 'masivo'] as const),
  priority: z.enum(['alta', 'media', 'baja'] as const),
  assignedTo: z.string().min(1, 'Selecciona un asesor'),
  estimatedValue: z.coerce.number().min(0, 'El valor debe ser positivo'),
  notes: z.string().optional(),
});

type NewLeadForm = z.infer<typeof newLeadSchema>;

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
}

export default function LeadsPage() {
  const navigate = useNavigate();
  const { leads, addLead, deleteLead } = useCRMStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [priorityFilter, setPriorityFilter] = useState<string>('todos');
  const [sourceFilter, setSourceFilter] = useState<string>('todos');
  const [rubroFilter, setRubroFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [advisorFilter, setAdvisorFilter] = useState<string>('todos');
  const [activeTab, setActiveTab] = useState('todos');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(1);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);

  const form = useForm<NewLeadForm>({
    resolver: zodResolver(newLeadSchema) as import('react-hook-form').Resolver<NewLeadForm>,
    defaultValues: {
      name: '',
      cargo: '',
      company: '',
      companyRubro: undefined,
      companyTipo: undefined,
      phone: '',
      email: '',
      source: 'base',
      priority: 'media',
      assignedTo: '',
      estimatedValue: 0,
      notes: '',
    },
  });

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const primary = getPrimaryCompany(lead);
      const matchesSearch =
        !search ||
        lead.name.toLowerCase().includes(search.toLowerCase()) ||
        lead.companies?.some((c) => c.name.toLowerCase().includes(search.toLowerCase())) ||
        lead.email.toLowerCase().includes(search.toLowerCase()) ||
        lead.phone.includes(search);

      const matchesTab = activeTab === 'todos' || lead.etapa === activeTab;
      const matchesEtapa = statusFilter === 'todos' || lead.etapa === statusFilter;
      const matchesPriority = priorityFilter === 'todos' || lead.priority === priorityFilter;
      const matchesSource = sourceFilter === 'todos' || lead.source === sourceFilter;
      const matchesRubro = rubroFilter === 'todos' || primary?.rubro === rubroFilter;
      const matchesTipo = tipoFilter === 'todos' || primary?.tipo === tipoFilter;
      const matchesAdvisor = advisorFilter === 'todos' || lead.assignedTo === advisorFilter;

      return matchesSearch && matchesTab && matchesEtapa && matchesPriority && matchesSource && matchesRubro && matchesTipo && matchesAdvisor;
    });
  }, [search, activeTab, statusFilter, priorityFilter, sourceFilter, rubroFilter, tipoFilter, advisorFilter]);

  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
  const paginatedLeads = filteredLeads.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const startIndex = (page - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(page * ITEMS_PER_PAGE, filteredLeads.length);

  const hasActiveFilters = statusFilter !== 'todos' || priorityFilter !== 'todos' || sourceFilter !== 'todos' || rubroFilter !== 'todos' || tipoFilter !== 'todos' || advisorFilter !== 'todos' || search !== '';

  const etapaCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: leads.length };
    for (const lead of leads) {
      counts[lead.etapa] = (counts[lead.etapa] ?? 0) + 1;
    }
    return counts;
  }, [leads]);

  function clearFilters() {
    setSearch('');
    setStatusFilter('todos');
    setPriorityFilter('todos');
    setSourceFilter('todos');
    setRubroFilter('todos');
    setTipoFilter('todos');
    setAdvisorFilter('todos');
    setPage(1);
  }

  function toggleSelectAll() {
    if (selectedLeads.length === paginatedLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(paginatedLeads.map((l) => l.id));
    }
  }

  function toggleSelectLead(id: string) {
    setSelectedLeads((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }

  function handleDelete() {
    if (leadToDelete) {
      deleteLead(leadToDelete);
      toast.success('Lead eliminado correctamente');
      setLeadToDelete(null);
    }
  }

  function onSubmitNewLead(data: NewLeadForm) {
    addLead({
      name: data.name,
      cargo: data.cargo?.trim() || undefined,
      companies: [{ name: data.company, rubro: data.companyRubro, tipo: data.companyTipo, isPrimary: true }],
      phone: data.phone,
      email: data.email,
      source: data.source,
      priority: data.priority,
      assignedTo: data.assignedTo,
      estimatedValue: data.estimatedValue,
      notes: data.notes,
    });
    toast.success(`Lead "${data.name}" creado exitosamente`);
    form.reset();
    setNewLeadOpen(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Leads" description="Gestiona y da seguimiento a tus prospectos de venta">
        <Button onClick={() => setNewLeadOpen(true)}>
          <Plus /> Nuevo Lead
        </Button>
      </PageHeader>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm">
          <Users className="size-3.5" /> Total: {leads.length}
        </Badge>
        {etapaTabs.slice(1).filter((tab) => (etapaCounts[tab.value] ?? 0) > 0).map((tab) => (
          <Badge
            key={tab.value}
            variant="outline"
            className="cursor-pointer gap-1.5 px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            onClick={() => { setActiveTab(tab.value); setPage(1); }}
          >
            {tab.label}: {etapaCounts[tab.value] ?? 0}
          </Badge>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, empresa, email o teléfono..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {Object.entries(etapaLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {Object.entries(priorityLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Fuente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las fuentes</SelectItem>
              {Object.entries(leadSourceLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={rubroFilter} onValueChange={(v) => { setRubroFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Rubro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los rubros</SelectItem>
              {Object.entries(companyRubroLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tipoFilter} onValueChange={(v) => { setTipoFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {Object.entries(companyTipoLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={advisorFilter} onValueChange={(v) => { setAdvisorFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Asesor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los asesores</SelectItem>
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
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); }}>
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          {etapaTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                {etapaCounts[tab.value] ?? 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredLeads.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No se encontraron leads"
              description="Intenta ajustar los filtros o crea un nuevo lead."
              actionLabel="Nuevo Lead"
              onAction={() => setNewLeadOpen(true)}
            />
          ) : viewMode === 'table' ? (
            <LeadsTable
              leads={paginatedLeads}
              selectedLeads={selectedLeads}
              onToggleSelectAll={toggleSelectAll}
              onToggleSelect={toggleSelectLead}
              allSelected={selectedLeads.length === paginatedLeads.length && paginatedLeads.length > 0}
              onView={(id) => navigate(`/leads/${id}`)}
              onDelete={(id) => { setLeadToDelete(id); setDeleteDialogOpen(true); }}
            />
          ) : (
            <LeadsGrid
              leads={paginatedLeads}
              onView={(id) => navigate(`/leads/${id}`)}
              onDelete={(id) => { setLeadToDelete(id); setDeleteDialogOpen(true); }}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {filteredLeads.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIndex}-{endIndex} de {filteredLeads.length} leads
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
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
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* New Lead Dialog */}
      <Dialog open={newLeadOpen} onOpenChange={setNewLeadOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Lead</DialogTitle>
            <DialogDescription>Registra un nuevo prospecto en el sistema.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmitNewLead as (data: NewLeadForm) => void)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre completo *</Label>
                <Input id="name" {...form.register('name')} placeholder="Nombre del contacto" />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo</Label>
                <Input id="cargo" {...form.register('cargo')} placeholder="Ej: Gerente de Compras" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Empresa *</Label>
                <Input id="company" {...form.register('company')} placeholder="Nombre de la empresa" />
                {form.formState.errors.company && (
                  <p className="text-xs text-destructive">{form.formState.errors.company.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Rubro</Label>
                <Select
                  value={form.watch('companyRubro') ?? ''}
                  onValueChange={(v) => form.setValue('companyRubro', v ? (v as CompanyRubro) : undefined)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar rubro" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(companyRubroLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.watch('companyTipo') ?? ''}
                  onValueChange={(v) => form.setValue('companyTipo', v ? (v as CompanyTipo) : undefined)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar tipo (A, B, C)" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(companyTipoLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono *</Label>
                <Input id="phone" {...form.register('phone')} placeholder="+51 999 999 999" />
                {form.formState.errors.phone && (
                  <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" {...form.register('email')} placeholder="email@empresa.com" />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Fuente</Label>
                <Select
                  value={form.watch('source')}
                  onValueChange={(v) => form.setValue('source', v as LeadSource)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(leadSourceLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select
                  value={form.watch('priority')}
                  onValueChange={(v) => form.setValue('priority', v as LeadPriority)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Asesor asignado *</Label>
                <Select
                  value={form.watch('assignedTo')}
                  onValueChange={(v) => form.setValue('assignedTo', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar asesor" />
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
              <div className="space-y-2">
                <Label htmlFor="estimatedValue">Valor estimado (S/)</Label>
                <Input
                  id="estimatedValue"
                  type="number"
                  {...form.register('estimatedValue', { valueAsNumber: true })}
                  placeholder="0"
                />
                {form.formState.errors.estimatedValue && (
                  <p className="text-xs text-destructive">{form.formState.errors.estimatedValue.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                {...form.register('notes')}
                placeholder="Información adicional sobre el lead..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewLeadOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Crear Lead</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar Lead"
        description="¿Estás seguro de que deseas eliminar este lead? Esta acción no se puede deshacer."
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  );
}

/* ─── Table View ─── */

interface LeadsTableProps {
  leads: import('@/types').Lead[];
  selectedLeads: string[];
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}

function LeadsTable({
  leads: data,
  selectedLeads,
  allSelected,
  onToggleSelectAll,
  onToggleSelect,
  onView,
  onDelete,
}: LeadsTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleSelectAll}
              />
            </TableHead>
            <TableHead>
              <button className="flex items-center gap-1 font-medium">
                Nombre <ArrowUpDown className="size-3" />
              </button>
            </TableHead>
            <TableHead className="hidden md:table-cell">Empresa</TableHead>
            <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
            <TableHead className="hidden xl:table-cell">Email</TableHead>
            <TableHead className="hidden lg:table-cell">Fuente</TableHead>
            <TableHead className="hidden xl:table-cell">Rubro</TableHead>
            <TableHead className="hidden xl:table-cell">Tipo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="hidden sm:table-cell">Prioridad</TableHead>
            <TableHead className="hidden xl:table-cell">Asesor</TableHead>
            <TableHead className="hidden md:table-cell">
              <button className="flex items-center gap-1 font-medium">
                Fecha <ArrowUpDown className="size-3" />
              </button>
            </TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((lead) => (
            <TableRow
              key={lead.id}
              className="cursor-pointer"
              onClick={() => onView(lead.id)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedLeads.includes(lead.id)}
                  onCheckedChange={() => onToggleSelect(lead.id)}
                />
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{lead.name}</p>
                  {lead.cargo && <p className="text-xs text-muted-foreground">{lead.cargo}</p>}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">{getPrimaryCompany(lead)?.name ?? '—'}</TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">{lead.phone}</TableCell>
              <TableCell className="hidden xl:table-cell text-muted-foreground">{lead.email}</TableCell>
              <TableCell className="hidden lg:table-cell">
                <Badge variant="outline" className="text-xs">{leadSourceLabels[lead.source]}</Badge>
              </TableCell>
              <TableCell className="hidden xl:table-cell text-muted-foreground">
                {getPrimaryCompany(lead)?.rubro ? companyRubroLabels[getPrimaryCompany(lead)!.rubro!] : '—'}
              </TableCell>
              <TableCell className="hidden xl:table-cell text-muted-foreground">
                {getPrimaryCompany(lead)?.tipo ?? '—'}
              </TableCell>
              <TableCell><StatusBadge status={lead.etapa} /></TableCell>
              <TableCell className="hidden sm:table-cell"><PriorityBadge priority={lead.priority} /></TableCell>
              <TableCell className="hidden xl:table-cell text-muted-foreground">{lead.assignedToName}</TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {new Date(lead.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(lead.id)}>
                      <Eye /> Ver
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onView(lead.id)}>
                      <Pencil /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(lead.id)}>
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

interface LeadsGridProps {
  leads: import('@/types').Lead[];
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}

function LeadsGrid({ leads: data, onView, onDelete }: LeadsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((lead) => (
        <Card
          key={lead.id}
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => onView(lead.id)}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{lead.name}</h3>
                {lead.cargo && <p className="text-xs text-muted-foreground truncate">{lead.cargo}</p>}
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground truncate">
                  <Building2 className="size-3 shrink-0" /> {getPrimaryCompany(lead)?.name ?? '—'}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon-xs">
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onView(lead.id)}>
                    <Eye /> Ver
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(lead.id)}>
                    <Trash2 /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusBadge status={lead.etapa} />
              <PriorityBadge priority={lead.priority} />
              {getPrimaryCompany(lead)?.rubro && (
                <Badge variant="outline" className="text-xs">{companyRubroLabels[getPrimaryCompany(lead)!.rubro!]}</Badge>
              )}
              {getPrimaryCompany(lead)?.tipo && (
                <Badge variant="secondary" className="text-xs">Tipo {getPrimaryCompany(lead)!.tipo}</Badge>
              )}
            </div>

            <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <p className="flex items-center gap-2 truncate">
                <Phone className="size-3 shrink-0" /> {lead.phone}
              </p>
              <p className="flex items-center gap-2 truncate">
                <Mail className="size-3 shrink-0" /> {lead.email}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                <DollarSign className="size-3.5" />
                {formatCurrency(lead.estimatedValue)}
              </span>
              <span className="text-xs text-muted-foreground">{lead.assignedToName}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
