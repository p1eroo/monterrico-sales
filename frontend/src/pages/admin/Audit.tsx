import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ClipboardCopy,
  User,
  FileText,
  AlertTriangle,
  Trash2,
  LogIn,
  RefreshCw,
  Activity,
  History,
} from 'lucide-react';
import type { ActivityLog, AuditLog } from '@/types';
import { actionLabels, moduleLabels } from '@/data/auditMock';
import { useUsers } from '@/hooks/useUsers';
import { fetchActivityLogs } from '@/lib/activityLogsApi';
import { fetchAuditDetailLogs } from '@/lib/auditDetailApi';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { formatDateTime, formatDateGroup } from '@/lib/formatters';

const PAGE_SIZE = 15;

function getActionIcon(action: string) {
  switch (action) {
    case 'crear':
      return FileText;
    case 'eliminar':
    case 'desactivar_usuario':
      return Trash2;
    case 'login':
    case 'login_fallido':
      return LogIn;
    case 'cambiar_etapa':
    case 'actualizar':
      return RefreshCw;
    case 'asignar':
      return User;
    default:
      return Activity;
  }
}

function getActionBadgeVariant(action: string, isCritical?: boolean) {
  if (action === 'eliminar' || action === 'desactivar_usuario' || action === 'login_fallido')
    return 'destructive';
  if (action === 'cambiar_etapa' || isCritical) return 'default';
  return 'secondary';
}

