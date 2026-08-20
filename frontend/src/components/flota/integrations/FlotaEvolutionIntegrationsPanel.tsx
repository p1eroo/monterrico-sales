import { useCallback, useEffect, useState } from 'react';
import { Loader2, MoreHorizontal, Plus, Radio } from 'lucide-react';
import { LinkCircleSvgIcon } from '@/components/icons/LinkCircleSvgIcon';
import { RefreshSvgIcon } from '@/components/icons/RefreshSvgIcon';
import { SettingsSvgIcon } from '@/components/icons/SettingsSvgIcon';
import { TrashSvgIcon } from '@/components/icons/TrashSvgIcon';
import { UnlinkSvgIcon } from '@/components/icons/UnlinkSvgIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import {
  createFlotaInstance,
  deleteFlotaInstance,
  disconnectFlotaInstance,
  fetchFlotaInstances,
  reconnectFlotaInstance,
  updateFlotaInstanceFlags,
  type FlotaInstanceDetail,
} from '@/lib/flotaWhatsappApi';
import { FlotaEvolutionQrDialog } from './FlotaEvolutionQrDialog';
import { FlotaEvolutionConfigDialog } from './FlotaEvolutionConfigDialog';

function statusLabel(inst: Pick<FlotaInstanceDetail, 'isConnected' | 'status'>) {
  if (inst.isConnected) return 'Conectado';
  if (inst.status === 'qr_ready') return 'QR pendiente';
  if (inst.status === 'connecting') return 'Conectando';
  return 'Desconectado';
}

function statusClass(inst: Pick<FlotaInstanceDetail, 'isConnected' | 'status'>) {
  if (inst.isConnected) return 'connected';
  if (inst.status === 'qr_ready' || inst.status === 'connecting') return 'qr_ready';
  return 'disconnected';
}

function StatusBadge({ inst }: { inst: Pick<FlotaInstanceDetail, 'isConnected' | 'status'> }) {
  const sl = statusClass(inst);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        sl === 'connected'
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : sl === 'qr_ready'
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
            : 'bg-red-500/10 text-red-700 dark:text-red-400',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          sl === 'connected' ? 'bg-emerald-500' : sl === 'qr_ready' ? 'bg-amber-500' : 'bg-red-500',
        )}
      />
      {statusLabel(inst)}
    </span>
  );
}

