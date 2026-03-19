import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Search, UserPlus, Mail, Phone, Users, Shield, UserCheck,
  Grid3X3, List, Eye, Pencil,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { User } from '@/types';
import { users, activities } from '@/data/mock';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  asesor: 'Asesor',
};

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  gerente: 'bg-blue-100 text-blue-700 border-blue-200',
  asesor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = ['bg-emerald-100 text-emerald-700', 'bg-blue-100 text-blue-700', 'bg-amber-100 text-amber-700', 'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const newUserSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(6, 'Teléfono inválido'),
  role: z.enum(['admin', 'gerente', 'asesor']),
  status: z.boolean(),
});

type NewUserForm = z.infer<typeof newUserSchema>;

const activityTypeLabels: Record<string, string> = {
  llamada: 'Llamadas',
  reunion: 'Reuniones',
  tarea: 'Tareas',
  correo: 'Correos',
  seguimiento: 'Seguimientos',
  whatsapp: 'WhatsApp',
};

const mockActivity = [
  { id: '1', label: 'Llamada con Minera Los Andes', date: 'Hace 2 horas' },
  { id: '2', label: 'Propuesta enviada a BCP', date: 'Ayer' },
  { id: '3', label: 'Reunión con Hotel Belmond', date: 'Hace 3 días' },
];

