import { useState } from 'react';
import { toast } from 'sonner';
import {
  Search, UserPlus, Phone, Users, Shield, UserCheck,
  Grid3X3, List, Eye, Pencil,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { User } from '@/types';
import { activities } from '@/data/mock';
import { useUsers } from '@/hooks/useUsers';
import { UserFormModal, type UserFormData } from '@/components/users/UserFormModal';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/formatters';
import { api } from '@/lib/api';
import {
  mapApiRoleStringToUserRole,
  joinedAtToDateString,
  type ApiUserRecord,
} from '@/lib/userRoleMap';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  asesor: 'Asesor',
  solo_lectura: 'Solo lectura',
};

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  supervisor: 'bg-blue-100 text-blue-700 border-blue-200',
  asesor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  solo_lectura: 'bg-slate-100 text-slate-700 border-slate-200',
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

const activityTypeLabels: Record<string, string> = {
  llamada: 'Llamadas',
  reunion: 'Reuniones',
  tarea: 'Tareas',
  correo: 'Correos',
  whatsapp: 'WhatsApp',
};

const mockActivity = [
  { id: '1', label: 'Llamada con Minera Los Andes', date: 'Hace 2 horas' },
  { id: '2', label: 'Propuesta enviada a BCP', date: 'Ayer' },
  { id: '3', label: 'Reunión con Hotel Belmond', date: 'Hace 3 días' },
];

export default function TeamPage() {
  const { users } = useUsers();
  const [newUsersCreated, setNewUsersCreated] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUserOpen, setNewUserOpen] = useState(false);

  const teamUsers = [...users, ...newUsersCreated];
  const filteredUsers = teamUsers.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.email?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (u.phone?.includes(search) ?? false),
  );

  const totalMembers = teamUsers.length;
  const activeMembers = teamUsers.filter((u) => u.status === 'activo').length;
  const adminSupervisores = teamUsers.filter(
    (u) => u.role === 'admin' || u.role === 'supervisor',
  ).length;
  const asesores = teamUsers.filter((u) => u.role === 'asesor').length;

  async function handleTeamUserSubmit(data: UserFormData) {
    try {
      const created = await api<ApiUserRecord>('/users', {
        method: 'POST',
        body: JSON.stringify({
          username: data.username.trim(),
          name: data.name.trim(),
          password: data.password,
          roleId: data.roleId,
          status: data.status,
        }),
      });

      const newUser: User = {
        id: created.id,
        name: created.name,
        username: created.username,
        role: mapApiRoleStringToUserRole(created.role),
        roleId: data.roleId,
        status: created.status === 'inactivo' ? 'inactivo' : 'activo',
        contactsAssigned: 0,
        opportunitiesActive: 0,
        salesClosed: 0,
        conversionRate: 0,
        joinedAt: joinedAtToDateString(created.joinedAt),
        lastActivity: created.lastActivity ?? undefined,
      };
      setNewUsersCreated((prev) => [...prev, newUser]);
      toast.success(`Usuario "${data.name}" creado correctamente`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo crear el usuario';
      toast.error(msg);
      throw e;
    }
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
              <span className="text-sm text-muted-foreground">Admin + Supervisores</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{adminSupervisores}</p>
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
            placeholder="Buscar por nombre, usuario o teléfono..."
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
                  {user.phone && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="size-3.5" />
                    {user.phone}
                  </div>
                  )}
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
                    {selectedUser.phone && (
                      <a href={`tel:${selectedUser.phone}`} className="flex items-center gap-2">
                        <Phone className="size-4" /> {selectedUser.phone}
                      </a>
                    )}
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

      <UserFormModal
        open={newUserOpen}
        onOpenChange={setNewUserOpen}
        user={null}
        onSubmit={handleTeamUserSubmit}
      />
    </div>
  );
}
