import { useEffect, useState } from 'react';
import { Copy, Loader2, Save, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/lib/notify';
import {
  fetchFlotaInstanceConfig,
  updateFlotaInstanceConfig,
  type FlotaEvolutionInstanceConfig,
  type FlotaInstanceDetail,
} from '@/lib/flotaWhatsappApi';
import { cn } from '@/lib/utils';

type Props = {
  instance: FlotaInstanceDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-mono break-all">{value || '—'}</div>
    </div>
  );
}

function InstanceStatusBadge({ inst }: { inst: Pick<FlotaInstanceDetail, 'isConnected' | 'status'> }) {
  const label = inst.isConnected
    ? 'Conectado'
    : inst.status === 'qr_ready'
      ? 'QR pendiente'
      : inst.status === 'connecting'
        ? 'Conectando'
        : 'Desconectado';
  const tone = inst.isConnected ? 'connected' : inst.status === 'qr_ready' || inst.status === 'connecting' ? 'pending' : 'off';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'connected'
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : tone === 'pending'
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
            : 'bg-red-500/10 text-red-700 dark:text-red-400',
      )}
    >
      {label}
    </span>
  );
}

export function FlotaEvolutionConfigDialog({ instance, open, onOpenChange, onUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [savingAdvanced, setSavingAdvanced] = useState(false);
  const [config, setConfig] = useState<FlotaEvolutionInstanceConfig | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [rabbitmqEnable, setRabbitmqEnable] = useState('Padrão');
  const [websocketEnable, setWebsocketEnable] = useState('Padrão');
  const [natsEnable, setNatsEnable] = useState('Padrão');
  const [advanced, setAdvanced] = useState({
    alwaysOnline: false,
    rejectCall: true,
    readMessages: false,
    ignoreGroups: true,
    ignoreStatus: false,
    msgRejectCall: '',
  });

  useEffect(() => {
    if (!open || !instance?.id) return;
    setLoading(true);
    fetchFlotaInstanceConfig(instance.id)
      .then((data) => {
        setConfig(data);
        setWebhookUrl(data.webhook.url);
        setWebhookEvents(data.webhook.events.map((e) => e.toUpperCase()));
        setRabbitmqEnable(data.webhook.rabbitmqEnable || 'Padrão');
        setWebsocketEnable(data.webhook.websocketEnable || 'Padrão');
        setNatsEnable(data.webhook.natsEnable || 'Padrão');
        setAdvanced(data.advanced);
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : 'No se pudo cargar la configuración');
        onOpenChange(false);
      })
      .finally(() => setLoading(false));
  }, [open, instance?.id, onOpenChange]);

  const toggleEvent = (event: string, checked: boolean) => {
    setWebhookEvents((prev) => {
      const upper = event.toUpperCase();
      if (checked) return [...new Set([...prev, upper])];
      return prev.filter((item) => item !== upper);
    });
  };

  const handleSaveWebhook = async () => {
    if (!instance?.id) return;
    setSavingWebhook(true);
    try {
      await updateFlotaInstanceConfig(instance.id, {
        webhookUrl: webhookUrl.trim(),
        webhookEvents,
        rabbitmqEnable,
        websocketEnable,
        natsEnable,
      });
      toast.success('Webhook guardado en Evolution GO');
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar webhook');
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleSaveAdvanced = async () => {
    if (!instance?.id) return;
    setSavingAdvanced(true);
    try {
      await updateFlotaInstanceConfig(instance.id, { advanced });
      toast.success('Opciones avanzadas guardadas en Evolution GO');
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar opciones avanzadas');
    } finally {
      setSavingAdvanced(false);
    }
  };

  const copyToken = async () => {
    if (!config?.token) return;
    try {
      await navigator.clipboard.writeText(config.token);
      toast.success('Token copiado');
    } catch {
      toast.error('No se pudo copiar el token');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Configuración: {instance?.instanceName ?? 'Evolution GO'}
          </DialogTitle>
          <DialogDescription>
            Opciones sincronizadas con Evolution GO para esta instancia del CRM.
          </DialogDescription>
        </DialogHeader>

        {loading || !config || !instance ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <section className="space-y-3 rounded-xl border p-4">
              <h3 className="text-sm font-semibold">Información de la instancia</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow label="Nombre" value={instance.instanceName} />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Estado</Label>
                  <div>
                    <InstanceStatusBadge inst={instance} />
                  </div>
                </div>
                <InfoRow label="Número" value={config.number || '—'} />
                <InfoRow label="Nombre del perfil" value={config.profileName || '—'} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Token de la instancia</Label>
                <div className="flex gap-2">
                  <Input value={config.token} readOnly className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" onClick={() => void copyToken()} title="Copiar token">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border p-4">
              <h3 className="text-sm font-semibold">Webhook</h3>
              <div className="space-y-2">
                <Label htmlFor="webhook-url">URL del webhook</Label>
                <Input
                  id="webhook-url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder={config.suggestedWebhookUrl}
                />
                <p className="text-xs text-muted-foreground">
                  Sugerida por el CRM: {config.suggestedWebhookUrl}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Eventos del webhook</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {config.availableEvents.map((event) => {
                    const checked = webhookEvents.includes(event.toUpperCase());
                    return (
                      <label key={event} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
                        <Checkbox checked={checked} onCheckedChange={(v) => toggleEvent(event, v === true)} />
                        <span>{event}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="rabbitmq">RabbitMQ</Label>
                  <Input id="rabbitmq" value={rabbitmqEnable} onChange={(e) => setRabbitmqEnable(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="websocket">WebSocket</Label>
                  <Input id="websocket" value={websocketEnable} onChange={(e) => setWebsocketEnable(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nats">NATS</Label>
                  <Input id="nats" value={natsEnable} onChange={(e) => setNatsEnable(e.target.value)} />
                </div>
              </div>
              <Button onClick={() => void handleSaveWebhook()} disabled={savingWebhook}>
                {savingWebhook ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar webhook
              </Button>
            </section>

            <section className="space-y-3 rounded-xl border p-4">
              <h3 className="text-sm font-semibold">Opciones avanzadas</h3>
              <div className="space-y-3">
                {[
                  { key: 'alwaysOnline' as const, label: 'Always Online', hint: 'Mantener siempre en línea en WhatsApp' },
                  { key: 'rejectCall' as const, label: 'Reject Call', hint: 'Rechazar llamadas automáticamente' },
                  { key: 'readMessages' as const, label: 'Read Messages', hint: 'Marcar mensajes como leídos' },
                  { key: 'ignoreGroups' as const, label: 'Ignore Groups', hint: 'Ignorar mensajes de grupos' },
                  { key: 'ignoreStatus' as const, label: 'Ignore Status', hint: 'Ignorar actualizaciones de estado' },
                ].map((item) => (
                  <label key={item.key} className="flex items-start gap-3 rounded-md border px-3 py-2">
                    <Checkbox
                      checked={advanced[item.key]}
                      onCheckedChange={(v) => setAdvanced((prev) => ({ ...prev, [item.key]: v === true }))}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.hint}</div>
                    </div>
                  </label>
                ))}
              </div>
              <Button onClick={() => void handleSaveAdvanced()} disabled={savingAdvanced}>
                {savingAdvanced ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar avanzadas
              </Button>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
