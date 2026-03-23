import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Search,
  UserPlus,
  MoreHorizontal,
  Eye,
  Pencil,
  UserX,
  UserCheck,
  Shield,
  ChevronLeft,
  ChevronRight,
  Users,
  Filter,
} from 'lucide-react';
import type { User } from '@/types';
import { useRoles, type ApiRole } from '@/hooks/useRoles';
import { PERMISSION_MODULES, PERMISSION_ACTIONS } from '@/data/rbac';
import type { RBACRole, PermissionKey } from '@/types';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserFormModal, type UserFormData } from '@/components/users/UserFormModal';
import { RoleCard } from '@/components/roles/RoleCard';
import { PermissionMatrix } from '@/components/roles/PermissionMatrix';
import { CreateRoleDialog } from '@/components/roles/CreateRoleDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDate } from '@/lib/formatters';
import { api } from '@/lib/api';
import { apiUserRecordToUser, type ApiUserRecord } from '@/lib/userRoleMap';

const PAGE_SIZE = 10;

function apiRoleToRBACRole(r: ApiRole): RBACRole & { isSystem?: boolean } {
  const allKeys = PERMISSION_MODULES.flatMap((mod) =>
    PERMISSION_ACTIONS.map((act) => `${mod.id}.${act.id}` as PermissionKey),
  );
  const permissions = allKeys.reduce(
    (acc, k) => ({ ...acc, [k]: r.permissions.includes(k) }),
    {} as Record<PermissionKey, boolean>,
  );
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    templateId: r.isSystem ? r.slug : undefined,
    permissions,
    userCount: r.userCount ?? 0,
    isSystem: r.isSystem,
  };
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = [
    'bg-emerald-100 text-emerald-700',
    'bg-blue-100 text-blue-700',
    'bg-amber-100 text-amber-700',
    'bg-violet-100 text-violet-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
}

function formatLastActivity(isoStr?: string) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return formatDate(isoStr);
}

