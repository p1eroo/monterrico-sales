import { Link } from 'react-router-dom';
import { AlertCircle, Loader2, PlugZap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ConnectionState } from './store';

type Props = {
  state: ConnectionState;
  className?: string;
};

export function FlotaWhatsappConnectionBanner({ state, className }: Props) {
  if (state === 'loading' || state === 'ready') return null;

  const isNoInbox = state === 'no-inbox';

  return (
    <div
      className={`mx-4 mb-3 rounded-lg border px-3 py-2.5 text-sm ${isNoInbox ? 'border-amber-500/30 bg-amber-500/10' : 'border-destructive/30 bg-destructive/10'} ${className ?? ''}`}
    >
      <div className="flex items-start gap-2">
        {isNoInbox ? (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        ) : (
          <PlugZap className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">
            {isNoInbox ? 'Sin instancia para inbox' : 'WhatsApp desconectado'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isNoInbox
              ? 'Marca una conexión Evolution GO como Inbox en Integraciones para ver conversaciones aquí.'
              : 'Conecta tu instancia Evolution GO escaneando el código QR en Integraciones.'}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2 h-7 text-xs">
            <Link to="/flota/integraciones/evolution">Ir a Integraciones</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function FlotaWhatsappLoadingState({ label = 'Cargando conversaciones...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
      <Loader2 className="w-8 h-8 text-muted-foreground mb-3 animate-spin" />
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}
