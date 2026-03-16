import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus, Search, Grid3X3, List, MoreHorizontal,
  Eye, Pencil, Trash2, X, ArrowUpDown,
  Phone, Mail, Building2, DollarSign, Users, ChevronLeft, ChevronRight, Check,
  Upload, Download, FileSpreadsheet,
} from 'lucide-react';
import type { LeadPriority, LeadSource, Etapa } from '@/types';
import { users, leadSourceLabels, etapaLabels, priorityLabels } from '@/data/mock';
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
  { value: 'lead', label: 'Lead' },
  { value: 'contacto', label: 'Contacto' },
  { value: 'reunion_agendada', label: 'Reunión Agendada' },
  { value: 'reunion_efectiva', label: 'Reunión Efectiva' },
  { value: 'propuesta_economica', label: 'Propuesta Económica' },
  { value: 'negociacion', label: 'Negociación' },
  { value: 'licitacion', label: 'Licitación' },
  { value: 'licitacion_etapa_final', label: 'Licitación Etapa Final' },
  { value: 'cierre_ganado', label: 'Cierre Ganado' },
  { value: 'firma_contrato', label: 'Firma de Contrato' },
  { value: 'activo', label: 'Activo' },
  { value: 'cierre_perdido', label: 'Cierre Perdido' },
  { value: 'inactivo', label: 'Inactivo' },
];

const newLeadSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  cargo: z.string().optional(),
  docType: z.enum(['dni', 'cee'] as const).optional(),
  docNumber: z.string().optional(),
  company: z.string().min(2, 'La empresa debe tener al menos 2 caracteres'),
  phone: z.string().min(6, 'Ingresa un teléfono válido'),
  email: z.string().email('Ingresa un email válido'),
  source: z.enum(['referido', 'base', 'entorno', 'feria', 'masivo'] as const),
  priority: z.enum(['alta', 'media', 'baja'] as const),
  assignedTo: z.string().min(1, 'Selecciona un asesor'),
  etapaCiclo: z.enum(['lead', 'contacto', 'reunion_agendada', 'reunion_efectiva', 'propuesta_economica', 'negociacion', 'licitacion', 'licitacion_etapa_final', 'cierre_ganado', 'firma_contrato', 'activo', 'cierre_perdido', 'inactivo'] as const),
  estimatedValue: z.coerce.number().min(0, 'El valor debe ser positivo'),
  departamento: z.string().optional(),
  provincia: z.string().optional(),
  distrito: z.string().optional(),
  direccion: z.string().optional(),
  notes: z.string().optional(),
});

type NewLeadForm = z.infer<typeof newLeadSchema>;

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
}

