import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Client, ClientStatus } from '@/types';
import { timelineEvents, companyRubroLabels } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Building2, Users, UserX, DollarSign, Search, Eye,
  Phone, Mail, Calendar, FileText, Clock, User, RefreshCw, Download, ExternalLink,
  Globe, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { rightDrawerSheetContentClass } from '@/lib/rightPanelShell';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useCrmTeamAdvisorFilter } from '@/hooks/useCrmTeamAdvisorFilter';
import { useAppStore } from '@/store';
import { fetchClients, updateClientApi, fetchExternalClients } from '@/lib/clientApi';
import { CrmDataTableSkeleton, CrmStatCardsSkeleton } from '@/components/shared/CrmListPageSkeleton';

const CLIENTS_TABLE_SKELETON_COLUMNS = [
  { label: 'Empresa' },
  { label: 'Rubro', className: 'hidden lg:table-cell' },
  { label: 'Tipo', className: 'hidden lg:table-cell' },
  { label: 'Teléfono', className: 'hidden md:table-cell' },
  { label: 'Email', className: 'hidden lg:table-cell' },
  { label: 'Estado' },
  { label: 'Asesor', className: 'hidden md:table-cell' },
  { label: 'Fecha alta', className: 'hidden xl:table-cell' },
  { label: 'Ingresos', className: 'text-right' },
  { label: '', className: 'text-right w-10' },
];

