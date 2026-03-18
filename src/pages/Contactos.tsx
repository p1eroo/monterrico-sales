import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus, Search, Grid3X3, List, MoreHorizontal,
  Eye, Pencil, Trash2, X, ArrowUpDown,
  Phone, Mail, Building2, DollarSign, Users, ChevronLeft, ChevronRight,
  Upload, Download, FileSpreadsheet,
} from 'lucide-react';
import { users, contactSourceLabels, etapaLabels, priorityLabels } from '@/data/mock';
import { NewContactWizard, type NewContactData } from '@/components/shared/NewContactWizard';
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
}

export default function ContactosPage() {
  const navigate = useNavigate();
  const { contacts, addContact, deleteContact } = useCRMStore();

  const [search, setSearch] = useState('');
  const [etapaFilter, setEtapaFilter] = useState<string>('todos');
  const [priorityFilter, setPriorityFilter] = useState<string>('todos');
  const [sourceFilter, setSourceFilter] = useState<string>('todos');
  const [advisorFilter, setAdvisorFilter] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(1);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const matchesSearch =
        !search ||
        contact.name.toLowerCase().includes(search.toLowerCase()) ||
        contact.cargo?.toLowerCase().includes(search.toLowerCase()) ||
        contact.companies?.some((c) => c.name.toLowerCase().includes(search.toLowerCase())) ||
        contact.email.toLowerCase().includes(search.toLowerCase()) ||
        contact.phone.includes(search);

      const matchesEtapa = etapaFilter === 'todos' || contact.etapa === etapaFilter;
      const matchesPriority = priorityFilter === 'todos' || contact.priority === priorityFilter;
      const matchesSource = sourceFilter === 'todos' || contact.source === sourceFilter;
      const matchesAdvisor = advisorFilter === 'todos' || contact.assignedTo === advisorFilter;

      return matchesSearch && matchesEtapa && matchesPriority && matchesSource && matchesAdvisor;
    });
  }, [search, etapaFilter, priorityFilter, sourceFilter, advisorFilter]);

  const totalPages = Math.ceil(filteredContacts.length / ITEMS_PER_PAGE);
  const paginatedContacts = filteredContacts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const startIndex = (page - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(page * ITEMS_PER_PAGE, filteredContacts.length);

  const hasActiveFilters = etapaFilter !== 'todos' || priorityFilter !== 'todos' || sourceFilter !== 'todos' || advisorFilter !== 'todos' || search !== '';

  const etapaCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: contacts.length };
    for (const contact of contacts) {
      counts[contact.etapa] = (counts[contact.etapa] ?? 0) + 1;
    }
    return counts;
  }, [contacts]);

  function clearFilters() {
    setSearch('');
    setEtapaFilter('todos');
    setPriorityFilter('todos');
    setSourceFilter('todos');
    setAdvisorFilter('todos');
    setPage(1);
  }

  function toggleSelectAll() {
    if (selectedContacts.length === paginatedContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(paginatedContacts.map((l) => l.id));
    }
  }

  function toggleSelectContact(id: string) {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }

  function handleDelete() {
    if (contactToDelete) {
      deleteContact(contactToDelete);
      toast.success('Contacto eliminado correctamente');
      setContactToDelete(null);
    }
  }

  function onSubmitNewContact(data: NewContactData) {
    addContact({
      name: data.name,
      cargo: data.cargo,
      docType: data.docType,
      docNumber: data.docNumber,
      companies: [{ name: data.company, isPrimary: true }],
      phone: data.phone,
      email: data.email,
      source: data.source,
      priority: data.priority,
      assignedTo: data.assignedTo,
      estimatedValue: data.estimatedValue,
      notes: data.notes,
      departamento: data.departamento,
      provincia: data.provincia,
      distrito: data.distrito,
      direccion: data.direccion,
    });
    toast.success(`Contacto "${data.name}" creado exitosamente`);
    setNewContactOpen(false);
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
        <Button onClick={() => setNewContactOpen(true)}>
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
          <Users className="size-3.5" /> Total: {contacts.length}
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
              {Object.entries(contactSourceLabels).map(([key, label]) => (
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
        {filteredContacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No se encontraron contactos"
            description="Intenta ajustar los filtros o crea un nuevo contacto."
            actionLabel="Nuevo Contacto"
            onAction={() => setNewContactOpen(true)}
          />
        ) : viewMode === 'table' ? (
          <ContactsTable
            contacts={paginatedContacts}
            selectedContacts={selectedContacts}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelectContact}
            allSelected={selectedContacts.length === paginatedContacts.length && paginatedContacts.length > 0}
            onView={(id) => navigate(`/contactos/${id}`)}
            onDelete={(id) => { setContactToDelete(id); setDeleteDialogOpen(true); }}
          />
        ) : (
          <ContactsGrid
            contacts={paginatedContacts}
            onView={(id) => navigate(`/contactos/${id}`)}
            onDelete={(id) => { setContactToDelete(id); setDeleteDialogOpen(true); }}
          />
        )}
      </div>

      {/* Pagination */}
      {filteredContacts.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIndex}-{endIndex} de {filteredContacts.length} contactos
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

      <NewContactWizard
        open={newContactOpen}
        onOpenChange={setNewContactOpen}
        onSubmit={onSubmitNewContact}
      />

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

interface ContactsTableProps {
  contacts: import('@/types').Contact[];
  selectedContacts: string[];
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}

function ContactsTable({
  contacts: data,
  selectedContacts,
  allSelected,
  onToggleSelectAll,
  onToggleSelect,
  onView,
  onDelete,
}: ContactsTableProps) {
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
          {data.map((contact) => (
            <TableRow
              key={contact.id}
              className="cursor-pointer"
              onClick={() => onView(contact.id)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedContacts.includes(contact.id)}
                  onCheckedChange={() => onToggleSelect(contact.id)}
                />
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{contact.name}</p>
                  {contact.cargo && <p className="text-xs text-muted-foreground">{contact.cargo}</p>}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">{getPrimaryCompany(contact)?.name ?? '—'}</TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">{contact.phone}</TableCell>
              <TableCell className="hidden xl:table-cell text-muted-foreground">{contact.email}</TableCell>
              <TableCell className="hidden lg:table-cell">
                <Badge variant="outline" className="text-xs">{contactSourceLabels[contact.source]}</Badge>
              </TableCell>
              <TableCell><StatusBadge status={contact.etapa} /></TableCell>
              <TableCell className="hidden sm:table-cell"><PriorityBadge priority={contact.priority} /></TableCell>
              <TableCell className="hidden xl:table-cell text-muted-foreground">{contact.assignedToName}</TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {new Date(contact.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(contact.id)}>
                      <Eye /> Ver
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onView(contact.id)}>
                      <Pencil /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(contact.id)}>
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

interface ContactsGridProps {
  contacts: import('@/types').Contact[];
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}

function ContactsGrid({ contacts: data, onView, onDelete }: ContactsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((contact) => (
        <Card
          key={contact.id}
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => onView(contact.id)}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{contact.name}</h3>
                {contact.cargo && <p className="text-xs text-muted-foreground truncate">{contact.cargo}</p>}
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground truncate">
                  <Building2 className="size-3 shrink-0" /> {getPrimaryCompany(contact)?.name ?? '—'}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon-xs">
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onView(contact.id)}>
                    <Eye /> Ver
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(contact.id)}>
                    <Trash2 /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusBadge status={contact.etapa} />
              <PriorityBadge priority={contact.priority} />
            </div>

            <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <p className="flex items-center gap-2 truncate">
                <Phone className="size-3 shrink-0" /> {contact.phone}
              </p>
              <p className="flex items-center gap-2 truncate">
                <Mail className="size-3 shrink-0" /> {contact.email}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                <DollarSign className="size-3.5" />
                {formatCurrency(contact.estimatedValue)}
              </span>
              <span className="text-xs text-muted-foreground">{contact.assignedToName}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