export default function ContactosPage() {
  const navigate = useNavigate();
  const { leads, addLead, deleteLead } = useCRMStore();

  const [search, setSearch] = useState('');
  const [etapaFilter, setEtapaFilter] = useState<string>('todos');
  const [priorityFilter, setPriorityFilter] = useState<string>('todos');
  const [sourceFilter, setSourceFilter] = useState<string>('todos');
  const [advisorFilter, setAdvisorFilter] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(1);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);

  const form = useForm<NewLeadForm>({
    resolver: zodResolver(newLeadSchema) as import('react-hook-form').Resolver<NewLeadForm>,
    defaultValues: {
      name: '',
      cargo: '',
      docType: undefined,
      docNumber: '',
      company: '',
      phone: '',
      email: '',
      source: 'base',
      priority: 'media',
      assignedTo: '',
      etapaCiclo: 'lead',
      estimatedValue: 0,
      departamento: '',
      provincia: '',
      distrito: '',
      direccion: '',
      notes: '',
    },
  });

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        !search ||
        lead.name.toLowerCase().includes(search.toLowerCase()) ||
        lead.cargo?.toLowerCase().includes(search.toLowerCase()) ||
        lead.companies?.some((c) => c.name.toLowerCase().includes(search.toLowerCase())) ||
        lead.email.toLowerCase().includes(search.toLowerCase()) ||
        lead.phone.includes(search);

      const matchesEtapa = etapaFilter === 'todos' || lead.etapa === etapaFilter;
      const matchesPriority = priorityFilter === 'todos' || lead.priority === priorityFilter;
      const matchesSource = sourceFilter === 'todos' || lead.source === sourceFilter;
      const matchesAdvisor = advisorFilter === 'todos' || lead.assignedTo === advisorFilter;

      return matchesSearch && matchesEtapa && matchesPriority && matchesSource && matchesAdvisor;
    });
  }, [search, etapaFilter, priorityFilter, sourceFilter, advisorFilter]);

  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
  const paginatedLeads = filteredLeads.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const startIndex = (page - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(page * ITEMS_PER_PAGE, filteredLeads.length);

  const hasActiveFilters = etapaFilter !== 'todos' || priorityFilter !== 'todos' || sourceFilter !== 'todos' || advisorFilter !== 'todos' || search !== '';

  const etapaCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: leads.length };
    for (const lead of leads) {
      counts[lead.etapa] = (counts[lead.etapa] ?? 0) + 1;
    }
    return counts;
  }, [leads]);

  function clearFilters() {
    setSearch('');
    setEtapaFilter('todos');
    setPriorityFilter('todos');
    setSourceFilter('todos');
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
      toast.success('Contacto eliminado correctamente');
      setLeadToDelete(null);
    }
  }

  const wizardSteps = [
    { label: 'Identificación', fields: ['name', 'company', 'phone', 'email'] as const },
    { label: 'Comercial', fields: ['assignedTo'] as const },
    { label: 'Ubicación', fields: [] as const },
  ];

  async function handleNextStep(e: React.MouseEvent) {
    e.preventDefault();
    const valid = await form.trigger(wizardSteps[wizardStep].fields as unknown as (keyof NewLeadForm)[]);
    if (valid) setWizardStep((s) => Math.min(s + 1, 2));
  }

  async function handleWizardSubmit(e: React.MouseEvent) {
    e.preventDefault();
    const valid = await form.trigger();
    if (valid) {
      onSubmitNewLead(form.getValues());
    }
  }

  function onSubmitNewLead(data: NewLeadForm) {
    addLead({
      name: data.name,
      cargo: data.cargo?.trim() || undefined,
      companies: [{ name: data.company, isPrimary: true }],
      phone: data.phone,
      email: data.email,
      source: data.source,
      priority: data.priority,
      assignedTo: data.assignedTo,
      estimatedValue: data.estimatedValue,
      notes: data.notes,
    });
    toast.success(`Contacto "${data.name}" creado exitosamente`);
    form.reset();
    setWizardStep(0);
    setNewLeadOpen(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Contactos" description="Gestiona y da seguimiento a tus prospectos de venta">
        <Button variant="outline" size="sm" onClick={() => toast.info('Descargando plantilla...')}>
          <FileSpreadsheet className="size-4" /> Plantilla
        </Button>
        <Button variant="outline" size="sm" onClick={() => toast.info('Selecciona un archivo para importar')}>
          <Upload className="size-4" /> Importar
        </Button>
        <Button variant="outline" size="sm" onClick={() => toast.info('Exportando contactos...')}>
          <Download className="size-4" /> Exportar
        </Button>
        <Button onClick={() => setNewLeadOpen(true)}>
          <Plus /> Nuevo Contacto
        </Button>
      </PageHeader>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={etapaFilter === 'todos' ? 'secondary' : 'outline'}
          className="cursor-pointer gap-1.5 px-3 py-1.5 text-sm transition-colors hover:bg-accent"
          onClick={() => { setEtapaFilter('todos'); setPage(1); }}
        >
          <Users className="size-3.5" /> Total: {leads.length}
        </Badge>
        {etapaTabs.slice(1).filter((tab) => (etapaCounts[tab.value] ?? 0) > 0).map((tab) => (
          <Badge
            key={tab.value}
            variant={etapaFilter === tab.value ? 'secondary' : 'outline'}
            className="cursor-pointer gap-1.5 px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            onClick={() => { setEtapaFilter(tab.value); setPage(1); }}
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

          <Select value={etapaFilter} onValueChange={(v) => { setEtapaFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las etapas</SelectItem>
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

      {/* Content */}
      <div className="mt-4">
        {filteredLeads.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No se encontraron contactos"
            description="Intenta ajustar los filtros o crea un nuevo contacto."
            actionLabel="Nuevo Contacto"
            onAction={() => setNewLeadOpen(true)}
          />
        ) : viewMode === 'table' ? (
          <LeadsTable
            leads={paginatedLeads}
            selectedLeads={selectedLeads}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelectLead}
            allSelected={selectedLeads.length === paginatedLeads.length && paginatedLeads.length > 0}
            onView={(id) => navigate(`/contactos/${id}`)}
            onDelete={(id) => { setLeadToDelete(id); setDeleteDialogOpen(true); }}
          />
        ) : (
          <LeadsGrid
            leads={paginatedLeads}
            onView={(id) => navigate(`/contactos/${id}`)}
            onDelete={(id) => { setLeadToDelete(id); setDeleteDialogOpen(true); }}
          />
        )}
      </div>

      {/* Pagination */}
      {filteredLeads.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIndex}-{endIndex} de {filteredLeads.length} contactos
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

      {/* New Contact Dialog - Wizard */}
      <Dialog open={newLeadOpen} onOpenChange={(open) => { setNewLeadOpen(open); if (!open) { setWizardStep(0); form.reset(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Contacto</DialogTitle>
            <DialogDescription>Registra un nuevo prospecto en el sistema.</DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-0 py-2">
            {wizardSteps.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { if (i < wizardStep) setWizardStep(i); }}
                    className={`flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                      i < wizardStep
                        ? 'border-[#13944C] bg-[#13944C] text-white'
                        : i === wizardStep
                          ? 'border-[#13944C] bg-white text-[#13944C]'
                          : 'border-muted-foreground/30 bg-muted text-muted-foreground'
                    }`}
                  >
                    {i < wizardStep ? <Check className="size-4" /> : i + 1}
                  </button>
                  <span className={`text-xs whitespace-nowrap ${i === wizardStep ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </div>
                {i < wizardSteps.length - 1 && (
                  <div className={`mx-2 mb-5 h-0.5 w-12 sm:w-16 ${i < wizardStep ? 'bg-[#13944C]' : 'bg-muted-foreground/20'}`} />
                )}
              </div>
            ))}
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
            {/* Step 1: Identificacion */}
            {wizardStep === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de documento</Label>
                  <Select
                    value={form.watch('docType') ?? ''}
                    onValueChange={(v) => {
                      form.setValue('docType', v as 'dni' | 'cee');
                      form.setValue('docNumber', '');
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dni">DNI</SelectItem>
                      <SelectItem value="cee">CEE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="docNumber">
                    N° de {form.watch('docType') === 'dni' ? 'DNI' : form.watch('docType') === 'cee' ? 'CEE' : 'documento'}
                  </Label>
                  <Input
                    id="docNumber"
                    {...form.register('docNumber')}
                    placeholder={form.watch('docType') === 'dni' ? '12345678' : form.watch('docType') === 'cee' ? '001234567890' : 'Selecciona un tipo'}
                    maxLength={form.watch('docType') === 'dni' ? 8 : 12}
                    disabled={!form.watch('docType')}
                  />
                </div>
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
                  <Label>Etapa de ciclo de vida</Label>
                  <Select
                    value={form.watch('etapaCiclo')}
                    onValueChange={(v) => form.setValue('etapaCiclo', v as Etapa)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(etapaLabels).map(([key, label]) => (
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
              </div>
            )}

            {/* Step 2: Comercial */}
            {wizardStep === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
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
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    {...form.register('notes')}
                    placeholder="Información adicional sobre el contacto..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Ubicacion */}
            {wizardStep === 2 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="departamento">Departamento</Label>
                  <Input id="departamento" {...form.register('departamento')} placeholder="Ej: Lima" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provincia">Provincia</Label>
                  <Input id="provincia" {...form.register('provincia')} placeholder="Ej: Lima" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="distrito">Distrito</Label>
                  <Input id="distrito" {...form.register('distrito')} placeholder="Ej: Surco" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input id="direccion" {...form.register('direccion')} placeholder="Ej: Av. Primavera 1234" />
                </div>
              </div>
            )}

            <DialogFooter className="flex-row gap-2 sm:justify-between">
              <div>
                {wizardStep > 0 && (
                  <Button type="button" variant="outline" onClick={() => setWizardStep((s) => s - 1)}>
                    <ChevronLeft className="size-4" /> Anterior
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => { setNewLeadOpen(false); setWizardStep(0); form.reset(); }}>
                  Cancelar
                </Button>
                {wizardStep < 2 ? (
                  <Button type="button" className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={handleNextStep}>
                    Siguiente <ChevronRight className="size-4" />
                  </Button>
                ) : (
                  <Button type="button" className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={handleWizardSubmit}>
                    Crear Contacto
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar Contacto"
        description="¿Estás seguro de que deseas eliminar este contacto? Esta acción no se puede deshacer."
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
            <TableHead>Etapa</TableHead>
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
