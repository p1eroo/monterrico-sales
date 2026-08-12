import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Loader2, Radio, Smartphone, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import {
  connectFlotaInstance,
  disconnectFlotaInstance,
  fetchFlotaInstances,
  type FlotaInstanceDetail,
} from '@/lib/flotaWhatsappApi';

interface FlotaEvolutionQrDialogProps {
  instance: FlotaInstanceDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function FlotaEvolutionQrDialog({
  instance,
  open,
  onOpenChange,
  onUpdated,
}: FlotaEvolutionQrDialogProps) {
  const [current, setCurrent] = useState<FlotaInstanceDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const autoConnectRef = useRef<string | null>(null);

  useEffect(() => {
    setCurrent(instance);
  }, [instance]);

  useEffect(() => {
    const raw = current?.qrText?.trim();
    if (!raw) {
      setQrPreview(current?.qrCode?.startsWith('data:image/') ? current.qrCode : null);
      return;
    }
    QRCode.toDataURL(raw, { margin: 1, width: 260 })
      .then((dataUrl: string) => setQrPreview(dataUrl))
      .catch(() => setQrPreview(null));
  }, [current?.qrCode, current?.qrText]);

  useEffect(() => {
    if (!open || !current?.id || current.isConnected) return;
    const timer = window.setInterval(async () => {
      try {
        const list = await fetchFlotaInstances();
        const next = list.find((i) => i.id === current.id);
        if (!next) return;
        setCurrent(next);
        if (next.isConnected) {
          toast.success('WhatsApp conectado');
          onUpdated();
          onOpenChange(false);
        }
      } catch {
        /* polling silencioso */
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [open, current?.id, current?.isConnected, onOpenChange, onUpdated]);

  useEffect(() => {
    if (!open) {
      autoConnectRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !current?.id || current.isConnected || busy) return;
    if (current.qrText || current.qrCode) return;
    if (autoConnectRef.current === current.id) return;
    autoConnectRef.current = current.id;
    void handleConnect();
  }, [open, current, busy]);

  const isConnected = current?.isConnected ?? false;

  async function handleConnect() {
    if (!current) return;
    setBusy('connect');
    try {
      const res = await connectFlotaInstance(current.id);
      setCurrent({ ...current, ...res.instance, id: current.id });
      if (res.instance.isConnected) {
        toast.success('WhatsApp conectado');
        onUpdated();
        onOpenChange(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al conectar');
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect() {
    if (!current) return;
    setBusy('disconnect');
    try {
      await disconnectFlotaInstance(current.id);
      toast.success('Instancia desconectada');
      onUpdated();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al desconectar');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            <Radio className={cn('h-5 w-5', isConnected ? 'text-emerald-500' : 'text-muted-foreground')} />
            {current ? `Conexión: ${current.instanceName}` : 'Evolution GO'}
          </DialogTitle>
          <DialogDescription>
            {isConnected
              ? `${current?.instanceName || 'WhatsApp'} conectado`
              : `Escaneá el QR para conectar ${current?.instanceName ?? 'la instancia'}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isConnected ? (
            <div className="flex min-h-[160px] flex-col items-center justify-center gap-4 text-center">
              <CheckCircle2 className="h-16 w-16 text-emerald-500" />
              <p className="font-medium text-emerald-600 dark:text-emerald-400">Conectado</p>
            </div>
          ) : (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border bg-muted/20 p-4 text-center">
              {qrPreview ? (
                <>
                  <img
                    src={qrPreview}
                    alt="QR de WhatsApp"
                    className="w-full max-w-[260px] rounded-lg bg-white p-3"
                  />
                  {current?.qrGeneratedAt && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Generado: {new Date(current.qrGeneratedAt).toLocaleString('es-PE')}
                    </p>
                  )}
                </>
              ) : busy === 'connect' ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                  <p className="font-medium">Generando QR...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Smartphone className="h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">Genera el QR para conectar</p>
                  <p className="text-sm text-muted-foreground">Presiona Conectar para generar el código QR</p>
                </div>
              )}
            </div>
          )}

          {current?.lastError && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {current.lastError}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {isConnected ? (
              <Button variant="outline" onClick={() => void handleDisconnect()} disabled={busy !== null}>
                {busy === 'disconnect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                Desconectar
              </Button>
            ) : (
              <Button onClick={() => void handleConnect()} disabled={busy !== null}>
                {busy === 'connect' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy === 'connect' ? 'Generando...' : 'Conectar'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