const clientStatusConfig: Record<ClientStatus, { label: string; className: string }> = {
  activo: { label: 'Activo', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  inactivo: { label: 'Inactivo', className: 'bg-red-100 text-red-700 border-emerald-200' },
  potencial: { label: 'Potencial', className: 'bg-amber-100 text-amber-700 border-emerald-200' },
};

function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const config = clientStatusConfig[status];
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getDomainFromEmail(email: string): string | null {
  const match = email?.match(/@([\w.-]+\.[a-z]{2,})/i);
  return match ? match[1] : null;
}

function empresaPath(client: Client): string {
  if (client.companyUrlSlug) {
    return `/empresas/${encodeURIComponent(client.companyUrlSlug)}`;
  }
  return `/empresas/${encodeURIComponent(client.company)}`;
}

function exportClientsToCSV(clients: Client[]) {
  const headers = ['Empresa', 'Dominio', 'Rubro', 'Tipo', 'Teléfono', 'Email', 'Estado', 'Asesor', 'Fecha alta', 'Ingresos'];
  const rows = clients.map((c) => [
    c.company,
    getDomainFromEmail(c.email) ?? '',
    c.companyRubro ? companyRubroLabels[c.companyRubro] : '',
    c.companyTipo ?? '',
    c.phone,
    c.email,
    clientStatusConfig[c.status].label,
    c.assignedToName,
    formatDate(c.createdAt),
    c.totalRevenue.toString(),
  ]);
  const csvContent = [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Clients() {
  const navigate = useNavigate();
  const { users, activeAdvisors } = useUsers();
  const { hasPermission } = usePermissions();
  const [clientList, setClientList] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { canSeeAllAdvisors } = useCrmTeamAdvisorFilter(
    assigneeFilter,
    setAssigneeFilter,
    'all',
  );
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isChangeStatusOpen, setIsChangeStatusOpen] = useState(false);

  const { currentUser } = useAppStore();

  const reloadClients = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [rows, externalRaw] = await Promise.all([
        fetchClients(),
        fetchExternalClients(currentUser.username)
      ]);

      const mappedExternal: Client[] = externalRaw.map((ext) => {
        const rawAsesor = (ext.asesorresponsable || '').trim().toLowerCase();
        
        // Mapeo de asesor: búsqueda insensible a mayúsculas/minúsculas y espacios
        const advisor = users.find(
          (u) => u.username.toLowerCase() === rawAsesor
        );
        
        return {
          id: `ext-${ext.idclienteempresa || ext.codigoempresa}`,
          company: ext.nombrecomercial || ext.razonsocial,
          contactName: ext.contacto || '—',
          phone: ext.telefono || '—',
          email: ext.contactoemail || '—',
          status: 'activo',
          // Usamos el ID interno si lo encontramos para que los filtros de la tabla funcionen
          assignedTo: advisor ? advisor.id : (ext.asesorresponsable || 'unassigned'),
          assignedToName: advisor ? advisor.name : (ext.asesorresponsable || 'Sin asesor'),
          service: ext.tipopagodetalle || '—',
          createdAt: ext.fechor,
          totalRevenue: 0,
          notes: '',
        };
      });

      setClientList([...rows, ...mappedExternal]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudieron cargar los clientes';
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [currentUser.username, users]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, assigneeFilter]);

  useEffect(() => {
    void reloadClients();
  }, [reloadClients]);

  const stats = useMemo(() => {
    const total = clientList.length;
    const activos = clientList.filter((c) => c.status === 'activo').length;
    const inactivos = clientList.filter((c) => c.status === 'inactivo').length;
    const ingresos = clientList.reduce((sum, c) => sum + c.totalRevenue, 0);
    return { total, activos, inactivos, ingresos };
  }, [clientList]);

  const filteredClients = useMemo(() => {
    return clientList.filter((client) => {
      const matchesSearch =
        searchTerm === '' ||
        client.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone.includes(searchTerm);

      const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
      const matchesAssignee =
        assigneeFilter === 'all' || client.assignedTo === assigneeFilter;

      return matchesSearch && matchesStatus && matchesAssignee;
    });
  }, [clientList, searchTerm, statusFilter, assigneeFilter]);

  const totalPages = Math.ceil(filteredClients.length / pageSize);
  const paginatedClients = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredClients.slice(start, start + pageSize);
  }, [filteredClients, page, pageSize]);

  const selectedAssigneeUser = useMemo(
    () =>
      selectedClient
        ? users.find((u) => u.id === selectedClient.assignedTo)
        : undefined,
    [selectedClient, users],
  );

  async function handleStatusChange(newStatus: ClientStatus) {
    if (!selectedClient) return;
    try {
      const updated = await updateClientApi(selectedClient.id, { status: newStatus });
      setClientList((prev) =>
        prev.map((c) => (c.id === selectedClient.id ? updated : c)),
      );
      setSelectedClient(updated);
      setIsChangeStatusOpen(false);
      toast.success('Estado actualizado', {
        description: `${selectedClient.company} ahora está ${clientStatusConfig[newStatus].label.toLowerCase()}.`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el estado');
    }
  }

  const statsCards = [
    { label: 'Total Clientes', value: stats.total, icon: Building2, color: 'text-[#13944C]', bg: 'bg-[#13944C]/10' },
    { label: 'Activos', value: stats.activos, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Inactivos', value: stats.inactivos, icon: UserX, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Ingresos Totales', value: formatCurrency(stats.ingresos), icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Se registran automáticamente cuando una empresa alcanza la etapa Activo o una etapa con probabilidad 100 %."
      >
        <span className="mr-2 text-sm text-muted-foreground">Total: {filteredClients.length}</span>
        {hasPermission('clientes.exportar') && (
          <Button
            variant="outline"
            onClick={() => {
              exportClientsToCSV(filteredClients);
              toast.success('Exportación completada', {
                description: `Se exportaron ${filteredClients.length} clientes.`,
              });
            }}
            className="bg-card"
          >
            <Download className="size-4" /> Exportar
          </Button>
        )}
      </PageHeader>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {loading ? (
        <CrmStatCardsSkeleton count={4} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((stat) => (
            <Card key={stat.label} className="py-0">
              <CardContent className="flex items-center gap-4 px-4 py-3">
                <div className={cn('flex size-12 items-center justify-center rounded-lg', stat.bg)}>
                  <stat.icon className={cn('size-6', stat.color)} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-[580px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por empresa, contacto, email o teléfono…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-auto rounded-md border-input bg-card shadow-none">
              <div className="flex items-center gap-1.5">
                <Globe className="size-3.5" />
                <SelectValue placeholder="Estado" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Estados</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="inactivo">Inactivo</SelectItem>
              <SelectItem value="potencial">Potencial</SelectItem>
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
              <SelectItem value="all">Asesores</SelectItem>
              {activeAdvisors.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <CrmDataTableSkeleton
          columns={CLIENTS_TABLE_SKELETON_COLUMNS}
          rows={8}
          aria-label="Cargando clientes"
          roundedClass="rounded-lg"
          className="bg-card"
        />
      ) : (
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead className="hidden lg:table-cell">Rubro</TableHead>
              <TableHead className="hidden lg:table-cell">Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Teléfono</TableHead>
              <TableHead className="hidden lg:table-cell">Email</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">Asesor</TableHead>
              <TableHead className="hidden xl:table-cell">Fecha alta</TableHead>
              <TableHead className="text-right">Ingresos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                  {clientList.length === 0
                    ? 'Aún no hay clientes. Aparecerán aquí cuando una empresa llegue a la etapa Activo o a una etapa con probabilidad 100 %.'
                    : 'No se encontraron clientes con los filtros aplicados.'}
                </TableCell>
              </TableRow>
            ) : (
              paginatedClients.map((client) => {
                const emailDomain = getDomainFromEmail(client.email);
                return (
                  <TableRow
                    key={client.id}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50',
                      client.id.startsWith('ext-') && 'bg-blue-50/30'
                    )}
                    onClick={() => {
                      if (client.id.startsWith('ext-')) {
                        toast.info('Cliente Externo', {
                          description: 'Este registro proviene de Taxi Monterrico y es de solo lectura.',
                        });
                        return;
                      }
                      setSelectedClient(client);
                    }}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{client.company}</p>
                        {emailDomain && (
                          <a
                            href={`https://${emailDomain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Abrir ${emailDomain}`}
                            className="text-xs text-muted-foreground hover:text-primary hover:underline cursor-pointer block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {emailDomain}
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {client.companyRubro ? companyRubroLabels[client.companyRubro] : '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {client.companyTipo ?? '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{client.phone}</TableCell>
                    <TableCell className="hidden lg:table-cell">{client.email}</TableCell>
                    <TableCell>
                      <ClientStatusBadge status={client.status} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{client.assignedToName}</TableCell>
                    <TableCell className="hidden xl:table-cell">{formatDate(client.createdAt)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {client.id.startsWith('ext-') ? '—' : formatCurrency(client.totalRevenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!client.id.startsWith('ext-') && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClient(client);
                              }}
                            >
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Ver empresa"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(empresaPath(client));
                              }}
                            >
                              <ExternalLink className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4">
          <p className="text-sm text-muted-foreground">
            Mostrando <span className="font-medium">{(page - 1) * pageSize + 1}</span> a{' '}
            <span className="font-medium">
              {Math.min(page * pageSize, filteredClients.length)}
            </span> de{' '}
            <span className="font-medium">{filteredClients.length}</span> clientes
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                // Solo mostrar las primeras 3, la actual, y las últimas 3 si hay muchas páginas
                if (
                  totalPages > 7 &&
                  p > 2 &&
                  p < totalPages - 1 &&
                  Math.abs(p - page) > 1
                ) {
                  if (p === 3 || p === totalPages - 2) return <span key={p} className="px-1 text-muted-foreground text-xs">...</span>;
                  return null;
                }
                return (
                  <Button
                    key={p}
                    variant={page === p ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(p)}
                    className="h-8 w-8 p-0 text-xs"
                  >
                    {p}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Sheet open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <SheetContent
          side="right"
          className={rightDrawerSheetContentClass('lg', 'overflow-y-auto')}
        >
          {selectedClient && (
            <>
              <SheetHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-lg bg-[#13944C]/10">
                    <Building2 className="size-6 text-[#13944C]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="truncate">{selectedClient.company}</SheetTitle>
                    <SheetDescription className="flex flex-wrap items-center gap-2 pt-1">
                      <ClientStatusBadge status={selectedClient.status} />
                      {hasPermission('clientes.editar') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setIsChangeStatusOpen(true)}
                        >
                          <RefreshCw className="size-3.5 mr-1" />
                          Cambiar estado
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          navigate(empresaPath(selectedClient));
                          setSelectedClient(null);
                        }}
                      >
                        <ExternalLink className="size-3.5 mr-1" />
                        Ver empresa
                      </Button>
                      {selectedClient.companyRubro && (
                        <Badge variant="outline" className="text-xs">{companyRubroLabels[selectedClient.companyRubro]}</Badge>
                      )}
                      {selectedClient.companyTipo && (
                        <Badge variant="secondary" className="text-xs">Tipo {selectedClient.companyTipo}</Badge>
                      )}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <ScrollArea className="h-[calc(100vh-130px)]">
                <div className="space-y-6 px-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Contacto vinculado
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Referencia del contacto asociado al mayor monto en negocios de esta empresa.
                    </p>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3">
                        <User className="size-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{selectedClient.contactName || '—'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="size-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{selectedClient.phone || '—'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="size-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{selectedClient.email || '—'}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Métricas
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Ingresos</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Misma facturación estimada de la empresa.
                        </p>
                        <p className="text-lg font-bold text-[#13944C] mt-1">
                          {formatCurrency(selectedClient.totalRevenue)}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Fecha de alta</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Registro como cliente (Activo o etapa al 100 %).
                        </p>
                        <p className="text-sm font-medium mt-1">
                          {formatDate(selectedClient.createdAt)}
                        </p>
                      </div>
                    </div>
                    {selectedClient.lastActivity && (
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Clock className="size-4 shrink-0" />
                        Última actividad: {formatDate(selectedClient.lastActivity)}
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Asesor asignado
                    </h4>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-[#13944C]/10 text-[#13944C] text-xs">
                          {getInitials(selectedClient.assignedToName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{selectedClient.assignedToName}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedAssigneeUser?.username ??
                            selectedAssigneeUser?.email ??
                            '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Actividad reciente
                    </h4>
                    <div className="space-y-3">
                      {timelineEvents.slice(0, 5).map((event) => (
                        <div key={event.id} className="flex gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                            <Calendar className="size-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{event.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {event.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {event.user} · {event.date}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedClient.notes && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                          Notas
                        </h4>
                        <div className="flex items-start gap-3">
                          <FileText className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                          <p className="text-sm">{selectedClient.notes}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={isChangeStatusOpen} onOpenChange={setIsChangeStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar estado</DialogTitle>
            <DialogDescription>
              Selecciona el nuevo estado para {selectedClient?.company}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Select
              value={selectedClient?.status ?? ''}
              onValueChange={(v) => void handleStatusChange(v as ClientStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="inactivo">Inactivo</SelectItem>
                <SelectItem value="potencial">Potencial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
