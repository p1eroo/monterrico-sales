import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  formDialogBtnOutlineClass,
  formDialogBtnPrimaryClass,
  FormDialogShell,
} from '@/components/ui/form-dialog';
import { fetchDeployedBuildId, getClientBuildId } from '@/lib/appVersion';
import { cn } from '@/lib/utils';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const AUTO_RELOAD_SECONDS = 15;

/**
 * Aviso cuando el despliegue (`version.json`) es más reciente que este bundle.
 * Modal centrado con recarga automática tras {@link AUTO_RELOAD_SECONDS}s.
 */
export function AppUpdateBanner() {
  const [pending, setPending] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [remoteBuildId, setRemoteBuildId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_RELOAD_SECONDS);
  const countdownForRef = useRef<string | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  const runCheck = useCallback(async () => {
    const local = getClientBuildId();
    if (local === 'development') {
      setPending(false);
      setRemoteBuildId(null);
      return;
    }

    const remote = await fetchDeployedBuildId();
    if (!remote || remote === local) {
      setPending(false);
      setRemoteBuildId(null);
      return;
    }

    setRemoteBuildId(remote);
    setPending(true);
  }, []);

  useEffect(() => {
    void runCheck();
    const id = window.setInterval(() => void runCheck(), CHECK_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void runCheck();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [runCheck]);

  useEffect(() => {
    if (!pending || !remoteBuildId) return;

    if (countdownForRef.current !== remoteBuildId) {
      countdownForRef.current = remoteBuildId;
      setSecondsLeft(AUTO_RELOAD_SECONDS);
      setModalOpen(true);
    }

    if (countdownIntervalRef.current != null) return;

    countdownIntervalRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current != null) {
            window.clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          window.location.reload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current != null) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [pending, remoteBuildId]);

  function handleReload() {
    window.location.reload();
  }

  function handleLater() {
    setModalOpen(false);
  }

  if (!pending || !remoteBuildId) return null;

  const progress =
    ((AUTO_RELOAD_SECONDS - secondsLeft) / AUTO_RELOAD_SECONDS) * 100;

  return (
    <>
      <FormDialogShell
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) handleLater();
          else setModalOpen(true);
        }}
        showHeaderCloseButton={false}
        maxWidthClassName="sm:max-w-[420px]"
        title="Nueva versión disponible"
        description="Actualiza ahora para corregir errores y evitar fallos con la versión anterior."
        bodyClassName="mt-5 pb-4"
        footer={
          <div className="flex flex-row justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className={cn('min-w-[7.5rem]', formDialogBtnOutlineClass)}
              onClick={handleLater}
            >
              Luego
            </Button>
            <Button
              type="button"
              className={cn('min-w-[9rem]', formDialogBtnPrimaryClass)}
              onClick={handleReload}
            >
              Actualizar ahora
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-5">
          <div
            className="relative flex size-[4.75rem] items-center justify-center"
            aria-live="polite"
            aria-atomic="true"
            aria-label={`Actualización en ${secondsLeft} segundos`}
          >
            <svg
              className="absolute inset-0 size-full -rotate-90"
              viewBox="0 0 36 36"
              aria-hidden
            >
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                className="stroke-muted/80"
                strokeWidth="2"
              />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                className="stroke-[#13944C] transition-[stroke-dashoffset] duration-1000 ease-linear"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={97.4}
                strokeDashoffset={97.4 * (1 - progress / 100)}
              />
            </svg>
            <span className="text-[1.65rem] font-semibold tabular-nums leading-none text-foreground">
              {secondsLeft}
            </span>
          </div>

          <div className="w-full">
            <p className="text-center text-xs text-muted-foreground">
              Si cierras este aviso, la actualización seguirá aplicándose en segundo plano.
            </p>
          </div>
        </div>
      </FormDialogShell>

      {!modalOpen && secondsLeft > 0 && (
        <div
          className={cn(
            'fixed bottom-4 right-4 z-[200] flex items-center gap-2 rounded-2xl border border-border/60 bg-background/95 py-2 pl-3 pr-2 shadow-lg backdrop-blur-sm',
            'animate-in fade-in slide-in-from-bottom-2 duration-200',
          )}
          role="status"
          aria-live="polite"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-[#13944C]/10 text-[#13944C]">
            <RefreshCw className="size-3.5" aria-hidden />
          </span>
          <p className="text-sm text-foreground">
            <span className="font-semibold tabular-nums">{secondsLeft}s</span>
            <span className="text-muted-foreground"> · nueva versión</span>
          </p>
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-lg bg-[#13944C] px-3 text-white hover:bg-[#0f7a3d]"
            onClick={handleReload}
          >
            Ahora
          </Button>
        </div>
      )}
    </>
  );
}
