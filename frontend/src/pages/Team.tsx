import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Search, UserPlus, Phone, Users, UserCheck,
  Grid3X3, List, Eye, Pencil, Loader2,
} from 'lucide-react';
import { getISOWeek, getISOWeekYear } from 'date-fns';
import { formatDistanceToNow } from 'date-fns';
import { es as esDateFns } from 'date-fns/locale';
import type { User, Activity, TaskKind } from '@/types';
import { useUsers } from '@/hooks/useUsers';
import { usePermissions } from '@/hooks/usePermissions';
import { UserFormModal, type UserFormData } from '@/components/users/UserFormModal';
import { fetchAnalyticsSummary, type AnalyticsSummary } from '@/lib/analyticsApi';
import { fetchActivitiesList } from '@/lib/activityApi';
import {
  getWeeksInYearForTeamProfile,
  teamProfileYearOptions,
} from '@/lib/teamProfileWeeks';
import { formatCurrencyShort, formatDate } from '@/lib/formatters';

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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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

/** Tipo de actividad en singular para listados (p. ej. Llamada, Reunión). */
const activityTypeSingular: Record<string, string> = {
  llamada: 'Llamada',
  reunion: 'Reunión',
  correo: 'Correo',
  whatsapp: 'WhatsApp',
  nota: 'Nota',
  tarea: 'Tarea',
};

const taskKindSingular: Record<TaskKind, string> = {
  llamada: 'Llamada',
  reunion: 'Reunión',
  correo: 'Correo',
  whatsapp: 'WhatsApp',
};

function activityTypeNameSingular(
  a: Pick<Activity, 'type' | 'taskKind'>,
): string {
  if (a.type === 'tarea' && a.taskKind) {
    return taskKindSingular[a.taskKind] ?? a.taskKind;
  }
  return activityTypeSingular[a.type] ?? a.type;
}

function activityInDateRange(
  a: Activity,
  from: string,
  to: string,
): boolean {
  if (a.status !== 'completada' || !a.completedAt) return false;
  const d = a.completedAt.slice(0, 10);
  return d >= from && d <= to;
}

