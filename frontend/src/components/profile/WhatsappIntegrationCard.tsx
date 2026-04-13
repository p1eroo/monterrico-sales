import { useEffect, useMemo, useState } from 'react';
import * as QRCode from 'qrcode';
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Smartphone,
  Unplug,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  connectMyWhatsapp,
  disconnectMyWhatsapp,
  fetchMyWhatsappConnection,
  refreshMyWhatsappConnection,
  type WhatsappConnectionResponse,
} from '@/lib/whatsappApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type BusyAction = 'connect' | 'refresh' | 'disconnect' | null;

function statusLabel(status: string | null | undefined): string {
  const s = (status || '').toLowerCase();
  if (s === 'open') return 'Conectado';
  if (s === 'qr_ready') return 'QR disponible';
  if (s === 'connecting') return 'Conectando';
  if (s === 'close') return 'Desconectado';
  if (s === 'pending') return 'Pendiente';
  return status || 'Sin estado';
}

function statusClassName(status: string | null | undefined): string {
  const s = (status || '').toLowerCase();
  if (s === 'open') return 'border-[#13944C]/30 bg-[#13944C]/10 text-[#13944C]';
  if (s === 'qr_ready') return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  if (s === 'connecting') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (s === 'close') return 'border-muted bg-muted/50 text-muted-foreground';
  return 'border-muted bg-muted/50 text-muted-foreground';
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

  const instance = connection?.instance ?? null;
  const canManage = connection?.canManage ?? false;

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const next = await fetchMyWhatsappConnection();
      setConnection(next);
    } catch (e) {
      if (!silent) {
        toast.error(
          e instanceof Error ? e.message : 'No se pudo cargar el estado de WhatsApp',
        );
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
    if (!instance || instance.status === 'open') return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void load(true);
    }, 5000);
    return () => window.clearInterval(id);
  }, [instance?.id, instance?.status]);

  async function runAction(
    action: BusyAction,
    fn: () => Promise<WhatsappConnectionResponse>,
    successMessage: string,
  ) {
    setBusy(action);
    try {
      const next = await fn();
      setConnection(next);
      toast.success(successMessage);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo completar la acción');
    } finally {
      setBusy(null);
    }
  }

  const helperCopy = useMemo(() => {
    if (!canManage) {
      return 'El backend aún necesita EVOGO_MANAGER_API_KEY y EVOGO_WEBHOOK_URL para habilitar la conexión personal por QR.';
    }
    if (!instance) {
      return 'Genera tu QR y escanéalo desde WhatsApp en tu teléfono para vincular tu línea al CRM.';
    }
    if (instance.status === 'open') {
      return 'Tu línea está lista. Los mensajes nuevos de WhatsApp se asociarán a tu instancia personal.';
    }
    return 'Si el QR vence o no carga, vuelve a generarlo y escanéalo desde WhatsApp.';
  }, [canManage, instance]);

  const generatedAt = formatDateLabel(instance?.qrGeneratedAt);
  const connectedAt = formatDateLabel(instance?.lastConnectedAt);

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-[#25d366]/10">
            <MessageCircle className="size-6 text-[#25d366]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">WhatsApp personal</p>
              <Badge variant="outline" className={statusClassName(instance?.status)}>
                {statusLabel(instance?.status)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{helperCopy}</p>
            {instance?.displayLineId ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Línea: <span className="font-medium text-foreground">{instance.displayLineId}</span>
              </p>
            ) : null}
            {connectedAt ? (
              <p className="text-xs text-muted-foreground">
                Última conexión: {connectedAt}
              </p>
            ) : null}
            {instance?.lastError ? (
              <p className="mt-2 text-xs text-destructive">{instance.lastError}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              void runAction(
                'refresh',
                refreshMyWhatsappConnection,
                'Estado de WhatsApp actualizado',
              )
            }
            disabled={loading || busy !== null || !instance}
          >
            {busy === 'refresh' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Actualizar
          </Button>

          {instance?.isConnected ? (
            <Button
              variant="outline"
              onClick={() =>
                void runAction(
                  'disconnect',
                  disconnectMyWhatsapp,
                  'WhatsApp desconectado',
                )
              }
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
              onClick={() =>
                void runAction(
                  'connect',
                  connectMyWhatsapp,
                  'QR de WhatsApp generado',
                )
              }
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
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-4 text-center">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-8 animate-spin" />
              Cargando estado…
            </div>
          ) : qrPreview ? (
            <>
              <img
                src={qrPreview}
                alt="QR de conexión de WhatsApp"
                className="w-full max-w-[240px] rounded-lg bg-white p-3"
              />
              <p className="mt-3 text-sm font-medium">Escanea este QR con tu WhatsApp</p>
              {generatedAt ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Generado: {generatedAt}
                </p>
              ) : null}
            </>
          ) : instance?.isConnected ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="size-10 text-[#13944C]" />
              <p className="font-medium">Instancia conectada</p>
              <p className="text-sm text-muted-foreground">
                Ya no necesitas escanear un QR mientras la sesión siga activa.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <Smartphone className="size-10 text-muted-foreground" />
              <p className="font-medium">Tu QR aparecerá aquí</p>
              <p className="text-sm text-muted-foreground">
                Genera el código y escanéalo desde WhatsApp en tu teléfono.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-xl border p-4">
          <p className="text-sm font-medium">Cómo conectarlo</p>
          <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
            <li>Haz clic en `Conectar WhatsApp` o `Regenerar QR`.</li>
            <li>Abre WhatsApp en tu teléfono y entra a dispositivos vinculados.</li>
            <li>Escanea el QR que aparece en esta pantalla.</li>
            <li>Espera a que el estado cambie a `Conectado`.</li>
          </ol>

          {instance?.pairingCode ? (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Código de vinculación
              </p>
              <p className="mt-1 font-mono text-base">{instance.pairingCode}</p>
            </div>
          ) : null}

          {instance ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Instancia</p>
                <p className="mt-1 text-sm font-medium">{instance.instanceName}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Estado actual</p>
                <p className="mt-1 text-sm font-medium">{statusLabel(instance.status)}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