export default function AuditPage() {
  const { users } = useUsers();
  const [activeTab, setActiveTab] = useState<'actividad' | 'auditoria'>('actividad');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [userFilter, setUserFilter] = useState<string>('todos');
  const [moduleFilter, setModuleFilter] = useState<string>('todos');
  const [actionFilter, setActionFilter] = useState<string>('todos');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [previewLog, setPreviewLog] = useState<ActivityLog | null>(null);
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityTotalPages, setActivityTotalPages] = useState(0);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  const [auditDetailLogs, setAuditDetailLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditTotalPages, setAuditTotalPages] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, userFilter, moduleFilter, actionFilter]);

  useEffect(() => {
    if (activeTab !== 'actividad') {
      return;
    }
    let cancelled = false;
    setActivityLoading(true);
    setActivityError(null);
    fetchActivityLogs({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch.trim() || undefined,
      userId: userFilter === 'todos' ? undefined : userFilter,
      module: moduleFilter === 'todos' ? undefined : moduleFilter,
      action: actionFilter === 'todos' ? undefined : actionFilter,
    })
      .then((res) => {
        if (cancelled) return;
        setActivityLogs(res.data);
        setActivityTotal(res.total);
        setActivityTotalPages(res.totalPages);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setActivityError(err.message ?? 'No se pudieron cargar los registros');
        setActivityLogs([]);
        setActivityTotal(0);
        setActivityTotalPages(0);
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    page,
    debouncedSearch,
    userFilter,
    moduleFilter,
    actionFilter,
  ]);

  useEffect(() => {
    if (activeTab !== 'auditoria') {
      return;
    }
    let cancelled = false;
    setAuditLoading(true);
    setAuditError(null);
    fetchAuditDetailLogs({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch.trim() || undefined,
      userId: userFilter === 'todos' ? undefined : userFilter,
      module: moduleFilter === 'todos' ? undefined : moduleFilter,
      action: actionFilter === 'todos' ? undefined : actionFilter,
    })
      .then((res) => {
        if (cancelled) return;
        setAuditDetailLogs(res.data);
        setAuditTotal(res.total);
        setAuditTotalPages(res.totalPages);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setAuditError(err.message ?? 'No se pudo cargar la auditoría detallada');
        setAuditDetailLogs([]);
        setAuditTotal(0);
        setAuditTotalPages(0);
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    page,
    debouncedSearch,
    userFilter,
    moduleFilter,
    actionFilter,
  ]);

  const paginatedActivity = activityLogs;
  const paginatedAudit = auditDetailLogs;

  const activityByDate = useMemo(() => {
    const groups: Record<string, ActivityLog[]> = {};
    for (const log of activityLogs) {
      const key = log.timestamp.slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [activityLogs]);

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registro de auditoría"
        description="Visibilidad completa de la actividad del sistema. Nada se pierde, todo queda registrado."
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as 'actividad' | 'auditoria');
          setPage(1);
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="actividad" className="gap-2">
              <Activity className="size-4" />
              Actividad general
            </TabsTrigger>
            <TabsTrigger value="auditoria" className="gap-2">
              <History className="size-4" />
              Auditoría detallada
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por usuario, entidad, acción..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="size-4" />
                <SelectValue placeholder="Usuario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los usuarios</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Módulo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los módulos</SelectItem>
                {Object.entries(moduleLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las acciones</SelectItem>
                {Object.entries(actionLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="actividad" className="space-y-4">
          {activityError ? (
            <p className="text-sm text-destructive" role="alert">
              {activityError}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              Tabla
            </Button>
            <Button
              variant={viewMode === 'timeline' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('timeline')}
            >
              Timeline
            </Button>
          </div>

          {viewMode === 'table' ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        Cargando actividad…
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {!activityLoading && paginatedActivity.map((log) => {
                    const ActionIcon = getActionIcon(log.action);
                    return (
                      <TableRow
                        key={log.id}
                        className={cn(
                          'cursor-pointer transition-colors hover:bg-muted/50',
                          log.isCritical && 'bg-amber-50/50 dark:bg-amber-950/10'
                        )}
                        onClick={() => setPreviewLog(log)}
                      >
                        <TableCell className="w-10">
                          {log.isCritical && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertTriangle className="size-4 text-amber-600" />
                                </TooltipTrigger>
                                <TooltipContent>Acción crítica</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{log.userName}</TableCell>
                        <TableCell>
                          <Badge
                            variant={getActionBadgeVariant(log.action, log.isCritical) as 'default' | 'secondary' | 'destructive'}
                            className="gap-1"
                          >
                            <ActionIcon className="size-3" />
                            {actionLabels[log.action] ?? log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>{moduleLabels[log.module] ?? log.module}</TableCell>
                        <TableCell className="max-w-[180px] truncate">
                          {log.entityName ?? '—'}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-muted-foreground">
                          {log.description}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {formatDateTime(log.timestamp)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              log.status === 'exito'
                                ? 'default'
                                : log.status === 'fallido'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(JSON.stringify(log, null, 2));
                            }}
                          >
                            <ClipboardCopy className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {!activityLoading && activityTotal === 0 && (
                <CardContent className="py-12">
                  <EmptyState
                    icon={Activity}
                    title="Sin registros"
                    description="No hay actividad que coincida con los filtros."
                  />
                </CardContent>
              )}
              {!activityLoading && activityTotalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    {activityTotal} registro{activityTotal !== 1 ? 's' : ''}
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
                      disabled={page >= activityTotalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <div className="space-y-6">
              {activityLoading ? (
                <p className="text-sm text-muted-foreground">Cargando actividad…</p>
              ) : null}
              {!activityLoading && activityError ? (
                <p className="text-sm text-destructive">{activityError}</p>
              ) : null}
              {activityByDate.map(([dateKey, logs]) => (
                <div key={dateKey}>
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                    {formatDateGroup(dateKey)}
                  </h3>
                  <div className="space-y-2">
                    {logs.map((log) => {
                      const ActionIcon = getActionIcon(log.action);
                      return (
                        <Card
                          key={log.id}
                          className={cn(
                            'cursor-pointer py-0 transition-colors hover:shadow-sm',
                            log.isCritical && 'border-amber-200 dark:border-amber-800'
                          )}
                          onClick={() => setPreviewLog(log)}
                        >
                          <CardContent className="flex items-center gap-4 p-3">
                            <div
                              className={cn(
                                'flex size-10 shrink-0 items-center justify-center rounded-lg',
                                log.isCritical ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-[#13944C]/10'
                              )}
                            >
                              <ActionIcon
                                className={cn(
                                  'size-5',
                                  log.isCritical ? 'text-amber-600' : 'text-[#13944C]'
                                )}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{log.userName}</p>
                              <p className="text-sm text-muted-foreground">{log.description}</p>
                            </div>
                            <Badge variant="secondary">{actionLabels[log.action]}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {formatDateTime(log.timestamp)}
                            </span>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="auditoria" className="space-y-4">
          {auditError ? (
            <p className="text-sm text-destructive" role="alert">
              {auditError}
            </p>
          ) : null}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Usuario</TableHead>
                  <TableHead>Tipo entidad</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Cambios</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      Cargando auditoría detallada…
                    </TableCell>
                  </TableRow>
                ) : null}
                {!auditLoading &&
                  paginatedAudit.map((log) => (
                  <React.Fragment key={log.id}>
                    <TableRow
                      className={cn(
                        'cursor-pointer',
                        (log.action === 'eliminar' || log.action === 'desactivar_usuario') &&
                          'bg-red-50/50 dark:bg-red-950/10'
                      )}
                      onClick={() =>
                        setExpandedAudit(expandedAudit === log.id ? null : log.id)
                      }
                    >
                      <TableCell className="w-10">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedAudit(expandedAudit === log.id ? null : log.id);
                          }}
                        >
                          {expandedAudit === log.id ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{log.userName}</TableCell>
                      <TableCell>{log.entityType}</TableCell>
                      <TableCell>{log.entityName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {actionLabels[log.action] ?? log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {log.entries.length} campo{log.entries.length !== 1 ? 's' : ''}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDateTime(log.timestamp)}
                      </TableCell>
                    </TableRow>
                    {expandedAudit === log.id &&
                      log.entries.map((entry) => (
                        <TableRow key={entry.id} className="bg-muted/30">
                          <TableCell />
                          <TableCell colSpan={2} className="text-muted-foreground text-sm">
                            {entry.fieldChanged}
                          </TableCell>
                          <TableCell colSpan={3} className="space-y-1 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded bg-red-100 px-2 py-0.5 text-xs line-through dark:bg-red-900/40">
                                {entry.oldValue}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs dark:bg-emerald-900/40">
                                {entry.newValue}
                              </span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-6"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyToClipboard(`${entry.oldValue} → ${entry.newValue}`);
                                      }}
                                    >
                                      <ClipboardCopy className="size-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Copiar</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
            {!auditLoading && auditTotal === 0 && (
              <CardContent className="py-12">
                <EmptyState
                  icon={History}
                  title="Sin registros de auditoría detallada"
                  description="Aún no hay cambios campo a campo registrados o no coinciden con los filtros. Edita un contacto, empresa u oportunidad para generar entradas."
                />
              </CardContent>
            )}
            {!auditLoading && auditTotalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  {auditTotal} registro{auditTotal !== 1 ? 's' : ''}
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
                    disabled={
                      activeTab === 'actividad'
                        ? page >= activityTotalPages
                        : page >= auditTotalPages
                    }
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Modal */}
      <Dialog open={!!previewLog} onOpenChange={(o) => !o && setPreviewLog(null)}>
        <DialogContent className="max-w-md">
          {previewLog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Detalle de actividad
                  {previewLog.isCritical && (
                    <AlertTriangle className="size-5 text-amber-600" />
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Usuario</p>
                  <p>{previewLog.userName}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Acción</p>
                  <p>{actionLabels[previewLog.action] ?? previewLog.action}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Módulo</p>
                  <p>{moduleLabels[previewLog.module] ?? previewLog.module}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Descripción</p>
                  <p>{previewLog.description}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Fecha</p>
                  <p>{formatDateTime(previewLog.timestamp)}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Estado</p>
                  <Badge variant={previewLog.status === 'exito' ? 'default' : 'destructive'}>
                    {previewLog.status}
                  </Badge>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
