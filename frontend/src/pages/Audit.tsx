import React, { useState, useMemo } from 'react';
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
import type { ActivityLog } from '@/types';
import { activityLogs, auditLogs, actionLabels, moduleLabels } from '@/data/auditMock';
import { useUsers } from '@/hooks/useUsers';

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
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState<string>('todos');
  const [moduleFilter, setModuleFilter] = useState<string>('todos');
  const [actionFilter, setActionFilter] = useState<string>('todos');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [previewLog, setPreviewLog] = useState<ActivityLog | null>(null);
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);

  const filteredActivityLogs = useMemo(() => {
    return activityLogs.filter((log) => {
      const matchSearch =
        !search ||
        log.userName.toLowerCase().includes(search.toLowerCase()) ||
        log.description.toLowerCase().includes(search.toLowerCase()) ||
        (log.entityName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        actionLabels[log.action]?.toLowerCase().includes(search.toLowerCase());
      const matchUser = userFilter === 'todos' || log.userId === userFilter;
      const matchModule = moduleFilter === 'todos' || log.module === moduleFilter;
      const matchAction = actionFilter === 'todos' || log.action === actionFilter;
      return matchSearch && matchUser && matchModule && matchAction;
    });
  }, [search, userFilter, moduleFilter, actionFilter]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchSearch =
        !search ||
        log.userName.toLowerCase().includes(search.toLowerCase()) ||
        log.entityName.toLowerCase().includes(search.toLowerCase()) ||
        log.entries.some(
          (e) =>
            e.fieldChanged.toLowerCase().includes(search.toLowerCase()) ||
            e.oldValue.toLowerCase().includes(search.toLowerCase()) ||
            e.newValue.toLowerCase().includes(search.toLowerCase())
        );
      const matchUser = userFilter === 'todos' || log.userId === userFilter;
      const matchModule =
        moduleFilter === 'todos' ||
        (log.entityType === 'Contacto' && moduleFilter === 'contactos') ||
        (log.entityType === 'Empresa' && moduleFilter === 'empresas') ||
        (log.entityType === 'Oportunidad' && moduleFilter === 'oportunidades') ||
        (log.entityType === 'Usuario' && moduleFilter === 'usuarios') ||
        (log.entityType === 'Rol' && moduleFilter === 'roles');
      const matchAction = actionFilter === 'todos' || log.action === actionFilter;
      return matchSearch && matchUser && matchModule && matchAction;
    });
  }, [search, userFilter, moduleFilter, actionFilter]);

  const activityPages = Math.ceil(filteredActivityLogs.length / PAGE_SIZE);
  const auditPages = Math.ceil(filteredAuditLogs.length / PAGE_SIZE);
  const paginatedActivity = filteredActivityLogs.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );
  const paginatedAudit = filteredAuditLogs.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const activityByDate = useMemo(() => {
    const groups: Record<string, ActivityLog[]> = {};
    for (const log of filteredActivityLogs) {
      const key = log.timestamp.slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredActivityLogs]);

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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                  {paginatedActivity.map((log) => {
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
              {filteredActivityLogs.length === 0 && (
                <CardContent className="py-12">
                  <EmptyState
                    icon={Activity}
                    title="Sin registros"
                    description="No hay actividad que coincida con los filtros."
                  />
                </CardContent>
              )}
              {activityPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    {filteredActivityLogs.length} registro{filteredActivityLogs.length !== 1 ? 's' : ''}
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
                      disabled={page >= (activeTab === 'actividad' ? activityPages : auditPages)}
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
                {paginatedAudit.map((log) => (
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
                          {actionLabels[log.action]}
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
            {filteredAuditLogs.length === 0 && (
              <CardContent className="py-12">
                <EmptyState
                  icon={History}
                  title="Sin registros de auditoría"
                  description="No hay cambios detallados que coincidan con los filtros."
                />
              </CardContent>
            )}
            {auditPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  {filteredAuditLogs.length} registro{filteredAuditLogs.length !== 1 ? 's' : ''}
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
                    disabled={page >= (activeTab === 'actividad' ? activityPages : auditPages)}
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
                  <p>{actionLabels[previewLog.action]}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Módulo</p>
                  <p>{moduleLabels[previewLog.module]}</p>
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
