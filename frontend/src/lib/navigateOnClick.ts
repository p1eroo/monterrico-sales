import type { MouseEvent } from 'react';
import type { NavigateFunction } from 'react-router-dom';

function shouldOpenInNewTab(event: Pick<MouseEvent, 'button' | 'ctrlKey' | 'metaKey'>): boolean {
  return event.button === 1 || event.ctrlKey || event.metaKey;
}

/**
 * Navegación tipo enlace en filas o tarjetas clicables:
 * clic izquierdo normal → misma pestaña; clic medio o Ctrl/Cmd+clic → nueva pestaña.
 */
export function navigateOnClick(
  event: MouseEvent,
  path: string,
  navigate: NavigateFunction,
): void {
  if (event.defaultPrevented) return;

  if (shouldOpenInNewTab(event)) {
    event.preventDefault();
    window.open(path, '_blank', 'noopener,noreferrer');
    return;
  }

  if (event.button === 0) {
    navigate(path);
  }
}

/** Clic medio (rueda): en elementos sin href solo dispara auxclick, no click. */
export function navigateOnAuxClick(event: MouseEvent, path: string): void {
  if (event.button === 1) {
    event.preventDefault();
    window.open(path, '_blank', 'noopener,noreferrer');
  }
}
