import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Phone,
  UserX,
  UserCheck,
  KeyRound,
  Pencil,
  Users,
  Target,
  Activity,
} from 'lucide-react';
import type { User } from '@/types';
import { useRoles } from '@/hooks/useRoles';
import { contacts } from '@/data/mock';
import { opportunities } from '@/data/mock';
import { activities } from '@/data/mock';

import { PageHeader } from '@/components/shared/PageHeader';
import { EntityDetailPageSkeleton } from '@/components/shared/EntityDetailPageSkeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserFormModal, type UserFormData } from '@/components/users/UserFormModal';
import { formatDate } from '@/lib/formatters';
import { api } from '@/lib/api';
import { apiUserRecordToUser, type ApiUserRecord } from '@/lib/userRoleMap';

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

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { roles } = useRoles();
  const roleLabels = Object.fromEntries(roles.map((r) => [r.id, r.name]));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const loadUser = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const row = await api<ApiUserRecord>(`/users/${id}`);
      setUser(apiUserRecordToUser(row));
    } catch (e) {
      setUser(null);
      setLoadError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  if (loading) {
    return <EntityDetailPageSkeleton ariaLabel="Cargando usuario" />;
  }

  if (!user || loadError) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/users')}>
          <ArrowLeft className="size-4" />
          Volver
        </Button>
        <p className="text-muted-foreground">
          {loadError ?? 'Usuario no encontrado.'}
        </p>
      </div>
    );
  }

  const currentUser = user;
  const userContacts = contacts.filter((c) => c.assignedTo === currentUser.id);
  const userOpportunities = opportunities.filter((o) => o.assignedTo === currentUser.id);
  const userActivities = activities
    .filter((a) => a.assignedTo === currentUser.id)
    .slice(0, 10);

  async function handleUserSubmit(data: UserFormData) {
    try {
      await api<ApiUserRecord>(`/users/${currentUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: data.name.trim(),
          roleId: data.roleId,
          status: data.status,
        }),
      });
      await loadUser();
      toast.success('Usuario actualizado');
      setEditOpen(false);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'No se pudo actualizar el usuario';
      toast.error(msg);
      throw e;
    }
  }

  async function handleToggleStatus() {
    try {
      await api<ApiUserRecord>(`/users/${currentUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: currentUser.status !== 'activo',
        }),
      });
      await loadUser();
      toast.success(
        currentUser.status === 'activo' ? 'Usuario desactivado' : 'Usuario activado',
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo cambiar el estado',
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/users')}>
          <ArrowLeft className="size-4" />
        </Button>
        <PageHeader
          title={currentUser.name}
          description={currentUser.role}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <Avatar className="size-20 shrink-0">
                  <AvatarFallback
                    className={`text-2xl ${getAvatarColor(currentUser.name)}`}
                  >
                    {getInitials(currentUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">{currentUser.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      @{currentUser.username}
                      {currentUser.email ? ` · ${currentUser.email}` : ''}
                    </p>
                    {currentUser.phone && (
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="size-4" />
                        {currentUser.phone}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {roleLabels[currentUser.roleId ?? ''] ??
  (currentUser.role === 'admin'
    ? 'Administrador'
    : currentUser.role === 'supervisor'
      ? 'Supervisor Comercial'
      : currentUser.role === 'solo_lectura'
        ? 'Solo lectura'
        : currentUser.role === 'asesor'
          ? 'Asesor Comercial'
          : '—')}
                    </Badge>
                    <Badge
                      variant={currentUser.status === 'activo' ? 'default' : 'secondary'}
                    >
                      {currentUser.status === 'activo' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditOpen(true)}
                    >
                      <Pencil className="size-4" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleToggleStatus()}
                    >
                      {currentUser.status === 'activo' ? (
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
                    </Button>
                    <Button variant="outline" size="sm" disabled>
                      <KeyRound className="size-4" />
                      Reset contraseña (mock)
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="size-4" />
                Actividad reciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {userActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay actividad reciente.
                </p>
              ) : (
                <ul className="space-y-3">
                  {userActivities.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.contactName ?? 'Sin contacto'} · {formatDate(a.dueDate)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {a.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" />
                Contactos asignados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{userContacts.length}</p>
              <Button
                variant="link"
                className="h-auto p-0 text-sm"
                onClick={() => navigate('/contactos')}
              >
                Ver contactos
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="size-4" />
                Oportunidades asignadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{userOpportunities.length}</p>
              <Button
                variant="link"
                className="h-auto p-0 text-sm"
                onClick={() => navigate('/opportunities')}
              >
                Ver oportunidades
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <UserFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        user={currentUser}
        onSubmit={handleUserSubmit}
      />
    </div>
  );
}
