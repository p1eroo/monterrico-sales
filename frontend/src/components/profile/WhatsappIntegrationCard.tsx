import { useEffect, useMemo, useState } from 'react';
import * as QRCode from 'qrcode';
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  Play,
  QrCode,
  RefreshCw,
  SendHorizonal,
  Smartphone,
  Unplug,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  connectMyWhatsapp,
  disconnectMyWhatsapp,
  fetchMyWhatsappConnection,
  sendMyWhatsappTestMessage,
  type WhatsappConnectionResponse,
} from '@/lib/whatsappApi';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type BusyAction = 'connect' | 'disconnect' | 'test' | null;

function visualConnectionState(
  instance: WhatsappConnectionResponse['instance'],
): 'connected' | 'disconnected' {
  if (instance?.isConnected) return 'connected';
  return 'disconnected';
}

function statusLabel(instance: WhatsappConnectionResponse['instance']): string {
  const state = visualConnectionState(instance);
  if (state === 'connected') return 'Conectado';
  return 'Desconectado';
}

function statusTextClassName(instance: WhatsappConnectionResponse['instance']): string {
  const state = visualConnectionState(instance);
  if (state === 'connected') return 'text-[#13944C]';
  return 'text-destructive';
}

function formatDateLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('es-PE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function normalizeQrImageSrc(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (raw.startsWith('data:image/')) return raw;
  if (/^[A-Za-z0-9+/=\r\n]+$/.test(raw)) {
    return `data:image/png;base64,${raw.replace(/\s+/g, '')}`;
  }
  return null;
}

