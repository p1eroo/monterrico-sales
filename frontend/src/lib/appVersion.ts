/** Id del bundle (commit / `VITE_APP_BUILD_ID`; en `vite dev` es `development`). */
export function getClientBuildId(): string {
  return __APP_BUILD_ID__;
}

type VersionPayload = { buildId?: string };

/** `version.json` en el origen, generado en `vite build`. */
export async function fetchDeployedBuildId(): Promise<string | null> {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  const url = `${base}version.json`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as VersionPayload;
    const id = data.buildId;
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}
