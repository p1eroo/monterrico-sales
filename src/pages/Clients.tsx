import { useState, useMemo } from 'react';
import type { Client, ClientStatus, CompanyRubro, CompanyTipo } from '@/types';
import { clients as mockClients, users, timelineEvents, companyRubroLabels, companyTipoLabels } from '@/data/mock';
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, UserX, DollarSign, Search, Plus, Eye,
  Phone, Mail, Calendar, FileText, Clock, User, RefreshCw, Download, ExternalLink,
} from 'lucide-react';

const clientStatusConfig: Record<ClientStatus, { label: string; className: string }> = {
  activo: { label: 'Activo', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  inactivo: { label: 'Inactivo', className: 'bg-red-100 text-red-700 border-red-200' },
  potencial: { label: 'Potencial', className: 'bg-amber-100 text-amber-700 border-amber-200' },
};

function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const config = clientStatusConfig[status];
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}

const newClientSchema = z.object({
  company: z.string().min(1, 'La empresa es requerida'),
  companyRubro: z.enum(['mineria', 'hoteleria', 'banca', 'construccion', 'salud', 'retail', 'telecomunicaciones', 'educacion', 'energia', 'consultoria', 'diplomatico', 'aviacion', 'consumo_masivo', 'otros'] as const).optional(),
  companyTipo: z.enum(['A', 'B', 'C'] as const).optional(),
  contactName: z.string().min(1, 'El nombre de contacto es requerido'),
  phone: z.string().min(1, 'El teléfono es requerido'),
  email: z.string().email('Email inválido'),
  assignedTo: z.string().min(1, 'Seleccione un ejecutivo'),
  notes: z.string().optional(),
});

type NewClientForm = z.infer<typeof newClientSchema>;

