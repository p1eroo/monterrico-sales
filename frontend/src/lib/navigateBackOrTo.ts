import type { NavigateFunction } from 'react-router-dom';

/**
 * Vuelve a la ruta anterior del historial del navegador (p. ej. detalle de contacto
 * desde el que se abrió la empresa). Si no hay entrada previa (pestaña nueva, etc.),
 * navega a `fallbackPath` (p. ej. lista de empresas).
 */
export function navigateBackOrTo(navigate: NavigateFunction, fallbackPath: string): void {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    navigate(-1);
    return;
  }
  navigate(fallbackPath);
}