export function FlotaEvolutionIntegrationsPanel() {
  const [instancias, setInstancias] = useState<FlotaInstanceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newInstancia, setNewInstancia] = useState({ nombre: '', token: '' });
  const [inboxId, setInboxId] = useState<string | null>(null);
  const [masivoIds, setMasivoIds] = useState<Set<string>>(new Set());
  const [qrInstance, setQrInstance] = useState<FlotaInstanceDetail | null>(null);
  const [configInstance, setConfigInstance] = useState<FlotaInstanceDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFlotaInstances();
      setInstancias(data);
      setInboxId(data.find((i) => i.useForInbox)?.id ?? null);
      setMasivoIds(new Set(data.filter((i) => i.useForMasivo).map((i) => i.id)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron cargar las conexiones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = useCallback(async () => {
    if (!newInstancia.nombre.trim()) return;
    setCreating(true);
    try {
      await createFlotaInstance(newInstancia.nombre.trim(), newInstancia.token.trim() || undefined);
      toast.success('Instancia creada en Evolution GO');
      setCreateModalOpen(false);
      setNewInstancia({ nombre: '', token: '' });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear');
    } finally {
      setCreating(false);
    }
  }, [load, newInstancia]);

  const handleConnect = useCallback((inst: FlotaInstanceDetail) => {
    setQrInstance(inst);
  }, []);

  const handleReconnect = useCallback(
    async (inst: FlotaInstanceDetail) => {
      setBusyId(inst.id);
      try {
        const res = await reconnectFlotaInstance(inst.id);
        setQrInstance({ ...inst, ...res.instance, id: inst.id });
        if (res.instance.isConnected) {
          toast.success('WhatsApp reconectado');
          await load();
        } else {
          toast.success('QR generado para reconexión');
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al reconectar');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const handleDisconnect = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await disconnectFlotaInstance(id);
        toast.success('Instancia desconectada');
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al desconectar');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const handleDelete = useCallback(
    async (inst: FlotaInstanceDetail) => {
      if (
        !window.confirm(
          `¿Eliminar "${inst.instanceName}" del CRM y en Evolution GO? Esta acción no se puede deshacer.`,
        )
      ) {
        return;
      }
      setBusyId(inst.id);
      try {
        await deleteFlotaInstance(inst.id);
        toast.success('Instancia eliminada');
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al eliminar');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <Radio className="size-4 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Evolution GO</h2>
                <p className="text-sm text-muted-foreground">
                  Conexiones creadas desde el CRM. Al agregar una, también se registra en Evolution GO.
                </p>
              </div>
            </div>
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setCreateModalOpen(true)}>
            <Plus className="size-4" />
            Agregar conexión
          </Button>
        </div>

        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center rounded-xl border bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium">Número</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-center font-medium">Inbox</th>
                  <th className="px-4 py-3 text-center font-medium">Masivo</th>
                  <th className="px-4 py-3 text-left font-medium">Último error</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {instancias.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No hay conexiones. Usá &quot;Agregar conexión&quot; para crear una instancia en Evolution GO.
                    </td>
                  </tr>
                ) : (
                  instancias.map((inst) => {
                    const ib = busyId === inst.id;
                    return (
                      <tr key={inst.id} className="border-t border-border">
                        <td className="px-4 py-3 font-medium">{inst.instanceName}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {inst.displayLineId || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge inst={inst} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="radio"
                            name="inbox-selection"
                            checked={inboxId === inst.id}
                            onClick={() => {
                              const nv = inboxId === inst.id ? null : inst.id;
                              setInboxId(nv);
                              updateFlotaInstanceFlags(inst.id, { useForInbox: !!nv })
                                .then(() => toast.success(nv ? 'Inbox asignado' : 'Inbox desasignado'))
                                .catch(() => toast.error('Error'));
                            }}
                            readOnly
                            className="size-4 accent-primary"
                            disabled={!inst.isConnected}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={masivoIds.has(inst.id)}
                            disabled={!inst.isConnected}
                            onChange={() => {
                              setMasivoIds((p) => {
                                const n = new Set(p);
                                if (n.has(inst.id)) n.delete(inst.id);
                                else n.add(inst.id);
                                return n;
                              });
                              updateFlotaInstanceFlags(inst.id, { useForMasivo: !masivoIds.has(inst.id) })
                                .then(() =>
                                  toast.success(!masivoIds.has(inst.id) ? 'Agregado a masivo' : 'Quitado de masivo'),
                                )
                                .catch(() => toast.error('Error'));
                            }}
                            className="size-4 accent-primary rounded"
                          />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[180px] truncate">
                          {inst.lastError || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={ib}>
                                {ib ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setConfigInstance(inst)}>
                                <SettingsSvgIcon />
                                Configuración
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {inst.isConnected ? (
                                <DropdownMenuItem onClick={() => void handleDisconnect(inst.id)}>
                                  <UnlinkSvgIcon />
                                  Desconectar
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleConnect(inst)}>
                                  <LinkCircleSvgIcon />
                                  Conectar (QR)
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => void handleReconnect(inst)}>
                                <RefreshSvgIcon />
                                Reconectar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => void handleDelete(inst)}
                              >
                                <TrashSvgIcon />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog
        open={createModalOpen}
        onOpenChange={(o) => {
          setCreateModalOpen(o);
          if (!o) setNewInstancia({ nombre: '', token: '' });
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2">
              <LinkCircleSvgIcon className="h-5 w-5 text-primary" />
              Agregar conexión
            </DialogTitle>
            <DialogDescription>Crea una instancia en Evolution GO y la registra en el CRM</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inst-nombre">Nombre de instancia</Label>
              <Input
                id="inst-nombre"
                value={newInstancia.nombre}
                onChange={(e) => setNewInstancia((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: crm-flota-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inst-token">Token de API (opcional)</Label>
              <Input
                id="inst-token"
                value={newInstancia.token}
                onChange={(e) => setNewInstancia((p) => ({ ...p, token: e.target.value }))}
                placeholder="Se genera automáticamente si se deja vacío"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateModalOpen(false);
                setNewInstancia({ nombre: '', token: '' });
              }}
            >
              Cancelar
            </Button>
            <Button disabled={!newInstancia.nombre.trim() || creating} onClick={() => void handleCreate()}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkCircleSvgIcon className="mr-2 h-4 w-4" />}
              {creating ? 'Creando...' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FlotaEvolutionConfigDialog
        instance={configInstance}
        open={Boolean(configInstance)}
        onOpenChange={(open) => {
          if (!open) setConfigInstance(null);
        }}
        onUpdated={() => void load()}
      />

      <FlotaEvolutionQrDialog
        instance={qrInstance}
        open={Boolean(qrInstance)}
        onOpenChange={(open) => {
          if (!open) setQrInstance(null);
        }}
        onUpdated={() => void load()}
      />
    </>
  );
}