export default function UsersPage() {
  const navigate = useNavigate();
  const { roles: apiRoles, loadRoles } = useRoles();
  const roles = useMemo(() => apiRoles.map(apiRoleToRBACRole), [apiRoles]);
  const roleLabels = useMemo(
    () => Object.fromEntries(roles.map((r) => [r.id, r.name])),
    [roles],
  );
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [sortBy] = useState<'name' | 'username' | 'joinedAt' | 'lastActivity'>('name');
  const [page, setPage] = useState(1);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<(RBACRole & { isSystem?: boolean }) | null>(null);
  const [roleEditDraft, setRoleEditDraft] = useState<Record<PermissionKey, boolean> | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const list = await api<ApiUserRecord[]>('/users');
      const mapped = list.map(apiUserRecordToUser);
      setUsers(mapped);
    } catch (e) {
      setUsers([]);
      setListError(e instanceof Error ? e.message : 'Error al cargar usuarios');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      const matchSearch =
        !search ||
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.email?.toLowerCase().includes(q) ?? false);
      const matchRole =
        roleFilter === 'todos' || u.roleId === roleFilter;
      const matchStatus =
        statusFilter === 'todos' || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'username')
        return a.username.localeCompare(b.username);
      if (sortBy === 'joinedAt') return b.joinedAt.localeCompare(a.joinedAt);
      if (sortBy === 'lastActivity') {
        const aVal = a.lastActivity ?? '';
        const bVal = b.lastActivity ?? '';
        return bVal.localeCompare(aVal);
      }
      return 0;
    });
  }, [filteredUsers, sortBy]);

  const totalPages = Math.ceil(sortedUsers.length / PAGE_SIZE);
  const paginatedUsers = sortedUsers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  async function handleUserSubmit(data: UserFormData) {
    if (editingUser) {
      try {
        await api<ApiUserRecord>(`/users/${editingUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: data.name.trim(),
            roleId: data.roleId,
            status: data.status,
          }),
        });
        await loadUsers();
        toast.success('Usuario actualizado');
        setEditingUser(null);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : 'No se pudo actualizar el usuario';
        toast.error(msg);
        throw e;
      }
      return;
    }

    try {
      await api<ApiUserRecord>('/users', {
        method: 'POST',
        body: JSON.stringify({
          username: data.username.trim(),
          name: data.name.trim(),
          password: data.password,
          roleId: data.roleId,
          status: data.status,
        }),
      });
      await loadUsers();
      toast.success('Usuario creado en el servidor');
      setEditingUser(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo crear el usuario';
      toast.error(msg);
      throw e;
    }
  }

  async function patchUserStatus(u: User, nextActive: boolean) {
    try {
      await api<ApiUserRecord>(`/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextActive }),
      });
      await loadUsers();
      toast.success(nextActive ? 'Usuario activado' : 'Usuario desactivado');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo cambiar el estado',
      );
    }
  }

  async function handleCreateRole(role: Omit<RBACRole, 'userCount'>) {
    const permissions = (Object.entries(role.permissions) as [PermissionKey, boolean][])
      .filter(([, v]) => v)
      .map(([k]) => k);
    try {
      await api<ApiRole>('/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: role.name,
          description: role.description || undefined,
          permissions,
        }),
      });
      await loadRoles();
      toast.success(`Rol "${role.name}" creado`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo crear el rol';
      toast.error(msg);
      throw e;
    }
  }

  function handleRolePermissionsChange(roleId: string, key: PermissionKey, value: boolean) {
    setRoleEditDraft((prev) => {
      const base = prev ?? roles.find((r) => r.id === roleId)?.permissions ?? {};
      return { ...base, [key]: value };
    });
  }

  function handleOpenEditRole(role: RBACRole & { isSystem?: boolean }) {
    setEditingRole(role);
    setRoleEditDraft({ ...role.permissions });
  }

  async function handleSaveRolePermissions() {
    if (!editingRole || !roleEditDraft) return;
    const r = roles.find((x) => x.id === editingRole.id) as (RBACRole & { isSystem?: boolean }) | undefined;
    if (r?.isSystem) {
      toast.error('No se pueden modificar los permisos de roles del sistema');
      return;
    }
    const permissions = (Object.entries(roleEditDraft) as [PermissionKey, boolean][])
      .filter(([, v]) => v)
      .map(([k]) => k);
    try {
      await api(`/roles/${editingRole.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ permissions }),
      });
      await loadRoles();
      setEditingRole(null);
      setRoleEditDraft(null);
      toast.success('Permisos actualizados');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudieron actualizar los permisos';
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios y Roles"
        description="Gestiona usuarios, roles y permisos del CRM"
      />

      <Tabs defaultValue="usuarios" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="usuarios" className="gap-2">
            <Users className="size-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="size-4" />
            Roles y Permisos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="space-y-4">
          {listError && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="pt-6">
                <p className="text-sm text-destructive">
                  {listError}{' '}
                  <span className="text-muted-foreground">
                    (inicia sesión como admin o revisa que el backend esté en marcha)
                  </span>
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o usuario..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="size-4" />
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los roles</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="bg-[#13944C] hover:bg-[#0f7a3d] shrink-0"
              onClick={() => {
                setEditingUser(null);
                setUserFormOpen(true);
              }}
            >
              <UserPlus className="size-4" />
              Crear usuario
            </Button>
          </div>

          {listLoading ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-sm text-muted-foreground">
                  Cargando usuarios…
                </p>
              </CardContent>
            </Card>
          ) : paginatedUsers.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <EmptyState
                  icon={Users}
                  title="Sin usuarios"
                  description={
                    listError
                      ? 'No se pudo obtener la lista.'
                      : 'No hay usuarios que coincidan con los filtros.'
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <>
            <Card className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Usuario</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Última actividad</TableHead>
                    <TableHead>Fecha creación</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <Avatar className="size-8">
                          <AvatarFallback
                            className={`text-xs ${getAvatarColor(u.name)}`}
                          >
                            {getInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {roleLabels[u.roleId ?? ''] ?? u.role ?? '—'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.status === 'activo' ? 'default' : 'secondary'}
                        >
                          {u.status === 'activo' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatLastActivity(u.lastActivity)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(u.joinedAt)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate(`/users/${u.id}`)}
                            >
                              <Eye className="size-4" />
                              Ver perfil
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingUser(u);
                                setUserFormOpen(true);
                              }}
                            >
                              <Pencil className="size-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                void patchUserStatus(
                                  u,
                                  u.status !== 'activo',
                                )
                              }
                            >
                              {u.status === 'activo' ? (
                                <>
                                  <UserX className="size-4" />
                                  Desactivar
                                </>
                              ) : (
                                <>
                                  <UserCheck className="size-4" />
                                  Activar
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    {sortedUsers.length} usuario{sortedUsers.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
            <div className="grid gap-3 sm:grid-cols-2 md:hidden">
              {paginatedUsers.map((u) => (
                <Card key={u.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="size-12">
                        <AvatarFallback
                          className={`text-sm ${getAvatarColor(u.name)}`}
                        >
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{u.name}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-[10px]">
                            {roleLabels[u.roleId ?? 'r3']}
                          </Badge>
                          <Badge
                            variant={u.status === 'activo' ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {u.status}
                          </Badge>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => navigate(`/users/${u.id}`)}
                          >
                            <Eye className="size-4" />
                            Ver perfil
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingUser(u);
                              setUserFormOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                            Editar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="flex justify-end">
            <Button
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              onClick={() => setCreateRoleOpen(true)}
            >
              <Shield className="size-4" />
              Crear rol
            </Button>
          </div>

          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                onEdit={(r) => handleOpenEditRole(r)}
                isDefault={!!(role as RBACRole & { isSystem?: boolean }).isSystem}
              />
            ))}
          </div>

          {editingRole && (() => {
            const currentRole = roles.find((r) => r.id === editingRole.id) ?? editingRole;
            const effectivePermissions = roleEditDraft ?? currentRole.permissions;
            const isSystem = !!(currentRole as RBACRole & { isSystem?: boolean }).isSystem;
            return (
              <Dialog
                open={!!editingRole}
                onOpenChange={(open) => {
                  if (!open) {
                    setEditingRole(null);
                    setRoleEditDraft(null);
                  }
                }}
              >
                <DialogContent className="!max-w-[90vw] sm:!max-w-[90vw] lg:!max-w-6xl w-[90vw] sm:w-[90vw] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Editar permisos: {currentRole.name}</DialogTitle>
                    <DialogDescription>
                      {isSystem
                        ? 'Los roles del sistema no permiten modificar permisos.'
                        : 'Modifica los permisos de este rol. Los cambios afectarán a todos los usuarios con este rol.'}
                    </DialogDescription>
                  </DialogHeader>
                  <PermissionMatrix
                    permissions={effectivePermissions}
                    onChange={(key, value) =>
                      handleRolePermissionsChange(currentRole.id, key, value)
                    }
                    disabled={isSystem}
                  />
                  <DialogFooter>
                    <Button
                      onClick={handleSaveRolePermissions}
                      disabled={isSystem}
                      className="bg-[#13944C] hover:bg-[#0f7a3d]"
                    >
                      Guardar cambios
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            );
          })()}
        </TabsContent>
      </Tabs>

      <UserFormModal
        open={userFormOpen}
        onOpenChange={(o) => {
          setUserFormOpen(o);
          if (!o) setEditingUser(null);
        }}
        user={editingUser}
        onSubmit={handleUserSubmit}
      />

      <CreateRoleDialog
        open={createRoleOpen}
        onOpenChange={setCreateRoleOpen}
        onSave={handleCreateRole}
      />
    </div>
  );
}
