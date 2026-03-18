import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Search, Building2, Users, ChevronRight, ChevronLeft, Briefcase,
  FileSpreadsheet, Upload, Download, Plus, List, Grid3X3, DollarSign,
} from 'lucide-react';
import type { Contact, Etapa, CompanyRubro, CompanyTipo, ContactSource } from '@/types';
import { companyRubroLabels, companyTipoLabels, etapaLabels, etapaProbabilidad, contactSourceLabels, users } from '@/data/mock';
import { useCRMStore } from '@/store/crmStore';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { NewCompanyWizard, type NewCompanyData } from '@/components/shared/NewCompanyWizard';

import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const etapaOrder: Etapa[] = ['lead', 'contacto', 'reunion_agendada', 'reunion_efectiva', 'propuesta_economica', 'negociacion', 'licitacion', 'licitacion_etapa_final', 'cierre_ganado', 'firma_contrato', 'activo', 'cierre_perdido', 'inactivo'];

const etapaTabs: { value: string; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  ...etapaOrder.map((e) => ({ value: e, label: etapaLabels[e] })),
];

interface EmpresaGroup {
  company: string;
  domain?: string;
  companyRubro?: CompanyRubro;
  companyTipo?: CompanyTipo;
  contacts: Contact[];
  totalValue: number;
  /** Etapa más avanzada entre los contactos (por orden en etapaOrder) */
  etapa: Etapa;
}

function slugifyCompany(company: string): string {
  return encodeURIComponent(company.trim());
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
}

const ITEMS_PER_PAGE = 8;