export default function TeamPage() {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUserOpen, setNewUserOpen] = useState(false);

  const form = useForm<NewUserForm>({
    resolver: zodResolver(newUserSchema) as import('react-hook-form').Resolver<NewUserForm>,
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      role: 'asesor',
      status: true,
    },
  });

  const filteredUsers = users.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.phone.includes(search),
  );

  const totalMembers = users.length;
  const activeMembers = users.filter((u) => u.status === 'activo').length;
  const adminGerentes = users.filter((u) => u.role === 'admin' || u.role === 'gerente').length;
  const asesores = users.filter((u) => u.role === 'asesor').length;

  function onSubmitNewUser(data: NewUserForm) {
    toast.success(`Usuario "${data.name}" creado correctamente`);
    form.reset();
    setNewUserOpen(false);
  }

  const chartData = selectedUser
    ? [
        { name: 'Contactos', value: selectedUser.contactsAssigned, fill: '#13944C' },
        { name: 'Oportunidades', value: selectedUser.opportunitiesActive, fill: '#3b82f6' },
        { name: 'Ventas', value: selectedUser.salesClosed, fill: '#22c55e' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipo Comercial"
        description="Gestiona los miembros de tu equipo comercial"
      >
        <Button className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={() => setNewUserOpen(true)}>
          <UserPlus className="size-4" /> Nuevo Usuario
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-start">
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total miembros</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{totalMembers}</p>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="flex items-center gap-2">
              <UserCheck className="size-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Activos</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{activeMembers}</p>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="flex items-center gap-2">
              <Shield className="size-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Admin + Gerentes</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{adminGerentes}</p>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Asesores</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{asesores}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + View toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex rounded-md border">
          <Button
            variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-r-none"
            onClick={() => setViewMode('cards')}
          >
            <Grid3X3 className="size-4" /> Tarjetas
          </Button>
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-l-none"
            onClick={() => setViewMode('table')}
          >
            <List className="size-4" /> Tabla
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.map((user) => (
            <Card key={user.id} className="overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="size-16">
                    <AvatarFallback className={`text-lg font-semibold ${getAvatarColor(user.name)}`}>
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="mt-3 font-semibold">{user.name}</p>
                  <div className="mt-1 flex flex-wrap justify-center gap-1">
                    <Badge variant="outline" className={roleColors[user.role] ?? ''}>
                      {roleLabels[user.role]}
                    </Badge>
                    <Badge variant={user.status === 'activo' ? 'default' : 'secondary'}>
                      {user.status === 'activo' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="size-3.5" />
                    <a href={`mailto:${user.email}`} className="hover:underline truncate max-w-[180px]">{user.email}</a>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="size-3.5" />
                    {user.phone}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded bg-muted/50 p-2">
                    <p className="font-medium">{user.contactsAssigned}</p>
                    <p className="text-muted-foreground">Contactos</p>
                  </div>
                  <div className="rounded bg-muted/50 p-2">
                    <p className="font-medium">{user.opportunitiesActive}</p>
                    <p className="text-muted-foreground">Oportunidades</p>
                  </div>
                  <div className="rounded bg-muted/50 p-2">
                    <p className="font-medium">{user.salesClosed}</p>
                    <p className="text-muted-foreground">Ventas</p>
                  </div>
                  <div className="rounded bg-muted/50 p-2">
                    <p className="font-medium">{user.conversionRate}%</p>
                    <p className="text-muted-foreground">Conversión</p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1">Tasa de conversión</p>
                  <Progress value={user.conversionRate} className="h-2" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Ingreso: {formatDate(user.joinedAt)}</p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setSelectedUser(user)}>
                    <Eye className="size-3.5" /> Ver perfil
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Pencil className="size-3.5" /> Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Miembro</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Contactos</TableHead>
                  <TableHead className="text-right">Oportunidades</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Conversión</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className={`text-xs font-medium ${getAvatarColor(user.name)}`}>
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>
                      <a href={`mailto:${user.email}`} className="text-primary hover:underline">{user.email}</a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={roleColors[user.role] ?? ''}>
                        {roleLabels[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'activo' ? 'default' : 'secondary'}>
                        {user.status === 'activo' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{user.contactsAssigned}</TableCell>
                    <TableCell className="text-right">{user.opportunitiesActive}</TableCell>
                    <TableCell className="text-right">{user.salesClosed}</TableCell>
                    <TableCell className="text-right">{user.conversionRate}%</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedUser(user)}>
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-2xl">
          {selectedUser && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="size-16">
                    <AvatarFallback className={`text-xl font-semibold ${getAvatarColor(selectedUser.name)}`}>
                      {getInitials(selectedUser.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle>{selectedUser.name}</DialogTitle>
                    <DialogDescription>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="outline" className={roleColors[selectedUser.role] ?? ''}>
                          {roleLabels[selectedUser.role]}
                        </Badge>
                        <Badge variant={selectedUser.status === 'activo' ? 'default' : 'secondary'}>
                          {selectedUser.status === 'activo' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium mb-2">Contacto</h4>
                  <div className="flex flex-col gap-2 text-sm">
                    <a href={`mailto:${selectedUser.email}`} className="flex items-center gap-2 text-primary hover:underline">
                      <Mail className="size-4" /> {selectedUser.email}
                    </a>
                    <a href={`tel:${selectedUser.phone}`} className="flex items-center gap-2">
                      <Phone className="size-4" /> {selectedUser.phone}
                    </a>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Métricas</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-2xl font-bold text-[#13944C]">{selectedUser.contactsAssigned}</p>
                      <p className="text-xs text-muted-foreground">Contactos</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">{selectedUser.opportunitiesActive}</p>
                      <p className="text-xs text-muted-foreground">Oportunidades</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{selectedUser.salesClosed}</p>
                      <p className="text-xs text-muted-foreground">Ventas</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-2xl font-bold">{selectedUser.conversionRate}%</p>
                      <p className="text-xs text-muted-foreground">Conversión</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Rendimiento</h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Actividades realizadas</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(
                      activities
                        .filter((a) => a.assignedTo === selectedUser.id)
                        .reduce<Record<string, number>>((acc, a) => {
                          acc[a.type] = (acc[a.type] ?? 0) + 1;
                          return acc;
                        }, {}),
                    )
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => (
                        <div
                          key={type}
                          className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                        >
                          <span className="text-muted-foreground">{activityTypeLabels[type] ?? type}</span>
                          <span className="font-semibold">{count}</span>
                        </div>
                      ))}
                  </div>
                  {activities.filter((a) => a.assignedTo === selectedUser.id).length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">Sin actividades registradas</p>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Actividad reciente</h4>
                  <ul className="space-y-2">
                    {mockActivity.map((a) => (
                      <li key={a.id} className="flex justify-between text-sm">
                        <span>{a.label}</span>
                        <span className="text-muted-foreground">{a.date}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New User Dialog */}
      <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Usuario</DialogTitle>
            <DialogDescription>Agrega un nuevo miembro al equipo comercial.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmitNewUser)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" {...form.register('name')} placeholder="Ej: Juan Pérez" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" {...form.register('email')} placeholder="juan@taximonterrico.com" />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono *</Label>
              <Input id="phone" {...form.register('phone')} placeholder="+51 999 999 999" />
              {form.formState.errors.phone && (
                <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={form.watch('role')}
                onValueChange={(v) => form.setValue('role', v as 'admin' | 'gerente' | 'asesor')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="asesor">Asesor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="status">Activo</Label>
              <Switch
                id="status"
                checked={form.watch('status')}
                onCheckedChange={(v) => form.setValue('status', !!v)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewUserOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#13944C] hover:bg-[#0f7a3d]">
                Crear usuario
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