export default function TeamPage() {
  const { hasPermission } = usePermissions();
  const canCreateUsers = hasPermission('usuarios.crear');
  const canViewAnalytics =
    hasPermission('dashboard.ver') || hasPermission('reportes.ver');
  const canViewActividades = hasPermission('actividades.ver');
  const { users } = useUsers();
  const [newUsersCreated, setNewUsersCreated] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUserOpen, setNewUserOpen] = useState(false);

  const [filterYear, setFilterYear] = useState(() => getISOWeekYear(new Date()));
  const [filterWeekIndex, setFilterWeekIndex] = useState(() => getISOWeek(new Date()));
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [advisorActivities, setAdvisorActivities] = useState<Activity[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const yearOptions = useMemo(() => teamProfileYearOptions(), []);
  const weekOptions = useMemo(
    () => getWeeksInYearForTeamProfile(filterYear),
    [filterYear],
  );

  const activeWeekRange = useMemo(
    () => weekOptions.find((w) => w.weekIndex === filterWeekIndex) ?? null,
    [weekOptions, filterWeekIndex],
  );

  /** Métricas por asesor para la semana filtrada (vista listado) */
  const [advisorKpis, setAdvisorKpis] = useState<
    Record<string, { empresas: number; oportunidades: number; ventas: number; conversion: number }>
  >({});
  const [listMetricsLoading, setListMetricsLoading] = useState(false);

  const advisorIdsKey = useMemo(
    () =>
      [...users, ...newUsersCreated]
        .filter((u) => u.role === 'asesor')
        .map((u) => u.id)
        .sort()
        .join(','),
    [users, newUsersCreated],
  );

  useEffect(() => {
    if (weekOptions.length && !weekOptions.some((w) => w.weekIndex === filterWeekIndex)) {
      setFilterWeekIndex(weekOptions[weekOptions.length - 1]!.weekIndex);
    }
  }, [weekOptions, filterWeekIndex]);

  useEffect(() => {
    if (!canViewAnalytics || !activeWeekRange) {
      setAdvisorKpis({});
      setListMetricsLoading(false);
      return;
    }
    const advisorIdList = advisorIdsKey.split(',').filter(Boolean);
    if (advisorIdList.length === 0) {
      setAdvisorKpis({});
      setListMetricsLoading(false);
      return;
    }
    let cancelled = false;
    setListMetricsLoading(true);
    setAdvisorKpis({});
    const { from, to } = activeWeekRange;
    (async () => {
      const rows = await Promise.all(
        advisorIdList.map(async (id) => {
          try {
            const s = await fetchAnalyticsSummary({ from, to, advisorId: id });
            const empresas = s.companiesByStage?.reduce((acc, g) => acc + g.value, 0) ?? 0;
            return {
              id,
              k: {
                empresas,
                oportunidades: s.kpis.activeOpportunities,
                ventas: s.kpis.closedSalesAmount,
                conversion: s.kpis.conversionPct,
              },
            };
          } catch {
            return { id, k: null };
          }
        }),
      );
      if (cancelled) return;
      const next: typeof advisorKpis = {};
      for (const r of rows) {
        if (r.k) next[r.id] = { ...r.k };
      }
      setAdvisorKpis(next);
      setListMetricsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [canViewAnalytics, activeWeekRange?.from, activeWeekRange?.to, advisorIdsKey]);

  useEffect(() => {
    if (!selectedUser || !activeWeekRange) return;
    let cancelled = false;
    setProfileLoading(true);
    setProfileError(null);

    const { from, to } = activeWeekRange;
    (async () => {
      if (canViewAnalytics) {
        try {
          const s = await fetchAnalyticsSummary({ from, to, advisorId: selectedUser.id });
          if (cancelled) return;
          setSummary(s);
        } catch (e) {
          if (cancelled) return;
          setProfileError(
            e instanceof Error ? e.message : 'Error al cargar analítica del periodo',
          );
          setSummary(null);
        }
      } else {
        setSummary(null);
      }

      if (canViewActividades) {
        try {
          const acts = await fetchActivitiesList({ assignedTo: selectedUser.id, limit: 2500 });
          if (cancelled) return;
          setAdvisorActivities(acts);
        } catch (e) {
          if (cancelled) return;
          toast.error(e instanceof Error ? e.message : 'Error al cargar actividades');
          setAdvisorActivities([]);
        }
      } else {
        setAdvisorActivities([]);
      }

      if (!cancelled) setProfileLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedUser, activeWeekRange, canViewAnalytics, canViewActividades]);

  const actividadesCompletasEnRango = useMemo(() => {
    if (!activeWeekRange) return [];
    const { from, to } = activeWeekRange;
    return advisorActivities.filter((a) => activityInDateRange(a, from, to));
  }, [advisorActivities, activeWeekRange]);

  const actividadesPorTipo = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of actividadesCompletasEnRango) {
      const k =
        a.type === 'tarea' && a.taskKind
          ? `tarea:${a.taskKind}`
          : a.type;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([key, count]) => {
        const [t, kind] = key.split(':');
        const label =
          t === 'tarea' && kind
            ? activityTypeNameSingular({
                type: 'tarea',
                taskKind: kind as TaskKind,
              })
            : activityTypeNameSingular({ type: t, taskKind: undefined });
        return { key, label, count };
      })
      .sort((a, b) => b.count - a.count);
  }, [actividadesCompletasEnRango]);

  const actividadReciente = useMemo(() => {
    return [...actividadesCompletasEnRango]
      .filter((a) => a.completedAt)
      .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))
      .slice(0, 12);
  }, [actividadesCompletasEnRango]);

  const empresasEnPeriodo = useMemo(() => {
    if (!summary?.companiesByStage) return 0;
    return summary.companiesByStage.reduce((s, g) => s + g.value, 0);
  }, [summary]);

  const teamUsers = [...users, ...newUsersCreated];
  /** Solo cartera comercial (`asesor`); gerentes/supervisores no se listan aquí. */
  const salesTeamUsers = teamUsers.filter((u) => u.role === 'asesor');
  const filteredUsers = salesTeamUsers.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.email?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (u.phone?.includes(search) ?? false),
  );

  const totalAsesores = salesTeamUsers.length;
  const asesoresActivos = salesTeamUsers.filter((u) => u.status === 'activo').length;
  const asesoresInactivos = salesTeamUsers.filter((u) => u.status === 'inactivo').length;

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipo Comercial"
        description="Asesores comercialmente asignados (administradores y supervisores se gestionan en Usuarios)"
      >
        {canCreateUsers ? (
          <Button className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={() => setNewUserOpen(true)}>
            <UserPlus className="size-4" /> Nuevo Usuario
          </Button>
        ) : null}
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-start">
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total asesores</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{totalAsesores}</p>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="flex items-center gap-2">
              <UserCheck className="size-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Activos</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{asesoresActivos}</p>
          </CardContent>
        </Card>
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Inactivos</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{asesoresInactivos}</p>
          </CardContent>
        </Card>
      </div>

      {/* Buscador | Año + Semana a la derecha | Vista a la extrema derecha (sin caja con fondo) */}
      <div className="space-y-1.5">
        <div className="flex w-full flex-wrap items-end gap-x-2 gap-y-2 sm:gap-3">
          <div className="relative w-full min-w-0 sm:w-64 sm:max-w-sm sm:shrink-0">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, usuario o teléfono…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-end gap-2 min-[500px]:gap-3">
            <div className="w-28 min-w-0 space-y-1.5">
              <span className="text-xs text-muted-foreground">Año (ISO)</span>
              <Select
                value={String(filterYear)}
                onValueChange={(v) => setFilterYear(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[min(100%,13rem)] min-w-0 space-y-1.5 min-[500px]:w-40">
              <span className="text-xs text-muted-foreground">Semana</span>
              <Select
                value={String(filterWeekIndex)}
                onValueChange={(v) => setFilterWeekIndex(parseInt(v, 10))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weekOptions.map((w) => (
                    <SelectItem key={w.weekIndex} value={String(w.weekIndex)}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 sm:pl-2">
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
        </div>
        {!canViewAnalytics && (
          <p className="text-xs text-muted-foreground">
            Sin permiso de panel o reportes, las cifras no se cargan.
          </p>
        )}
        {canViewAnalytics && listMetricsLoading && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin shrink-0" />
            Cargando métricas del equipo…
          </p>
        )}
        {canViewAnalytics && !listMetricsLoading && (
          <p className="text-[10px] text-muted-foreground/90 leading-relaxed">
            {activeWeekRange
              ? `${formatDate(activeWeekRange.from)} – ${formatDate(activeWeekRange.to)}. `
              : null}
            Empresas, ventas y conversión según el rango. Oportunidades = cartera abierta.
          </p>
        )}
      </div>

      {/* Content */}
      {viewMode === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.map((user) => {
            const k = advisorKpis[user.id];
            const load = canViewAnalytics && listMetricsLoading;
            return (
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
                    <p className="font-medium tabular-nums min-h-[1.1rem] flex items-center justify-center">
                      {load ? <Loader2 className="size-3.5 animate-spin" /> : canViewAnalytics ? (k?.empresas ?? 0) : '—'}
                    </p>
                    <p className="text-muted-foreground">Empresas</p>
                  </div>
                  <div className="rounded bg-muted/50 p-2">
                    <p className="font-medium tabular-nums min-h-[1.1rem] flex items-center justify-center">
                      {load ? <Loader2 className="size-3.5 animate-spin" /> : canViewAnalytics ? (k?.oportunidades ?? 0) : '—'}
                    </p>
                    <p className="text-muted-foreground">Oportunidades</p>
                  </div>
                  <div className="rounded bg-muted/50 p-2">
                    <p className="font-medium break-all leading-tight min-h-[1.1rem] flex items-center justify-center text-[11px] sm:text-xs">
                      {load ? <Loader2 className="size-3.5 animate-spin" /> : canViewAnalytics ? formatCurrencyShort(k?.ventas ?? 0) : '—'}
                    </p>
                    <p className="text-muted-foreground">Ventas</p>
                  </div>
                  <div className="rounded bg-muted/50 p-2">
                    <p className="font-medium tabular-nums min-h-[1.1rem] flex items-center justify-center">
                      {load
                        ? <Loader2 className="size-3.5 animate-spin" />
                        : canViewAnalytics
                          ? `${(k?.conversion ?? 0).toLocaleString('es-PE', { maximumFractionDigits: 1 })}%`
                          : '—'}
                    </p>
                    <p className="text-muted-foreground">Conversión</p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1">Tasa de conversión</p>
                  <Progress
                    value={Math.min(100, Math.max(0, k?.conversion ?? 0))}
                    className="h-2"
                  />
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
            );
          })}
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
                  <TableHead className="text-right">Empresas</TableHead>
                  <TableHead className="text-right">Oportunidades</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Conversión</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const k = advisorKpis[user.id];
                  const load = canViewAnalytics && listMetricsLoading;
                  return (
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
                    <TableCell className="text-right tabular-nums">
                      {load ? <Loader2 className="size-3.5 animate-spin inline" /> : canViewAnalytics ? (k?.empresas ?? 0) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {load ? <Loader2 className="size-3.5 animate-spin inline" /> : canViewAnalytics ? (k?.oportunidades ?? 0) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs sm:text-sm">
                      {load ? <Loader2 className="size-3.5 animate-spin inline" /> : canViewAnalytics ? formatCurrencyShort(k?.ventas ?? 0) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {load
                        ? <Loader2 className="size-3.5 animate-spin inline" />
                        : canViewAnalytics
                          ? `${(k?.conversion ?? 0).toLocaleString('es-PE', { maximumFractionDigits: 1 })}%`
                          : '—'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedUser(user)}>
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-4xl max-h-[min(92vh,880px)] overflow-y-auto">
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
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 md:items-start">
                {/* Columna izquierda: filtros, contacto, KPIs */}
                <div className="space-y-6 min-w-0">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Filtros</h4>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
                    <div className="space-y-1.5 w-full sm:w-36">
                      <span className="text-xs text-muted-foreground">Año (ISO)</span>
                      <Select
                        value={String(filterYear)}
                        onValueChange={(v) => setFilterYear(Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {yearOptions.map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 w-full min-w-0 sm:min-w-[200px] sm:max-w-xs sm:flex-1">
                      <span className="text-xs text-muted-foreground">Semana</span>
                      <Select
                        value={String(filterWeekIndex)}
                        onValueChange={(v) => setFilterWeekIndex(parseInt(v, 10))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {weekOptions.map((w) => (
                            <SelectItem key={w.weekIndex} value={String(w.weekIndex)}>{w.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {activeWeekRange && (
                      <p className="text-xs text-muted-foreground sm:pb-2">
                        {formatDate(activeWeekRange.from)} – {formatDate(activeWeekRange.to)}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Métricas</h4>
                  {profileError && canViewAnalytics && (
                    <p className="text-sm text-destructive mb-2">{profileError}</p>
                  )}
                  {!canViewAnalytics && (
                    <p className="text-sm text-muted-foreground mb-2">
                      Se requiere permiso de panel o reportes para ver métricas del periodo.
                    </p>
                  )}
                  {profileLoading && (
                    <div className="flex items-center justify-center py-6 text-muted-foreground">
                      <Loader2 className="size-5 animate-spin mr-2" /> Cargando…
                    </div>
                  )}
                  {!profileLoading && summary && canViewAnalytics && (
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-2xl font-bold text-[#13944C]">{empresasEnPeriodo}</p>
                        <p className="text-xs text-muted-foreground">Empresas</p>
                        <p className="text-[10px] text-muted-foreground/80 mt-1 leading-tight">Nuevas en el periodo</p>
                      </div>
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-2xl font-bold text-blue-600">{summary.kpis.activeOpportunities}</p>
                        <p className="text-xs text-muted-foreground">Oportunidades</p>
                        <p className="text-[10px] text-muted-foreground/80 mt-1 leading-tight">Abiertas (cartera)</p>
                      </div>
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-600">
                          {formatCurrencyShort(summary.kpis.closedSalesAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground">Ventas</p>
                        <p className="text-[10px] text-muted-foreground/80 mt-1 leading-tight">Ganadas en el periodo</p>
                      </div>
                      <div className="rounded-lg border p-3 text-center">
                        <p className="text-2xl font-bold">
                          {summary.kpis.conversionPct.toLocaleString('es-PE', { maximumFractionDigits: 1 })}%
                        </p>
                        <p className="text-xs text-muted-foreground">Conversión</p>
                        <p className="text-[10px] text-muted-foreground/80 mt-1 leading-tight">Ganadas / contactos creados</p>
                      </div>
                    </div>
                  )}
                </div>
                </div>

                {/* Columna derecha: actividades (una columna en móvil, segunda en md+) */}
                <div className="space-y-6 min-w-0 md:border-l md:pl-6 md:border-t-0 border-t border-border pt-6 md:pt-0">
                <div>
                  <h4 className="text-sm font-medium mb-2">Actividades realizadas</h4>
                  {!canViewActividades && (
                    <p className="text-sm text-muted-foreground">Se requiere permiso de actividades para el detalle.</p>
                  )}
                  {canViewActividades && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {actividadesPorTipo.map((row) => (
                        <div
                          key={row.key}
                          className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                        >
                          <span className="text-muted-foreground">{row.label}</span>
                          <span className="font-semibold">{row.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {canViewActividades && actividadesCompletasEnRango.length === 0 && !profileLoading && (
                    <p className="text-sm text-muted-foreground py-2">Sin actividades completadas en este periodo</p>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Actividad reciente</h4>
                  {!canViewActividades && (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                  {canViewActividades && actividadReciente.length > 0 && (
                    <ul className="space-y-2">
                      {actividadReciente.map((a) => {
                        const when = a.completedAt
                          ? formatDistanceToNow(
                              new Date(`${a.completedAt.slice(0, 10)}T12:00:00`),
                              { addSuffix: true, locale: esDateFns },
                            )
                          : '';
                        return (
                          <li key={a.id} className="flex justify-between gap-3 text-sm">
                            <span className="font-medium text-foreground">
                              {activityTypeNameSingular(a)}
                            </span>
                            <span className="shrink-0 text-muted-foreground text-xs tabular-nums">{when}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {canViewActividades && actividadReciente.length === 0 && !profileLoading && (
                    <p className="text-sm text-muted-foreground">Nada en este periodo</p>
                  )}
                </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {canCreateUsers ? (
        <UserFormModal
          open={newUserOpen}
          onOpenChange={setNewUserOpen}
          user={null}
          onSubmit={handleTeamUserSubmit}
          excludeRoleSlugs={['admin']}
        />
      ) : null}
    </div>
  );
}