function formatCurrency(amount: number) {
  return `S/ ${amount.toLocaleString('es-PE')}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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

function exportClientsToCSV(clients: Client[]) {
  const headers = ['Empresa', 'Dominio', 'Contacto principal', 'Rubro', 'Tipo', 'Teléfono', 'Email', 'Estado', 'Ejecutivo', 'Fecha alta', 'Ingresos'];
  const rows = clients.map((c) => [
    c.company,
    getDomainFromEmail(c.email) ?? '',
    c.contactName,
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
  const [clientList, setClientList] = useState<Client[]>(mockClients);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [isChangeStatusOpen, setIsChangeStatusOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<NewClientForm>({
    resolver: zodResolver(newClientSchema),
    defaultValues: {
      company: '',
      companyRubro: undefined,
      companyTipo: undefined,
      contactName: '',
      phone: '',
      email: '',
      assignedTo: '',
      notes: '',
    },
  });

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
      const matchesAssignee = assigneeFilter === 'all' || client.assignedTo === assigneeFilter;

      return matchesSearch && matchesStatus && matchesAssignee;
    });
  }, [clientList, searchTerm, statusFilter, assigneeFilter]);

  const activeUsers = users.filter((u) => u.status === 'activo');

  function onSubmitNewClient(data: NewClientForm) {
    const assignedUser = users.find((u) => u.id === data.assignedTo);
    const newClient: Client = {
      id: `c${Date.now()}`,
      company: data.company,
      companyRubro: data.companyRubro,
      companyTipo: data.companyTipo,
      contactName: data.contactName,
      phone: data.phone,
      email: data.email,
      status: 'potencial',
      assignedTo: data.assignedTo,
      assignedToName: assignedUser?.name ?? '',
      service: '',
      createdAt: new Date().toISOString().split('T')[0],
      totalRevenue: 0,
      notes: data.notes,
    };
    setClientList((prev) => [newClient, ...prev]);
    setIsNewClientOpen(false);
    reset();
    toast.success('Cliente creado exitosamente', {
      description: `${newClient.company} ha sido registrado en el sistema.`,
    });
  }

  function handleStatusChange(newStatus: ClientStatus) {
    if (!selectedClient) return;
    setClientList((prev) =>
      prev.map((c) => (c.id === selectedClient.id ? { ...c, status: newStatus } : c)),
    );
    setSelectedClient((prev) => (prev?.id === selectedClient.id ? { ...prev, status: newStatus } : prev));
    setIsChangeStatusOpen(false);
    toast.success('Estado actualizado', {
      description: `${selectedClient.company} ahora está ${clientStatusConfig[newStatus].label.toLowerCase()}.`,
    });
  }

  const statsCards = [
    { label: 'Total Clientes', value: stats.total, icon: Building2, color: 'text-[#13944C]', bg: 'bg-[#13944C]/10' },
    { label: 'Activos', value: stats.activos, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Inactivos', value: stats.inactivos, icon: UserX, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Ingresos Totales', value: formatCurrency(stats.ingresos), icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Clientes" description="Gestión y seguimiento de clientes corporativos">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            exportClientsToCSV(filteredClients);
            toast.success('Exportación completada', {
              description: `Se exportaron ${filteredClients.length} clientes.`,
            });
          }}
        >
          <Download className="size-4" /> Exportar
        </Button>
        <Button onClick={() => setIsNewClientOpen(true)} className="bg-[#13944C] hover:bg-[#0f7a3d]">
          <Plus className="mr-2 size-4" />
          Nuevo Cliente
        </Button>
      </PageHeader>

      {/* Stats Cards */}
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

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por empresa, contacto, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="inactivo">Inactivo</SelectItem>
              <SelectItem value="potencial">Potencial</SelectItem>
            </SelectContent>
          </Select>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Ejecutivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los ejecutivos</SelectItem>
              {activeUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Contacto principal</TableHead>
                  <TableHead className="hidden lg:table-cell">Rubro</TableHead>
                  <TableHead className="hidden lg:table-cell">Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Teléfono</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden md:table-cell">Ejecutivo</TableHead>
                  <TableHead className="hidden xl:table-cell">Fecha alta</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-12 text-center text-muted-foreground">
                      No se encontraron clientes con los filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => {
                    const domain = getDomainFromEmail(client.email);
                    return (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedClient(client)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{client.company}</p>
                          {domain && (
                            <a
                              href={`https://${domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Abrir ${domain}`}
                              className="text-xs text-muted-foreground hover:text-primary hover:underline cursor-pointer block"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {domain}
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{client.contactName}</TableCell>
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
                        {formatCurrency(client.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
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
                              navigate(`/empresas/${encodeURIComponent(client.company)}`);
                            }}
                          >
                            <ExternalLink className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                  })
                )}
              </TableBody>
            </Table>
      </div>

      {/* Client Detail Sheet */}
      <Sheet open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setIsChangeStatusOpen(true)}
                      >
                        <RefreshCw className="size-3.5 mr-1" />
                        Cambiar estado
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          navigate(`/empresas/${encodeURIComponent(selectedClient.company)}`);
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
                  {/* Contact Details */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Información de Contacto
                    </h4>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3">
                        <User className="size-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{selectedClient.contactName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="size-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{selectedClient.phone}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="size-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{selectedClient.email}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Revenue & Dates */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Métricas
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Ingresos Totales</p>
                        <p className="text-lg font-bold text-[#13944C]">
                          {formatCurrency(selectedClient.totalRevenue)}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Fecha de Alta</p>
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

                  {/* Assigned Executive */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Ejecutivo Asignado
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
                          {users.find((u) => u.id === selectedClient.assignedTo)?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Recent Activity */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Actividad Reciente
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

                  {/* Notes */}
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

      {/* Change Status Dialog */}
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
              onValueChange={(v) => handleStatusChange(v as ClientStatus)}
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

      {/* New Client Dialog */}
      <Dialog
        open={isNewClientOpen}
        onOpenChange={(open) => {
          setIsNewClientOpen(open);
          if (!open) reset();
        }}
      >
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
            <DialogDescription>
              Registra un nuevo cliente corporativo en el sistema.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmitNewClient)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company">Empresa</Label>
                <Input id="company" placeholder="Nombre de la empresa" {...register('company')} />
                {errors.company && (
                  <p className="text-xs text-destructive">{errors.company.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Rubro</Label>
                <Controller
                  control={control}
                  name="companyRubro"
                  render={({ field }) => (
                    <Select onValueChange={(v) => field.onChange(v ? (v as CompanyRubro) : undefined)} value={field.value ?? ''}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar rubro" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(companyRubroLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Controller
                  control={control}
                  name="companyTipo"
                  render={({ field }) => (
                    <Select onValueChange={(v) => field.onChange(v ? (v as CompanyTipo) : undefined)} value={field.value ?? ''}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar tipo (A, B, C)" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(companyTipoLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactName">Contacto principal</Label>
                <Input id="contactName" placeholder="Nombre completo" {...register('contactName')} />
                {errors.contactName && (
                  <p className="text-xs text-destructive">{errors.contactName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" placeholder="+51 999 999 999" {...register('phone')} />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="correo@empresa.com" {...register('email')} />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Ejecutivo asignado</Label>
                <Controller
                  control={control}
                  name="assignedTo"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar ejecutivo" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.assignedTo && (
                  <p className="text-xs text-destructive">{errors.assignedTo.message}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  placeholder="Observaciones adicionales..."
                  rows={3}
                  {...register('notes')}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsNewClientOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#13944C] hover:bg-[#0f7a3d]">
                Crear Cliente
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