export function WhatsappIntegrationCard() {
  const [connection, setConnection] = useState<WhatsappConnectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [testMessage, setTestMessage] = useState('Hola, este es un mensaje de prueba desde el CRM.');

  const instance = connection?.instance ?? null;
  const canManage = connection?.canManage ?? false;

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const next = await fetchMyWhatsappConnection();
      setConnection(next);
    } catch (e) {
      if (!silent) {
        toast.error(e instanceof Error ? e.message : 'No se pudo cargar la conexión de WhatsApp');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const raw = instance?.qrText?.trim();
    if (!raw) {
      setQrPreview(normalizeQrImageSrc(instance?.qrCode));
      return () => {
        cancelled = true;
      };
    }
    void QRCode.toDataURL(raw, {
      margin: 1,
      width: 260,
    })
      .then((dataUrl: string) => {
        if (!cancelled) setQrPreview(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrPreview(normalizeQrImageSrc(instance?.qrCode));
      });
    return () => {
      cancelled = true;
    };
  }, [instance?.qrCode, instance?.qrText]);

  useEffect(() => {
    if (!instance || instance.isConnected) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void load(true);
    }, 5000);
    return () => window.clearInterval(id);
  }, [instance?.id, instance?.isConnected, instance?.qrCode, instance?.qrText, instance?.pairingCode]);

  useEffect(() => {
    if (instance?.isConnected) {
      setQrModalOpen(false);
    }
  }, [instance?.isConnected]);

  async function runAction(action: BusyAction, fn: () => Promise<WhatsappConnectionResponse>) {
    setBusy(action);
    try {
      const next = await fn();
      setConnection(next);
      return next;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo completar la acción');
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function handleConnect() {
    const next = await runAction('connect', connectMyWhatsapp);
    if (!next) return;
    if (next.instance?.isConnected) {
      setQrModalOpen(false);
      toast.success('WhatsApp conectado');
      return;
    }
    setQrModalOpen(true);
    toast.success('QR de WhatsApp generado');
  }

  async function handleDisconnect() {
    const next = await runAction('disconnect', disconnectMyWhatsapp);
    if (!next) return;
    setQrModalOpen(false);
    toast.success('WhatsApp desconectado');
  }

  async function handleSendTestMessage() {
    const number = testNumber.trim();
    const text = testMessage.trim();
    if (!number || !text) {
      toast.error('Ingresa el número y el mensaje de prueba');
      return;
    }

    setBusy('test');
    try {
      await sendMyWhatsappTestMessage({ number, text });
      setTestModalOpen(false);
      toast.success('Mensaje de prueba enviado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar el mensaje de prueba');
    } finally {
      setBusy(null);
    }
  }

  const helperCopy = useMemo(() => {
    if (!canManage) {
      return 'EVOGO_MANAGER_API_KEY y EVOGO_WEBHOOK_URL no están configurados.';
    }
    if (!instance) {
      return 'Genera tu QR y escanéalo desde WhatsApp';
    }
    if (instance.isConnected) {
      return 'Tu número está vinculado';
    }
    return 'Si el QR vence o no carga, vuelve a generarlo.';
  }, [canManage, instance]);

  const generatedAt = formatDateLabel(instance?.qrGeneratedAt);

  return (
    <>
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-none dark:shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-[#25d366]/10">
            <MessageCircle className="size-6 text-[#25d366]" />
          </div>
          <div>
            <p className="font-medium">WhatsApp</p>
            <p className="mt-1 text-sm text-muted-foreground">{helperCopy}</p>
            {instance?.displayLineId ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Línea: <span className="font-medium text-foreground">{instance.displayLineId}</span>
              </p>
            ) : null}
            {instance?.lastError ? (
              <p className="mt-2 text-xs text-destructive">{instance.lastError}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-4 rounded-xl border bg-muted/20 p-4">
        {loading ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            Cargando conexión…
          </div>
        ) : instance?.isConnected ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center">
              <CheckCircle2 className="size-15 text-[#13944C]" />
            </div>
            <div className="space-y-1">
              <p className={`font-medium ${statusTextClassName(instance)}`}>
                {statusLabel(instance)}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[175px] flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center">
              <Unplug className="size-10 text-destructive" />
            </div>
            <div className="space-y-1">
              <p className={`font-medium ${statusTextClassName(instance)}`}>
                {statusLabel(instance)}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-background/40 p-3">
            <p className="text-xs text-muted-foreground">Instancia</p>
            <p className="mt-1 text-sm font-medium">{instance?.instanceName || 'Sin instancia'}</p>
          </div>
          <div className="rounded-lg bg-background/40 p-3">
            <p className="text-xs text-muted-foreground">Línea</p>
            <p className="mt-1 text-sm font-medium">{instance?.displayLineId || 'Pendiente'}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2"> 
          {instance?.isConnected ? (
            <Button
              variant="outline"
              onClick={() => void handleDisconnect()}
              disabled={busy !== null}
            >
              {busy === 'disconnect' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Unplug className="size-4" />
              )}
              Desconectar
            </Button>
          ) : (
            <Button
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              onClick={() => void handleConnect()}
              disabled={!canManage || busy !== null}
            >
              {busy === 'connect' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <QrCode className="size-4" />
              )}
              {instance ? 'Regenerar QR' : 'Conectar WhatsApp'}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setTestModalOpen(true)}
            disabled={!instance?.isConnected || busy !== null}
          >
            <Play className="size-4" />
            Test
          </Button>
        </div>
      </div>
    </div>
    <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-5 text-[#25d366]" />
            Conectar WhatsApp
          </DialogTitle>
          <DialogDescription>
            Escanea este QR con tu WhatsApp para conectar la instancia {instance?.instanceName || 'personal'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border bg-muted/20 p-4 text-center">
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-8 animate-spin" />
                Cargando QR…
              </div>
            ) : qrPreview ? (
              <>
                <img
                  src={qrPreview}
                  alt="QR de conexión de WhatsApp"
                  className="w-full max-w-[260px] rounded-lg bg-white p-3"
                />
                {generatedAt ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Generado: {generatedAt}
                  </p>
                ) : null}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <Smartphone className="size-10 text-muted-foreground" />
                <p className="font-medium">Tu QR aparecerá aquí</p>
                <p className="text-sm text-muted-foreground">
                  Genera o actualiza el código para poder escanearlo.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-sm font-medium">Cómo conectarlo</p>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
              <li>Abre WhatsApp en tu celular.</li>
              <li>Entra a dispositivos vinculados.</li>
              <li>Selecciona conectar un dispositivo.</li>
              <li>Escanea el código QR que ves en esta ventana.</li>
              <li>Cuando se conecte, el modal se cerrará automáticamente.</li>
            </ol>
          </div>

          {instance?.pairingCode ? (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Código de vinculación
              </p>
              <p className="mt-1 font-mono text-base">{instance.pairingCode}</p>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => void handleConnect()}
              disabled={!canManage || busy !== null}
            >
              {busy === 'connect' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Actualizar QR
            </Button>
            <Button variant="outline" onClick={() => setQrModalOpen(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>Enviar mensaje de prueba</DialogTitle>
          <DialogDescription>
            Instancia: {instance?.instanceName || 'personal'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Número de WhatsApp</p>
            <Input
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              placeholder="51987654321"
              disabled={busy !== null}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Con código de país, sin `+` ni espacios.
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Mensaje</p>
            <Textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Hola, este es un mensaje de prueba..."
              rows={4}
              disabled={busy !== null}
            />
          </div>

          <Button
            className="w-full bg-[#13944C] hover:bg-[#0f7a3d]"
            onClick={() => void handleSendTestMessage()}
            disabled={!instance?.isConnected || busy !== null}
          >
            {busy === 'test' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SendHorizonal className="size-4" />
            )}
            Enviar mensaje
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
