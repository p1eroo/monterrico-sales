import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchDeployedBuildId, getClientBuildId } from '@/lib/appVersion';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const DISMISS_KEY = 'crm-update-dismissed';

/**
 * Aviso cuando el despliegue (`version.json`) es más reciente que este bundle.
 */
export function AppUpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [remoteBuildId, setRemoteBuildId] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    const local = getClientBuildId();
    if (local === 'development') {
      setVisible(false);
      return;
    }

    const remote = await fetchDeployedBuildId();
    if (!remote || remote === local) {
      setVisible(false);
      setRemoteBuildId(null);
      return;
    }

    if (sessionStorage.getItem(DISMISS_KEY) === remote) {
      setVisible(false);
      return;
    }

    setRemoteBuildId(remote);
    setVisible(true);
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

  function handleReload() {
    window.location.reload();
  }

  function handleDismiss() {
    if (remoteBuildId) {
      sessionStorage.setItem(DISMISS_KEY, remoteBuildId);
    }
    setVisible(false);
  }

  if (!visible || !remoteBuildId) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] border-b border-stone-200 bg-[#f7f5f0] shadow-sm dark:border-stone-700 dark:bg-stone-900/95"
      role="region"
      aria-label="Actualización de aplicación disponible"
    >
      <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:flex-nowrap md:px-6">
        <p className="min-w-0 flex-1 text-left text-sm text-stone-800 dark:text-stone-100">
          <span className="font-medium">Hay una versión nueva de la aplicación.</span>{' '}
          <span className="text-stone-700 dark:text-stone-300">
            Actualiza para ver los últimos cambios y evitar errores por caché antigua.
          </span>
        </p>
        <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
          <Button
            type="button"
            size="sm"
            className="bg-[#13944C] text-white hover:bg-[#0f7a3d]"
            onClick={handleReload}
          >
            <RefreshCw className="mr-1.5 size-4" aria-hidden />
            Actualizar ahora
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={handleDismiss}>
            Más tarde
          </Button>
        </div>
      </div>
    </div>
  );
}