export default function EmpresasPage() {
  const navigate = useNavigate();
  const { contacts, addContact, addOpportunity } = useCRMStore();

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('todos');
  const [etapaFilter, setEtapaFilter] = useState<string>('todos');
  const [rubroFilter, setRubroFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [advisorFilter, setAdvisorFilter] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(1);
  const [newEmpresaOpen, setNewEmpresaOpen] = useState(false);

  function handleNewEmpresaSubmit(data: NewCompanyData) {
    const monto = Number(data.facturacion) || 0;

    const newLead = addContact({
      name: data.nombreComercial,
      companies: [{
        name: data.nombreComercial,
        rubro: (data.rubro || undefined) as CompanyRubro | undefined,
        tipo: (data.tipoEmpresa || undefined) as CompanyTipo | undefined,
        domain: data.dominio || undefined,
        isPrimary: true,
      }],
      phone: data.telefono || '',
      email: data.correo || '',
      source: (data.origenLead || 'base') as ContactSource,
      priority: 'media',
      assignedTo: data.propietario || users[0]?.id || '',
      estimatedValue: monto,
      etapa: data.etapa,
    });

    if (data.nombreNegocio.trim()) {
      addOpportunity({
        title: data.nombreNegocio,
        contactId: newLead.id,
        amount: monto,
        etapa: data.etapa,
        expectedCloseDate: data.fechaCierre || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        assignedTo: data.propietario || users[0]?.id || '',
        description: '',
      });
    }

    toast.success(`Empresa "${data.nombreComercial}" creada exitosamente${data.nombreNegocio.trim() ? ' con oportunidad vinculada' : ''}`);
  }

  const empresas = useMemo(() => {
    const map = new Map<string, EmpresaGroup>();
    for (const lead of contacts) {
      for (const comp of lead.companies ?? []) {
        const key = comp.name.trim().toLowerCase();
        const existing = map.get(key);
        const leadProb = etapaProbabilidad[lead.etapa];
        if (existing) {
          if (!existing.contacts.some((c) => c.id === lead.id)) {
            existing.contacts.push(lead);
            existing.totalValue += lead.estimatedValue;
          }
          if (comp.domain && !existing.domain) existing.domain = comp.domain;
          if (comp.rubro && !existing.companyRubro) existing.companyRubro = comp.rubro;
          if (comp.tipo && !existing.companyTipo) existing.companyTipo = comp.tipo;
          if (leadProb > etapaProbabilidad[existing.etapa]) existing.etapa = lead.etapa;
        } else {
          map.set(key, {
            company: comp.name,
            domain: comp.domain,
            companyRubro: comp.rubro,
            companyTipo: comp.tipo,
            contacts: [lead],
            totalValue: lead.estimatedValue,
            etapa: lead.etapa,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [contacts]);

  const filteredEmpresas = useMemo(() => {
    return empresas.filter((emp) => {
      const matchesSearch =
        !search ||
        emp.company.toLowerCase().includes(search.toLowerCase()) ||
        emp.domain?.toLowerCase().includes(search.toLowerCase()) ||
        emp.contacts.some((c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase()),
        );

      const matchesSource = sourceFilter === 'todos' || emp.contacts.some((c) => c.source === sourceFilter);
      const matchesEtapa = etapaFilter === 'todos' || emp.etapa === etapaFilter;
      const matchesRubro = rubroFilter === 'todos' || emp.companyRubro === rubroFilter;
      const matchesTipo = tipoFilter === 'todos' || emp.companyTipo === tipoFilter;
      const matchesAdvisor = advisorFilter === 'todos' || emp.contacts.some((c) => c.assignedTo === advisorFilter);

      return matchesSearch && matchesSource && matchesEtapa && matchesRubro && matchesTipo && matchesAdvisor;
    });
  }, [empresas, search, sourceFilter, etapaFilter, rubroFilter, tipoFilter, advisorFilter]);

  const etapaCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: empresas.length };
    for (const emp of empresas) {
      counts[emp.etapa] = (counts[emp.etapa] ?? 0) + 1;
    }
    return counts;
  }, [empresas]);

  const totalPages = Math.ceil(filteredEmpresas.length / ITEMS_PER_PAGE);
  const paginatedEmpresas = filteredEmpresas.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const startIndex = (page - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(page * ITEMS_PER_PAGE, filteredEmpresas.length);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas"
        description="Empresas derivadas de tus contactos y prospectos"
      >
        <Button variant="outline" size="sm" onClick={() => toast.info('Descargando plantilla...')}>
          <FileSpreadsheet className="size-4" /> Plantilla
        </Button>
        <Button variant="outline" size="sm" onClick={() => toast.info('Selecciona un archivo para importar')}>
          <Upload className="size-4" /> Importar
        </Button>
        <Button variant="outline" size="sm" onClick={() => toast.info('Exportando empresas...')}>
          <Download className="size-4" /> Exportar
        </Button>
        <Button onClick={() => setNewEmpresaOpen(true)}>
          <Plus /> Nueva Empresa
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={etapaFilter === 'todos' ? 'secondary' : 'outline'}
          className="cursor-pointer gap-1.5 px-3 py-1.5 text-sm transition-colors hover:bg-accent"
          onClick={() => { setEtapaFilter('todos'); setPage(1); }}
        >
          <Briefcase className="size-3.5" /> Total: {empresas.length} empresas
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
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
          <Users className="size-3.5" /> {contacts.length} contactos
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por empresa o contacto..."
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
        {filteredEmpresas.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No se encontraron empresas"
            description="Las empresas se generan automáticamente a partir de tus contactos. Crea contactos para ver sus empresas aquí."
            actionLabel="Ir a Contactos"
            onAction={() => navigate('/contactos')}
          />
        ) : viewMode === 'table' ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="hidden md:table-cell">Etapa</TableHead>
                  <TableHead className="hidden lg:table-cell">Fuente</TableHead>
                  <TableHead className="hidden md:table-cell">Rubro</TableHead>
                  <TableHead className="hidden md:table-cell">Tipo</TableHead>
                  <TableHead className="hidden xl:table-cell">Asesor</TableHead>
                  <TableHead className="text-center">Contactos</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEmpresas.map((emp) => (
                  <TableRow
                    key={emp.company}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/empresas/${slugifyCompany(emp.company)}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                          <Building2 className="size-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{emp.company}</p>
                          {emp.domain && (
                            <a
                              href={emp.domain.startsWith('http') ? emp.domain : `https://${emp.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {emp.domain}
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <StatusBadge status={emp.etapa} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {(() => {
                        const primary = emp.contacts.reduce((a, b) =>
                          etapaProbabilidad[a.etapa] > etapaProbabilidad[b.etapa] ? a : b,
                        );
                        return primary.source ? contactSourceLabels[primary.source] : '—';
                      })()}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {emp.companyRubro ? companyRubroLabels[emp.companyRubro] : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {emp.companyTipo ?? '—'}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground">
                      {(() => {
                        const primary = emp.contacts.reduce((a, b) =>
                          etapaProbabilidad[a.etapa] > etapaProbabilidad[b.etapa] ? a : b,
                        );
                        return primary.assignedToName ?? '—';
                      })()}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{emp.contacts.length}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">
                      {formatCurrency(emp.totalValue)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm">
                        <ChevronRight className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedEmpresas.map((emp) => (
              <Card
                key={emp.company}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => navigate(`/empresas/${slugifyCompany(emp.company)}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Building2 className="size-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{emp.company}</h3>
                      {emp.domain && (
                        <p className="text-xs text-muted-foreground truncate">{emp.domain}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <StatusBadge status={emp.etapa} />
                    {emp.companyRubro && (
                      <Badge variant="outline" className="text-xs">{companyRubroLabels[emp.companyRubro]}</Badge>
                    )}
                    {emp.companyTipo && (
                      <Badge variant="outline" className="text-xs">Tipo {emp.companyTipo}</Badge>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <Users className="size-3 shrink-0" /> {emp.contacts.length} contacto{emp.contacts.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                      <DollarSign className="size-3.5" />
                      {formatCurrency(emp.totalValue)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {(() => {
                        const primary = emp.contacts.reduce((a, b) =>
                          etapaProbabilidad[a.etapa] > etapaProbabilidad[b.etapa] ? a : b,
                        );
                        return primary.assignedToName ?? '—';
                      })()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredEmpresas.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIndex}-{endIndex} de {filteredEmpresas.length} empresas
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

      <NewCompanyWizard
        open={newEmpresaOpen}
        onOpenChange={setNewEmpresaOpen}
        onSubmit={handleNewEmpresaSubmit}
      />
    </div>
  );
}
