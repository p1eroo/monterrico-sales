/** Evento global para sincronizar badge y listas tras cambios de lectura. */
export const CHATWOOT_UNREAD_CHANGED = 'chatwoot-unread-changed';

export function notifyChatwootUnreadChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHATWOOT_UNREAD_CHANGED));
}
